"""
Order model definitions
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, DateTime, Numeric, Integer, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from src.database import Base


class OrderStatus(str, enum.Enum):
    """Order status enumeration"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    FINANCE_APPROVED = "finance_approved"
    FINANCE_REJECTED = "finance_rejected"
    LOGISTICS_APPROVED = "logistics_approved"
    LOGISTICS_REJECTED = "logistics_rejected"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    PARTIAL_IN_TRANSIT = "partial_in_transit"  # Some items on-route, others still planning/loading
    IN_TRANSIT = "in_transit"
    PARTIAL_DELIVERED = "partial_delivered"  # Some items delivered, others still in transit
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderType(str, enum.Enum):
    """Order type enumeration"""
    PICKUP = "pickup"
    DELIVERY = "delivery"
    BOTH = "both"


class PaymentType(str, enum.Enum):
    """Payment type enumeration"""
    COD = "cod"  # Cash on Delivery
    PREPAID = "prepaid"
    CREDIT = "credit"


class Order(Base):
    """Order model"""
    __tablename__ = "orders"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Order details
    order_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        comment="Tenant ID - references tenant in auth database",
        nullable=False,
        index=True
    )
    customer_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Customer ID from customer service"
    )
    branch_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Branch ID from branch service"
    )

    # Order information
    order_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="delivery"
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="draft",
        index=True
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="normal"
    )
    tms_order_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default="available",
        index=True
    )
    # JSON columns for TMS partial assignment tracking
    items_json: Mapped[Optional[object]] = mapped_column(JSONB, nullable=True)
    remaining_items_json: Mapped[Optional[object]] = mapped_column(JSONB, nullable=True)

    # Pickup and delivery addresses
    pickup_address: Mapped[str] = mapped_column(Text, nullable=True)
    pickup_contact_name: Mapped[str] = mapped_column(String(100), nullable=True)
    pickup_contact_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    pickup_city: Mapped[str] = mapped_column(String(100), nullable=True)
    pickup_state: Mapped[str] = mapped_column(String(100), nullable=True)
    pickup_pincode: Mapped[str] = mapped_column(String(20), nullable=True)

    delivery_address: Mapped[str] = mapped_column(Text, nullable=True)
    delivery_contact_name: Mapped[str] = mapped_column(String(100), nullable=True)
    delivery_contact_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    delivery_city: Mapped[str] = mapped_column(String(100), nullable=True)
    delivery_state: Mapped[str] = mapped_column(String(100), nullable=True)
    delivery_pincode: Mapped[str] = mapped_column(String(20), nullable=True)

    # Weight and dimensions
    total_weight: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )
    total_volume: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )
    package_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Financial information
    total_amount: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True
    )
    payment_type: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
    )

    # Special requirements
    special_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delivery_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # System fields
    created_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="User ID who created the order"
    )
    updated_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="User ID who last updated the order"
    )
    finance_approved_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="User ID who approved in finance"
    )
    logistics_approved_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="User ID who approved in logistics"
    )
    driver_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Driver ID assigned to this order"
    )
    trip_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Trip ID from TMS service"
    )

    # Dates
    pickup_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    delivery_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    finance_approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    logistics_approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Rejection information
    finance_rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logistics_rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True
    )

    # Relationships
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    documents: Mapped[list["OrderDocument"]] = relationship(
        "OrderDocument",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    status_history: Mapped[list["OrderStatusHistory"]] = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Order(order_number={self.order_number}, status={self.status})>"
