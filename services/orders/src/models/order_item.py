"""
Order Item model definition
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Numeric, Integer, ForeignKey, DateTime
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class OrderItem(Base):
    """Order Item model"""
    __tablename__ = "order_items"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Foreign keys
    order_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Product ID from product service"
    )

    # Item details
    product_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )
    product_code: Mapped[str] = mapped_column(
        String(100),
        nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    unit: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pcs"
    )
    unit_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )
    total_price: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True
    )
    weight: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Weight per unit"
    )
    volume: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Volume per unit"
    )
    dimensions_length: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 2),
        nullable=True
    )
    dimensions_width: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 2),
        nullable=True
    )
    dimensions_height: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 2),
        nullable=True
    )

    # Item status tracking (from TMS)
    item_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default="pending_to_assign",
        index=True,
        comment="Item status: pending_to_assign, planning, loading, on_route, delivered, failed, returned"
    )
    trip_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="ID of the trip this item is assigned to (from TMS service)"
    )

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

    # Relationships
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<OrderItem(product_name={self.product_name}, quantity={self.quantity})>"