"""
Pydantic schemas for Company Service
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_serializer, computed_field
from uuid import UUID
from .database import BusinessType, VehicleStatus, ServiceType, WeightType
# Note: VehicleType enum is now deprecated, use VehicleTypeModel instead


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


# BusinessType schemas
class BusinessTypeBase(BaseSchema):
    """Base business type schema"""
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class BusinessTypeCreate(BusinessTypeBase):
    """Schema for creating a business type"""
    pass


class BusinessTypeUpdate(BaseSchema):
    """Schema for updating a business type"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class BusinessTypeInDB(BusinessTypeBase):
    """Schema for business type in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class BusinessTypeModel(BusinessTypeInDB):
    """Schema for business type response"""
    pass


# VehicleType schemas
class VehicleTypeBase(BaseSchema):
    """Base vehicle type schema"""
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class VehicleTypeCreate(VehicleTypeBase):
    """Schema for creating a vehicle type"""
    pass


class VehicleTypeUpdate(BaseSchema):
    """Schema for updating a vehicle type"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class VehicleTypeInDB(VehicleTypeBase):
    """Schema for vehicle type in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class VehicleTypeModel(VehicleTypeInDB):
    """Schema for vehicle type response"""
    pass


# Customer schemas
class CustomerBase(BaseSchema):
    """Base customer schema"""
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: bool = True
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    contact_person_name: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    # Support both old enum, new foreign key, and multiple business types
    business_type: Optional[BusinessType] = None  # Deprecated
    business_type_id: Optional[UUID] = None  # Deprecated - single business type
    business_type_ids: Optional[List[UUID]] = None  # New - multiple business types
    credit_limit: float = Field(default=0, ge=0)
    pricing_tier: str = Field(default="standard", max_length=20)
    is_active: bool = True
    # Marketing person contact details
    marketing_person_name: Optional[str] = Field(None, max_length=100)
    marketing_person_phone: Optional[str] = Field(None, max_length=20)
    marketing_person_email: Optional[str] = Field(None, max_length=100)

    @model_validator(mode='before')
    @classmethod
    def convert_empty_business_type_to_none(cls, data):
        """Convert empty string for business_type to None to avoid enum validation errors"""
        if isinstance(data, dict):
            business_type_value = data.get('business_type')
            if business_type_value == '':
                data['business_type'] = None
        return data


class CustomerCreate(CustomerBase):
    """Schema for creating a customer"""
    pass


class CustomerUpdate(BaseSchema):
    """Schema for updating a customer"""
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: Optional[bool] = None
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    contact_person_name: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    # Support both old enum, new foreign key, and multiple business types
    business_type: Optional[BusinessType] = None  # Deprecated
    business_type_id: Optional[UUID] = None  # Deprecated - single business type
    business_type_ids: Optional[List[UUID]] = None  # New - multiple business types
    credit_limit: Optional[float] = Field(None, ge=0)
    pricing_tier: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    # Marketing person contact details
    marketing_person_name: Optional[str] = Field(None, max_length=100)
    marketing_person_phone: Optional[str] = Field(None, max_length=20)
    marketing_person_email: Optional[str] = Field(None, max_length=100)


class CustomerInDB(CustomerBase):
    """Schema for customer in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Customer(CustomerInDB):
    """Schema for customer response"""
    business_type_relation: Optional[BusinessTypeModel] = None  # Deprecated - single business type
    available_for_all_branches: bool = True
    branches: Optional[List["CustomerBranch"]] = None
    business_types_raw: Optional[List[Any]] = Field(default=None, exclude=True, repr=False)  # Private field for internal use

    @computed_field  # type: ignore[misc]
    @property
    def business_types(self) -> Optional[List[BusinessTypeModel]]:
        """Extract business types from CustomerBusinessType junction objects"""
        if self.business_types_raw is None:
            return None
        result = []
        for item in self.business_types_raw:
            if isinstance(item, dict):
                if 'business_type' in item and item['business_type']:
                    if isinstance(item['business_type'], dict):
                        result.append(BusinessTypeModel(**item['business_type']))
                    else:
                        result.append(item['business_type'])
            elif hasattr(item, 'business_type') and item.business_type:
                result.append(item.business_type)
        return result if result else None

    @classmethod
    def model_validate(cls, obj, **kwargs):
        """Override model_validate to handle business_types extraction"""
        # Handle SQLAlchemy objects directly
        if hasattr(obj, '__table__'):  # SQLAlchemy model
            # Convert business_types relationship before validation
            if hasattr(obj, 'business_types'):
                data = {
                    'id': obj.id,
                    'tenant_id': obj.tenant_id,
                    'code': obj.code,
                    'name': obj.name,
                    'phone': obj.phone,
                    'email': obj.email,
                    'address': obj.address,
                    'city': obj.city,
                    'state': obj.state,
                    'postal_code': obj.postal_code,
                    'business_type': obj.business_type,
                    'business_type_id': obj.business_type_id,
                    'credit_limit': obj.credit_limit,
                    'pricing_tier': obj.pricing_tier,
                    'is_active': obj.is_active,
                    'available_for_all_branches': obj.available_for_all_branches,
                    'created_at': obj.created_at,
                    'updated_at': obj.updated_at,
                    'business_types_raw': list(obj.business_types) if obj.business_types else None,
                    'business_type_relation': obj.business_type_relation,
                    'branches': obj.branches,
                    'marketing_person_name': getattr(obj, 'marketing_person_name', None),
                    'marketing_person_phone': getattr(obj, 'marketing_person_phone', None),
                    'marketing_person_email': getattr(obj, 'marketing_person_email', None),
                }
                return super().model_validate(data, **kwargs)
        return super().model_validate(obj, **kwargs)


