# Notification Service - Core business logic for notifications
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import (
    Notification,
    UserNotificationPreference,
    ScheduledNotification,
    NotificationDeliveryLog
)
from src.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    UserPreferencesCreate,
    UserPreferencesUpdate,
    UserPreferencesResponse
)

logger = logging.getLogger(__name__)


class NotificationService:
    """Core notification service with CRUD operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        user_id: str,
        tenant_id: str,
        type: str,
        category: str,
        title: str,
        message: str,
        priority: str = "normal",
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        action_url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """
        Create a new notification

        After creation, the notification will be pushed to the user via SSE.
        """
        # Check user preferences before creating notification
        preferences = await self.get_user_preferences(user_id, tenant_id)

        if preferences:
            # Check if user has disabled this type of notification
            if not self._should_create_notification(preferences, type, category):
                logger.info(f"User {user_id} has disabled {type} notifications")
                # Still log the delivery attempt
                await self._log_delivery(
                    user_id=user_id,
                    tenant_id=tenant_id,
                    notification_type=type,
                    status="skipped",
                    detail="User preference disabled"
                )
                return None

        # Create notification
        notification = Notification(
            user_id=user_id,
            tenant_id=tenant_id,
            type=type,
            category=category,
            title=title,
            message=message,
            priority=priority,
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
            data=data or {}
        )

        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        # Push notification via SSE using Redis pub/sub
        # This works even when called from Kafka consumer thread because we use Redis directly
        try:
            import redis.asyncio as redis
            from src.config import get_settings

            settings = get_settings()
            redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )

            message = {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "event_type": "notification",
                "data": {
                    "id": str(notification.id),
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "type": notification.type,
                    "category": notification.category,
                    "title": notification.title,
                    "message": notification.message,
                    "priority": notification.priority,
                    "entity_type": notification.entity_type,
                    "entity_id": str(notification.entity_id) if notification.entity_id else None,
                    "status": notification.status,
                    "is_read": notification.is_read,
                    "read_at": notification.read_at.isoformat() if notification.read_at else None,
                    "action_url": notification.action_url,
                    "data": notification.data,
                    "created_at": notification.created_at.isoformat()
                }
            }

            # Publish to Redis - SSE manager will receive and deliver to connected clients
            await redis_client.publish(
                "notifications:sse",
                json.dumps(message)
            )
            await redis_client.close()

            logger.debug(f"SSE notification published to Redis for user {user_id}")
        except Exception as e:
            # SSE broadcast failed - notification is still in DB, frontend will poll
            logger.error(f"Failed to broadcast SSE notification via Redis: {e}")

        # Log successful delivery
        await self._log_delivery(
            user_id=user_id,
            tenant_id=tenant_id,
            notification_id=str(notification.id),
            notification_type=type,
            status="delivered"
        )

        logger.info(f"Created notification {notification.id} for user {user_id}")
        return notification

    def _should_create_notification(
        self,
        preferences: UserNotificationPreference,
        type: str,
        category: str
    ) -> bool:
        """Check if notification should be created based on user preferences"""
        # Check quiet hours
        if preferences.quiet_hours_enabled:
            from datetime import datetime, time
            now = datetime.now().time()
            if preferences.quiet_hours_start <= now <= preferences.quiet_hours_end:
                return False

        # Check type-specific preferences
        if type == "order_event":
            return preferences.push_order_events
        elif type == "trip_event":
            return preferences.push_order_events  # Use same setting for trip events
        elif type == "system":
            return preferences.push_enabled

        return True

    async def get_notification(
        self,
        notification_id: UUID,
        user_id: str,
        tenant_id: str
    ) -> Optional[Notification]:
        """Get a specific notification by ID"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def get_user_notifications(
        self,
        user_id: str,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[Notification], int]:
        """
        Get notifications for a user with optional filters

        Returns (notifications, total_count)
        """
        # Build query
        query = select(Notification).where(
            Notification.user_id == user_id,
            Notification.tenant_id == tenant_id
        )

        # Apply filters
        if filters:
            if "is_read" in filters:
                query = query.where(Notification.is_read == filters["is_read"])
            if "type" in filters:
                query = query.where(Notification.type == filters["type"])
            if "priority" in filters:
                query = query.where(Notification.priority == filters["priority"])

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # Apply ordering and pagination
        query = query.order_by(Notification.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        notifications = result.scalars().all()

        return list(notifications), total

    async def get_unread_count(self, user_id: str, tenant_id: str) -> int:
        """Get count of unread notifications for a user"""
        result = await self.db.execute(
            select(func.count()).where(
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id,
                Notification.is_read == False
            )
        )
        return result.scalar() or 0

    async def mark_as_read(
        self,
        notification_id: UUID,
        user_id: str,
        tenant_id: str
    ) -> Notification:
        """Mark a notification as read"""
        notification = await self.get_notification(notification_id, user_id, tenant_id)

        if not notification:
            raise ValueError("Notification not found")

        notification.is_read = True
        notification.read_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(notification)

        return notification

    async def mark_all_as_read(self, user_id: str, tenant_id: str) -> int:
        """Mark all notifications for a user as read"""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id,
                Notification.is_read == False
            )
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount

    async def delete_notification(
        self,
        notification_id: UUID,
        user_id: str,
        tenant_id: str
    ):
        """Delete a notification"""
        notification = await self.get_notification(notification_id, user_id, tenant_id)

        if not notification:
            raise ValueError("Notification not found")

        await self.db.delete(notification)
        await self.db.commit()

    async def get_user_stats(self, user_id: str, tenant_id: str) -> Dict[str, Any]:
        """Get notification statistics for a user"""
        # Total notifications
        total_result = await self.db.execute(
            select(func.count()).where(
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id
            )
        )
        total = total_result.scalar() or 0

        # Unread count
        unread = await self.get_unread_count(user_id, tenant_id)

        # Breakdown by type
        type_result = await self.db.execute(
            select(Notification.type, func.count())
            .where(
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id
            )
            .group_by(Notification.type)
        )
        by_type = {row[0]: row[1] for row in type_result.all()}

        # Breakdown by priority
        priority_result = await self.db.execute(
            select(Notification.priority, func.count())
            .where(
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id
            )
            .group_by(Notification.priority)
        )
        by_priority = {row[0]: row[1] for row in priority_result.all()}

        return {
            "total": total,
            "unread": unread,
            "by_type": by_type,
            "by_priority": by_priority
        }

    # User Preferences methods

    async def get_user_preferences(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[UserNotificationPreference]:
        """Get notification preferences for a user"""
        result = await self.db.execute(
            select(UserNotificationPreference).where(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def create_default_preferences(
        self,
        user_id: str,
        tenant_id: str
    ) -> UserNotificationPreference:
        """Create default notification preferences for a user"""
        preferences = UserNotificationPreference(
            user_id=user_id,
            tenant_id=tenant_id,
            email_enabled=True,
            push_enabled=True,
            email_order_events=True,
            push_order_events=True,
            email_daily_summary=False,
            quiet_hours_enabled=False,
            daily_summary_enabled=False
        )

        self.db.add(preferences)
        await self.db.commit()
        await self.db.refresh(preferences)

        return preferences

    async def update_user_preferences(
        self,
        user_id: str,
        tenant_id: str,
        preferences_update: UserPreferencesUpdate
    ) -> UserNotificationPreference:
        """Update notification preferences for a user"""
        preferences = await self.get_user_preferences(user_id, tenant_id)

        if not preferences:
            raise ValueError("Preferences not found")

        # Update fields
        update_data = preferences_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(preferences, field, value)

        await self.db.commit()
        await self.db.refresh(preferences)

        return preferences

    async def reset_preferences_to_default(
        self,
        user_id: str,
        tenant_id: str
    ) -> UserNotificationPreference:
        """Reset notification preferences to defaults"""
        # Delete existing preferences
        await self.db.execute(
            delete(UserNotificationPreference).where(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.tenant_id == tenant_id
            )
        )
        await self.db.commit()

        # Create new default preferences
        return await self.create_default_preferences(user_id, tenant_id)

    # Scheduled Notifications methods

    async def create_scheduled_notification(
        self,
        tenant_id: str,
        user_id: str,
        notification_type: str,
        schedule_type: str,
        scheduled_for: datetime,
        title: str,
        message: str,
        priority: str = "normal",
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None
    ) -> ScheduledNotification:
        """Create a scheduled notification"""
        scheduled = ScheduledNotification(
            tenant_id=tenant_id,
            user_id=user_id,
            notification_type=notification_type,
            schedule_type=schedule_type,
            scheduled_for=scheduled_for,
            title=title,
            message=message,
            priority=priority,
            entity_type=entity_type,
            entity_id=entity_id
        )

        self.db.add(scheduled)
        await self.db.commit()
        await self.db.refresh(scheduled)

        return scheduled

    async def get_due_scheduled_notifications(self) -> List[ScheduledNotification]:
        """Get all scheduled notifications that are due to be sent"""
        result = await self.db.execute(
            select(ScheduledNotification).where(
                ScheduledNotification.status == "pending",
                ScheduledNotification.scheduled_for <= datetime.utcnow()
            )
        )
        return list(result.scalars().all())

    async def mark_scheduled_sent(self, scheduled_id: UUID):
        """Mark a scheduled notification as sent"""
        await self.db.execute(
            update(ScheduledNotification)
            .where(ScheduledNotification.id == scheduled_id)
            .values(status="sent")
        )
        await self.db.commit()

    # Delivery Logging

    async def _log_delivery(
        self,
        user_id: str,
        tenant_id: str,
        notification_type: str,
        status: str,
        notification_id: Optional[str] = None,
        detail: Optional[str] = None
    ):
        """Log notification delivery attempt (for debugging)"""
        # Only log if we have a valid notification_id
        if not notification_id:
            return

        try:
            log = NotificationDeliveryLog(
                notification_id=UUID(notification_id) if notification_id else None,
                user_id=user_id,
                delivery_method="sse",  # All notifications go through SSE or polling
                status=status,
                error_message=detail
            )

            self.db.add(log)
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log delivery: {e}")
