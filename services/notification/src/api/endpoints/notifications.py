# Notification CRUD endpoints
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.security import verify_token, TokenData
from src.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    NotificationListResponse
)
from src.services.notification_service import NotificationService

router = APIRouter()


async def get_current_user(
    token: str = Query(..., description="JWT token"),
    db: AsyncSession = Depends(get_db)
) -> TokenData:
    """Extract and verify token from query parameter"""
    return verify_token(token)


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    is_read: Optional[bool] = None,
    type: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notifications for the current user

    Query parameters:
    - is_read: Filter by read status (true/false)
    - type: Filter by notification type
    - priority: Filter by priority level
    - limit: Number of notifications to return (max 100)
    - offset: Number of notifications to skip
    """
    service = NotificationService(db)

    filters = {}
    if is_read is not None:
        filters["is_read"] = is_read
    if type is not None:
        filters["type"] = type
    if priority is not None:
        filters["priority"] = priority

    notifications, total = await service.get_user_notifications(
        user_id=token_data.user_id,
        tenant_id=token_data.tenant_id,
        filters=filters,
        limit=limit,
        offset=offset
    )

    return NotificationListResponse(
        notifications=notifications,
        total=total,
        unread_count=await service.get_unread_count(token_data.user_id, token_data.tenant_id)
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific notification by ID"""
    import uuid
    service = NotificationService(db)

    try:
        notification = await service.get_notification(
            uuid.UUID(notification_id),
            token_data.user_id,
            token_data.tenant_id
        )
        return notification
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read"""
    import uuid
    service = NotificationService(db)

    try:
        notification = await service.mark_as_read(
            uuid.UUID(notification_id),
            token_data.user_id,
            token_data.tenant_id
        )
        return notification
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/mark-all-read", response_model=dict)
async def mark_all_as_read(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications for the current user as read"""
    service = NotificationService(db)

    count = await service.mark_all_as_read(
        token_data.user_id,
        token_data.tenant_id
    )

    return {
        "message": f"Marked {count} notifications as read",
        "count": count
    }


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification"""
    import uuid
    service = NotificationService(db)

    try:
        await service.delete_notification(
            uuid.UUID(notification_id),
            token_data.user_id,
            token_data.tenant_id
        )
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/stats/summary")
async def get_notification_stats(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notification statistics for the current user"""
    service = NotificationService(db)

    stats = await service.get_user_stats(
        token_data.user_id,
        token_data.tenant_id
    )

    return stats
