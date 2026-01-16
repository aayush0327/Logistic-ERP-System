# User notification preferences endpoints
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Query

from src.database import get_db
from src.security import verify_token, TokenData
from src.schemas.notification import (
    UserPreferencesCreate,
    UserPreferencesUpdate,
    UserPreferencesResponse
)
from src.services.notification_service import NotificationService

router = APIRouter()


async def get_current_user(
    token: str = Query(..., description="JWT token"),
    db: AsyncSession = Depends(get_db)
) -> TokenData:
    """Extract and verify token from query parameter"""
    return verify_token(token)


@router.get("", response_model=UserPreferencesResponse)
async def get_preferences(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notification preferences for the current user"""
    service = NotificationService(db)

    preferences = await service.get_user_preferences(
        token_data.user_id,
        token_data.tenant_id
    )

    if not preferences:
        # Create default preferences if they don't exist
        preferences = await service.create_default_preferences(
            token_data.user_id,
            token_data.tenant_id
        )

    return preferences


@router.put("", response_model=UserPreferencesResponse)
async def update_preferences(
    preferences_update: UserPreferencesUpdate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update notification preferences for the current user"""
    service = NotificationService(db)

    try:
        preferences = await service.update_user_preferences(
            token_data.user_id,
            token_data.tenant_id,
            preferences_update
        )
        return preferences
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/reset", response_model=UserPreferencesResponse)
async def reset_preferences(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reset notification preferences to defaults"""
    service = NotificationService(db)

    preferences = await service.reset_preferences_to_default(
        token_data.user_id,
        token_data.tenant_id
    )

    return preferences
