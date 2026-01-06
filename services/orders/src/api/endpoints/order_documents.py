"""
Order Documents API endpoints
"""
from typing import List
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
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

logger = logging.getLogger(__name__)
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


@router.post("/{order_id}/documents/delivery-proof", response_model=OrderDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_delivery_proof_document(
    order_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(default="delivery_proof"),
    title: str = Form(default="Delivery Proof"),
    description: str = Form(default="Document uploaded by driver upon delivery"),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:upload", "driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """
    Upload delivery proof document for an order.

    This endpoint is specifically for drivers to upload delivery confirmation
    documents (photos, PDFs, etc.) when marking an order as delivered.
    """
    document_service = OrderDocumentService(db)
    file_handler = FileHandler(use_minio=True)  # Use MinIO for delivery documents

    # Verify order exists and belongs to tenant
    # order_id parameter is actually order_number (e.g., ORD-20260105-53BA49C8)
    from src.services.order_service import OrderService
    order_service = OrderService(db)
    order = await order_service.get_order_by_order_number(order_id, tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Validate file type - allow images and PDFs for delivery proof
    allowed_mime_types = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/gif",
        "image/webp"
    ]

    if file.content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} is not allowed for delivery proof. Allowed types: PDF, JPEG, PNG, GIF, WebP"
        )

    # Validate file size (max 10MB for delivery proof)
    max_delivery_proof_size = 10 * 1024 * 1024  # 10MB
    if file.size and file.size > max_delivery_proof_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit of 10MB for delivery proof"
        )

    # Save file to MinIO
    file_path, file_hash = await file_handler.save_file(file, str(order_id))

    # Create document record - use order.id (actual database UUID) for foreign key
    document_data = OrderDocumentCreate(
        order_id=order.id,
        document_type=document_type,
        title=title,
        description=description,
        is_required=False,
        file_name=file.filename,
        file_path=file_path,
        file_size=file.size or 0,
        mime_type=file.content_type,
        file_hash=file_hash,
        uploaded_by=user_id
    )

    document = await document_service.create_document(document_data)

    # Mark order items as delivered - update all items for this specific order only
    from src.models.order_item import OrderItem
    from sqlalchemy import update

    await db.execute(
        update(OrderItem)
        .where(OrderItem.order_id == order.id)
        .values(item_status="delivered")
    )
    await db.commit()

    return document


@router.get("/{order_id}/documents/delivery-proof", response_model=DocumentListResponse)
async def get_delivery_proof_documents(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:read", "order_documents:read_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    request: Request = None
):
    """
    Get all delivery proof documents for an order.

    Returns documents uploaded by drivers as proof of delivery.
    """
    document_service = OrderDocumentService(db)

    try:
        # order_id could be a UUID or an order_number (like ORD-20260105-XXX)
        # First try to get order by order_number, then fall back to UUID
        from src.services.order_service import OrderService
        order_service = OrderService(db)
        order = None

        # Try getting by order_number first (for order numbers like ORD-20260105-XXX)
        try:
            order = await order_service.get_order_by_order_number(order_id, tenant_id)
        except Exception:
            pass

        # If not found by order_number, try by UUID
        if not order:
            try:
                order_uuid = UUID(order_id)
                order = await order_service.get_order_by_id(order_uuid, tenant_id)
            except ValueError:
                logger.warning(f"Invalid order ID format: {order_id}")
                return DocumentListResponse(documents=[], total=0)

        if not order:
            logger.warning(f"Order not found: {order_id}")
            return DocumentListResponse(documents=[], total=0)

        # Get all documents for this order (using the actual database UUID)
        all_documents = await document_service.get_order_documents(order.id)

        # Filter for delivery proof documents
        delivery_proofs = [
            doc for doc in all_documents
            if doc.document_type == "delivery_proof"
        ]

        # Generate backend proxy URLs for each document (use relative URL for frontend proxy)
        documents_with_urls = []
        for doc in delivery_proofs:
            # Use relative path - frontend will proxy through Next.js API route
            download_url = f"/api/orders/documents/{str(doc.id)}/download"

            doc_dict = {
                "id": str(doc.id),
                "order_id": str(doc.order_id),
                "uploaded_by": str(doc.uploaded_by),
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "file_hash": doc.file_hash,
                "is_verified": doc.is_verified,
                "verified_by": str(doc.verified_by) if doc.verified_by else None,
                "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
                "verification_notes": doc.verification_notes,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at,
                # DocumentBase fields
                "document_type": doc.document_type,
                "title": doc.title,
                "description": doc.description,
                "is_required": doc.is_required,
                # Additional field for frontend - backend proxy URL
                "download_url": download_url
            }
            documents_with_urls.append(doc_dict)

        return DocumentListResponse(documents=documents_with_urls, total=len(documents_with_urls))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching delivery proof documents for order {order_id}: {str(e)}")
        # Return empty list instead of raising error
        return DocumentListResponse(documents=[], total=0)


@router.get("/documents/{document_id}/download")
async def download_document_proxy(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["order_documents:read", "order_documents:read_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Proxy endpoint to download documents from MinIO.
    This streams the actual file content.
    """
    document_service = OrderDocumentService(db)

    # Get document
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

    # Stream file from MinIO to client
    from fastapi.responses import StreamingResponse
    from minio import Minio
    from minio.error import S3Error
    import os

    try:
        # Initialize MinIO client
        minio_client = Minio(
            endpoint=os.getenv("MINIO_ENDPOINT", "minio:9000"),
            access_key=os.getenv("MINIO_ROOT_USER", "minioadmin"),
            secret_key=os.getenv("MINIO_ROOT_PASSWORD", "minioadmin"),
            secure=False
        )

        # Get object from MinIO
        response = minio_client.get_object(
            bucket_name="order-documents",
            object_name=document.file_path
        )

        # Stream the file with inline disposition for browser preview
        # Use 'inline' instead of 'attachment' so images/PDFs display in browser
        def iterfile():
            yield from response.stream(8192)

        return StreamingResponse(
            iterfile(),
            media_type=document.mime_type,
            headers={
                "Content-Disposition": f'inline; filename="{document.file_name}"',
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
            }
        )

    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve file from storage: {str(e)}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download document"
        )