"""
User management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import joinedload
from typing import List, Optional

from ...database import get_db, User
from ...schemas import User as UserSchema, UserCreate, UserUpdate, UserUpdatePassword
from ...services.user_service import UserService
from ...services.permission_service import PermissionService
from ...dependencies import (
    get_current_user_token,
    TokenData,
    get_permission_service,
    require_permissions,
    require_any_permission,
    require_self_or_permission,
    RequireUserRead,
    RequireUserWrite,
    RequireUserDelete
)
from ...auth import get_password_hash, verify_password

router = APIRouter()


@router.get("/", response_model=List[UserSchema])
async def list_users(
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tenant_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """List all users with filtering and pagination"""
    # Superadmin can see all users, others only their tenant
    if not token_data.is_superuser and tenant_id and tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Build query with eager loading of role relationship
    query = select(User).options(joinedload(User.role))

    # Filter by tenant if not superadmin or tenant_id specified
    if not token_data.is_superuser:
        query = query.where(User.tenant_id == token_data.tenant_id)
    elif tenant_id:
        query = query.where(User.tenant_id == tenant_id)

    # Add search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                User.email.ilike(search_pattern),
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern)
            )
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query)

    # Apply pagination and ordering
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Build response with role information
    response_users = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "tenant_id": user.tenant_id,
            "role_id": user.role_id,
            "last_login": user.last_login,
            "login_attempts": user.login_attempts,
            "locked_until": user.locked_until,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            # Add role information
            "role_name": user.role.name if user.role else None,
            "is_system_role": user.role.is_system if user.role else None
        }
        response_users.append(UserSchema(**user_dict))

    return response_users


@router.get("/{user_id}", response_model=UserSchema)
async def get_user(
    user_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID"""
    # Check permissions
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:read"
    )

    # Allow access if user has permission or is accessing own data
    if not (has_permission or (user_id == token_data.user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return user


@router.post("/", response_model=UserSchema)
async def create_user(
    user_data: UserCreate,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user"""
    # Check permission
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:create"
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to create users"
        )

    # Set tenant_id for non-superusers
    if not token_data.is_superuser:
        user_data.tenant_id = token_data.tenant_id

    # Cannot create superuser unless superadmin
    if not token_data.is_superuser and user_data.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create superuser accounts"
        )

    user = await UserService.create_user(db, user_data)
    return user


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Update user"""
    # Check permissions
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:update"
    )

    # Allow access if user has permission or is updating own data (limited fields)
    is_own_profile = user_id == token_data.user_id
    if not (has_permission or is_own_profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If updating own profile, restrict fields
    if is_own_profile and not has_permission:
        # Only allow certain fields for self-update
        allowed_fields = {"first_name", "last_name"}
        update_dict = update_data.model_dump(exclude_unset=True)
        for field in update_dict:
            if field not in allowed_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Cannot update field '{field}' on own profile"
                )

    # Non-superusers cannot change tenant_id or is_superuser
    if not token_data.is_superuser:
        if update_data.tenant_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change tenant"
            )
        if update_data.is_superuser is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change superuser status"
            )

    user = await UserService.update_user(db, user_id, update_data.model_dump(exclude_unset=True))
    return user


@router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Delete user"""
    # Cannot delete self
    if user_id == token_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # Check permission
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:delete"
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete users"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Cannot delete superusers unless superadmin
    if user.is_superuser and not token_data.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete superuser accounts"
        )

    # Extract auth token from request
    auth_header = request.headers.get("authorization")
    auth_token = auth_header[7:] if auth_header and auth_header.startswith("Bearer ") else None

    success = await UserService.delete_user(db, user_id, auth_token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

    return {"message": "User deleted successfully"}


@router.put("/{user_id}/password")
async def change_user_password(
    user_id: str,
    password_data: UserUpdatePassword,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    # Check permissions
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:update"
    )

    # Allow access if user has permission or is changing own password
    is_own_profile = user_id == token_data.user_id
    if not (has_permission or is_own_profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If changing own password, verify current password is provided and correct
    if is_own_profile:
        if not password_data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required when changing your own password"
            )
        if not verify_password(password_data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

    # Update password
    new_hash = get_password_hash(password_data.new_password)
    user.password_hash = new_hash
    await db.commit()

    return {"message": "Password updated successfully"}


@router.put("/{user_id}/activate")
async def activate_user(
    user_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Activate user account"""
    # Check permission
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:update"
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to activate users"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    user.is_active = True
    user.login_attempts = 0
    user.locked_until = None
    await db.commit()

    return {"message": "User activated successfully"}


@router.put("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    perm_service: PermissionService = Depends(get_permission_service),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate user account"""
    # Cannot deactivate self
    if user_id == token_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    # Check permission
    has_permission = await perm_service.check_permission(
        token_data.user_id,
        token_data.role_id,
        "users:update"
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to deactivate users"
        )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check tenant access
    if not token_data.is_superuser and user.tenant_id != token_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Cannot deactivate superusers unless superadmin
    if user.is_superuser and not token_data.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot deactivate superuser accounts"
        )

    user.is_active = False
    await db.commit()

    return {"message": "User deactivated successfully"}


@router.get("/by-role/{role_name}")
async def get_users_by_role(
    role_name: str,
    tenant_id: str = Query(..., description="Tenant ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all user IDs with a specific role in a tenant.

    This endpoint is used by the notification service to resolve recipients.
    Returns only user IDs (minimal data) for performance.
    """
    from ...database import Role

    # Join User with Role to filter by role name
    query = select(User.id).join(User.role).where(
        and_(
            User.tenant_id == tenant_id,
            Role.name == role_name,  # e.g., "finance_manager", "branch_manager"
            User.is_active == True
        )
    )

    result = await db.execute(query)
    user_ids = [str(row[0]) for row in result.fetchall()]

    return {"users": user_ids}
