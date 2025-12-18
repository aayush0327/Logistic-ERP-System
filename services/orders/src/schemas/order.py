"""
Order Pydantic schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from src.models.order import OrderStatus, OrderType, PaymentType


# Base schemas
class OrderBase(BaseModel):
    """Base order schema"""
    order_type: OrderType = OrderType.DELIVERY
    priority: str = Field(default="normal", max_length=20)

    # Pickup information
    pickup_address: Optional[str] = None
    pickup_contact_name: Optional[str] = Field(None, max_length=100)
    pickup_contact_phone: Optional[str] = Field(None, max_length=20)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_state: Optional[str] = Field(None, max_length=100)
    pickup_pincode: Optional[str] = Field(None, max_length=20)

    # Delivery information
    delivery_address: Optional[str] = None
    delivery_contact_name: Optional[str] = Field(None, max_length=100)
    delivery_contact_phone: Optional[str] = Field(None, max_length=20)
    delivery_city: Optional[str] = Field(None, max_length=100)
    delivery_state: Optional[str] = Field(None, max_length=100)
    delivery_pincode: Optional[str] = Field(None, max_length=20)

    # Weight and dimensions
    total_weight: Optional[float] = Field(None, ge=0)
    total_volume: Optional[float] = Field(None, ge=0)
    package_count: Optional[int] = Field(None, ge=0)

    # Financial information
    total_amount: Optional[float] = Field(None, ge=0)
    payment_type: Optional[PaymentType] = None

    # Special requirements
    special_instructions: Optional[str] = None
    delivery_instructions: Optional[str] = None

    # Dates
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None


class OrderCreate(OrderBase):
    """Schema for creating an order"""
    order_number: str = Field(..., max_length=50)
    tenant_id: UUID
    customer_id: UUID
    branch_id: UUID
    items: List["OrderItemCreateRequest"] = []


class OrderUpdate(BaseModel):
    """Schema for updating an order"""
    order_type: Optional[OrderType] = None
    priority: Optional[str] = Field(None, max_length=20)

    # Pickup information
    pickup_address: Optional[str] = None
    pickup_contact_name: Optional[str] = Field(None, max_length=100)
    pickup_contact_phone: Optional[str] = Field(None, max_length=20)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_state: Optional[str] = Field(None, max_length=100)
    pickup_pincode: Optional[str] = Field(None, max_length=20)

    # Delivery information
    delivery_address: Optional[str] = None
    delivery_contact_name: Optional[str] = Field(None, max_length=100)
    delivery_contact_phone: Optional[str] = Field(None, max_length=20)
    delivery_city: Optional[str] = Field(None, max_length=100)
    delivery_state: Optional[str] = Field(None, max_length=100)
    delivery_pincode: Optional[str] = Field(None, max_length=20)

    # Weight and dimensions
    total_weight: Optional[float] = Field(None, ge=0)
    total_volume: Optional[float] = Field(None, ge=0)
    package_count: Optional[int] = Field(None, ge=0)

    # Financial information
    total_amount: Optional[float] = Field(None, ge=0)
    payment_type: Optional[PaymentType] = None

    # Special requirements
    special_instructions: Optional[str] = None
    delivery_instructions: Optional[str] = None

    # Dates
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None


# Response schemas
class OrderItemResponse(BaseModel):
    """Schema for order item response"""
    id: UUID
    product_id: UUID
    product_name: str
    product_code: Optional[str]
    description: Optional[str]
    quantity: int
    unit: str
    unit_price: Optional[float]
    total_price: Optional[float]
    weight: Optional[float]
    volume: Optional[float]
    dimensions_length: Optional[float]
    dimensions_width: Optional[float]
    dimensions_height: Optional[float]

    model_config = ConfigDict(from_attributes=True)


class OrderDocumentResponse(BaseModel):
    """Schema for order document response"""
    id: UUID
    document_type: str
    title: str
    description: Optional[str]
    file_name: str
    file_size: int
    mime_type: str
    is_required: bool
    is_verified: bool
    verified_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class OrderStatusHistoryResponse(BaseModel):
    """Schema for order status history response"""
    from_status: Optional[str]
    to_status: str
    reason: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(OrderBase):
    """Schema for order response"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    tenant_id: UUID
    customer_id: UUID
    branch_id: UUID
    status: OrderStatus

    # System fields
    created_by: UUID
    updated_by: Optional[UUID]
    finance_approved_by: Optional[UUID]
    logistics_approved_by: Optional[UUID]
    driver_id: Optional[UUID]
    trip_id: Optional[UUID]

    # Approval dates
    finance_approved_at: Optional[datetime]
    logistics_approved_at: Optional[datetime]
    picked_up_at: Optional[datetime]
    delivered_at: Optional[datetime]

    # Rejection information
    finance_rejected_reason: Optional[str]
    logistics_rejected_reason: Optional[str]

    # Metadata
    created_at: datetime
    updated_at: datetime
    is_active: bool

    # Relationships
    items: List[OrderItemResponse] = []
    documents: List[OrderDocumentResponse] = []
    status_history: List[OrderStatusHistoryResponse] = []


class OrderListResponse(BaseModel):
    """Schema for order list response (without relationships)"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    customer_id: UUID
    branch_id: UUID
    status: OrderStatus
    order_type: OrderType
    priority: str
    total_amount: Optional[float]
    payment_type: Optional[PaymentType]
    pickup_date: Optional[datetime]
    delivery_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# Status update schemas
class OrderStatusUpdate(BaseModel):
    """Schema for updating order status"""
    status: OrderStatus
    reason: Optional[str] = None
    notes: Optional[str] = None


class FinanceApprovalRequest(BaseModel):
    """Schema for finance approval/rejection"""
    approved: bool
    reason: Optional[str] = None
    notes: Optional[str] = None
    payment_type: Optional[PaymentType] = None


class LogisticsApprovalRequest(BaseModel):
    """Schema for logistics approval/rejection"""
    approved: bool
    reason: Optional[str] = None
    notes: Optional[str]
    driver_id: Optional[UUID] = None
    trip_id: Optional[UUID] = None


# Query parameters
class OrderQueryParams(BaseModel):
    """Schema for order query parameters"""
    status: Optional[OrderStatus] = None
    customer_id: Optional[UUID] = None
    branch_id: Optional[UUID] = None
    order_type: Optional[OrderType] = None
    priority: Optional[str] = None
    payment_type: Optional[PaymentType] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="created_at", pattern="^(created_at|updated_at|order_number|total_amount)$")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


# Import forward references
from src.schemas.order_item import OrderItemCreate, OrderItemCreateRequest
