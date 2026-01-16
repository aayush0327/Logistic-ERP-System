"""
Driver Analytics API Endpoints
Provides driver status counts, utilization metrics, and availability impact
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, and_, func, text
import logging

from src.database import get_multi_db, MultiDBSession, DriverProfile
from src.models.schemas import (
    DateRangePreset,
    DateRangeFilter,
    DriverStatusCountsResponse,
    DriverStatusCount,
    DriverUtilizationResponse,
    DriverUtilization,
)
from src.api.endpoints.orders import calculate_date_range

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/status-counts")
async def get_driver_status_counts(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get driver counts by status

    Returns the number of drivers in each status.
    Uses current driver status from the company database.
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
        # Get current status counts from company database
        query = select(
            DriverProfile.current_status,
            func.count(DriverProfile.id).label('count')
        ).where(
            and_(
                DriverProfile.is_active == True,
            )
        ).group_by(DriverProfile.current_status)

        result = await multi_db.company.execute(query)
        rows = result.all()

        total_drivers = sum(row[1] for row in rows) if rows else 0

        # Build status counts with percentage
        status_counts = [
            {
                "status": row[0],
                "count": row[1],
                "percentage": round((row[1] / total_drivers * 100), 1) if total_drivers > 0 else 0.0
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "total_drivers": total_drivers,
            "status_counts": status_counts
        }
    except Exception as e:
        logger.error(f"Error getting driver status counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get driver status counts: {str(e)}")


@router.post("/utilization", response_model=DriverUtilizationResponse)
async def get_driver_utilization(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get driver utilization metrics

    Calculates time spent in each status (on_trip, available, unavailable)
    and computes utilization percentage.
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
        sql_query = text("""
            WITH driver_status_periods AS (
                SELECT
                    entity_id as driver_id,
                    to_status as status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'drivers'
                    AND entity_type = 'driver'
                    AND to_status IS NOT NULL
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            ),
            status_durations AS (
                SELECT
                    driver_id,
                    status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600.0 as hours
                FROM driver_status_periods
            )
            SELECT
                driver_id,
                COALESCE(SUM(CASE WHEN status = 'on_trip' THEN hours ELSE 0 END), 0) as on_trip_hours,
                COALESCE(SUM(CASE WHEN status = 'available' THEN hours ELSE 0 END), 0) as available_hours,
                COALESCE(SUM(CASE WHEN status IN ('off_duty', 'on_leave', 'suspended') THEN hours ELSE 0 END), 0) as unavailable_hours,
                COALESCE(SUM(hours), 0) as total_hours
            FROM status_durations
            WHERE hours >= 0
            GROUP BY driver_id
            ORDER BY driver_id
            LIMIT 50
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        drivers = []
        total_utilization = 0

        for row in rows:
            on_trip = float(row[1])
            available = float(row[2])
            unavailable = float(row[3])
            total = float(row[4])

            utilization = (on_trip / total * 100) if total > 0 else 0
            total_utilization += utilization

            drivers.append(DriverUtilization(
                driver_id=row[0],
                on_trip_hours=round(on_trip, 2),
                available_hours=round(available, 2),
                unavailable_hours=round(unavailable, 2),
                total_hours=round(total, 2),
                utilization_percentage=round(utilization, 2)
            ))

        avg_utilization = round(total_utilization / len(drivers), 2) if drivers else 0

        return DriverUtilizationResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            drivers=drivers,
            avg_utilization_percentage=avg_utilization
        )
    except Exception as e:
        logger.error(f"Error getting driver utilization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get driver utilization: {str(e)}")


@router.get("/availability-impact")
async def get_driver_availability_impact(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    delay_threshold_hours: float = Query(2.0, description="Delay threshold in hours"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Correlate driver availability with trip delays

    Returns trips that were delayed due to driver availability issues.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        sql_query = text("""
            WITH trips_waiting AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id as trip_id,
                    created_at as waiting_since
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND to_status = 'planning'
                    AND created_at >= :start_date
                    AND created_at <= :end_date
                ORDER BY entity_id, created_at DESC
            ),
            trips_assigned AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id as trip_id,
                    created_at as assigned_at
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND action = 'assign_driver'
                ORDER BY entity_id, created_at DESC
            )
            SELECT
                t.trip_id,
                t.waiting_since,
                a.assigned_at,
                EXTRACT(EPOCH FROM (a.assigned_at - t.waiting_since)) / 3600.0 as wait_hours
            FROM trips_waiting t
            JOIN trips_assigned a ON t.trip_id = a.trip_id
            WHERE EXTRACT(EPOCH FROM (a.assigned_at - t.waiting_since)) / 3600.0 > :threshold
            ORDER BY wait_hours DESC
            LIMIT 50
        """)

        result = await multi_db.company.execute(
            sql_query,
            {"start_date": start_date, "end_date": end_date, "threshold": delay_threshold_hours}
        )
        rows = result.all()

        impact_data = [
            {
                "trip_id": row[0],
                "waiting_since": row[1],
                "assigned_at": row[2],
                "wait_hours": round(float(row[3]), 2)
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "delay_threshold_hours": delay_threshold_hours,
            "delayed_trips": impact_data,
            "total_delayed": len(impact_data)
        }
    except Exception as e:
        logger.error(f"Error getting driver availability impact: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get driver availability impact: {str(e)}")
