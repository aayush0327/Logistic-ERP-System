"""
Business type management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, BusinessTypeModel
from src.schemas import (
    BusinessTypeModel as BusinessTypeModelSchema,
    BusinessTypeCreate,
    BusinessTypeUpdate,
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
    CUSTOMER_READ_ALL,
    CUSTOMER_READ,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE,
    CUSTOMER_DELETE,
)

router = APIRouter()


@router.get("/", response_model=PaginatedResponse)
async def list_business_types(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission(CUSTOMER_READ_ALL + CUSTOMER_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all business types for the current tenant

    Requires:
    - customers:read_all (to view all business types) OR
    - customers:read (to view basic business type info)
    """

    # Build query
    query = select(BusinessTypeModel).where(BusinessTypeModel.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            BusinessTypeModel.name.ilike(f"%{search}%") |
            BusinessTypeModel.code.ilike(f"%{search}%") |
            BusinessTypeModel.description.ilike(f"%{search}%")
        )

    if is_active is not None:
        query = query.where(BusinessTypeModel.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(BusinessTypeModel.name)

    # Execute query
    result = await db.execute(query)
    business_types = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[BusinessTypeModelSchema.model_validate(bt) for bt in business_types],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/all", response_model=List[BusinessTypeModelSchema])
async def get_all_business_types(
    is_active: Optional[bool] = Query(True),
    token_data: TokenData = Depends(require_any_permission(CUSTOMER_READ_ALL + CUSTOMER_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all business types (non-paginated) for dropdowns

    Requires:
    - customers:read_all (to view all business types) OR
    - customers:read (to view basic business type info)
    """

    # Build query
    query = select(BusinessTypeModel).where(BusinessTypeModel.tenant_id == tenant_id)

    if is_active is not None:
        query = query.where(BusinessTypeModel.is_active == is_active)

    query = query.order_by(BusinessTypeModel.name)

    # Execute query
    result = await db.execute(query)
    business_types = result.scalars().all()

    return [BusinessTypeModelSchema.model_validate(bt) for bt in business_types]


@router.get("/{business_type_id}", response_model=BusinessTypeModelSchema)
async def get_business_type(
    business_type_id: UUID,
    token_data: TokenData = Depends(require_any_permission(CUSTOMER_READ_ALL + CUSTOMER_READ)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific business type by ID

    Requires:
    - customers:read_all (to view any business type) OR
    - customers:read (to view basic business type info)
    """

    # Get business type
    query = select(BusinessTypeModel).where(
        BusinessTypeModel.id == business_type_id,
        BusinessTypeModel.tenant_id == tenant_id
    )

    result = await db.execute(query)
    business_type = result.scalar_one_or_none()

    if not business_type:
        raise HTTPException(status_code=404, detail="Business type not found")

    return BusinessTypeModelSchema.model_validate(business_type)


@router.post("/", response_model=BusinessTypeModelSchema, status_code=201)
async def create_business_type(
    business_type_data: BusinessTypeCreate,
    token_data: TokenData = Depends(require_permissions(CUSTOMER_CREATE)),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new business type

    Requires:
    - customers:create
    """

    # Check if business type code already exists for tenant
    existing_query = select(BusinessTypeModel).where(
        BusinessTypeModel.code == business_type_data.code,
        BusinessTypeModel.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Business type with this code already exists"
        )

    # Create new business type
    business_type = BusinessTypeModel(
        tenant_id=tenant_id,
        **business_type_data.model_dump()
    )

    db.add(business_type)
    await db.commit()
    await db.refresh(business_type)

    return BusinessTypeModelSchema.model_validate(business_type)


@router.put("/{business_type_id}", response_model=BusinessTypeModelSchema)
async def update_business_type(
    business_type_id: UUID,
    business_type_data: BusinessTypeUpdate,
    token_data: TokenData = Depends(require_permissions(CUSTOMER_UPDATE)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a business type

    Requires:
    - customers:update
    """

    # Get existing business type
    query = select(BusinessTypeModel).where(
        BusinessTypeModel.id == business_type_id,
        BusinessTypeModel.tenant_id == tenant_id
    )
    result = await db.execute(query)
    business_type = result.scalar_one_or_none()

    if not business_type:
        raise HTTPException(status_code=404, detail="Business type not found")

    # Update business type
    update_data = business_type_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business_type, field, value)

    await db.commit()
    await db.refresh(business_type)

    return BusinessTypeModelSchema.model_validate(business_type)


@router.delete("/{business_type_id}", status_code=204)
async def delete_business_type(
    business_type_id: UUID,
    token_data: TokenData = Depends(require_permissions(CUSTOMER_DELETE)),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) a business type

    Requires:
    - customers:delete

    Note: Business types with existing customers cannot be deleted.
    You must reassign or remove the business type from all customers first.
    """

    from src.database import Customer

    # Get existing business type
    query = select(BusinessTypeModel).where(
        BusinessTypeModel.id == business_type_id,
        BusinessTypeModel.tenant_id == tenant_id
    )
    result = await db.execute(query)
    business_type = result.scalar_one_or_none()

    if not business_type:
        raise HTTPException(status_code=404, detail="Business type not found")

    # Check if any customers are using this business type
    customer_count_query = select(func.count()).select_from(
        select(Customer).where(
            Customer.business_type_id == business_type_id,
            Customer.tenant_id == tenant_id
        ).subquery()
    )
    customer_count_result = await db.execute(customer_count_query)
    customer_count = customer_count_result.scalar()

    # Prevent deletion if customers are using this business type
    if customer_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete business type. {customer_count} customer(s) are currently using this business type. Please reassign or remove the business type from these customers first."
        )

    # Hard delete - remove the business type
    await db.delete(business_type)
    await db.commit()
