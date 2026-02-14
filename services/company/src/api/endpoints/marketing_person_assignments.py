"""
Marketing Person Customer Assignment endpoints
"""
from typing import List, Optional
from uuid import UUID
import logging
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from sqlalchemy import select, func, delete, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import httpx

from src.database import get_db, Customer, MarketingPersonCustomer, EmployeeProfile
from src.schemas import (
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
)
from src.config_local import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic model for creating marketing person assignment
class CreateMarketingPersonAssignmentRequest(BaseModel):
    """Request model for creating marketing person assignments"""
    marketing_person_id: str = Field(..., description="ID of the marketing person")
    customer_ids: List[UUID] = Field(..., description="List of customer IDs to assign")
    notes: Optional[str] = Field(None, description="Optional notes for the assignment")


# Pydantic model for updating marketing person assignment
class UpdateMarketingPersonAssignmentRequest(BaseModel):
    """Request model for updating marketing person assignments"""
    notes: Optional[str] = Field(None, description="Updated notes for the assignment")
    is_active: Optional[bool] = Field(None, description="Active status of the assignment")


def extract_auth_token(request: Request) -> str:
    """Extract Bearer token from request headers."""
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing"
        )
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format"
        )
    return auth_header[7:]  # Remove "Bearer " prefix


async def get_marketing_person_role_id(auth_token: str) -> Optional[str]:
    """
    Fetch the Marketing Person role ID from the auth service by name.

    Uses the /api/v1/roles/by-name/{role_name} endpoint.

    Args:
        auth_token: JWT bearer token for authentication

    Returns:
        str: The role ID for Marketing Person role, or None if not found
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/roles/by-name/Marketing Person",
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {auth_token}"
                }
            )

            if response.status_code == 404:
                logger.error("Marketing Person role not found in auth service")
                return None

            if response.status_code != 200:
                logger.error(f"Auth service returned {response.status_code}")
                return None

            role = response.json()
            return str(role["id"])

    except httpx.RequestError as e:
        logger.error(f"Error calling auth service: {e}")
        return None


@router.get("/marketing-persons")
async def get_marketing_persons(
    request: Request,
    search: Optional[str] = Query(None),
    token_data: TokenData = Depends(require_any_permission(["users:read_all", "users:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all marketing persons (users with Marketing Person role) in the current tenant

    Query parameters:
    - search: Search by name, email, or employee code

    Returns list of marketing persons with their assigned customer counts
    """
    # Get auth token from request
    auth_token = extract_auth_token(request)

    # Get Marketing Person role ID from auth service
    marketing_role_id = await get_marketing_person_role_id(auth_token)

    if not marketing_role_id:
        # Return empty list if role not found
        logger.warning("Marketing Person role not found, returning empty list")
        return []

    # Get employee profiles where role_id matches Marketing Person role
    query = select(EmployeeProfile).where(
        EmployeeProfile.tenant_id == tenant_id,
        EmployeeProfile.role_id == marketing_role_id,
        EmployeeProfile.is_active == True
    )

    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (EmployeeProfile.first_name.ilike(search_pattern)) |
            (EmployeeProfile.last_name.ilike(search_pattern)) |
            (EmployeeProfile.email.ilike(search_pattern)) |
            (EmployeeProfile.employee_code.ilike(search_pattern))
        )

    result = await db.execute(query)
    marketing_persons = result.scalars().all()

    # Get assigned customer counts for each marketing person
    marketing_person_ids = [mp.user_id for mp in marketing_persons]

    assigned_counts = {}
    if marketing_person_ids:
        count_query = select(
            MarketingPersonCustomer.marketing_person_id,
            func.count(func.distinct(MarketingPersonCustomer.customer_id))
        ).where(
            MarketingPersonCustomer.marketing_person_id.in_(marketing_person_ids),
            MarketingPersonCustomer.tenant_id == tenant_id,
            MarketingPersonCustomer.is_active == True
        ).group_by(MarketingPersonCustomer.marketing_person_id)

        count_result = await db.execute(count_query)
        for mp_id, count in count_result.all():
            assigned_counts[mp_id] = count

    # Build response
    response = []
    for mp in marketing_persons:
        response.append({
            "id": mp.user_id,
            "email": mp.email,
            "first_name": mp.first_name,
            "last_name": mp.last_name,
            "employee_code": mp.employee_code,
            "assigned_customers_count": assigned_counts.get(mp.user_id, 0)
        })

    return response


