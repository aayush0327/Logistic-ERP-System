"""
Vehicle management endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Vehicle, Branch, VehicleType, VehicleStatus
from src.schemas import (
    Vehicle as VehicleSchema,
    VehicleCreate,
    VehicleUpdate,
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=PaginatedResponse)
async def list_vehicles(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    vehicle_type: Optional[VehicleType] = Query(None),
    status: Optional[VehicleStatus] = Query(None),
    branch_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission(["vehicles:read_all", "vehicles:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all vehicles for the current tenant

    Requires:
    - vehicles:read_all (to view all vehicles) OR
    - vehicles:read (to view basic vehicle info)
    """

    # Build query
    query = select(Vehicle).where(Vehicle.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            Vehicle.plate_number.ilike(f"%{search}%") |
            Vehicle.make.ilike(f"%{search}%") |
            Vehicle.model.ilike(f"%{search}%")
        )

    if vehicle_type:
        query = query.where(Vehicle.vehicle_type == vehicle_type)

    if status:
        query = query.where(Vehicle.status == status)

    if branch_id:
        query = query.where(Vehicle.branch_id == branch_id)

    if is_active is not None:
        query = query.where(Vehicle.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Vehicle.plate_number)

    # Include branch relationship
    query = query.options(selectinload(Vehicle.branch))

    # Execute query
    result = await db.execute(query)
    vehicles = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[VehicleSchema.model_validate(vehicle) for vehicle in vehicles],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/vehicle-types")
@router.get("/vehicle-types/")
async def get_vehicle_types():
    """
    Get list of available vehicle types
    """
    logger.info("Getting vehicle types...")
    try:
        vehicle_types = ["motorcycle", "van", "truck_small", "truck_medium", "truck_large", "trailer"]
        logger.info(f"Returning vehicle types: {vehicle_types}")
        return vehicle_types
    except Exception as e:
        logger.error(f"Error getting vehicle types: {e}")
        return ["motorcycle", "van", "truck_small", "truck_medium", "truck_large", "trailer"]


@router.get("/status-options")
@router.get("/status-options/")
async def get_vehicle_status_options():
    """
    Get list of available vehicle status options
    """
    logger.info("Getting vehicle status options...")
    try:
        status_options = ["available", "on_trip", "maintenance", "out_of_service"]
        logger.info(f"Returning status options: {status_options}")
        return status_options
    except Exception as e:
        logger.error(f"Error getting vehicle status options: {e}")
        return ["available", "on_trip", "maintenance", "out_of_service"]


@router.get("/{vehicle_id}", response_model=VehicleSchema)
async def get_vehicle(
    vehicle_id: UUID,
    token_data: TokenData = Depends(require_any_permission(["vehicles:read_all", "vehicles:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific vehicle by ID

    Requires:
    - vehicles:read_all (to view any vehicle) OR
    - vehicles:read (to view basic vehicle info)
    """

    # Get vehicle with relationships
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    ).options(
        selectinload(Vehicle.branch)
    )

    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return VehicleSchema.model_validate(vehicle)


@router.post("/", response_model=VehicleSchema, status_code=201)
async def create_vehicle(
    vehicle_data: VehicleCreate,
    token_data: TokenData = Depends(require_permissions(["vehicles:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new vehicle

    Requires:
    - vehicles:create
    """

    # Check if plate number already exists
    existing_query = select(Vehicle).where(
        Vehicle.plate_number == vehicle_data.plate_number,
        Vehicle.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Vehicle with this plate number already exists"
        )

    # Validate branch if provided
    if vehicle_data.branch_id:
        branch_query = select(Branch).where(
            Branch.id == vehicle_data.branch_id,
            Branch.tenant_id == tenant_id
        )
        branch_result = await db.execute(branch_query)
        if not branch_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Invalid branch"
            )

    # Create new vehicle
    vehicle = Vehicle(
        tenant_id=tenant_id,
        **vehicle_data.model_dump()
    )

    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)

    # Load the branch relationship for response
    await db.refresh(vehicle, ["branch"])

    return VehicleSchema.model_validate(vehicle)


@router.put("/{vehicle_id}", response_model=VehicleSchema)
async def update_vehicle(
    vehicle_id: UUID,
    vehicle_data: VehicleUpdate,
    token_data: TokenData = Depends(require_permissions(["vehicles:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a vehicle

    Requires:
    - vehicles:update
    """

    # Get existing vehicle
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Validate branch if provided
    if vehicle_data.branch_id:
        branch_query = select(Branch).where(
            Branch.id == vehicle_data.branch_id,
            Branch.tenant_id == tenant_id
        )
        branch_result = await db.execute(branch_query)
        if not branch_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Invalid branch"
            )

    # Update vehicle
    update_data = vehicle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)

    # Load the branch relationship for response
    await db.refresh(vehicle, ["branch"])

    return VehicleSchema.model_validate(vehicle)


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(
    vehicle_id: UUID,
    token_data: TokenData = Depends(require_permissions(["vehicles:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) a vehicle

    Requires:
    - vehicles:delete
    """

    # Get existing vehicle
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Soft delete - deactivate vehicle
    vehicle.is_active = False
    await db.commit()


@router.put("/{vehicle_id}/status", response_model=VehicleSchema)
async def update_vehicle_status(
    vehicle_id: UUID,
    status: VehicleStatus,
    token_data: TokenData = Depends(require_permissions(["vehicles:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update vehicle status

    Requires:
    - vehicles:update
    """

    # Get existing vehicle
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Update status
    vehicle.status = status

    # Set maintenance dates if applicable
    if status == VehicleStatus.MAINTENANCE:
        vehicle.last_maintenance = datetime.utcnow()
    elif status == VehicleStatus.AVAILABLE:
        # Coming from maintenance, set next maintenance date
        if vehicle.last_maintenance:
            # Schedule next maintenance in 3 months
            from datetime import timedelta
            vehicle.next_maintenance = vehicle.last_maintenance + timedelta(days=90)

    await db.commit()
    await db.refresh(vehicle)

    # Load the branch relationship for response
    await db.refresh(vehicle, ["branch"])

    return VehicleSchema.model_validate(vehicle)


@router.get("/available", response_model=PaginatedResponse)
async def get_available_vehicles(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    vehicle_type: Optional[VehicleType] = Query(None),
    branch_id: Optional[UUID] = Query(None),
    token_data: TokenData = Depends(require_any_permission(["vehicles:read_all", "vehicles:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of available vehicles

    Requires:
    - vehicles:read_all (to view all available vehicles) OR
    - vehicles:read (to view basic available vehicle info)
    """

    # Build query for available vehicles
    query = select(Vehicle).where(
        Vehicle.tenant_id == tenant_id,
        Vehicle.status == VehicleStatus.AVAILABLE,
        Vehicle.is_active == True
    )

    # Apply additional filters
    if vehicle_type:
        query = query.where(Vehicle.vehicle_type == vehicle_type)

    if branch_id:
        query = query.where(Vehicle.branch_id == branch_id)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Vehicle.plate_number)

    # Include branch relationship
    query = query.options(selectinload(Vehicle.branch))

    # Execute query
    result = await db.execute(query)
    vehicles = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[VehicleSchema.model_validate(vehicle) for vehicle in vehicles],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


