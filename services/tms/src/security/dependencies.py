"""
Security dependencies for TMS Service
"""
from typing import Callable, List, Optional
from fastapi import HTTPException, status, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from functools import wraps

from .auth import TokenData, verify_token, extract_token_from_header, TokenExpiredError, TokenInvalidError
from src.database import get_db
from src.services.permission_service import TMSServicePermission

# TMS Permission constants
TRIP_READ = ["trips:read"]
TRIP_READ_ALL = ["trips:read_all"]
TRIP_CREATE = ["trips:create"]
TRIP_UPDATE = ["trips:update"]
TRIP_DELETE = ["trips:delete"]
TRIP_ASSIGN = ["trips:assign"]
TRIP_TRACK = ["trips:track"]

ORDER_SPLIT = ["orders:split"]
ORDER_REASSIGN = ["orders:reassign"]

RESOURCES_READ = ["resources:read"]
RESOURCES_READ_ALL = ["resources:read_all"]
DRIVERS_ASSIGN = ["drivers:assign"]
DRIVERS_UPDATE = ["drivers:update"]
VEHICLES_TRACK = ["vehicles:track"]
VEHICLES_UPDATE = ["vehicles:update"]

ROUTES_CREATE = ["routes:create"]
ROUTES_OPTIMIZE = ["routes:optimize"]
ROUTES_UPDATE = ["routes:update"]

SCHEDULES_READ = ["schedules:read"]
SCHEDULES_UPDATE = ["schedules:update"]

# Super admin permission
SUPER_ADMIN = ["superuser:access"]


async def get_current_token_data(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> TokenData:
    """
    Dependency to get current user's token data from JWT token
    """
    authorization = request.headers.get("Authorization")

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Extract token from header
        token = extract_token_from_header(authorization)

        # Verify token and get user data
        token_data = verify_token(token)

        return token_data

    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_permission_service() -> TMSServicePermission:
    """Get permission service instance"""
    return TMSServicePermission()


def require_permissions(required_permissions: List[str]):
    """
    Dependency factory that creates a dependency requiring specific permissions (database lookup)

    Args:
        required_permissions: List of required permissions

    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        perm_service: TMSServicePermission = Depends(get_permission_service)
    ) -> TokenData:
        # Super admin has all permissions
        if token_data.is_super_user():
            return token_data

        # Set permission service for token data
        token_data.set_permission_service(perm_service)

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
                    detail=f"Insufficient permissions. Required: {required_perm}"
                )

        return token_data

    return permission_checker


def require_any_permission(required_permissions: List[str]):
    """
    Dependency factory that creates a dependency requiring at least one of specified permissions (database lookup)

    Args:
        required_permissions: List of permissions (user needs at least one)

    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        perm_service: TMSServicePermission = Depends(get_permission_service)
    ) -> TokenData:
        # Super admin has all permissions
        if token_data.is_super_user():
            return token_data

        # Set permission service for token data
        token_data.set_permission_service(perm_service)

        # Check if user has any of the required permissions from database
        has_any_permission = await perm_service.check_any_permission(
            token_data.user_id,
            token_data.role_id,
            required_permissions
        )

        if not has_any_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Requires one of: {required_permissions}"
            )

        return token_data

    return permission_checker


async def require_tenant_access(
    token_data: TokenData = Depends(get_current_token_data)
) -> TokenData:
    """
    Dependency to ensure user has a valid tenant
    """
    if not token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required"
        )

    return token_data


async def get_current_tenant_id(
    token_data: TokenData = Depends(get_current_token_data)
) -> str:
    """
    Dependency to get current tenant ID from token
    """
    return token_data.tenant_id


async def get_current_user_id(
    token_data: TokenData = Depends(get_current_token_data)
) -> str:
    """
    Dependency to get current user ID from token
    """
    return token_data.user_id


async def is_active_user(
    token_data: TokenData = Depends(get_current_token_data)
) -> TokenData:
    """
    Dependency to ensure user is active (check can be added here if needed)
    """
    # Add any additional user validation here
    return token_data


# Helper function to create self-access or permission dependencies
def require_self_or_permission(
    resource_id_param: str,
    owner_id_field: str,
    permission: str
):
    """
    Creates a dependency that allows access if:
    1. User is the owner of the resource, OR
    2. User has the specified permission

    Args:
        resource_id_param: Name of the resource ID parameter
        owner_id_field: Field name in the resource that contains owner ID
        permission: Permission required for non-owners
    """
    async def self_checker(
        request: Request,
        token_data: TokenData = Depends(get_current_token_data)
    ) -> TokenData:
        # Super admins can access everything
        if token_data.is_super_user():
            return token_data

        # If user has the permission, allow access
        if permission in token_data.permissions:
            return token_data

        # Otherwise, check if user owns the resource
        # This would need to be implemented per endpoint
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )

    return self_checker


# Permission decorators for endpoints
def require_trip_permission(action: str):
    """Decorator to require specific trip permission"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            token_data = kwargs.get('token_data')
            if not token_data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )

            permission = f"trips:{action}"
            if not token_data.has_permission(permission) and not token_data.is_super_user():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# Common permission dependencies for TMS endpoints
RequireTripRead = require_permissions(TRIP_READ)
RequireTripReadAll = require_permissions(TRIP_READ_ALL)
RequireTripCreate = require_permissions(TRIP_CREATE)
RequireTripUpdate = require_permissions(TRIP_UPDATE)
RequireTripDelete = require_permissions(TRIP_DELETE)
RequireTripAssign = require_permissions(TRIP_ASSIGN)

RequireOrderSplit = require_permissions(ORDER_SPLIT)
RequireOrderReassign = require_permissions(ORDER_REASSIGN)

RequireResourcesRead = require_any_permission([RESOURCES_READ[0], RESOURCES_READ_ALL[0]])
RequireResourcesReadAll = require_permissions(RESOURCES_READ_ALL)

RequireDriverAssign = require_permissions(DRIVERS_ASSIGN)
RequireDriverUpdate = require_permissions(DRIVERS_UPDATE)

RequireVehicleTrack = require_permissions(VEHICLES_TRACK)
RequireVehicleUpdate = require_permissions(VEHICLES_UPDATE)

RequireRouteCreate = require_permissions(ROUTES_CREATE)
RequireRouteOptimize = require_permissions(ROUTES_OPTIMIZE)
RequireRouteUpdate = require_permissions(ROUTES_UPDATE)

RequireScheduleRead = require_permissions(SCHEDULES_READ)
RequireScheduleUpdate = require_permissions(SCHEDULES_UPDATE)