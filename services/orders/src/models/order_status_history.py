"""
Order Status History model definition
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, ForeignKey, DateTime
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class OrderStatusHistory(Base):
    """Order Status History model"""
    __tablename__ = "order_status_history"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign keys
    order_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    changed_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="User ID who changed the status"
    )

    # Status change details
    from_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    to_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True
    )

    # Relationships
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="status_history"
    )

    def __repr__(self) -> str:
        return f"<OrderStatusHistory(from={self.from_status}, to={self.to_status})>"