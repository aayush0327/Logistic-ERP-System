"""Trip API endpoints with reordering functionality"""

import os
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update, func
from datetime import date, datetime, timezone
from httpx import AsyncClient
import uuid
import logging

from src.database import get_db, Trip, TripOrder, TMSAuditLog, CompanyAuditLog, write_audit_log_to_company, get_company_db_session
from src.schemas import (
    TripCreate, TripUpdate, TripResponse, TripWithOrders,
    AssignOrdersRequest, TripOrderCreate, TripOrderResponse,
    MessageResponse, ReorderOrdersRequest,
    TripPause, TripResume,
    LoadingConfirmationRequest
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)
from src.config import settings
from src.services.audit_client import AuditClient

logger = logging.getLogger(__name__)

router = APIRouter(
    dependencies=[Depends(HTTPBearer())],
    responses={
        401: {"description": "Unauthorized - Invalid or missing token"},
        403: {"description": "Forbidden - Insufficient permissions"}
    },
    tags=["trips"]
)

# Company service URL
COMPANY_SERVICE_URL = "http://company-service:8002"


async def _get_vehicle_id_by_plate(
    plate_number: str,
    auth_headers: dict,
    tenant_id: str
) -> Optional[str]:
    """
    Get vehicle ID from plate number by querying Company Service
    """
    try:
        async with AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{COMPANY_SERVICE_URL}/vehicles/",
                params={
                    "search": plate_number,
                    "tenant_id": tenant_id,
                    "per_page": 1
                },
                headers=auth_headers
            )

            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                if items and len(items) > 0:
                    # Find exact match for plate number
                    for vehicle in items:
                        if vehicle.get("plate_number") == plate_number:
                            vehicle_id = vehicle.get("id")
                            logger.info(f"Found vehicle ID {vehicle_id} for plate {plate_number}")
                            return str(vehicle_id)

            logger.warning(f"No vehicle found for plate number: {plate_number}")
            return None
    except Exception as e:
        logger.error(f"Error getting vehicle ID by plate: {str(e)}")
        return None


async def _update_truck_status(
    truck_plate: str,
    new_status: str,
    auth_headers: dict,
    tenant_id: str
):
    """
    Update truck status in Company Service

    Status mapping:
    - assigned: When truck is assigned to a trip (planning -> loading)
    - on_trip: When trip is on-route
    - available: When trip is completed or cancelled
    """
    logger.info(f"_update_truck_status called: truck_plate={truck_plate}, new_status={new_status}")

    # The new_status is already the target status (assigned, on_trip, maintenance, available)
    # No additional mapping needed - pass it directly to company service
    company_status = new_status

    # Validate that the status is supported
    valid_statuses = ["assigned", "on_trip", "maintenance", "available"]
    if company_status not in valid_statuses:
        logger.warning(f"Invalid truck status: {new_status}. Must be one of: {valid_statuses}")
        return

    # Get vehicle ID from plate number
    logger.info(f"Getting vehicle_id for plate: {truck_plate}")
    vehicle_id = await _get_vehicle_id_by_plate(truck_plate, auth_headers, tenant_id)
    if not vehicle_id:
        logger.error(f"Cannot update truck status - vehicle not found for plate: {truck_plate}")
        return

    logger.info(f"Found vehicle_id: {vehicle_id} for plate: {truck_plate}")

    try:
        async with AsyncClient(timeout=10.0) as client:
            url = f"{COMPANY_SERVICE_URL}/vehicles/{vehicle_id}/status"
            params = {"tenant_id": tenant_id, "status": company_status}
            logger.info(f"Calling PUT {url} with params: {params}")

            response = await client.put(
                url,
                params=params,
                headers=auth_headers
            )

            logger.info(f"Company Service response status: {response.status_code}")
            logger.info(f"Company Service response body: {response.text}")

            if response.status_code == 200:
                logger.info(f"Updated truck {truck_plate} (ID: {vehicle_id}) status to {company_status}")
            else:
                logger.error(f"Failed to update truck status: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"Error updating truck status: {str(e)}", exc_info=True)


async def _update_driver_status(
    driver_id: str,
    new_status: str,
    auth_headers: dict,
    tenant_id: str
):
    """
    Update driver status in Company Service

    Status mapping:
    - assigned: When driver is assigned to a trip
    - on_trip: When trip is on-route
    - available: When trip is completed or cancelled

    Note: driver_id is user_id from auth service. We need to get the driver profile ID first.
    """
    try:
        # First, get the driver profile using user_id
        async with AsyncClient(timeout=10.0) as client:
            # Get driver profile by user_id
            get_response = await client.get(
                f"{COMPANY_SERVICE_URL}/profiles/drivers/by-user/{driver_id}",
                params={"tenant_id": tenant_id},
                headers=auth_headers
            )

            if get_response.status_code != 200:
                logger.error(f"Failed to get driver profile for user_id {driver_id}: {get_response.status_code} - {get_response.text}")
                return

            driver_profile = get_response.json()
            driver_profile_id = driver_profile.get("id")

            if not driver_profile_id:
                logger.error(f"No driver profile ID found for user_id {driver_id}")
                return

            logger.info(f"Found driver profile {driver_profile_id} for user_id {driver_id}")

            # Now update the driver profile using the dedicated status endpoint
            update_response = await client.put(
                f"{COMPANY_SERVICE_URL}/profiles/drivers/{driver_profile_id}/status",
                params={"status": new_status, "tenant_id": tenant_id},
                headers=auth_headers
            )

            if update_response.status_code == 200:
                logger.info(f"Updated driver {driver_id} (profile: {driver_profile_id}) status to {new_status}")
            else:
                logger.error(f"Failed to update driver status: {update_response.status_code} - {update_response.text}")
    except Exception as e:
        logger.error(f"Error updating driver status: {str(e)}")


async def _update_resource_statuses_for_trip(
    trip_status: str,
    truck_plate: str,
    driver_id: str,
    auth_headers: dict,
    tenant_id: str
):
    """
    Update truck and driver status based on trip status

    Mapping:
    - planning/created: truck=assigned, driver=assigned
    - planning -> loading: truck=assigned, driver=assigned (reinforce)
    - loading -> on-route: truck=on_trip, driver=on_trip
    - on-route -> paused: truck=maintenance, driver=available (driver becomes available for other trips)
    - paused -> on-route: truck=on_trip, driver=on_trip
    - on-route -> completed: truck=available, driver=available
    - any -> cancelled: truck=available, driver=available
    """
    logger.info(f"_update_resource_statuses_for_trip called: trip_status={trip_status}, truck_plate={truck_plate}, driver_id={driver_id}")

    status_mappings = {
        "planning": {
            "truck": "assigned",
            "driver": "assigned"
        },
        "loading": {
            "truck": "assigned",
            "driver": "assigned"
        },
        "on-route": {
            "truck": "on_trip",
            "driver": "on_trip"
        },
        "paused": {
            "truck": "maintenance",
            "driver": "available"
        },
        "completed": {
            "truck": "available",
            "driver": "available"
        },
        "cancelled": {
            "truck": "available",
            "driver": "available"
        }
    }

    mapping = status_mappings.get(trip_status)
    if not mapping:
        logger.info(f"No resource status update needed for trip status: {trip_status}")
        return

    logger.info(f"Resource status mapping: truck={mapping['truck']}, driver={mapping['driver']}")

    # Update truck status
    await _update_truck_status(truck_plate, mapping["truck"], auth_headers, tenant_id)

    # Update driver status
    await _update_driver_status(driver_id, mapping["driver"], auth_headers, tenant_id)


async def _check_trip_completion_and_update_status(
    trip_id: str,
    auth_headers: dict,
    tenant_id: str
):
    """
    Check if all orders in a trip are delivered.
    If yes, update trip status to 'completed' which will release driver and truck.
    """
    from src.database import async_session_maker

    async with async_session_maker() as db:
        # Get trip orders
        orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id)
        orders_result = await db.execute(orders_query)
        trip_orders = orders_result.scalars().all()

        if not trip_orders:
            logger.info(f"No orders found for trip {trip_id}")
            return

        # Check if all orders are delivered
        all_delivered = all(
            order.delivery_status == "delivered"
            for order in trip_orders
        )

        if all_delivered:
            # Get the trip
            trip_query = select(Trip).where(Trip.id == trip_id)
            trip_result = await db.execute(trip_query)
            trip = trip_result.scalar_one_or_none()

            if trip and trip.status != "completed":
                old_status = trip.status
                # Update trip status to completed
                trip.status = "completed"
                await db.commit()

                # Update resource statuses (will set to available)
                await _update_resource_statuses_for_trip(
                    "completed",
                    trip.truck_plate,
                    trip.driver_id,
                    auth_headers,
                    tenant_id
                )

                # Publish Kafka event for trip completion
                try:
                    from src.services.kafka_producer import trip_event_producer
                    trip_event_producer.publish_trip_completed(
                        trip_id=str(trip.id),
                        tenant_id=tenant_id,
                        driver_id=trip.driver_id,
                        driver_name=trip.driver_name,
                        branch_id=trip.branch,
                        completed_by="system",
                        completed_by_role=None  # System action
                    )
                except Exception as e:
                    logger.error(f"Failed to publish trip.completed event: {e}")

                logger.info(f"Trip {trip_id} automatically completed (all orders delivered) - status changed from {old_status} to completed, driver and truck set to available")


async def _update_order_item_statuses(
    trip_id: str,
    trip_status: str,
    auth_headers: dict,
    token_data: TokenData,
    tenant_id: str
):
    """
    Update item statuses in Orders service when trip status changes
    Maps trip status to item status:
    - planning -> planning
    - loading -> loading
    - on-route -> on_route
    - completed -> delivered

    For split orders, we only update the specific items assigned to this trip.
    """
    from src.database import async_session_maker

    # Map trip status to item status
    status_mapping = {
        "planning": "planning",
        "loading": "loading",
        "on-route": "on_route",
        "completed": "delivered"
    }

    item_status = status_mapping.get(trip_status)
    if not item_status:
        logger.warning(f"No item status mapping for trip status: {trip_status}")
        return

    # Get all orders for this trip
    async with async_session_maker() as db:
        orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id)
        result = await db.execute(orders_query)
        trip_orders = result.scalars().all()

    if not trip_orders:
        logger.info(f"No orders found for trip {trip_id}")
        return

    # Update item status for each order via Orders service API
    headers = auth_headers

    for trip_order in trip_orders:
        try:
            # For split/partial orders, extract specific item IDs
            item_ids = None
            if trip_order.items_json and len(trip_order.items_json) > 0:
                # This is a split/partial assignment - get the specific item IDs
                item_ids = [item.get('id') for item in trip_order.items_json if item.get('id')]
                logger.info(f"Trip status change for order {trip_order.order_id} - updating {len(item_ids)} specific items to {item_status}")

            # Build item status payload
            item_status_payload = {
                "order_id": trip_order.order_id,
                "trip_id": trip_id,
                "item_status": item_status
            }
            # Only include item_ids if we have specific items (split assignment)
            if item_ids:
                item_status_payload["item_ids"] = item_ids

            async with AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/item-status",
                    headers=headers,
                    json=item_status_payload
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Updated item status for order {trip_order.order_id} ({len(item_ids) if item_ids else 'all'} items) to {item_status}: {result.get('message')}")
                else:
                    logger.error(f"Failed to update item status for order {trip_order.order_id}: {response.text}")
        except Exception as e:
            logger.error(f"Error updating item status for order {trip_order.order_id}: {str(e)}", exc_info=True)


