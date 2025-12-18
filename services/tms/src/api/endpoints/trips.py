"""Trip API endpoints with reordering functionality"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from datetime import date

from src.database import get_async_session, Trip, TripOrder
from src.schemas import (
    TripCreate, TripUpdate, TripResponse, TripWithOrders,
    AssignOrdersRequest, TripOrderCreate, TripOrderResponse,
    MessageResponse, ReorderOrdersRequest
)

router = APIRouter()


@router.get("/", response_model=List[TripResponse])
async def get_trips(
    status: Optional[str] = Query(None, description="Filter by trip status"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    trip_date: Optional[date] = Query(None, description="Filter by trip date"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all trips with optional filters"""
    query = select(Trip)

    # Apply filters
    if status:
        query = query.where(Trip.status == status)
    if branch:
        query = query.where(Trip.branch == branch)
    if trip_date:
        query = query.where(Trip.trip_date == trip_date)
    if user_id:
        query = query.where(Trip.user_id == user_id)
    if company_id:
        query = query.where(Trip.company_id == company_id)

    # Order by created date descending
    query = query.order_by(Trip.created_at.desc())

    result = await db.execute(query)
    trips = result.scalars().all()

    # Convert to response models with orders
    trip_responses = []
    for trip in trips:
        # Get orders for this trip ordered by sequence_number
        orders_query = select(TripOrder).where(TripOrder.trip_id == trip.id).order_by(TripOrder.sequence_number)
        if user_id:
            orders_query = orders_query.where(TripOrder.user_id == user_id)
        if company_id:
            orders_query = orders_query.where(TripOrder.company_id == company_id)

        orders_result = await db.execute(orders_query)
        orders = orders_result.scalars().all()

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
            created_at=trip.created_at,
            updated_at=trip.updated_at,
            orders=[TripOrderResponse.from_orm(order) for order in orders]
        )
        trip_responses.append(trip_response)

    return trip_responses