class CustomerBranch(BaseSchema):
    """Schema for customer-branch relationship"""
    branch: Optional[Branch] = None


# Vehicle schemas
class VehicleBase(BaseSchema):
    """Base vehicle schema"""
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: bool = True
    plate_number: str = Field(..., min_length=2, max_length=20)
    make: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    # Support both old enum (as string) and new foreign key
    vehicle_type: Optional[str] = None  # Deprecated: use vehicle_type_id instead
    vehicle_type_id: Optional[UUID] = None
    capacity_weight: Optional[float] = Field(None, ge=0)  # in kg
    capacity_volume: Optional[float] = Field(None, ge=0)  # in cubic meters
    status: VehicleStatus = VehicleStatus.AVAILABLE
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    # Odometer and fuel economy tracking
    current_odometer: Optional[float] = Field(None, ge=0)  # Current odometer reading in km
    current_fuel_economy: Optional[float] = Field(None, ge=0)  # Current fuel economy in km/liter
    last_odometer_update: Optional[datetime] = None
    is_active: bool = True

    @model_validator(mode='before')
    @classmethod
    def convert_empty_vehicle_type_to_none(cls, data):
        """Convert empty string for vehicle_type to None to avoid enum validation errors"""
        if isinstance(data, dict):
            vehicle_type_value = data.get('vehicle_type')
            if vehicle_type_value == '':
                data['vehicle_type'] = None
        return data


class VehicleCreate(VehicleBase):
    """Schema for creating a vehicle"""
    pass


class VehicleUpdate(BaseSchema):
    """Schema for updating a vehicle"""
    branch_ids: Optional[List[UUID]] = None
    available_for_all_branches: Optional[bool] = None
    make: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    # Support both old enum (as string) and new foreign key
    vehicle_type: Optional[str] = None
    vehicle_type_id: Optional[UUID] = None
    capacity_weight: Optional[float] = Field(None, ge=0)
    capacity_volume: Optional[float] = Field(None, ge=0)
    status: Optional[VehicleStatus] = None
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    # Odometer and fuel economy tracking
    current_odometer: Optional[float] = Field(None, ge=0)
    current_fuel_economy: Optional[float] = Field(None, ge=0)
    last_odometer_update: Optional[datetime] = None
    is_active: Optional[bool] = None


