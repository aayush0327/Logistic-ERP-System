"""
FastAPI dependencies for authentication and authorization
"""
from typing import List, Optional, Callable, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from .auth import TokenData, verify_token, extract_token_from_header
from .permissions import Permission
from ..services.permission_service import CompanyServicePermission

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


async def get_permission_service() -> CompanyServicePermission:
    """Get permission service instance"""
    return CompanyServicePermission()


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
            token_data: TokenData = Depends(require_permissions(["users:read"]))
        ):
            pass
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        perm_service: CompanyServicePermission = Depends(get_permission_service)
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
        perm_service: CompanyServicePermission = Depends(get_permission_service)
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


def require_tenant_access() -> Callable:
    """
    Create a dependency that ensures user can access their tenant data

    Returns:
        Dependency function that validates tenant access
    """
    async def tenant_checker(
        token_data: TokenData = Depends(get_current_token_data)
    ) -> TokenData:
        """Validate tenant access"""
        # Super admins can access any tenant
        if token_data.is_super_user():
            return token_data

        # Regular users must have a valid tenant
        if not token_data.tenant_id:
            logger.warning(f"User {token_data.user_id} missing tenant_id")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not associated with any tenant"
            )

        return token_data

    return tenant_checker


def require_self_or_permission(
    resource_user_id_param: str = "user_id",
    required_permissions: List[str] = None
) -> Callable:
    """
    Create a dependency that allows access if user is accessing their own data
    or has specific permissions

    Args:
        resource_user_id_param: Path parameter name for resource user ID
        required_permissions: Permissions required for cross-user access

    Returns:
        Dependency function that checks self access or permissions
    """
    async def self_or_permission_checker(
        token_data: TokenData = Depends(get_current_token_data),
        **kwargs
    ) -> TokenData:
        """Check self access or required permissions"""
        # Get resource user ID from path parameters
        resource_user_id = kwargs.get(resource_user_id_param)

        # Allow access if user is accessing their own data
        if resource_user_id and str(resource_user_id) == token_data.user_id:
            return token_data

        # Check for super user access
        if token_data.is_super_user():
            return token_data

        # Check for required permissions
        if required_permissions:
            if token_data.has_all_permissions(required_permissions):
                return token_data

        # Deny access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only access your own data or need elevated permissions"
        )

    return self_or_permission_checker


def require_role(required_roles: List[str]) -> Callable:
    """
    Create a dependency that requires specific role

    Args:
        required_roles: List of role IDs required

    Returns:
        Dependency function that checks role
    """
    async def role_checker(
        token_data: TokenData = Depends(get_current_token_data)
    ) -> TokenData:
        """Check if user has required role"""
        # Super admins can bypass role checks
        if token_data.is_super_user():
            return token_data

        # Check user role
        if token_data.role_id not in required_roles:
            logger.warning(
                f"Access denied. User {token_data.user_id} role {token_data.role_id} "
                f"not in required roles: {required_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required: {required_roles}"
            )

        return token_data

    return role_checker


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


def is_active_user(
    token_data: TokenData = Depends(get_current_token_data)
) -> TokenData:
    """
    Dependency to check if user is active
    (This would typically involve a database call to verify user status)

    Args:
        token_data: Token data from authentication

    Returns:
        TokenData if user is active

    Raises:
        HTTPException: If user is not active
    """
    # For now, we assume all token holders are active
    # In a real implementation, you would check the database
    # to see if the user account is active

    # TODO: Add database check for user status
    # user = await get_user_by_id(token_data.user_id)
    # if not user or not user.is_active:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="User account is not active"
    #     )

    return token_data


# Common permission combinations for company service
BRANCH_READ_ALL = ["branches:read_all"]
BRANCH_READ = ["branches:read"]
BRANCH_CREATE = ["branches:create"]
BRANCH_UPDATE = ["branches:update"]
BRANCH_DELETE = ["branches:delete"]
BRANCH_MANAGE_ALL = ["branches:manage_all"]
BRANCH_MANAGE_OWN = ["branches:manage_own"]

CUSTOMER_READ_ALL = ["customers:read_all"]
CUSTOMER_READ = ["customers:read"]
CUSTOMER_CREATE = ["customers:create"]
CUSTOMER_UPDATE = ["customers:update"]
CUSTOMER_DELETE = ["customers:delete"]

VEHICLE_READ_ALL = ["vehicles:read_all"]
VEHICLE_READ = ["vehicles:read"]
VEHICLE_CREATE = ["vehicles:create"]
VEHICLE_UPDATE = ["vehicles:update"]
VEHICLE_DELETE = ["vehicles:delete"]
VEHICLE_ASSIGN = ["vehicles:assign"]

PRODUCT_READ_ALL = ["products:read_all"]
PRODUCT_READ = ["products:read"]
PRODUCT_CREATE = ["products:create"]
PRODUCT_UPDATE = ["products:update"]
PRODUCT_DELETE = ["products:delete"]
PRODUCT_STOCK_ADJUST = ["products:stock_adjust"]

COMPANY_REPORTS_READ = ["company_reports:read"]
COMPANY_REPORTS_EXPORT = ["company_reports:export"]