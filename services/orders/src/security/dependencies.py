"""
FastAPI dependencies for authentication and authorization
"""
from typing import List, Optional, Callable, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from .auth import TokenData, verify_token, extract_token_from_header

logger = logging.getLogger(__name__)

# HTTP Bearer security scheme
security = HTTPBearer()


async def get_current_token_data(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """
    FastAPI dependency to extract and validate JWT token

    Args:
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        TokenData object with user information

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Extract token from credentials
        token = credentials.credentials

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


def require_permissions(required_permissions: List[str]) -> Callable:
    """
    Create a dependency that requires specific permissions

    Args:
        required_permissions: List of permissions required

    Returns:
        Dependency function that checks permissions

    Usage:
        @router.get("/")
        async def endpoint(
            token_data: TokenData = Depends(require_permissions(["orders:read"]))
        ):
            pass
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data)
    ) -> TokenData:
        """
        Check if user has required permissions

        Args:
            token_data: Token data from previous dependency

        Returns:
            TokenData if permissions are valid

        Raises:
            HTTPException: If user lacks required permissions
        """
        # Check for super user access
        if token_data.is_super_user():
            logger.debug(f"Super user access granted: {token_data.user_id}")
            return token_data

        # Import here to avoid circular imports
        from src.services.permission_service import OrderServicePermission

        # Get permission service and check permissions
        perm_service = OrderServicePermission()

        for required_perm in required_permissions:
            has_permission = await perm_service.check_permission(
                token_data.user_id,
                int(token_data.role_id),
                required_perm
            )
            if not has_permission:
                logger.warning(
                    f"Access denied. User {token_data.user_id} missing permission: {required_perm}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {required_perm}"
                )

        logger.debug(f"Permission check passed for user {token_data.user_id}")
        return token_data

    return permission_checker


def require_any_permission(required_permissions: List[str]) -> Callable:
    """
    Create a dependency that requires at least one of the specified permissions

    Args:
        required_permissions: List of permissions (user needs at least one)

    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_current_token_data)
    ) -> TokenData:
        """Check if user has any of the required permissions"""
        # Check for super user access
        if token_data.is_super_user():
            return token_data

        # Import here to avoid circular imports
        from src.services.permission_service import OrderServicePermission

        # Get permission service and check permissions
        perm_service = OrderServicePermission()

        has_any_permission = await perm_service.check_any_permission(
            token_data.user_id,
            int(token_data.role_id),
            required_permissions
        )

        if not has_any_permission:
            logger.warning(
                f"Access denied. User {token_data.user_id} missing all required permissions: "
                f"{required_permissions}"
            )
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


# Common permission combinations for orders service
ORDER_READ_ALL = ["orders:read_all"]
ORDER_READ = ["orders:read"]
ORDER_READ_OWN = ["orders:read_own"]
ORDER_CREATE = ["orders:create"]
ORDER_UPDATE = ["orders:update"]
ORDER_UPDATE_OWN = ["orders:update_own"]
ORDER_DELETE = ["orders:delete"]
ORDER_DELETE_OWN = ["orders:delete_own"]
ORDER_CANCEL = ["orders:cancel"]
ORDER_STATUS_UPDATE = ["orders:status_update"]
ORDER_APPROVE_FINANCE = ["orders:approve_finance"]
ORDER_APPROVE_LOGISTICS = ["orders:approve_logistics"]
ORDER_MANAGE_ALL = ["orders:manage_all"]

# Document permissions
ORDER_DOCUMENTS_READ = ["order_documents:read"]
ORDER_DOCUMENTS_READ_OWN = ["order_documents:read_own"]
ORDER_DOCUMENTS_UPLOAD = ["order_documents:upload"]
ORDER_DOCUMENTS_UPDATE = ["order_documents:update"]
ORDER_DOCUMENTS_UPDATE_OWN = ["order_documents:update_own"]
ORDER_DOCUMENTS_DELETE = ["order_documents:delete"]
ORDER_DOCUMENTS_DELETE_OWN = ["order_documents:delete_own"]
ORDER_DOCUMENTS_VERIFY = ["order_documents:verify"]
ORDER_DOCUMENTS_DOWNLOAD = ["order_documents:download"]

# Report permissions
ORDER_REPORTS_READ = ["order_reports:read"]
ORDER_REPORTS_READ_OWN = ["order_reports:read_own"]
ORDER_REPORTS_EXPORT = ["order_reports:export"]