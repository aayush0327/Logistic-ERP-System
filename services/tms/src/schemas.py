"""Pydantic schemas for TMS Service"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


# Enums
class TripStatus(str, Enum):
    PLANNING = "planning"
    LOADING = "loading"
    ON_ROUTE = "on-route"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TRUCK_MALFUNCTION = "truck-malfunction"


class OrderStatus(str, Enum):
    ASSIGNED = "assigned"
    LOADING = "loading"
    ON_ROUTE = "on-route"
    COMPLETED = "completed"


class Priority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NORMAL = "normal"


class RouteStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"


# Base Schemas
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True


# Truck Schema (dummy data)
class Truck(BaseSchema):
    id: str
    plate: str
    model: str
    capacity: int
    status: str


# Driver Schema (dummy data)
class Driver(BaseSchema):
    id: str
    name: str
    phone: str
    license: str
    experience: str
    status: str
    currentTruck: Optional[str] = None
    branch_id: Optional[str] = None
    user_id: Optional[str] = None


# Order Schema (dummy data)
class Order(BaseSchema):
    id: str
    customer: str
    customerAddress: Optional[str] = None
    status: str
    total: float
    weight: int
    volume: int
    date: date
    priority: Priority
    items: int
    address: Optional[str] = None


# Branch Schema (dummy data)
class Branch(BaseSchema):
    id: str
    code: str
    name: str
    location: str
    manager: str
    phone: str
    status: str


# Trip Order Schemas
class TripOrderCreate(BaseModel):
    order_id: str
    customer: str
    customer_address: Optional[str] = None
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    product_name: Optional[str] = None
    total: float
    weight: int
    volume: int
    items: int
    quantity: Optional[int] = 1
    priority: Priority
    address: Optional[str] = None
    special_instructions: Optional[str] = None
    delivery_instructions: Optional[str] = None
    original_order_id: Optional[str] = None
    original_items: Optional[int] = None
    original_weight: Optional[int] = None
    # user_id and company_id are extracted from JWT token, not required in request
    user_id: Optional[str] = None
    company_id: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class TripOrderResponse(BaseSchema):
    id: int
    trip_id: str
    user_id: str
    company_id: str
    order_id: str
    customer: str
    customer_address: Optional[str] = None
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    product_name: Optional[str] = None
    status: OrderStatus
    total: float
    weight: int
    volume: int
    items: int
    quantity: int
    priority: Priority
    delivery_status: Optional[str] = "pending"
    sequence_number: int
    address: Optional[str] = None
    special_instructions: Optional[str] = None
    delivery_instructions: Optional[str] = None
    original_order_id: Optional[str] = None
    original_items: Optional[int] = None
    original_weight: Optional[int] = None
    assigned_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


# Trip Schemas
class TripCreate(BaseModel):
    branch: str  # Contains branch ID (UUID)
    truck_plate: str
    truck_model: str
    truck_capacity: int
    driver_id: str
    driver_name: str
    driver_phone: str
    capacity_total: int
    trip_date: date
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance: Optional[int] = None
    estimated_duration: Optional[int] = None
    pre_trip_time: Optional[int] = 30
    post_trip_time: Optional[int] = 15
    status: Optional[TripStatus] = TripStatus.PLANNING


class TripUpdate(BaseModel):
    status: Optional[TripStatus] = None
    destination: Optional[str] = None
    capacity_used: Optional[int] = None
    distance: Optional[int] = None
    estimated_duration: Optional[int] = None


class TripResponse(BaseSchema):
    id: str
    user_id: str
    company_id: str
    branch: str  # Contains branch ID (UUID)
    truck_plate: str
    truck_model: str
    truck_capacity: int
    driver_id: str
    driver_name: str
    driver_phone: str
    status: TripStatus
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance: Optional[int] = None
    estimated_duration: Optional[int] = None
    pre_trip_time: int
    post_trip_time: int
    capacity_used: int
    capacity_total: int
    trip_date: date
    created_at: datetime
    updated_at: datetime
    orders: List[TripOrderResponse] = []


class TripWithOrders(TripResponse):
    """Trip with full order details"""
    pass


# Route Schemas
class TripRouteCreate(BaseModel):
    user_id: str
    company_id: str
    sequence_number: int
    order_id: Optional[int] = None
    location: str
    estimated_arrival: Optional[datetime] = None


class TripRouteResponse(BaseSchema):
    id: int
    trip_id: str
    user_id: str
    company_id: str
    sequence_number: int
    order_id: Optional[int] = None
    location: str
    estimated_arrival: Optional[datetime] = None
    status: RouteStatus
    created_at: datetime


# Assign Orders Request Schema
class AssignOrdersRequest(BaseModel):
    orders: List[TripOrderCreate]


# Response Schemas
class MessageResponse(BaseModel):
    message: str


# Error Response Schema
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    status_code: Optional[int] = None# Reorder Orders Request Schema
class ReorderOrdersRequest(BaseModel):
    order_sequences: List[dict]  # List of {"order_id": int, "sequence_number": int}


# Driver-specific Schemas
class DeliveryStatus(str, Enum):
    PENDING = "pending"
    OUT_FOR_DELIVERY = "out-for-delivery"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETURNED = "returned"


class DeliveryUpdate(BaseModel):
    status: DeliveryStatus


class DriverTripSummary(BaseModel):
    id: str
    driver_id: str
    status: TripStatus
    origin: Optional[str] = None
    destination: Optional[str] = None
    truck_plate: str
    truck_model: str
    trip_date: date
    total_orders: int
    completed_orders: int
    capacity_used: Optional[int] = 0
    capacity_total: int


class DriverTripListResponse(BaseModel):
    trips: List[DriverTripSummary]
    total: int
    active: int
    completed: int


class DriverOrderDetail(BaseModel):
    id: int
    order_id: str
    customer: str
    customer_address: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: OrderStatus
    delivery_status: DeliveryStatus
    total: float = 0
    weight: int = 0
    volume: int = 0
    items: int = 0
    priority: Priority
    sequence_number: int
    assigned_at: datetime


class DriverTripDetailResponse(BaseModel):
    id: str
    driver_id: str
    status: TripStatus
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance: Optional[int] = None
    truck_plate: str
    truck_model: str
    capacity_used: int
    capacity_total: int
    estimated_duration: Optional[int] = None
    pre_trip_time: Optional[int] = None
    post_trip_time: Optional[int] = None
    orders: List[DriverOrderDetail]
    created_at: datetime
    updated_at: datetime
