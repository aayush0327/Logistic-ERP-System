"""
Internal endpoint for tenant data cleanup in Orders service
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
import logging

from ...database import get_db
from ...models.order import Order
from ...models.order_item import OrderItem
from ...models.order_document import OrderDocument

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/tenant/{tenant_id}")
async def delete_tenant_data(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete all order data for a tenant"""
    try:
        # Delete order documents first (child of orders)
        await db.execute(
            delete(OrderDocument).where(
                OrderDocument.order_id.in_(
                    select(Order.id).where(Order.tenant_id == tenant_id)
                )
            )
        )

        # Delete order items
        await db.execute(
            delete(OrderItem).where(
                OrderItem.order_id.in_(
                    select(Order.id).where(Order.tenant_id == tenant_id)
                )
            )
        )

        # Delete orders
        await db.execute(delete(Order).where(Order.tenant_id == tenant_id))

        await db.commit()
        logger.info(f"Deleted orders data for tenant {tenant_id}")
        return {"message": "Tenant orders data deleted"}

    except Exception as e:
        logger.error(f"Error deleting tenant orders: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
