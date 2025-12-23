"""
Permission endpoints for Company Service
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from src.database import get_db
from src.security import TokenData, get_current_token_data
from src.services.permission_service import CompanyServicePermission

router = APIRouter()


@router.get("/check")
async def check_permission(
    permission: str,
    token_data: TokenData = Depends(get_current_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if current user has a specific permission

    Args:
        permission: Permission string to check (e.g., "branches:read")

    Returns:
        Dictionary with permission check result
    """
    perm_service = CompanyServicePermission()

    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        permission
    )

    return {
        "user_id": token_data.user_id,
        "permission": permission,
        "has_permission": has_permission
    }


@router.get("/check-any")
async def check_any_permission(
    permissions: List[str],
    token_data: TokenData = Depends(get_current_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if current user has any of the specified permissions

    Args:
        permissions: List of permission strings to check

    Returns:
        Dictionary with permission check result
    """
    perm_service = CompanyServicePermission()

    has_any_permission = await perm_service.check_any_permission(
        token_data.user_id,
        token_data.role_id,
        permissions
    )

    return {
        "user_id": token_data.user_id,
        "permissions": permissions,
        "has_any_permission": has_any_permission
    }


@router.get("/my-permissions")
async def get_my_permissions(
    token_data: TokenData = Depends(get_current_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all permissions for the current user

    Returns:
        Dictionary with user's permissions
    """
    perm_service = CompanyServicePermission()

    permissions = await perm_service.get_user_permissions(
        token_data.user_id,
        token_data.role_id
    )

    # Group permissions by resource
    grouped: Dict[str, List[str]] = {}
    for perm in permissions:
        parts = perm.split(':')
        if len(parts) >= 2:
            resource = parts[0]
            if resource not in grouped:
                grouped[resource] = []
            grouped[resource].append(perm)

    return {
        "user_id": token_data.user_id,
        "permissions": permissions,
        "permission_count": len(permissions),
        "grouped_permissions": grouped,
        "cache_stats": perm_service.get_cache_stats()
    }


@router.post("/invalidate-cache")
async def invalidate_permission_cache(
    user_id: str,
    token_data: TokenData = Depends(get_current_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Invalidate cached permissions for a user

    Args:
        user_id: User ID to invalidate cache for

    Returns:
        Success message
    """
    # Only superusers can invalidate cache for other users
    is_superuser = token_data.is_super_user()
    if not is_superuser and token_data.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to invalidate cache for other users"
        )

    perm_service = CompanyServicePermission()
    await perm_service.invalidate_user_cache(user_id)

    return {
        "message": f"Cache invalidated for user {user_id}",
        "user_id": user_id,
        "invalidated_by": token_data.user_id
    }


@router.get("/cache-stats")
async def get_cache_stats(
    token_data: TokenData = Depends(get_current_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Get permission cache statistics

    Returns:
        Cache statistics
    """
    # Only superusers or users with specific permission can view cache stats
    is_superuser = token_data.is_super_user()
    perm_service = CompanyServicePermission()

    # Check if user has permission to view cache stats
    if not is_superuser:
        has_permission = await perm_service.check_permission(
            token_data.user_id,
            token_data.role_id,
            "company:settings_view"
        )
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view cache statistics"
            )

    return perm_service.get_cache_stats()