@router.get("/{trip_id}", response_model=TripWithOrders)
async def get_trip(
    trip_id: str,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific trip with its orders"""
    # Get trip
    trip_query = select(Trip).where(Trip.id == trip_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        trip_query = trip_query.where(Trip.user_id == user_id)
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get trip orders ordered by sequence_number
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number)
    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Manually create response to avoid lazy loading issues
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
        orders=[TripOrderResponse.from_orm(order) for order in orders]
    )

    return trip_response


@router.post("/", response_model=TripResponse)
async def create_trip(
    trip_data: TripCreate,
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new trip"""
    # Generate trip ID
    from uuid import uuid4
    trip_id = f"TRIP-{uuid4().hex[:8].upper()}"

    # Create trip
    trip = Trip(
        id=trip_id,
        **trip_data.dict()
    )

    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # Create response without relationships to avoid lazy loading issues
    from src.schemas import TripResponse
    response = TripResponse(
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
        orders=[]  # Empty list for new trip
    )

    return response


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_update: TripUpdate,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a trip"""
    # Get existing trip
    query = select(Trip).where(Trip.id == trip_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        query = query.where(Trip.user_id == user_id)
    if company_id:
        query = query.where(Trip.company_id == company_id)

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Update fields
    update_data = trip_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)

    # Fetch orders for this trip to avoid lazy loading issues
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number)
    if user_id:
        orders_query = orders_query.where(TripOrder.user_id == user_id)
    if company_id:
        orders_query = orders_query.where(TripOrder.company_id == company_id)

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
                "status": order.status,
                "total": order.total,
                "weight": order.weight,
                "volume": order.volume,
                "items": order.items,
                "priority": order.priority,
                "sequence_number": order.sequence_number,
                "address": order.address,
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
    trip_id: str,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a trip"""
    # Get trip
    query = select(Trip).where(Trip.id == trip_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        query = query.where(Trip.user_id == user_id)
    if company_id:
        query = query.where(Trip.company_id == company_id)

    result = await db.execute(query)
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Check if trip can be deleted (only planning status)
    if trip.status not in ["planning", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete trip that is not in planning or cancelled status"
        )

    await db.delete(trip)
    await db.commit()

    return {"message": "Trip deleted successfully"}


@router.get("/{trip_id}/orders", response_model=List[TripOrderResponse])
async def get_trip_orders(
    trip_id: str,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all orders for a specific trip"""
    # Verify trip exists
    trip_query = select(Trip).where(Trip.id == trip_id)

    # Add user_id and company_id filtering if provided
    if user_id:
        trip_query = trip_query.where(Trip.user_id == user_id)
    if company_id:
        trip_query = trip_query.where(Trip.company_id == company_id)

    trip_result = await db.execute(trip_query)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get orders (also filter by user_id and company_id if provided) ordered by sequence_number
    orders_query = select(TripOrder).where(TripOrder.trip_id == trip_id)
    if user_id:
        orders_query = orders_query.where(TripOrder.user_id == user_id)
    if company_id:
        orders_query = orders_query.where(TripOrder.company_id == company_id)

    orders_query = orders_query.order_by(TripOrder.sequence_number)
    result = await db.execute(orders_query)
    orders = result.scalars().all()

    return orders


@router.post("/{trip_id}/orders", response_model=MessageResponse)
async def assign_orders_to_trip(
    trip_id: str,
    request: AssignOrdersRequest,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Assign orders to a trip"""
    # Verify trip exists and is in planning status
    trip_query = select(Trip).where(Trip.id == trip_id)

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
            detail="Can only assign orders to trips in planning status"
        )

    # Calculate total weight for new orders
    total_new_weight = sum(order.weight for order in request.orders)
    new_capacity_used = (trip.capacity_used or 0) + total_new_weight

    # Check capacity
    if new_capacity_used > trip.capacity_total:
        raise HTTPException(
            status_code=400,
            detail=f"Orders exceed trip capacity. Current: {trip.capacity_used}kg, New: {total_new_weight}kg, Max: {trip.capacity_total}kg"
        )

    # Get the current highest sequence number for this trip
    max_seq_query = select(TripOrder.sequence_number).where(TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number.desc()).limit(1)
    max_seq_result = await db.execute(max_seq_query)
    max_seq = max_seq_result.scalar() or -1

    # Add orders to trip with sequential sequence numbers
    trip_orders = []
    for idx, order_data in enumerate(request.orders):
        trip_order = TripOrder(
            trip_id=trip_id,
            sequence_number=max_seq + idx + 1,  # Assign sequential sequence numbers
            **order_data.dict()
        )
        trip_orders.append(trip_order)
        db.add(trip_order)

    # Update trip capacity
    trip.capacity_used = new_capacity_used

    await db.commit()

    return MessageResponse(message=f"Successfully assigned {len(request.orders)} orders to trip {trip_id}")


@router.put("/{trip_id}/orders/reorder", response_model=MessageResponse)
async def reorder_trip_orders(
    trip_id: str,
    request: ReorderOrdersRequest,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Reorder the sequence of orders in a trip"""
    # Verify trip exists and is in planning status
    trip_query = select(Trip).where(Trip.id == trip_id)

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
        existing_orders_query = existing_orders_query.where(TripOrder.user_id == user_id)
    if company_id:
        existing_orders_query = existing_orders_query.where(TripOrder.company_id == company_id)

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
            update_query = update_query.where(TripOrder.company_id == company_id)

        await db.execute(update_query)

    await db.commit()

    return MessageResponse(message=f"Successfully reordered {len(request.order_sequences)} orders in trip {trip_id}")


@router.delete("/{trip_id}/orders/remove", response_model=MessageResponse)
async def remove_order_from_trip(
    trip_id: str,
    order_id: str = Query(..., description="Order ID to remove"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    db: AsyncSession = Depends(get_async_session)
):
    """Remove an order from a trip"""
    # Verify trip exists and is in planning status
    trip_query = select(Trip).where(Trip.id == trip_id)

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

    return MessageResponse(message=f"Successfully removed order {order_id} from trip {trip_id}")


