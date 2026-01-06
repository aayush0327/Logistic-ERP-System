"""Trip Item Assignment Model"""
from sqlalchemy import Column, String, Integer, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import Base


class TripItemAssignment(Base):
    """Trip Item Assignment model for tracking split/partial item assignments"""
    __tablename__ = "trip_item_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True)
    trip_id = Column(String(50), nullable=False, index=True)
    order_id = Column(String(255), nullable=False, index=True)
    order_item_id = Column(String(255), nullable=False, index=True)
    order_number = Column(String(50), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Assignment details
    assigned_quantity = Column(Integer, nullable=False)
    item_status = Column(
        String(50),
        CheckConstraint("item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')"),
        nullable=False,
        default="pending_to_assign"
    )

    # Timestamps
    assigned_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
