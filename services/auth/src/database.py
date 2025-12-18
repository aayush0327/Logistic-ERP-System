"""
Database configuration for Auth Service
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.config_local import AuthSettings

settings = AuthSettings()

# Create async engine
engine = create_async_engine(
    settings.get_database_url(settings.POSTGRES_AUTH_DB).replace("postgresql://", "postgresql+asyncpg://"),
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


# Models
class Tenant(Base):
    """Tenant model for multi-tenancy"""
    __tablename__ = "tenants"

    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=True)
    settings = Column(Text, nullable=True)  # JSON string for tenant settings
    is_active = Column(Boolean, default=True)
    admin_id = Column(String, ForeignKey("users.id"), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - specify foreign_keys to avoid ambiguity
    users = relationship("User", back_populates="tenant", foreign_keys="User.tenant_id")
    roles = relationship("Role", back_populates="tenant")
    admin = relationship("User", backref="admin_of_tenant", foreign_keys=[admin_id])


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OIDC users
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=True)  # Nullable for super admins
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)  # Changed to Integer

    # Relationships
    tenant = relationship("Tenant", back_populates="users", foreign_keys=[tenant_id])
    role = relationship("Role", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class Role(Base):
    """Role model for RBAC"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)  # Changed to Integer with auto-increment
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)  # System roles cannot be deleted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="roles")
    users = relationship("User", back_populates="role")
    permissions = relationship(
        "Permission",
        secondary="role_permissions",
        back_populates="roles"
    )


class Permission(Base):
    """Permission model"""
    __tablename__ = "permissions"

    id = Column(String, primary_key=True)
    resource = Column(String(100), nullable=False)  # e.g., "orders", "users"
    action = Column(String(50), nullable=False)  # e.g., "create", "read", "update", "delete"
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    roles = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions"
    )


# Association table for many-to-many relationship between roles and permissions
class RolePermission(Base):
    """Association table for role-permission relationships"""
    __tablename__ = "role_permissions"

    id = Column(String, primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id = Column(String, ForeignKey("permissions.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    """Refresh token model"""
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    # Foreign Keys
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


# Row Level Security
def enable_row_level_security():
    """Enable row level security for multi-tenancy"""
    # This would be implemented using PostgreSQL RLS policies
    pass