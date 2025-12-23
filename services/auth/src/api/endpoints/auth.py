"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...schemas import LoginRequest, LoginResponse, TokenData, RefreshTokenRequest
from ...services.user_service import UserService
from ...services.refresh_token_service import RefreshTokenService
from ...services.permission_service import PermissionService
from ...dependencies import get_current_user_token
from ...auth import create_access_token, create_refresh_token

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login endpoint"""
    # Authenticate user
    user, error_message = await UserService.authenticate_user(db, request)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_message or "Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create tokens
    access_token, refresh_token, user_data = await UserService.create_tokens_for_user(db, user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 86400,  # 24 hours in seconds
        "user": user_data
    }


@router.get("/me")
async def get_current_user(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get current user info"""
    # Get user from database
    user = await UserService.get_by_id(db, token_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prepare user data
    user_data = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "tenant_id": user.tenant_id,
        "role_id": user.role_id,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "permissions": token_data.permissions,
        "last_login": user.last_login,
        "created_at": user.created_at
    }

    return user_data


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    # Verify the refresh token
    refresh_token_obj = await RefreshTokenService.verify_refresh_token(db, request.refresh_token)

    if not refresh_token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from refresh token
    user = await UserService.get_by_id(db, refresh_token_obj.user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Create new minimal access token
    access_token = create_access_token({
        "sub": user.id,
        "tenant_id": user.tenant_id or "",  # Ensure tenant_id is not null
        "role_id": user.role_id,
        "email": user.email,
        "is_superuser": user.is_superuser
    })

    # Create new refresh token and invalidate old one
    await RefreshTokenService.revoke_token(db, refresh_token_obj.token_hash)
    new_refresh_token = create_refresh_token(user.id, user.tenant_id)
    await RefreshTokenService.create_refresh_token(db, user.id, new_refresh_token)

    # Get user data with permissions
    user_data = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "tenant_id": user.tenant_id,
        "role_id": user.role_id,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "permissions": [],  # Will be populated in a separate call
        "created_at": user.created_at,
        "role": None,  # Will be populated if needed
        "tenant": None  # Will be populated if needed
    }

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": 86400,  # 24 hours in seconds
        "user": user_data
    }


@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(get_current_user_token)
):
    """Get permissions for a user (internal API for other services)"""
    # Verify the requesting user has permission to read user data
    perm_service = PermissionService(db)

    # Superuser can access any user's permissions
    if not token_data.__dict__.get("is_superuser", False):
        # Check if requesting user is accessing their own permissions
        if token_data.user_id != user_id:
            # Otherwise, check if they have permission to read user permissions
            has_permission = await perm_service.check_permission(
                token_data.user_id,
                token_data.role_id,
                "users:read_permissions"
            )
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access user permissions"
                )

    # Get the target user to find their role_id
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Get permissions for the target user
    permissions = await perm_service.get_user_permissions(user_id, user.role_id)

    return {
        "user_id": user_id,
        "permissions": permissions,
        "count": len(permissions)
    }