async def fetch_latest_trip_status_change(
    db: AsyncSession,
    trip_ids: List[str]
) -> dict:
    """
    Fetch the latest status change info for multiple trips from centralized audit logs.

    Returns: Dict mapping trip_id -> status change info dict with keys:
        - timestamp: datetime of the status change
        - from_status: previous status
        - to_status: new status
    """
    import json
    from src.database import company_async_session_maker

    logger.info(f"TMS - Fetching status changes for {len(trip_ids)} trips: {trip_ids[:3]}...")

    # Query the centralized audit_logs table in company_db
    async with company_async_session_maker() as company_db:
        # Subquery to get the latest audit log entry for each trip
        latest_audit_subquery = (
            select(
                CompanyAuditLog.entity_id,
                func.max(CompanyAuditLog.action_timestamp).label('latest_timestamp')
            )
            .where(
                and_(
                    CompanyAuditLog.entity_type == 'trip',
                    CompanyAuditLog.action == 'status_change',
                    CompanyAuditLog.entity_id.in_(trip_ids)
                )
            )
            .group_by(CompanyAuditLog.entity_id)
            .subquery()
        )

        # Main query to get the latest audit log records
        query = (
            select(CompanyAuditLog)
            .join(
                latest_audit_subquery,
                and_(
                    CompanyAuditLog.entity_id == latest_audit_subquery.c.entity_id,
                    CompanyAuditLog.action_timestamp == latest_audit_subquery.c.latest_timestamp
                )
            )
        )

        result = await company_db.execute(query)
        audit_records = result.scalars().all()

    logger.info(f"TMS - Found {len(audit_records)} audit log records from company_db")

    # Build mapping: trip_id -> status change info
    status_change_map = {}
    for record in audit_records:
        # Extract from_status and to_status from old_values and new_values
        old_values = record.old_values if isinstance(record.old_values, dict) else {}
        new_values = record.new_values if isinstance(record.new_values, dict) else {}

        from_status = old_values.get('from_status') or old_values.get('status')
        to_status = new_values.get('to_status') or new_values.get('status')

        if to_status:
            status_change_map[record.entity_id] = {
                'timestamp': record.action_timestamp,
                'from_status': from_status,
                'to_status': to_status
            }

    logger.info(f"TMS - Built status_change_map with {len(status_change_map)} entries: {list(status_change_map.keys())[:3]}")
    return status_change_map


