"""
Database configuration for Company Service
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, ENUM as SQLEnum
import enum
import uuid

from src.config_local import CompanySettings

settings = CompanySettings()

# Create async engine
engine = create_async_engine(
    settings.get_database_url(settings.POSTGRES_COMPANY_DB).replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.LOG_LEVEL.lower() == "debug",
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=20,
    max_overflow=30,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Create declarative base
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Enums
class BusinessType(str, enum.Enum):
    """Business type enum"""
    INDIVIDUAL = "individual"
    SMALL_BUSINESS = "small_business"
    CORPORATE = "corporate"
    GOVERNMENT = "government"


class VehicleType(str, enum.Enum):
    """Vehicle type enum"""
    MOTORCYCLE = "motorcycle"
    VAN = "van"
    TRUCK_SMALL = "truck_small"
    TRUCK_MEDIUM = "truck_medium"
    TRUCK_LARGE = "truck_large"
    TRAILER = "trailer"


class VehicleStatus(str, enum.Enum):
    """Vehicle status enum"""
    AVAILABLE = "available"
    ASSIGNED = "assigned"  # Assigned to a trip but not yet started
    ON_TRIP = "on_trip"
    MAINTENANCE = "maintenance"
    OUT_OF_SERVICE = "out_of_service"


class ServiceType(enum.Enum):
    """Service type enum"""
    EXPRESS = "express"
    STANDARD = "standard"
    ECONOMY = "economy"
    FREIGHT = "freight"


class WeightType(str, enum.Enum):
    """Weight type enum for products"""
    FIXED = "fixed"
    VARIABLE = "variable"


# Models
class Branch(Base):
    """Branch model"""
    __tablename__ = "branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    phone = Column(String(20))
    email = Column(String(100))
    manager_id = Column(String)  # Will be foreign key to auth service
    created_by = Column(String)  # Will be foreign key to auth service (user who created it)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships


class BusinessTypeModel(Base):
    """Business Type model - dynamic business types per tenant"""
    __tablename__ = "business_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customers = relationship("Customer", back_populates="business_type_relation")


class VehicleTypeModel(Base):
    """Vehicle Type model - dynamic vehicle types per tenant"""
    __tablename__ = "vehicle_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vehicles = relationship("Vehicle", back_populates="vehicle_type_relation")


class Customer(Base):
    """Customer model"""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    # New foreign key to business_types table
    business_type_id = Column(UUID(as_uuid=True), ForeignKey("business_types.id", ondelete="SET NULL"))
    # Keep old enum for backward compatibility during migration
    business_type = Column(
        SQLEnum(
            BusinessType,
            name="business_type",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        )
    )
    credit_limit = Column(Float, default=0)
    pricing_tier = Column(String(20), default="standard")
    is_active = Column(Boolean, default=True)
    available_for_all_branches = Column(Boolean, default=True)
    # Marketing person contact details
    marketing_person_name = Column(String(100))
    marketing_person_phone = Column(String(20))
    marketing_person_email = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    business_type_relation = relationship("BusinessTypeModel", back_populates="customers")
    business_types = relationship("CustomerBusinessType", back_populates="customer", cascade="all, delete-orphan")
    branches = relationship("CustomerBranch", back_populates="customer")

    @property
    def business_type_list(self):
        """Flatten business_types relationship to return list of BusinessTypeModel objects"""
        return [cbt.business_type for cbt in self.business_types if cbt.business_type]


class CustomerBusinessType(Base):
    """Junction table for customer-business type many-to-many relationship"""
    __tablename__ = "customer_business_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    business_type_id = Column(UUID(as_uuid=True), ForeignKey("business_types.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String)  # User ID who created the relationship

    # Relationships
    customer = relationship("Customer", back_populates="business_types")
    business_type = relationship("BusinessTypeModel")


class Vehicle(Base):
    """Vehicle model"""
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    plate_number = Column(String(20), unique=True, nullable=False)
    make = Column(String(50))
    model = Column(String(50))
    year = Column(Integer)
    # New foreign key to vehicle_types table
    vehicle_type_id = Column(UUID(as_uuid=True), ForeignKey("vehicle_types.id", ondelete="SET NULL"))
    # Keep old enum for backward compatibility during migration - now nullable
    vehicle_type = Column(
        SQLEnum(
            VehicleType,
            name="vehicle_type",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        ),
        nullable=True  # Make nullable to support new vehicle_type_id
    )
    capacity_weight = Column(Float)  # in kg
    capacity_volume = Column(Float)  # in cubic meters
    status = Column(
        SQLEnum(
            VehicleStatus,
            name="vehicle_status",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        ),
        nullable=False
    )
    last_maintenance = Column(DateTime(timezone=True))
    next_maintenance = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    available_for_all_branches = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vehicle_type_relation = relationship("VehicleTypeModel", back_populates="vehicles")
    branches = relationship("VehicleBranch", back_populates="vehicle")


class ProductCategory(Base):
    """Product category model"""
    __tablename__ = "product_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Self-referential relationship
    parent = relationship("ProductCategory", remote_side=[id], back_populates="children")
    children = relationship("ProductCategory", cascade="all, delete-orphan", back_populates="parent")


class Product(Base):
    """Product model"""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    unit_price = Column(Float, nullable=False)
    special_price = Column(Float)  # For specific customers or promotions

    # Weight configuration - supports fixed and variable weight types
    weight_type = Column(
        SQLEnum(
            WeightType,
            name="weight_type",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        ),
        default=WeightType.FIXED,
        nullable=False
    )
    weight = Column(Float)  # Deprecated - use fixed_weight for fixed type products
    fixed_weight = Column(Float)  # For FIXED weight type - standard weight
    weight_unit = Column(String(20), default="kg")  # Weight unit (kg, lb, g, etc.)

    # Dimensions
    length = Column(Float)  # in cm
    width = Column(Float)   # in cm
    height = Column(Float)  # in cm
    volume = Column(Float)  # in cubic meters (calculated)

    handling_requirements = Column(JSON)  # ["fragile", "hazardous", "refrigerated"]
    min_stock_level = Column(Integer, default=0)
    max_stock_level = Column(Integer)
    current_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    available_for_all_branches = Column(Boolean, default=True)  # New field
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branches = relationship("ProductBranch", back_populates="product")
    category = relationship("ProductCategory")


class ProductBranch(Base):
    """Junction table for product-branch relationships"""
    __tablename__ = "product_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"))
    tenant_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    product = relationship("Product", back_populates="branches")
    branch = relationship("Branch")


class CustomerBranch(Base):
    """Junction table for customer-branch relationships"""
    __tablename__ = "customer_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"))
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"))
    tenant_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="branches")
    branch = relationship("Branch")


class VehicleBranch(Base):
    """Junction table for vehicle-branch relationships"""
    __tablename__ = "vehicle_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"))
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"))
    tenant_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    vehicle = relationship("Vehicle", back_populates="branches")
    branch = relationship("Branch")


class PricingRule(Base):
    """Pricing rule model"""
    __tablename__ = "pricing_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    name = Column(String(100), nullable=False)
    service_type = Column(Enum(ServiceType))
    zone_origin = Column(String(50))
    zone_destination = Column(String(50))
    base_price = Column(Float, nullable=False)
    price_per_km = Column(Float, default=0)
    price_per_kg = Column(Float, default=0)
    fuel_surcharge_percent = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ServiceZone(Base):
    """Service zone model"""
    __tablename__ = "service_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    coverage_areas = Column(JSON)  # List of postal codes or coordinates
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# User Role Management Models

class CompanyRole(Base):
    """Company role model"""
    __tablename__ = "company_roles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(255), nullable=False)
    role_name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    permissions = Column(JSON)  # Store role permissions as JSON
    is_active = Column(Boolean, default=True)
    is_system_role = Column(Boolean, default=False)  # For predefined roles
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # employees relationship removed - employee_profiles now use auth service roles
    # invitations relationship removed - invitations now use auth service roles


class UserInvitation(Base):
    """User invitation model"""
    __tablename__ = "user_invitations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    invitation_token = Column(String(255), unique=True, nullable=False)
    # Now stores auth service role ID as string (no FK constraint)
    role_id = Column(String(50), nullable=True)  # Changed from String(36) with FK to company_roles
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"))
    invited_by = Column(String(255), nullable=False)  # User ID who sent the invitation
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True))
    accepted_by = Column(String(255))  # User ID who accepted
    status = Column(String(20), default='pending')  # pending, accepted, expired, revoked
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # role relationship removed - now using auth service roles (role_id stores auth role ID as string)
    branch = relationship("Branch")


class EmployeeProfile(Base):
    """Employee profile model"""
    __tablename__ = "employee_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(255), nullable=False)
    user_id = Column(String(255), unique=True, nullable=False)  # Reference to auth service users table
    employee_code = Column(String(20), unique=True)
    role_id = Column(String(50), nullable=True)  # Now nullable and stores auth service role ID as string
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"))
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    email = Column(String(255))
    date_of_birth = Column(DateTime(timezone=True))
    gender = Column(String(10))  # male, female, other
    blood_group = Column(String(5))
    marital_status = Column(String(20))  # single, married, divorced, widowed
    nationality = Column(String(50), default='India')
    emergency_contact_name = Column(String(100))
    emergency_contact_phone = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    country = Column(String(50), default='India')
    hire_date = Column(DateTime(timezone=True))
    employment_type = Column(String(20), default='permanent')  # permanent, contract, probation
    department = Column(String(50))
    designation = Column(String(100))
    reports_to = Column(String(36), ForeignKey("employee_profiles.id"))  # Self-reference to manager's employee profile
    salary = Column(Float)
    bank_account_number = Column(String(50))
    bank_name = Column(String(100))
    bank_ifsc = Column(String(20))
    pan_number = Column(String(20))
    aadhar_number = Column(String(20))
    passport_number = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # role relationship removed - now using auth service roles (role_id stores auth role ID as string)
    branch = relationship("Branch")
    documents = relationship("EmployeeDocument", back_populates="employee")
    assigned_branches = relationship("EmployeeBranch", back_populates="employee", cascade="all, delete-orphan")
    driver_profile = relationship("DriverProfile", back_populates="employee", uselist=False)
    finance_manager_profile = relationship("FinanceManagerProfile", back_populates="employee", uselist=False)
    branch_manager_profile = relationship("BranchManagerProfile", back_populates="employee", uselist=False)
    logistics_manager_profile = relationship("LogisticsManagerProfile", back_populates="employee", uselist=False)
    manager = relationship("EmployeeProfile", foreign_keys=[reports_to], remote_side=[id])
    subordinates = relationship("EmployeeProfile", foreign_keys=[reports_to], back_populates="manager")


class DriverProfile(Base):
    """Driver profile model"""
    __tablename__ = "driver_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(255), nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    license_type = Column(String(50), nullable=False)  # e.g., Light Motor Vehicle (LMV), Heavy Motor Vehicle (HMV)
    license_expiry = Column(DateTime(timezone=True), nullable=False)
    license_issuing_authority = Column(String(100))
    badge_number = Column(String(50))
    badge_expiry = Column(DateTime(timezone=True))
    experience_years = Column(Integer, default=0)
    preferred_vehicle_types = Column(JSON)  # Array of preferred vehicle types
    current_status = Column(String(20), default='available')  # available, assigned, on_trip, off_duty, on_leave, suspended
    last_trip_date = Column(DateTime(timezone=True))
    total_trips = Column(Integer, default=0)
    total_distance = Column(Float, default=0)  # Total kilometers driven
    average_rating = Column(Float, default=0.00)  # 0-5 scale
    accident_count = Column(Integer, default=0)
    traffic_violations = Column(Integer, default=0)
    medical_fitness_certificate_date = Column(DateTime(timezone=True))
    police_verification_date = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="driver_profile")


class FinanceManagerProfile(Base):
    """Finance manager profile model"""
    __tablename__ = "finance_manager_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(255), nullable=False)
    can_approve_payments = Column(Boolean, default=False)
    max_approval_limit = Column(Float, default=0)
    managed_branches = Column(JSON)  # Array of branch IDs this manager oversees
    access_levels = Column(JSON)  # Define what financial modules they can access
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="finance_manager_profile")


class BranchManagerProfile(Base):
    """Branch manager profile model"""
    __tablename__ = "branch_manager_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(255), nullable=False)
    managed_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    can_create_quotes = Column(Boolean, default=True)
    can_approve_discounts = Column(Boolean, default=False)
    max_discount_percentage = Column(Float, default=0.00)
    can_manage_inventory = Column(Boolean, default=True)
    can_manage_vehicles = Column(Boolean, default=False)
    staff_management_permissions = Column(JSON)  # Define what staff operations they can perform
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="branch_manager_profile")
    managed_branch = relationship("Branch")


class LogisticsManagerProfile(Base):
    """Logistics manager profile model"""
    __tablename__ = "logistics_manager_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(255), nullable=False)
    managed_zones = Column(JSON)  # Array of zones or areas they manage
    can_assign_drivers = Column(Boolean, default=True)
    can_approve_overtime = Column(Boolean, default=False)
    can_plan_routes = Column(Boolean, default=True)
    vehicle_management_permissions = Column(JSON)  # Define vehicle operations they can perform
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="logistics_manager_profile")


class EmployeeDocument(Base):
    """Employee document model"""
    __tablename__ = "employee_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(255), nullable=False)
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)  # passport, license, aadhar, pan, contract, resume
    document_name = Column(String(255), nullable=False)
    document_number = Column(String(100))
    file_path = Column(String(500))  # Path to stored document
    file_url = Column(String(500))   # URL if stored in cloud storage
    file_size = Column(Integer)
    file_type = Column(String(50))   # pdf, jpg, png
    issue_date = Column(DateTime(timezone=True))
    expiry_date = Column(DateTime(timezone=True))
    issuing_authority = Column(String(100))
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(36))  # Employee profile ID of verifier
    verified_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="documents")


class EmployeeBranch(Base):
    """Employee-branch junction table for many-to-many relationship"""
    __tablename__ = "employee_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(255), nullable=False)
    employee_profile_id = Column(String(36), ForeignKey("employee_profiles.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_by = Column(String(255))  # User ID who made the assignment
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    employee = relationship("EmployeeProfile", back_populates="assigned_branches")
    branch = relationship("Branch")


class AuditLog(Base):
    """Audit Log model - centralized audit tracking for all company operations"""
    __tablename__ = "audit_logs"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Who performed the action
    user_id = Column(String(255), nullable=False, index=True, comment="User who performed the action")
    user_name = Column(String(200), comment="Name of the user (denormalized for query)")
    user_email = Column(String(255), comment="Email of the user (denormalized for query)")
    user_role = Column(String(50), comment="Role of the user")

    # What was done
    action = Column(String(50), nullable=False, index=True, comment="Action performed: create, update, delete, status_change, approve, reject, etc.")
    module = Column(String(50), nullable=False, index=True, comment="Module: orders, trips, customers, vehicles, etc.")
    entity_type = Column(String(50), nullable=False, index=True, comment="Type of entity: order, trip, customer, etc.")
    entity_id = Column(String(255), nullable=False, index=True, comment="ID of the affected entity")

    # Action details
    description = Column(Text, nullable=False, comment="Human-readable description of the action")
    old_values = Column(JSON, comment="Previous values (for updates)")
    new_values = Column(JSON, comment="New values (for updates/creates)")

    # Status change specific
    from_status = Column(String(50), comment="Previous status")
    to_status = Column(String(50), comment="New status")

    # Approval specific
    approval_status = Column(String(20), comment="approved/rejected for approval actions")
    reason = Column(Text, comment="Reason for rejection/status change")

    # Metadata
    ip_address = Column(String(50), comment="IP address of the user")
    user_agent = Column(String(500), comment="Browser/client info")
    service_name = Column(String(50), comment="Service that created this log (orders, tms, driver, etc.)")

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)