class VehicleInDB(VehicleBase):
    """Schema for vehicle in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Vehicle(VehicleInDB):
    """Schema for vehicle response"""
    vehicle_type_relation: Optional[VehicleTypeModel] = None
    available_for_all_branches: bool = True
    branches: Optional[List["VehicleBranch"]] = None


class VehicleBranch(BaseSchema):
    """Schema for vehicle-branch relationship"""
    branch: Optional[Branch] = None


# Vehicle Odometer & Fuel Log schemas
class VehicleOdometerFuelLogBase(BaseSchema):
    """Base vehicle odometer and fuel log schema"""
    vehicle_id: UUID
    odometer_reading: float = Field(..., ge=0)
    fuel_economy: Optional[float] = Field(None, ge=0)
    fuel_consumed: Optional[float] = Field(None, ge=0)
    distance_traveled: Optional[float] = Field(None, ge=0)
    log_date: datetime
    log_type: str = Field(..., min_length=1, max_length=20)  # 'manual', 'refueling', 'maintenance', 'trip_end'
    notes: Optional[str] = Field(None, max_length=1000)
    recorded_by_user_id: Optional[str] = None


class VehicleOdometerFuelLogCreate(VehicleOdometerFuelLogBase):
    """Schema for creating an odometer log"""
    pass


class VehicleOdometerFuelLogUpdate(BaseSchema):
    """Schema for updating an odometer log"""
    odometer_reading: Optional[float] = Field(None, ge=0)
    fuel_economy: Optional[float] = Field(None, ge=0)
    fuel_consumed: Optional[float] = Field(None, ge=0)
    distance_traveled: Optional[float] = Field(None, ge=0)
    log_date: Optional[datetime] = None
    log_type: Optional[str] = Field(None, min_length=1, max_length=20)
    notes: Optional[str] = Field(None, max_length=1000)


class VehicleOdometerFuelLogInDB(VehicleOdometerFuelLogBase):
    """Schema for odometer log in database"""
    id: UUID
    tenant_id: str
    created_at: datetime


class VehicleOdometerFuelLog(VehicleOdometerFuelLogInDB):
    """Schema for odometer log response"""
    pass


# Product Unit Type schemas
class ProductUnitTypeBase(BaseSchema):
    """Base product unit type schema"""
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    abbreviation: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class ProductUnitTypeCreate(ProductUnitTypeBase):
    """Schema for creating a product unit type"""
    pass


class ProductUnitTypeUpdate(BaseSchema):
    """Schema for updating a product unit type"""
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    abbreviation: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ProductUnitTypeInDB(ProductUnitTypeBase):
    """Schema for product unit type in database"""
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProductUnitType(ProductUnitTypeInDB):
    """Schema for product unit type response"""
    pass


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
    unit_type_id: Optional[UUID] = None
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    unit_price: float = Field(..., gt=0)
    special_price: Optional[float] = Field(None, ge=0)

    # Weight configuration - supports fixed and variable weight types
    weight_type: WeightType = Field(default=WeightType.FIXED, description="Type of weight: fixed or variable")
    weight: Optional[float] = Field(None, ge=0, description="Deprecated - use fixed_weight")  # in kg
    fixed_weight: Optional[float] = Field(None, ge=0, description="Fixed weight in kg for FIXED type products")
    weight_unit: str = Field(default="kg", max_length=20, description="Weight unit (kg, lb, g, etc.)")

    @field_serializer('weight_type')
    def serialize_weight_type(self, value: WeightType) -> str:
        """Serialize WeightType enum to its string value"""
        if value is None:
            return WeightType.FIXED.value
        return value.value if isinstance(value, WeightType) else str(value)

    # Dimensions
    length: Optional[float] = Field(None, ge=0)  # in cm
    width: Optional[float] = Field(None, ge=0)   # in cm
    height: Optional[float] = Field(None, ge=0)  # in cm
    volume: Optional[float] = Field(None, ge=0)  # in cubic meters

    handling_requirements: Optional[List[str]] = Field(default_factory=list)
    min_stock_level: int = Field(default=0, ge=0)
    max_stock_level: Optional[int] = Field(None, ge=0)
    current_stock: int = Field(default=0, ge=0)
    is_active: bool = True

    @model_validator(mode='after')
    def validate_weight_fields(self):
        """Validate weight fields based on weight_type"""
        if self.weight_type == WeightType.FIXED:
            if self.fixed_weight is None and self.weight is None:
                raise ValueError("fixed_weight is required for FIXED weight type")
            # If weight is provided (legacy), use it as fixed_weight
            if self.weight is not None and self.fixed_weight is None:
                self.fixed_weight = self.weight
        # VARIABLE type doesn't require any weight fields - actual weight entered when creating orders
        return self


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

    # Weight configuration
    weight_type: Optional[WeightType] = None
    weight: Optional[float] = Field(None, ge=0)
    fixed_weight: Optional[float] = Field(None, ge=0)
    weight_unit: Optional[str] = None

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
    unit_type: Optional["ProductUnitType"] = None


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


# User Role Management Schemas

# User Invitation schemas
class UserInvitationBase(BaseSchema):
    """Base user invitation schema"""
    email: str = Field(..., max_length=255)
    role_id: str = Field(..., min_length=36, max_length=36)
    branch_id: Optional[UUID] = None
    invited_by: str = Field(..., min_length=36, max_length=255)
    expires_at: datetime
    status: str = Field(default="pending", max_length=20)
    is_active: bool = True


class UserInvitationCreate(UserInvitationBase):
    """Schema for creating a user invitation"""
    invitation_token: str = Field(..., max_length=255)
    invited_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[str] = None


class UserInvitationUpdate(BaseSchema):
    """Schema for updating a user invitation"""
    role_id: Optional[str] = Field(None, min_length=36, max_length=36)
    branch_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=20)
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[str] = None
    is_active: Optional[bool] = None


class UserInvitationInDB(UserInvitationBase):
    """Schema for user invitation in database"""
    id: str
    tenant_id: str
    invitation_token: str
    invited_at: datetime
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserInvitation(UserInvitationInDB):
    """Schema for user invitation response"""
    role: Optional["CompanyRole"] = None
    branch: Optional[Branch] = None


# Company Role schemas
class CompanyRoleBase(BaseSchema):
    """Base company role schema"""
    role_name: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True
    is_system_role: bool = False


class CompanyRoleCreate(CompanyRoleBase):
    """Schema for creating a company role"""
    pass


class CompanyRoleUpdate(BaseSchema):
    """Schema for updating a company role"""
    role_name: Optional[str] = Field(None, min_length=2, max_length=50)
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_system_role: Optional[bool] = None


class CompanyRoleInDB(CompanyRoleBase):
    """Schema for company role in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class CompanyRole(CompanyRoleInDB):
    """Schema for company role response"""
    name: str = Field(..., description="Display name of the role for frontend compatibility")
    employees: Optional[List["EmployeeProfile"]] = None
    invitations: Optional[List[UserInvitation]] = None


