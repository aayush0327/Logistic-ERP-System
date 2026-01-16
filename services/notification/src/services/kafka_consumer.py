# Kafka consumer for processing notification events from other services
import json
import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from kafka import KafkaConsumer
from kafka.errors import KafkaError

from src.config import get_settings
from src.services.notification_service import NotificationService
from src.services.recipient_resolver import RecipientResolver
from src.services.template_renderer import TemplateRenderer

settings = get_settings()
logger = logging.getLogger(__name__)


class NotificationKafkaConsumer:
    """
    Consumes events from Kafka topics and creates notifications.

    Listens for events from:
    - orders service (order events)
    - tms service (trip events)
    - billing service (approval events)
    """

    # Event type to notification type mapping
    EVENT_MAPPINGS = {
        # Order events
        "order.submitted": {
            "type": "order_event",
            "category": "submitted",
            "title_template": "Order #{{order_number}} submitted",
            "message_template": "Order #{{order_number}} has been submitted for approval",
            "priority": "normal",
            "recipients": ["admin", "finance_manager"]
        },
        "order.approved": {
            "type": "order_event",
            "category": "approved",
            "title_template": "Order #{{order_number}} Approved",
            "message_template": "Your order #{{order_number}} has been approved and is now ready for logistics processing",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "order.rejected": {
            "type": "order_event",
            "category": "rejected",
            "title_template": "Order #{{order_number}} Rejected",
            "message_template": "Order #{{order_number}} was rejected. {% if reason %}Reason: {{reason}}{% endif %}",
            "priority": "high",
            "recipients": ["admin", "branch_manager"]
        },
        "order.logistics_approved": {
            "type": "order_event",
            "category": "logistics_approved",
            "title_template": "Order #{{order_number}} Approved for Delivery",
            "message_template": "Order #{{order_number}} has been approved for delivery and will be scheduled shortly",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager", "driver"]
        },
        "order.assigned": {
            "type": "order_event",
            "category": "assigned",
            "title_template": "Order #{{order_number}} Assigned to Trip",
            "message_template": "Order #{{order_number}} has been assigned to trip #{{trip_number}} and is scheduled for delivery",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager", "driver"]
        },
        "order.picked_up": {
            "type": "order_event",
            "category": "picked_up",
            "title_template": "Order #{{order_number}} Picked Up",
            "message_template": "Order #{{order_number}} has been picked up from the branch and is on its way",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "order.in_transit": {
            "type": "order_event",
            "category": "in_transit",
            "title_template": "Order #{{order_number}} In Transit",
            "message_template": "Order #{{order_number}} is now in transit to the destination",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "order.delivered": {
            "type": "order_event",
            "category": "delivered",
            "title_template": "Order #{{order_number}} Delivered Successfully",
            "message_template": "Order #{{order_number}} has been successfully delivered to the customer",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager", "finance_manager"]
        },
        "order.cancelled": {
            "type": "order_event",
            "category": "cancelled",
            "title_template": "Order #{{order_number}} Cancelled",
            "message_template": "Order #{{order_number}} has been cancelled. {% if reason %}Reason: {{reason}}{% endif %}",
            "priority": "high",
            "recipients": ["admin", "branch_manager", "logistics_manager", "finance_manager"]
        },
        "order.partial_in_transit": {
            "type": "order_event",
            "category": "partial_in_transit",
            "title_template": "Order #{{order_number}} Partially In Transit",
            "message_template": "Some items from Order #{{order_number}} are now in transit to the destination",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "order.partial_delivered": {
            "type": "order_event",
            "category": "partial_delivered",
            "title_template": "Order #{{order_number}} Partially Delivered",
            "message_template": "Some items from Order #{{order_number}} have been delivered to the customer",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager", "finance_manager"]
        },
        "order.admin_action": {
            "type": "order_event",
            "category": "admin_action",
            "title_template": "Admin Action on Order #{{order_number}}",
            "message_template": "Admin performed {{action}} on Order #{{order_number}}",
            "priority": "high",
            "recipients": []  # Dynamically resolved from notify_roles field
        },
        "order.due_day_reminder": {
            "type": "order_event",
            "category": "due_day_reminder",
            "title_template": "Order #{{order_number}} Due Soon - {{days_remaining}} Days Left",
            "message_template": "Order #{{order_number}} is due on {{due_date}} ({{days_remaining}} days remaining). Please ensure timely delivery.",
            "priority": "high",
            "recipients": ["admin", "branch_manager"]
        },
        "order.failed": {
            "type": "order_event",
            "category": "failed",
            "title_template": "Order #{{order_number}} Delivery Failed",
            "message_template": "Order #{{order_number}} delivery has failed. {% if reason %}Reason: {{reason}}{% endif %}",
            "priority": "urgent",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "order.returned": {
            "type": "order_event",
            "category": "returned",
            "title_template": "Order #{{order_number}} Returned",
            "message_template": "Order #{{order_number}} has been returned. {% if reason %}Reason: {{reason}}{% endif %}",
            "priority": "high",
            "recipients": ["admin", "branch_manager", "logistics_manager", "finance_manager"]
        },
        # Trip events
        "trip.loading_started": {
            "type": "trip_event",
            "category": "loading_started",
            "title_template": "Trip #{{trip_id}} Loading Started",
            "message_template": "Loading has started for trip #{{trip_id}}. Driver: {{driver_name}}",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "trip.on_route": {
            "type": "trip_event",
            "category": "on_route",
            "title_template": "Trip #{{trip_id}} Now On Route",
            "message_template": "Trip #{{trip_id}} is now on route to destination. Driver: {{driver_name}}",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "trip.paused": {
            "type": "trip_event",
            "category": "paused",
            "title_template": "Trip #{{trip_id}} Paused - Truck Malfunction",
            "message_template": "Trip #{{trip_id}} has been paused. {% if reason %}Reason: {{reason}}{% endif %}",
            "priority": "urgent",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "trip.resumed": {
            "type": "trip_event",
            "category": "resumed",
            "title_template": "Trip #{{trip_id}} Resumed",
            "message_template": "Trip #{{trip_id}} has been resumed and is now active",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
        "trip.completed": {
            "type": "trip_event",
            "category": "completed",
            "title_template": "Trip #{{trip_id}} Completed Successfully",
            "message_template": "Trip #{{trip_id}} has been completed successfully. Driver: {{driver_name}}",
            "priority": "normal",
            "recipients": ["admin", "branch_manager", "logistics_manager", "finance_manager"]
        },
        "trip.resources_reassigned": {
            "type": "trip_event",
            "category": "resources_reassigned",
            "title_template": "Trip #{{trip_id}} Resources Reassigned",
            "message_template": "Trip #{{trip_id}} resources reassigned. New truck: {{new_truck_plate}}, New driver: {{new_driver_name}}",
            "priority": "high",
            "recipients": ["admin", "branch_manager", "logistics_manager"]
        },
    }

    def __init__(self):
        self._consumer: Optional[KafkaConsumer] = None
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._recipient_resolver = RecipientResolver()
        self._template_renderer = TemplateRenderer()

    def initialize(self):
        """Initialize Kafka consumer"""
        try:
            self._consumer = KafkaConsumer(
                settings.KAFKA_NOTIFICATIONS_TOPIC,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                group_id='notification-service-group',
                auto_offset_reset='earliest',
                enable_auto_commit=True
            )
            logger.info(f"Kafka consumer initialized for topic: {settings.KAFKA_NOTIFICATIONS_TOPIC}")
        except Exception as e:
            logger.warning(f"Failed to initialize Kafka consumer: {e}")
            logger.warning("Kafka consumer will be disabled. Notification service will continue without Kafka integration.")
            self._consumer = None  # Set to None so we can check if it's available
            # Don't raise - allow service to start without Kafka

    async def start(self):
        """Start consuming messages from Kafka"""
        try:
            if not self._consumer:
                logger.info("Kafka consumer not initialized, attempting initialization...")
                self.initialize()

            # If still no consumer after initialization attempt, skip starting it
            if not self._consumer:
                logger.info("Kafka consumer not available. Notification service will run without Kafka integration.")
                return

            self._running = True
            logger.info("Kafka consumer started, creating event loop and thread...")

            # Create a new event loop for the consumer thread
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)

            # Run consumption in a separate thread with its own event loop
            import threading
            thread = threading.Thread(target=self._consume_messages, daemon=True, args=(self._loop,))
            thread.start()

            logger.info(f"Kafka consumer thread started, listening on topic: {settings.KAFKA_NOTIFICATIONS_TOPIC}")
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}", exc_info=True)
            logger.warning("Notification service will continue without Kafka integration.")
            # Don't raise - allow service to start

    def _consume_messages(self, loop: asyncio.AbstractEventLoop):
        """
        Consume messages from Kafka (runs in separate thread)

        This method runs synchronously in a thread because kafka-python
        doesn't support async consumption.
        """
        logger.info("Kafka consume loop started")
        # Run the event loop in this thread
        asyncio.set_event_loop(loop)

        while self._running:
            try:
                # Check if consumer is still available
                if not self._consumer:
                    logger.warning("Kafka consumer not available, waiting before retry...")
                    import time
                    time.sleep(10)  # Wait longer before retrying
                    continue

                # Poll for messages (timeout 1 second)
                messages = self._consumer.poll(timeout_ms=1000)

                if messages:
                    logger.info(f"Received {sum(len(records) for records in messages.values())} messages from Kafka")

                for topic_partition, records in messages.items():
                    for message in records:
                        logger.info(f"Processing message: {message.value}")
                        # Run the async coroutine in this event loop
                        try:
                            loop.run_until_complete(self._process_message(message.value))
                        except Exception as e:
                            logger.error(f"Error processing message: {e}", exc_info=True)

            except KafkaError as e:
                logger.error(f"Kafka error: {e}")
            except Exception as e:
                logger.error(f"Error consuming messages: {e}")
                import time
                time.sleep(5)  # Wait before retrying

        logger.info("Kafka consume loop stopped")

    async def _process_message(self, event_data: Dict[str, Any]):
        """
        Process a single Kafka event message

        Expected format:
        {
            "event_id": "uuid",
            "event_type": "order.submitted",
            "tenant_id": "tenant_uuid",
            "timestamp": "2025-01-09T10:30:00Z",
            "data": {
                "entity_type": "order",
                "entity_id": "order_uuid",
                "order_number": "ORD-001",
                ...additional fields
            }
        }
        """
        try:
            logger.info(f"Processing event: {event_data.get('event_type')}")
            event_type = event_data.get("event_type")
            tenant_id = event_data.get("tenant_id")
            data = event_data.get("data", {})

            if not event_type or not tenant_id:
                logger.warning(f"Invalid event format: {event_data}")
                return

            # Get event configuration
            event_config = self.EVENT_MAPPINGS.get(event_type)
            if not event_config:
                logger.warning(f"Unknown event type: {event_type}")
                return

            logger.info(f"Event config found for {event_type}, resolving recipients...")

            # Resolve recipients
            recipient_list = await self._recipient_resolver.resolve_recipients(
                tenant_id=tenant_id,
                event_type=event_type,
                entity_type=data.get("entity_type"),
                entity_id=data.get("entity_id"),
                role_list=event_config["recipients"],
                data=data
            )

            logger.info(f"Resolved recipients: {recipient_list}")

            if not recipient_list:
                logger.info(f"No recipients found for event {event_type}")
                return

            # Render notification content
            title = self._template_renderer.render(
                event_config["title_template"],
                data
            )
            message = self._template_renderer.render(
                event_config["message_template"],
                data
            )

            logger.info(f"Creating notifications for {len(recipient_list)} recipients: {recipient_list}")

            # Create notifications for each recipient
            # Use a separate session maker for this event loop to avoid asyncpg issues
            from src.database import get_async_session_maker
            session_maker = get_async_session_maker()
            async with session_maker() as db:
                notification_service = NotificationService(db)

                for user_id in recipient_list:
                    await notification_service.create_notification(
                        user_id=user_id,
                        tenant_id=tenant_id,
                        type=event_config["type"],
                        category=event_config["category"],
                        title=title,
                        message=message,
                        priority=event_config["priority"],
                        entity_type=data.get("entity_type"),
                        entity_id=data.get("entity_id"),
                        action_url=data.get("action_url")
                    )

                logger.info(
                    f"Created {len(recipient_list)} notifications for event {event_type}"
                )

        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)

    def stop(self):
        """Stop consuming messages"""
        self._running = False
        if self._consumer:
            self._consumer.close()
        if self._loop:
            self._loop.close()
        logger.info("Kafka consumer stopped")


# Global singleton instance
notification_kafka_consumer = NotificationKafkaConsumer()
