"""Driver API endpoints - providing driver-specific data to the Driver Service"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update, func
from datetime import date, datetime

from src.database import get_async_session, Trip, TripOrder, TMSAuditLog
from src.schemas import (
    TripResponse, TripWithOrders, TripOrderResponse,
    DeliveryUpdate, DriverTripListResponse, DriverTripDetailResponse,
    MessageResponse
)

router = APIRouter()


@router.get("/trips", response_model=DriverTripListResponse)
async def get_driver_trips(
    driver_id: str = Query(..., description="Driver ID"),
    status: Optional[str] = Query(None, description="Filter by trip status"),
    trip_date: Optional[date] = Query(None, description="Filter by trip date"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
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
    db: AsyncSession = Depends(get_async_session)
):
    """Get detailed trip information for a driver"""
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

    order_responses = []
    for order in orders:
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
            "items": order.items or 0,
            "priority": order.priority,
            "sequence_number": order.sequence_number,
            "assigned_at": order.assigned_at
        })

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
        updated_at=trip.updated_at
    )


@router.get("/trips/{trip_id}/orders/{order_id}/status")
async def get_order_status(
    trip_id: str,
    order_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
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
    db: AsyncSession = Depends(get_async_session)
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

        if total_orders == delivered_count:
            # Mark trip as completed
            await db.execute(
                update(Trip).where(Trip.id == trip_id).values(status='completed')
            )

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
    db: AsyncSession = Depends(get_async_session)
):
    """Quick endpoint to mark an order as delivered"""
    # First update to out-for-delivery, then to delivered
    # This follows the proper status transition flow
    from src.schemas import DeliveryStatus

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
        delivery_update = DeliveryUpdate(status='out-for-delivery')
        await update_order_delivery_status(trip_id, order_id, delivery_update, driver_id, company_id, db)

    # Now mark as delivered
    delivery_update = DeliveryUpdate(status='delivered')
    response = await update_order_delivery_status(trip_id, order_id, delivery_update, driver_id, company_id, db)
    return response


@router.post("/trips/{trip_id}/maintenance")
async def report_maintenance(
    trip_id: str,
    driver_id: str = Query(..., description="Driver ID for authorization"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
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