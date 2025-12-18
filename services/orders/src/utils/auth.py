"""
Authentication utilities
"""
import httpx
from typing import Optional
from uuid import UUID
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from src.config_local import OrdersSettings
from src.database import get_db

settings = OrdersSettings()
security = HTTPBearer()


async def verify_token_with_auth_service(token: str) -> dict:
    """Verify JWT token with auth service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/auth/verify",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )


async def get_current_user_from_token(token: str) -> dict:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        email: str = payload.get("email")
        role: str = payload.get("role")

        if user_id is None or tenant_id is None:
            raise credentials_exception

        return {
            "id": UUID(user_id),
            "tenant_id": UUID(tenant_id),
            "email": email,
            "role": role
        }
    except JWTError:
        raise credentials_exception


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get current authenticated user"""
    token = credentials.credentials
    user = await get_current_user_from_token(token)
    return user



async def get_tenant_id(
    current_user: dict = Depends(get_current_user)
) -> UUID:
    return current_user["tenant_id"]


async def check_user_permission(user_id: UUID, permission: str) -> bool:
    """Check if user has specific permission"""
    # This would typically call the auth service to check permissions
    # For now, we'll implement a basic check
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/users/{user_id}/permissions/{permission}"
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False