"""
Truck/Vehicle Analytics API Endpoints
Provides truck status counts, utilization metrics, and maintenance impact
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, and_, func, text
import logging

from src.database import get_multi_db, MultiDBSession, Vehicle
from src.models.schemas import (
    DateRangePreset,
    DateRangeFilter,
    TruckStatusCountsResponse,
    TruckStatusCount,
    TruckUtilizationResponse,
    TruckUtilization,
)
from src.api.endpoints.orders import calculate_date_range

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/status-counts")
async def get_truck_status_counts(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get truck counts by status

    Returns the number of trucks in each status.
    Uses current truck status from the company database.
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
            Vehicle.status,
            func.count(Vehicle.id).label('count')
        ).where(
            and_(
                Vehicle.is_active == True,
            )
        ).group_by(Vehicle.status)

        result = await multi_db.company.execute(query)
        rows = result.all()

        total_trucks = sum(row[1] for row in rows) if rows else 0

        # Build status counts with percentage
        status_counts = [
            {
                "status": row[0],
                "count": row[1],
                "percentage": round((row[1] / total_trucks * 100), 1) if total_trucks > 0 else 0.0
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "total_trucks": total_trucks,
            "status_counts": status_counts
        }
    except Exception as e:
        logger.error(f"Error getting truck status counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get truck status counts: {str(e)}")


@router.post("/utilization", response_model=TruckUtilizationResponse)
async def get_truck_utilization(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get truck utilization metrics

    Calculates time spent in each status (on_trip, available, maintenance, out_of_service)
    and computes utilization percentage.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        sql_query = text("""
            WITH vehicle_status_periods AS (
                SELECT
                    entity_id as vehicle_id,
                    to_status as status,
                    created_at as period_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as period_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'vehicles'
                    AND entity_type = 'vehicle'
                    AND to_status IS NOT NULL
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            ),
            status_durations AS (
                SELECT
                    vehicle_id,
                    status,
                    EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 86400.0 as days
                FROM vehicle_status_periods
            )
            SELECT
                vehicle_id,
                COALESCE(SUM(CASE WHEN status = 'on_trip' THEN days ELSE 0 END), 0) as on_trip_days,
                COALESCE(SUM(CASE WHEN status = 'available' THEN days ELSE 0 END), 0) as available_days,
                COALESCE(SUM(CASE WHEN status = 'maintenance' THEN days ELSE 0 END), 0) as maintenance_days,
                COALESCE(SUM(CASE WHEN status = 'out_of_service' THEN days ELSE 0 END), 0) as out_of_service_days,
                COALESCE(SUM(days), 0) as total_days
            FROM status_durations
            WHERE days >= 0
            GROUP BY vehicle_id
            ORDER BY vehicle_id
            LIMIT 50
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        trucks = []
        total_utilization = 0

        for row in rows:
            on_trip = float(row[1])
            available = float(row[2])
            maintenance = float(row[3])
            out_of_service = float(row[4])
            total = float(row[5])

            # Utilization = (on_trip + assigned) / total
            utilized_days = on_trip  # + assigned would be added if tracked
            utilization = (utilized_days / total * 100) if total > 0 else 0
            total_utilization += utilization

            trucks.append(TruckUtilization(
                vehicle_id=row[0],
                on_trip_days=round(on_trip, 2),
                available_days=round(available, 2),
                maintenance_days=round(maintenance, 2),
                out_of_service_days=round(out_of_service, 2),
                total_days=round(total, 2),
                utilization_percentage=round(utilization, 2)
            ))

        avg_utilization = round(total_utilization / len(trucks), 2) if trucks else 0

        return TruckUtilizationResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            trucks=trucks,
            avg_utilization_percentage=avg_utilization
        )
    except Exception as e:
        logger.error(f"Error getting truck utilization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get truck utilization: {str(e)}")


@router.get("/maintenance-impact")
async def get_truck_maintenance_impact(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Correlate truck maintenance with trip performance

    Returns trips affected by vehicle maintenance periods.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        sql_query = text("""
            WITH vehicle_maintenance_periods AS (
                SELECT
                    entity_id as vehicle_id,
                    created_at as maintenance_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as maintenance_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'vehicles'
                    AND entity_type = 'vehicle'
                    AND to_status = 'maintenance'
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            ),
            trips_using_vehicle AS (
                SELECT
                    new_values->>'truck_plate' as vehicle_plate,
                    entity_id as trip_id,
                    created_at as trip_created,
                    MIN(CASE WHEN to_status = 'completed' THEN created_at END) OVER (
                        PARTITION BY entity_id ORDER BY created_at
                    ) as trip_completed
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            )
            SELECT
                v.vehicle_id,
                COUNT(t.trip_id) as affected_trips,
                AVG(EXTRACT(EPOCH FROM (t.trip_completed - t.trip_created)) / 3600.0) as avg_trip_duration_hours
            FROM vehicle_maintenance_periods v
            JOIN trips_using_vehicle t ON v.vehicle_id = t.vehicle_plate
            WHERE t.trip_created >= v.maintenance_start
                AND t.trip_created <= COALESCE(v.maintenance_end, NOW())
            GROUP BY v.vehicle_id
            ORDER BY affected_trips DESC
            LIMIT 20
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        impact_data = [
            {
                "vehicle_id": row[0],
                "affected_trips": row[1],
                "avg_trip_duration_hours": round(float(row[2]), 2) if row[2] else 0
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "affected_vehicles": impact_data,
            "total_vehicles_affected": len(impact_data)
        }
    except Exception as e:
        logger.error(f"Error getting truck maintenance impact: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get truck maintenance impact: {str(e)}")
