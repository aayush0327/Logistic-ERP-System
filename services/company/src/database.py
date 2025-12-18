"""
Database configuration for Company Service
"""
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


async def get_db():
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
    ON_TRIP = "on_trip"
    MAINTENANCE = "maintenance"
    OUT_OF_SERVICE = "out_of_service"


class ServiceType(enum.Enum):
    """Service type enum"""
    EXPRESS = "express"
    STANDARD = "standard"
    ECONOMY = "economy"
    FREIGHT = "freight"


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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customers = relationship("Customer", back_populates="home_branch")
    vehicles = relationship("Vehicle", back_populates="branch")


class Customer(Base):
    """Customer model"""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    home_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"))
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    home_branch = relationship("Branch", back_populates="customers")


class Vehicle(Base):
    """Vehicle model"""
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False)  # Will be foreign key to auth service
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"))
    plate_number = Column(String(20), unique=True, nullable=False)
    make = Column(String(50))
    model = Column(String(50))
    year = Column(Integer)
    vehicle_type = Column(
        SQLEnum(
            VehicleType,
            name="vehicle_type",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        )
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch", back_populates="vehicles")


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
    parent = relationship("ProductCategory", remote_side=[id])
    children = relationship("ProductCategory", cascade="all, delete-orphan")


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
    weight = Column(Float)  # in kg
    length = Column(Float)  # in cm
    width = Column(Float)   # in cm
    height = Column(Float)  # in cm
    volume = Column(Float)  # in cubic meters (calculated)
    handling_requirements = Column(JSON)  # ["fragile", "hazardous", "refrigerated"]
    min_stock_level = Column(Integer, default=0)
    max_stock_level = Column(Integer)
    current_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    category = relationship("ProductCategory")


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