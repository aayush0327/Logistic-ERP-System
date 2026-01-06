"""
JWT Authentication utilities for Orders Service
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, status, Request
import logging

logger = logging.getLogger(__name__)


class TokenExpiredError(Exception):
    """Token has expired"""
    pass


class TokenInvalidError(Exception):
    """Token is invalid"""
    pass


class RateLimitExceededError(Exception):
    """Rate limit exceeded"""
    pass


def log_authentication_event(
    event_type: str,
    request: Request = None,
    token_data: 'TokenData' = None,
    success: bool = False,
    reason: str = None
):
    """Log authentication events"""
    log_data = {
        "event_type": event_type,
        "success": success,
        "reason": reason,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if request:
        log_data.update({
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else None,
        })

    if token_data:
        log_data.update({
            "user_id": token_data.user_id,
            "tenant_id": token_data.tenant_id,
            "role_id": token_data.role_id,
        })

    if success:
        logger.info(f"Auth event: {event_type}", extra={"auth_data": log_data})
    else:
        logger.warning(f"Auth event: {event_type} - {reason}", extra={"auth_data": log_data})


class TokenData:
    """Token data structure"""
    def __init__(
        self,
        user_id: str = None,
        tenant_id: str = None,
        role_id: str = None,
        role: str = None,
        permissions: list = None,
        exp: datetime = None,
        is_superuser: bool = False
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role_id = role_id
        self.role = role  # Role name from JWT
        self.permissions = permissions or []
        self.exp = exp
        self.is_superuser = is_superuser

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return permission in self.permissions

    def has_any_permission(self, permissions: list) -> bool:
        """Check if user has any of the specified permissions"""
        return any(perm in self.permissions for perm in permissions)

    def has_all_permissions(self, permissions: list) -> bool:
        """Check if user has all specified permissions"""
        return all(perm in self.permissions for perm in permissions)

    def is_super_user(self) -> bool:
        """Check if user is a superuser"""
        return self.is_superuser

    def __str__(self):
        return f"TokenData(user_id={self.user_id}, tenant_id={self.tenant_id}, role_id={self.role_id}, role={self.role})"


def verify_token(token: str) -> TokenData:
    """
    Verify JWT token and return token data using global configuration
    """
    from src.config_local import settings

    try:
        # Add debug logging
        logger.debug(f"Attempting to decode token with algorithm: {settings.GLOBAL_JWT_ALGORITHM}")
        logger.debug(f"JWT secret (first 10 chars): {settings.GLOBAL_JWT_SECRET[:10]}...")

        payload = jwt.decode(
            token,
            settings.GLOBAL_JWT_SECRET,
            algorithms=[settings.GLOBAL_JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        role_id: str = payload.get("role_id")
        role: str = payload.get("role")  # Extract role from JWT
        is_superuser: bool = payload.get("is_superuser", False)
        exp: Optional[datetime] = payload.get("exp")

        logger.debug(f"Token payload - user_id: {user_id}, tenant_id: {tenant_id}, role_id: {role_id}, role: {role}")

        if user_id is None or role_id is None:
            logger.warning("Token missing required fields")
            raise TokenInvalidError("Token missing required fields")

        # Permissions are now empty - will be fetched from database
        token_data = TokenData(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            role=role,  # Include role in TokenData
            permissions=[],
            exp=exp,
            is_superuser=is_superuser
        )
        return token_data
    except JWTError as e:
        logger.warning(f"JWT validation failed: {str(e)}")
        logger.warning(f"Token received (first 20 chars): {token[:20]}...")
        if "expired" in str(e).lower():
            raise TokenExpiredError("Token has expired")
        raise TokenInvalidError(f"Invalid token: {str(e)}")
    except Exception as e:
        logger.warning(f"Unexpected error during token validation: {str(e)}")
        raise TokenInvalidError(f"Token validation error: {str(e)}")


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

    # Trim and handle extra spaces
    authorization = authorization.strip()

    try:
        # Split on whitespace and handle extra spaces
        parts = authorization.split()
        if len(parts) != 2:
            raise ValueError("Invalid authorization format")
        scheme, token = parts
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