# Auth Service Role schema (for roles from the auth service)
class AuthRole(BaseModel):
    """Schema for auth service role response"""
    id: int  # Auth service returns role ID as integer
    role_name: str
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    is_system_role: bool = False
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    employees: List[Any] = []
    invitations: List[Any] = []


# Employee Profile schemas
class EmployeeProfileBase(BaseSchema):
    """Base employee profile schema"""
    user_id: str = Field(..., min_length=36, max_length=255)
    employee_code: Optional[str] = Field(None, max_length=20)
    role_id: Optional[str] = Field(None, max_length=50)  # Now stores auth service role ID as string
    branch_id: Optional[UUID] = None  # Deprecated: Use branch_ids for multiple branches
    branch_ids: Optional[List[UUID]] = None  # New: Multiple branch assignments
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = Field(None, max_length=10)
    blood_group: Optional[str] = Field(None, max_length=5)
    marital_status: Optional[str] = Field(None, max_length=20)  # single, married, divorced, widowed
    nationality: Optional[str] = Field("India", max_length=50)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=1000)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: str = Field(default="India", max_length=50)
    hire_date: Optional[datetime] = None
    employment_type: str = Field(default="permanent", max_length=20)
    department: Optional[str] = Field(None, max_length=50)
    designation: Optional[str] = Field(None, max_length=100)
    reports_to: Optional[str] = Field(None, min_length=36, max_length=36)
    salary: Optional[float] = Field(None, ge=0)
    bank_account_number: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    pan_number: Optional[str] = Field(None, max_length=20)
    aadhar_number: Optional[str] = Field(None, max_length=20)
    passport_number: Optional[str] = Field(None, max_length=20)
    is_active: bool = True


