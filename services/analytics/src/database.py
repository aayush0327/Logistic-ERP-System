"""
Analytics Service Database Connections
Manages connections to multiple databases for analytics queries
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, JSON, Text, Integer
from datetime import datetime
from typing import Optional

from src.config import settings


# Base class for models
class Base(DeclarativeBase):
    """Base class for all database models"""
    pass


# Audit Log Model (from Company DB)
class AuditLog(Base):
    """Audit Log model for querying status changes"""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    user_name: Mapped[Optional[str]] = mapped_column(String)
    user_email: Mapped[Optional[str]] = mapped_column(String)
    user_role: Mapped[Optional[str]] = mapped_column(String)
    action: Mapped[str] = mapped_column(String, index=True)
    module: Mapped[str] = mapped_column(String, index=True)
    entity_type: Mapped[str] = mapped_column(String, index=True)
    entity_id: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(Text)
    old_values: Mapped[Optional[dict]] = mapped_column(JSON)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON)
    from_status: Mapped[Optional[str]] = mapped_column(String)
    to_status: Mapped[Optional[str]] = mapped_column(String)
    approval_status: Mapped[Optional[str]] = mapped_column(String)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String)
    user_agent: Mapped[Optional[str]] = mapped_column(String)
    service_name: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)


# Driver Profile Model (from Company DB)
class DriverProfile(Base):
    """Driver Profile model for current driver status"""
    __tablename__ = "driver_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    current_status: Mapped[str] = mapped_column(String, index=True)
    driver_code: Mapped[Optional[str]] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(default=True)


# Vehicle Model (from Company DB)
class Vehicle(Base):
    """Vehicle model for current truck status"""
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    plate_number: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)


# Branch Model (from Company DB) - for branch reference lookups
class Branch(Base):
    """Branch model for branch information"""
    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    code: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(default=True)


# Order Model (from Orders DB) - for current status queries
class Order(Base):
    """Order model for current order status"""
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    order_number: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)


# Trip Model (from TMS DB) - for current status queries
class Trip(Base):
    """Trip model for current trip status"""
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    company_id: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)


# Create engines for each database
company_engine = create_async_engine(
    settings.COMPANY_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

orders_engine = create_async_engine(
    settings.ORDERS_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

tms_engine = create_async_engine(
    settings.TMS_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)


# Create session makers for each database
CompanySessionLocal = async_sessionmaker(
    company_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

OrdersSessionLocal = async_sessionmaker(
    orders_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

TMSSessionLocal = async_sessionmaker(
    tms_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Dependency functions for FastAPI
async def get_company_db():
    """Get company database session"""
    async with CompanySessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_orders_db():
    """Get orders database session"""
    async with OrdersSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_tms_db():
    """Get TMS database session"""
    async with TMSSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Combined database session for queries that need multiple databases
class MultiDBSession:
    """Holder for multiple database sessions"""
    def __init__(
        self,
        company: AsyncSession,
        orders: AsyncSession = None,
        tms: AsyncSession = None,
    ):
        self.company = company
        self.orders = orders
        self.tms = tms


async def get_multi_db():
    """Get multiple database sessions for analytics queries"""
    async with CompanySessionLocal() as company_session:
        async with OrdersSessionLocal() as orders_session:
            async with TMSSessionLocal() as tms_session:
                yield MultiDBSession(
                    company=company_session,
                    orders=orders_session,
                    tms=tms_session,
                )
