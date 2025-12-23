"""Authentication and authorization utilities."""

from datetime import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import logging
from pydantic import BaseModel

from src.config import settings

logger = logging.getLogger(__name__)

# JWT token scheme
security = HTTPBearer()


class TokenData:
    """Token data structure"""
    def __init__(
        self,
        user_id: str = None,
        tenant_id: str = None,
        role_id: int = None,
        permissions: list = None,
        exp: datetime = None,
        sub: str = None
    ):
        self.user_id = user_id or sub  # Use sub if user_id is not available
        self.tenant_id = tenant_id
        self.role_id = role_id
        self.permissions = permissions or []
        self.exp = exp
        self.sub = sub or user_id
        self._is_superuser = False  # Will be set from JWT payload
        self._perm_service = None  # Will be set when needed

    def set_permission_service(self, perm_service):
        """Set permission service for database lookups"""
        self._perm_service = perm_service

    async def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission (database lookup)"""
        # Superuser has all permissions
        if self._is_superuser:
            return True

        # If permission service is available, check database
        if self._perm_service:
            return await self._perm_service.check_permission(
                self.user_id,
                self.role_id,
                permission
            )

        # Fallback to checking local permissions (should be empty now)
        return permission in self.permissions

    async def has_any_permission(self, permissions: list) -> bool:
        """Check if user has any of the specified permissions (database lookup)"""
        # Superuser has all permissions
        if self._is_superuser:
            return True

        # If permission service is available, check database
        if self._perm_service:
            return await self._perm_service.check_any_permission(
                self.user_id,
                self.role_id,
                permissions
            )

        # Fallback to checking local permissions
        return any(perm in self.permissions for perm in permissions)

    def is_super_user(self) -> bool:
        """Check if user is super admin"""
        return self._is_superuser


def verify_token(token: str) -> TokenData:
    """
    Verify JWT token and return token data using global configuration

    Args:
        token: JWT token string

    Returns:
        TokenData: Decoded token data

    Raises:
        HTTPException: If token is invalid
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.GLOBAL_JWT_SECRET,
            algorithms=[settings.GLOBAL_JWT_ALGORITHM]
        )

        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        role_id: int = payload.get("role_id")
        email: str = payload.get("email")
        is_superuser: bool = payload.get("is_superuser", False)
        exp: Optional[datetime] = payload.get("exp")

        if user_id is None or role_id is None:
            raise credentials_exception

        # Create token data with empty permissions (will be fetched from DB when needed)
        token_data = TokenData(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            permissions=[],  # Permissions no longer stored in JWT
            exp=exp,
            sub=user_id
        )
        # Store is_superuser for permission checking
        token_data._is_superuser = is_superuser
        return token_data

    except JWTError:
        raise credentials_exception


def extract_token_from_header(authorization: str) -> Optional[str]:
    """
    Extract token from Authorization header.

    Args:
        authorization: Authorization header value

    Returns:
        Optional[str]: Token string or None if invalid
    """
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def get_token_data(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """
    Get token data from request credentials.

    Args:
        credentials: HTTP Authorization credentials

    Returns:
        TokenData: Decoded token data
    """
    token = credentials.credentials
    return verify_token(token)


def log_authentication_event(event: str, user_id: str = None, details: str = None):
    """Log authentication events."""
    logger.info(f"Driver Auth event: {event}", extra={
        "user_id": user_id,
        "details": details
    })


async def get_current_user_id(
    token_data: TokenData = Depends(get_token_data)
) -> str:
    """Get current user ID from token."""
    return token_data.sub


async def get_current_tenant_id(
    token_data: TokenData = Depends(get_token_data)
) -> str:
    """Get current tenant ID from token."""
    return token_data.tenant_id


def require_permissions(permissions: List[str]):
    """
    Require specific permissions to access endpoint.

    Args:
        permissions: List of required permissions

    Returns:
        Dependency function
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_token_data)
    ) -> TokenData:
        """Check if user has required permissions."""
        user_permissions = set(token_data.permissions)
        required_permissions = set(permissions)

        if not required_permissions.issubset(user_permissions):
            log_authentication_event(
                "PERMISSION_DENIED",
                user_id=token_data.sub,
                details=f"Missing permissions: {required_permissions - user_permissions}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        log_authentication_event("PERMISSION_GRANTED", user_id=token_data.sub)
        return token_data

    return permission_checker


def require_any_permission(permissions: List[str]):
    """
    Require any of the specified permissions.

    Args:
        permissions: List of permissions (any one is sufficient)

    Returns:
        Dependency function
    """
    async def permission_checker(
        token_data: TokenData = Depends(get_token_data)
    ) -> TokenData:
        """Check if user has any of the required permissions."""
        user_permissions = set(token_data.permissions)
        required_permissions = set(permissions)

        if not user_permissions.intersection(required_permissions):
            log_authentication_event(
                "PERMISSION_DENIED",
                user_id=token_data.sub,
                details=f"Missing any of permissions: {required_permissions}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        log_authentication_event("PERMISSION_GRANTED", user_id=token_data.sub)
        return token_data

    return permission_checker