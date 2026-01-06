"""
Internal endpoint for tenant data cleanup in Finance service
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
import logging

from ...database import get_db
from ...models.approval import ApprovalAction, ApprovalAudit

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/tenant/{tenant_id}")
async def delete_tenant_data(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete all finance data for a tenant"""
    try:
        # Delete approval audits
        await db.execute(delete(ApprovalAudit).where(ApprovalAudit.tenant_id == tenant_id))

        # Delete approval actions
        await db.execute(delete(ApprovalAction).where(ApprovalAction.tenant_id == tenant_id))

        await db.commit()
        logger.info(f"Deleted finance data for tenant {tenant_id}")
        return {"message": "Tenant finance data deleted"}

    except Exception as e:
        logger.error(f"Error deleting tenant finance data: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