@router.get(
    "",
    response_model=List[TripResponse],
    responses={401: {"description": "Unauthorized"},
               403: {"description": "Forbidden"}},
    summary="Get all trips",
    description="Retrieve a list of all trips with optional filtering"
)
async def get_trips(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by trip status"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    trip_date: Optional[date] = Query(None, description="Filter by trip date"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(
        None, description="Filter by company ID"),
    token_data: TokenData = Depends(
        require_any_permission(["trips:read_all", "trips:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get all trips with optional filters"""
    # Get authorization header from the request and forward it
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Build base query with tenant isolation
    query = select(Trip).where(Trip.company_id == tenant_id)

    # Check if user is Super Admin or Admin - if not, filter by assigned branches
    is_admin = token_data.role == "Admin" or token_data.is_super_user()
    logger.info(f"Trips access check - user_id: {token_data.user_id}, role: {token_data.role}, is_super_user: {token_data.is_super_user()}, is_admin: {is_admin}")

    if not is_admin:
        # Fetch assigned branches for non-admin users
        try:
            async with AsyncClient(timeout=30.0) as client:
                branches_response = await client.get(
                    f"{COMPANY_SERVICE_URL}/branches/my/assigned",
                    params={
                        "is_active": True,
                        "per_page": 100,
                        "tenant_id": tenant_id
                    },
                    headers=auth_headers
                )

                if branches_response.status_code == 200:
                    branches_data = branches_response.json()
                    # Get branch IDs for filtering - Trip.branch contains the branch UUID
                    assigned_branch_ids = [branch["id"] for branch in branches_data.get("items", [])]

                    if assigned_branch_ids:
                        # Filter trips by assigned branch IDs (Trip.branch contains UUID)
                        query = query.where(Trip.branch.in_(assigned_branch_ids))
                        logger.info(f"Filtering trips by assigned branch IDs: {assigned_branch_ids}")
                    else:
                        # No assigned branches - return empty result
                        logger.warning(f"No assigned branches found for user {token_data.user_id}")
                        return []
                else:
                    logger.error(f"Failed to fetch assigned branches: {branches_response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching assigned branches: {str(e)}")

    # Apply additional filters
    if status:
        query = query.where(Trip.status == status)
    if branch:
        query = query.where(Trip.branch == branch)
    if trip_date:
        query = query.where(Trip.trip_date == trip_date)
    if user_id:
        query = query.where(Trip.user_id == user_id)
    # Note: company_id is used for tenant_id, so we don't need the extra filter

    # Order by created date descending
    query = query.order_by(Trip.created_at.desc())

    result = await db.execute(query)
    trips = result.scalars().all()

    # Fetch latest status changes for all trips from audit logs
    trip_ids = [trip.id for trip in trips]
    latest_status_changes = await fetch_latest_trip_status_change(db, trip_ids)

    # Get current UTC time once for consistent calculations
    current_time = datetime.now(timezone.utc)

    # Convert to response models with orders
    trip_responses = []

    # Fetch all orders from Orders service to get items data (with pagination)
    orders_with_items = {}
    bulk_assignments_data = {}

    try:
        async with AsyncClient(timeout=30.0) as client:
            # Fetch all pages of orders
            all_orders = []
            current_page = 1
            total_pages = 1

            while current_page <= total_pages:
                orders_response = await client.get(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/",
                    params={
                        "tenant_id": tenant_id,
                        "per_page": 100,  # Max per_page value
                        "page": current_page
                    },
                    headers=auth_headers
                )
                logger.info(f"Orders service response status: {orders_response.status_code}")

                if orders_response.status_code != 200:
                    logger.error(f"Failed to fetch orders: status {orders_response.status_code}, response: {orders_response.text}")
                    break

                orders_data = orders_response.json()
                orders = orders_data.get("items", [])
                all_orders.extend(orders)

                # Update pagination info
                total_pages = orders_data.get("pages", 1)
                current_page += 1

            logger.info(f"Fetched {len(all_orders)} total orders from Orders service")

            # Index orders by order_number for quick lookup
            order_numbers = []
            for order in all_orders:
                order_key = order.get("order_number") or order.get("id")
                orders_with_items[order_key] = order
                # Also index by 'id' in case order_id matches the UUID
                if order.get("id"):
                    orders_with_items[order["id"]] = order
                if order.get("order_number"):
                    order_numbers.append(order["order_number"])

            logger.info(f"Fetched {len(orders_with_items)} orders with items data")
            logger.info(f"Sample orders_with_items keys: {list(orders_with_items.keys())[:5]}")

            # BULK FETCH: Get all trip-item assignments for all orders
            if order_numbers:
                bulk_response = await client.post(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/bulk-fetch",
                    json={"order_numbers": order_numbers},
                    headers=auth_headers
                )
                if bulk_response.status_code == 200:
                    bulk_assignments_data = bulk_response.json()
                    logger.info(f"Fetched bulk assignments for {len(bulk_assignments_data)} orders")
                else:
                    logger.warning(f"Bulk assignments request failed: {bulk_response.status_code}")

    except Exception as e:
        logger.error(f"Error fetching orders with items: {str(e)}", exc_info=True)

    for trip in trips:
        # Get orders for this trip ordered by sequence_number
        orders_query = select(TripOrder).where(
            TripOrder.trip_id == trip.id).order_by(TripOrder.sequence_number)
        if user_id:
            orders_query = orders_query.where(TripOrder.user_id == user_id)
        if company_id:
            orders_query = orders_query.where(
                TripOrder.company_id == company_id)

        orders_result = await db.execute(orders_query)
        orders = orders_result.scalars().all()

        # Convert orders to TripOrderResponse format with items_data
        order_responses = []
        for order in orders:
            # Get items data from the orders_with_items dictionary
            order_with_items = orders_with_items.get(order.order_id, {})
            items_data = order_with_items.get("items", [])

            # Get assignments data for this order
            order_number = order_with_items.get("order_number", order.order_id)
            assignments_data = bulk_assignments_data.get(order_number, {})
            assignment_items = assignments_data.get("items", [])

            # Debug logging
            logger.info(f"DEBUG order_id={order.order_id}, order_number={order_number}, has items_json={bool(order.items_json)}, has assignment_items={len(assignment_items)}")

            # Build display_items with correct ASSIGNED quantities
            # ALWAYS use assignment data if available, regardless of items_json
            # items_json contains stale data and is not updated during loading confirmation
            if assignment_items:
                logger.info(f"DEBUG Using assignment data for order {order.order_id}")
                # Calculate assigned quantities for each item
                display_items = []
                total_assigned_qty = 0
                total_calculated_weight = 0
                has_any_assignments_to_this_trip = False

                for item_info in assignment_items:
                    # Get assignments for this item
                    assignments = item_info.get("assignments", [])

                    # Filter to only assignments for THIS trip with active statuses
                    trip_assignments = [
                        a for a in assignments
                        if a.get("trip_id") == trip.id
                        and a.get("item_status") in ["planning", "loading", "on_route", "delivered"]
                    ]

                    if trip_assignments:
                        has_any_assignments_to_this_trip = True
                        # Calculate total assigned quantity for this trip
                        assigned_qty = sum(a.get("assigned_quantity", 0) for a in trip_assignments)
                        original_qty = item_info.get("original_quantity", item_info.get("quantity", 0))
                        weight_per_unit = item_info.get("weight", 0)

                        # Create enriched item with correct assigned quantity
                        enriched_item = {
                            "id": item_info.get("id"),
                            "order_id": order.order_id,
                            "product_id": item_info.get("product_id"),
                            "product_name": item_info.get("product_name"),
                            "product_code": item_info.get("product_code"),
                            "quantity": assigned_qty,  # Use ASSIGNED quantity, not original
                            "original_quantity": original_qty,
                            "remaining_quantity": item_info.get("remaining_quantity", 0),
                            "weight": weight_per_unit,
                            "total_weight": assigned_qty * weight_per_unit,  # Recalculate based on assigned qty
                            "unit": item_info.get("unit"),
                            "unit_price": item_info.get("unit_price"),
                            "total_price": assigned_qty * item_info.get("unit_price", 0),  # Recalculate
                        }

                        display_items.append(enriched_item)
                        total_assigned_qty += assigned_qty
                        total_calculated_weight += enriched_item["total_weight"]
                        logger.info(f"DEBUG Item {item_info.get('product_name')}: assigned_qty={assigned_qty}, original_qty={original_qty}, weight={enriched_item['total_weight']}")

                # Only use calculated values if we actually found assignments to this trip
                # If no assignments to this trip, use items_json fallback
                if has_any_assignments_to_this_trip and display_items:
                    order_weight = total_calculated_weight
                    order_quantity = total_assigned_qty
                    logger.info(f"DEBUG Order {order.order_id}: HAS assignments - total_assigned_qty={total_assigned_qty}, total_weight={total_calculated_weight}")
                else:
                    # No assignments to this trip found - use items_json as fallback
                    display_items = order.items_json if order.items_json else items_data
                    order_weight = order.weight
                    order_quantity = order.quantity
                    logger.info(f"DEBUG Order {order.order_id}: NO assignments to this trip - using items_json fallback")
            else:
                # Fallback: use items_json if available, otherwise use items_data from Orders service
                display_items = order.items_json if order.items_json else items_data
                order_weight = order.weight
                order_quantity = order.quantity
                logger.info(f"DEBUG Using fallback data for order {order.order_id}")

            # Debug logging
            if order.order_id not in orders_with_items:
                logger.warning(f"Order {order.order_id} not found in orders_with_items. Available keys: {list(orders_with_items.keys())[:10]}")
            logger.info(f"Trip order_id: {order.order_id}, items_data length: {len(items_data)}, items_json length: {len(order.items_json) if order.items_json else 0}")

            order_response = TripOrderResponse(
                id=order.id,
                trip_id=order.trip_id,
                user_id=order.user_id,
                company_id=order.company_id,
                order_id=order.order_id,
                customer=order.customer,
                customer_address=order.customer_address,
                customer_contact=order.customer_contact,
                customer_phone=order.customer_phone,
                product_name=order.product_name,
                trip_order_status=order.status,  # Renamed from 'status'
                tms_order_status=order.tms_order_status,
                total=order.total,
                weight=order_weight,  # Use calculated weight based on assigned quantities
                volume=order.volume,
                items=order.items,  # Use integer count from database
                items_data=display_items,  # Use enriched items with assigned quantities
                items_json=order.items_json,
                remaining_items_json=order.remaining_items_json,
                quantity=order_quantity,  # Use calculated quantity based on assigned quantities
                priority=order.priority,
                delivery_status=order.delivery_status,
                sequence_number=order.sequence_number or 0,  # Default to 0 if null
                address=order.address,
                special_instructions=order.special_instructions,
                delivery_instructions=order.delivery_instructions,
                original_order_id=order.original_order_id,
                original_items=order.original_items,
                original_weight=order.original_weight,
                assigned_at=order.assigned_at
            )
            order_responses.append(order_response)

        # Calculate time in current status and get status change info
        try:
            status_change_info = latest_status_changes.get(trip.id)

            if status_change_info:
                # We have a status change record
                current_status_since = status_change_info.get('timestamp', trip.created_at)
                from_status = status_change_info.get('from_status')
                to_status = status_change_info.get('to_status')
            else:
                # No status change record, use created_at
                current_status_since = trip.created_at
                from_status = None
                to_status = None

            # Ensure both datetimes are timezone-aware for proper comparison
            if current_status_since.tzinfo is None:
                current_status_since = current_status_since.replace(tzinfo=timezone.utc)

            time_in_status_minutes = int(
                (current_time - current_status_since).total_seconds() / 60
            )
        except Exception as e:
            logger.error(f"Error calculating time_in_status for trip {trip.id}: {str(e)}")
            current_status_since = trip.created_at
            from_status = None
            to_status = None
            time_in_status_minutes = 0

        # Debug: Log first trip time_in_status
        if trip == list(trips)[0]:
            logger.info(f"TMS - First trip: {trip.id}, status={trip.status}, "
                      f"from_status={from_status}, to_status={to_status}, "
                      f"time_in_status_minutes={time_in_status_minutes}, "
                      f"current_status_since={current_status_since}")

        trip_response = TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            company_id=trip.company_id,
            branch=trip.branch,
            truck_plate=trip.truck_plate,
            truck_model=trip.truck_model,
            truck_capacity=trip.truck_capacity,
            driver_id=trip.driver_id,
            driver_name=trip.driver_name,
            driver_phone=trip.driver_phone,
            status=trip.status,
            origin=trip.origin,
            destination=trip.destination,
            distance=trip.distance,
            estimated_duration=trip.estimated_duration,
            pre_trip_time=trip.pre_trip_time,
            post_trip_time=trip.post_trip_time,
            capacity_used=trip.capacity_used,
            capacity_total=trip.capacity_total,
            trip_date=trip.trip_date,
            maintenance_note=trip.maintenance_note,
            paused_at=trip.paused_at,
            paused_reason=trip.paused_reason,
            resumed_at=trip.resumed_at,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            current_status_since=current_status_since.isoformat() if current_status_since else None,
            time_in_current_status_minutes=time_in_status_minutes,
            from_status=from_status,
            to_status=to_status
        )

        # Add orders to the response
        trip_response.orders = order_responses
        trip_responses.append(trip_response)

    # Log sample response for debugging
    if trip_responses:
        sample_trip = trip_responses[0]
        logger.info(f"Sample trip response: id={sample_trip.id}, orders_count={len(sample_trip.orders)}")
        logger.info(f"Sample trip time-in-status: current_status_since={sample_trip.current_status_since}, "
                   f"time_in_current_status_minutes={sample_trip.time_in_current_status_minutes}")
        # Log the actual dict that will be serialized to JSON
        sample_trip_dict = sample_trip.model_dump(mode='json')
        logger.info(f"Sample trip dict keys: {list(sample_trip_dict.keys())}")
        logger.info(f"Sample trip dict time-in-status: current_status_since={sample_trip_dict.get('current_status_since')}, "
                   f"time_in_current_status_minutes={sample_trip_dict.get('time_in_current_status_minutes')}")
        if sample_trip.orders:
            sample_order = sample_trip.orders[0]
            logger.info(f"Sample order: order_id={sample_order.order_id}, items={sample_order.items}, items_data_length={len(sample_order.items_data) if sample_order.items_data else 0}")

    return trip_responses


@router.get("/{trip_id}", response_model=TripWithOrders)
async def get_trip(
    trip_id: str,
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["trips:read_all", "trips:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get trip by ID with associated orders"""
    # Get authorization header from the request and forward it
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Check if user is Super Admin or Admin - if not, filter by assigned branches
    is_admin = token_data.role == "Admin" or token_data.is_super_user()
    logger.info(f"Trip access check - user_id: {token_data.user_id}, role: {token_data.role}, is_super_user: {token_data.is_super_user()}, is_admin: {is_admin}")

    # Build base query
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )

    # For non-admin users, verify the trip belongs to an assigned branch
    if not is_admin:
        try:
            async with AsyncClient(timeout=30.0) as client:
                branches_response = await client.get(
                    f"{COMPANY_SERVICE_URL}/branches/my/assigned",
                    params={
                        "is_active": True,
                        "per_page": 100,
                        "tenant_id": tenant_id
                    },
                    headers=auth_headers
                )

                if branches_response.status_code == 200:
                    branches_data = branches_response.json()
                    # Get branch names since Trip.branch stores the branch name as a string
                    assigned_branch_names = [branch["name"] for branch in branches_data.get("items", [])]
                    assigned_branch_ids = [branch["id"] for branch in branches_data.get("items", [])]

                    if assigned_branch_names:
                        # Filter trips by assigned branch names
                        query = query.where(Trip.branch.in_(assigned_branch_names))
                        logger.info(f"Filtering trip by assigned branch names: {assigned_branch_names} (IDs: {assigned_branch_ids})")
                    else:
                        # No assigned branches - trip not accessible
                        logger.warning(f"No assigned branches found for user {token_data.user_id}")
                        raise HTTPException(status_code=403, detail="Trip not found or no access to assigned branches")
                else:
                    logger.error(f"Failed to fetch assigned branches: {branches_response.status_code}")
                    raise HTTPException(status_code=403, detail="Failed to verify branch access")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching assigned branches: {str(e)}")
            raise HTTPException(status_code=403, detail="Failed to verify branch access")

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get trip orders ordered by sequence_number
    orders_query = select(TripOrder).where(
        TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number)
    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Convert to response models
    trip_response = TripWithOrders(
        id=trip.id,
        user_id=trip.user_id,
        company_id=trip.company_id,
        branch=trip.branch,
        truck_plate=trip.truck_plate,
        truck_model=trip.truck_model,
        truck_capacity=trip.truck_capacity,
        driver_id=trip.driver_id,
        driver_name=trip.driver_name,
        driver_phone=trip.driver_phone,
        status=trip.status,
        origin=trip.origin,
        destination=trip.destination,
        distance=trip.distance,
        estimated_duration=trip.estimated_duration,
        pre_trip_time=trip.pre_trip_time,
        post_trip_time=trip.post_trip_time,
        capacity_used=trip.capacity_used,
        capacity_total=trip.capacity_total,
        trip_date=trip.trip_date,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
        orders=[
            TripOrderResponse(
                id=order.id,
                trip_id=order.trip_id,
                user_id=order.user_id,
                company_id=order.company_id,
                order_id=order.order_id,
                customer=order.customer,
                customer_address=order.customer_address,
                customer_contact=order.customer_contact,
                customer_phone=order.customer_phone,
                product_name=order.product_name,
                trip_order_status=order.status,  # Renamed from 'status'
                tms_order_status=order.tms_order_status,
                total=order.total,
                weight=order.weight,
                volume=order.volume,
                items=order.items_json or order.items or [],  # Use items_json if available (for split orders), otherwise use items
                items_data=order.items_json or [],  # Use items_json if available
                items_json=order.items_json,
                remaining_items_json=order.remaining_items_json,
                quantity=order.quantity or 1,  # Default to 1 if null
                priority=order.priority,
                delivery_status=order.delivery_status or "pending",
                sequence_number=order.sequence_number or 0,  # Default to 0 if null
                address=order.address,
                special_instructions=order.special_instructions,
                delivery_instructions=order.delivery_instructions,
                original_order_id=order.original_order_id,
                original_items=order.original_items,
                original_weight=order.original_weight,
                assigned_at=order.assigned_at
            )
            for order in orders
        ]
    )

    return trip_response


@router.post("", response_model=TripResponse)
async def create_trip(
    request: Request,
    trip_data: TripCreate,
    token_data: TokenData = Depends(require_permissions(["trips:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new trip"""
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Create new trip
    trip = Trip(
        user_id=user_id,
        company_id=tenant_id,
        branch=trip_data.branch,  # Contains branch UUID
        truck_plate=trip_data.truck_plate,
        truck_model=trip_data.truck_model,
        truck_capacity=trip_data.truck_capacity,
        driver_id=trip_data.driver_id,
        driver_name=trip_data.driver_name,
        driver_phone=trip_data.driver_phone,
        status=trip_data.status,
        origin=trip_data.origin,
        destination=trip_data.destination,
        distance=trip_data.distance,
        estimated_duration=trip_data.estimated_duration,
        pre_trip_time=trip_data.pre_trip_time,
        post_trip_time=trip_data.post_trip_time,
        capacity_total=trip_data.capacity_total,
        trip_date=trip_data.trip_date
    )

    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # Update truck and driver status to 'assigned' when trip is created
    await _update_resource_statuses_for_trip(
        trip.status or "planning",  # Use trip status or default to planning
        trip.truck_plate,
        trip.driver_id,
        auth_headers,
        tenant_id
    )

    # Send audit log
    audit_client = AuditClient(auth_headers)
    await audit_client.log_event(
        tenant_id=tenant_id,
        user_id=user_id,
        user_role=token_data.role,
        action="create",
        module="trips",
        entity_type="trip",
        entity_id=str(trip.id),
        description=f"Trip {trip.id} created for driver {trip.driver_name}",
        new_values={
            "driver_id": trip.driver_id,
            "truck_plate": trip.truck_plate,
            "status": trip.status,
            "origin": trip.origin,
            "destination": trip.destination
        }
    )
    await audit_client.close()

    return TripResponse(
        id=trip.id,
        user_id=trip.user_id,
        company_id=trip.company_id,
        branch=trip.branch,
        truck_plate=trip.truck_plate,
        truck_model=trip.truck_model,
        truck_capacity=trip.truck_capacity,
        driver_id=trip.driver_id,
        driver_name=trip.driver_name,
        driver_phone=trip.driver_phone,
        status=trip.status,
        origin=trip.origin,
        destination=trip.destination,
        distance=trip.distance,
        estimated_duration=trip.estimated_duration,
        pre_trip_time=trip.pre_trip_time,
        post_trip_time=trip.post_trip_time,
        capacity_used=trip.capacity_used or 0,
        capacity_total=trip.capacity_total,
        trip_date=trip.trip_date,
        maintenance_note=trip.maintenance_note,
        paused_at=trip.paused_at,
        paused_reason=trip.paused_reason,
        resumed_at=trip.resumed_at,
        created_at=trip.created_at,
        updated_at=trip.updated_at
    )


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update trip"""
    # Get authorization header for Orders service
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header
    # Get existing trip
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Store old status for comparison
    old_status = trip.status

    # Update trip fields
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)

    # If status changed, update item statuses in Orders service AND truck/driver status in Company service
    if 'status' in update_data and old_status != trip.status:
        # Special handling: loading -> planning transition
        # Reset all trip_item_assignments from 'loading' back to 'planning'
        # This allows user to resplit items
        if old_status == "loading" and trip.status == "planning":
            try:
                async with AsyncClient(timeout=10.0) as client:
                    response = await client.put(
                        f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/reset-to-planning",
                        params={"trip_id": trip_id, "tenant_id": tenant_id},
                        headers=auth_headers
                    )

                    if response.status_code == 200:
                        logger.info(f"Reset trip {trip_id} item assignments from loading to planning - items can be resplit")
                    else:
                        logger.warning(f"Failed to reset item statuses: {response.text}")
            except Exception as e:
                logger.warning(f"Error resetting item assignments for trip {trip_id}: {e}")

        # Update order item statuses
        await _update_order_item_statuses(trip_id, trip.status, auth_headers, token_data, tenant_id)

        # Update truck and driver statuses based on new trip status
        await _update_resource_statuses_for_trip(
            trip.status,
            trip.truck_plate,
            trip.driver_id,
            auth_headers,
            tenant_id
        )

        # Publish Kafka events for specific status changes
        if trip.status == "on-route" and old_status != "on-route":
            try:
                from src.services.kafka_producer import trip_event_producer
                trip_event_producer.publish_trip_on_route(
                    trip_id=str(trip.id),
                    tenant_id=tenant_id,
                    driver_id=trip.driver_id,
                    driver_name=trip.driver_name,
                    branch_id=trip.branch,
                    started_by=user_id,
                    started_by_role=token_data.role
                )
            except Exception as e:
                logger.error(f"Failed to publish trip.on_route event: {e}")

        # Write audit log for status change
        try:
            audit_client = AuditClient(auth_headers)
            await audit_client.log_event(
                tenant_id=tenant_id,
                user_id=user_id,
                user_role=token_data.role,
                action="status_change",
                module="trips",
                entity_type="trip",
                entity_id=str(trip.id),
                description=f"Trip {trip.id} status changed from {old_status} to {trip.status}",
                from_status=old_status,
                to_status=trip.status,
                old_values={"status": old_status},
                new_values={"status": trip.status}
            )
            await audit_client.close()
            logger.info(f"Trip {trip_id} status change audit log written: {old_status} -> {trip.status}")
        except Exception as e:
            logger.error(f"Failed to write audit log for trip status change: {e}")

    # Fetch orders for this trip to avoid lazy loading issues
    orders_query = select(TripOrder).where(
        TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number)

    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Manually construct TripResponse to avoid lazy loading serialization issues
    trip_response = {
        "id": trip.id,
        "user_id": trip.user_id,
        "company_id": trip.company_id,
        "branch": trip.branch,
        "truck_plate": trip.truck_plate,
        "truck_model": trip.truck_model,
        "truck_capacity": trip.truck_capacity,
        "driver_id": trip.driver_id,
        "driver_name": trip.driver_name,
        "driver_phone": trip.driver_phone,
        "status": trip.status,
        "origin": trip.origin,
        "destination": trip.destination,
        "distance": trip.distance,
        "estimated_duration": trip.estimated_duration,
        "pre_trip_time": trip.pre_trip_time,
        "post_trip_time": trip.post_trip_time,
        "capacity_used": trip.capacity_used,
        "capacity_total": trip.capacity_total,
        "trip_date": trip.trip_date,
        "created_at": trip.created_at,
        "updated_at": trip.updated_at,
        "orders": [
            {
                "id": order.id,
                "trip_id": order.trip_id,
                "user_id": order.user_id,
                "company_id": order.company_id,
                "order_id": order.order_id,
                "customer": order.customer,
                "customer_address": order.customer_address,
                "customer_contact": order.customer_contact,
                "customer_phone": order.customer_phone,
                "product_name": order.product_name,
                "trip_order_status": order.status,  # Renamed from 'status' - delivery progress status
                "total": order.total,
                "weight": order.weight,
                "volume": order.volume,
                "items": order.items,
                "quantity": order.quantity or 1,  # Default to 1 if null
                "priority": order.priority,
                "delivery_status": order.delivery_status or "pending",
                "sequence_number": order.sequence_number or 0,
                "address": order.address,
                "special_instructions": order.special_instructions,
                "delivery_instructions": order.delivery_instructions,
                "original_order_id": order.original_order_id,
                "original_items": order.original_items,
                "original_weight": order.original_weight,
                "assigned_at": order.assigned_at
            } for order in orders
        ]
    }

    return trip_response


@router.delete("/{trip_id}")
async def delete_trip(
    request: Request,
    trip_id: str,
    token_data: TokenData = Depends(require_permissions(["trips:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Delete trip"""
    # Get authorization header for Company service
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Get existing trip
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Store truck and driver info before deleting
    truck_plate = trip.truck_plate
    driver_id = trip.driver_id

    # Delete trip (orders will be deleted via cascade)
    await db.delete(trip)
    await db.commit()

    # Release truck and driver - set them back to available
    await _update_resource_statuses_for_trip(
        "cancelled",  # Use cancelled status mapping to release resources
        truck_plate,
        driver_id,
        auth_headers,
        tenant_id
    )

    return {"message": "Trip deleted successfully"}


@router.post("/{trip_id}/pause", response_model=TripResponse)
async def pause_trip(
    trip_id: str,
    pause_data: TripPause,
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["trips:update", "trips:pause"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Pause a trip due to maintenance or issues"""
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Get existing trip
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Validate trip can be paused (only loading or on-route can be paused)
    if trip.status not in ["loading", "on-route"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only pause trips in 'loading' or 'on-route' status. Current status: {trip.status}"
        )

    # Store old status for audit
    old_status = trip.status

    # Update trip to paused status
    trip.status = "paused"
    trip.paused_reason = pause_data.reason
    trip.maintenance_note = pause_data.note
    trip.paused_at = datetime.utcnow()

    await db.commit()
    await db.refresh(trip)

    # Update truck and driver statuses
    await _update_resource_statuses_for_trip(
        "paused",
        trip.truck_plate,
        trip.driver_id,
        auth_headers,
        tenant_id
    )

    # Publish Kafka event for trip pause
    try:
        from src.services.kafka_producer import trip_event_producer
        trip_event_producer.publish_trip_paused(
            trip_id=str(trip.id),
            tenant_id=tenant_id,
            driver_id=trip.driver_id,
            driver_name=trip.driver_name,
            branch_id=trip.branch,
            paused_by=user_id,
            paused_by_role=token_data.role,
            reason=pause_data.reason,
            note=pause_data.note
        )
    except Exception as e:
        logger.error(f"Failed to publish trip.paused event: {e}")

    # Send audit log
    audit_client = AuditClient(auth_headers)
    await audit_client.log_event(
        tenant_id=tenant_id,
        user_id=user_id,
        user_role=token_data.role,
        action="pause",
        module="trips",
        entity_type="trip",
        entity_id=str(trip.id),
        description=f"Trip {trip.id} paused due to {pause_data.reason}",
        from_status=old_status,
        to_status="paused",
        old_values={"status": old_status},
        new_values={
            "status": "paused",
            "paused_reason": pause_data.reason,
            "maintenance_note": pause_data.note,
            "paused_at": trip.paused_at.isoformat()
        }
    )
    await audit_client.close()

    return TripResponse(
        id=trip.id,
        user_id=trip.user_id,
        company_id=trip.company_id,
        branch=trip.branch,
        truck_plate=trip.truck_plate,
        truck_model=trip.truck_model,
        truck_capacity=trip.truck_capacity,
        driver_id=trip.driver_id,
        driver_name=trip.driver_name,
        driver_phone=trip.driver_phone,
        status=trip.status,
        origin=trip.origin,
        destination=trip.destination,
        distance=trip.distance,
        estimated_duration=trip.estimated_duration,
        pre_trip_time=trip.pre_trip_time,
        post_trip_time=trip.post_trip_time,
        capacity_used=trip.capacity_used or 0,
        capacity_total=trip.capacity_total,
        trip_date=trip.trip_date,
        maintenance_note=trip.maintenance_note,
        paused_at=trip.paused_at,
        paused_reason=trip.paused_reason,
        resumed_at=trip.resumed_at,
        created_at=trip.created_at,
        updated_at=trip.updated_at
    )


@router.post("/{trip_id}/resume", response_model=TripResponse)
async def resume_trip(
    trip_id: str,
    resume_data: TripResume,
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["trips:update", "trips:resume"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Resume a paused trip"""
    # Get authorization header for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Get existing trip
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Validate trip is paused
    if trip.status != "paused":
        raise HTTPException(
            status_code=400,
            detail=f"Can only resume trips in 'paused' status. Current status: {trip.status}"
        )

    # Update trip to on-route status
    trip.status = "on-route"
    trip.resumed_at = datetime.utcnow()

    # If resume note is provided, update maintenance_note
    if resume_data.note:
        trip.maintenance_note = resume_data.note

    await db.commit()
    await db.refresh(trip)

    # Update truck and driver statuses back to on-trip
    await _update_resource_statuses_for_trip(
        "on-route",
        trip.truck_plate,
        trip.driver_id,
        auth_headers,
        tenant_id
    )

    # Publish Kafka event for trip resume
    try:
        from src.services.kafka_producer import trip_event_producer
        trip_event_producer.publish_trip_resumed(
            trip_id=str(trip.id),
            tenant_id=tenant_id,
            driver_id=trip.driver_id,
            driver_name=trip.driver_name,
            branch_id=trip.branch,
            resumed_by=user_id,
            resumed_by_role=token_data.role,
            note=resume_data.note
        )
    except Exception as e:
        logger.error(f"Failed to publish trip.resumed event: {e}")

    # Send audit log
    audit_client = AuditClient(auth_headers)
    await audit_client.log_event(
        tenant_id=tenant_id,
        user_id=user_id,
        user_role=token_data.role,
        action="resume",
        module="trips",
        entity_type="trip",
        entity_id=str(trip.id),
        description=f"Trip {trip.id} resumed",
        from_status="paused",
        to_status="on-route",
        old_values={"status": "paused"},
        new_values={
            "status": "on-route",
            "resumed_at": trip.resumed_at.isoformat(),
            "maintenance_note": trip.maintenance_note
        }
    )
    await audit_client.close()

    return TripResponse(
        id=trip.id,
        user_id=trip.user_id,
        company_id=trip.company_id,
        branch=trip.branch,
        truck_plate=trip.truck_plate,
        truck_model=trip.truck_model,
        truck_capacity=trip.truck_capacity,
        driver_id=trip.driver_id,
        driver_name=trip.driver_name,
        driver_phone=trip.driver_phone,
        status=trip.status,
        origin=trip.origin,
        destination=trip.destination,
        distance=trip.distance,
        estimated_duration=trip.estimated_duration,
        pre_trip_time=trip.pre_trip_time,
        post_trip_time=trip.post_trip_time,
        capacity_used=trip.capacity_used or 0,
        capacity_total=trip.capacity_total,
        trip_date=trip.trip_date,
        maintenance_note=trip.maintenance_note,
        paused_at=trip.paused_at,
        paused_reason=trip.paused_reason,
        resumed_at=trip.resumed_at,
        created_at=trip.created_at,
        updated_at=trip.updated_at
    )


class TripReassignRequest(BaseModel):
    """Request model for reassigning trip resources"""
    truck_plate: str
    truck_model: str
    truck_capacity: int
    driver_id: str
    driver_name: str
    driver_phone: str


@router.post("/{trip_id}/reassign", response_model=TripResponse)
async def reassign_trip_resources(
    trip_id: str,
    resource_data: TripReassignRequest,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Reassign truck and driver to a paused trip.

    This allows logistics managers to assign new resources to a paused trip
    when the original truck is under maintenance or driver is unavailable.
    """
    logger.info(f"Reassigning resources for trip {trip_id}")

    # Get the trip
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Verify trip is in paused status
    if trip.status != "paused":
        raise HTTPException(
            status_code=400,
            detail=f"Can only reassign resources for paused trips. Current status: {trip.status}"
        )

    # Store old values for audit
    old_truck_plate = trip.truck_plate
    old_driver_id = trip.driver_id

    # Get authorization headers for service calls
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        # Update trip with new resources
        trip.truck_plate = resource_data.truck_plate
        trip.truck_model = resource_data.truck_model
        trip.truck_capacity = resource_data.truck_capacity
        trip.driver_id = resource_data.driver_id
        trip.driver_name = resource_data.driver_name
        trip.driver_phone = resource_data.driver_phone

        await db.commit()
        await db.refresh(trip)

        logger.info(f"Trip {trip_id} resources reassigned successfully")

        # Publish Kafka event for resource reassignment
        try:
            from src.services.kafka_producer import trip_event_producer
            trip_event_producer.publish_trip_resources_reassigned(
                trip_id=str(trip.id),
                tenant_id=tenant_id,
                branch_id=trip.branch,
                reassigned_by=user_id,
                old_truck_plate=old_truck_plate,
                new_truck_plate=trip.truck_plate,
                old_driver_id=old_driver_id,
                new_driver_id=trip.driver_id,
                new_driver_name=trip.driver_name,
                reassigned_by_role=token_data.role
            )
        except Exception as e:
            logger.error(f"Failed to publish trip.resources_reassigned event: {e}")

        # Audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            user_role=token_data.role,
            action="reassign",
            module="trips",
            entity_type="trip",
            entity_id=str(trip.id),
            description=f"Trip {trip_id} resources reassigned",
            old_values={
                "truck_plate": old_truck_plate,
                "driver_id": old_driver_id
            },
            new_values={
                "truck_plate": trip.truck_plate,
                "driver_id": trip.driver_id
            }
        )

        return TripResponse(
            id=trip.id,
            user_id=trip.user_id,
            company_id=trip.company_id,
            branch=trip.branch,
            truck_plate=trip.truck_plate,
            truck_model=trip.truck_model,
            truck_capacity=trip.truck_capacity,
            driver_id=trip.driver_id,
            driver_name=trip.driver_name,
            driver_phone=trip.driver_phone,
            status=trip.status,
            origin=trip.origin,
            destination=trip.destination,
            distance=trip.distance,
            estimated_duration=trip.estimated_duration,
            pre_trip_time=trip.pre_trip_time,
            post_trip_time=trip.post_trip_time,
            capacity_used=trip.capacity_used or 0,
            capacity_total=trip.capacity_total,
            trip_date=trip.trip_date,
            maintenance_note=trip.maintenance_note,
            paused_at=trip.paused_at,
            paused_reason=trip.paused_reason,
            resumed_at=trip.resumed_at,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            orders=[]  # Empty orders list for reassign response
        )

    except Exception as e:
        await db.rollback()
        logger.error(f"Error reassigning trip resources: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reassign trip resources: {str(e)}")


@router.post("/{trip_id}/check-completion")
async def check_trip_completion(
    trip_id: str,
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["trips:update", "driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Check if trip should be marked as completed (all orders delivered).
    If yes, update trip status and release resources.
    Called by driver service after order delivery/document upload.
    """
    # Get authorization header
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Call the completion check function
    await _check_trip_completion_and_update_status(trip_id, auth_headers, tenant_id)

    return {"message": "Trip completion check completed"}


@router.get("/{trip_id}/orders", response_model=List[TripOrderResponse])
async def get_trip_orders(
    trip_id: str,
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["trips:read_all", "trips:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all orders for a specific trip with real-time item assignment data.

    Fetches trip orders from TMS database and enriches them with real-time
    trip-item assignment data from Orders service to display correct quantities.
    """
    # Get authorization header for Orders service calls
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # First verify trip exists and belongs to tenant
    trip_query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    trip_result = await db.execute(trip_query)
    if not trip_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get orders ordered by sequence_number
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id)
    orders_query = orders_query.order_by(TripOrder.sequence_number)
    result = await db.execute(orders_query)
    orders = result.scalars().all()

    # If no orders, return empty list
    if not orders:
        return []

    # BULK FETCH: Get all trip-item assignments in a single request
    # This solves the N+1 query problem and ensures we get real-time data
    # Approach: Fetch orders from Orders service and extract order_numbers,
    # then use bulk-fetch with order_numbers
    bulk_assignments_data = {}

    try:
        async with AsyncClient(timeout=30.0) as client:
            # First, fetch all orders with their order_numbers
            # We'll filter by tenant_id and paginate to get all orders
            all_orders_list = []
            current_page = 1
            per_page = 100

            while True:
                params = {
                    "tenant_id": tenant_id,
                    "page": current_page,
                    "per_page": per_page
                }

                orders_response = await client.get(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/",
                    params=params,
                    headers=auth_headers
                )

                if orders_response.status_code != 200:
                    logger.warning(f"Failed to fetch orders: {orders_response.status_code}")
                    break

                data = orders_response.json()
                page_orders = data.get("items", [])
                if not page_orders:
                    break

                all_orders_list.extend(page_orders)

                # Check if we've fetched all pages
                total_pages = data.get("pages", 1)
                if current_page >= total_pages:
                    break
                current_page += 1

            # Filter to only orders in this trip and build order_numbers map
            trip_order_ids = {order.order_id for order in orders}
            order_numbers_map = {}  # order_id -> order_number
            trip_order_numbers = []

            for order_data in all_orders_list:
                if order_data.get("id") in trip_order_ids:
                    order_numbers_map[order_data["id"]] = order_data["order_number"]
                    trip_order_numbers.append(order_data["order_number"])

            # Now fetch trip-item assignments using order_numbers
            if trip_order_numbers:
                bulk_response = await client.post(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/bulk-fetch",
                    json={"order_numbers": trip_order_numbers},
                    headers=auth_headers
                )
                if bulk_response.status_code == 200:
                    # Create a map from order_number to assignments data
                    bulk_assignments_by_number = bulk_response.json()
                    # Convert to order_id map for easier lookup
                    bulk_assignments_data = {
                        order_id: bulk_assignments_by_number[order_number]
                        for order_id, order_number in order_numbers_map.items()
                        if order_number in bulk_assignments_by_number
                    }
                    logger.info(f"Fetched bulk assignments for {len(bulk_assignments_data)} orders for trip {trip_id}")
                else:
                    logger.warning(f"Bulk assignments request failed: {bulk_response.status_code}")

    except Exception as e:
        logger.error(f"Error fetching bulk assignments for trip {trip_id}: {str(e)}")
        bulk_assignments_data = {}

    # Enrich each order with real-time assignment data
    enriched_orders = []
    for order in orders:
        # Convert to dict for manipulation
        order_dict = {
            "id": order.id,
            "trip_id": order.trip_id,
            "user_id": order.user_id,
            "company_id": order.company_id,
            "order_id": order.order_id,
            "customer": order.customer,
            "customer_address": order.customer_address,
            "customer_contact": order.customer_contact,
            "customer_phone": order.customer_phone,
            "product_name": order.product_name,
            "trip_order_status": order.trip_order_status,
            "tms_order_status": order.tms_order_status,
            "item_status": order.item_status,
            "total": order.total,
            "weight": order.weight,
            "volume": order.volume,
            "items": order.items,
            "items_data": order.items_data,
            "items_json": order.items_json,
            "remaining_items_json": order.remaining_items_json,
            "quantity": order.quantity,
            "priority": order.priority,
            "delivery_status": order.delivery_status,
            "sequence_number": order.sequence_number,
            "address": order.address,
            "special_instructions": order.special_instructions,
            "delivery_instructions": order.delivery_instructions,
            "original_order_id": order.original_order_id,
            "original_items": order.original_items,
            "original_weight": order.original_weight,
            "assigned_at": order.assigned_at
        }

        # Get assignments data for this order
        assignments_data = bulk_assignments_data.get(order.order_id)

        if assignments_data and assignments_data.get("items"):
            items_info = assignments_data.get("items", [])

            # Debug logging
            logger.info(f"get_trip_orders: order_id={order.order_id}, items_count={len(items_info)}")

            # Filter assignments to only include items for THIS trip
            # and calculate correct quantities
            enriched_items = []
            total_assigned_qty = 0
            total_calculated_weight = 0

            for item_info in items_info:
                # Get assignments for this item
                assignments = item_info.get("assignments", [])

                # Filter to only assignments for THIS trip with active statuses
                trip_assignments = [
                    a for a in assignments
                    if a.get("trip_id") == trip_id
                    and a.get("item_status") in ["planning", "loading", "on_route", "delivered"]
                ]

                if trip_assignments:
                    # Calculate total assigned quantity for this trip
                    assigned_qty = sum(a.get("assigned_quantity", 0) for a in trip_assignments)
                    original_qty = item_info.get("original_quantity", item_info.get("quantity", 0))
                    weight_per_unit = item_info.get("weight", 0)

                    # Debug logging
                    logger.info(f"get_trip_orders: item={item_info.get('product_name')}, assigned_qty={assigned_qty}, original_qty={original_qty}")

                    # Create enriched item with correct assigned quantity
                    enriched_item = {
                        "id": item_info.get("id"),
                        "order_id": order.order_id,
                        "product_id": item_info.get("product_id"),
                        "product_name": item_info.get("product_name"),
                        "product_code": item_info.get("product_code"),
                        "quantity": assigned_qty,  # Use ASSIGNED quantity, not original
                        "original_quantity": original_qty,
                        "remaining_quantity": item_info.get("remaining_quantity", 0),
                        "weight": weight_per_unit,
                        "total_weight": assigned_qty * weight_per_unit,  # Recalculate based on assigned qty
                        "unit": item_info.get("unit"),
                        "unit_price": item_info.get("unit_price"),
                        "total_price": assigned_qty * item_info.get("unit_price", 0),  # Recalculate
                    }

                    enriched_items.append(enriched_item)
                    total_assigned_qty += assigned_qty
                    total_calculated_weight += enriched_item["total_weight"]

            # Update order dict with enriched data
            if enriched_items:
                order_dict["items_json"] = enriched_items
                order_dict["items_data"] = enriched_items  # Also update items_data for frontend
                order_dict["quantity"] = total_assigned_qty  # Sum of assigned quantities
                order_dict["weight"] = total_calculated_weight  # Recalculated from assigned quantities
                order_dict["items"] = len(enriched_items)

                logger.info(f"get_trip_orders: order {order.order_id} - total_assigned_qty={total_assigned_qty}, total_weight={total_calculated_weight}")

                # Update tms_order_status based on assignments
                summary = assignments_data.get("summary", {})
                if summary.get("is_fully_assigned"):
                    order_dict["tms_order_status"] = "fully_assigned"
                elif summary.get("is_partially_assigned"):
                    order_dict["tms_order_status"] = "partial"
                else:
                    order_dict["tms_order_status"] = "available"

        enriched_orders.append(TripOrderResponse(**order_dict))

    return enriched_orders


@router.post("/{trip_id}/orders", response_model=MessageResponse)
async def assign_orders_to_trip(
    trip_id: str,
    request: Request,
    order_request: AssignOrdersRequest,
    token_data: TokenData = Depends(require_permissions(["trips:assign"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Assign orders to a trip"""
    # Get authorization header for both Orders service and audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Verify trip exists and belongs to tenant
    trip_query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.company_id == tenant_id
        )
    )
    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != "planning":
        raise HTTPException(
            status_code=400,
            detail="Can only assign orders to trips in planning status"
        )

    # Calculate total weight for new orders
    # If items_json is provided, calculate weight from items (quantity × weight_per_unit)
    # Otherwise use the order.weight field
    total_new_weight = 0
    for order in order_request.orders:
        if order.items_json and len(order.items_json) > 0:
            # Calculate weight from items_json: sum of (quantity × weight) for each item
            for item in order.items_json:
                item_qty = item.get("quantity", 1)
                # weight can be per-unit weight or total_weight for the item
                item_weight = item.get("weight", 0)
                # Check if this is per-unit weight or total weight
                # If total_weight is provided, use it; otherwise calculate from weight × quantity
                if "total_weight" in item and item["total_weight"]:
                    total_new_weight += item["total_weight"]
                else:
                    total_new_weight += item_qty * item_weight
        else:
            # No items_json provided, use order.weight (should be total weight)
            total_new_weight += order.weight

    new_capacity_used = (trip.capacity_used or 0) + total_new_weight

    # Check capacity (non-blocking warning for planning stage)
    if new_capacity_used > trip.capacity_total:
        logger.warning(
            f"Trip {trip_id} capacity exceeded: {new_capacity_used}kg / {trip.capacity_total}kg. "
            f"Overage: {new_capacity_used - trip.capacity_total}kg. "
            f"Assignment allowed (planning stage)."
        )
        # Continue with assignment (don't raise HTTPException)

    # Check if any orders are already assigned to another trip (not split orders)
    # Use trip_item_assignments endpoint to check actual remaining quantities
    for order_data in order_request.orders:
        if not order_data.original_order_id:  # Only check non-split orders
            # Check with Orders service if this order has remaining items
            async with AsyncClient(timeout=10.0) as client:
                assignments_response = await client.get(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/order/{order_data.order_id}?tenant_id={tenant_id}",
                    headers=auth_headers
                )

                if assignments_response.status_code == 200:
                    assignments_data = assignments_response.json()
                    summary = assignments_data.get("summary", {})

                    # If order is fully assigned (no remaining items), prevent reassignment
                    if summary.get("is_fully_assigned"):
                        # Find which trip has this order fully assigned
                        items = assignments_data.get("items", [])
                        if items and items[0].get("assignments"):
                            assigned_trip = items[0]["assignments"][0]["trip_id"]
                            raise HTTPException(
                                status_code=400,
                                detail=f"Order {order_data.order_id} is already fully assigned to trip {assigned_trip} and has no remaining items"
                            )
                    # If partially assigned, allow - the frontend should only send remaining items
                    elif summary.get("is_partially_assigned"):
                        logger.info(f"Order {order_data.order_id} is partially assigned, allowing assignment of remaining items")
                else:
                    logger.warning(f"Could not verify assignment status for order {order_data.order_id}, proceeding with caution")

    # Get the current highest sequence number for this trip
    max_seq_query = select(TripOrder.sequence_number).where(
        TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number.desc()).limit(1)
    max_seq_result = await db.execute(max_seq_query)
    max_seq = max_seq_result.scalar() or -1

    # Add orders to trip with sequential sequence numbers
    created_orders = []
    rollback_actions = []  # Track actions for rollback in case of failure

    try:
        for idx, order_data in enumerate(order_request.orders):
            # Get order data dict without user_id, company_id, and json fields to avoid conflicts
            # Use model_dump(mode='json') to properly serialize enum values to strings
            order_dict = order_data.model_dump(mode='json', exclude={'user_id', 'company_id', 'items_json', 'remaining_items_json'})

            # Determine TMS order status and whether this is assigning remaining items from a partial order
            tms_status = "available"
            is_assigning_remaining = False

            if order_data.original_order_id:
                # This is a split order (from UI split functionality)
                # Check if there are remaining items
                if order_data.remaining_items_json and len(order_data.remaining_items_json) > 0:
                    tms_status = "partial"
                else:
                    tms_status = "fully_assigned"
            elif order_data.items_json and len(order_data.items_json) > 0:
                # This is assigning specific items (could be remaining items from a partial order)
                # Check if this matches the remaining items count from a partial order
                if len(order_data.items_json) < (order_data.original_items or order_data.items):
                    # Partial assignment - there are still items remaining
                    tms_status = "partial"
                    is_assigning_remaining = True
                else:
                    # Full assignment - all items now assigned
                    tms_status = "fully_assigned"
                    is_assigning_remaining = True
            else:
                # No items_json provided - full assignment of all items
                tms_status = "fully_assigned"

            trip_order = TripOrder(
                trip_id=trip_id,
                sequence_number=max_seq + idx + 1,  # Assign sequential sequence numbers
                user_id=user_id,
                company_id=tenant_id,  # Use tenant_id as company_id for multi-tenancy
                tms_order_status=tms_status,
                items_json=order_data.items_json,  # Store assigned items in trip_orders
                remaining_items_json=order_data.remaining_items_json,  # Store remaining items (if any)
                **order_dict
            )
            created_orders.append(trip_order)
            db.add(trip_order)

            # Update order status in Orders service
            # We update for all orders (both split and non-split) to keep the Orders service in sync
            # Create trip-item assignments in Orders service for tracking
            # This replaces the old item_status logic with the new trip_item_assignments table
            try:
                # Prepare the update payload
                update_payload = {
                    "order_id": order_data.order_id,
                    "tms_order_status": tms_status,
                    "items_json": order_data.items_json,
                    "remaining_items_json": order_data.remaining_items_json
                }

                # If assigning remaining items from a partial order, we need to update properly
                if is_assigning_remaining and order_data.remaining_items_json is not None:
                    if len(order_data.remaining_items_json) == 0:
                        # All remaining items assigned - mark as fully_assigned
                        update_payload["tms_order_status"] = "fully_assigned"
                        logger.info(f"Order {order_data.order_id} fully assigned - no remaining items")
                    else:
                        # Still has remaining items
                        update_payload["tms_order_status"] = "partial"
                        logger.info(f"Order {order_data.order_id} still has {len(order_data.remaining_items_json)} remaining items")

                # Create client outside so it can be used for both operations
                async with AsyncClient(timeout=10.0) as client:
                    # Update the order's tms_order_status, items_json, and remaining_items_json via Orders service
                    update_response = await client.patch(
                        f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/tms-status",
                        headers=auth_headers,
                        json=update_payload
                    )
                    if update_response.status_code != 200:
                        raise Exception(f"Failed to update TMS status: {update_response.text}")
                    else:
                        logger.info(f"Successfully updated order {order_data.order_id} to tms_status={update_payload['tms_order_status']}")
                        # Track for rollback
                        rollback_actions.append({
                            "action": "tms_status_update",
                            "order_id": order_data.order_id,
                            "previous_status": "available"  # We'll need to track this better
                        })

                    # Create trip-item assignments in Orders service for tracking
                    if order_data.items_json and len(order_data.items_json) > 0:
                        logger.info(f"Preparing to create trip-item assignments for order {order_data.order_id} with {len(order_data.items_json)} items")

                        # Build assignment items list from items_json
                        assignment_items = []
                        for item in order_data.items_json:
                            order_item_id = item.get("id")
                            logger.info(f"Processing item: {order_item_id}, product: {item.get('product_name')}")

                            assignment_items.append({
                                "order_id": item.get("order_id"),  # Use the order_id from items_json
                                "order_item_id": order_item_id,
                                "assigned_quantity": item.get("quantity", 1),
                                "item_status": "planning"
                            })

                        logger.info(f"Built {len(assignment_items)} assignment_items")

                        if assignment_items:
                            # Call the new bulk create endpoint
                            bulk_payload = {
                                "trip_id": trip_id,
                                "order_number": order_data.order_id,
                                "tenant_id": tenant_id,
                                "items": assignment_items
                            }

                            logger.info(f"Calling bulk create endpoint with payload: {bulk_payload}")

                            assignment_response = await client.post(
                                f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/bulk",
                                headers=auth_headers,
                                json=bulk_payload
                            )
                            logger.info(f"Bulk create response status: {assignment_response.status_code}")

                            if assignment_response.status_code != 200:
                                logger.error(f"Failed to create trip-item assignments: {assignment_response.text}")
                                raise Exception(f"Failed to create trip-item assignments: {assignment_response.text}")
                            else:
                                result = assignment_response.json()
                                logger.info(f"Created trip-item assignments for order {order_data.order_id}: {result}")
                                # Track for rollback
                                rollback_actions.append({
                                    "action": "create_assignments",
                                    "trip_id": trip_id,
                                    "order_number": order_data.order_id
                                })
                        else:
                            logger.warning(f"No assignment_items built for order {order_data.order_id}")
                    else:
                        logger.warning(f"No items_json for order {order_data.order_id}, skipping trip-item assignments creation")

            except Exception as e:
                # Rollback: Delete the trip_order we just added
                logger.error(f"Error updating order {order_data.order_id} in Orders service: {str(e)}", exc_info=True)

                # Remove trip_order from session
                db.expunge(trip_order)
                created_orders.remove(trip_order)

                # Attempt to rollback any actions taken in Orders service
                for action in reversed(rollback_actions):
                    try:
                        async with AsyncClient(timeout=10.0) as client:
                            if action["action"] == "tms_status_update":
                                # Reset TMS status to available
                                await client.patch(
                                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/tms-status",
                                    headers=auth_headers,
                                    json={
                                        "order_id": action["order_id"],
                                        "tms_order_status": "available",
                                        "items_json": [],
                                        "remaining_items_json": order_data.items_json  # Return items to available
                                    }
                                )
                                logger.info(f"Rolled back TMS status for order {action['order_id']}")
                    except Exception as rollback_error:
                        logger.error(f"Failed to rollback action {action}: {rollback_error}")

                # Re-raise the exception to fail the entire assignment
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to assign order {order_data.order_id}: {str(e)}. All changes rolled back."
                )

        # Update trip capacity_used
        # Calculate weight from items_json if available, otherwise use order.weight
        total_weight = 0
        for order in created_orders:
            if order.items_json and len(order.items_json) > 0:
                # Calculate weight from items_json
                for item in order.items_json:
                    item_qty = item.get("quantity", 1)
                    if "total_weight" in item and item["total_weight"]:
                        total_weight += item["total_weight"]
                    else:
                        total_weight += item_qty * item.get("weight", 0)
            else:
                total_weight += order.weight

        trip.capacity_used = (trip.capacity_used or 0) + total_weight
        db.add(trip)

        await db.commit()

    except Exception as e:
        # Any unexpected error - rollback everything
        logger.error(f"Unexpected error during order assignment: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during order assignment: {str(e)}"
        )

    # Send audit log (only if we got here successfully)
    audit_client = AuditClient(auth_headers)
    await audit_client.log_event(
        tenant_id=tenant_id,
        user_id=user_id,
        user_role=token_data.role,
        action="assign",
        module="trips",
        entity_type="trip_order",
        entity_id=f"{trip_id}:{len(order_request.orders)}",
        description=f"Assigned {len(order_request.orders)} orders to trip {trip_id}",
        new_values={
            "trip_id": trip_id,
            "order_count": len(order_request.orders),
            "total_weight": total_weight
        }
    )
    await audit_client.close()

    return MessageResponse(message=f"Successfully assigned {len(order_request.orders)} orders to trip {trip_id}")


@router.put("/{trip_id}/orders/reorder", response_model=MessageResponse)
async def reorder_trip_orders(
    trip_id: str,
    request: ReorderOrdersRequest,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(
        None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Reorder the sequence of orders in a trip"""
    # Verify trip exists and is in planning status
    trip_query = select(Trip).where(Trip.id == trip_id)

    # Add tenant filtering
    trip_query = trip_query.where(Trip.company_id == tenant_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        trip_query = trip_query.where(Trip.user_id == user_id)
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != "planning":
        raise HTTPException(
            status_code=400,
            detail="Can only reorder orders in trips with planning status"
        )

    # Validate all order IDs belong to this trip
    order_ids = [item["order_id"] for item in request.order_sequences]

    # Check if all orders exist and belong to this trip
    existing_orders_query = select(TripOrder).where(
        and_(
            TripOrder.id.in_(order_ids),
            TripOrder.trip_id == trip_id
        )
    )
    if user_id:
        existing_orders_query = existing_orders_query.where(
            TripOrder.user_id == user_id)
    if company_id:
        existing_orders_query = existing_orders_query.where(
            TripOrder.company_id == company_id)

    existing_orders_result = await db.execute(existing_orders_query)
    existing_orders = existing_orders_result.scalars().all()

    if len(existing_orders) != len(order_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more orders do not exist or do not belong to this trip"
        )

    # Update sequence numbers
    for item in request.order_sequences:
        order_id = item["order_id"]
        sequence_number = item["sequence_number"]

        update_query = update(TripOrder).where(
            and_(
                TripOrder.id == order_id,
                TripOrder.trip_id == trip_id
            )
        ).values(sequence_number=sequence_number)

        if user_id:
            update_query = update_query.where(TripOrder.user_id == user_id)
        if company_id:
            update_query = update_query.where(
                TripOrder.company_id == company_id)

        await db.execute(update_query)

    await db.commit()

    return MessageResponse(message=f"Successfully reordered {len(request.order_sequences)} orders in trip {trip_id}")


@router.delete("/{trip_id}/orders/remove", response_model=MessageResponse)
async def remove_order_from_trip(
    trip_id: str,
    request: Request,
    order_id: str = Query(..., description="Order ID to remove"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(
        None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Remove an order from a trip"""
    # Get authorization header for Orders service
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header
    # Verify trip exists and is in planning status
    trip_query = select(Trip).where(Trip.id == trip_id)

    # Add tenant filtering
    trip_query = trip_query.where(Trip.company_id == tenant_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        trip_query = trip_query.where(Trip.user_id == user_id)
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != "planning":
        raise HTTPException(
            status_code=400,
            detail="Can only remove orders from trips with planning status"
        )

    # Find the order to remove
    order_query = select(TripOrder).where(
        and_(
            TripOrder.trip_id == trip_id,
            TripOrder.order_id == order_id
        )
    )
    if user_id:
        order_query = order_query.where(TripOrder.user_id == user_id)
    if company_id:
        order_query = order_query.where(TripOrder.company_id == company_id)

    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found in this trip"
        )

    # Store the weight for capacity update
    removed_weight = order.weight

    # Delete the order
    await db.delete(order)
    await db.commit()

    # Update trip capacity
    if trip.capacity_used is not None:
        trip.capacity_used = max(0, trip.capacity_used - removed_weight)
        await db.commit()

    # Update Orders service with the removed items and recalculate TMS status
    try:
        # Check if there are other trip_orders for this order (partial assignments in other trips)
        other_assignments_query = select(TripOrder).where(
            and_(
                TripOrder.order_id == order_id,
                TripOrder.id != order.id  # Exclude the one being deleted
            )
        )
        other_assignments_result = await db.execute(other_assignments_query)
        other_assignments = other_assignments_result.scalars().all()

        # Collect all assigned items from other trips (items still assigned)
        all_assigned_items = []
        for assignment in other_assignments:
            if assignment.items_json:
                all_assigned_items.extend(assignment.items_json)

        # Get the removed items (from this trip_order being deleted)
        removed_items = order.items_json if order.items_json else []

        # Get the current state from Orders service to find authoritative remaining_items
        # We'll calculate what the new remaining_items should be
        async with AsyncClient(timeout=10.0) as client:
            # Fetch current order state from Orders service
            orders_response = await client.get(
                f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/?order_number={order_id}&tenant_id={tenant_id}",
                headers=auth_headers
            )

            current_remaining_items = []
            if orders_response.status_code == 200:
                orders_data = orders_response.json()
                if orders_data.get("data") and len(orders_data["data"]) > 0:
                    current_order = orders_data["data"][0]
                    # Get the authoritative remaining_items_json from Orders service
                    current_remaining_items = current_order.get("remaining_items_json", [])

            # Calculate new remaining_items: current remaining + removed items
            # We need to merge items by ID, summing up quantities for duplicates
            new_remaining_items = list(current_remaining_items)  # Start with current

            # Build a map of existing items by ID for easy lookup and quantity summation
            remaining_items_map = {}
            for item in new_remaining_items:
                item_id = item.get("id")
                if item_id:
                    if item_id not in remaining_items_map:
                        remaining_items_map[item_id] = item
                    else:
                        # Item already exists, sum up quantities
                        existing_item = remaining_items_map[item_id]
                        existing_quantity = existing_item.get("quantity", 0)
                        removed_quantity = item.get("quantity", 0)
                        existing_item["quantity"] = existing_quantity + removed_quantity
                        # Also update total_weight if present
                        existing_weight = existing_item.get("total_weight", 0)
                        removed_weight = item.get("total_weight", 0)
                        existing_item["total_weight"] = existing_weight + removed_weight
                else:
                    # No ID, keep as is (shouldn't happen normally)
                    remaining_items_map[f"_no_id_{len(remaining_items_map)}"] = item

            # Add removed items back, summing quantities if item already exists
            for removed_item in removed_items:
                item_id = removed_item.get("id")
                if item_id:
                    if item_id in remaining_items_map:
                        # Item already exists in remaining, sum up quantities
                        existing_item = remaining_items_map[item_id]
                        existing_quantity = existing_item.get("quantity", 0)
                        removed_quantity = removed_item.get("quantity", 0)
                        existing_item["quantity"] = existing_quantity + removed_quantity
                        # Also update total_weight if present
                        existing_weight = existing_item.get("total_weight", 0)
                        removed_weight = removed_item.get("total_weight", 0)
                        existing_item["total_weight"] = existing_weight + removed_weight
                        logger.info(f"Summing quantities for item {item_id}: {existing_quantity} + {removed_quantity} = {existing_item['quantity']}")
                    else:
                        # New item, add it to the map
                        remaining_items_map[item_id] = removed_item
                        logger.info(f"Adding new remaining item {item_id} with quantity {removed_item.get('quantity', 0)}")
                else:
                    # No ID, just append it (shouldn't happen normally)
                    new_remaining_items.append(removed_item)

            # Convert map back to list
            all_remaining_items = list(remaining_items_map.values())

            # Prepare the update payload for Orders service
            tms_status_payload = {
                "order_id": order_id,
                "tms_order_status": "available",  # Default to available
                "items_json": all_assigned_items if all_assigned_items else [],
                "remaining_items_json": all_remaining_items if all_remaining_items else []
            }

            # Determine the correct TMS status
            if all_assigned_items:
                # There are still items assigned in other trips
                if all_remaining_items:
                    # Some items are still remaining
                    tms_status_payload["tms_order_status"] = "partial"
                else:
                    # All items are assigned (in other trips)
                    tms_status_payload["tms_order_status"] = "fully_assigned"
                logger.info(f"Order {order_id} has {len(all_assigned_items)} items still assigned, {len(all_remaining_items)} remaining")
            else:
                # No items assigned anymore - order is fully available
                tms_status_payload["tms_order_status"] = "available"
                tms_status_payload["items_json"] = []
                logger.info(f"Order {order_id} is now fully available - returning {len(all_remaining_items)} items to pool")

            # Debug logging
            logger.info(f"Sending to Orders service: order_id={order_id}, tms_status={tms_status_payload['tms_order_status']}, "
                       f"items_json count={len(tms_status_payload.get('items_json', []))}, "
                       f"remaining_items_json count={len(tms_status_payload.get('remaining_items_json', []))}")

            # Update the TMS status via Orders service (reuse the same client)
            tms_response = await client.patch(
                f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/tms-status",
                headers=auth_headers,
                json=tms_status_payload
            )
            if tms_response.status_code == 200:
                logger.info(f"Updated TMS status for order {order_id} to {tms_status_payload['tms_order_status']}")
            else:
                logger.error(f"Failed to update TMS status for order {order_id}: {tms_response.text}")

        # Now update individual item statuses in Orders service
        # NOTE: We always update item status in Orders DB for tracking purposes
        # For split/partial orders, we pass specific item_ids
        try:
            # Extract item IDs from items_json if this is a split/partial assignment
            item_ids = None
            if order.items_json and len(order.items_json) > 0:
                # This is a split/partial assignment - get the specific item IDs being removed
                item_ids = [item.get('id') for item in order.items_json if item.get('id')]
                logger.info(f"Split/partial removal for order {order_id} - resetting {len(item_ids)} specific items")

            # Build item status payload
            item_status_payload = {
                "order_id": order_id,
                "trip_id": trip_id,  # Pass the trip_id being removed from
                "remove_from_trip": True,  # Flag to indicate removal
                "item_status": "pending_to_assign"
            }
            # Only include item_ids if we have specific items (split assignment)
            if item_ids:
                item_status_payload["item_ids"] = item_ids

            async with AsyncClient(timeout=10.0) as client:
                item_status_response = await client.post(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/item-status",
                    headers=auth_headers,
                    json=item_status_payload
                )
                if item_status_response.status_code == 200:
                    result = item_status_response.json()
                    logger.info(f"Reset item status for order {order_id} ({len(item_ids) if item_ids else 'all'} items): {result.get('message')}")
                else:
                    logger.error(f"Failed to reset item status for order {order_id}: {item_status_response.text}")
        except Exception as e:
            logger.error(f"Error updating item status for order {order_id}: {str(e)}", exc_info=True)
            # Don't fail the removal if status update fails
    except Exception as e:
        logger.error(f"Error updating Orders service for order {order_id}: {str(e)}", exc_info=True)
        # Don't fail the removal if status update fails


# =============================================================================
# LOADING STAGE ENDPOINTS
# =============================================================================

@router.post("/{trip_id}/prepare-loading")
async def prepare_trip_for_loading(
    trip_id: str,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate trip and return pending items that need assignment before loading.
    Called when user attempts to change trip status to 'loading'.

    Returns:
    - List of pending items (not yet assigned to loading)
    - Capacity information
    - Validation errors if any
    """
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Get trip
    trip_query = select(Trip).where(
        and_(Trip.id == trip_id, Trip.company_id == tenant_id)
    )
    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != "planning":
        raise HTTPException(
            status_code=400,
            detail=f"Can only prepare trips in 'planning' status. Current: {trip.status}"
        )

    # Get trip orders
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id)
    orders_result = await db.execute(orders_query)
    trip_orders = orders_result.scalars().all()

    if not trip_orders:
        raise HTTPException(
            status_code=400,
            detail="Cannot change to loading: Trip has no orders"
        )

    # Fetch pending items from Orders service
    pending_items = []
    total_weight = 0

    for trip_order in trip_orders:
        items_data = None
        order_items = {}  # Use dict to aggregate by order_item_id

        # Try to fetch from Orders service
        try:
            async with AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/order/{trip_order.order_id}",
                    params={"tenant_id": tenant_id},
                    headers=auth_headers
                )

                if response.status_code == 200:
                    data = response.json()
                    items_data = data.get("items", [])
                    items = items_data

                    for item in items:
                        # Filter items assigned to THIS trip with "planning" status
                        assignments = item.get("assignments", [])
                        trip_assignments = [
                            a for a in assignments
                            if a.get("trip_id") == trip_id and a.get("item_status") == "planning"
                        ]

                        if trip_assignments:
                            # Aggregate quantities for same order_item_id
                            item_id = item.get("id")
                            if item_id not in order_items:
                                original_quantity = item.get("original_quantity", item.get("quantity", 0))
                                order_items[item_id] = {
                                    "order_id": trip_order.order_id,
                                    "customer": trip_order.customer,
                                    "order_item_id": item_id,
                                    "product_name": item.get("product_name"),
                                    "product_code": item.get("product_code"),
                                    "original_quantity": original_quantity,  # From order_items (never modified)
                                    "assigned_quantity": 0,
                                    "remaining_quantity": item.get("remaining_quantity", 0),
                                    "weight_per_unit": item.get("weight", 0),
                                    "item_status": "planning",
                                    "max_assignable": original_quantity  # Cannot exceed original
                                }

                            # Sum up quantities from all assignments
                            for assignment in trip_assignments:
                                order_items[item_id]["assigned_quantity"] += assignment.get("assigned_quantity", 0)

                    # Calculate total weight and add to pending_items
                    for item_data in order_items.values():
                        # Calculate remaining quantity correctly
                        # remaining_quantity = original_quantity - assigned_quantity (what's still available to assign)
                        item_data["remaining_quantity"] = item_data["original_quantity"] - item_data["assigned_quantity"]

                        item_weight = (
                            (item_data["assigned_quantity"] * item_data["weight_per_unit"])
                            if item_data["weight_per_unit"]
                            else 0
                        )
                        item_data["total_weight"] = item_weight
                        pending_items.append(item_data)
                        total_weight += item_weight
                else:
                    logger.warning(f"Failed to fetch items for order {trip_order.order_id}: {response.text}")
        except Exception as e:
            logger.warning(f"Error fetching items from Orders service for order {trip_order.order_id}: {e}")

        # Fallback: Use items_json from trip_order if API call failed or returned no items
        if not items_data or len(pending_items) == 0:
            items_json = trip_order.items_json or []
            if items_json:
                for item in items_json:
                    item_id = item.get("id") or f"{trip_order.order_id}_{item.get('product_name', 'unknown')}"
                    original_quantity = item.get("quantity", 1)
                    item_weight = (
                        (original_quantity * item.get("weight", 0))
                        if item.get("weight")
                        else item.get("total_weight", 0)
                    )
                    pending_items.append({
                        "order_id": trip_order.order_id,
                        "customer": trip_order.customer,
                        "order_item_id": item_id,
                        "product_name": trip_order.product_name or item.get("product_name", "N/A"),
                        "product_code": item.get("product_code"),
                        "original_quantity": original_quantity,  # From order_items (never modified)
                        "assigned_quantity": original_quantity,  # Currently assigned (planning)
                        "remaining_quantity": 0,
                        "weight_per_unit": item.get("weight", 0),
                        "total_weight": item_weight,
                        "item_status": "planning",
                        "max_assignable": original_quantity  # Cannot exceed original
                    })
                    total_weight += item_weight

    # Check capacity
    is_over_capacity = total_weight > trip.capacity_total
    capacity_shortage = max(0, total_weight - trip.capacity_total)

    return {
        "trip_id": trip_id,
        "pending_items": pending_items,
        "total_weight": total_weight,
        "capacity_total": trip.capacity_total,
        "capacity_used": trip.capacity_used or 0,
        "is_over_capacity": is_over_capacity,
        "capacity_shortage": capacity_shortage,
        "requires_splitting": is_over_capacity
    }


@router.post("/{trip_id}/confirm-loading")
async def confirm_loading_assignment(
    trip_id: str,
    confirmation: LoadingConfirmationRequest,
    request: Request,
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm item assignments and change trip status to 'loading'.

    DECISION STAGE LOGIC:
    - User explicitly decides quantities for each item
    - Can assign: full quantity, partial quantity, or skip (0)
    - Updates trip_item_assignments with new quantities
    - Updates item_status from 'planning' to 'loading'
    - Validates capacity BEFORE confirming

    For each item decision:
    - If assigned_quantity > 0: Update trip_item_assignment record
    - If assigned_quantity = 0: Delete the trip_item_assignment record (item skipped)
    """
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Get trip
    trip_query = select(Trip).where(
        and_(Trip.id == trip_id, Trip.company_id == tenant_id)
    )
    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != "planning":
        raise HTTPException(
            status_code=400,
            detail=f"Can only confirm loading for trips in 'planning' status. Current: {trip.status}"
        )

    # Calculate total assigned weight from user decisions
    total_assigned_weight = sum(
        item.get("assigned_quantity", 0) * item.get("weight_per_unit", 0)
        for item in confirmation.item_assignments
    )

    # Validate capacity
    if total_assigned_weight > trip.capacity_total:
        raise HTTPException(
            status_code=400,
            detail=f"Items exceed capacity: {total_assigned_weight}kg > {trip.capacity_total}kg. "
                   f"Please reduce quantities or split across multiple trips."
        )

    try:
        # Step 1: Update trip_item_assignments in Orders service
        # For each item decision:
        # - If qty > 0: Update assigned_quantity and set item_status='loading'
        # - If qty = 0: Delete the trip_item_assignment record (item skipped)

        items_confirmed = 0
        items_skipped = 0

        async with AsyncClient(timeout=30.0) as client:
            for item_decision in confirmation.item_assignments:
                order_item_id = item_decision.get("order_item_id")
                assigned_qty = item_decision.get("assigned_quantity", 0)
                order_id = item_decision.get("order_id")

                if assigned_qty > 0:
                    # User confirmed this item - update the assignment
                    update_payload = {
                        "trip_id": trip_id,
                        "order_item_id": order_item_id,
                        "assigned_quantity": assigned_qty,
                        "item_status": "loading"
                    }

                    # Call Orders service to update trip_item_assignment
                    response = await client.put(
                        f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/update-quantity",
                        headers=auth_headers,
                        json=update_payload
                    )

                    if response.status_code != 200:
                        raise Exception(f"Failed to update assignment for item {order_item_id}: {response.text}")

                    items_confirmed += 1

                else:
                    # User skipped this item (qty = 0) - delete the assignment
                    delete_payload = {
                        "trip_id": trip_id,
                        "order_item_id": order_item_id
                    }

                    response = await client.request(
                        "DELETE",
                        f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/trip-item-assignments/delete",
                        headers=auth_headers,
                        json=delete_payload
                    )

                    if response.status_code != 200:
                        logger.warning(f"Failed to delete assignment for item {order_item_id}: {response.text}")

                    items_skipped += 1

            # Handle split items if user decided to split
            if confirmation.split_items and len(confirmation.split_items) > 0:
                # Create new trip orders for split portions
                # This would create a new trip or assign to existing planning trip
                logger.info(f"Processing {len(confirmation.split_items)} split items")
                # Implementation: Create new trip_order with remaining quantities
                # For now, log and continue
                for split_item in confirmation.split_items:
                    logger.info(f"Split item {split_item.get('order_item_id')}: {split_item.get('remaining_quantity')} remaining")

        # Step 2: Update trip status to loading
        trip.status = "loading"
        trip.capacity_used = total_assigned_weight
        await db.commit()

        # Step 3: Update truck/driver status via existing function
        await _update_resource_statuses_for_trip(
            "loading",
            trip.truck_plate,
            trip.driver_id,
            auth_headers,
            tenant_id
        )

        # Publish Kafka event for loading started
        try:
            from src.services.kafka_producer import trip_event_producer
            trip_event_producer.publish_trip_loading_started(
                trip_id=trip_id,
                tenant_id=tenant_id,
                driver_id=trip.driver_id,
                driver_name=trip.driver_name,
                branch_id=trip.branch,
                started_by=user_id,
                started_by_role=token_data.role
            )
        except Exception as e:
            logger.error(f"Failed to publish trip.loading_started event: {e}")

        # Step 4: Audit log
        audit_client = AuditClient(auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            user_role=token_data.role,
            action="status_change",
            module="trips",
            entity_type="trip",
            entity_id=trip_id,
            description=f"Trip {trip_id} changed to loading status with {items_confirmed} items confirmed, {items_skipped} skipped (total: {total_assigned_weight}kg)",
            from_status="planning",
            to_status="loading",
            old_values={"status": "planning"},
            new_values={"status": "loading", "capacity_used": total_assigned_weight}
        )
        await audit_client.close()

        return {
            "message": f"Trip {trip_id} successfully moved to loading status",
            "total_weight": total_assigned_weight,
            "items_confirmed": items_confirmed,
            "items_skipped": items_skipped
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"Error confirming loading assignment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to confirm loading assignment: {str(e)}"
        )