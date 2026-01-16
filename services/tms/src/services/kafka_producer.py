# Kafka producer for publishing trip events to notification service
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

from kafka import KafkaProducer
from kafka.errors import KafkaError

from src.config import settings

logger = logging.getLogger(__name__)


class TripEventProducer:
    """
    Kafka producer for publishing trip-related events.

    Events are published to the 'notifications' topic which is consumed
    by the notification service to create real-time notifications.

    Event format:
    {
        "event_id": "uuid",
        "event_type": "trip.status_changed",
        "tenant_id": "tenant_uuid",
        "timestamp": "2025-01-09T10:30:00Z",
        "data": {
            "entity_type": "trip",
            "entity_id": "trip_id",
            "trip_number": "TRIP-123",
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
            event_type: Type of event (e.g., "trip.loading_started", "trip.paused")
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
            # Publish to 'notifications' topic
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

    # Trip Status Change Events

    def publish_trip_loading_started(
        self,
        trip_id: str,
        tenant_id: str,
        driver_id: str,
        driver_name: str,
        branch_id: str,
        started_by: str,
        started_by_role: Optional[str] = None
    ) -> bool:
        """Publish trip.loading_started event"""
        return self.publish_event(
            event_type="trip.loading_started",
            tenant_id=tenant_id,
            actor_user_id=started_by,
            actor_role=started_by_role,
            data={
                "entity_type": "trip",
                "entity_id": trip_id,
                "trip_id": trip_id,
                "driver_id": driver_id,
                "driver_name": driver_name,
                "branch_id": branch_id,
                "started_by": started_by,
                "action_url": f"/trips/{trip_id}"
            }
        )

    def publish_trip_on_route(
        self,
        trip_id: str,
        tenant_id: str,
        driver_id: str,
        driver_name: str,
        branch_id: str,
        started_by: str,
        started_by_role: Optional[str] = None
    ) -> bool:
        """Publish trip.on_route event"""
        return self.publish_event(
            event_type="trip.on_route",
            tenant_id=tenant_id,
            actor_user_id=started_by,
            actor_role=started_by_role,
            data={
                "entity_type": "trip",
                "entity_id": trip_id,
                "trip_id": trip_id,
                "driver_id": driver_id,
                "driver_name": driver_name,
                "branch_id": branch_id,
                "started_by": started_by,
                "action_url": f"/trips/{trip_id}"
            }
        )

    def publish_trip_paused(
        self,
        trip_id: str,
        tenant_id: str,
        driver_id: str,
        driver_name: str,
        branch_id: str,
        paused_by: str,
        paused_by_role: Optional[str] = None,
        reason: Optional[str] = None,
        note: Optional[str] = None
    ) -> bool:
        """Publish trip.paused event (truck malfunction)"""
        data = {
            "entity_type": "trip",
            "entity_id": trip_id,
            "trip_id": trip_id,
            "driver_id": driver_id,
            "driver_name": driver_name,
            "branch_id": branch_id,
            "paused_by": paused_by,
            "action_url": f"/trips/{trip_id}"
        }
        if reason:
            data["reason"] = reason
        if note:
            data["note"] = note

        return self.publish_event(
            event_type="trip.paused",
            tenant_id=tenant_id,
            actor_user_id=paused_by,
            actor_role=paused_by_role,
            data=data
        )

    def publish_trip_resumed(
        self,
        trip_id: str,
        tenant_id: str,
        driver_id: str,
        driver_name: str,
        branch_id: str,
        resumed_by: str,
        resumed_by_role: Optional[str] = None,
        note: Optional[str] = None
    ) -> bool:
        """Publish trip.resumed event"""
        data = {
            "entity_type": "trip",
            "entity_id": trip_id,
            "trip_id": trip_id,
            "driver_id": driver_id,
            "driver_name": driver_name,
            "branch_id": branch_id,
            "resumed_by": resumed_by,
            "action_url": f"/trips/{trip_id}"
        }
        if note:
            data["note"] = note

        return self.publish_event(
            event_type="trip.resumed",
            tenant_id=tenant_id,
            actor_user_id=resumed_by,
            actor_role=resumed_by_role,
            data=data
        )

    def publish_trip_completed(
        self,
        trip_id: str,
        tenant_id: str,
        driver_id: str,
        driver_name: str,
        branch_id: str,
        completed_by: str,
        completed_by_role: Optional[str] = None
    ) -> bool:
        """Publish trip.completed event"""
        return self.publish_event(
            event_type="trip.completed",
            tenant_id=tenant_id,
            actor_user_id=completed_by,
            actor_role=completed_by_role,
            data={
                "entity_type": "trip",
                "entity_id": trip_id,
                "trip_id": trip_id,
                "driver_id": driver_id,
                "driver_name": driver_name,
                "branch_id": branch_id,
                "completed_by": completed_by,
                "action_url": f"/trips/{trip_id}"
            }
        )

    def publish_trip_resources_reassigned(
        self,
        trip_id: str,
        tenant_id: str,
        branch_id: str,
        reassigned_by: str,
        old_truck_plate: str,
        new_truck_plate: str,
        old_driver_id: str,
        new_driver_id: str,
        new_driver_name: str,
        reassigned_by_role: Optional[str] = None
    ) -> bool:
        """Publish trip.resources_reassigned event"""
        return self.publish_event(
            event_type="trip.resources_reassigned",
            tenant_id=tenant_id,
            actor_user_id=reassigned_by,
            actor_role=reassigned_by_role,
            data={
                "entity_type": "trip",
                "entity_id": trip_id,
                "trip_id": trip_id,
                "branch_id": branch_id,
                "reassigned_by": reassigned_by,
                "old_truck_plate": old_truck_plate,
                "new_truck_plate": new_truck_plate,
                "old_driver_id": old_driver_id,
                "new_driver_id": new_driver_id,
                "new_driver_name": new_driver_name,
                "action_url": f"/trips/{trip_id}"
            }
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
trip_event_producer = TripEventProducer()
