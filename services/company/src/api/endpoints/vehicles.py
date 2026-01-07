"""
Vehicle management endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Vehicle, Branch, VehicleTypeModel, VehicleType, VehicleStatus, VehicleBranch
from src.helpers import validate_branch_exists
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

    # Build query - show all vehicles (both active and inactive)
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

    if is_active is not None:
        query = query.where(Vehicle.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Vehicle.plate_number)

    # Include vehicle type and branches relationships
    query = query.options(
        selectinload(Vehicle.vehicle_type_relation),
        selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
    )

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
        status_options = ["available", "assigned", "on_trip", "maintenance", "out_of_service"]
        logger.info(f"Returning status options: {status_options}")
        return status_options
    except Exception as e:
        logger.error(f"Error getting vehicle status options: {e}")
        return ["available", "assigned", "on_trip", "maintenance", "out_of_service"]


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
        selectinload(Vehicle.vehicle_type_relation),
        selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
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

    # Extract branch_ids from request data
    branch_ids = vehicle_data.branch_ids if hasattr(vehicle_data, 'branch_ids') else None

    # Create new vehicle (excluding branch_ids as it's not a model field)
    vehicle_data_dict = vehicle_data.model_dump(exclude={'branch_ids'})
    vehicle = Vehicle(
        tenant_id=tenant_id,
        **vehicle_data_dict
    )

    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)

    # Handle branch assignments if not available for all branches
    if not vehicle.available_for_all_branches and branch_ids:
        # Validate all branch IDs
        for branch_id in branch_ids:
            try:
                await validate_branch_exists(db, branch_id, tenant_id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Create vehicle-branch relationships
        for branch_id in branch_ids:
            vehicle_branch = VehicleBranch(
                vehicle_id=vehicle.id,
                branch_id=branch_id,
                tenant_id=tenant_id
            )
            db.add(vehicle_branch)
        await db.commit()

    # Load the vehicle_type and branches relationships for response
    vehicle_with_relationships = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle.id)
        .options(
            selectinload(Vehicle.vehicle_type_relation),
            selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
        )
    )
    vehicle = vehicle_with_relationships.scalar_one()

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

    # Get existing vehicle with relationships
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    ).options(
        selectinload(Vehicle.vehicle_type_relation)
    )
    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Extract branch_ids from request data if present
    update_data = vehicle_data.model_dump(exclude_unset=True, exclude={'branch_ids'})
    branch_ids = vehicle_data.branch_ids if hasattr(vehicle_data, 'branch_ids') else None
    available_for_all_branches = update_data.get('available_for_all_branches')

    # Update vehicle fields
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)

    # Handle branch assignments if available_for_all_branches is explicitly set or branch_ids is provided
    if available_for_all_branches is not None or branch_ids is not None:
        # Delete existing branch relationships
        await db.execute(
            delete(VehicleBranch).where(VehicleBranch.vehicle_id == vehicle_id)
        )
        await db.commit()

        # If not available for all branches and branch_ids are provided, create new relationships
        if not vehicle.available_for_all_branches and branch_ids:
            # Validate all branch IDs
            for branch_id in branch_ids:
                try:
                    await validate_branch_exists(db, branch_id, tenant_id)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

            # Create vehicle-branch relationships
            for branch_id in branch_ids:
                vehicle_branch = VehicleBranch(
                    vehicle_id=vehicle.id,
                    branch_id=branch_id,
                    tenant_id=tenant_id
                )
                db.add(vehicle_branch)
            await db.commit()

    # Load the vehicle_type and branches relationships for response
    vehicle_with_relationships = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle.id)
        .options(
            selectinload(Vehicle.vehicle_type_relation),
            selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
        )
    )
    vehicle = vehicle_with_relationships.scalar_one()

    return VehicleSchema.model_validate(vehicle)


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(
    vehicle_id: UUID,
    token_data: TokenData = Depends(require_permissions(["vehicles:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (hard delete) a vehicle

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

    # Hard delete - remove vehicle from database
    await db.delete(vehicle)
    await db.commit()

    return None


@router.put("/{vehicle_id}/status", response_model=VehicleSchema)
async def update_vehicle_status(
    vehicle_id: UUID,
    status: str = Query(..., description="Vehicle status (available, assigned, on_trip, maintenance, out_of_service)"),
    token_data: TokenData = Depends(require_any_permission(["vehicles:update", "tms:status_update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update vehicle status

    Requires one of:
    - vehicles:update
    - tms:status_update (special permission for TMS service to update status when trip completes)
    """
    logger.info(f"update_vehicle_status called: vehicle_id={vehicle_id}, status={status}, tenant_id={tenant_id}")

    # Get existing vehicle
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id,
        Vehicle.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        logger.error(f"Vehicle not found: vehicle_id={vehicle_id}, tenant_id={tenant_id}")
        raise HTTPException(status_code=404, detail="Vehicle not found")

    old_status = vehicle.status
    logger.info(f"Current vehicle status: {old_status}, new status: {status}")

    # Validate and convert status to enum
    try:
        vehicle_status = VehicleStatus(status)
        logger.info(f"Validated status: {vehicle_status}")
    except ValueError as e:
        logger.error(f"Invalid vehicle status: {status}, error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid vehicle status: {status}. Must be one of: {[s.value for s in VehicleStatus]}"
        )

    # Update status
    vehicle.status = vehicle_status
    logger.info(f"Vehicle {vehicle.plate_number} (ID: {vehicle_id}) status updated from {old_status} to {vehicle_status}")

    # Set maintenance dates if applicable
    if vehicle_status == VehicleStatus.MAINTENANCE:
        vehicle.last_maintenance = datetime.utcnow()
    elif vehicle_status == VehicleStatus.AVAILABLE:
        # Coming from maintenance, set next maintenance date
        if vehicle.last_maintenance:
            # Schedule next maintenance in 3 months
            from datetime import timedelta
            vehicle.next_maintenance = vehicle.last_maintenance + timedelta(days=90)

    await db.commit()
    await db.refresh(vehicle)

    # Load the branches relationships for response
    vehicle_with_relationships = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle.id)
        .options(
            selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
        )
    )
    vehicle = vehicle_with_relationships.scalar_one()

    return VehicleSchema.model_validate(vehicle)


@router.get("/available", response_model=PaginatedResponse)
async def get_available_vehicles(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    vehicle_type: Optional[VehicleType] = Query(None),
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

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Vehicle.plate_number)

    # Include vehicle_type_relation and branches relationships
    query = query.options(
        selectinload(Vehicle.vehicle_type_relation),
        selectinload(Vehicle.branches).selectinload(VehicleBranch.branch)
    )

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


