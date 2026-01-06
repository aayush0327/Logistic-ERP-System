"""API endpoints for driver operations using TMS Service."""

from typing import Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form
from src.services.driver_service import DriverService
from src.services.audit_client import AuditClient
from src.config import settings
from src.security import (
    TokenData,
    get_current_user_id,
    get_current_tenant_id,
    require_permissions,
    require_any_permission
)
from src.schemas import TripPause, TripResume
from src.http_client import CompanyClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def get_auth_token(request: Request) -> Optional[str]:
    """Extract auth token from request headers"""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def get_driver_service(request: Request) -> DriverService:
    """Get driver service instance with auth token"""
    auth_token = get_auth_token(request)
    return DriverService(auth_token=auth_token)


@router.get("/trips")
async def get_driver_trips(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by trip status"),
    trip_date: Optional[date] = Query(None, description="Filter by trip date"),
    driver_id: Optional[str] = Query(None, description="Filter by driver ID"),
    token_data: TokenData = Depends(require_any_permission(["driver:read", "driver:read_all", "trips:read", "trips:read_all"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get all trips assigned to the current driver.

    This endpoint returns a list of trips assigned to the driver,
    optionally filtered by status and/or date.
    """
    try:
        # Get driver service instance with auth token
        driver_service = get_driver_service(request)
        response = await driver_service.get_driver_trips(
            status=status,
            trip_date=trip_date,
            company_id=tenant_id,  # Use tenant_id as company_id
            driver_id=driver_id or user_id  # Use the driver_id from query or user_id from token
        )
        return response
    except Exception as e:
        logger.error(f"Error getting driver trips: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/current")
async def get_current_trip(
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["driver:read", "driver:read_all", "trips:read", "trips:read_all"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get the current active trip for the driver.

    Returns the most recent trip that is in 'loading' or 'on-route' status.
    """
    try:
        # Get driver service instance with auth token
        driver_service = get_driver_service(request)
        trip = await driver_service.get_current_active_trip(
            company_id=tenant_id,
            driver_id=user_id  # Use the logged-in user's ID as driver ID
        )
        return trip
    except Exception as e:
        logger.error(f"Error getting current trip: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}")
async def get_trip_detail(
    trip_id: str,
    token_data: TokenData = Depends(require_any_permission(["driver:read", "driver:read_all", "trips:read", "trips:read_all"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Get detailed information about a specific trip.

    Returns the trip details including all orders assigned to the trip,
    ordered by sequence number.
    """
    # Validate trip_id
    if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
        raise HTTPException(status_code=400, detail="Invalid trip ID")

    try:
        trip_detail = await driver_service.get_trip_detail(
            trip_id=trip_id,
            company_id=tenant_id  # Use tenant_id as company_id
        )

        if not trip_detail:
            raise HTTPException(status_code=404, detail="Trip not found")

        return trip_detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trip detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/trips/{trip_id}/orders/{order_id}/delivery")
async def update_order_delivery_status(
    trip_id: str,
    order_id: str,
    update_data: Dict[str, str],
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Update the delivery status of an order.

    Allows the driver to mark orders as delivered, failed, or returned.
    This updates the delivery status in real-time.
    """
    # Validate trip_id and order_id
    if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    if not order_id or order_id == "undefined" or order_id.strip() == "":
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not update_data or "status" not in update_data:
        raise HTTPException(status_code=400, detail="Status is required in request body")

    try:
        result = await driver_service.update_order_delivery_status(
            trip_id=trip_id,
            order_id=order_id,
            status=update_data["status"],
            company_id=tenant_id  # Use tenant_id as company_id
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating order delivery status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/maintenance")
async def report_truck_maintenance(
    trip_id: str,
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Report truck maintenance and update trip status.

    Allows the driver to report truck issues, which updates the trip
    status to 'truck-malfunction' for real-time visibility.
    """
    try:
        success = await driver_service.report_truck_maintenance(
            trip_id=trip_id,
            company_id=tenant_id  # Use tenant_id as company_id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Trip not found")

        return {
            "success": True,
            "message": "Truck maintenance reported successfully",
            "data": {
                "trip_id": trip_id,
                "driver_id": settings.DRIVER_ID
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reporting maintenance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}/orders/{order_id}/status")
async def get_order_status(
    trip_id: str,
    order_id: str,
    token_data: TokenData = Depends(require_any_permission(["driver:read", "driver:read_all", "trips:read", "trips:read_all"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Get the current status of a specific order in a trip.

    Returns the delivery status and other details of the order.
    """
    try:
        order_status = await driver_service.get_order_status(
            trip_id=trip_id,
            order_id=order_id,
            company_id=tenant_id  # Use tenant_id as company_id
        )
        return order_status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting order status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/orders/{order_id}/deliver")
async def mark_order_delivered(
    request: Request,
    trip_id: str,
    order_id: str,
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Mark an order as delivered.

    This is a convenience endpoint to quickly mark an order as delivered.
    """
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        result = await driver_service.mark_order_delivered(
            trip_id=trip_id,
            order_id=order_id,
            company_id=tenant_id  # Use tenant_id as company_id
        )

        # Send audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="deliver",
            module="trips",
            entity_type="trip_order",
            entity_id=f"{trip_id}:{order_id}",
            description=f"Order {order_id} delivered by driver {user_id}",
            from_status="on-route",
            to_status="delivered",
            new_values={
                "trip_id": trip_id,
                "order_id": order_id,
                "delivery_status": "delivered"
            }
        )
        await audit_client.close()

        return {
            "success": True,
            "message": "Order marked as delivered successfully",
            "data": {
                "trip_id": trip_id,
                "order_id": order_id,
                "delivery_status": "delivered"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking order as delivered: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/orders/{order_id}/upload-document")
async def upload_delivery_document(
    request: Request,
    trip_id: str,
    order_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(default="delivery_proof"),
    title: str = Form(default="Delivery Proof"),
    description: str = Form(default="Document uploaded by driver upon delivery"),
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Upload delivery proof document for an order.

    This endpoint allows drivers to upload delivery confirmation documents
    (photos, PDFs, etc.) when delivering an order.
    """
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        # Validate trip_id and order_id
        if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid trip ID")
        if not order_id or order_id == "undefined" or order_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid order ID")

        # Validate file type - allow images and PDFs
        allowed_mime_types = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/jpg",
            "image/gif",
            "image/webp"
        ]

        if file.content_type not in allowed_mime_types:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} is not allowed. Allowed types: PDF, JPEG, PNG, GIF, WebP"
            )

        # Validate file size (max 10MB)
        max_file_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        if len(file_content) > max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum limit of 10MB"
            )

        # Upload document via orders service
        result = await driver_service.upload_delivery_proof(
            order_id=order_id,
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type,
            document_type=document_type,
            title=title,
            description=description
        )

        # Check if trip should be completed (all orders delivered)
        # This triggers automatic trip completion when all orders have delivery documents
        try:
            from httpx import AsyncClient
            from src.config import settings

            async with AsyncClient(timeout=30.0) as client:
                # Call TMS service to check trip completion
                response = await client.post(
                    f"{settings.TMS_API_URL}/api/v1/trips/{trip_id}/check-completion",
                    headers=auth_headers,
                    json={"tenant_id": tenant_id}
                )
                if response.status_code == 200:
                    logger.info(f"Trip completion check triggered for {trip_id}")
                elif response.status_code != 404:  # 404 means endpoint not implemented yet
                    logger.warning(f"Trip completion check returned status {response.status_code}")
        except Exception as e:
            # Log error but don't fail the upload if completion check fails
            logger.error(f"Error triggering trip completion check: {str(e)}")

        # Send audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="upload",
            module="documents",
            entity_type="order_document",
            entity_id=result.get("id", order_id),
            description=f"Driver uploaded delivery proof document for order {order_id}",
            new_values={
                "order_id": order_id,
                "trip_id": trip_id,
                "document_type": document_type,
                "file_name": file.filename
            }
        )
        await audit_client.close()

        return {
            "success": True,
            "message": "Document uploaded successfully",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading delivery document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}/orders/{order_id}/documents")
async def get_order_documents(
    trip_id: str,
    order_id: str,
    token_data: TokenData = Depends(require_any_permission(["driver:read", "driver:read_all", "trips:read", "trips:read_all"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Get delivery proof documents for an order.

    Returns all delivery proof documents uploaded for this order.
    """
    try:
        # Validate trip_id and order_id
        if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid trip ID")
        if not order_id or order_id == "undefined" or order_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid order ID")

        result = await driver_service.get_delivery_documents(order_id=order_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting order documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/pause")
async def pause_trip(
    trip_id: str,
    pause_data: TripPause,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Pause a trip due to maintenance or issues.

    Allows the driver to pause their active trip when issues occur,
    such as accidents, breakdowns, or other problems.
    """
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        # Validate trip_id
        if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid trip ID")

        # Call TMS service to pause the trip
        from httpx import AsyncClient
        from src.config import settings

        async with AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.TMS_API_URL}/api/v1/trips/{trip_id}/pause",
                headers=auth_headers,
                json={
                    "reason": pause_data.reason,
                    "note": pause_data.note
                }
            )

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Trip not found")
            elif response.status_code == 400:
                error_detail = response.json().get("detail", "Cannot pause trip")
                raise HTTPException(status_code=400, detail=error_detail)
            elif response.status_code != 200:
                logger.error(f"TMS service error: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to pause trip")

            result = response.json()

        # Send audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="pause",
            module="trips",
            entity_type="trip",
            entity_id=trip_id,
            description=f"Driver paused trip {trip_id} due to {pause_data.reason}",
            new_values={
                "trip_id": trip_id,
                "paused_reason": pause_data.reason,
                "maintenance_note": pause_data.note
            }
        )
        await audit_client.close()

        return {
            "success": True,
            "message": "Trip paused successfully",
            "data": {
                "trip_id": trip_id,
                "status": "paused",
                "reason": pause_data.reason
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pausing trip: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/resume")
async def resume_trip(
    trip_id: str,
    resume_data: TripResume,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    driver_service=Depends(get_driver_service)
):
    """
    Resume a paused trip.

    Allows the driver to resume their trip after it has been paused
    due to maintenance or other issues.
    """
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        # Validate trip_id
        if not trip_id or trip_id == "undefined" or trip_id.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid trip ID")

        # Call TMS service to resume the trip
        from httpx import AsyncClient
        from src.config import settings

        async with AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.TMS_API_URL}/api/v1/trips/{trip_id}/resume",
                headers=auth_headers,
                json={
                    "note": resume_data.note
                }
            )

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Trip not found")
            elif response.status_code == 400:
                error_detail = response.json().get("detail", "Cannot resume trip")
                raise HTTPException(status_code=400, detail=error_detail)
            elif response.status_code != 200:
                logger.error(f"TMS service error: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to resume trip")

            result = response.json()

        # Send audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="resume",
            module="trips",
            entity_type="trip",
            entity_id=trip_id,
            description=f"Driver resumed trip {trip_id}",
            new_values={
                "trip_id": trip_id,
                "status": "on-route",
                "maintenance_note": resume_data.note
            }
        )
        await audit_client.close()

        return {
            "success": True,
            "message": "Trip resumed successfully",
            "data": {
                "trip_id": trip_id,
                "status": "on-route"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming trip: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))