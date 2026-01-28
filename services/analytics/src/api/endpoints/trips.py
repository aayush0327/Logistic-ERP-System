"""
Trip Analytics API Endpoints
Provides trip status counts, durations, pause tracking, and inefficiency detection
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
import logging

from src.database import get_multi_db, MultiDBSession
from src.models.schemas import (
    DateRangePreset,
    DateRangeFilter,
    TripStatusCountsResponse,
    TripStatusCount,
    TripStatusDurationsResponse,
    TripStatusDuration,
    TripPausesResponse,
    PauseSummary,
    TripInefficienciesResponse,
    TripInefficiency,
    TripStatusTimelineResponse,
    StatusTimelineItem,
    TripTimelineSummary,
    TripsListResponse,
)
from src.api.endpoints.orders import calculate_date_range

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/status-counts")
async def get_trip_status_counts(
    date_range_request: dict,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get trip counts by status

    Returns the number of trips in each status for the specified date range.
    Uses current trip status from the TMS database.
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
        # Get current status counts from TMS database
        sql_query = text("""
            SELECT status, COUNT(*) as count
            FROM trips
            WHERE created_at >= :start_date AND created_at <= :end_date
            GROUP BY status
            ORDER BY count DESC
        """)

        result = await multi_db.tms.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        total_trips = sum(row[1] for row in rows) if rows else 0

        # Build status counts with percentage
        status_counts = [
            {
                "status": row[0],
                "count": row[1],
                "percentage": round((row[1] / total_trips * 100), 1) if total_trips > 0 else 0.0
            }
            for row in rows
        ]

        return {
            "date_range": DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to).model_dump(),
            "total_trips": total_trips,
            "status_counts": status_counts
        }
    except Exception as e:
        logger.error(f"Error getting trip status counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get trip status counts: {str(e)}")


@router.get("/status-durations", response_model=TripStatusDurationsResponse)
async def get_trip_status_durations(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get time spent by trips in each status

    Returns detailed breakdown of time each trip spent in different statuses.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        sql_query = text("""
            WITH trip_status_changes AS (
                SELECT
                    entity_id as trip_id,
                    from_status as status,
                    created_at as status_start,
                    LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) as status_end
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND from_status IS NOT NULL
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            )
            SELECT
                trip_id,
                status,
                EXTRACT(EPOCH FROM (COALESCE(status_end, NOW()) - status_start)) / 3600.0 as hours_in_status
            FROM trip_status_changes
            ORDER BY trip_id, status_start
            LIMIT 500
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        durations = [
            TripStatusDuration(
                trip_id=row[0],
                status=row[1],
                hours_in_status=round(float(row[2]), 2)
            )
            for row in rows
        ]

        return TripStatusDurationsResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            durations=durations
        )
    except Exception as e:
        logger.error(f"Error getting trip status durations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get trip status durations: {str(e)}")


@router.get("/pauses", response_model=TripPausesResponse)
async def get_trip_pauses(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Calculate total pause time for trips

    Handles multiple pause events and accumulates total pause duration.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        sql_query = text("""
            WITH pause_events AS (
                SELECT
                    entity_id as trip_id,
                    created_at as paused_at,
                    LEAD(created_at) OVER (
                        PARTITION BY entity_id
                        ORDER BY created_at
                    ) as resumed_at
                FROM audit_logs
                WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND to_status = 'paused'
                    AND created_at >= :start_date
                    AND created_at <= :end_date
            ),
            pause_durations AS (
                SELECT
                    trip_id,
                    EXTRACT(EPOCH FROM (COALESCE(resumed_at, NOW()) - paused_at)) / 3600.0 as pause_hours
                FROM pause_events
            )
            SELECT
                trip_id,
                COUNT(*) as pause_count,
                SUM(pause_hours) as total_pause_hours,
                AVG(pause_hours) as avg_pause_hours,
                MAX(pause_hours) as max_pause_hours
            FROM pause_durations
            GROUP BY trip_id
            ORDER BY total_pause_hours DESC
        """)

        result = await multi_db.company.execute(sql_query, {"start_date": start_date, "end_date": end_date})
        rows = result.all()

        pause_summaries = [
            PauseSummary(
                trip_id=row[0],
                pause_count=row[1],
                total_pause_hours=round(float(row[2]), 2),
                avg_pause_hours=round(float(row[3]), 2),
                max_pause_hours=round(float(row[4]), 2)
            )
            for row in rows
        ]

        return TripPausesResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            pause_summaries=pause_summaries
        )
    except Exception as e:
        logger.error(f"Error getting trip pauses: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get trip pauses: {str(e)}")


