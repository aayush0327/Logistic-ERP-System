"""Order management API endpoints"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_async_session, TripOrder, Trip
from src.schemas import TripOrderResponse, TripResponse

router = APIRouter()


@router.post("/split", response_model=dict)
async def split_order(
    order_id: str,
    split_quantity: int,
    trip_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    """Split an order between trips"""
    # Get the original order
    query = select(TripOrder).where(
        TripOrder.order_id == order_id,
        TripOrder.trip_id == trip_id
    )
    result = await db.execute(query)
    original_order = result.scalar_one_or_none()

    if not original_order:
        raise HTTPException(status_code=404, detail="Order not found")

    if split_quantity >= original_order.items:
        raise HTTPException(
            status_code=400,
            detail="Split quantity must be less than original order quantity"
        )

    # Calculate split amounts
    ratio = split_quantity / original_order.items
    split_weight = int(original_order.weight * ratio)
    split_volume = int(original_order.volume * ratio)
    split_total = original_order.total * ratio

    # Create split order
    split_order = TripOrder(
        trip_id=trip_id,
        order_id=f"{order_id}-SPLIT-{split_quantity}",
        customer=original_order.customer,
        customerAddress=original_order.customerAddress,
        total=split_total,
        weight=split_weight,
        volume=split_volume,
        items=split_quantity,
        priority=original_order.priority,
        address=original_order.address,
        original_order_id=order_id,
        original_items=original_order.items,
        original_weight=original_order.weight
    )

    # Update original order
    original_order.items -= split_quantity
    original_order.weight -= split_weight
    original_order.volume -= split_volume
    original_order.total -= split_total

    db.add(split_order)
    await db.commit()
    await db.refresh(split_order)

    return {
        "message": "Order split successfully",
        "original_order": {
            "id": original_order.order_id,
            "remaining_items": original_order.items
        },
        "split_order": {
            "id": split_order.order_id,
            "items": split_order.items
        }
    }