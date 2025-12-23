"""Order management API endpoints with authentication"""

from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from src.database import get_db, TripOrder, Trip
from src.schemas import TripOrderResponse, TripResponse
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)

router = APIRouter()


@router.post("/split")
async def split_order(
    order_id: str,
    split_quantity: int,
    trip_id: str,
    token_data: TokenData = Depends(require_permissions(["orders:split"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Split an order between trips"""
    # Verify the trip belongs to the tenant
    trip_query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    trip_result = await db.execute(trip_query)
    if not trip_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get the original order
    query = select(TripOrder).where(
        and_(
            TripOrder.order_id == order_id,
            TripOrder.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    original_order = result.scalar_one_or_none()

    if not original_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Validate split quantity
    if split_quantity <= 0 or split_quantity >= original_order.quantity:
        raise HTTPException(
            status_code=400,
            detail="Invalid split quantity. Must be between 1 and current quantity - 1"
        )

    # Create new split order
    new_order = TripOrder(
        trip_id=trip_id,
        user_id=user_id,
        company_id=tenant_id,
        order_id=f"{order_id}-split-{uuid4().hex[:8]}",
        customer=original_order.customer,
        customer_address=original_order.customer_address,
        customer_contact=original_order.customer_contact,
        customer_phone=original_order.customer_phone,
        product_name=original_order.product_name,
        weight=original_order.weight * (split_quantity / original_order.quantity),
        volume=original_order.volume * (split_quantity / original_order.quantity),
        quantity=split_quantity,
        special_instructions=original_order.special_instructions,
        delivery_instructions=original_order.delivery_instructions
    )

    # Update original order quantity
    original_order.quantity -= split_quantity

    db.add(new_order)
    await db.commit()

    return {
        "message": "Order split successfully",
        "original_order_id": order_id,
        "new_order_id": new_order.order_id,
        "original_quantity": original_order.quantity + split_quantity,
        "split_quantity": split_quantity
    }


@router.post("/reassign")
async def reassign_order(
    order_id: str,
    from_trip_id: str,
    to_trip_id: str,
    token_data: TokenData = Depends(require_permissions(["orders:reassign"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Reassign an order to a different trip"""
    # Verify both trips belong to the tenant
    trip_query = select(Trip).where(
        and_(
            Trip.id.in_([from_trip_id, to_trip_id]),
            Trip.company_id == tenant_id
        )
    )
    trip_result = await db.execute(trip_query)
    trips = trip_result.scalars().all()

    if len(trips) < 2:
        raise HTTPException(status_code=404, detail="One or both trips not found")

    # Get the order
    query = select(TripOrder).where(
        and_(
            TripOrder.order_id == order_id,
            TripOrder.company_id == tenant_id,
            TripOrder.trip_id == from_trip_id
        )
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found in the specified trip")

    # Update the order's trip
    order.trip_id = to_trip_id
    order.user_id = user_id  # Update who made the change

    await db.commit()

    return {
        "message": "Order reassigned successfully",
        "order_id": order_id,
        "from_trip_id": from_trip_id,
        "to_trip_id": to_trip_id
    }