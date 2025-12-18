"""
Pydantic schemas for Auth Service
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(from_attributes=True)


# Tenant schemas
class TenantBase(BaseSchema):
    """Base tenant schema"""
    name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    settings: Optional[str] = None  # JSON string
    is_active: bool = True


class TenantCreate(TenantBase):
    """Schema for creating a tenant"""
    pass


class TenantUpdate(BaseSchema):
    """Schema for updating a tenant"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    settings: Optional[str] = None
    is_active: Optional[bool] = None


class TenantInDB(TenantBase):
    """Schema for tenant in database"""
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Tenant(TenantInDB):
    """Schema for tenant response"""
    pass


# User schemas
class UserBase(BaseSchema):
    """Base user schema"""
    email: EmailStr
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a user"""
    password: str = Field(..., min_length=8)
    tenant_id: Optional[str] = None  # Optional for super admins
    role_id: int


class UserUpdate(BaseSchema):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    role_id: Optional[int] = None


class UserUpdatePassword(BaseSchema):
    """Schema for updating user password"""
    current_password: str
    new_password: str = Field(..., min_length=8)


class UserInDB(UserBase):
    """Schema for user in database"""
    id: str
    tenant_id: Optional[str] = None  # Nullable for super admins
    role_id: int
    is_superuser: bool = False
    last_login: Optional[datetime] = None
    login_attempts: int = 0
    locked_until: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class User(UserInDB):
    """Schema for user response"""
    tenant: Optional[Tenant] = None


# Role schemas
class RoleBase(BaseSchema):
    """Base role schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_system: bool = False


class RoleCreate(RoleBase):
    """Schema for creating a role"""
    tenant_id: str
    permission_ids: Optional[List[str]] = []


class RoleUpdate(BaseSchema):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permission_ids: Optional[List[str]] = []


class RoleInDB(RoleBase):
    """Schema for role in database"""
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class Role(RoleInDB):
    """Schema for role response"""
    permissions: Optional[List["Permission"]] = []


# Permission schemas
class PermissionBase(BaseSchema):
    """Base permission schema"""
    resource: str = Field(..., min_length=1, max_length=100)
    action: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    """Schema for creating a permission"""
    pass


class PermissionInDB(PermissionBase):
    """Schema for permission in database"""
    id: str
    created_at: datetime


class Permission(PermissionInDB):
    """Schema for permission response"""
    pass


# Auth schemas
class LoginRequest(BaseSchema):
    """Schema for login request"""
    email: EmailStr
    password: str


class LoginResponse(BaseSchema):
    """Schema for login response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


class RefreshTokenRequest(BaseSchema):
    """Schema for refresh token request"""
    refresh_token: str


class TokenData(BaseSchema):
    """Schema for token data"""
    user_id: str
    tenant_id: Optional[str] = None  # Nullable for super admins
    role_id: int
    permissions: List[str]
    exp: Optional[datetime] = None


class PasswordResetRequest(BaseSchema):
    """Schema for password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    """Schema for password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8)


class PasswordChange(BaseSchema):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(..., min_length=8)


# Update forward references
Role.model_rebuild()