@router.get("/inefficiencies", response_model=TripInefficienciesResponse)
async def get_trip_inefficiencies(
    preset: DateRangePreset = Query(DateRangePreset.LAST_7_DAYS, description="Date range preset"),
    date_from: Optional[datetime] = Query(None, description="Custom date from"),
    date_to: Optional[datetime] = Query(None, description="Custom date to"),
    expected_planning_hours: float = Query(2.0, description="Expected planning duration threshold"),
    expected_loading_hours: float = Query(1.0, description="Expected loading duration threshold"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Identify trip inefficiencies (planning delay, loading delay, route delay)

    Returns trips that exceeded expected time thresholds for different stages.
    """
    from datetime import datetime
    start_date, end_date = calculate_date_range(preset, date_from, date_to)

    try:
        # Planning delay query
        planning_query = text("""
            SELECT
                entity_id as trip_id,
                'planning' as delay_type,
                :expected_planning as expected_hours,
                EXTRACT(EPOCH FROM (
                    MIN(CASE WHEN to_status = 'loading' THEN created_at END) -
                    MIN(CASE WHEN to_status = 'planning' THEN created_at END)
                )) / 3600.0 as actual_hours
            FROM audit_logs
            WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                AND module = 'trips'
                AND entity_type = 'trip'
                AND created_at >= :start_date
                AND created_at <= :end_date
            GROUP BY entity_id
            HAVING MIN(CASE WHEN to_status = 'loading' THEN created_at END) IS NOT NULL
                AND EXTRACT(EPOCH FROM (
                    MIN(CASE WHEN to_status = 'loading' THEN created_at END) -
                    MIN(CASE WHEN to_status = 'planning' THEN created_at END)
                )) / 3600.0 > :expected_planning
        """)

        # Loading delay query
        loading_query = text("""
            SELECT
                entity_id as trip_id,
                'loading' as delay_type,
                :expected_loading as expected_hours,
                EXTRACT(EPOCH FROM (
                    MIN(CASE WHEN to_status = 'on-route' THEN created_at END) -
                    MIN(CASE WHEN to_status = 'loading' THEN created_at END)
                )) / 3600.0 as actual_hours
            FROM audit_logs
            WHERE tenant_id IN (SELECT DISTINCT tenant_id FROM audit_logs LIMIT 1)
                AND module = 'trips'
                AND entity_type = 'trip'
                AND created_at >= :start_date
                AND created_at <= :end_date
            GROUP BY entity_id
            HAVING MIN(CASE WHEN to_status = 'on-route' THEN created_at END) IS NOT NULL
                AND EXTRACT(EPOCH FROM (
                    MIN(CASE WHEN to_status = 'on-route' THEN created_at END) -
                    MIN(CASE WHEN to_status = 'loading' THEN created_at END)
                )) / 3600.0 > :expected_loading
        """)

        planning_result = await multi_db.company.execute(
            planning_query,
            {"start_date": start_date, "end_date": end_date, "expected_planning": expected_planning_hours}
        )
        planning_rows = planning_result.all()

        loading_result = await multi_db.company.execute(
            loading_query,
            {"start_date": start_date, "end_date": end_date, "expected_loading": expected_loading_hours}
        )
        loading_rows = loading_result.all()

        inefficiencies = []

        for row in planning_rows:
            inefficiencies.append(TripInefficiency(
                trip_id=row[0],
                delay_type=row[1],
                expected_hours=expected_planning_hours,
                actual_hours=round(float(row[3]), 2),
                delay_hours=round(float(row[3]) - expected_planning_hours, 2)
            ))

        for row in loading_rows:
            inefficiencies.append(TripInefficiency(
                trip_id=row[0],
                delay_type=row[1],
                expected_hours=expected_loading_hours,
                actual_hours=round(float(row[3]), 2),
                delay_hours=round(float(row[3]) - expected_loading_hours, 2)
            ))

        return TripInefficienciesResponse(
            date_range=DateRangeFilter(preset=preset, date_from=date_from, date_to=date_to),
            inefficiencies=inefficiencies
        )
    except Exception as e:
        logger.error(f"Error getting trip inefficiencies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get trip inefficiencies: {str(e)}")


@router.get("/{trip_id}/timeline", response_model=TripStatusTimelineResponse)
async def get_trip_status_timeline(
    trip_id: str,
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get trip status timeline showing time spent in each status

    Returns complete status change history with time calculations
    for each status transition.
    """
    logger.info(f"Trip status timeline request - trip_id: {trip_id}")

    try:
        # First, get the current status from trips table
        trip_query = text("""
            SELECT id, status
            FROM trips
            WHERE id = :trip_id
            LIMIT 1
        """)
        trip_result = await multi_db.tms.execute(trip_query, {"trip_id": trip_id})
        trip_row = trip_result.first()

        if not trip_row:
            raise HTTPException(status_code=404, detail=f"Trip with id '{trip_id}' not found")

        current_status = trip_row[1]
        logger.info(f"Found trip_id: {trip_id}, current_status: {current_status}")

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
                WHERE entity_id = :trip_id
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND (from_status IS NOT NULL OR to_status IS NOT NULL)
                    -- Filter out Enum format entries (containing class names like TripStatus.)
                    AND from_status NOT LIKE '%TripStatus.%'
                    AND to_status NOT LIKE '%TripStatus.%'
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

        timeline_result = await multi_db.company.execute(timeline_query, {"trip_id": trip_id})
        timeline_rows = timeline_result.all()

        if not timeline_rows:
            # No audit logs found, return minimal timeline with current status
            return TripStatusTimelineResponse(
                trip_id=trip_id,
                current_status=current_status,
                total_duration_hours=0.0,
                timeline=[]
            )

        # Build timeline items
        timeline = []
        total_duration = 0.0

        for row in timeline_rows:
            duration = round(float(row[6]), 4) if row[6] is not None else None
            # Only add to total if duration is not null (has a next event)
            # This excludes the current/last status which doesn't have an end time yet
            if duration is not None:
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

        logger.info(f"Retrieved {len(timeline)} timeline events for trip {trip_id}")

        return TripStatusTimelineResponse(
            trip_id=trip_id,
            current_status=current_status,
            total_duration_hours=round(total_duration, 2),
            timeline=timeline
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trip status timeline: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trip status timeline: {str(e)}")


@router.get("/list", response_model=TripsListResponse)
async def list_trips_with_timeline(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    multi_db: MultiDBSession = Depends(get_multi_db),
):
    """
    Get paginated list of trips with timeline summary

    Returns all trips with their total duration calculated from audit_logs.
    Trips are sorted by creation date (most recent first).
    """
    try:
        # Calculate offset for pagination
        offset = (page - 1) * per_page

        # Get total count of trips
        count_query = text("""
            SELECT COUNT(*) as total_count
            FROM trips
        """)
        count_result = await multi_db.tms.execute(count_query)
        total_count = count_result.scalar() or 0

        # Calculate total pages
        total_pages = (total_count + per_page - 1) // per_page

        # First, get the paginated trips
        trips_query = text("""
            SELECT
                id,
                branch,
                status,
                created_at,
                updated_at
            FROM trips
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        trips_result = await multi_db.tms.execute(
            trips_query,
            {"limit": per_page, "offset": offset}
        )
        trip_rows = trips_result.all()

        # Extract trip IDs
        trip_ids = [str(row[0]) for row in trip_rows]

        if not trip_ids:
            return TripsListResponse(
                trips=[],
                total_count=total_count,
                page=page,
                per_page=per_page,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_previous=page > 1
            )

        # Get audit log summaries from company_db for these trips
        audit_query = text("""
            WITH raw_durations AS (
                SELECT
                    entity_id,
                    EXTRACT(EPOCH FROM (LEAD(created_at) OVER (PARTITION BY entity_id ORDER BY created_at) - created_at)) / 3600.0 as duration_hours
                FROM audit_logs
                WHERE entity_id = ANY(:trip_ids)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND (from_status IS NOT NULL OR to_status IS NOT NULL)
            ),
            audit_durations AS (
                SELECT
                    entity_id,
                    SUM(duration_hours) as total_duration_hours,
                    COUNT(*) as status_changes_count
                FROM raw_durations
                WHERE duration_hours IS NOT NULL
                GROUP BY entity_id
            ),
            audit_users AS (
                SELECT DISTINCT ON (entity_id)
                    entity_id,
                    user_email
                FROM audit_logs
                WHERE entity_id = ANY(:trip_ids)
                    AND module = 'trips'
                    AND entity_type = 'trip'
                    AND user_email IS NOT NULL
                    AND user_email != ''
                ORDER BY entity_id, created_at ASC
            )
            SELECT
                au.entity_id,
                COALESCE(ad.total_duration_hours, 0) as total_duration_hours,
                COALESCE(ad.status_changes_count, 0) as status_changes_count,
                au.user_email
            FROM audit_users au
            LEFT JOIN audit_durations ad ON au.entity_id = ad.entity_id
        """)

        audit_result = await multi_db.company.execute(
            audit_query,
            {"trip_ids": trip_ids}
        )
        audit_rows = audit_result.all()

        # Create a lookup dict for audit data
        audit_lookup = {row[0]: (row[1], row[2], row[3]) for row in audit_rows}

        # Build the final response
        trips = []
        for row in trip_rows:
            trip_id = str(row[0])
            total_duration, status_count, user_email = audit_lookup.get(trip_id, (0.0, 0, None))

            trips.append(TripTimelineSummary(
                trip_id=trip_id,
                branch_id=row[1],
                current_status=row[2],
                total_duration_hours=round(float(total_duration), 2),
                status_changes_count=int(status_count),
                created_at=row[3],
                updated_at=row[4],
                user_email=user_email
            ))

        logger.info(f"Returning {len(trips)} trips with user_email data")
        if trips:
            logger.info(f"First trip: trip_id={trips[0].trip_id}, user_email={trips[0].user_email}")

        return TripsListResponse(
            trips=trips,
            total_count=total_count,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    except Exception as e:
        logger.error(f"Error getting trips list: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trips list: {str(e)}")