class EmployeeProfileCreate(EmployeeProfileBase):
    """Schema for creating an employee profile"""

    @model_validator(mode='after')
    def validate_branch_assignment(self):
        # Ensure at least one branch is assigned
        if not self.branch_id and not self.branch_ids:
            raise ValueError('At least one branch must be assigned')
        # Auto-set branch_id from branch_ids[0] if not provided
        if not self.branch_id and self.branch_ids:
            self.branch_id = self.branch_ids[0]
        return self


class EmployeeProfileUpdate(BaseSchema):
    """Schema for updating an employee profile"""
    employee_code: Optional[str] = Field(None, max_length=20)
    role_id: Optional[str] = Field(None, max_length=50)  # Now stores auth service role ID as string
    branch_id: Optional[UUID] = None  # Deprecated: Use branch_ids for multiple branches
    branch_ids: Optional[List[UUID]] = None  # New: Multiple branch assignments
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = Field(None, max_length=10)
    blood_group: Optional[str] = Field(None, max_length=5)
    marital_status: Optional[str] = Field(None, max_length=20)  # single, married, divorced, widowed
    nationality: Optional[str] = Field(None, max_length=50)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=1000)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=50)
    hire_date: Optional[datetime] = None
    employment_type: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=50)
    designation: Optional[str] = Field(None, max_length=100)
    reports_to: Optional[str] = Field(None, min_length=36, max_length=36)
    salary: Optional[float] = Field(None, ge=0)
    bank_account_number: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    pan_number: Optional[str] = Field(None, max_length=20)
    aadhar_number: Optional[str] = Field(None, max_length=20)
    passport_number: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class EmployeeProfileInDB(EmployeeProfileBase):
    """Schema for employee profile in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class EmployeeProfile(EmployeeProfileInDB):
    """Schema for employee profile response"""
    role: Optional[AuthRole] = None  # Auth service role
    branch: Optional[Branch] = None
    branches: Optional[List[Branch]] = None  # New: All assigned branches
    documents: Optional[List["EmployeeDocument"]] = None


# Employee Branch schemas (Junction table)
class EmployeeBranchBase(BaseSchema):
    """Base employee-branch assignment schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    branch_id: UUID


class EmployeeBranchCreate(EmployeeBranchBase):
    """Schema for creating an employee-branch assignment"""
    pass


class EmployeeBranchInDB(EmployeeBranchBase):
    """Schema for employee-branch assignment in database"""
    id: UUID
    tenant_id: str
    assigned_at: datetime
    assigned_by: Optional[str] = None
    created_at: datetime


class EmployeeBranch(EmployeeBranchInDB):
    """Schema for employee-branch assignment response"""
    employee: Optional[EmployeeProfile] = None
    branch: Optional[Branch] = None


