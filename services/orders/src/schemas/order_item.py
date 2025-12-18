"""
Order Item Pydantic schemas for API requests and responses
"""
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class OrderItemBase(BaseModel):
    """Base order item schema"""
    product_id: UUID
    product_name: str = Field(..., max_length=200)
    product_code: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit: str = Field(default="pcs", max_length=50)
    unit_price: Optional[float] = Field(None, ge=0, )
    total_price: Optional[float] = Field(None, ge=0, )
    weight: Optional[float] = Field(None, ge=0, )
    volume: Optional[float] = Field(None, ge=0, )
    dimensions_length: Optional[float] = Field(None, ge=0, )
    dimensions_width: Optional[float] = Field(None, ge=0, )
    dimensions_height: Optional[float] = Field(None, ge=0, )


class OrderItemCreateRequest(BaseModel):
    """Schema for creating an order item from API request (minimal fields)"""
    product_id: UUID
    quantity: int = Field(..., gt=0)


class OrderItemCreate(OrderItemBase):
    """Schema for creating an order item with full product details"""
    pass


class OrderItemUpdate(BaseModel):
    """Schema for updating an order item"""
    product_id: Optional[UUID] = None
    product_name: Optional[str] = Field(None, max_length=200)
    product_code: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    quantity: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=50)
    unit_price: Optional[float] = Field(None, ge=0, )
    total_price: Optional[float] = Field(None, ge=0, )
    weight: Optional[float] = Field(None, ge=0, )
    volume: Optional[float] = Field(None, ge=0, )
    dimensions_length: Optional[float] = Field(None, ge=0, )
    dimensions_width: Optional[float] = Field(None, ge=0, )
    dimensions_height: Optional[float] = Field(None, ge=0, )


class OrderItemResponse(OrderItemBase):
    """Schema for order item response"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    created_at: Optional[str] = None
    updated_at: Optional[str] = None