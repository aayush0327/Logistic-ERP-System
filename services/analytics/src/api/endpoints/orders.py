"""
Order Analytics API Endpoints
Provides order status counts, durations, lifecycle times, and bottleneck detection
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func, case, text
from datetime import datetime, timedelta
import logging

from src.database import get_multi_db, MultiDBSession, AuditLog, Order
from src.models.schemas import (
    DateRangePreset,
    DateRangeFilter,
    OrderStatusCountsResponse,
    OrderStatusCount,
    OrderStatusDurationsResponse,
    StatusDurationMetrics,
    OrderLifecyclesResponse,
    OrderLifecycle,
    OrderBottlenecksResponse,
    OrderBottleneck,
    OrderStatusTimelineResponse,
    StatusTimelineItem,
    OrderTimelineSummary,
    OrdersListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def calculate_date_range(preset: DateRangePreset, date_from: Optional[datetime], date_to: Optional[datetime]) -> tuple:
    """Calculate actual date_from and date_to based on preset"""
    if preset == DateRangePreset.CUSTOM:
        if not date_from or not date_to:
            raise HTTPException(status_code=400, detail="Custom range requires date_from and date_to")
        return date_from, date_to

    now = datetime.utcnow()
    if preset == DateRangePreset.TODAY:
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day, now
    elif preset == DateRangePreset.LAST_7_DAYS:
        return now - timedelta(days=7), now
    elif preset == DateRangePreset.LAST_30_DAYS:
        return now - timedelta(days=30), now

    return now - timedelta(days=7), now


@router.post("/status-counts")
async def get_order_status_counts(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get order counts by status

    Returns the number of orders in each status for the specified date range.
    Uses current order status from the orders database.
    """
    from datetime import datetime

    # Parse date range from request body
    preset_map = {
        "today": DateRangePreset.TODAY,
        "last_7_days": DateRangePreset.LAST_7_DAYS,
        "last_30_days": DateRangePreset.LAST_30_DAYS,
        "custom": DateRangePreset.CUSTOM,
    }
    preset_str = date_range_request.get("preset", "last_7_days")
    preset = preset_map.get(preset_str, DateRangePreset.LAST_7_DAYS)

    date_from = None
    date_to = None
    if date_range_request.get("start_date"):
        date_from = datetime.fromisoformat(date_range_request["start_date"].replace('Z', '+00:00'))
    if date_range_request.get("end_date"):
        date_to = datetime.fromisoformat(date_range_request["end_date"].replace('Z', '+00:00'))

    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        # Get current status counts from orders database
        query = select(
            Order.status,
            func.count(Order.id).label('count')
        ).where(
            Order.is_active == True
        ).group_by(Order.status)

        result = await multi_db.orders.execute(query)
        rows = result.all()

        total_orders = sum(row[1] for row in rows) if rows else 0

        # Build status counts with percentage
        status_counts = [
            {
                "status": row[0],
                "count": row[1],
                "percentage": round((row[1] / total_orders * 100), 1) if total_orders > 0 else 0.0
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "total_orders": total_orders,
            "status_counts": status_counts
        }
    except Exception as e:
        logger.error(f"Error getting order status counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get order status counts: {str(e)}")


@router.get("/status-durations", response_model=OrderStatusDurationsResponse)
async def get_order_status_durations(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get average time spent in each order status

    Calculates the average, min, max, and median hours orders spend in each status
    based on audit log status transitions.
    """
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        # Complex SQL query to calculate status durations from audit logs
        # Using window functions to find next status change
        sql_query = text("""
            WITH status_durations AS (
                SELECT
                    from_status,
                    EXTRACT(EPOCH FROM (
                        LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) - created_at
                    )) / 3600.0 as hours_spent
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND from_status IS NOT NULL
                    AND from_status != ''
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            )
            SELECT
                from_status as status,
                AVG(hours_spent) as avg_hours,
                MIN(hours_spent) as min_hours,
                MAX(hours_spent) as max_hours,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_spent) as median_hours,
                COUNT(*) as sample_count
            FROM status_durations
            WHERE hours_spent IS NOT NULL AND hours_spent >= 0
            GROUP BY from_status
            ORDER BY avg_hours DESC
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        durations = [
            StatusDurationMetrics(
                status=row[0],
                avg_hours=round(float(row[1]), 2) if row[1] else 0,
                min_hours=round(float(row[2]), 2) if row[2] else 0,
                max_hours=round(float(row[3]), 2) if row[3] else 0,
                median_hours=round(float(row[4]), 2) if row[4] else 0,
                sample_count=row[5]
            )
            for row in rows
        ]

        return OrderStatusDurationsResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            durations=durations
        )
    except Exception as e:
        logger.error(f"Error getting order status durations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get order status durations: {str(e)}")


