"""
Order Document Pydantic schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, validator

from src.models.order_document import DocumentType


class OrderDocumentBase(BaseModel):
    """Base order document schema"""
    document_type: DocumentType
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    is_required: bool = False


class OrderDocumentCreate(OrderDocumentBase):
    """Schema for creating an order document"""
    order_id: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    file_hash: Optional[str] = None
    uploaded_by: str


class OrderDocumentUpdate(BaseModel):
    """Schema for updating an order document"""
    document_type: Optional[DocumentType] = None
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_required: Optional[bool] = None


class OrderDocumentResponse(OrderDocumentBase):
    """Schema for order document response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    uploaded_by: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    file_hash: Optional[str]
    is_verified: bool
    verified_by: Optional[str]
    verified_at: Optional[datetime]
    verification_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    download_url: Optional[str] = None  # Presigned URL for downloading the file


class DocumentVerificationRequest(BaseModel):
    """Schema for document verification"""
    verified: bool
    verification_notes: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    """Schema for document upload response"""
    document_id: str
    file_name: str
    file_size: int
    mime_type: str
    upload_url: Optional[str] = None


class DocumentListResponse(BaseModel):
    """Schema for document list response"""
    documents: list[OrderDocumentResponse]
    total: int