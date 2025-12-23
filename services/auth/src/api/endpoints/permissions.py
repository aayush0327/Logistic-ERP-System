"""
Permission management endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...database import get_db, Permission, RolePermission, Role
from ...schemas import Permission as PermissionSchema
from ...dependencies import get_current_user_token, TokenData, get_permission_service, RequireUserRead

router = APIRouter()


@router.get("/", response_model=List[PermissionSchema])
async def get_permissions(
    role_id: int = Query(None, description="Filter by role ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions, optionally filtered by role"""
    query = select(Permission).order_by(Permission.resource, Permission.action)

    result = await db.execute(query)
    permissions = result.scalars().all()

    return permissions


@router.get("/user/{user_id}")
async def get_user_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions for a specific user"""
    from ...services.user_service import UserService
    from ...services.permission_service import PermissionService

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    perm_service = PermissionService(db)
    permissions = await perm_service.get_user_permissions(user_id, user.role_id)

    return {"permissions": permissions}


@router.get("/roles/{role_id}", response_model=List[str])
async def get_role_permissions(
    role_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions for a specific role"""
    from ...services.permission_service import PermissionService

    # Check if role exists
    role_query = select(Role).where(Role.id == role_id)
    role_result = await db.execute(role_query)
    role = role_result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    perm_service = PermissionService(db)
    permissions = await perm_service.get_role_permissions(role_id)

    return permissions


@router.post("/clear-cache")
async def clear_permission_cache(
    user_id: str = Query(None, description="Specific user ID to clear cache for (optional)"),
    db: AsyncSession = Depends(get_db)
):
    """Clear permission cache for a specific user or all users"""
    from ...services.permission_service import PermissionService

    perm_service = PermissionService(db)

    if user_id:
        # Clear cache for specific user
        await perm_service.clear_user_cache(user_id)
        return {"message": f"Cache cleared for user {user_id}"}
    else:
        # Clear all cache
        await perm_service.clear_all_cache()
        return {"message": "All permission cache cleared"}