@router.get("/customers/for-assignment")
async def get_customers_for_assignment(
    marketing_person_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission(["customers:read_all", "customers:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get customers with their marketing person assignment info

    If marketing_person_id is provided, returns only customers assigned to that marketing person
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

    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Customer.name)

    # Execute query
    result = await db.execute(query)
    customers = result.scalars().all()

    # Get marketing person assignments for each customer
    customer_ids = [c.id for c in customers]

    assignments = {}
    if customer_ids:
        assign_query = select(
            MarketingPersonCustomer.customer_id,
            MarketingPersonCustomer.marketing_person_id
        ).where(
            MarketingPersonCustomer.customer_id.in_(customer_ids),
            MarketingPersonCustomer.tenant_id == tenant_id,
            MarketingPersonCustomer.is_active == True
        )

        assign_result = await db.execute(assign_query)
        for cust_id, mp_id in assign_result.all():
            if cust_id not in assignments:
                assignments[cust_id] = []
            assignments[cust_id].append(mp_id)

    # Get marketing person names
    marketing_person_ids = list(set([
        mp_id for mps in assignments.values() for mp_id in mps
    ]))

    mp_names = {}
    if marketing_person_ids:
        mp_query = select(EmployeeProfile).where(
            EmployeeProfile.user_id.in_(marketing_person_ids)
        )
        mp_result = await db.execute(mp_query)
        for mp in mp_result.scalars().all():
            mp_names[mp.user_id] = f"{mp.first_name} {mp.last_name}".strip()

    # Filter by marketing_person_id if provided
    if marketing_person_id:
        filtered_customers = []
        for customer in customers:
            if marketing_person_id in assignments.get(str(customer.id), []):
                filtered_customers.append(customer)
        customers = filtered_customers
        # Recalculate total and pages for filtered results
        total = len(customers)
        pages = (total + per_page - 1) // per_page
    else:
        pages = (total + per_page - 1) // per_page

    # Build response
    response = []
    for customer in customers:
        customer_mp_ids = assignments.get(str(customer.id), [])
        customer_mp_names = [mp_names.get(mp_id, "") for mp_id in customer_mp_ids]

        # Get first assigned marketing person (for single value fields)
        first_mp_id = customer_mp_ids[0] if customer_mp_ids else None
        first_mp_name = customer_mp_names[0] if customer_mp_names else None

        response.append({
            "id": str(customer.id),
            "code": customer.code,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "city": customer.city,
            "is_active": customer.is_active,
            "assigned_marketing_persons": customer_mp_names,
            "assigned_marketing_person_ids": customer_mp_ids,
            # Single value fields for backward compatibility
            "assigned_marketing_person_id": first_mp_id,
            "assigned_marketing_person_name": first_mp_name
        })

    return PaginatedResponse(
        items=response,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/")
async def get_marketing_person_assignments(
    marketing_person_id: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    token_data: TokenData = Depends(require_any_permission(["marketing_person_assignments:read", "customers:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all marketing person to customer assignments

    Query parameters:
    - marketing_person_id: Filter by specific marketing person
    - customer_id: Filter by specific customer
    - is_active: Filter by active status
    - page: Page number for pagination
    - per_page: Items per page
    """
    # Build query
    query = select(MarketingPersonCustomer).where(MarketingPersonCustomer.tenant_id == tenant_id)

    # Apply filters
    if marketing_person_id:
        query = query.where(MarketingPersonCustomer.marketing_person_id == marketing_person_id)

    if customer_id:
        query = query.where(MarketingPersonCustomer.customer_id == customer_id)

    if is_active is not None:
        query = query.where(MarketingPersonCustomer.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(MarketingPersonCustomer.assigned_at.desc())

    # Execute query
    result = await db.execute(query)
    assignments = result.scalars().all()

    # Get related data
    mp_ids = [a.marketing_person_id for a in assignments]
    customer_ids = [a.customer_id for a in assignments]

    # Get marketing persons
    marketing_persons = {}
    if mp_ids:
        mp_query = select(EmployeeProfile).where(EmployeeProfile.user_id.in_(mp_ids))
        mp_result = await db.execute(mp_query)
        for mp in mp_result.scalars().all():
            marketing_persons[mp.user_id] = {
                "id": str(mp.user_id),
                "name": f"{mp.first_name} {mp.last_name}".strip(),
                "email": mp.email,
                "employee_code": mp.employee_code
            }

    # Get customers
    customers = {}
    if customer_ids:
        customer_query = select(Customer).where(Customer.id.in_(customer_ids))
        customer_result = await db.execute(customer_query)
        for customer in customer_result.scalars().all():
            customers[customer.id] = {
                "id": str(customer.id),
                "name": customer.name,
                "code": customer.code,
                "email": customer.email,
                "phone": customer.phone,
                "city": customer.city
            }

    # Get assigned by user info
    assigned_by_ids = [a.assigned_by for a in assignments if a.assigned_by]
    assigned_by_users = {}
    if assigned_by_ids:
        assigned_by_query = select(EmployeeProfile).where(EmployeeProfile.user_id.in_(assigned_by_ids))
        assigned_by_result = await db.execute(assigned_by_query)
        for user in assigned_by_result.scalars().all():
            assigned_by_users[user.user_id] = f"{user.first_name} {user.last_name}".strip()

    # Build response
    response = []
    for assignment in assignments:
        mp_info = marketing_persons.get(assignment.marketing_person_id, {})
        customer_info = customers.get(assignment.customer_id, {})

        response.append({
            "id": str(assignment.id),
            "marketing_person_id": assignment.marketing_person_id,
            "marketing_person": mp_info,
            "customer_id": str(assignment.customer_id),
            "customer": customer_info,
            "notes": assignment.notes,
            "is_active": assignment.is_active,
            "assigned_at": assignment.assigned_at,
            "assigned_by": assigned_by_users.get(assignment.assigned_by),
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at
        })

    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=response,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.post("/")
async def create_marketing_person_assignment(
    request: Request,
    data: CreateMarketingPersonAssignmentRequest = Body(...),
    token_data: TokenData = Depends(require_permissions(["marketing_person_assignments:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Assign customers to a marketing person

    Creates multiple assignments in one call. If an assignment already exists (active or inactive),
    it will be reactivated if inactive, otherwise skipped.
    """
    # Get auth token from request
    auth_token = extract_auth_token(request)

    # Get Marketing Person role ID from auth service
    marketing_role_id = await get_marketing_person_role_id(auth_token)

    if not marketing_role_id:
        raise HTTPException(
            status_code=500,
            detail="Marketing Person role not found in auth service"
        )

    # Extract parameters from request body
    marketing_person_id = data.marketing_person_id
    customer_ids = data.customer_ids
    notes = data.notes

    # Validate marketing person exists and is a marketing person
    mp_query = select(EmployeeProfile).where(
        EmployeeProfile.user_id == marketing_person_id,
        EmployeeProfile.tenant_id == tenant_id,
        EmployeeProfile.role_id == marketing_role_id,
        EmployeeProfile.is_active == True
    )
    mp_result = await db.execute(mp_query)
    marketing_person = mp_result.scalar_one_or_none()

    if not marketing_person:
        raise HTTPException(
            status_code=400,
            detail=f"Marketing person with ID {marketing_person_id} not found or is not active"
        )

    # Validate customers exist
    customer_query = select(Customer).where(
        Customer.id.in_(customer_ids),
        Customer.tenant_id == tenant_id
    )
    customer_result = await db.execute(customer_query)
    valid_customers = {c.id: c for c in customer_result.scalars().all()}

    if len(valid_customers) != len(customer_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more customers not found"
        )

    # Create assignments
    created_assignments = []
    skipped_assignments = []

    for customer_id in customer_ids:
        # Check if assignment already exists
        existing_query = select(MarketingPersonCustomer).where(
            MarketingPersonCustomer.marketing_person_id == marketing_person_id,
            MarketingPersonCustomer.customer_id == customer_id,
            MarketingPersonCustomer.tenant_id == tenant_id
        )
        existing_result = await db.execute(existing_query)
        existing = existing_result.scalar_one_or_none()

        if existing:
            # Reactivate if inactive
            if not existing.is_active:
                existing.is_active = True
                existing.notes = notes
                existing.assigned_by = current_user_id
                existing.updated_at = func.now()
                created_assignments.append(existing)
            else:
                skipped_assignments.append(str(customer_id))
        else:
            # Create new assignment
            assignment = MarketingPersonCustomer(
                marketing_person_id=marketing_person_id,
                customer_id=customer_id,
                tenant_id=tenant_id,
                assigned_by=current_user_id,
                notes=notes,
                is_active=True
            )
            db.add(assignment)
            created_assignments.append(assignment)

    await db.commit()

    # Refresh to get IDs
    for assignment in created_assignments:
        await db.refresh(assignment)

    return {
        "message": f"Created {len(created_assignments)} assignments, skipped {len(skipped_assignments)}",
        "created_count": len(created_assignments),
        "skipped_count": len(skipped_assignments),
        "skipped_customer_ids": skipped_assignments
    }


@router.put("/{assignment_id}")
async def update_marketing_person_assignment(
    assignment_id: UUID,
    data: UpdateMarketingPersonAssignmentRequest = Body(...),
    token_data: TokenData = Depends(require_permissions(["marketing_person_assignments:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a marketing person assignment

    Can update notes or deactivate the assignment (soft delete)
    """
    # Get assignment
    query = select(MarketingPersonCustomer).where(
        MarketingPersonCustomer.id == assignment_id,
        MarketingPersonCustomer.tenant_id == tenant_id
    )
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found"
        )

    # Update fields
    if data.notes is not None:
        assignment.notes = data.notes

    if data.is_active is not None:
        assignment.is_active = data.is_active

    await db.commit()
    await db.refresh(assignment)

    return {
        "id": str(assignment.id),
        "marketing_person_id": assignment.marketing_person_id,
        "customer_id": str(assignment.customer_id),
        "notes": assignment.notes,
        "is_active": assignment.is_active,
        "updated_at": assignment.updated_at
    }


@router.delete("/{assignment_id}")
async def delete_marketing_person_assignment(
    assignment_id: UUID,
    token_data: TokenData = Depends(require_permissions(["marketing_person_assignments:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a marketing person assignment

    Performs a hard delete of the assignment record
    """
    # Get assignment
    query = select(MarketingPersonCustomer).where(
        MarketingPersonCustomer.id == assignment_id,
        MarketingPersonCustomer.tenant_id == tenant_id
    )
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found"
        )

    # Delete assignment
    await db.execute(delete(MarketingPersonCustomer).where(MarketingPersonCustomer.id == assignment_id))
    await db.commit()

    return {"message": "Assignment deleted successfully"}


@router.get("/marketing-person/{marketing_person_id}/customers")
async def get_marketing_person_customers_by_branch(
    marketing_person_id: str,
    search: Optional[str] = Query(None),
    is_active: bool = Query(True),
    token_data: TokenData = Depends(require_any_permission(["customers:read_all", "customers:read", "orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get customers assigned to a marketing person

    Returns customers who are:
    1. Assigned to this marketing person (is_active=true in marketing_person_customers)
    2. Optionally filtered by search term
    """
    # Get customer IDs assigned to this marketing person
    mpc_query = select(MarketingPersonCustomer.customer_id).where(
        MarketingPersonCustomer.marketing_person_id == marketing_person_id,
        MarketingPersonCustomer.tenant_id == tenant_id,
        MarketingPersonCustomer.is_active == True
    )
    mpc_result = await db.execute(mpc_query)
    assigned_customer_ids = [row[0] for row in mpc_result.all()]

    if not assigned_customer_ids:
        return {"items": [], "total": 0}

    # Build customer query
    query = select(Customer).where(
        Customer.id.in_(assigned_customer_ids),
        Customer.tenant_id == tenant_id,
        Customer.is_active == is_active
    )

    # Note: branch_id filtering is not applied here since Customer doesn't have branch_id directly
    # The frontend can handle branch filtering if needed
    # For now, we return all assigned customers

    # Apply search filter
    if search:
        query = query.where(
            Customer.name.ilike(f"%{search}%") |
            Customer.code.ilike(f"%{search}%") |
            Customer.email.ilike(f"%{search}%") |
            Customer.phone.ilike(f"%{search}%")
        )

    query = query.order_by(Customer.name)

    result = await db.execute(query)
    customers = result.scalars().all()

    # Build response
    response = []
    for customer in customers:
        response.append({
            "id": str(customer.id),
            "code": customer.code,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "city": customer.city,
            "is_active": customer.is_active
        })

    return {"items": response, "total": len(response)}
