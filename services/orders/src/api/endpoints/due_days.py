"""
Due Days endpoints for branch manager dashboard
"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel

from src.database import get_db
from src.models.order import Order, OrderStatus
from src.security import get_current_token_data, TokenData
from sqlalchemy.sql.expression import literal_column

logger = logging.getLogger(__name__)
router = APIRouter()


class MarkAsCreatedRequest(BaseModel):
    """Request to mark order as created"""
    order_ids: List[str]


@router.get("/orders")
async def get_due_days_orders(
    days_threshold: int = Query(3, ge=1, le=30, description="Days threshold for showing orders"),
    filter_date: Optional[str] = Query(None, description="Filter date (ISO format)"),
    status_filter: Optional[str] = Query(None, description="Filter by status: due_soon, overdue"),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(get_current_token_data)
):
    """
    Get orders based on due days threshold.

    Shows orders where:
    - created_at + due_days <= current_date + days_threshold
    - NOT marked as created
    - Filters by tenant_id

    Query params:
    - days_threshold: Number of days to look ahead (default: 3)
    - filter_date: Date to calculate from (default: today)
    - status_filter: Filter by "due_soon" or "overdue"
    """
    tenant_id = token_data.tenant_id

    # Calculate reference date (use filter_date or today)
    if filter_date:
        try:
            reference_date = datetime.fromisoformat(filter_date.replace('Z', '+00:00'))
        except ValueError:
            reference_date = datetime.now(timezone.utc)
    else:
        reference_date = datetime.now(timezone.utc)

    # Calculate threshold date
    threshold_date = reference_date + timedelta(days=days_threshold)

    # Build base query
    query = select(Order).where(
        and_(
            Order.tenant_id == tenant_id,
            Order.due_days.isnot(None),
            Order.due_days_marked_created == False,
            Order.is_active == True
        )
    )

    # Fetch all orders and filter in Python (since SQLAlchemy interval arithmetic is complex)
    result = await db.execute(query)
    all_orders = result.scalars().all()

    # Filter orders based on due date calculation
    orders_with_status = []
    for order in all_orders:
        # Ensure created_at is timezone-aware
        created_at = order.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        due_date = created_at + timedelta(days=order.due_days or 0)
        days_remaining = (due_date - reference_date).days

        # Determine if order should be shown
        # Show if: within threshold period (before threshold_date)
        should_show = due_date <= threshold_date

        if not should_show:
            continue

        # Determine status
        if days_remaining < 0:
            due_status = "overdue"
        elif days_remaining <= days_threshold:
            due_status = "due_soon"
        else:
            due_status = "pending"

        # Apply status filter if provided
        if status_filter == "overdue" and due_status != "overdue":
            continue
        if status_filter == "due_soon" and due_status != "due_soon":
            continue

        orders_with_status.append({
            "id": str(order.id),
            "tenant_id": str(order.tenant_id),
            "order_number": order.order_number,
            "customer_id": order.customer_id,
            "branch_id": order.branch_id,
            "due_days": order.due_days,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "delivery_date": due_date.isoformat(),
            "days_remaining": days_remaining,
            "due_status": due_status,
            "status": order.status,
            "total_amount": float(order.total_amount) if order.total_amount else 0,
            "order_type": order.order_type,
            "priority": order.priority
        })

    # Separate into overdue and due_soon, then sort by days remaining
    overdue_orders = sorted(
        [o for o in orders_with_status if o["due_status"] == "overdue"],
        key=lambda x: x["days_remaining"]  # Most negative first (most overdue)
    )
    due_soon_orders = sorted(
        [o for o in orders_with_status if o["due_status"] == "due_soon"],
        key=lambda x: x["days_remaining"]
    )

    return {
        "overdue_count": len(overdue_orders),
        "due_soon_count": len(due_soon_orders),
        "total_count": len(orders_with_status),
        "reference_date": reference_date.isoformat(),
        "threshold_date": threshold_date.isoformat(),
        "orders": overdue_orders + due_soon_orders  # Overdue first
    }


@router.post("/mark-created")
async def mark_orders_as_created(
    request: MarkAsCreatedRequest,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(get_current_token_data)
):
    """
    Mark orders as created/dismissed from due days list.
    """
    tenant_id = token_data.tenant_id

    # Update orders
    updated_count = 0
    for order_id in request.order_ids:
        query = select(Order).where(
            and_(
                Order.id == order_id,
                Order.tenant_id == tenant_id
            )
        )
        result = await db.execute(query)
        order = result.scalar_one_or_none()

        if order:
            order.due_days_marked_created = True
            order.updated_by = token_data.user_id
            order.updated_at = datetime.utcnow()
            updated_count += 1

    await db.commit()

    return {
        "message": f"Marked {updated_count} orders as created",
        "count": updated_count
    }


@router.get("/statistics")
async def get_due_days_statistics(
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(get_current_token_data)
):
    """
    Get statistics for due days dashboard.
    """
    tenant_id = token_data.tenant_id
    today = datetime.now(timezone.utc)

    # Get all orders with due_days
    query = select(Order).where(
        and_(
            Order.tenant_id == tenant_id,
            Order.due_days.isnot(None),
            Order.due_days_marked_created == False,
            Order.is_active == True
        )
    )

    result = await db.execute(query)
    all_orders = result.scalars().all()

    # Calculate statistics in Python
    three_days_from_now = today + timedelta(days=3)

    overdue_count = 0
    due_soon_count = 0

    for order in all_orders:
        # Ensure created_at is timezone-aware
        created_at = order.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        due_date = created_at + timedelta(days=order.due_days or 0)
        days_remaining = (due_date - today).days

        if days_remaining < 0:
            overdue_count += 1
        elif days_remaining <= 3:  # Within 3 days
            due_soon_count += 1

    return {
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "total_due_count": overdue_count + due_soon_count
    }


# Internal endpoint for notification service (no auth required)
@router.get("/orders-due-reminder")
async def get_orders_for_reminder_notification(
    days_threshold: int = Query(4, ge=1, le=30, description="Days threshold for reminder notifications"),
    db: AsyncSession = Depends(get_db)
):
    """
    Internal endpoint for notification service to fetch orders for due day reminders.
    Does NOT require authentication - only accessible via internal network.
    Returns orders that are exactly `days_threshold` days away from their due date.
    """
    # Use UTC for timezone-aware calculations
    now = datetime.now(timezone.utc)
    reference_date = now
    threshold_date = now + timedelta(days=days_threshold)

    logger.info(f"=== Internal Due Days Reminder Query ===")
    logger.info(f"Current UTC time: {now.isoformat()}")
    logger.info(f"Looking for orders with days_remaining = {days_threshold}")
    logger.info(f"Threshold date: {threshold_date.isoformat()}")

    # Build base query - get ALL orders (no tenant filter for internal notifications)
    query = select(Order).where(
        and_(
            Order.due_days.isnot(None),
            Order.due_days_marked_created == False,
            Order.is_active == True
        )
    )

    # Fetch all orders and filter in Python
    result = await db.execute(query)
    all_orders = result.scalars().all()

    logger.info(f"Internal due-days query: Found {len(all_orders)} orders with due_days set")

    # Filter orders based on due date calculation
    orders_with_status = []
    for order in all_orders:
        # Ensure created_at is timezone-aware
        created_at = order.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        due_date = created_at + timedelta(days=order.due_days or 0)

        # Calculate days remaining more precisely
        # We want to trigger the reminder when there are between (days_threshold) and (days_threshold+1) days remaining
        # This handles orders created earlier in the day
        time_delta = due_date - reference_date
        days_remaining = time_delta.days
        total_seconds = time_delta.total_seconds()

        # Check if we're within the reminder window
        # For days_threshold=4, we want to trigger when days_remaining is 4.x (still has 4 full days ahead)
        # But we also want to handle the edge case where it was just created today
        # So we check: days_remaining >= days_threshold, or (days_remaining == days_threshold-1 and hours > 20)
        should_remind = (
            days_remaining >= days_threshold or  # Still has full days_threshold days
            (days_remaining == days_threshold - 1 and total_seconds > (days_threshold - 1) * 86400)  # Has more than 20 hours left of the (days_threshold-1) day
        )

        logger.info(f"Order {order.order_number}: created_at={created_at.isoformat()}, due_days={order.due_days}, due_date={due_date.isoformat()}, days_remaining={days_remaining}, total_seconds={total_seconds}, should_remind={should_remind}")

        if should_remind:
            due_status = "overdue" if days_remaining < 0 else "due_soon"

            orders_with_status.append({
                "id": str(order.id),
                "tenant_id": str(order.tenant_id),
                "order_number": order.order_number,
                "customer_id": order.customer_id,
                "branch_id": order.branch_id,
                "due_days": order.due_days,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "delivery_date": due_date.isoformat(),
                "days_remaining": days_remaining,
                "due_status": due_status,
                "status": order.status,
                "total_amount": float(order.total_amount) if order.total_amount else 0,
                "order_type": order.order_type,
                "priority": order.priority
            })

    # Sort by days_remaining
    orders_with_status.sort(key=lambda x: x["days_remaining"])

    return {
        "days_threshold": days_threshold,
        "reference_date": reference_date.isoformat(),
        "orders_count": len(orders_with_status),
        "orders": orders_with_status
    }
