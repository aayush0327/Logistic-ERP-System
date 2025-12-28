"""Database configuration and models"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.log_level == "DEBUG",
    future=True,
)

# Create session factory
async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for models
Base = declarative_base()


# Database Models
class Trip(Base):
    """Trip model"""
    __tablename__ = "trips"

    id = Column(String(50), primary_key=True, default=lambda: f"TRIP-{uuid.uuid4().hex[:8].upper()}")
    user_id = Column(String(50), nullable=False)
    company_id = Column(String(50), nullable=False)
    branch = Column(String(100), nullable=False)  # Contains branch ID (UUID)
    truck_plate = Column(String(20), nullable=False)
    truck_model = Column(String(100), nullable=False)
    truck_capacity = Column(Integer, nullable=False)
    driver_id = Column(String(50), nullable=False)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(20), nullable=False)
    status = Column(
        String(50),
        CheckConstraint("status IN ('planning', 'loading', 'on-route', 'completed', 'cancelled', 'truck-malfunction')", name="check_trip_status"),
        nullable=False,
        default="planning"
    )
    origin = Column(String(100))
    destination = Column(String(100))
    distance = Column(Integer)
    estimated_duration = Column(Integer)
    pre_trip_time = Column(Integer, default=30)
    post_trip_time = Column(Integer, default=15)
    capacity_used = Column(Integer, default=0)
    capacity_total = Column(Integer, nullable=False)
    trip_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    orders = relationship("TripOrder", back_populates="trip", cascade="all, delete-orphan")
    routes = relationship("TripRoute", back_populates="trip", cascade="all, delete-orphan")
    # audit_logs relationship removed due to complex foreign key structure


class TripOrder(Base):
    """Trip Order model"""
    __tablename__ = "trip_orders"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(String(50), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), nullable=False)
    company_id = Column(String(50), nullable=False)
    order_id = Column(String(50), nullable=False)
    customer = Column(String(200), nullable=False)
    customer_address = Column(Text)
    status = Column(
        String(50),
        CheckConstraint("status IN ('assigned', 'loading', 'on-route', 'completed')", name="check_trip_order_status"),
        nullable=False,
        default="assigned"
    )
    total = Column(Float, nullable=False)
    weight = Column(Integer, nullable=False)
    volume = Column(Integer, nullable=False)
    items = Column(Integer, nullable=False)
    priority = Column(
        String(20),
        CheckConstraint("priority IN ('high', 'medium', 'low', 'normal')", name="check_priority"),
        nullable=False
    )
    delivery_status = Column(
        String(50),
        CheckConstraint("delivery_status IN ('pending', 'out-for-delivery', 'delivered', 'failed', 'returned')", name="check_delivery_status"),
        default="pending"
    )
    address = Column(Text)
    sequence_number = Column(Integer, nullable=False, default=0)  # Delivery sequence for drag & drop ordering
    assigned_at = Column(DateTime, default=datetime.utcnow)
    original_order_id = Column(String(50))  # For split orders
    original_items = Column(Integer)        # For split orders
    original_weight = Column(Integer)       # For split orders

    # Additional order details
    customer_contact = Column(String(200))
    customer_phone = Column(String(50))
    product_name = Column(String(200))
    quantity = Column(Integer, default=1)
    special_instructions = Column(Text)
    delivery_instructions = Column(Text)

    # Relationships
    trip = relationship("Trip", back_populates="orders")


class TripRoute(Base):
    """Trip Route model"""
    __tablename__ = "trip_routes"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(String(50), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), nullable=False)
    company_id = Column(String(50), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    order_id = Column(Integer, ForeignKey("trip_orders.id"))
    location = Column(String(200), nullable=False)
    estimated_arrival = Column(DateTime)
    status = Column(
        String(20),
        CheckConstraint("status IN ('pending', 'in-progress', 'completed')", name="check_route_status"),
        default="pending"
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    trip = relationship("Trip", back_populates="routes")


class TMSAuditLog(Base):
    """TMS Audit Log model"""
    __tablename__ = "tms_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), nullable=False)
    company_id = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False, default="TMS")
    record_id = Column(String(50))
    record_type = Column(String(50))  # 'trip' or 'trip_order'
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    # Note: This relationship is complex due to the generic audit log structure
    # and can be added later when needed for specific audit log queries


# Dependency to get database session
async def get_db():
    """Dependency to get database session (matching company service pattern)"""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_async_session() -> AsyncSession:
    """Get async database session"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()