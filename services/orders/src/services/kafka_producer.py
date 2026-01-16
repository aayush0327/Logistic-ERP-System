# Kafka producer for publishing order events to notification service
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

from kafka import KafkaProducer
from kafka.errors import KafkaError

from src.config import settings

logger = logging.getLogger(__name__)


class OrderEventProducer:
    """
    Kafka producer for publishing order-related events.

    Events are published to the 'notifications' topic which is consumed
    by the notification service to create real-time notifications.

    Event format:
    {
        "event_id": "uuid",
        "event_type": "order.submitted",
        "tenant_id": "tenant_uuid",
        "timestamp": "2025-01-09T10:30:00Z",
        "actor": {
            "user_id": "user_uuid",
            "role": "Admin"
        },
        "data": {
            "entity_type": "order",
            "entity_id": "order_uuid",
            "order_number": "ORD-001",
            ...additional fields
        }
    }
    """

    def __init__(self):
        self._producer: Optional[KafkaProducer] = None

    def initialize(self):
        """Initialize Kafka producer"""
        try:
            self._producer = KafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',  # Wait for all replicas to acknowledge
                retries=3,
                linger_ms=10  # Batch messages for 10ms before sending
            )
            logger.info(f"Kafka producer initialized: {settings.KAFKA_BOOTSTRAP_SERVERS}")
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            raise

    def publish_event(
        self,
        event_type: str,
        tenant_id: str,
        data: Dict[str, Any],
        actor_user_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        event_id: Optional[str] = None
    ) -> bool:
        """
        Publish an event to Kafka.

        Args:
            event_type: Type of event (e.g., "order.submitted", "order.approved")
            tenant_id: Tenant ID
            data: Event data payload
            actor_user_id: Optional user ID of the user who triggered the event
            actor_role: Optional role name of the user who triggered the event
            event_id: Optional event ID (auto-generated if not provided)

        Returns:
            True if event was published successfully, False otherwise
        """
        if not self._producer:
            logger.warning("Kafka producer not initialized, attempting to initialize...")
            try:
                self.initialize()
            except Exception as e:
                logger.error(f"Failed to initialize producer: {e}")
                return False

        event = {
            "event_id": event_id or str(uuid.uuid4()),
            "event_type": event_type,
            "tenant_id": tenant_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "actor": {
                "user_id": actor_user_id,
                "role": actor_role
            } if actor_user_id else None,
            "data": data
        }

        try:
            # Publish to 'notifications' topic (not 'orders' or 'order-events')
            # This matches the topic the notification service is listening on
            future = self._producer.send(
                'notifications',
                value=event,
                key=tenant_id.encode('utf-8')  # Partition by tenant_id
            )

            # Wait for acknowledgment (with timeout)
            record_metadata = future.get(timeout=10)

            logger.info(
                f"Published event {event_type} (id: {event['event_id']}) "
                f"to partition {record_metadata.partition} "
                f"at offset {record_metadata.offset}"
            )
            return True

        except KafkaError as e:
            logger.error(f"Failed to publish event {event_type}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing event {event_type}: {e}")
            return False

    def publish_order_submitted(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        total_amount: float,
        created_by: str,
        created_by_role: Optional[str] = None
    ) -> bool:
        """Publish order.submitted event"""
        return self.publish_event(
            event_type="order.submitted",
            tenant_id=tenant_id,
            actor_user_id=created_by,
            actor_role=created_by_role,
            data={
                "entity_type": "order",
                "entity_id": order_id,
                "order_number": order_number,
                "branch_id": branch_id,
                "customer_id": customer_id,
                "total_amount": float(total_amount),
                "created_by": created_by,
                "action_url": f"/orders/{order_id}"
            }
        )

    def publish_order_approved(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        approved_by: str,
        total_amount: float,
        approved_by_role: Optional[str] = None,
        payment_type: Optional[str] = None
    ) -> bool:
        """Publish order.approved event"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "approved_by": approved_by,
            "total_amount": float(total_amount),
            "action_url": f"/orders/{order_id}"
        }
        if payment_type:
            data["payment_type"] = payment_type

        return self.publish_event(
            event_type="order.approved",
            tenant_id=tenant_id,
            actor_user_id=approved_by,
            actor_role=approved_by_role,
            data=data
        )

    def publish_order_rejected(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        rejected_by: str,
        rejected_by_role: Optional[str] = None,
        reason: Optional[str] = None
    ) -> bool:
        """Publish order.rejected event"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "rejected_by": rejected_by,
            "action_url": f"/orders/{order_id}"
        }
        if reason:
            data["reason"] = reason

        return self.publish_event(
            event_type="order.rejected",
            tenant_id=tenant_id,
            actor_user_id=rejected_by,
            actor_role=rejected_by_role,
            data=data
        )

    def publish_order_logistics_approved(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        approved_by: str,
        approved_by_role: Optional[str] = None,
        driver_id: Optional[str] = None,
        trip_id: Optional[str] = None
    ) -> bool:
        """Publish order.logistics_approved event"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "approved_by": approved_by,
            "action_url": f"/orders/{order_id}"
        }
        if driver_id:
            data["driver_id"] = driver_id
        if trip_id:
            data["trip_id"] = trip_id

        return self.publish_event(
            event_type="order.logistics_approved",
            tenant_id=tenant_id,
            actor_user_id=approved_by,
            actor_role=approved_by_role,
            data=data
        )

    def publish_order_assigned(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        driver_id: str,
        trip_id: str,
        trip_number: str
    ) -> bool:
        """Publish order.assigned event"""
        return self.publish_event(
            event_type="order.assigned",
            tenant_id=tenant_id,
            data={
                "entity_type": "order",
                "entity_id": order_id,
                "order_number": order_number,
                "driver_id": driver_id,
                "trip_id": trip_id,
                "trip_number": trip_number,
                "action_url": f"/orders/{order_id}"
            }
        )

    def publish_order_status_changed(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        status: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Publish order status change events (picked_up, in_transit, delivered)"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "status": status,
            "action_url": f"/orders/{order_id}"
        }
        if additional_data:
            data.update(additional_data)

        event_type = f"order.{status}"
        return self.publish_event(
            event_type=event_type,
            tenant_id=tenant_id,
            data=data
        )

    def publish_order_cancelled(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        cancelled_by: str,
        cancelled_by_role: Optional[str] = None,
        reason: Optional[str] = None
    ) -> bool:
        """Publish order.cancelled event"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "cancelled_by": cancelled_by,
            "action_url": f"/orders/{order_id}"
        }
        if reason:
            data["reason"] = reason

        return self.publish_event(
            event_type="order.cancelled",
            tenant_id=tenant_id,
            actor_user_id=cancelled_by,
            actor_role=cancelled_by_role,
            data=data
        )

    def publish_admin_action(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        performed_by: str,
        performed_by_role: Optional[str] = None,
        action: str = "",
        created_by: str = "",
        notify_roles: Optional[List[str]] = None
    ) -> bool:
        """Publish admin action event"""
        return self.publish_event(
            event_type="order.admin_action",
            tenant_id=tenant_id,
            actor_user_id=performed_by,
            actor_role=performed_by_role,
            data={
                "entity_type": "order",
                "entity_id": order_id,
                "order_number": order_number,
                "performed_by": performed_by,
                "action": action,
                "action_url": f"/orders/{order_id}",
                "notify_roles": notify_roles or [],
                "created_by": created_by
            }
        )

    def publish_order_due_day_reminder(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        due_days: int,
        days_remaining: int,
        due_date: str,
        total_amount: float
    ) -> bool:
        """Publish order.due_day_reminder event - sent when order is 4 days before due date"""
        return self.publish_event(
            event_type="order.due_day_reminder",
            tenant_id=tenant_id,
            data={
                "entity_type": "order",
                "entity_id": order_id,
                "order_number": order_number,
                "branch_id": branch_id,
                "customer_id": customer_id,
                "due_days": due_days,
                "days_remaining": days_remaining,
                "due_date": due_date,
                "total_amount": float(total_amount),
                "action_url": f"/orders/{order_id}"
            }
        )

    def publish_order_failed_delivery(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """Publish order.failed event - when delivery fails"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "action_url": f"/orders/{order_id}"
        }
        if reason:
            data["reason"] = reason

        return self.publish_event(
            event_type="order.failed",
            tenant_id=tenant_id,
            data=data
        )

    def publish_order_returned(
        self,
        order_id: str,
        order_number: str,
        tenant_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """Publish order.returned event - when order is returned"""
        data = {
            "entity_type": "order",
            "entity_id": order_id,
            "order_number": order_number,
            "action_url": f"/orders/{order_id}"
        }
        if reason:
            data["reason"] = reason

        return self.publish_event(
            event_type="order.returned",
            tenant_id=tenant_id,
            data=data
        )

    def flush(self):
        """Flush any pending messages"""
        if self._producer:
            self._producer.flush(timeout=10)

    def close(self):
        """Close the Kafka producer"""
        if self._producer:
            self._producer.close(timeout=10)
            logger.info("Kafka producer closed")


# Global singleton instance
order_event_producer = OrderEventProducer()
