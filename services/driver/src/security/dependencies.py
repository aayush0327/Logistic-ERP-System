"""
FastAPI dependencies for authentication and authorization
"""
from typing import List, Optional, Callable, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from .auth import TokenData, verify_token
from ..services.permission_service import DriverServicePermission

logger = logging.getLogger(__name__)

# HTTP Bearer security scheme
security = HTTPBearer()


async def get_current_token_data(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> TokenData:
    """
    FastAPI dependency to extract and validate JWT token (from header or cookie)

    Args:
        request: FastAPI Request object
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        TokenData object with user information

    Raises:
        HTTPException: If token is invalid or expired
    """
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

    try:
        # Verify token and extract data
        token_data = verify_token(token)
        return token_data

    except HTTPException:
        # Re-raise HTTP exceptions from verify_token
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_token_data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during authentication"
        )


async def get_permission_service() -> DriverServicePermission:
    """Get permission service instance"""
    return DriverServicePermission()


def require_permissions(required_permissions: List[str]) -> Callable:
    """
    Create a dependency that requires specific permissions (database lookup)

    Args:
        required_permissions: List of permissions required

    Returns:
        Dependency function that checks permissions

    Usage:
        @router.get("/")
        async def endpoint(
            token_data: TokenData = Depends(require_permissions(["driver:read"]))
        ):
            pass
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        perm_service: DriverServicePermission = Depends(get_permission_service)
    ) -> TokenData:
        """
        Check if user has required permissions (from database)

        Args:
            token_data: Token data from previous dependency
            perm_service: Permission service for database lookups

        Returns:
            TokenData if permissions are valid

        Raises:
            HTTPException: If user lacks required permissions
        """
        # Check for super user access
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
                    detail=f"Insufficient permissions. Missing: {required_perm}"
                )

        return token_data

    return permission_checker


def require_any_permission(required_permissions: List[str]) -> Callable:
    """
    Create a dependency that requires at least one of the specified permissions (database lookup)

    Args:
        required_permissions: List of permissions (user needs at least one)

    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        perm_service: DriverServicePermission = Depends(get_permission_service)
    ) -> TokenData:
        """Check if user has any of the required permissions (from database)"""
        # Check for super user access
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
                detail=f"Insufficient permissions. Requires at least one of: {required_permissions}"
            )

        return token_data

    return permission_checker


def get_current_tenant_id(
    token_data: TokenData = Depends(get_current_token_data)
) -> str:
    """
    Dependency to get current tenant ID from token

    Args:
        token_data: Token data from authentication

    Returns:
        Tenant ID string

    Raises:
        HTTPException: If tenant ID is missing
    """
    if not token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant ID not found in token"
        )

    return token_data.tenant_id


def get_current_user_id(
    token_data: TokenData = Depends(get_current_token_data)
) -> str:
    """
    Dependency to get current user ID from token

    Args:
        token_data: Token data from authentication

    Returns:
        User ID string

    Raises:
        HTTPException: If user ID is missing
    """
    if not token_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token"
        )

    return token_data.user_id