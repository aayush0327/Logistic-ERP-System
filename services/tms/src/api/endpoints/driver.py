"""Driver API endpoints - providing driver-specific data to the Driver Service"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Request
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update, func
from datetime import date, datetime

from src.database import get_async_session, Trip, TripOrder, TMSAuditLog

logger = logging.getLogger(__name__)
from src.schemas import (
    TripResponse, TripWithOrders, TripOrderResponse,
    DeliveryUpdate, DriverTripListResponse, DriverTripDetailResponse,
    MessageResponse
)
from src.services.orders_service_client import orders_client, OrdersServiceUnavailable
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)

router = APIRouter()


@router.get("/trips", response_model=DriverTripListResponse)
async def get_driver_trips(
    driver_id: str = Query(..., description="Driver ID"),
    status: Optional[str] = Query(None, description="Filter by trip status"),
    trip_date: Optional[date] = Query(None, description="Filter by trip date"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(
        require_any_permission(["driver:read", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all trips for a specific driver with statistics"""
    query = select(Trip).where(Trip.driver_id == driver_id)

    # Apply filters
    if status:
        query = query.where(Trip.status == status)
    if trip_date:
        query = query.where(Trip.trip_date == trip_date)
    if company_id:
        query = query.where(Trip.company_id == company_id)

    # Order by created date descending
    query = query.order_by(Trip.created_at.desc())

    result = await db.execute(query)
    trips = result.scalars().all()

    # Calculate statistics
    total_trips = len(trips)
    active_trips = len([t for t in trips if t.status in ['loading', 'on-route']])
    completed_trips = len([t for t in trips if t.status == 'completed'])

    # Convert to response models
    trip_responses = []
    for trip in trips:
        # Get order counts for this trip
        orders_query = select(func.count(TripOrder.id)).where(TripOrder.trip_id == trip.id)
        if company_id:
            orders_query = orders_query.where(TripOrder.company_id == company_id)

        orders_result = await db.execute(orders_query)
        total_orders = orders_result.scalar() or 0

        # Get completed orders count
        completed_orders_query = select(func.count(TripOrder.id)).where(
            and_(
                TripOrder.trip_id == trip.id,
                TripOrder.delivery_status == 'delivered'
            )
        )
        if company_id:
            completed_orders_query = completed_orders_query.where(TripOrder.company_id == company_id)

        completed_orders_result = await db.execute(completed_orders_query)
        completed_orders_count = completed_orders_result.scalar() or 0

        trip_responses.append({
            "id": trip.id,
            "driver_id": trip.driver_id,
            "status": trip.status,
            "origin": trip.origin,
            "destination": trip.destination,
            "truck_plate": trip.truck_plate,
            "truck_model": trip.truck_model,
            "trip_date": trip.trip_date,
            "total_orders": total_orders,
            "completed_orders": completed_orders_count,
            "capacity_used": trip.capacity_used,
            "capacity_total": trip.capacity_total
        })

    return DriverTripListResponse(
        trips=trip_responses,
        total=total_trips,
        active=active_trips,
        completed=completed_trips
    )


