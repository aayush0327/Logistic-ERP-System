"""
FastAPI dependencies for authentication and authorization
"""
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db, User
from .auth import verify_token
from .schemas import TokenData
from .services.user_service import UserService
from .config_local import AuthSettings

settings = AuthSettings()

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """Get current user from JWT token"""
    token = credentials.credentials
    token_data = verify_token(token)
    return token_data


async def get_current_user(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from database"""
    # Retrieve user from database
    user = await UserService.get_by_id(db, token_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update token data with current permissions
    token_data.permissions = await UserService.get_user_permissions(db, token_data.user_id)

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get current superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def require_permissions(required_permissions: List[str]):
    """Dependency to require specific permissions"""
    async def permission_checker(
        token_data: TokenData = Depends(get_current_user_token)
    ) -> TokenData:
        user_permissions = set(token_data.permissions)
        required = set(required_permissions)

        # Check if user has all required permissions
        if not required.issubset(user_permissions):
            missing = required - user_permissions
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {', '.join(missing)}"
            )

        return token_data

    return permission_checker


def require_any_permission(any_permissions: List[str]):
    """Dependency to require any of the specified permissions"""
    async def permission_checker(
        token_data: TokenData = Depends(get_current_user_token)
    ) -> TokenData:
        user_permissions = set(token_data.permissions)
        required = set(any_permissions)

        # Check if user has any of the required permissions
        if not user_permissions.intersection(required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these permissions: {', '.join(any_permissions)}"
            )

        return token_data

    return permission_checker


def require_tenant_access(tenant_id: Optional[str] = None):
    """Dependency to require access to specific tenant"""
    async def tenant_checker(
        token_data: TokenData = Depends(get_current_user_token)
    ) -> TokenData:
        # If no specific tenant required, check if user can access their own tenant
        if not tenant_id:
            return token_data

        # Check if user belongs to the requested tenant
        if token_data.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this tenant"
            )

        return token_data

    return tenant_checker


class PermissionChecker:
    """Utility class for checking permissions"""

    @staticmethod
    def can_access_resource(
        user_permissions: List[str],
        resource: str,
        action: str
    ) -> bool:
        """Check if user can perform action on resource"""
        required_permission = f"{resource}:{action}"
        return required_permission in user_permissions

    @staticmethod
    def can_manage_tenant(
        user_permissions: List[str],
        tenant_id: str,
        user_tenant_id: str,
        is_superuser: bool = False
    ) -> bool:
        """Check if user can manage tenant"""
        if is_superuser:
            return True

        # User can manage their own tenant
        if tenant_id == user_tenant_id:
            return "tenants:manage_own" in user_permissions

        # User can manage any tenant
        return "tenants:manage_all" in user_permissions

    @staticmethod
    def can_access_user_data(
        user_permissions: List[str],
        target_user_id: str,
        current_user_id: str,
        is_superuser: bool = False
    ) -> bool:
        """Check if user can access another user's data"""
        if is_superuser:
            return True

        # User can access their own data
        if target_user_id == current_user_id:
            return True

        # User can read any user data
        return "users:read_all" in user_permissions


# Common permission dependencies
RequireUserRead = require_permissions(["users:read"])
RequireUserWrite = require_permissions(["users:write"])
RequireUserDelete = require_permissions(["users:delete"])

RequireTenantRead = require_permissions(["tenants:read"])
RequireTenantWrite = require_permissions(["tenants:write"])
RequireTenantDelete = require_permissions(["tenants:delete"])

RequireRoleRead = require_permissions(["roles:read"])
RequireRoleWrite = require_permissions(["roles:write"])
RequireRoleDelete = require_permissions(["roles:delete"])

RequirePermissionRead = require_permissions(["permissions:read"])
RequirePermissionWrite = require_permissions(["permissions:write"])

# Admin dependencies
RequireAdminAccess = require_any_permission([
    "admin:access",
    "tenants:manage_all",
    "users:manage_all"
])

# Self-service dependencies
def require_self_or_permission(permission: str):
    """Allow access to own data or with specific permission"""
    async def self_checker(
        token_data: TokenData = Depends(get_current_user_token),
        target_user_id: Optional[str] = None
    ) -> TokenData:
        # If accessing own data, allow
        if target_user_id and target_user_id == token_data.user_id:
            return token_data

        # Otherwise check permission
        if permission not in token_data.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires permission '{permission}' or accessing own data"
            )

        return token_data

    return self_checker