# Driver Profile schemas
class DriverProfileBase(BaseSchema):
    """Base driver profile schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    driver_code: Optional[str] = Field(None, max_length=50)  # Unique driver code for identification
    license_number: str = Field(..., min_length=2, max_length=50)
    license_type: str = Field(..., max_length=50)  # Increased from 20 to accommodate longer license types
    license_expiry: datetime
    license_issuing_authority: Optional[str] = Field(None, max_length=100)
    badge_number: Optional[str] = Field(None, max_length=50)
    badge_expiry: Optional[datetime] = None
    experience_years: int = Field(default=0, ge=0)
    preferred_vehicle_types: Optional[List[str]] = None
    current_status: str = Field(default="available", max_length=20)
    last_trip_date: Optional[datetime] = None
    total_trips: int = Field(default=0, ge=0)
    total_distance: float = Field(default=0, ge=0)
    average_rating: float = Field(default=0, ge=0, le=5)
    accident_count: int = Field(default=0, ge=0)
    traffic_violations: int = Field(default=0, ge=0)
    medical_fitness_certificate_date: Optional[datetime] = None
    police_verification_date: Optional[datetime] = None
    is_active: bool = True


class DriverProfileCreate(DriverProfileBase):
    """Schema for creating a driver profile"""
    pass


class DriverProfileUpdate(BaseSchema):
    """Schema for updating a driver profile"""
    driver_code: Optional[str] = Field(None, max_length=50)  # Unique driver code for identification
    license_number: Optional[str] = Field(None, min_length=2, max_length=50)
    license_type: Optional[str] = Field(None, max_length=50)  # Increased from 20 to match base schema
    license_expiry: Optional[datetime] = None
    license_issuing_authority: Optional[str] = Field(None, max_length=100)
    badge_number: Optional[str] = Field(None, max_length=50)
    badge_expiry: Optional[datetime] = None
    experience_years: Optional[int] = Field(None, ge=0)
    preferred_vehicle_types: Optional[List[str]] = None
    current_status: Optional[str] = Field(None, max_length=20)
    last_trip_date: Optional[datetime] = None
    total_trips: Optional[int] = Field(None, ge=0)
    total_distance: Optional[float] = Field(None, ge=0)
    average_rating: Optional[float] = Field(None, ge=0, le=5)
    accident_count: Optional[int] = Field(None, ge=0)
    traffic_violations: Optional[int] = Field(None, ge=0)
    medical_fitness_certificate_date: Optional[datetime] = None
    police_verification_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class DriverProfileInDB(DriverProfileBase):
    """Schema for driver profile in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class DriverProfile(DriverProfileInDB):
    """Schema for driver profile response"""
    employee: Optional[EmployeeProfile] = None


# Finance Manager Profile schemas
class FinanceManagerProfileBase(BaseSchema):
    """Base finance manager profile schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    can_approve_payments: bool = False
    max_approval_limit: float = Field(default=0, ge=0)
    managed_branches: Optional[List[str]] = None
    access_levels: Optional[Dict[str, Any]] = None
    is_active: bool = True


class FinanceManagerProfileCreate(FinanceManagerProfileBase):
    """Schema for creating a finance manager profile"""
    pass


class FinanceManagerProfileUpdate(BaseSchema):
    """Schema for updating a finance manager profile"""
    can_approve_payments: Optional[bool] = None
    max_approval_limit: Optional[float] = Field(None, ge=0)
    managed_branches: Optional[List[str]] = None
    access_levels: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class FinanceManagerProfileInDB(FinanceManagerProfileBase):
    """Schema for finance manager profile in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class FinanceManagerProfile(FinanceManagerProfileInDB):
    """Schema for finance manager profile response"""
    employee: Optional[EmployeeProfile] = None


# Branch Manager Profile schemas
class BranchManagerProfileBase(BaseSchema):
    """Base branch manager profile schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    managed_branch_id: UUID
    can_create_quotes: bool = True
    can_approve_discounts: bool = False
    max_discount_percentage: float = Field(default=0, ge=0, le=100)
    can_manage_inventory: bool = True
    can_manage_vehicles: bool = False
    staff_management_permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True


class BranchManagerProfileCreate(BranchManagerProfileBase):
    """Schema for creating a branch manager profile"""
    pass


class BranchManagerProfileUpdate(BaseSchema):
    """Schema for updating a branch manager profile"""
    managed_branch_id: Optional[UUID] = None
    can_create_quotes: Optional[bool] = None
    can_approve_discounts: Optional[bool] = None
    max_discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    can_manage_inventory: Optional[bool] = None
    can_manage_vehicles: Optional[bool] = None
    staff_management_permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class BranchManagerProfileInDB(BranchManagerProfileBase):
    """Schema for branch manager profile in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class BranchManagerProfile(BranchManagerProfileInDB):
    """Schema for branch manager profile response"""
    employee: Optional[EmployeeProfile] = None
    managed_branch: Optional[Branch] = None