@router.get("/trips/current", response_model=Optional[dict])
async def get_driver_current_trip(
    driver_id: str = Query(..., description="Driver ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(
        require_any_permission(["driver:read", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session)
):
    """Get the currently active trip for a driver"""
    query = select(Trip).where(
        and_(
            Trip.driver_id == driver_id,
            Trip.status.in_(['loading', 'on-route'])
        )
    )
    if company_id:
        query = query.where(Trip.company_id == company_id)

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        return None

    # Get order statistics
    orders_query = select(func.count(TripOrder.id)).where(TripOrder.trip_id == trip.id)
    if company_id:
        orders_query = orders_query.where(TripOrder.company_id == company_id)

    orders_result = await db.execute(orders_query)
    total_orders = orders_result.scalar() or 0

    # Get completed orders
    completed_orders_query = select(func.count(TripOrder.id)).where(
        and_(
            TripOrder.trip_id == trip.id,
            TripOrder.delivery_status == 'delivered'
        )
    )
    if company_id:
        completed_orders_query = completed_orders_query.where(TripOrder.company_id == company_id)

    completed_orders_result = await db.execute(completed_orders_query)
    completed_orders = completed_orders_result.scalar() or 0

    return {
        "id": trip.id,
        "status": trip.status,
        "origin": trip.origin,
        "destination": trip.destination,
        "truck_plate": trip.truck_plate,
        "total_orders": total_orders,
        "completed_orders": completed_orders
    }


@router.get("/trips/{trip_id}", response_model=DriverTripDetailResponse)
async def get_driver_trip_detail(
    trip_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(
        require_any_permission(["driver:read", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session),
    request: Request = None
):
    """Get detailed trip information for a driver with order items"""
    # Get trip and verify it belongs to the driver
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.driver_id == driver_id
        )
    )
    if company_id:
        query = query.where(Trip.company_id == company_id)

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to this driver")

    # Get all orders for this trip ordered by sequence
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number)
    if company_id:
        orders_query = orders_query.where(TripOrder.company_id == company_id)

    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Collect order numbers for bulk fetch
    order_numbers = [order.order_id for order in orders]

    # Fetch items from Orders Service
    items_by_order = {}
    items_unavailable = False
    items_error_message = None

    if order_numbers:
        # Extract auth token
        auth_token = None
        if request:
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                auth_token = auth_header[7:]

        try:
            # Use actual tenant_id (company_id takes precedence)
            actual_tenant_id = trip.company_id or company_id or tenant_id

            # Bulk fetch items filtered by this trip
            items_by_order = await orders_client.get_bulk_order_items(
                order_numbers=order_numbers,
                trip_id=trip_id,
                auth_token=auth_token,
                tenant_id=actual_tenant_id
            )
            logger.info(f"Successfully fetched items for {len(items_by_order)} orders")

        except OrdersServiceUnavailable as e:
            logger.error(f"Orders service unavailable: {e}")
            items_unavailable = True
            items_error_message = "Unable to load order items at this time. Please try again later."
            # Don't fail the entire request - continue with empty items

        except Exception as e:
            logger.error(f"Unexpected error fetching items: {e}")
            items_unavailable = True
            items_error_message = "Unable to load order items details."
            # Don't fail the entire request

    # Build order responses with items
    order_responses = []
    for order in orders:
        order_items = items_by_order.get(order.order_id, [])

        order_responses.append({
            "id": order.id,
            "order_id": order.order_id,
            "customer": order.customer,
            "customer_address": order.customer_address,
            "address": order.address,
            "phone": None,  # This might come from a customer table
            "status": order.status,
            "delivery_status": order.delivery_status,
            "total": order.total or 0,
            "weight": order.weight or 0,
            "volume": order.volume or 0,
            "items": order.items or 0,  # Count field for backward compatibility
            "priority": order.priority,
            "sequence_number": order.sequence_number,
            "assigned_at": order.assigned_at,
            "order_items": order_items  # NEW: Detailed items array
        })

    # Log the complete response being sent to frontend
    logger.info(f"===== SENDING TRIP DETAIL TO FRONTEND FOR TRIP: {trip_id} =====")
    logger.info(f"Trip ID: {trip.id}")
    logger.info(f"Driver ID: {trip.driver_id}")
    logger.info(f"Status: {trip.status}")
    logger.info(f"Total Orders: {len(order_responses)}")
    logger.info(f"Items Unavailable: {items_unavailable}")
    if items_error_message:
        logger.info(f"Items Error Message: {items_error_message}")

    for order_resp in order_responses:
        logger.info(f"\n--- Order: {order_resp['order_id']} ---")
        logger.info(f"  Customer: {order_resp['customer']}")
        logger.info(f"  Delivery Status: {order_resp['delivery_status']}")
        logger.info(f"  Items Count: {order_resp['items']}")
        logger.info(f"  Order Items (detailed): {len(order_resp.get('order_items', []))} items")
        for item in order_resp.get('order_items', []):
            logger.info(f"    - Item ID: {item.get('id')} (from order_items table)")
            logger.info(f"      Product: {item.get('product_name')}")
            logger.info(f"      Original Quantity: {item.get('quantity')}")
            logger.info(f"      Assigned Quantity: {item.get('assigned_quantity')} (from trip_item_assignments)")
            logger.info(f"      Status: {item.get('item_status')}")
            logger.info(f"      Is Partially Assigned: {item.get('is_partially_assigned')}")
            if item.get('other_trips'):
                logger.info(f"      Other Trips: {item.get('other_trips')}")
    logger.info(f"===== END TRIP DETAIL RESPONSE =====\n")

    return DriverTripDetailResponse(
        id=trip.id,
        driver_id=trip.driver_id,
        status=trip.status,
        origin=trip.origin,
        destination=trip.destination,
        distance=trip.distance,
        truck_plate=trip.truck_plate,
        truck_model=trip.truck_model,
        capacity_used=trip.capacity_used or 0,
        capacity_total=trip.capacity_total or 0,
        estimated_duration=trip.estimated_duration,
        pre_trip_time=trip.pre_trip_time,
        post_trip_time=trip.post_trip_time,
        orders=order_responses,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
        maintenance_note=trip.maintenance_note,
        paused_at=trip.paused_at,
        paused_reason=trip.paused_reason,
        resumed_at=trip.resumed_at,
        items_unavailable=items_unavailable,
        items_error_message=items_error_message
    )


@router.get("/trips/{trip_id}/orders/{order_id}/status")
async def get_order_status(
    trip_id: str,
    order_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(
        require_any_permission(["driver:read", "trips:read", "orders:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session)
):
    """Get current status of a specific order"""
    # Verify trip belongs to driver
    trip_query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.driver_id == driver_id
        )
    )
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to this driver")

    # Get order
    order_query = select(TripOrder).where(
        and_(
            TripOrder.trip_id == trip_id,
            TripOrder.order_id == order_id
        )
    )
    if company_id:
        order_query = order_query.where(TripOrder.company_id == company_id)

    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order_id": order.order_id,
        "status": order.status,
        "delivery_status": order.delivery_status,
        "sequence_number": order.sequence_number
    }


@router.put("/trips/{trip_id}/orders/{order_id}/delivery", response_model=MessageResponse)
async def update_order_delivery_status(
    trip_id: str,
    order_id: str,
    delivery_update: DeliveryUpdate,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session),
    request: Request = None
):
    """Update delivery status of an order"""
    # Verify trip belongs to driver
    trip_query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.driver_id == driver_id
        )
    )
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to this driver")

    # Get the order to update
    order_query = select(TripOrder).where(
        and_(
            TripOrder.trip_id == trip_id,
            TripOrder.order_id == order_id
        )
    )
    if company_id:
        order_query = order_query.where(TripOrder.company_id == company_id)

    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found in this trip")

    # Validate status transition
    valid_transitions = {
        'pending': ['out-for-delivery'],
        'out-for-delivery': ['delivered', 'failed'],
        'failed': ['out-for-delivery', 'returned'],
        'returned': []
    }

    current_status = order.delivery_status or 'pending'
    new_status = delivery_update.status.value if hasattr(delivery_update.status, 'value') else delivery_update.status

    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {current_status} to {new_status}"
        )

    # Check sequential delivery - all previous orders must be delivered
    if new_status == 'out-for-delivery':
        previous_orders_query = select(TripOrder).where(
            and_(
                TripOrder.trip_id == trip_id,
                TripOrder.sequence_number < order.sequence_number,
                TripOrder.delivery_status != 'delivered'
            )
        )
        if company_id:
            previous_orders_query = previous_orders_query.where(TripOrder.company_id == company_id)

        previous_result = await db.execute(previous_orders_query)
        undelivered_previous = previous_result.scalar_one_or_none()

        if undelivered_previous:
            raise HTTPException(
                status_code=400,
                detail="Cannot start delivery for this order. Previous orders must be delivered first."
            )

    # Update order status
    update_query = update(TripOrder).where(
        and_(
            TripOrder.trip_id == trip_id,
            TripOrder.order_id == order_id
        )
    ).values(
        delivery_status=new_status,
        status='completed' if new_status == 'delivered' else 'on-route'
    )

    if company_id:
        update_query = update_query.where(TripOrder.company_id == company_id)

    await db.execute(update_query)

    # If order is delivered, update order_items and trip_item_assignments tables in Orders service
    if new_status == 'delivered':
        # Update all items for this order to "delivered" status
        try:
            # Extract auth token
            auth_token = None
            if request:
                auth_header = request.headers.get("authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    auth_token = auth_header[7:]

            # Use actual tenant_id (company_id takes precedence)
            actual_tenant_id = trip.company_id or company_id or tenant_id

            # Update both order_items and trip_item_assignments tables
            items_update_result = await orders_client.update_order_items_status(
                order_number=order_id,
                trip_id=trip_id,
                item_status="delivered",
                auth_token=auth_token,
                tenant_id=actual_tenant_id
            )
            logger.info(
                f"Updated order_items and trip_item_assignments for order {order_id} "
                f"in trip {trip_id} to 'delivered'. Result: {items_update_result}"
            )
        except OrdersServiceUnavailable as e:
            # Log error but don't fail the delivery update
            logger.error(
                f"Failed to update order_items/trip_item_assignments for order {order_id}: {e}. "
                f"Delivery status was still updated in TMS."
            )
        except Exception as e:
            # Log error but don't fail the delivery update
            logger.error(
                f"Unexpected error updating order_items/trip_item_assignments for order {order_id}: {e}. "
                f"Delivery status was still updated in TMS."
            )

    # If order is delivered, update trip capacity
    if new_status == 'delivered':
        new_capacity_used = max(0, (trip.capacity_used or 0) - order.weight)
        trip_update_query = update(Trip).where(Trip.id == trip_id).values(
            capacity_used=new_capacity_used
        )
        await db.execute(trip_update_query)

        # Check if all orders are delivered
        all_orders_query = select(func.count(TripOrder.id)).where(TripOrder.trip_id == trip_id)
        if company_id:
            all_orders_query = all_orders_query.where(TripOrder.company_id == company_id)

        delivered_orders_query = select(func.count(TripOrder.id)).where(
            and_(
                TripOrder.trip_id == trip_id,
                TripOrder.delivery_status == 'delivered'
            )
        )
        if company_id:
            delivered_orders_query = delivered_orders_query.where(TripOrder.company_id == company_id)

        all_orders_result = await db.execute(all_orders_query)
        delivered_orders_result = await db.execute(delivered_orders_query)

        total_orders = all_orders_result.scalar()
        delivered_count = delivered_orders_result.scalar()

        logger.info(f"Trip {trip_id}: total_orders={total_orders}, delivered_count={delivered_count}, trip.driver_id={trip.driver_id}, trip.truck_plate={trip.truck_plate}")

        if total_orders == delivered_count:
            # Mark trip as completed
            await db.execute(
                update(Trip).where(Trip.id == trip_id).values(status='completed')
            )

            # Update driver and truck status to available when trip is completed
            try:
                from src.services.company_client import company_client

                # Extract auth token from request
                auth_token = None
                if request:
                    auth_header = request.headers.get("authorization")
                    if auth_header and auth_header.startswith("Bearer "):
                        auth_token = auth_header[7:]  # Remove "Bearer " prefix
                        logger.info(f"Using auth token for status update (length: {len(auth_token)})")

                # Use the company_id from trip or query parameter for tenant
                actual_tenant_id = trip.company_id or company_id or tenant_id

                # Update driver status to available
                driver_update_success = await company_client.update_driver_status(
                    driver_id=trip.driver_id,
                    status="available",
                    tenant_id=actual_tenant_id,
                    auth_token=auth_token
                )

                # Update truck/vehicle status to available
                # First get the vehicle ID from the plate number
                vehicle_id = await company_client.get_vehicle_id_by_plate(
                    truck_plate=trip.truck_plate,
                    tenant_id=actual_tenant_id,
                    auth_token=auth_token
                )

                vehicle_update_success = False
                if vehicle_id:
                    vehicle_update_success = await company_client.update_vehicle_status(
                        vehicle_id=vehicle_id,  # Use actual vehicle ID instead of plate
                        status="available",
                        tenant_id=actual_tenant_id,
                        auth_token=auth_token
                    )
                else:
                    logger.warning(f"Could not find vehicle ID for plate {trip.truck_plate}")

                logger.info(
                    f"Trip {trip_id} completed. Driver {trip.driver_id} status update: {driver_update_success}, "
                    f"Vehicle {trip.truck_plate} (ID: {vehicle_id}) status update: {vehicle_update_success}"
                )
            except Exception as e:
                logger.error(f"Failed to update driver/vehicle status after trip completion: {e}")
                # Don't fail the request if status update fails

    # Log the action
    audit_log = TMSAuditLog(
        user_id=driver_id,
        company_id=company_id or "company-001",  # Default company_id if None
        action=f"Updated order delivery status to {new_status}",
        module="DRIVER",
        record_id=order_id,
        record_type="trip_order",
        details=f"Driver {driver_id} updated order {order_id} in trip {trip_id}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)

    await db.commit()

    # Create the response explicitly
    result = {"message": f"Order {order_id} delivery status updated to {new_status}"}
    return result


@router.post("/trips/{trip_id}/orders/{order_id}/deliver")
async def mark_order_delivered(
    trip_id: str,
    order_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session),
    request: Request = None
):
    """Quick endpoint to mark an order as delivered"""
    # Helper function to update delivery status
    async def update_delivery_status(new_status: str):
        # Verify trip belongs to driver
        trip_query = select(Trip).where(
            and_(
                Trip.id == trip_id,
                Trip.driver_id == driver_id
            )
        )
        if company_id:
            trip_query = trip_query.where(Trip.company_id == company_id)

        trip_result = await db.execute(trip_query)
        trip = trip_result.scalar_one_or_none()

        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found or not assigned to this driver")

        # Get the order to update
        order_query = select(TripOrder).where(
            and_(
                TripOrder.trip_id == trip_id,
                TripOrder.order_id == order_id
            )
        )
        if company_id:
            order_query = order_query.where(TripOrder.company_id == company_id)

        order_result = await db.execute(order_query)
        order = order_result.scalar_one_or_none()

        if not order:
            raise HTTPException(status_code=404, detail="Order not found in this trip")

        # Validate status transition
        valid_transitions = {
            'pending': ['out-for-delivery'],
            'out-for-delivery': ['delivered', 'failed'],
            'failed': ['out-for-delivery', 'returned'],
            'returned': []
        }

        current_status = order.delivery_status or 'pending'

        if new_status not in valid_transitions.get(current_status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status} to {new_status}"
            )

        # Check sequential delivery - all previous orders must be delivered
        if new_status == 'out-for-delivery':
            previous_orders_query = select(TripOrder).where(
                and_(
                    TripOrder.trip_id == trip_id,
                    TripOrder.sequence_number < order.sequence_number,
                    TripOrder.delivery_status != 'delivered'
                )
            )
            if company_id:
                previous_orders_query = previous_orders_query.where(TripOrder.company_id == company_id)

            previous_result = await db.execute(previous_orders_query)
            undelivered_previous = previous_result.scalar_one_or_none()

            if undelivered_previous:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot start delivery for this order. Previous orders must be delivered first."
                )

        # Update order status
        update_query = update(TripOrder).where(
            and_(
                TripOrder.trip_id == trip_id,
                TripOrder.order_id == order_id
            )
        ).values(
            delivery_status=new_status,
            status='completed' if new_status == 'delivered' else 'on-route'
        )

        if company_id:
            update_query = update_query.where(TripOrder.company_id == company_id)

        await db.execute(update_query)

        # If order is delivered, update order_items and trip_item_assignments tables in Orders service
        if new_status == 'delivered':
            # Update all items for this order to "delivered" status
            try:
                # Extract auth token
                auth_token = None
                if request:
                    auth_header = request.headers.get("authorization")
                    if auth_header and auth_header.startswith("Bearer "):
                        auth_token = auth_header[7:]

                # Use actual tenant_id (company_id takes precedence)
                actual_tenant_id = trip.company_id or company_id or tenant_id

                # Update both order_items and trip_item_assignments tables
                items_update_result = await orders_client.update_order_items_status(
                    order_number=order_id,
                    trip_id=trip_id,
                    item_status="delivered",
                    auth_token=auth_token,
                    tenant_id=actual_tenant_id
                )
                logger.info(
                    f"Updated order_items and trip_item_assignments for order {order_id} "
                    f"in trip {trip_id} to 'delivered'. Result: {items_update_result}"
                )
            except OrdersServiceUnavailable as e:
                # Log error but don't fail the delivery update
                logger.error(
                    f"Failed to update order_items/trip_item_assignments for order {order_id}: {e}. "
                    f"Delivery status was still updated in TMS."
                )
            except Exception as e:
                # Log error but don't fail the delivery update
                logger.error(
                    f"Unexpected error updating order_items/trip_item_assignments for order {order_id}: {e}. "
                    f"Delivery status was still updated in TMS."
                )

        # If order is delivered, update trip capacity
        if new_status == 'delivered':
            new_capacity_used = max(0, (trip.capacity_used or 0) - order.weight)
            trip_update_query = update(Trip).where(Trip.id == trip_id).values(
                capacity_used=new_capacity_used
            )
            await db.execute(trip_update_query)

            # Check if all orders are delivered
            all_orders_query = select(func.count(TripOrder.id)).where(TripOrder.trip_id == trip_id)
            if company_id:
                all_orders_query = all_orders_query.where(TripOrder.company_id == company_id)

            delivered_orders_query = select(func.count(TripOrder.id)).where(
                and_(
                    TripOrder.trip_id == trip_id,
                    TripOrder.delivery_status == 'delivered'
                )
            )
            if company_id:
                delivered_orders_query = delivered_orders_query.where(TripOrder.company_id == company_id)

            all_orders_result = await db.execute(all_orders_query)
            delivered_orders_result = await db.execute(delivered_orders_query)

            total_orders = all_orders_result.scalar()
            delivered_count = delivered_orders_result.scalar()

            logger.info(f"Trip {trip_id}: total_orders={total_orders}, delivered_count={delivered_count}, trip.driver_id={trip.driver_id}, trip.truck_plate={trip.truck_plate}")

            if total_orders == delivered_count:
                # Mark trip as completed
                await db.execute(
                    update(Trip).where(Trip.id == trip_id).values(status='completed')
                )

                # Update driver and truck status to available when trip is completed
                try:
                    from src.services.company_client import company_client

                    # Extract auth token from request
                    auth_token = None
                    if request:
                        auth_header = request.headers.get("authorization")
                        if auth_header and auth_header.startswith("Bearer "):
                            auth_token = auth_header[7:]  # Remove "Bearer " prefix
                            logger.info(f"Using auth token for status update (length: {len(auth_token)})")

                    # Update driver status to available
                    # Use the company_id from trip or query parameter for tenant
                    actual_tenant_id = trip.company_id or company_id or tenant_id
                    driver_update_success = await company_client.update_driver_status(
                        driver_id=trip.driver_id,
                        status="available",
                        tenant_id=actual_tenant_id,
                        auth_token=auth_token
                    )

                    # Update truck/vehicle status to available
                    # First get the vehicle ID from the plate number
                    vehicle_id = await company_client.get_vehicle_id_by_plate(
                        truck_plate=trip.truck_plate,
                        tenant_id=actual_tenant_id,
                        auth_token=auth_token
                    )

                    vehicle_update_success = False
                    if vehicle_id:
                        vehicle_update_success = await company_client.update_vehicle_status(
                            vehicle_id=vehicle_id,  # Use actual vehicle ID instead of plate
                            status="available",
                            tenant_id=actual_tenant_id,
                            auth_token=auth_token
                        )
                    else:
                        logger.warning(f"Could not find vehicle ID for plate {trip.truck_plate}")

                    logger.info(
                        f"Trip {trip_id} completed. Driver {trip.driver_id} status update: {driver_update_success}, "
                        f"Vehicle {trip.truck_plate} (ID: {vehicle_id}) status update: {vehicle_update_success}"
                    )
                except Exception as e:
                    logger.error(f"Failed to update driver/vehicle status after trip completion: {e}")
                    # Don't fail the request if status update fails

        # Log the action
        audit_log = TMSAuditLog(
            user_id=driver_id,
            company_id=company_id or "company-001",
            action=f"Updated order delivery status to {new_status}",
            module="DRIVER",
            record_id=order_id,
            record_type="trip_order",
            details=f"Driver {driver_id} updated order {order_id} in trip {trip_id}",
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)

        await db.commit()

        return {"message": f"Order {order_id} delivery status updated to {new_status}"}

    # Check if order is already out for delivery
    order_query = select(TripOrder).where(
        and_(
            TripOrder.trip_id == trip_id,
            TripOrder.order_id == order_id
        )
    )
    if company_id:
        order_query = order_query.where(TripOrder.company_id == company_id)

    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    # If order is pending, first mark as out-for-delivery
    if order.delivery_status == 'pending' or order.delivery_status is None:
        await update_delivery_status('out-for-delivery')

    # Now mark as delivered
    response = await update_delivery_status('delivered')
    return response


@router.post("/trips/{trip_id}/maintenance")
async def report_maintenance(
    trip_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["driver:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_async_session)
):
    """Report truck maintenance issues"""
    # Verify trip belongs to driver
    query = select(Trip).where(
        and_(
            Trip.id == trip_id,
            Trip.driver_id == driver_id
        )
    )
    if company_id:
        query = query.where(Trip.company_id == company_id)

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to this driver")

    # Update trip status
    await db.execute(
        update(Trip).where(Trip.id == trip_id).values(status='truck-malfunction')
    )

    # Log the action
    audit_log = TMSAuditLog(
        user_id=driver_id,
        company_id=company_id or "company-001",  # Default company_id if None
        action="Reported truck malfunction",
        module="DRIVER",
        record_id=trip_id,
        record_type="trip",
        details=f"Driver {driver_id} reported maintenance issues for trip {trip_id}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)

    await db.commit()

    # Create the response explicitly
    result = {"message": f"Maintenance issue reported for trip {trip_id}"}
    return result