@router.get("/lifecycle-times", response_model=OrderLifecyclesResponse)
async def get_order_lifecycle_times(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get order lifecycle times from creation to delivery/cancellation

    Calculates the total time each order took from creation (draft) to delivery or cancellation.
    """
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        # Query to get order lifecycle from audit logs
        sql_query = text("""
            SELECT
                entity_id,
                MIN(CASE WHEN to_status = 'draft' THEN created_at END) as created_at,
                MIN(CASE WHEN to_status = 'delivered' THEN created_at END) as delivered_at,
                MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) as cancelled_at,
                CASE
                    WHEN MIN(CASE WHEN to_status = 'delivered' THEN created_at END) IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (
                            MIN(CASE WHEN to_status = 'delivered' THEN created_at END) -
                            MIN(CASE WHEN to_status = 'draft' THEN created_at END)
                        )) / 3600.0
                    WHEN MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (
                            MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) -
                            MIN(CASE WHEN to_status = 'draft' THEN created_at END)
                        )) / 3600.0
                    ELSE NULL
                END as lifecycle_hours
            FROM audit_logs
            WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                AND module = 'orders'
                AND entity_type = 'order'
                AND created_at >= :start_date
                AND created_at <= :end_date
            GROUP BY entity_id
            HAVING MIN(CASE WHEN to_status = 'draft' THEN created_at END) IS NOT NULL
            LIMIT 100
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        orders = [
            OrderLifecycle(
                entity_id=row[0],
                created_at=row[1],
                delivered_at=row[2],
                cancelled_at=row[3],
                lifecycle_hours=round(float(row[4]), 2) if row[4] else None
            )
            for row in rows
        ]

        # Calculate average lifecycle
        completed_lifecycles = [o.lifecycle_hours for o in orders if o.lifecycle_hours is not None]
        avg_lifecycle = round(sum(completed_lifecycles) / len(completed_lifecycles), 2) if completed_lifecycles else 0

        return OrderLifecyclesResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            orders=orders,
            avg_lifecycle_hours=avg_lifecycle
        )
    except Exception as e:
        logger.error(f"Error getting order lifecycle times: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get order lifecycle times: {str(e)}")


