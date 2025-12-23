"""
Pydantic schemas for Company Service
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from .database import BusinessType, VehicleType, VehicleStatus, ServiceType


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Branch schemas
class BranchBase(BaseSchema):
    """Base branch schema"""
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    manager_id: Optional[str] = None
    is_active: bool = True


class BranchCreate(BranchBase):
    """Schema for creating a branch"""
    pass


class BranchUpdate(BaseSchema):
    """Schema for updating a branch"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    manager_id: Optional[str] = None
    is_active: Optional[bool] = None


class BranchInDB(BranchBase):
    """Schema for branch in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Branch(BranchInDB):
    """Schema for branch response"""
    pass


# Customer schemas
class CustomerBase(BaseSchema):
    """Base customer schema"""
    home_branch_id: Optional[UUID] = None
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    business_type: Optional[BusinessType] = None
    credit_limit: float = Field(default=0, ge=0)
    pricing_tier: str = Field(default="standard", max_length=20)
    is_active: bool = True


class CustomerCreate(CustomerBase):
    """Schema for creating a customer"""
    pass


class CustomerUpdate(BaseSchema):
    """Schema for updating a customer"""
    home_branch_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    business_type: Optional[BusinessType] = None
    credit_limit: Optional[float] = Field(None, ge=0)
    pricing_tier: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class CustomerInDB(CustomerBase):
    """Schema for customer in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Customer(CustomerInDB):
    """Schema for customer response"""
    home_branch: Optional[Branch] = None


# Vehicle schemas
class VehicleBase(BaseSchema):
    """Base vehicle schema"""
    branch_id: Optional[UUID] = None
    plate_number: str = Field(..., min_length=2, max_length=20)
    make: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    vehicle_type: Optional[VehicleType] = None
    capacity_weight: Optional[float] = Field(None, ge=0)  # in kg
    capacity_volume: Optional[float] = Field(None, ge=0)  # in cubic meters
    status: VehicleStatus = VehicleStatus.AVAILABLE
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    is_active: bool = True


class VehicleCreate(VehicleBase):
    """Schema for creating a vehicle"""
    pass


class VehicleUpdate(BaseSchema):
    """Schema for updating a vehicle"""
    branch_id: Optional[UUID] = None
    make: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    vehicle_type: Optional[VehicleType] = None
    capacity_weight: Optional[float] = Field(None, ge=0)
    capacity_volume: Optional[float] = Field(None, ge=0)
    status: Optional[VehicleStatus] = None
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    is_active: Optional[bool] = None


class VehicleInDB(VehicleBase):
    """Schema for vehicle in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Vehicle(VehicleInDB):
    """Schema for vehicle response"""
    branch: Optional[Branch] = None


# Product Category schemas
class ProductCategoryBase(BaseSchema):
    """Base product category schema"""
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[UUID] = None
    is_active: bool = True


class ProductCategoryCreate(ProductCategoryBase):
    """Schema for creating a product category"""
    pass


class ProductCategoryUpdate(BaseSchema):
    """Schema for updating a product category"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ProductCategoryInDB(ProductCategoryBase):
    """Schema for product category in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProductCategory(ProductCategoryInDB):
    """Schema for product category response"""
    parent: Optional["ProductCategory"] = None
    children: List["ProductCategory"] = []


# Product schemas
class ProductBase(BaseSchema):
    """Base product schema"""
    branch_id: Optional[UUID] = None
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: bool = True
    category_id: Optional[UUID] = None
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    unit_price: float = Field(..., gt=0)
    special_price: Optional[float] = Field(None, ge=0)
    weight: Optional[float] = Field(None, ge=0)  # in kg
    length: Optional[float] = Field(None, ge=0)  # in cm
    width: Optional[float] = Field(None, ge=0)   # in cm
    height: Optional[float] = Field(None, ge=0)  # in cm
    volume: Optional[float] = Field(None, ge=0)  # in cubic meters
    handling_requirements: Optional[List[str]] = Field(default_factory=list)
    min_stock_level: int = Field(default=0, ge=0)
    max_stock_level: Optional[int] = Field(None, ge=0)
    current_stock: int = Field(default=0, ge=0)
    is_active: bool = True


class ProductCreate(ProductBase):
    """Schema for creating a product"""
    pass


class ProductUpdate(BaseSchema):
    """Schema for updating a product"""
    branch_id: Optional[UUID] = None
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: Optional[bool] = None
    category_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    unit_price: Optional[float] = Field(None, gt=0)
    special_price: Optional[float] = Field(None, ge=0)
    weight: Optional[float] = Field(None, ge=0)
    length: Optional[float] = Field(None, ge=0)
    width: Optional[float] = Field(None, ge=0)
    height: Optional[float] = Field(None, ge=0)
    volume: Optional[float] = Field(None, ge=0)
    handling_requirements: Optional[List[str]] = None
    min_stock_level: Optional[int] = Field(None, ge=0)
    max_stock_level: Optional[int] = Field(None, ge=0)
    current_stock: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ProductInDB(ProductBase):
    """Schema for product in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Product(ProductInDB):
    """Schema for product response"""
    available_for_all_branches: bool = True
    branches: Optional[List["ProductBranch"]] = None
    category: Optional[ProductCategory] = None


class ProductBranch(BaseSchema):
    """Schema for product-branch relationship"""
    branch: Optional[Branch] = None


# Pricing Rule schemas
class PricingRuleBase(BaseSchema):
    """Base pricing rule schema"""
    name: str = Field(..., min_length=2, max_length=100)
    service_type: Optional[ServiceType] = None
    zone_origin: Optional[str] = Field(None, max_length=50)
    zone_destination: Optional[str] = Field(None, max_length=50)
    base_price: float = Field(..., ge=0)
    price_per_km: float = Field(default=0, ge=0)
    price_per_kg: float = Field(default=0, ge=0)
    fuel_surcharge_percent: float = Field(default=0, ge=0)
    is_active: bool = True


class PricingRuleCreate(PricingRuleBase):
    """Schema for creating a pricing rule"""
    pass


class PricingRuleUpdate(BaseSchema):
    """Schema for updating a pricing rule"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    service_type: Optional[ServiceType] = None
    zone_origin: Optional[str] = Field(None, max_length=50)
    zone_destination: Optional[str] = Field(None, max_length=50)
    base_price: Optional[float] = Field(None, ge=0)
    price_per_km: Optional[float] = Field(None, ge=0)
    price_per_kg: Optional[float] = Field(None, ge=0)
    fuel_surcharge_percent: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class PricingRuleInDB(PricingRuleBase):
    """Schema for pricing rule in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class PricingRule(PricingRuleInDB):
    """Schema for pricing rule response"""
    pass


# Service Zone schemas
class ServiceZoneBase(BaseSchema):
    """Base service zone schema"""
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    coverage_areas: Optional[Dict[str, Any]] = None
    is_active: bool = True


class ServiceZoneCreate(ServiceZoneBase):
    """Schema for creating a service zone"""
    pass


class ServiceZoneUpdate(BaseSchema):
    """Schema for updating a service zone"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    coverage_areas: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ServiceZoneInDB(ServiceZoneBase):
    """Schema for service zone in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ServiceZone(ServiceZoneInDB):
    """Schema for service zone response"""
    pass


# Generic response schemas
class PaginatedResponse(BaseSchema):
    """Schema for paginated responses"""
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int


# Update forward references
ProductCategory.model_rebuild()