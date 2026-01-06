"""Pydantic schemas for Driver Service."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class TripStatus(str, Enum):
    """Trip status enum."""
    PLANNING = "planning"
    LOADING = "loading"
    ON_ROUTE = "on-route"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TRUCK_MALFUNCTION = "truck-malfunction"


class OrderStatus(str, Enum):
    """Order status enum."""
    ASSIGNED = "assigned"
    LOADING = "loading"
    ON_ROUTE = "on-route"
    COMPLETED = "completed"


class DeliveryStatus(str, Enum):
    """Delivery status enum."""
    PENDING = "pending"
    OUT_FOR_DELIVERY = "out-for-delivery"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETURNED = "returned"


class Priority(str, Enum):
    """Priority enum."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        use_enum_values=True,
        populate_by_name=True
    )


# Trip Schemas
class TripBase(BaseSchema):
    """Base trip schema."""
    status: Optional[TripStatus] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance: Optional[int] = None
    estimated_duration: Optional[int] = None
    capacity_used: Optional[int] = 0


class TripCreate(TripBase):
    """Trip creation schema."""
    id: str
    user_id: str
    company_id: str
    branch: str
    truck_plate: str
    truck_model: str
    truck_capacity: int
    driver_id: str
    driver_name: str
    driver_phone: str
    capacity_total: int
    trip_date: date


class TripUpdate(BaseSchema):
    """Trip update schema."""
    status: Optional[TripStatus] = None
    capacity_used: Optional[int] = None
    distance: Optional[int] = None
    estimated_duration: Optional[int] = None


class TripResponse(TripBase):
    """Trip response schema."""
    id: str
    user_id: str
    company_id: str
    branch: str
    truck_plate: str
    truck_model: str
    truck_capacity: int
    driver_id: str
    driver_name: str
    driver_phone: str
    capacity_total: int
    trip_date: date
    pre_trip_time: Optional[int] = 30
    post_trip_time: Optional[int] = 15
    created_at: datetime
    updated_at: datetime
    orders: List['TripOrderResponse'] = []


# Trip Order Schemas
class TripOrderBase(BaseSchema):
    """Base trip order schema."""
    status: Optional[OrderStatus] = None
    delivery_status: Optional[DeliveryStatus] = None
    sequence_number: Optional[int] = 0


class TripOrderCreate(TripOrderBase):
    """Trip order creation schema."""
    trip_id: str
    user_id: str
    company_id: str
    order_id: str
    customer: str
    customer_address: Optional[str] = None
    total: Decimal
    weight: int
    volume: int
    items: int
    priority: Priority
    address: Optional[str] = None
    original_order_id: Optional[str] = None
    original_items: Optional[int] = None
    original_weight: Optional[int] = None


class TripOrderUpdate(BaseSchema):
    """Trip order update schema."""
    status: Optional[OrderStatus] = None
    delivery_status: Optional[DeliveryStatus] = None
    sequence_number: Optional[int] = None


class TripOrderResponse(TripOrderBase):
    """Trip order response schema."""
    id: int
    trip_id: str
    user_id: str
    company_id: str
    order_id: str
    customer: str
    customer_address: Optional[str] = None
    total: Decimal
    weight: int
    volume: int
    items: int
    priority: Priority
    address: Optional[str] = None
    assigned_at: datetime
    original_order_id: Optional[str] = None
    original_items: Optional[int] = None
    original_weight: Optional[int] = None


# Driver-specific schemas
class TripSummary(BaseSchema):
    """Trip summary for driver dashboard."""
    id: str
    status: TripStatus
    origin: Optional[str] = None
    destination: Optional[str] = None
    truck_plate: str
    truck_model: str
    capacity_used: int
    capacity_total: int
    trip_date: date
    order_count: int = 0
    completed_orders: int = 0


class DeliveryUpdate(BaseSchema):
    """Delivery update schema."""
    delivery_status: DeliveryStatus
    notes: Optional[str] = None


class TruckMaintenanceRequest(BaseSchema):
    """Truck maintenance request schema."""
    trip_id: str
    reason: str = Field(..., min_length=1, max_length=500)
    maintenance_type: str = Field(..., min_length=1, max_length=100)


class TruckMaintenanceResponse(BaseSchema):
    """Truck maintenance response schema."""
    trip_id: str
    truck_plate: str
    driver_id: str
    maintenance_type: str
    reason: str
    reported_at: datetime
    status: str = "reported"


# Response schemas for API endpoints
class DriverTripListResponse(BaseSchema):
    """Driver trip list response."""
    trips: List[TripSummary]
    total: int
    active: int
    completed: int


class DriverTripDetailResponse(BaseSchema):
    """Driver trip detail response."""
    trip: TripResponse
    orders: List[TripOrderResponse]


class ApiResponse(BaseSchema):
    """Generic API response."""
    success: bool
    message: str
    data: Optional[dict] = None


class ErrorResponse(BaseSchema):
    """Error response schema."""
    success: bool = False
    error: str
    detail: Optional[str] = None


class TripPause(BaseSchema):
    """Schema for pausing a trip."""
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for pause")
    note: Optional[str] = Field(None, max_length=2000, description="Additional notes")


class TripResume(BaseSchema):
    """Schema for resuming a trip."""
    note: Optional[str] = Field(None, max_length=2000, description="Resume notes")


# Update forward references
TripResponse.model_rebuild()