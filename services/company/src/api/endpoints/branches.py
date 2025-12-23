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
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
    BRANCH_READ_ALL,
    BRANCH_READ,
    BRANCH_CREATE,
    BRANCH_UPDATE,
    BRANCH_DELETE,
    BRANCH_MANAGE_ALL,
    BRANCH_MANAGE_OWN,
)

router = APIRouter()


@router.get("/", response_model=PaginatedResponse)
async def list_branches(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission([BRANCH_READ_ALL[0], BRANCH_READ[0]])),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    List all branches for the current tenant

    Requires:
    - branches:read_all to see all branches
    - branches:read to see assigned branches only
    """

    # Build query
    query = select(Branch).where(Branch.tenant_id == tenant_id)

    # Filter branches based on user permissions
    has_read_all = await token_data.has_permission("branches:read_all")
    if not token_data.is_super_user() and not has_read_all:
        # For users with only branches:read permission, filter by assigned branches
        # TODO: Implement branch assignment logic based on user-branch relationships
        # For now, we'll show all branches for users with read permission
        pass

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
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission([BRANCH_READ_ALL[0], BRANCH_READ[0]])),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Get a specific branch by ID

    Requires:
    - branches:read_all or branches:read
    """

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
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions([BRANCH_CREATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new branch

    Requires:
    - branches:create
    """

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
    branch_data_dict = branch_data.model_dump()
    branch_data_dict["created_by"] = user_id  # Add user tracking

    branch = Branch(
        tenant_id=tenant_id,
        **branch_data_dict
    )

    db.add(branch)
    await db.commit()
    await db.refresh(branch)

    return BranchSchema.model_validate(branch)


@router.put("/{branch_id}", response_model=BranchSchema)
async def update_branch(
    branch_id: UUID,
    branch_data: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission([BRANCH_UPDATE[0], BRANCH_MANAGE_ALL[0], BRANCH_MANAGE_OWN[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id)
):
    """
    Update a branch

    Requires:
    - branches:update or
    - branches:manage_all or
    - branches:manage_own (for assigned branches)
    """

    # Get existing branch
    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    )
    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Additional permission check for branches:manage_own
    if (not token_data.is_super_user() and
        "branches:manage_all" not in token_data.permissions and
        "branches:update" not in token_data.permissions and
        "branches:manage_own" in token_data.permissions):
        # TODO: Verify user is assigned to this branch
        # For now, we'll allow manage_own permission to proceed
        pass

    # Update branch
    update_data = branch_data.model_dump(exclude_unset=True)
    update_data["updated_by"] = user_id  # Add user tracking
    for field, value in update_data.items():
        setattr(branch, field, value)

    await db.commit()
    await db.refresh(branch)

    return BranchSchema.model_validate(branch)


@router.delete("/{branch_id}", status_code=204)
async def delete_branch(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission([BRANCH_DELETE[0], BRANCH_MANAGE_ALL[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete (deactivate) a branch

    Requires:
    - branches:delete or
    - branches:manage_all
    """

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
        branch.deleted_by = user_id  # Track who deleted the branch
        await db.commit()
    else:
        # Hard delete if no dependencies
        # Note: In a production system, you might want to always soft delete for audit purposes
        branch.deleted_by = user_id
        branch.is_active = False
        await db.commit()
        # Uncomment below for actual hard delete (not recommended for audit trail)
        # await db.delete(branch)
        # await db.commit()


@router.get("/{branch_id}/metrics")
async def get_branch_metrics(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission([BRANCH_READ_ALL[0], BRANCH_READ[0], "branches:view_metrics"])),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Get performance metrics for a branch

    Requires:
    - branches:read_all or branches:read or branches:view_metrics
    """

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