# Logistics Manager Profile schemas
class LogisticsManagerProfileBase(BaseSchema):
    """Base logistics manager profile schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    managed_zones: Optional[List[str]] = None
    can_assign_drivers: bool = True
    can_approve_overtime: bool = False
    can_plan_routes: bool = True
    vehicle_management_permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True


class LogisticsManagerProfileCreate(LogisticsManagerProfileBase):
    """Schema for creating a logistics manager profile"""
    pass


class LogisticsManagerProfileUpdate(BaseSchema):
    """Schema for updating a logistics manager profile"""
    managed_zones: Optional[List[str]] = None
    can_assign_drivers: Optional[bool] = None
    can_approve_overtime: Optional[bool] = None
    can_plan_routes: Optional[bool] = None
    vehicle_management_permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class LogisticsManagerProfileInDB(LogisticsManagerProfileBase):
    """Schema for logistics manager profile in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class LogisticsManagerProfile(LogisticsManagerProfileInDB):
    """Schema for logistics manager profile response"""
    employee: Optional[EmployeeProfile] = None


# Employee Document schemas
class EmployeeDocumentBase(BaseSchema):
    """Base employee document schema"""
    employee_profile_id: str = Field(..., min_length=36, max_length=36)
    document_type: str = Field(..., max_length=50)
    document_name: str = Field(..., max_length=255)
    document_number: Optional[str] = Field(None, max_length=100)
    file_path: Optional[str] = Field(None, max_length=500)
    file_url: Optional[str] = Field(None, max_length=500)
    file_size: Optional[int] = Field(None, ge=0)
    file_type: Optional[str] = Field(None, max_length=50)
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    issuing_authority: Optional[str] = Field(None, max_length=100)
    is_verified: bool = False
    verified_by: Optional[str] = Field(None, min_length=36, max_length=36)
    verified_at: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: bool = True


class EmployeeDocumentCreate(EmployeeDocumentBase):
    """Schema for creating an employee document"""
    pass


class EmployeeDocumentUpdate(BaseSchema):
    """Schema for updating an employee document"""
    document_name: Optional[str] = Field(None, max_length=255)
    document_number: Optional[str] = Field(None, max_length=100)
    file_path: Optional[str] = Field(None, max_length=500)
    file_url: Optional[str] = Field(None, max_length=500)
    file_size: Optional[int] = Field(None, ge=0)
    file_type: Optional[str] = Field(None, max_length=50)
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    issuing_authority: Optional[str] = Field(None, max_length=100)
    is_verified: Optional[bool] = None
    verified_by: Optional[str] = Field(None, min_length=36, max_length=36)
    verified_at: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None


