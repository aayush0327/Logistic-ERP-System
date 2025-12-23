"""Trip API endpoints with reordering functionality"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from datetime import date
import uuid

from src.database import get_db, Trip, TripOrder
from src.schemas import (
    TripCreate, TripUpdate, TripResponse, TripWithOrders,
    AssignOrdersRequest, TripOrderCreate, TripOrderResponse,
    MessageResponse, ReorderOrdersRequest
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)

router = APIRouter(
    dependencies=[Depends(HTTPBearer())],
    responses={
        401: {"description": "Unauthorized - Invalid or missing token"},
        403: {"description": "Forbidden - Insufficient permissions"}
    },
    tags=["trips"]
)


@router.get(
    "",
    response_model=List[TripResponse],
    responses={401: {"description": "Unauthorized"},
               403: {"description": "Forbidden"}},
    summary="Get all trips",
    description="Retrieve a list of all trips with optional filtering"
)
async def get_trips(
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
    # Build base query with tenant isolation
    query = select(Trip).where(Trip.company_id == tenant_id)

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

    # Convert to response models with orders
    trip_responses = []
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

        # Convert orders to TripOrderResponse format
        order_responses = [
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
                status=order.status,
                total=order.total,
                weight=order.weight,
                volume=order.volume,
                items=order.items,
                quantity=order.quantity,
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
            for order in orders
        ]

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
            updated_at=trip.updated_at
        )

        # Add orders to the response
        trip_response.orders = order_responses
        trip_responses.append(trip_response)

    return trip_responses


@router.get("/{trip_id}", response_model=TripWithOrders)
async def get_trip(
    trip_id: str,
    token_data: TokenData = Depends(
        require_any_permission(["trips:read_all", "trips:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get trip by ID with associated orders"""
    # Get trip
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
                status=order.status,
                total=order.total,
                weight=order.weight,
                volume=order.volume,
                items=order.items,
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
    trip_data: TripCreate,
    token_data: TokenData = Depends(require_permissions(["trips:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new trip"""
    # Create new trip
    trip = Trip(
        user_id=user_id,
        company_id=tenant_id,
        branch=trip_data.branch,
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
        created_at=trip.created_at,
        updated_at=trip.updated_at
    )


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update trip"""
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

    # Update trip fields
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)

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
                "status": order.status,
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
    trip_id: str,
    token_data: TokenData = Depends(require_permissions(["trips:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Delete trip"""
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

    # Delete trip (orders will be deleted via cascade)
    await db.delete(trip)
    await db.commit()

    return {"message": "Trip deleted successfully"}


@router.get("/{trip_id}/orders", response_model=List[TripOrderResponse])
async def get_trip_orders(
    trip_id: str,
    token_data: TokenData = Depends(
        require_any_permission(["trips:read_all", "trips:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get all orders for a specific trip"""
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
    token_data: TokenData = Depends(require_permissions(["trips:assign"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Assign orders to a trip"""
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
    total_new_weight = sum(order.weight for order in request.orders)
    new_capacity_used = (trip.capacity_used or 0) + total_new_weight

    # Check capacity
    if new_capacity_used > trip.capacity_total:
        raise HTTPException(
            status_code=400,
            detail=f"Orders exceed trip capacity. Current: {trip.capacity_used}kg, New: {total_new_weight}kg, Max: {trip.capacity_total}kg"
        )

    # Get the current highest sequence number for this trip
    max_seq_query = select(TripOrder.sequence_number).where(
        TripOrder.trip_id == trip_id).order_by(TripOrder.sequence_number.desc()).limit(1)
    max_seq_result = await db.execute(max_seq_query)
    max_seq = max_seq_result.scalar() or -1

    # Add orders to trip with sequential sequence numbers
    created_orders = []
    for idx, order_data in enumerate(request.orders):
        # Get order data dict without user_id and company_id to avoid conflicts
        # Use model_dump(mode='json') to properly serialize enum values to strings
        order_dict = order_data.model_dump(mode='json', exclude={'user_id', 'company_id'})

        trip_order = TripOrder(
            trip_id=trip_id,
            sequence_number=max_seq + idx + 1,  # Assign sequential sequence numbers
            user_id=user_id,
            company_id=tenant_id,  # Use tenant_id as company_id for multi-tenancy
            **order_dict
        )
        created_orders.append(trip_order)
        db.add(trip_order)

    # Update trip capacity_used
    total_weight = sum(order.weight for order in created_orders)
    trip.capacity_used = (trip.capacity_used or 0) + total_weight
    db.add(trip)

    await db.commit()

    return MessageResponse(message=f"Successfully assigned {len(request.orders)} orders to trip {trip_id}")


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
    order_id: str = Query(..., description="Order ID to remove"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    company_id: Optional[str] = Query(
        None, description="Filter by company ID"),
    token_data: TokenData = Depends(require_permissions(["trips:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Remove an order from a trip"""
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

    return MessageResponse(message=f"Successfully removed order {order_id} from trip {trip_id}")
