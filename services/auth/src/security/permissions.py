"""
Permission decorators for database-based permission checking
"""
from functools import wraps
from typing import List, Union, Callable, Any
from fastapi import HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import verify_token
from ..services.permission_service import PermissionService
from ..database import get_db
from ..schemas import TokenData


# Permission constants (kept for backward compatibility)
BRANCH_READ_ALL = "branches:read_all"
BRANCH_READ = "branches:read"
BRANCH_CREATE = "branches:create"
BRANCH_UPDATE = "branches:update"
BRANCH_DELETE = "branches:delete"

TRIP_READ_ALL = "trips:read_all"
TRIP_READ = "trips:read"
TRIP_CREATE = "trips:create"
TRIP_UPDATE = "trips:update"
TRIP_DELETE = "trips:delete"

ORDER_READ_ALL = "orders:read_all"
ORDER_READ = "orders:read"
ORDER_CREATE = "orders:create"
ORDER_UPDATE = "orders:update"
ORDER_DELETE = "orders:delete"

DRIVER_READ_ALL = "drivers:read_all"
DRIVER_READ = "drivers:read"
DRIVER_CREATE = "drivers:create"
DRIVER_UPDATE = "drivers:update"
DRIVER_DELETE = "drivers:delete"

VEHICLE_READ_ALL = "vehicles:read_all"
VEHICLE_READ = "vehicles:read"
VEHICLE_CREATE = "vehicles:create"
VEHICLE_UPDATE = "vehicles:update"
VEHICLE_DELETE = "vehicles:delete"

USER_READ_ALL = "users:read_all"
USER_READ = "users:read"
USER_CREATE = "users:create"
USER_UPDATE = "users:update"
USER_DELETE = "users:delete"

ROLE_READ_ALL = "roles:read_all"
ROLE_READ = "roles:read"
ROLE_CREATE = "roles:create"
ROLE_UPDATE = "roles:update"
ROLE_DELETE = "roles:delete"

TENANT_READ_ALL = "tenants:read_all"
TENANT_READ = "tenants:read"
TENANT_CREATE = "tenants:create"
TENANT_UPDATE = "tenants:update"
TENANT_DELETE = "tenants:delete"


async def get_permission_service(db: AsyncSession = Depends(get_db)) -> PermissionService:
    """Dependency to get permission service instance"""
    return PermissionService(db)


async def get_current_token_data(request: Any) -> TokenData:
    """Extract and verify JWT token from request"""
    # Try to get token from Authorization header first
    auth_header = request.headers.get("authorization")
    token = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]  # Remove "Bearer " prefix
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

    return verify_token(token)


def require_permission(permission: str):
    """Decorator to require specific permission"""
    async def permission_checker(
        request: Any = None,
        db: AsyncSession = Depends(get_db),
        perm_service: PermissionService = Depends(get_permission_service)
    ):
        # Get token data
        if request is None:
            # If called as a direct dependency
            from fastapi import Request
            request = Request  # This will be injected by FastAPI

        token_data = await get_current_token_data(request)

        # Superuser has all permissions
        if token_data.__dict__.get("is_superuser", False):
            return token_data

        # Check permission from database
        has_permission = await perm_service.check_permission(
            token_data.user_id,
            token_data.role_id,
            permission
        )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )

        return token_data

    return permission_checker


def require_any_permission(permissions: List[str]):
    """Decorator to require any of the specified permissions"""
    async def permission_checker(
        request: Any = None,
        db: AsyncSession = Depends(get_db),
        perm_service: PermissionService = Depends(get_permission_service)
    ):
        # Get token data
        if request is None:
            from fastapi import Request
            request = Request

        token_data = await get_current_token_data(request)

        # Superuser has all permissions
        if token_data.__dict__.get("is_superuser", False):
            return token_data

        # Check if user has any of the required permissions
        has_permission = await perm_service.check_any_permission(
            token_data.user_id,
            token_data.role_id,
            permissions
        )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permissions)}"
            )

        return token_data

    return permission_checker


