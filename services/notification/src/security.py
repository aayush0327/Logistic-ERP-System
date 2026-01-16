# Security utilities for notification service
from typing import Optional
from fastapi import HTTPException, status, Depends, Request
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime


class TokenData(BaseModel):
    """Token data structure"""
    user_id: str
    tenant_id: str
    role_id: int
    role: Optional[str] = None
    is_superuser: bool = False
    permissions: list[str] = []
    exp: Optional[datetime] = None

    def is_super_user(self) -> bool:
        """Check if user is super admin"""
        return self.is_superuser


def verify_token(token: str) -> TokenData:
    """
    Verify JWT token locally using global JWT secret

    This matches the company service approach for microservices architecture.
    """
    from src.config import get_settings
    settings = get_settings()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        role_id: int = payload.get("role_id")
        role: str = payload.get("role")
        is_superuser: bool = payload.get("is_superuser", False)
        exp: Optional[datetime] = payload.get("exp")

        if user_id is None or role_id is None:
            raise credentials_exception

        return TokenData(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            role=role,
            is_superuser=is_superuser,
            permissions=[],
            exp=exp
        )
    except JWTError:
        raise credentials_exception


async def get_token_data(request: Request) -> TokenData:
    """
    Extract and verify token from Authorization header.
    Used as a dependency for protected endpoints.
    """
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = auth_header.split()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return verify_token(token)


def require_permissions(required_permissions: list[str]):
    """
    Dependency that requires specific permissions or admin role.

    For simplicity in the notification service, we check if the user
    has the required role (Admin for admin endpoints).
    """
    async def dependency(token_data: TokenData = Depends(get_token_data)) -> TokenData:
        # For admin endpoints, check if user is Admin or superuser
        if "admin" in required_permissions:
            if token_data.role != "Admin" and not token_data.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin permission required"
                )
        return token_data

    return dependency


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


def get_current_tenant_id(token_data: TokenData) -> str:
    """Get current tenant ID from token data"""
    return token_data.tenant_id


def get_current_user_id(token_data: TokenData) -> str:
    """Get current user ID from token data"""
    return token_data.user_id


def is_superuser(token_data: TokenData) -> bool:
    """Check if current user is a superuser"""
    return token_data.is_superuser
