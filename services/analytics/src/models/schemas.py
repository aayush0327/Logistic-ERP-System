"""
Analytics Service Pydantic Schemas
Request and Response models for analytics endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# Date Range Enums
# ============================================================================
class DateRangePreset(str, Enum):
    """Predefined date range options"""
    TODAY = "today"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    CUSTOM = "custom"


# ============================================================================
# Common Query Parameters
# ============================================================================
class DateRangeFilter(BaseModel):
    """Date range filter for analytics queries"""
    preset: DateRangePreset = Field(default=DateRangePreset.LAST_7_DAYS)
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


# ============================================================================
# Order Analytics Schemas
# ============================================================================
class OrderStatusCount(BaseModel):
    """Single order status count"""
    status: str
    count: int


class OrderStatusCountsResponse(BaseModel):
    """Order status counts response"""
    date_range: DateRangeFilter
    total_orders: int
    status_counts: List[OrderStatusCount]


class StatusDurationMetrics(BaseModel):
    """Duration metrics for a single status"""
    status: str
    avg_hours: float
    min_hours: float
    max_hours: float
    median_hours: float
    sample_count: int


class OrderStatusDurationsResponse(BaseModel):
    """Order status durations response"""
    date_range: DateRangeFilter
    durations: List[StatusDurationMetrics]


class OrderLifecycle(BaseModel):
    """Single order lifecycle"""
    entity_id: str
    created_at: Optional[datetime]
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    lifecycle_hours: Optional[float]


class OrderLifecyclesResponse(BaseModel):
    """Order lifecycle times response"""
    date_range: DateRangeFilter
    orders: List[OrderLifecycle]
    avg_lifecycle_hours: float


class OrderBottleneck(BaseModel):
    """Orders stuck in a status"""
    current_status: str
    stuck_count: int
    avg_hours_stuck: float
    max_hours_stuck: float


class OrderBottlenecksResponse(BaseModel):
    """Order bottlenecks response"""
    date_range: DateRangeFilter
    threshold_hours: float
    bottlenecks: List[OrderBottleneck]


# ============================================================================
# Trip Analytics Schemas
# ============================================================================
class TripStatusCount(BaseModel):
    """Single trip status count"""
    status: str
    count: int


class TripStatusCountsResponse(BaseModel):
    """Trip status counts response"""
    date_range: DateRangeFilter
    total_trips: int
    status_counts: List[TripStatusCount]


class TripStatusDuration(BaseModel):
    """Duration for a trip status"""
    trip_id: str
    status: str
    hours_in_status: float


class TripStatusDurationsResponse(BaseModel):
    """Trip status durations response"""
    date_range: DateRangeFilter
    durations: List[TripStatusDuration]


class PauseSummary(BaseModel):
    """Pause summary for a trip"""
    trip_id: str
    pause_count: int
    total_pause_hours: float
    avg_pause_hours: float
    max_pause_hours: float


class TripPausesResponse(BaseModel):
    """Trip pauses response"""
    date_range: DateRangeFilter
    pause_summaries: List[PauseSummary]


class TripInefficiency(BaseModel):
    """Trip inefficiency detail"""
    trip_id: str
    delay_type: str  # "planning", "loading", "route"
    expected_hours: float
    actual_hours: float
    delay_hours: float


class TripInefficienciesResponse(BaseModel):
    """Trip inefficiencies response"""
    date_range: DateRangeFilter
    inefficiencies: List[TripInefficiency]


# ============================================================================
# Driver Analytics Schemas
# ============================================================================
class DriverStatusCount(BaseModel):
    """Single driver status count"""
    status: str
    count: int


class DriverStatusCountsResponse(BaseModel):
    """Driver status counts response"""
    date_range: DateRangeFilter
    total_drivers: int
    status_counts: List[DriverStatusCount]


class DriverUtilization(BaseModel):
    """Driver utilization metrics"""
    driver_id: str
    on_trip_hours: float
    available_hours: float
    unavailable_hours: float
    total_hours: float
    utilization_percentage: float


class DriverUtilizationResponse(BaseModel):
    """Driver utilization response"""
    date_range: DateRangeFilter
    drivers: List[DriverUtilization]
    avg_utilization_percentage: float


# ============================================================================
# Truck Analytics Schemas
# ============================================================================
class TruckStatusCount(BaseModel):
    """Single truck status count"""
    status: str
    count: int


class TruckStatusCountsResponse(BaseModel):
    """Truck status counts response"""
    date_range: DateRangeFilter
    total_trucks: int
    status_counts: List[TruckStatusCount]


class TruckUtilization(BaseModel):
    """Truck utilization metrics"""
    vehicle_id: str
    on_trip_days: float
    available_days: float
    maintenance_days: float
    out_of_service_days: float
    total_days: float
    utilization_percentage: float


class TruckUtilizationResponse(BaseModel):
    """Truck utilization response"""
    date_range: DateRangeFilter
    trucks: List[TruckUtilization]
    avg_utilization_percentage: float


# ============================================================================
# Dashboard Summary Schema
# ============================================================================
class DashboardKPIMetric(BaseModel):
    """Single KPI metric"""
    name: str
    value: float
    unit: str
    trend: Optional[str] = None  # "up", "down", "neutral"


class DashboardSummary(BaseModel):
    """Executive dashboard summary"""
    date_range: DateRangeFilter
    kpis: Dict[str, DashboardKPIMetric]
    orders_summary: Dict[str, Any]
    trips_summary: Dict[str, Any]
    drivers_summary: Dict[str, Any]
    trucks_summary: Dict[str, Any]


# ============================================================================
# Entity Timeline Schema
# ============================================================================
class TimelineEvent(BaseModel):
    """Single timeline event"""
    timestamp: datetime
    from_status: Optional[str]
    to_status: Optional[str]
    action: str
    description: str
    duration_hours: Optional[float]


class EntityTimelineResponse(BaseModel):
    """Entity timeline response"""
    entity_type: str
    entity_id: str
    current_status: Optional[str]
    timeline: List[TimelineEvent]
    total_duration_hours: Optional[float]


# ============================================================================
# Status Timeline Schemas
# ============================================================================
class StatusTimelineItem(BaseModel):
    """Single status change in timeline"""
    sequence: int
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    timestamp: datetime
    duration_hours: Optional[float] = None
    user_name: Optional[str] = None
    description: Optional[str] = None


class OrderStatusTimelineResponse(BaseModel):
    """Order status timeline response"""
    order_number: str
    order_id: str
    current_status: str
    total_duration_hours: float
    timeline: List[StatusTimelineItem]


class TripStatusTimelineResponse(BaseModel):
    """Trip status timeline response"""
    trip_id: str
    current_status: str
    total_duration_hours: float
    timeline: List[StatusTimelineItem]


# ============================================================================
# Paginated List Schemas
# ============================================================================
class OrderTimelineSummary(BaseModel):
    """Order with timeline summary for list view"""
    order_number: str
    order_id: str
    current_status: str
    total_duration_hours: float
    status_changes_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class OrdersListResponse(BaseModel):
    """Paginated orders list response"""
    orders: List[OrderTimelineSummary]
    total_count: int
    page: int
    per_page: int
    total_pages: int
    has_next: bool
    has_previous: bool


class TripTimelineSummary(BaseModel):
    """Trip with timeline summary for list view"""
    trip_id: str
    current_status: str
    total_duration_hours: float
    status_changes_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class TripsListResponse(BaseModel):
    """Paginated trips list response"""
    trips: List[TripTimelineSummary]
    total_count: int
    page: int
    per_page: int
    total_pages: int
    has_next: bool
    has_previous: bool


# ============================================================================
# Generic Response Schema
# ============================================================================
class AnalyticsResponse(BaseModel):
    """Generic analytics response wrapper"""
    success: bool
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
