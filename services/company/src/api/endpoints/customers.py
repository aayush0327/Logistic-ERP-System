"""
Customer management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Customer, Branch, BusinessType, BusinessTypeModel, CustomerBranch, CustomerBusinessType
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

    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Customer.name)

    # Include business types and branches relationships
    query = query.options(
        selectinload(Customer.business_type_relation),
        selectinload(Customer.business_types).selectinload(CustomerBusinessType.business_type),
        selectinload(Customer.branches).selectinload(CustomerBranch.branch)
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
        selectinload(Customer.business_type_relation),
        selectinload(Customer.business_types).selectinload(CustomerBusinessType.business_type),
        selectinload(Customer.branches).selectinload(CustomerBranch.branch)
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

    # Extract branch_ids and business_type_ids from request data
    branch_ids = customer_data.branch_ids if hasattr(customer_data, 'branch_ids') else None
    business_type_ids = customer_data.business_type_ids if hasattr(customer_data, 'business_type_ids') else None

    # For backward compatibility, if business_type_id is provided and business_type_ids is not, convert it
    if hasattr(customer_data, 'business_type_id') and customer_data.business_type_id and not business_type_ids:
        business_type_ids = [customer_data.business_type_id]

    # Create new customer (excluding branch_ids and business_type_ids as they're not model fields)
    customer_data_dict = customer_data.model_dump(exclude={'branch_ids', 'business_type_ids'})
    customer = Customer(
        tenant_id=tenant_id,
        **customer_data_dict
    )

    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    # Handle business type assignments
    if business_type_ids:
        # Validate all business type IDs exist and belong to tenant
        for bt_id in business_type_ids:
            bt_query = select(BusinessTypeModel).where(
                BusinessTypeModel.id == bt_id,
                BusinessTypeModel.tenant_id == tenant_id
            )
            bt_result = await db.execute(bt_query)
            if not bt_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=400,
                    detail=f"Business type with id {bt_id} not found"
                )

        # Create customer-business type relationships
        for bt_id in business_type_ids:
            customer_bt = CustomerBusinessType(
                customer_id=customer.id,
                business_type_id=bt_id,
                tenant_id=tenant_id
            )
            db.add(customer_bt)
        await db.commit()

    # Handle branch assignments if not available for all branches
    if not customer.available_for_all_branches and branch_ids:
        # Validate all branch IDs
        for branch_id in branch_ids:
            try:
                await validate_branch_exists(db, branch_id, tenant_id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Create customer-branch relationships
        for branch_id in branch_ids:
            customer_branch = CustomerBranch(
                customer_id=customer.id,
                branch_id=branch_id,
                tenant_id=tenant_id
            )
            db.add(customer_branch)
        await db.commit()

    # Load the business types and branches relationships for response
    customer_with_relationships = await db.execute(
        select(Customer)
        .where(Customer.id == customer.id)
        .options(
            selectinload(Customer.business_type_relation),
            selectinload(Customer.business_types).selectinload(CustomerBusinessType.business_type),
            selectinload(Customer.branches).selectinload(CustomerBranch.branch)
        )
    )
    customer = customer_with_relationships.scalar_one()

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
        selectinload(Customer.business_type_relation)
    )
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Extract branch_ids and business_type_ids from request data if present
    update_data = customer_data.model_dump(exclude_unset=True, exclude={'branch_ids', 'business_type_ids'})
    branch_ids = customer_data.branch_ids if hasattr(customer_data, 'branch_ids') else None
    business_type_ids = customer_data.business_type_ids if hasattr(customer_data, 'business_type_ids') else None
    available_for_all_branches = update_data.get('available_for_all_branches')

    # Update customer fields
    for field, value in update_data.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)

    # Handle business type assignments if business_type_ids is provided
    if business_type_ids is not None:
        # Delete existing business type relationships
        await db.execute(
            delete(CustomerBusinessType).where(CustomerBusinessType.customer_id == customer_id)
        )
        await db.commit()

        if business_type_ids:
            # Validate all business type IDs exist and belong to tenant
            for bt_id in business_type_ids:
                bt_query = select(BusinessTypeModel).where(
                    BusinessTypeModel.id == bt_id,
                    BusinessTypeModel.tenant_id == tenant_id
                )
                bt_result = await db.execute(bt_query)
                if not bt_result.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Business type with id {bt_id} not found"
                    )

            # Create customer-business type relationships
            for bt_id in business_type_ids:
                customer_bt = CustomerBusinessType(
                    customer_id=customer.id,
                    business_type_id=bt_id,
                    tenant_id=tenant_id
                )
                db.add(customer_bt)
            await db.commit()

    # Handle branch assignments if available_for_all_branches is explicitly set or branch_ids is provided
    if available_for_all_branches is not None or branch_ids is not None:
        # Delete existing branch relationships
        await db.execute(
            delete(CustomerBranch).where(CustomerBranch.customer_id == customer_id)
        )
        await db.commit()

        # If not available for all branches and branch_ids are provided, create new relationships
        if not customer.available_for_all_branches and branch_ids:
            # Validate all branch IDs
            for branch_id in branch_ids:
                try:
                    await validate_branch_exists(db, branch_id, tenant_id)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

            # Create customer-branch relationships
            for branch_id in branch_ids:
                customer_branch = CustomerBranch(
                    customer_id=customer.id,
                    branch_id=branch_id,
                    tenant_id=tenant_id
                )
                db.add(customer_branch)
            await db.commit()

    # Load the business types and branches relationships for response
    customer_with_relationships = await db.execute(
        select(Customer)
        .where(Customer.id == customer.id)
        .options(
            selectinload(Customer.business_type_relation),
            selectinload(Customer.business_types).selectinload(CustomerBusinessType.business_type),
            selectinload(Customer.branches).selectinload(CustomerBranch.branch)
        )
    )
    customer = customer_with_relationships.scalar_one()

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