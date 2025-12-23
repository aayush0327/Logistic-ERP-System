"""API endpoints for driver operations using TMS Service."""

from typing import Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from src.services.driver_service import DriverService
from src.config import settings
from src.security import (
    TokenData,
    get_current_user_id,
    get_current_tenant_id,
    require_permissions,
    require_any_permission
)
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
    try:
        result = await driver_service.mark_order_delivered(
            trip_id=trip_id,
            order_id=order_id,
            company_id=tenant_id  # Use tenant_id as company_id
        )
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