"""
FastAPI dependencies for authentication and authorization
"""
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db, User
from .auth import verify_token
from .schemas import TokenData
from .services.user_service import UserService
from .services.permission_service import PermissionService
from .config_local import AuthSettings

settings = AuthSettings()

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> TokenData:
    """Get current user from JWT token (from header or cookie)"""
    token = None

    # Try to get token from Authorization header first
    if credentials:
        token = credentials.credentials
    else:
        # Try to get from cookies (for frontend requests)
        token = request.cookies.get("access_token")
        if token:
            # Decode URI-encoded token
            from urllib.parse import unquote
            token = unquote(token)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = verify_token(token)
    return token_data


async def get_permission_service(db: AsyncSession = Depends(get_db)) -> PermissionService:
    """Get permission service instance"""
    return PermissionService(db)


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

    # Note: Permissions are no longer stored in token_data
    # They will be fetched from database when needed via PermissionService

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
    """Dependency to require specific permissions (database lookup)"""
    async def permission_checker(
        token_data: TokenData = Depends(get_current_user_token),
        perm_service: PermissionService = Depends(get_permission_service)
    ) -> TokenData:
        # Superuser has all permissions
        if token_data.is_superuser:
            return token_data

        # Check if user has all required permissions from database
        for required_perm in required_permissions:
            has_permission = await perm_service.check_permission(
                token_data.user_id,
                token_data.role_id,
                required_perm
            )
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: {required_perm}"
                )

        return token_data

    return permission_checker


def require_any_permission(any_permissions: List[str]):
    """Dependency to require any of the specified permissions (database lookup)"""
    async def permission_checker(
        token_data: TokenData = Depends(get_current_user_token),
        perm_service: PermissionService = Depends(get_permission_service)
    ) -> TokenData:
        # Superuser has all permissions
        if token_data.is_superuser:
            return token_data

        # Check if user has any of the required permissions from database
        has_any_permission = await perm_service.check_any_permission(
            token_data.user_id,
            token_data.role_id,
            any_permissions
        )

        if not has_any_permission:
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
    """Utility class for checking permissions (database-based)"""

    def __init__(self, db: AsyncSession):
        self.perm_service = PermissionService(db)

    async def can_access_resource(
        self,
        user_id: str,
        role_id: int,
        resource: str,
        action: str,
        is_superuser: bool = False
    ) -> bool:
        """Check if user can perform action on resource"""
        if is_superuser:
            return True

        required_permission = f"{resource}:{action}"
        return await self.perm_service.check_permission(user_id, role_id, required_permission)

    async def can_manage_tenant(
        self,
        user_id: str,
        role_id: int,
        tenant_id: str,
        user_tenant_id: str,
        is_superuser: bool = False
    ) -> bool:
        """Check if user can manage tenant"""
        if is_superuser:
            return True

        # User can manage their own tenant
        if tenant_id == user_tenant_id:
            return await self.perm_service.check_permission(user_id, role_id, "tenants:manage_own")

        # User can manage any tenant
        return await self.perm_service.check_permission(user_id, role_id, "tenants:manage_all")

    async def can_access_user_data(
        self,
        user_id: str,
        role_id: int,
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
        return await self.perm_service.check_permission(user_id, role_id, "users:read_all")


# Common permission dependencies (using database lookup)
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
    """Allow access to own data or with specific permission (database lookup)"""
    async def self_checker(
        token_data: TokenData = Depends(get_current_user_token),
        perm_service: PermissionService = Depends(get_permission_service),
        target_user_id: Optional[str] = None
    ) -> TokenData:
        # If accessing own data, allow
        if target_user_id and target_user_id == token_data.user_id:
            return token_data

        # Superuser has all permissions
        if token_data.is_superuser:
            return token_data

        # Otherwise check permission from database
        has_permission = await perm_service.check_permission(
            token_data.user_id,
            token_data.role_id,
            permission
        )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires permission '{permission}' or accessing own data"
            )

        return token_data

    return self_checker


# Utility function to get tenant ID from token
def get_current_tenant_id(token_data: TokenData = Depends(get_current_user_token)) -> str:
    """Get current tenant ID from token data"""
    return token_data.tenant_id or ""


# Utility function to get user ID from token
def get_current_user_id(token_data: TokenData = Depends(get_current_user_token)) -> str:
    """Get current user ID from token data"""
    return token_data.user_id


# Utility function to check if user is superuser
def is_superuser(token_data: TokenData = Depends(get_current_user_token)) -> bool:
    """Check if current user is a superuser"""
    return token_data.is_superuser