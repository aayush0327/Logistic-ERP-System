"""
JWT Authentication utilities for Company Service
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)


class TokenData:
    """Token data structure"""
    def __init__(
        self,
        user_id: str = None,
        tenant_id: str = None,
        role_id: int = None,
        role: str = None,
        permissions: list = None,
        exp: datetime = None
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role_id = role_id
        self.role = role  # Role name from JWT
        self.permissions = permissions or []
        self.exp = exp
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

    async def has_all_permissions(self, permissions: list) -> bool:
        """Check if user has all specified permissions (database lookup)"""
        # Superuser has all permissions
        if self._is_superuser:
            return True

        # If permission service is available, check database
        if self._perm_service:
            for perm in permissions:
                has_perm = await self._perm_service.check_permission(
                    self.user_id,
                    self.role_id,
                    perm
                )
                if not has_perm:
                    return False
            return True

        # Fallback to checking local permissions
        return all(perm in self.permissions for perm in permissions)

    def is_super_user(self) -> bool:
        """Check if user is super admin"""
        return self._is_superuser

    def __str__(self):
        return f"TokenData(user_id={self.user_id}, tenant_id={self.tenant_id}, role_id={self.role_id}, role={self.role})"


def verify_token(token: str) -> TokenData:
    """
    Verify JWT token and return token data using global configuration
    """
    from src.config_local import settings

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
        role: str = payload.get("role")  # Extract role from JWT
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
            role=role,  # Include role in TokenData
            permissions=[],  # Permissions no longer stored in JWT
            exp=exp
        )
        # Store is_superuser for permission checking
        token_data._is_superuser = is_superuser
        return token_data
    except JWTError:
        raise credentials_exception


def extract_token_from_header(authorization: str) -> str:
    """
    Extract JWT token from Authorization header

    Args:
        authorization: Authorization header value

    Returns:
        JWT token string

    Raises:
        HTTPException: If authorization header is invalid
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = authorization.split()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Expected 'Bearer'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing from authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


def create_access_token(
    data: Dict[str, Any],
    secret_key: str,
    algorithm: str = "HS256",
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create JWT access token (for testing purposes)

    Args:
        data: Data to encode in token
        secret_key: Secret key for token signing
        algorithm: JWT algorithm (default: HS256)
        expires_delta: Token expiration time (default: 24 hours)

    Returns:
        JWT token string
    """
    to_encode = data.copy()

    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)

    to_encode.update({"exp": expire})

    # Create JWT token
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=algorithm)
    return encoded_jwt


def is_token_expired(token_data: TokenData) -> bool:
    """
    Check if token is expired

    Args:
        token_data: TokenData object

    Returns:
        True if token is expired, False otherwise
    """
    if not token_data.exp:
        return False

    return datetime.utcnow() > token_data.exp


def get_token_expires_in(token_data: TokenData) -> Optional[int]:
    """
    Get token expiration time in seconds

    Args:
        token_data: TokenData object

    Returns:
        Seconds until token expires, or None if no expiration
    """
    if not token_data.exp:
        return None

    delta = token_data.exp - datetime.utcnow()
    return max(0, int(delta.total_seconds()))