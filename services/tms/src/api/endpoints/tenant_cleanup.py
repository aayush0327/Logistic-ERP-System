"""
Internal endpoint for tenant data cleanup in TMS service
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
import logging

from ...database import get_db, Trip, TripOrder

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/tenant/{tenant_id}")
async def delete_tenant_data(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete all TMS data for a tenant"""
    try:
        # Note: TMS uses company_id instead of tenant_id - need to handle this
        # Delete trip orders (junction table)
        await db.execute(
            delete(TripOrder).where(
                TripOrder.trip_id.in_(
                    select(Trip.id).where(Trip.company_id == tenant_id)
                )
            )
        )

        # Delete trips
        await db.execute(delete(Trip).where(Trip.company_id == tenant_id))

        await db.commit()
        logger.info(f"Deleted TMS data for tenant {tenant_id}")
        return {"message": "Tenant TMS data deleted"}

    except Exception as e:
        logger.error(f"Error deleting tenant TMS data: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