class EmployeeDocumentInDB(EmployeeDocumentBase):
    """Schema for employee document in database"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class EmployeeDocument(EmployeeDocumentInDB):
    """Schema for employee document response"""
    employee: Optional[EmployeeProfile] = None


# User Management Response schemas
class UserManagementResponse(BaseSchema):
    """Schema for user management operations"""
    user_id: str
    employee_id: str
    status: str
    message: str


class UserPasswordChange(BaseSchema):
    """Schema for changing user password"""
    current_password: Optional[str] = None  # Required if changing own password
    new_password: str = Field(..., min_length=8, max_length=100)


# Generic response schemas
class PaginatedResponse(BaseSchema):
    """Schema for paginated responses"""
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int


# Enhanced Profile Management Schemas

class ProfileCompletionResponse(BaseSchema):
    """Schema for profile completion percentage response"""
    profile_id: str
    profile_type: str  # employee, driver, finance_manager, branch_manager, logistics_manager
    completion_percentage: float = Field(..., ge=0, le=100)
    completed_sections: List[str]
    missing_sections: List[str]
    total_sections: int
    last_updated: datetime


class ProfileSearchParams(BaseSchema):
    """Schema for profile search parameters"""
    query: Optional[str] = Field(None, max_length=100)
    profile_types: Optional[List[str]] = None
    branches: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    status: Optional[List[str]] = None
    is_active: Optional[bool] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    include_documents: bool = False
    include_ratings: bool = False
    sort_by: str = Field(default="created_at", max_length=50)
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class ProfileSearchResponse(BaseSchema):
    """Schema for profile search response"""
    profiles: List[Dict[str, Any]]
    total: int
    page: int
    per_page: int
    pages: int
    filters_applied: Dict[str, Any]


class ProfileExportParams(BaseSchema):
    """Schema for profile export parameters"""
    profile_types: Optional[List[str]] = None
    branches: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    include_inactive: bool = False
    include_documents: bool = False
    export_format: str = Field(default="csv", pattern="^(csv|xlsx|json)$")
    fields: Optional[List[str]] = None  # Specific fields to export


class BulkProfileOperation(BaseSchema):
    """Schema for bulk profile operations"""
    profile_ids: List[str] = Field(..., min_items=1, max_items=100)
    operation: str = Field(..., pattern="^(activate|deactivate|delete|export)$")
    operation_params: Optional[Dict[str, Any]] = None


class BulkProfileOperationResponse(BaseSchema):
    """Schema for bulk profile operation response"""
    operation_id: str
    total_profiles: int
    successful: int
    failed: int
    failed_ids: List[str]
    errors: List[Dict[str, Any]]
    started_at: datetime
    completed_at: Optional[datetime] = None


class DocumentReorder(BaseSchema):
    """Schema for document reordering"""
    document_orders: List[Dict[str, Any]] = Field(..., min_items=1)
    # Each item should have: {"document_id": str, "order": int}


class DocumentExpiryNotification(BaseSchema):
    """Schema for document expiry notifications"""
    document_id: str
    document_name: str
    document_type: str
    employee_name: str
    employee_id: str
    expiry_date: datetime
    days_until_expiry: int
    notification_type: str = Field(..., pattern="^(warning|critical|expired)$")
    notified_at: datetime


class ProfileStats(BaseSchema):
    """Schema for profile statistics dashboard"""
    total_profiles: int
    active_profiles: int
    inactive_profiles: int
    profiles_by_type: Dict[str, int]
    profiles_by_branch: Dict[str, int]
    profiles_by_department: Dict[str, int]
    recent_additions: int  # Added in last 30 days
    documents_total: int
    documents_verified: int
    documents_pending: int
    documents_expiring_soon: int  # Within 30 days
    documents_expired: int
    avg_completion_percentage: float


class ProfileAuditLog(BaseSchema):
    """Schema for profile audit trail"""
    id: str
    profile_id: str
    profile_type: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: str
    changed_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ProfileChangeHistory(BaseSchema):
    """Schema for profile change history"""
    profile_id: str
    profile_type: str
    changes: List[ProfileAuditLog]


# Audit Log schemas
class AuditLogCreate(BaseSchema):
    """Schema for creating audit log (called by other services)"""
    tenant_id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    module: str
    entity_type: str
    entity_id: str
    description: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    approval_status: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    service_name: str


class AuditLogResponse(BaseSchema):
    """Schema for audit log response"""
    id: UUID
    tenant_id: str
    user_id: str
    user_name: Optional[str]
    user_email: Optional[str]
    user_role: Optional[str]
    action: str
    module: str
    entity_type: str
    entity_id: str
    description: str
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    from_status: Optional[str]
    to_status: Optional[str]
    approval_status: Optional[str]
    reason: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    service_name: Optional[str]
    created_at: datetime


class AuditLogQueryParams(BaseSchema):
    """Schema for audit log query parameters"""
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    user_id: Optional[str] = None
    module: Optional[str] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)


class AuditLogListResponse(BaseSchema):
    """Schema for paginated audit log list"""
    items: List[AuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AuditLogSummaryResponse(BaseSchema):
    """Schema for audit log summary statistics"""
    total_logs: int
    unique_users: int
    unique_modules: List[Dict[str, Any]]
    unique_actions: List[Dict[str, Any]]
    logs_by_module: Dict[str, int]
    logs_by_action: Dict[str, int]
    logs_by_date: List[Dict[str, Any]]
    top_users: List[Dict[str, Any]]


# Update forward references
ProductCategory.model_rebuild()
CompanyRole.model_rebuild()
EmployeeProfile.model_rebuild()