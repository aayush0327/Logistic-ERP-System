"""
Order Documents API endpoints
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.order_document import OrderDocument
from src.schemas import (
    OrderDocumentCreate,
    OrderDocumentUpdate,
    OrderDocumentResponse,
    DocumentVerificationRequest,
    DocumentUploadResponse,
    DocumentListResponse,
)
from src.services.order_document_service import OrderDocumentService
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_user_id,
    get_current_tenant_id,
)
from src.utils.file_handler import FileHandler

router = APIRouter()


@router.get("/{order_id}/documents", response_model=DocumentListResponse)
async def list_order_documents(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:read", "order_documents:read_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """List all documents for an order"""
    document_service = OrderDocumentService(db)

    # Verify order exists and belongs to tenant
    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    documents = await document_service.get_order_documents(order_id)
    return DocumentListResponse(documents=documents, total=len(documents))


@router.post("/{order_id}/documents", response_model=OrderDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_order_document(
    order_id: UUID,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(None),
    is_required: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["order_documents:upload"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Upload a document for an order"""
    document_service = OrderDocumentService(db)
    file_handler = FileHandler()

    # Verify order exists and belongs to tenant
    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Validate file
    if not file_handler.is_allowed_file_type(file.content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} is not allowed"
        )

    if not file_handler.is_valid_file_size(file.size):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit"
        )

    # Save file
    file_path, file_hash = await file_handler.save_file(file, order_id)

    # Create document record
    document_data = OrderDocumentCreate(
        order_id=order_id,
        document_type=document_type,
        title=title,
        description=description,
        is_required=is_required,
        file_name=file.filename,
        file_path=file_path,
        file_size=file.size,
        mime_type=file.content_type,
        file_hash=file_hash,
        uploaded_by=user_id
    )

    document = await document_service.create_document(document_data)
    return document


@router.get("/documents/{document_id}", response_model=OrderDocumentResponse)
async def get_order_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:read", "order_documents:read_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Get order document by ID"""
    document_service = OrderDocumentService(db)

    document = await document_service.get_document_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify order belongs to tenant
    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(document.order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated order not found"
        )

    return document


@router.put("/documents/{document_id}", response_model=OrderDocumentResponse)
async def update_order_document(
    document_id: UUID,
    document_data: OrderDocumentUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(
        require_permissions(["order_documents:update"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Update order document"""
    document_service = OrderDocumentService(db)

    # Get document and verify order belongs to tenant
    document = await document_service.get_document_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(document.order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated order not found"
        )

    updated_document = await document_service.update_document(document_id, document_data)
    return updated_document


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(
        require_permissions(["order_documents:delete"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Delete order document"""
    document_service = OrderDocumentService(db)
    file_handler = FileHandler()

    # Get document and verify order belongs to tenant
    document = await document_service.get_document_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(document.order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated order not found"
        )

    # Delete file from storage
    await file_handler.delete_file(document.file_path)

    # Delete document record
    await document_service.delete_document(document_id)


@router.post("/documents/{document_id}/verify", response_model=OrderDocumentResponse)
async def verify_order_document(
    document_id: UUID,
    verification_data: DocumentVerificationRequest,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(
        require_permissions(["order_documents:verify"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Verify an order document"""
    document_service = OrderDocumentService(db)

    # Get document and verify order belongs to tenant
    document = await document_service.get_document_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(document.order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated order not found"
        )

    verified_document = await document_service.verify_document(
        document_id,
        verification_data.verified,
        user_id,
        verification_data.verification_notes
    )
    return verified_document


@router.get("/documents/{document_id}/download")
async def download_order_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:read", "order_documents:read_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Download order document"""
    document_service = OrderDocumentService(db)
    file_handler = FileHandler()

    # Get document and verify order belongs to tenant
    document = await document_service.get_document_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(document.order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated order not found"
        )

    # Return file for download
    return await file_handler.get_file_response(
        file_path=document.file_path,
        file_name=document.file_name,
        mime_type=document.mime_type
    )