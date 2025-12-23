"""
Security utilities for Finance Service
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from src.middleware.auth import TokenData, get_token_data
from src.services.permission_service import permission_service
import logging

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


def require_permissions(required_permissions: List[str]):
    """Dependency to require specific permissions - fetches from Auth service"""
    async def permission_checker(token_data: TokenData = Depends(get_token_data)) -> TokenData:
        if not token_data.is_super_user():
            # Fetch permissions from Auth service
            user_id = token_data.user_id
            role_id = int(token_data.role_id) if token_data.role_id else 0

            # Check each required permission
            for permission in required_permissions:
                has_permission = await permission_service.check_permission(user_id, role_id, permission)
                if not has_permission:
                    logger.warning(f"Permission denied for user {user_id}: {permission} required")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied: {permission} required"
                    )
        return token_data
    return permission_checker


def require_any_permission(required_permissions: List[str]):
    """Dependency to require any of the specified permissions - fetches from Auth service"""
    async def permission_checker(token_data: TokenData = Depends(get_token_data)) -> TokenData:
        if not token_data.is_super_user():
            # Fetch permissions from Auth service
            user_id = token_data.user_id
            role_id = int(token_data.role_id) if token_data.role_id else 0

            # Check if user has any of the required permissions
            has_permission = await permission_service.check_any_permission(user_id, role_id, required_permissions)
            if not has_permission:
                logger.warning(f"Permission denied for user {user_id}: one of {required_permissions} required")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: one of {required_permissions} required"
                )
        return token_data
    return permission_checker


# Re-export from middleware
from src.middleware.auth import (
    get_current_user_id,
    get_current_tenant_id,
    get_token_data,
    TokenData,
)