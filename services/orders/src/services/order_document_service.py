"""
Order Document service - Business logic for order document management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from src.models.order_document import OrderDocument, DocumentType
from src.schemas import OrderDocumentCreate, OrderDocumentUpdate

class OrderDocumentService:
    """Service for managing order documents"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_order_documents(self, order_id: UUID) -> List[OrderDocument]:
        """Get all documents for an order"""
        query = select(OrderDocument).where(
            OrderDocument.order_id == order_id
        ).order_by(OrderDocument.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_document_by_id(self, document_id: UUID) -> Optional[OrderDocument]:
        """Get document by ID"""
        query = select(OrderDocument).where(OrderDocument.id == document_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_document(self, document_data: OrderDocumentCreate) -> OrderDocument:
        """Create a new document"""
        document = OrderDocument(
            order_id=document_data.order_id,
            document_type=document_data.document_type,
            title=document_data.title,
            description=document_data.description,
            is_required=document_data.is_required,
            file_name=document_data.file_name,
            file_path=document_data.file_path,
            file_size=document_data.file_size,
            mime_type=document_data.mime_type,
            file_hash=document_data.file_hash,
            uploaded_by=document_data.uploaded_by
        )

        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)

        return document

    async def update_document(
        self,
        document_id: UUID,
        document_data: OrderDocumentUpdate
    ) -> OrderDocument:
        """Update document details"""
        query = select(OrderDocument).where(OrderDocument.id == document_id)
        result = await self.db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        # Update fields
        update_data = document_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(document, field, value)

        document.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(document)

        return document

    async def delete_document(self, document_id: UUID) -> None:
        """Delete a document"""
        query = select(OrderDocument).where(OrderDocument.id == document_id)
        result = await self.db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        await self.db.delete(document)
        await self.db.commit()

    async def verify_document(
        self,
        document_id: UUID,
        verified: bool,
        user_id: UUID,
        verification_notes: Optional[str] = None
    ) -> OrderDocument:
        """Verify or unverify a document"""
        query = select(OrderDocument).where(OrderDocument.id == document_id)
        result = await self.db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        document.is_verified = verified
        document.verified_by = user_id
        document.verified_at = datetime.utcnow() if verified else None
        document.verification_notes = verification_notes
        document.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(document)

        return document

    async def get_required_documents(self, order_id: UUID) -> List[OrderDocument]:
        """Get all required documents for an order"""
        query = select(OrderDocument).where(
            and_(
                OrderDocument.order_id == order_id,
                OrderDocument.is_required == True
            )
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_pending_verifications(self, order_id: UUID) -> List[OrderDocument]:
        """Get documents pending verification"""
        query = select(OrderDocument).where(
            and_(
                OrderDocument.order_id == order_id,
                OrderDocument.is_verified == False
            )
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def check_all_required_verified(self, order_id: UUID) -> bool:
        """Check if all required documents are verified"""
        required_docs = await self.get_required_documents(order_id)

        for doc in required_docs:
            if not doc.is_verified:
                return False

        return True