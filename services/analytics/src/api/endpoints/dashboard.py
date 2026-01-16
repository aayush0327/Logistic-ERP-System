"""
Dashboard Analytics API Endpoints
Provides executive dashboard summary and entity timeline drill-down
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text, select, func
import logging
from datetime import datetime
from pydantic import BaseModel

from src.database import get_multi_db, MultiDBSession, DriverProfile, Vehicle, Order, Trip
from src.models.schemas import (
    DateRangePreset,
    DateRangeFilter,
)
from src.api.endpoints.orders import calculate_date_range

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Request/Response Schemas matching Frontend
# ============================================================================

class DateRange(BaseModel):
    """Date range request from frontend"""
    preset: str  # "today", "last_7_days", "last_30_days", "custom"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class KPIMetric(BaseModel):
    """KPI metric"""
    value: float
    unit: str
    trend: str  # "up", "down", "neutral"


class DashboardSummaryResponse(BaseModel):
    """Dashboard summary response"""
    total_orders: KPIMetric
    orders_delivered_today: KPIMetric
    avg_fulfillment_time: KPIMetric
    active_trips: KPIMetric
    available_drivers: KPIMetric
    available_trucks: KPIMetric
    driver_utilization_percent: float
    truck_utilization_percent: float
    orders_in_bottleneck: int
    trips_delayed: int


class StatusCount(BaseModel):
    """Status count item"""
    status: str
    count: int
    percentage: float


class OrderStatusCountsResponse(BaseModel):
    """Order status counts response"""
    date_range: DateRange
    total_orders: int
    status_counts: list[StatusCount]


class TripStatusCountsResponse(BaseModel):
    """Trip status counts response"""
    date_range: DateRange
    total_trips: int
    status_counts: list[StatusCount]


class DriverStatusCountsResponse(BaseModel):
    """Driver status counts response"""
    date_range: DateRange
    total_drivers: int
    status_counts: list[StatusCount]


class TruckStatusCountsResponse(BaseModel):
    """Truck status counts response"""
    date_range: DateRange
    total_trucks: int
    status_counts: list[StatusCount]


class BottleneckItem(BaseModel):
    """Bottleneck item"""
    current_status: str
    stuck_count: int
    avg_hours_stuck: float
    max_hours_stuck: float


class OrderBottlenecksResponse(BaseModel):
    """Order bottlenecks response"""
    date_range: DateRange
    threshold_hours: float
    bottlenecks: list[BottleneckItem]


class UtilizationMetrics(BaseModel):
    """Utilization metrics"""
    entity_id: str
    entity_name: Optional[str]
    utilization_percent: float
    total_hours: float
    active_hours: float
    idle_hours: float


class DriverUtilizationResponse(BaseModel):
    """Driver utilization response"""
    date_range: DateRange
    drivers: list[UtilizationMetrics]
    avg_utilization_percent: float


class TruckUtilizationResponse(BaseModel):
    """Truck utilization response"""
    date_range: DateRange
    trucks: list[UtilizationMetrics]
    avg_utilization_percent: float


class TimelineEvent(BaseModel):
    """Timeline event"""
    timestamp: str
    from_status: Optional[str]
    to_status: str
    action: str
    description: Optional[str]
    user_name: Optional[str]
    duration_hours: Optional[float]


class EntityTimelineResponse(BaseModel):
    """Entity timeline response"""
    entity_type: str
    entity_id: str
    current_status: str
    created_at: str
    timeline: list[TimelineEvent]
    total_duration_hours: float


# ============================================================================
# Dashboard Summary Endpoint
# ============================================================================

@router.post("/summary")
async def get_dashboard_summary(
    date_range: DateRange,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get executive dashboard summary

    Returns high-level KPIs and summary metrics for orders, trips, drivers, and trucks.
    Uses actual database tables for current counts (not audit_logs).
    """
    logger.info(f"Dashboard summary request - preset: {date_range.preset}, start_date: {date_range.start_date}, end_date: {date_range.end_date}")

    # Map preset string to enum
    preset_map = {
        "today": DateRangePreset.TODAY,
        "last_7_days": DateRangePreset.LAST_7_DAYS,
        "last_30_days": DateRangePreset.LAST_30_DAYS,
        "custom": DateRangePreset.CUSTOM,
    }
    preset = preset_map.get(date_range.preset, DateRangePreset.LAST_7_DAYS)

    # Parse dates if provided
    date_from = None
    date_to = None
    if date_range.start_date:
        date_from = datetime.fromisoformat(date_range.start_date.replace('Z', '+00:00'))
    if date_range.end_date:
        date_to = datetime.fromisoformat(date_range.end_date.replace('Z', '+00:00'))

    start_date, end_date = calculate_date_range(preset, date_from, date_to)
    logger.info(f"Calculated date range - start: {start_date}, end: {end_date}")

    try:
        # ====================================================================
        # Get Order KPIs from orders table (orders_db)
        # ====================================================================
        logger.info("Fetching order stats from orders table...")

        # Total orders count - use raw SQL
        total_orders_query = text("""
            SELECT COUNT(*) as count
            FROM orders
            WHERE is_active = true
        """)
        total_orders_result = await multi_db.orders.execute(total_orders_query)
        total_orders = total_orders_result.scalar() or 0
        logger.info(f"Total orders: {total_orders}")

        # Orders delivered today - use audit_logs for date-based stats
        delivered_today_query = text("""
            SELECT COUNT(DISTINCT entity_id) as count
            FROM audit_logs
            WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                AND module = 'orders'
                AND entity_type = 'order'
                AND to_status = 'delivered'
                AND DATE(created_at) = CURRENT_DATE
        """)
        delivered_today_result = await multi_db.company.execute(delivered_today_query)
        delivered_today = delivered_today_result.scalar() or 0
        logger.info(f"Delivered today: {delivered_today}")

        # Average fulfillment time - use audit_logs
        avg_fulfillment_query = text("""
            WITH order_lifecycles AS (
                SELECT
                    entity_id,
                    MIN(CASE WHEN to_status = 'draft' THEN created_at END) as created_at,
                    MIN(CASE WHEN to_status = 'delivered' THEN created_at END) as delivered_at
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND created_at >= :start_date
                    AND created_at <= :end_date
                GROUP BY entity_id
            )
            SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 3600.0) as avg_hours
            FROM order_lifecycles
            WHERE created_at IS NOT NULL AND delivered_at IS NOT NULL
        """)
        avg_fulfillment_result = await multi_db.company.execute(avg_fulfillment_query, {"start_date": start_date, "end_date": end_date})
        avg_fulfillment = round(float(avg_fulfillment_result.scalar() or 0), 1)
        logger.info(f"Avg fulfillment: {avg_fulfillment} hours")

        # ====================================================================
        # Get Trip KPIs from trips table (tms_db)
        # ====================================================================
        logger.info("Fetching trip stats from trips table...")

        # Active trips = 'loading', 'on-route', 'paused' - use raw SQL
        active_trips_query = text("""
            SELECT COUNT(*) as count
            FROM trips
            WHERE status IN ('loading', 'on-route', 'paused')
        """)
        active_trips_result = await multi_db.tms.execute(active_trips_query)
        active_trips = active_trips_result.scalar() or 0
        logger.info(f"Active trips: {active_trips}")

        # Trips delayed - use audit_logs to find stuck trips
        trips_delayed_query = text("""
            WITH latest_status AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    to_status,
                    created_at as status_since
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND to_status NOT IN ('completed', 'cancelled')
                ORDER BY entity_id, created_at DESC
            )
            SELECT COUNT(*) as delayed_count
            FROM latest_status
            WHERE EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0 > 24
        """)
        trips_delayed_result = await multi_db.company.execute(trips_delayed_query)
        trips_delayed = trips_delayed_result.scalar() or 0
        logger.info(f"Trips delayed: {trips_delayed}")

        # ====================================================================
        # Get Driver KPIs from driver_profiles table (company_db)
        # ====================================================================
        logger.info("Fetching driver stats from driver_profiles table...")

        # Available drivers - use raw SQL
        available_drivers_query = text("""
            SELECT COUNT(*) as count
            FROM driver_profiles
            WHERE current_status = 'available' AND is_active = true
        """)
        available_drivers_result = await multi_db.company.execute(available_drivers_query)
        available_drivers = available_drivers_result.scalar() or 0
        logger.info(f"Available drivers: {available_drivers}")

        # Total active drivers - use raw SQL
        total_drivers_query = text("""
            SELECT COUNT(*) as count
            FROM driver_profiles
            WHERE is_active = true
        """)
        total_drivers_result = await multi_db.company.execute(total_drivers_query)
        total_drivers = total_drivers_result.scalar() or 0
        logger.info(f"Total drivers: {total_drivers}")

        # Driver utilization - use audit_logs for time-based calculation
        driver_util_query = text("""
            WITH driver_periods AS (
                SELECT
                    entity_id,
                    to_status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'drivers'
                    AND entity_type = 'driver'
                    AND to_status IN ('available', 'on_trip', 'off_duty')
                    AND created_at >= :start_date
            ),
            period_durations AS (
                SELECT
                    to_status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 as hours
                FROM driver_periods
                WHERE EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 >= 0
            )
            SELECT
                SUM(CASE WHEN to_status = 'on_trip' THEN hours ELSE 0 END) * 100.0 / NULLIF(SUM(hours), 0) as util_percent
            FROM period_durations
        """)
        util_result = await multi_db.company.execute(driver_util_query, {"start_date": start_date})
        driver_util = round(float(util_result.scalar() or 0), 1)
        logger.info(f"Driver utilization: {driver_util}%")

        # ====================================================================
        # Get Truck KPIs from vehicles table (company_db)
        # ====================================================================
        logger.info("Fetching truck stats from vehicles table...")

        # Available trucks - use raw SQL to avoid enum type issues
        available_trucks_query = text("""
            SELECT COUNT(*) as count
            FROM vehicles
            WHERE status = 'available' AND is_active = true
        """)
        available_trucks_result = await multi_db.company.execute(available_trucks_query)
        available_trucks = available_trucks_result.scalar() or 0
        logger.info(f"Available trucks: {available_trucks}")

        # Total active trucks - use raw SQL to avoid enum type issues
        total_trucks_query = text("""
            SELECT COUNT(*) as count
            FROM vehicles
            WHERE is_active = true
        """)
        total_trucks_result = await multi_db.company.execute(total_trucks_query)
        total_trucks = total_trucks_result.scalar() or 0
        logger.info(f"Total trucks: {total_trucks}")

        # Truck utilization - use audit_logs for time-based calculation
        truck_util_query = text("""
            WITH vehicle_periods AS (
                SELECT
                    entity_id,
                    to_status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'vehicles'
                    AND entity_type = 'vehicle'
                    AND to_status IN ('available', 'on_trip', 'maintenance', 'out_of_service')
                    AND created_at >= :start_date
            ),
            period_durations AS (
                SELECT
                    to_status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 as hours
                FROM vehicle_periods
                WHERE EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 >= 0
            )
            SELECT
                SUM(CASE WHEN to_status = 'on_trip' THEN hours ELSE 0 END) * 100.0 / NULLIF(SUM(hours), 0) as util_percent
            FROM period_durations
        """)
        truck_util_result = await multi_db.company.execute(truck_util_query, {"start_date": start_date})
        truck_util = round(float(truck_util_result.scalar() or 0), 1)
        logger.info(f"Truck utilization: {truck_util}%")

        # ====================================================================
        # Get bottleneck counts from audit_logs (for time-based analysis)
        # ====================================================================
        logger.info("Fetching bottleneck stats...")
        bottleneck_query = text("""
            WITH latest_status AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    to_status,
                    created_at as status_since
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND to_status NOT IN ('delivered', 'cancelled')
                ORDER BY entity_id, created_at DESC
            )
            SELECT COUNT(*) as bottleneck_count
            FROM latest_status
            WHERE EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0 > 4
        """)
        bottleneck_result = await multi_db.company.execute(bottleneck_query)
        bottlenecks = bottleneck_result.scalar() or 0
        logger.info(f"Bottlenecks: {bottlenecks}")

        logger.info(f"Summary - orders: {total_orders}, delivered: {delivered_today}, avg_fulfillment: {avg_fulfillment}h, active_trips: {active_trips}, available_drivers: {available_drivers}, available_trucks: {available_trucks}")

        return {
            "total_orders": {"value": total_orders, "unit": "orders", "trend": "neutral"},
            "orders_delivered_today": {"value": delivered_today, "unit": "delivered", "trend": "up"},
            "avg_fulfillment_time": {"value": avg_fulfillment, "unit": "hours", "trend": "down"},
            "active_trips": {"value": active_trips, "unit": "trips", "trend": "neutral"},
            "available_drivers": {"value": available_drivers, "unit": "drivers", "trend": "neutral"},
            "available_trucks": {"value": available_trucks, "unit": "trucks", "trend": "up"},
            "driver_utilization_percent": driver_util,
            "truck_utilization_percent": truck_util,
            "orders_in_bottleneck": bottlenecks,
            "trips_delayed": trips_delayed
        }
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard summary: {str(e)}")


