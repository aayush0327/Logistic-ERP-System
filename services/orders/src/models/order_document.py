"""
Order Document model definition
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Enum, ForeignKey, DateTime
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from src.database import Base


class DocumentType(str, enum.Enum):
    """Document type enumeration"""
    INVOICE = "invoice"
    PACKING_LIST = "packing_list"
    DELIVERY_NOTE = "delivery_note"
    PURCHASE_ORDER = "purchase_order"
    QUOTATION = "quotation"
    CONTRACT = "contract"
    RECEIPT = "receipt"
    OTHER = "other"


class OrderDocument(Base):
    """Order Document model"""
    __tablename__ = "order_documents"

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
    uploaded_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="User ID who uploaded the document"
    )

    # Document details
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType),
        nullable=False
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    file_size: Mapped[int] = mapped_column(
        nullable=False
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    file_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="SHA-256 hash of the file"
    )

    # Document status
    is_required: Mapped[bool] = mapped_column(
        nullable=False,
        default=False
    )
    is_verified: Mapped[bool] = mapped_column(
        nullable=False,
        default=False
    )
    verified_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User ID who verified the document"
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    verification_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
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
        back_populates="documents"
    )

    def __repr__(self) -> str:
        return f"<OrderDocument(title={self.title}, type={self.document_type})>"