@router.post("/bottlenecks")
async def get_order_bottlenecks(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Identify orders stuck in a status (bottlenecks)

    Returns status counts for orders that have been stuck in a status longer than the threshold.
    """
    from datetime import datetime

    # Parse date range from request body
    preset_map = {
        "today": DateRangePreset.TODAY,
        "last_7_days": DateRangePreset.LAST_7_DAYS,
        "last_30_days": DateRangePreset.LAST_30_DAYS,
        "custom": DateRangePreset.CUSTOM,
    }
    preset_str = date_range_request.get("preset", "last_7_days")
    preset = preset_map.get(preset_str, DateRangePreset.LAST_7_DAYS)

    date_from = None
    date_to = None
    if date_range_request.get("start_date"):
        date_from = datetime.fromisoformat(date_range_request["start_date"].replace('Z', '+00:00'))
    if date_range_request.get("end_date"):
        date_to = datetime.fromisoformat(date_range_request["end_date"].replace('Z', '+00:00'))

    # Get threshold from request or use default
    threshold_hours = date_range_request.get("threshold_hours", 4.0)

    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        # Query to find orders stuck in each status
        sql_query = text("""
            WITH latest_status_change AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    to_status as current_status,
                    created_at as status_since
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND to_status NOT IN ('delivered', 'cancelled')
                    AND created_at <= :end_date
                ORDER BY entity_id, created_at DESC
            )
            SELECT
                current_status,
                COUNT(*) as stuck_count,
                AVG(EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0) as avg_hours_stuck,
                MAX(EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0) as max_hours_stuck
            FROM latest_status_change
            WHERE EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0 > :threshold
            GROUP BY current_status
            ORDER BY stuck_count DESC
        """)

        result = await multi_db.company.execute(
            sql_query,
            {"start_date": start_date, "end_date": end_date, "threshold": threshold_hours}
        )
        rows = result.all()

        bottlenecks = [
            {
                "current_status": row[0],
                "stuck_count": row[1],
                "avg_hours_stuck": round(float(row[2]), 2),
                "max_hours_stuck": round(float(row[3]), 2)
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "threshold_hours": threshold_hours,
            "bottlenecks": bottlenecks
        }
    except Exception as e:
        logger.error(f"Error getting order bottlenecks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get order bottlenecks: {str(e)}")


@router.get("/{order_number}/timeline", response_model=OrderStatusTimelineResponse)
async def get_order_status_timeline(
    order_number: str,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get order status timeline showing time spent in each status

    Returns complete status change history with time calculations
    for each status transition using order_number.
    """
    logger.info(f"Order status timeline request - order_number: {order_number}")

    try:
        # First, get the order_id from order_number
        order_query = text("""
            SELECT id, status
            FROM orders
            WHERE order_number = :order_number
            LIMIT 1
        """)
        order_result = await multi_db.orders.execute(order_query, {"order_number": order_number})
        order_row = order_result.first()

        if not order_row:
            raise HTTPException(status_code=404, detail=f"Order with number '{order_number}' not found")

        order_id = order_row[0]
        current_status = order_row[1]
        logger.info(f"Found order_id: {order_id}, current_status: {current_status}")

        # Get timeline from audit_logs, filtering out Enum format entries
        timeline_query = text("""
            WITH ordered_logs AS (
                SELECT
                    to_status,
                    from_status,
                    created_at,
                    user_name,
                    description,
                    LEAD(created_at) OVER (ORDER BY created_at ASC) as next_event_at,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC) as sequence
                FROM audit_logs
                WHERE entity_id = :order_id
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND (from_status IS NOT NULL OR to_status IS NOT NULL)
                    -- Filter out Enum format entries (containing class names like OrderStatus.)
                    AND from_status NOT LIKE '%OrderStatus.%'
                    AND to_status NOT LIKE '%OrderStatus.%'
                ORDER BY created_at ASC
            )
            SELECT
                sequence,
                from_status,
                to_status,
                created_at,
                user_name,
                description,
                -- Only calculate duration if there's a next event, otherwise NULL
                CASE
                    WHEN next_event_at IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (next_event_at - created_at)) / 3600.0
                    ELSE NULL
                END as duration_hours
            FROM ordered_logs
            ORDER BY sequence ASC
        """)

        timeline_result = await multi_db.company.execute(timeline_query, {"order_id": order_id})
        timeline_rows = timeline_result.all()

        if not timeline_rows:
            # No audit logs found, return minimal timeline with current status
            return OrderStatusTimelineResponse(
                order_number=order_number,
                order_id=order_id,
                current_status=current_status,
                total_duration_hours=0.0,
                timeline=[]
            )

        # Build timeline items
        timeline = []
        total_duration = 0.0

        for row in timeline_rows:
            duration = round(float(row[6]), 4) if row[6] is not None else None
            # Only add to total if there's a next event (not the current status)
            if duration is not None and row[5] is not None:  # next_event_at exists
                total_duration += duration

            timeline.append(StatusTimelineItem(
                sequence=int(row[0]),
                from_status=row[1],
                to_status=row[2],
                timestamp=row[3],
                duration_hours=duration,
                user_name=row[4],
                description=row[5]
            ))

        logger.info(f"Retrieved {len(timeline)} timeline events for order {order_number}")

        return OrderStatusTimelineResponse(
            order_number=order_number,
            order_id=order_id,
            current_status=current_status,
            total_duration_hours=round(total_duration, 2),
            timeline=timeline
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting order status timeline: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get order status timeline: {str(e)}")


@router.get("/list", response_model=OrdersListResponse)
async def list_orders_with_timeline(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get paginated list of orders with timeline summary

    Returns all orders with their total duration calculated from audit_logs.
    Orders are sorted by creation date (most recent first).
    """
    try:
        # Calculate offset for pagination
        offset = (page - 1) * per_page

        # Get total count of orders
        count_query = text("""
            SELECT COUNT(*) as total_count
            FROM orders
            WHERE is_active = true
        """)
        count_result = await multi_db.orders.execute(count_query)
        total_count = count_result.scalar() or 0

        # Calculate total pages
        total_pages = (total_count + per_page - 1) // per_page

        # First, get the paginated orders
        orders_query = text("""
            SELECT
                id,
                order_number,
                status,
                created_at,
                updated_at
            FROM orders
            WHERE is_active = true
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        orders_result = await multi_db.orders.execute(
            orders_query,
            {"limit": per_page, "offset": offset}
        )
        order_rows = orders_result.all()

        # Extract order IDs
        order_ids = [str(row[0]) for row in order_rows]

        if not order_ids:
            return OrdersListResponse(
                orders=[],
                total_count=total_count,
                page=page,
                per_page=per_page,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_previous=page > 1
            )

        # Get audit log summaries from company_db for these orders
        audit_query = text("""
            WITH audit_durations AS (
                SELECT
                    entity_id,
                    EXTRACT(EPOCH FROM (LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) - created_at)) / 3600.0 as duration_hours
                FROM audit_logs
                WHERE entity_id = ANY(:order_ids)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND (from_status IS NOT NULL OR to_status IS NOT NULL)
            )
            SELECT
                entity_id,
                COALESCE(SUM(duration_hours), 0) as total_duration_hours,
                COUNT(*) as status_changes_count
            FROM audit_durations
            WHERE duration_hours IS NOT NULL
            GROUP BY entity_id
        """)

        audit_result = await multi_db.company.execute(
            audit_query,
            {"order_ids": order_ids}
        )
        audit_rows = audit_result.all()

        # Create a lookup dict for audit data
        audit_lookup = {row[0]: (row[1], row[2]) for row in audit_rows}

        # Build the final response
        orders = []
        for row in order_rows:
            order_id = str(row[0])
            total_duration, status_count = audit_lookup.get(order_id, (0.0, 0))

            orders.append(OrderTimelineSummary(
                order_number=row[1],
                order_id=order_id,
                current_status=row[2],
                total_duration_hours=round(float(total_duration), 2),
                status_changes_count=int(status_count),
                created_at=row[3],
                updated_at=row[4]
            ))

        return OrdersListResponse(
            orders=orders,
            total_count=total_count,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    except Exception as e:
        logger.error(f"Error getting orders list: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get orders list: {str(e)}")