def require_all_permissions(permissions: List[str]):
    """Decorator to require all of the specified permissions"""
    async def permission_checker(
        request: Any = None,
        db: AsyncSession = Depends(get_db),
        perm_service: PermissionService = Depends(get_permission_service)
    ):
        # Get token data
        if request is None:
            from fastapi import Request
            request = Request

        token_data = await get_current_token_data(request)

        # Superuser has all permissions
        if token_data.__dict__.get("is_superuser", False):
            return token_data

        # Check if user has all required permissions
        for required_perm in permissions:
            has_permission = await perm_service.check_permission(
                token_data.user_id,
                token_data.role_id,
                required_perm
            )

            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"All of these permissions required: {', '.join(permissions)}"
                )

        return token_data

    return permission_checker


# Common permission dependencies for backward compatibility
require_branch_read = require_permission(BRANCH_READ)
require_branch_read_all = require_permission(BRANCH_READ_ALL)
require_branch_create = require_permission(BRANCH_CREATE)
require_branch_update = require_permission(BRANCH_UPDATE)
require_branch_delete = require_permission(BRANCH_DELETE)

require_trip_read = require_permission(TRIP_READ)
require_trip_read_all = require_permission(TRIP_READ_ALL)
require_trip_create = require_permission(TRIP_CREATE)
require_trip_update = require_permission(TRIP_UPDATE)
require_trip_delete = require_permission(TRIP_DELETE)

require_order_read = require_permission(ORDER_READ)
require_order_read_all = require_permission(ORDER_READ_ALL)
require_order_create = require_permission(ORDER_CREATE)
require_order_update = require_permission(ORDER_UPDATE)
require_order_delete = require_permission(ORDER_DELETE)

require_driver_read = require_permission(DRIVER_READ)
require_driver_read_all = require_permission(DRIVER_READ_ALL)
require_driver_create = require_permission(DRIVER_CREATE)
require_driver_update = require_permission(DRIVER_UPDATE)
require_driver_delete = require_permission(DRIVER_DELETE)

require_vehicle_read = require_permission(VEHICLE_READ)
require_vehicle_read_all = require_permission(VEHICLE_READ_ALL)
require_vehicle_create = require_permission(VEHICLE_CREATE)
require_vehicle_update = require_permission(VEHICLE_UPDATE)
require_vehicle_delete = require_permission(VEHICLE_DELETE)

require_user_read = require_permission(USER_READ)
require_user_read_all = require_permission(USER_READ_ALL)
require_user_create = require_permission(USER_CREATE)
require_user_update = require_permission(USER_UPDATE)
require_user_delete = require_permission(USER_DELETE)

require_role_read = require_permission(ROLE_READ)
require_role_read_all = require_permission(ROLE_READ_ALL)
require_role_create = require_permission(ROLE_CREATE)
require_role_update = require_permission(ROLE_UPDATE)
require_role_delete = require_permission(ROLE_DELETE)

require_tenant_read = require_permission(TENANT_READ)
require_tenant_read_all = require_permission(TENANT_READ_ALL)
require_tenant_create = require_permission(TENANT_CREATE)
require_tenant_update = require_permission(TENANT_UPDATE)
require_tenant_delete = require_permission(TENANT_DELETE)


# Utility functions for backward compatibility
async def get_current_user_token(
    request: Any,
    db: AsyncSession = Depends(get_db)
) -> TokenData:
    """Get current user token data (for backward compatibility)"""
    return await get_current_token_data(request)


def get_current_tenant_id(token_data: TokenData = Depends(get_current_user_token)) -> str:
    """Get current tenant ID from token data"""
    return token_data.tenant_id or ""


def get_current_user_id(token_data: TokenData = Depends(get_current_user_token)) -> str:
    """Get current user ID from token data"""
    return token_data.user_id


def is_superuser(token_data: TokenData = Depends(get_current_user_token)) -> bool:
    """Check if current user is a superuser"""
    return token_data.__dict__.get("is_superuser", False)