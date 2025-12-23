"""
Finance approval models
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, DateTime, Numeric, Integer, Boolean, ForeignKey, Enum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
import uuid

from src.database import Base


class ApprovalType(str, enum.Enum):
    """Approval type enumeration"""
    FINANCE = "finance"
    LOGISTICS = "logistics"
    PAYMENT = "payment"
    REFUND = "refund"


class ApprovalStatus(str, enum.Enum):
    """Approval status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalAction(Base):
    """Finance approval action model"""
    __tablename__ = "approval_actions"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Approval details
    tenant_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Tenant ID for multi-tenancy"
    )
    order_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Order ID from orders service"
    )
    approval_type: Mapped[ApprovalType] = mapped_column(
        String(20),
        nullable=False,
        default="finance",
        index=True,
        comment="Type of approval"
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
        index=True,
        comment="Current approval status"
    )

    # Amount details
    order_amount: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Total order amount"
    )
    approved_amount: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Approved amount (if different from order amount)"
    )

    # Approval details
    approver_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="User ID of the approver"
    )
    approver_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Name of the approver"
    )
    approval_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for approval"
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for rejection"
    )

    # Additional context
    customer_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Customer ID for context"
    )
    customer_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Customer name for context"
    )
    order_priority: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Order priority level"
    )
    payment_type: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Payment type"
    )

    # System fields
    requested_by: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="User ID who requested the approval"
    )
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
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the approval was processed"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True
    )

    def __repr__(self) -> str:
        return f"<ApprovalAction(id={self.id}, order_id={self.order_id}, status={self.status})>"


class ApprovalAudit(Base):
    """Approval audit trail model"""
    __tablename__ = "approval_audit"

    # Primary key - SERIAL (auto-increment integer)
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Reference to approval action
    approval_action_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Reference to approval action"
    )

    # Audit details
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Action performed (created, approved, rejected, etc.)"
    )
    old_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Previous status"
    )
    new_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="New status"
    )

    # Who performed the action
    user_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="User ID who performed the action"
    )
    user_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Name of the user"
    )
    user_role: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Role of the user"
    )

    # Action details
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for the action"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
        comment="IP address from which action was performed"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="User agent string"
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True
    )

    def __repr__(self) -> str:
        return f"<ApprovalAudit(approval_action_id={self.approval_action_id}, action={self.action})>"