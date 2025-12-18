"""
Branch management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Branch, Customer, Vehicle, VehicleStatus
from src.schemas import (
    Branch as BranchSchema,
    BranchCreate,
    BranchUpdate,
    BranchInDB,
    PaginatedResponse
)

router = APIRouter()


# Helper function to get tenant_id from request (mock for now)
async def get_current_tenant_id() -> str:
    """
    Get current tenant ID from authentication token
    TODO: Implement proper authentication integration
    """
    # Mock implementation - in production, this will extract from JWT token
    return "default-tenant"


@router.get("/", response_model=PaginatedResponse)
async def list_branches(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    List all branches for the current tenant
    """
    tenant_id = await get_current_tenant_id()

    # Build query
    query = select(Branch).where(Branch.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            Branch.name.ilike(f"%{search}%") |
            Branch.code.ilike(f"%{search}%") |
            Branch.city.ilike(f"%{search}%")
        )

    if is_active is not None:
        query = query.where(Branch.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Branch.name)

    # Execute query
    result = await db.execute(query)
    branches = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[BranchSchema.model_validate(branch) for branch in branches],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{branch_id}", response_model=BranchSchema)
async def get_branch(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific branch by ID
    """
    tenant_id = await get_current_tenant_id()

    # Get branch with relationships
    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    ).options(
        selectinload(Branch.customers),
        selectinload(Branch.vehicles)
    )

    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    return BranchSchema.model_validate(branch)


@router.post("/", response_model=BranchSchema, status_code=201)
async def create_branch(
    branch_data: BranchCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new branch
    """
    tenant_id = await get_current_tenant_id()

    # Check if branch code already exists
    existing_query = select(Branch).where(
        Branch.code == branch_data.code,
        Branch.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Branch with this code already exists"
        )

    # Create new branch
    branch = Branch(
        tenant_id=tenant_id,
        **branch_data.model_dump()
    )

    db.add(branch)
    await db.commit()
    await db.refresh(branch)

    return BranchSchema.model_validate(branch)


@router.put("/{branch_id}", response_model=BranchSchema)
async def update_branch(
    branch_id: UUID,
    branch_data: BranchUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a branch
    """
    tenant_id = await get_current_tenant_id()

    # Get existing branch
    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    )
    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Update branch
    update_data = branch_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branch, field, value)

    await db.commit()
    await db.refresh(branch)

    return BranchSchema.model_validate(branch)


@router.delete("/{branch_id}", status_code=204)
async def delete_branch(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) a branch
    """
    tenant_id = await get_current_tenant_id()

    # Get existing branch
    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    )
    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Check if branch has customers or vehicles
    if branch.customers or branch.vehicles:
        # Soft delete - deactivate instead
        branch.is_active = False
        await db.commit()
    else:
        # Hard delete if no dependencies
        await db.delete(branch)
        await db.commit()


@router.get("/{branch_id}/metrics")
async def get_branch_metrics(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get performance metrics for a branch
    """
    tenant_id = await get_current_tenant_id()

    # Get branch
    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    )
    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Count customers for this branch using direct queries
    customer_query = select(func.count()).select_from(Customer).where(
        Customer.home_branch_id == branch_id,
        Customer.tenant_id == tenant_id
    )
    customer_result = await db.execute(customer_query)
    customer_count = customer_result.scalar() or 0

    # Count vehicles for this branch
    vehicle_query = select(func.count()).select_from(Vehicle).where(
        Vehicle.branch_id == branch_id,
        Vehicle.tenant_id == tenant_id
    )
    vehicle_result = await db.execute(vehicle_query)
    vehicle_count = vehicle_result.scalar() or 0

    # Count active vehicles for this branch
    active_vehicle_query = select(func.count()).select_from(Vehicle).where(
        Vehicle.branch_id == branch_id,
        Vehicle.tenant_id == tenant_id,
        Vehicle.status == VehicleStatus.AVAILABLE
    )
    active_vehicle_result = await db.execute(active_vehicle_query)
    active_vehicles = active_vehicle_result.scalar() or 0

    return {
        "branch_id": str(branch_id),
        "customer_count": customer_count,
        "vehicle_count": vehicle_count,
        "active_vehicles": active_vehicles,
        "vehicle_utilization": ((vehicle_count - active_vehicles) / vehicle_count * 100) if vehicle_count > 0 else 0
    }