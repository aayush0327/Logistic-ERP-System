"""
External Service Schemas for Orders Service
These schemas are used to parse data from external services like company service
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class Branch(BaseModel):
    """Branch schema from company service"""
    id: UUID
    name: str = Field(..., description="Branch name")
    branch_code: str = Field(..., description="Unique branch code")
    email: Optional[str] = Field(None, description="Branch email")
    phone: Optional[str] = Field(None, description="Branch phone number")
    address: Optional[str] = Field(None, description="Branch address")
    city: Optional[str] = Field(None, description="Branch city")
    state: Optional[str] = Field(None, description="Branch state")
    country: Optional[str] = Field(None, description="Branch country")
    postal_code: Optional[str] = Field(None, description="Branch postal code")
    is_active: bool = Field(True, description="Whether branch is active")
    tenant_id: Optional[str] = Field("default-tenant", description="Tenant ID")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Product(BaseModel):
    """Product schema from company service"""
    id: UUID
    name: str = Field(..., description="Product name")
    code: Optional[str] = Field(None, description="Product code/SKU")
    description: Optional[str] = Field(None, description="Product description")
    category: Optional[str] = Field(None, description="Product category")
    unit: Optional[str] = Field(None, description="Unit of measurement")
    price: Optional[float] = Field(None, description="Product price")
    is_active: bool = Field(True, description="Whether product is active")
    tenant_id: Optional[str] = Field("default-tenant", description="Tenant ID")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Customer(BaseModel):
    """Customer schema from company service"""
    id: UUID
    name: str = Field(..., description="Customer name")
    customer_code: Optional[str] = Field(None, description="Unique customer code")
    email: Optional[str] = Field(None, description="Customer email")
    phone: Optional[str] = Field(None, description="Customer phone number")
    address: Optional[str] = Field(None, description="Customer address")
    city: Optional[str] = Field(None, description="Customer city")
    state: Optional[str] = Field(None, description="Customer state")
    country: Optional[str] = Field(None, description="Customer country")
    postal_code: Optional[str] = Field(None, description="Customer postal code")
    is_active: bool = Field(True, description="Whether customer is active")
    tenant_id: Optional[str] = Field("default-tenant", description="Tenant ID")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Export all schemas
__all__ = [
    "Branch",
    "Product",
    "Customer"
]