@router.post("/orders/status-counts", response_model=OrderStatusCountsResponse)
async def get_order_status_counts(
    date_range: DateRange,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get order status counts from orders table
    Uses actual orders table for current status (not audit_logs)
    """
    logger.info(f"Order status counts request - preset: {date_range.preset}")

    try:
        # Query orders table directly for current status counts - use raw SQL
        query = text("""
            SELECT status, COUNT(*) as count
            FROM orders
            WHERE is_active = true
            GROUP BY status
            ORDER BY count DESC
        """)

        result = await multi_db.orders.execute(query)
        rows = result.all()

        total = sum(row[1] for row in rows) if rows else 0
        logger.info(f"Total orders: {total}, status breakdown: {rows}")

        status_counts = [
            StatusCount(
                status=row[0],
                count=row[1],
                percentage=round((row[1] / total * 100), 1) if total > 0 else 0
            )
            for row in rows
        ]

        return OrderStatusCountsResponse(
            date_range=date_range,
            total_orders=total,
            status_counts=status_counts
        )
    except Exception as e:
        logger.error(f"Error getting order status counts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get order status counts: {str(e)}")


@router.post("/trips/status-counts", response_model=TripStatusCountsResponse)
async def get_trip_status_counts(
    date_range: DateRange,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get trip status counts from trips table
    Uses actual trips table for current status (not audit_logs)
    """
    logger.info(f"Trip status counts request - preset: {date_range.preset}")

    try:
        # Query trips table directly for current status counts - use raw SQL
        query = text("""
            SELECT status, COUNT(*) as count
            FROM trips
            GROUP BY status
            ORDER BY count DESC
        """)

        result = await multi_db.tms.execute(query)
        rows = result.all()

        total = sum(row[1] for row in rows) if rows else 0
        logger.info(f"Total trips: {total}, status breakdown: {rows}")

        status_counts = [
            StatusCount(
                status=row[0],
                count=row[1],
                percentage=round((row[1] / total * 100), 1) if total > 0 else 0
            )
            for row in rows
        ]

        return TripStatusCountsResponse(
            date_range=date_range,
            total_trips=total,
            status_counts=status_counts
        )
    except Exception as e:
        logger.error(f"Error getting trip status counts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trip status counts: {str(e)}")


@router.post("/orders/bottlenecks", response_model=OrderBottlenecksResponse)
async def get_order_bottlenecks(
    date_range: DateRange,
    threshold_hours: float = Query(4.0, description="Hours threshold for bottleneck"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """Get order bottlenecks"""
    try:
        query = text("""
            WITH latest_status AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    to_status as current_status,
                    created_at as status_since
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'orders'
                    AND entity_type = 'order'
                    AND to_status NOT IN ('delivered', 'cancelled')
                ORDER BY entity_id, created_at DESC
            )
            SELECT
                current_status,
                COUNT(*) as stuck_count,
                AVG(EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0) as avg_hours_stuck,
                MAX(EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0) as max_hours_stuck
            FROM latest_status
            WHERE EXTRACT(EPOCH FROM (NOW() - status_since)) / 3600.0 > :threshold
            GROUP BY current_status
            ORDER BY stuck_count DESC
        """)

        result = await multi_db.company.execute(query, {"threshold": threshold_hours})
        rows = result.all()

        bottlenecks = [
            BottleneckItem(
                current_status=row[0],
                stuck_count=row[1],
                avg_hours_stuck=round(float(row[2]), 2),
                max_hours_stuck=round(float(row[3]), 2)
            )
            for row in rows
        ]

        return OrderBottlenecksResponse(
            date_range=date_range,
            threshold_hours=threshold_hours,
            bottlenecks=bottlenecks
        )
    except Exception as e:
        logger.error(f"Error getting order bottlenecks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get order bottlenecks: {str(e)}")


@router.post("/drivers/utilization", response_model=DriverUtilizationResponse)
async def get_driver_utilization(
    date_range: DateRange,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """Get driver utilization metrics"""
    try:
        query = text("""
            WITH driver_periods AS (
                SELECT
                    entity_id,
                    to_status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'drivers'
                    AND entity_type = 'driver'
                    AND to_status IN ('available', 'on_trip', 'off_duty')
            ),
            period_durations AS (
                SELECT
                    entity_id,
                    to_status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 as hours
                FROM driver_periods
                WHERE EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 >= 0
            ),
            util_calcs AS (
                SELECT
                    entity_id,
                    SUM(CASE WHEN to_status = 'on_trip' THEN hours ELSE 0 END) as on_trip_hours,
                    SUM(CASE WHEN to_status = 'available' THEN hours ELSE 0 END) as available_hours,
                    SUM(CASE WHEN to_status = 'off_duty' THEN hours ELSE 0 END) as unavailable_hours,
                    SUM(hours) as total_hours,
                    CASE
                        WHEN SUM(hours) > 0 THEN
                            (SUM(CASE WHEN to_status = 'on_trip' THEN hours ELSE 0 END) / SUM(hours)) * 100
                        ELSE 0
                    END as util_percent
                FROM period_durations
                GROUP BY entity_id
            )
            SELECT
                entity_id,
                on_trip_hours,
                available_hours,
                unavailable_hours,
                total_hours,
                util_percent,
                (SELECT AVG(util_percent) FROM util_calcs) as avg_util
            FROM util_calcs
            ORDER BY util_percent DESC
            LIMIT 20
        """)

        result = await multi_db.company.execute(query)
        rows = result.all()

        drivers = []
        avg_util = 0.0

        for row in rows:
            if len(row) >= 7:
                drivers.append(UtilizationMetrics(
                    entity_id=str(row[0]),
                    entity_name=None,
                    utilization_percent=round(float(row[5]), 1),
                    total_hours=round(float(row[4]), 1),
                    active_hours=round(float(row[1]), 1),
                    idle_hours=round(float(row[2]), 1)
                ))
                avg_util = float(row[6]) if row[6] is not None else 0.0

        return DriverUtilizationResponse(
            date_range=date_range,
            drivers=drivers,
            avg_utilization_percent=round(avg_util, 1) if avg_util else 0
        )
    except Exception as e:
        logger.error(f"Error getting driver utilization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get driver utilization: {str(e)}")


@router.post("/trucks/utilization", response_model=TruckUtilizationResponse)
async def get_truck_utilization(
    date_range: DateRange,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """Get truck utilization metrics"""
    try:
        query = text("""
            WITH vehicle_periods AS (
                SELECT
                    entity_id,
                    to_status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'vehicles'
                    AND entity_type = 'vehicle'
                    AND to_status IN ('available', 'on_trip', 'maintenance', 'out_of_service')
            ),
            period_durations AS (
                SELECT
                    entity_id,
                    to_status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 24.0 as days
                FROM vehicle_periods
                WHERE EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 24.0 >= 0
            ),
            util_calcs AS (
                SELECT
                    entity_id,
                    SUM(CASE WHEN to_status = 'on_trip' THEN days ELSE 0 END) as on_trip_days,
                    SUM(CASE WHEN to_status = 'available' THEN days ELSE 0 END) as available_days,
                    SUM(CASE WHEN to_status = 'maintenance' THEN days ELSE 0 END) as maintenance_days,
                    SUM(CASE WHEN to_status = 'out_of_service' THEN days ELSE 0 END) as out_of_service_days,
                    SUM(days) as total_days,
                    CASE
                        WHEN SUM(days) > 0 THEN
                            (SUM(CASE WHEN to_status IN ('on_trip', 'assigned') THEN days ELSE 0 END) / SUM(days)) * 100
                        ELSE 0
                    END as util_percent
                FROM period_durations
                GROUP BY entity_id
            )
            SELECT
                entity_id,
                on_trip_days,
                available_days,
                maintenance_days,
                out_of_service_days,
                total_days,
                util_percent,
                (SELECT AVG(util_percent) FROM util_calcs) as avg_util
            FROM util_calcs
            ORDER BY util_percent DESC
            LIMIT 20
        """)

        result = await multi_db.company.execute(query)
        rows = result.all()

        trucks = []
        avg_util = 0.0

        for row in rows:
            if len(row) >= 7:
                trucks.append(UtilizationMetrics(
                    entity_id=str(row[0]),
                    entity_name=None,
                    utilization_percent=round(float(row[5]), 1),
                    total_hours=round(float(row[4]), 1),
                    active_hours=round(float(row[1]), 1),
                    idle_hours=round(float(row[2]), 1)
                ))
                avg_util = float(row[6]) if row[6] is not None else 0.0

        return TruckUtilizationResponse(
            date_range=date_range,
            trucks=trucks,
            avg_utilization_percent=round(avg_util, 1) if avg_util else 0
        )
    except Exception as e:
        logger.error(f"Error getting truck utilization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get truck utilization: {str(e)}")


@router.get("/timeline/{entity_type}/{entity_id}", response_model=EntityTimelineResponse)
async def get_entity_timeline(
    entity_type: str,
    entity_id: str,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get entity timeline for drill-down view

    Returns complete status change timeline for a specific order, trip, driver, or truck.
    """
    # Validate entity type
    valid_entity_types = ['order', 'trip', 'driver', 'truck']
    if entity_type not in valid_entity_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type. Must be one of: {', '.join(valid_entity_types)}"
        )

    # Map entity type to module
    module_map = {
        'order': 'orders',
        'trip': 'trips',
        'driver': 'drivers',
        'truck': 'vehicles'
    }
    module = module_map[entity_type]

    try:
        # Get entity timeline from audit logs
        sql_query = text("""
            SELECT
                to_status,
                from_status,
                action,
                description,
                created_at,
                user_name,
                LEAD(created_at) OVER (ORDER BY created_at) as next_event_at
            FROM audit_logs
            WHERE entity_id = :entity_id
                AND module = :module
                AND entity_type = :entity_type
            ORDER BY created_at ASC
        """)

        result = await multi_db.company.execute(
            sql_query,
            {"entity_id": entity_id, "module": module, "entity_type": entity_type}
        )
        rows = result.all()

        if not rows:
            raise HTTPException(status_code=404, detail=f"No timeline found for {entity_type} {entity_id}")

        timeline = []
        total_duration = 0
        created_at = None

        for i, row in enumerate(rows):
            duration_hours = None
            if row[6]:  # next_event_at exists
                duration_hours = round(
                    (row[6] - row[4]).total_seconds() / 3600.0,
                    2
                )
                if duration_hours >= 0:
                    total_duration += duration_hours

            if i == 0:
                created_at = row[4]

            timeline.append(TimelineEvent(
                timestamp=row[4].isoformat(),
                from_status=row[1],
                to_status=row[0],
                action=row[2] or "status_change",
                description=row[3],
                user_name=row[5],
                duration_hours=duration_hours
            ))

        # Get current status from the last event
        current_status = timeline[-1].to_status if timeline else None

        return EntityTimelineResponse(
            entity_type=entity_type,
            entity_id=entity_id,
            current_status=current_status or "",
            created_at=created_at.isoformat() if created_at else "",
            timeline=timeline,
            total_duration_hours=round(total_duration, 2)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting entity timeline: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get entity timeline: {str(e)}")
