"""
Customer management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Customer, Branch, BusinessType, BusinessTypeModel
from src.helpers import validate_branch_exists
from src.schemas import (
    Customer as CustomerSchema,
    CustomerCreate,
    CustomerUpdate,
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
async def list_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    business_type: Optional[BusinessType] = Query(None),  # Deprecated - old enum filter
    business_type_id: Optional[UUID] = Query(None),  # New - dynamic business type filter
    home_branch_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission(["customers:read_all", "customers:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all customers for the current tenant

    Requires:
    - customers:read_all (to view all customers) OR
    - customers:read (to view basic customer info)
    """


    # Build query
    query = select(Customer).where(Customer.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            Customer.name.ilike(f"%{search}%") |
            Customer.code.ilike(f"%{search}%") |
            Customer.email.ilike(f"%{search}%") |
            Customer.phone.ilike(f"%{search}%")
        )

    # Support both old enum filter and new foreign key filter
    if business_type_id:
        query = query.where(Customer.business_type_id == business_type_id)
    elif business_type:
        query = query.where(Customer.business_type == business_type)

    if home_branch_id:
        query = query.where(Customer.home_branch_id == home_branch_id)

    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Customer.name)

    # Include branch and business type relationships
    query = query.options(
        selectinload(Customer.home_branch),
        selectinload(Customer.business_type_relation)
    )

    # Execute query
    result = await db.execute(query)
    customers = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[CustomerSchema.model_validate(customer) for customer in customers],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{customer_id}", response_model=CustomerSchema)
async def get_customer(
    customer_id: UUID,
    token_data: TokenData = Depends(require_any_permission(["customers:read_all", "customers:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific customer by ID

    Requires:
    - customers:read_all (to view any customer) OR
    - customers:read (to view basic customer info)
    """

    # Get customer with relationships
    query = select(Customer).where(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    ).options(
        selectinload(Customer.home_branch),
        selectinload(Customer.business_type_relation)
    )

    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return CustomerSchema.model_validate(customer)


@router.post("/", response_model=CustomerSchema, status_code=201)
async def create_customer(
    customer_data: CustomerCreate,
    token_data: TokenData = Depends(require_permissions(["customers:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new customer

    Requires:
    - customers:create
    """

    # Check if customer code already exists
    existing_query = select(Customer).where(
        Customer.code == customer_data.code,
        Customer.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Customer with this code already exists"
        )

    # Validate home branch if provided
    if customer_data.home_branch_id:
        try:
            await validate_branch_exists(db, customer_data.home_branch_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Create new customer
    customer = Customer(
        tenant_id=tenant_id,
        **customer_data.model_dump()
    )

    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    # Load the branch and business_type relationships for response
    await db.refresh(customer, ["home_branch", "business_type_relation"])

    return CustomerSchema.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerSchema)
async def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    token_data: TokenData = Depends(require_permissions(["customers:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a customer

    Requires:
    - customers:update_all (to update any customer) OR
    - customers:update_own (to update own assigned customers)
    """

    # Get existing customer with relationships
    query = select(Customer).where(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    ).options(
        selectinload(Customer.home_branch),
        selectinload(Customer.business_type_relation)
    )
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Validate home branch if provided
    if customer_data.home_branch_id:
        try:
            await validate_branch_exists(db, customer_data.home_branch_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Update customer
    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)

    # Load the branch and business_type relationships for response
    await db.refresh(customer, ["home_branch", "business_type_relation"])

    return CustomerSchema.model_validate(customer)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: UUID,
    token_data: TokenData = Depends(require_permissions(["customers:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (hard delete) a customer

    Requires:
    - customers:delete
    """

    # Get existing customer
    query = select(Customer).where(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    )
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Hard delete - remove customer from database
    await db.delete(customer)
    await db.commit()

    return None


@router.get("/business-types")
@router.get("/business-types/")
async def get_business_types(
    token_data: TokenData = Depends(require_any_permission([*CUSTOMER_READ_ALL, *CUSTOMER_READ]))
):
    """
    Get list of available business types

    Requires:
    - customers:read_all (to view all customers) OR
    - customers:read (to view basic customer info)
    """
    try:
        # Return the enum values - these will be used as both value and display in frontend
        business_types = [
            BusinessType.INDIVIDUAL.value,
            BusinessType.SMALL_BUSINESS.value,
            BusinessType.CORPORATE.value,
            BusinessType.GOVERNMENT.value
        ]
        return business_types
    except Exception as e:
        # Log the error for debugging
        print(f"Error in get_business_types: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")