"""
Database configuration for Orders Service (based on auth service)
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, Numeric, UUID, Enum, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.config_local import OrdersSettings

settings = OrdersSettings()

# Create async engine for orders database
engine = create_async_engine(
    settings.get_database_url(settings.POSTGRES_ORDERS_DB),
    echo=settings.LOG_LEVEL.lower() == "debug",
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=20,
    max_overflow=30,
)

# Create async engine for company database (for centralized audit_logs)
company_engine = create_async_engine(
    settings.get_database_url(settings.POSTGRES_COMPANY_DB),
    echo=False,  # Don't echo SQL for audit log writes
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
)

# Create session factory for orders database
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Create session factory for company database (for audit logs)
CompanyAsyncSessionLocal = async_sessionmaker(
    company_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()

# Dependency to get DB session


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_company_db_session():
    """Get async session for company database (for centralized audit_logs)"""
    async with CompanyAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def write_audit_log_to_company(
    entity_id: str,
    entity_type: str,
    module: str,
    action: str,
    from_status: str = None,
    to_status: str = None,
    description: str = None,
    user_id: str = None,
    user_name: str = None,
    user_email: str = None,
    user_role: str = None,
    tenant_id: str = None,
):
    """
    Write audit log to centralized audit_logs table in company_db

    Args:
        entity_id: ID of the entity (order_id, trip_id, etc.)
        entity_type: Type of entity ('order', 'trip', etc.)
        module: Module name ('orders', 'trips', etc.)
        action: Action performed ('create', 'status_change', etc.)
        from_status: Previous status (for status changes)
        to_status: New status (for status changes)
        description: Human-readable description
        user_id: ID of the user who performed the action
        user_name: Name of the user
        user_email: Email of the user
        user_role: Role of the user
        tenant_id: Tenant ID
    """
    async with CompanyAsyncSessionLocal() as session:
        query = text("""
            INSERT INTO audit_logs (
                tenant_id, user_id, user_name, user_email, user_role,
                action, module, entity_type, entity_id,
                description, from_status, to_status, created_at
            ) VALUES (
                :tenant_id, :user_id, :user_name, :user_email, :user_role,
                :action, :module, :entity_type, :entity_id,
                :description, :from_status, :to_status, NOW()
            )
        """)

        await session.execute(query, {
            "tenant_id": tenant_id or "",
            "user_id": user_id or "",
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "action": action,
            "module": module,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "description": description or f"{action} {entity_type} {entity_id}",
            "from_status": from_status,
            "to_status": to_status
        })
        await session.commit()
