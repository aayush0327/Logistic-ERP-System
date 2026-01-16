# SSE (Server-Sent Events) endpoint for real-time notifications
import json
from typing import Optional
from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse, Response
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.security import verify_token, TokenData

router = APIRouter()


async def event_generator(
    token_data: TokenData
):
    """Generate SSE events for connected client"""
    from src.services.sse_manager import sse_connection_manager
    import asyncio

    queue = await sse_connection_manager.connect(token_data.user_id, token_data.tenant_id)

    try:
        # Send initial connected event
        yield {
            "event": "connected",
            "data": json.dumps({
                "user_id": str(token_data.user_id),
                "tenant_id": str(token_data.tenant_id)
            })
        }

        while True:
            # Wait for new events (with timeout for heartbeat)
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield event
            except asyncio.TimeoutError:
                # Send heartbeat every 60 seconds
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": "alive"})
                }
    except Exception as e:
        # Client disconnected
        await sse_connection_manager.disconnect(token_data.user_id)
        yield {
            "event": "disconnected",
            "data": json.dumps({"reason": str(e)})
        }


async def get_token_data(
    authorization: Optional[str] = Header(None, description="Bearer token"),
    token: Optional[str] = Query(None, description="JWT token (for EventSource)"),
) -> TokenData:
    """Extract and verify token from Authorization header or query parameter"""
    # Try header first
    if authorization:
        if not authorization.startswith("Bearer "):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )
        token_to_verify = authorization.split(" ")[1]
    # Fall back to query parameter (for EventSource which doesn't support custom headers)
    elif token:
        token_to_verify = token
    else:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authorization token provided"
        )

    return verify_token(token_to_verify)


@router.options("/stream")
async def stream_options():
    """Handle OPTIONS preflight request for SSE"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.get("/stream")
async def notification_stream(
    token_data: TokenData = Depends(get_token_data)
):
    """
    SSE endpoint for real-time notifications

    Returns Server-Sent Events stream for the authenticated user.
    Clients should connect with EventSource or similar SSE client.

    The endpoint is available at /api/notifications/stream with JWT token via query parameter.

    Events:
    - connected: Initial connection confirmation
    - notification: New notification received
    - heartbeat: Keep-alive signal (every 60s)
    - disconnected: Connection closed
    """
    return EventSourceResponse(
        event_generator(token_data),
        media_type="text/event-stream"
    )


@router.post("/test-event")
async def test_notification_event(
    token_data: TokenData = Depends(get_token_data),
    db: AsyncSession = Depends(get_db)
):
    """
    Test endpoint to trigger a notification event
    (for development/testing purposes only)
    """
    from src.services.notification_service import NotificationService
    from src.schemas.notification import NotificationCreate

    notification_service = NotificationService(db)

    notification = await notification_service.create_notification(
        NotificationCreate(
            user_id=token_data.user_id,
            tenant_id=token_data.tenant_id,
            type="system",
            category="test",
            title="Test Notification",
            message="This is a test notification from the notification service",
            priority="low"
        )
    )

    return {"message": "Test notification created", "notification_id": str(notification.id)}
