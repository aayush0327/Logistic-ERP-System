"""
Internal endpoint for tenant data cleanup in Driver service
"""
from fastapi import APIRouter, HTTPException
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/tenant/{tenant_id}")
async def delete_tenant_data(
    tenant_id: str,
):
    """Delete all driver data for a tenant"""
    try:
        # Driver service is a client-only service that doesn't store data
        # All driver data is stored in TMS service
        logger.info(f"Driver service has no local data to delete for tenant {tenant_id}")
        return {"message": "Driver service has no local data - TMS service handles driver data"}

    except Exception as e:
        logger.error(f"Error in tenant cleanup for driver service: {e}")
        raise HTTPException(status_code=500, detail=str(e))
