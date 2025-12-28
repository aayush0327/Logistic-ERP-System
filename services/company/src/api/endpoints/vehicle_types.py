"""
Vehicle type management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, VehicleTypeModel
from src.schemas import (
    VehicleTypeModel as VehicleTypeModelSchema,
    VehicleTypeCreate,
    VehicleTypeUpdate,
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
    VEHICLE_READ_ALL,
    VEHICLE_READ,
    VEHICLE_CREATE,
    VEHICLE_UPDATE,
    VEHICLE_DELETE,
)

router = APIRouter()


@router.get("/", response_model=PaginatedResponse)
async def list_vehicle_types(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission(VEHICLE_READ_ALL + VEHICLE_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all vehicle types for the current tenant

    Requires:
    - vehicles:read_all (to view all vehicle types) OR
    - vehicles:read (to view basic vehicle type info)
    """

    # Build query
    query = select(VehicleTypeModel).where(VehicleTypeModel.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            VehicleTypeModel.name.ilike(f"%{search}%") |
            VehicleTypeModel.code.ilike(f"%{search}%") |
            VehicleTypeModel.description.ilike(f"%{search}%")
        )

    if is_active is not None:
        query = query.where(VehicleTypeModel.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(VehicleTypeModel.name)

    # Execute query
    result = await db.execute(query)
    vehicle_types = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[VehicleTypeModelSchema.model_validate(vt) for vt in vehicle_types],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/all", response_model=List[VehicleTypeModelSchema])
async def get_all_vehicle_types(
    is_active: Optional[bool] = Query(True),
    token_data: TokenData = Depends(require_any_permission(VEHICLE_READ_ALL + VEHICLE_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all vehicle types (non-paginated) for dropdowns

    Requires:
    - vehicles:read_all (to view all vehicle types) OR
    - vehicles:read (to view basic vehicle type info)
    """

    # Build query
    query = select(VehicleTypeModel).where(VehicleTypeModel.tenant_id == tenant_id)

    if is_active is not None:
        query = query.where(VehicleTypeModel.is_active == is_active)

    query = query.order_by(VehicleTypeModel.name)

    # Execute query
    result = await db.execute(query)
    vehicle_types = result.scalars().all()

    return [VehicleTypeModelSchema.model_validate(vt) for vt in vehicle_types]


@router.get("/{vehicle_type_id}", response_model=VehicleTypeModelSchema)
async def get_vehicle_type(
    vehicle_type_id: UUID,
    token_data: TokenData = Depends(require_any_permission(VEHICLE_READ_ALL + VEHICLE_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific vehicle type by ID

    Requires:
    - vehicles:read_all (to view any vehicle type) OR
    - vehicles:read (to view basic vehicle type info)
    """

    # Get vehicle type
    query = select(VehicleTypeModel).where(
        VehicleTypeModel.id == vehicle_type_id,
        VehicleTypeModel.tenant_id == tenant_id
    )

    result = await db.execute(query)
    vehicle_type = result.scalar_one_or_none()

    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    return VehicleTypeModelSchema.model_validate(vehicle_type)


@router.post("/", response_model=VehicleTypeModelSchema, status_code=201)
async def create_vehicle_type(
    vehicle_type_data: VehicleTypeCreate,
    token_data: TokenData = Depends(require_permissions(VEHICLE_CREATE)),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new vehicle type

    Requires:
    - vehicles:create
    """

    # Check if vehicle type code already exists for tenant
    existing_query = select(VehicleTypeModel).where(
        VehicleTypeModel.code == vehicle_type_data.code,
        VehicleTypeModel.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Vehicle type with this code already exists"
        )

    # Create new vehicle type
    vehicle_type = VehicleTypeModel(
        tenant_id=tenant_id,
        **vehicle_type_data.model_dump()
    )

    db.add(vehicle_type)
    await db.commit()
    await db.refresh(vehicle_type)

    return VehicleTypeModelSchema.model_validate(vehicle_type)


@router.put("/{vehicle_type_id}", response_model=VehicleTypeModelSchema)
async def update_vehicle_type(
    vehicle_type_id: UUID,
    vehicle_type_data: VehicleTypeUpdate,
    token_data: TokenData = Depends(require_permissions(VEHICLE_UPDATE)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a vehicle type

    Requires:
    - vehicles:update
    """

    # Get existing vehicle type
    query = select(VehicleTypeModel).where(
        VehicleTypeModel.id == vehicle_type_id,
        VehicleTypeModel.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle_type = result.scalar_one_or_none()

    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    # Update vehicle type
    update_data = vehicle_type_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle_type, field, value)

    await db.commit()
    await db.refresh(vehicle_type)

    return VehicleTypeModelSchema.model_validate(vehicle_type)


@router.delete("/{vehicle_type_id}", status_code=204)
async def delete_vehicle_type(
    vehicle_type_id: UUID,
    token_data: TokenData = Depends(require_permissions(VEHICLE_DELETE)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a vehicle type

    Requires:
    - vehicles:delete

    Note: Vehicle types with existing vehicles cannot be deleted.
    You must reassign or remove the vehicle type from all vehicles first.
    """

    from src.database import Vehicle

    # Get existing vehicle type
    query = select(VehicleTypeModel).where(
        VehicleTypeModel.id == vehicle_type_id,
        VehicleTypeModel.tenant_id == tenant_id
    )
    result = await db.execute(query)
    vehicle_type = result.scalar_one_or_none()

    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    # Check if any vehicles are using this vehicle type
    vehicle_count_query = select(func.count()).select_from(
        select(Vehicle).where(
            Vehicle.vehicle_type_id == vehicle_type_id,
            Vehicle.tenant_id == tenant_id
        ).subquery()
    )
    vehicle_count_result = await db.execute(vehicle_count_query)
    vehicle_count = vehicle_count_result.scalar()

    # Prevent deletion if vehicles are using this vehicle type
    if vehicle_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete vehicle type. {vehicle_count} vehicle(s) are currently using this vehicle type. Please reassign or remove the vehicle type from these vehicles first."
        )

    # Hard delete - remove the vehicle type
    await db.delete(vehicle_type)
    await db.commit()
