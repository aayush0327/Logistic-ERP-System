# Database configuration and models
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Index, func, UUID, JSON
from datetime import datetime, timezone
from src.config import get_settings
import uuid
import json

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


def get_async_session_maker():
    """
    Create a new session maker bound to the current event loop.

    This is useful for background tasks (like Kafka consumer) that run
    in a separate event loop from the main FastAPI app.
    """
    from sqlalchemy.ext.asyncio import create_async_engine
    from src.config import get_settings
    settings = get_settings()

    # Create a new engine for this event loop
    loop_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True
    )

    return async_sessionmaker(
        loop_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )


async def get_db() -> AsyncSession:
    """Get database session"""
    async with async_session_maker() as session:
        yield session


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


class Notification(Base):
    """Notification model"""
    __tablename__ = "notifications"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=lambda: uuid.uuid4()
    )
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[Text] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=True)
    action_url: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        Index("idx_notifications_tenant_user", "tenant_id", "user_id"),
    )


class UserNotificationPreference(Base):
    """User notification preferences model"""
    __tablename__ = "user_notification_preferences"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=lambda: uuid.uuid4()
    )
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Email preferences
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_order_events: Mapped[bool] = mapped_column(Boolean, default=True)
    email_trip_events: Mapped[bool] = mapped_column(Boolean, default=True)
    email_system_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    email_daily_summary: Mapped[bool] = mapped_column(Boolean, default=False)

    # Push preferences
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    push_order_events: Mapped[bool] = mapped_column(Boolean, default=True)
    push_trip_events: Mapped[bool] = mapped_column(Boolean, default=True)
    push_system_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    push_alerts: Mapped[bool] = mapped_column(Boolean, default=True)

    # Quiet hours
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    quiet_hours_start: Mapped[str] = mapped_column(String(5), default="22:00")
    quiet_hours_end: Mapped[str] = mapped_column(String(5), default="08:00")
    quiet_hours_timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Daily summary
    daily_summary_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_summary_time: Mapped[str] = mapped_column(String(5), default="09:00")
    daily_summary_timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        Index("idx_preferences_tenant_user", "tenant_id", "user_id"),
    )


class ScheduledNotification(Base):
    """Scheduled notification model"""
    __tablename__ = "scheduled_notifications"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=lambda: uuid.uuid4()
    )
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[Text] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Text] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        Index("idx_scheduled_tenant_user", "tenant_id", "user_id"),
    )


class NotificationDeliveryLog(Base):
    """Notification delivery log for debugging and analytics"""
    __tablename__ = "notification_delivery_log"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=lambda: uuid.uuid4()
    )
    notification_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    delivery_method: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_message: Mapped[Text] = mapped_column(Text, nullable=True)
    response_code: Mapped[int] = mapped_column(nullable=True)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    __table_args__ = (
        Index("idx_delivery_log_notification", "notification_id"),
    )


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        # Import all models here to ensure they are registered with Base
        from src.database import Notification, UserNotificationPreference, ScheduledNotification, NotificationDeliveryLog
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)


async def get_db_context():
    """Context manager for database session - useful for scheduler and background tasks"""
    async with async_session_maker() as session:
        yield session
