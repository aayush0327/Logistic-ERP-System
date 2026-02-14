"""
User management endpoints
"""
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import secrets
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config_local import settings
from src.database import (
    AsyncSessionLocal,
    EmployeeProfile,
    UserInvitation,
    Branch,
    EmployeeBranch,
    DriverProfile,
    FinanceManagerProfile,
    BranchManagerProfile,
    LogisticsManagerProfile,
    EmployeeDocument
)
from src.helpers import validate_branch_exists, validate_role_exists, validate_employee_reporting_hierarchy, validate_employee_exists
from src.schemas import (
    EmployeeProfile as EmployeeProfileSchema,
    EmployeeProfileCreate,
    EmployeeProfileUpdate,
    UserInvitation as UserInvitationSchema,
    UserInvitationCreate,
    UserInvitationUpdate,
    PaginatedResponse,
    UserManagementResponse,
    UserPasswordChange
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
    # User management permissions
    USER_READ_ALL,
    USER_READ,
    USER_READ_OWN,
    USER_CREATE,
    USER_UPDATE,
    USER_UPDATE_OWN,
    USER_DELETE,
    USER_MANAGE_ALL,
    USER_INVITE,
    USER_ACTIVATE,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# Dependency to get database session
async def get_db() -> AsyncSession:
    """Get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def extract_auth_token(request: Request) -> Optional[str]:
    """Extract JWT token from request Authorization header."""
    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None

    # Handle both "Bearer token" and "token" formats
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()  # Remove "Bearer " prefix
    return auth_header.strip()


async def get_role_from_auth_service(role_id: Optional[str], auth_token: Optional[str] = None) -> dict:
    """
    Fetch role data from auth service by ID.
    Always returns a role dict, even if fetch fails (returns minimal role object).

    Args:
        role_id: The role ID (as string) to fetch
        auth_token: Optional JWT token to authenticate with auth service

    Returns:
        Role data dict (never None - returns minimal object if fetch fails)
    """
    # Return minimal role object if no role_id
    if not role_id:
        return {
            'id': 0,
            'role_name': 'Unknown',
            'name': 'Unknown',
            'display_name': 'Unknown Role',
            'description': None,
            'is_active': True,
            'is_system_role': False,
            'created_at': None,
            'updated_at': None,
            'employees': [],
            'invitations': []
        }

    try:
        # Convert to int for auth service API
        role_id_int = int(role_id) if role_id.isdigit() else role_id

        # Prepare headers with auth token if provided
        headers = {"Accept": "application/json"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        async with httpx.AsyncClient(timeout=10.0) as client:  # Increased timeout
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/roles/",
                headers=headers
            )
            if response.status_code == 200:
                roles = response.json()
                role = next((r for r in roles if r["id"] == role_id_int), None)
                if role:
                    return {
                        'id': role['id'],  # Return as int to match frontend Role interface
                        'role_name': role['name'],
                        'name': role['name'],  # Add 'name' field for frontend compatibility
                        'display_name': role.get('description') or role['name'],
                        'description': role.get('description'),
                        'is_active': role.get('is_active', True),
                        'is_system_role': role.get('is_system', False),
                        'created_at': role.get('created_at'),
                        'updated_at': role.get('updated_at'),
                        'employees': [],  # Empty to avoid recursion
                        'invitations': []  # Empty to avoid recursion
                    }
                else:
                    logger.warning(f"Role ID {role_id} (as int: {role_id_int}) not found in auth service")
            else:
                logger.warning(f"Auth service returned status {response.status_code} when fetching roles")
    except Exception as e:
        logger.error(f"Failed to fetch role {role_id} from auth service: {e}", exc_info=True)

    # Return minimal role object on failure (instead of None)
    return {
        'id': int(role_id) if role_id and role_id.isdigit() else 0,
        'role_name': f'Role {role_id}',
        'name': f'Role {role_id}',
        'display_name': f'Role {role_id}',
        'description': None,
        'is_active': True,
        'is_system_role': False,
        'created_at': None,
        'updated_at': None,
        'employees': [],
        'invitations': []
    }


@router.get("/", response_model=PaginatedResponse)
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role_id: Optional[str] = Query(None),
    branch_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    user_id: Optional[str] = Query(None),  # Filter by auth user_id
    token_data: TokenData = Depends(require_any_permission([USER_READ_ALL[0], USER_READ[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all users for the current tenant

    Requires:
    - users:read_all or users:read
    """

    # Build query
    query = select(EmployeeProfile).where(EmployeeProfile.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            or_(
                EmployeeProfile.first_name.ilike(f"%{search}%"),
                EmployeeProfile.last_name.ilike(f"%{search}%"),
                EmployeeProfile.email.ilike(f"%{search}%"),
                EmployeeProfile.employee_code.ilike(f"%{search}%")
            )
        )

    if role_id:
        query = query.where(EmployeeProfile.role_id == role_id)

    if branch_id:
        query = query.where(EmployeeProfile.branch_id == branch_id)

    if is_active is not None:
        query = query.where(EmployeeProfile.is_active == is_active)

    if user_id:
        # Filter by auth user_id (the UUID from auth service)
        query = query.where(EmployeeProfile.user_id == user_id)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(EmployeeProfile.created_at.desc())

    # Execute query without relationships to avoid recursion
    result = await db.execute(query)
    users = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    # Process each user to get relationship data
    processed_users = []
    auth_token = extract_auth_token(request)

    # Fetch all employee-branch relationships at once for better performance
    all_user_ids = [u.id for u in users]
    if all_user_ids:
        eb_query = select(EmployeeBranch).where(
            EmployeeBranch.employee_profile_id.in_(all_user_ids)
        )
        eb_result = await db.execute(eb_query)
        all_employee_branches = eb_result.scalars().all()

        # Group by employee_profile_id
        from collections import defaultdict
        branches_by_user = defaultdict(list)
        for eb in all_employee_branches:
            branches_by_user[eb.employee_profile_id].append(eb.branch_id)

        # Fetch all branch data at once
        all_branch_ids = list(set([eb.branch_id for eb in all_employee_branches]))
        branches_by_id = {}
        if all_branch_ids:
            branches_query = select(Branch).where(Branch.id.in_(all_branch_ids))
            branches_result = await db.execute(branches_query)
            for branch in branches_result.scalars().all():
                branches_by_id[branch.id] = {
                    'id': branch.id,
                    'tenant_id': branch.tenant_id,
                    'code': branch.code,
                    'name': branch.name,
                    'address': branch.address,
                    'city': branch.city,
                    'state': branch.state,
                    'postal_code': branch.postal_code,
                    'phone': branch.phone,
                    'email': branch.email,
                    'manager_id': branch.manager_id,
                    'is_active': branch.is_active if branch.is_active is not None else True,
                    'created_at': branch.created_at,
                    'updated_at': branch.updated_at
                }
    else:
        branches_by_user = defaultdict(list)
        branches_by_id = {}

    for user in users:
        # Get role data from auth service (always returns a dict now)
        role_data = await get_role_from_auth_service(user.role_id, auth_token)

        # Get branches for this user from junction table
        user_branch_ids = branches_by_user.get(user.id, [])
        branches_data = [branches_by_id[bid] for bid in user_branch_ids if bid in branches_by_id]

        # Use first branch for backward compatibility (single branch field)
        branch_data = branches_data[0] if branches_data else None

        # Convert user to dict and add relationships
        user_dict = {
            'id': user.id,
            'tenant_id': user.tenant_id,
            'user_id': user.user_id,
            'employee_code': user.employee_code,
            'role_id': user.role_id,
            'role_name': role_data.get('role_name') or role_data.get('name'),  # Add role_name at top level
            'branch_id': user.branch_id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.phone,
            'email': user.email,
            'date_of_birth': user.date_of_birth,
            'gender': user.gender,
            'blood_group': user.blood_group,
            'emergency_contact_name': user.emergency_contact_name,
            'emergency_contact_phone': user.emergency_contact_phone,
            'address': user.address,
            'city': user.city,
            'state': user.state,
            'postal_code': user.postal_code,
            'country': user.country,
            'hire_date': user.hire_date,
            'employment_type': user.employment_type,
            'department': user.department,
            'designation': user.designation,
            'reports_to': user.reports_to,
            'salary': user.salary,
            'bank_account_number': user.bank_account_number,
            'bank_name': user.bank_name,
            'bank_ifsc': user.bank_ifsc,
            'pan_number': user.pan_number,
            'aadhaar_number': user.aadhar_number,
            'is_active': user.is_active,
            'created_at': user.created_at,
            'updated_at': user.updated_at,
            'role': role_data,
            'branch': branch_data,
            'branches': branches_data,  # All assigned branches
            'documents': []  # Empty for now
        }

        processed_users.append(EmployeeProfileSchema.model_validate(user_dict))

    return PaginatedResponse(
        items=processed_users,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{user_id}", response_model=EmployeeProfileSchema)
async def get_user(
    request: Request,
    user_id: str,
    token_data: TokenData = Depends(require_any_permission([USER_READ_ALL[0], USER_READ[0], USER_READ_OWN[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific user by ID

    Requires:
    - users:read_all or users:read or users:read_own (for own profile)
    """

    # Debug logging
    logger.info(f"Looking for user_id: {user_id} with tenant_id: {tenant_id}")

    # Get user without loading problematic relationships
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )

    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"User not found for user_id: {user_id}")

        # Check if any user exists with this ID (regardless of tenant)
        all_tenant_query = select(EmployeeProfile).where(EmployeeProfile.id == user_id)
        all_tenant_result = await db.execute(all_tenant_query)
        all_tenant_user = all_tenant_result.scalar_one_or_none()

        if all_tenant_user:
            logger.error(f"User found but with different tenant_id. Expected: {tenant_id}, Actual: {all_tenant_user.tenant_id}")
        else:
            logger.error(f"No user found with ID {user_id} in any tenant")

        raise HTTPException(status_code=404, detail="User not found")

    # Get role data from auth service (always returns a dict now)
    auth_token = extract_auth_token(request)
    role_data = await get_role_from_auth_service(user.role_id, auth_token)

    # Get all assigned branches from employee_branches junction table
    branches_query = select(EmployeeBranch).where(
        EmployeeBranch.employee_profile_id == user_id
    )
    branches_result = await db.execute(branches_query)
    employee_branches = branches_result.scalars().all()

    branches_data = []
    branch_data = None

    if employee_branches:
        branch_ids = [eb.branch_id for eb in employee_branches]
        branches_query = select(Branch).where(Branch.id.in_(branch_ids))
        branches_result = await db.execute(branches_query)
        branches_objs = branches_result.scalars().all()

        for branch_obj in branches_objs:
            branch_dict = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }
            branches_data.append(branch_dict)

        # Use first branch for backward compatibility
        branch_data = branches_data[0] if branches_data else None
    elif user.branch_id:
        # Fallback to single branch from employee_profile
        branch_query = select(Branch).where(Branch.id == user.branch_id)
        branch_result = await db.execute(branch_query)
        branch_obj = branch_result.scalar_one_or_none()

        if branch_obj:
            branch_data = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }
            branches_data.append(branch_data)

    # Build branch_ids array for response
    branch_ids = [b['id'] for b in branches_data] if branches_data else []

    # Convert user to dict and add relationships
    # Map backend fields to frontend expected format
    user_dict = {
        'id': user.id,
        'tenant_id': user.tenant_id,
        'user_id': user.user_id,
        # Backend field name
        'employee_code': user.employee_code,
        # Frontend expected field name (mapped)
        'employee_id': user.employee_code,
        'role_id': user.role_id,
        'role_name': role_data.get('role_name') or role_data.get('name'),  # Add role_name at top level
        'branch_id': str(user.branch_id) if user.branch_id else None,
        'branch_ids': branch_ids,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone': user.phone,
        'phone_number': user.phone,
        'email': user.email,
        'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None,
        'gender': user.gender,
        'blood_group': user.blood_group,
        'marital_status': user.marital_status,
        'nationality': user.nationality,
        'emergency_contact_name': user.emergency_contact_name,
        'emergency_contact_phone': user.emergency_contact_phone,
        # Frontend expected field name (mapped)
        'emergency_contact_number': user.emergency_contact_phone,
        # Address fields - individual
        'address': user.address,
        'city': user.city,
        'state': user.state,
        'postal_code': user.postal_code,
        'country': user.country,
        # Frontend expected nested address object
        'current_address': {
            'address_line1': user.address or '',
            'address_line2': '',
            'city': user.city or '',
            'state': user.state or '',
            'postal_code': user.postal_code or '',
            'country': user.country or 'India'
        } if user.address or user.city else None,
        'permanent_address': {
            'address_line1': user.address or '',
            'address_line2': '',
            'city': user.city or '',
            'state': user.state or '',
            'postal_code': user.postal_code or '',
            'country': user.country or 'India'
        } if user.address or user.city else None,
        'hire_date': user.hire_date,
        # Frontend expected field name (mapped)
        'date_of_joining': user.hire_date.isoformat() if user.hire_date else None,
        'employment_type': user.employment_type,
        'department': user.department,
        'designation': user.designation,
        'reports_to': user.reports_to,
        'salary': user.salary,
        # Bank details - individual
        'bank_account_number': user.bank_account_number,
        'bank_name': user.bank_name,
        'bank_ifsc': user.bank_ifsc,
        # Frontend expected nested bank_details object
        'bank_details': {
            'bank_name': user.bank_name or '',
            'account_number': user.bank_account_number or '',
            'ifsc_code': user.bank_ifsc or '',
            'branch_name': '',
            'account_type': 'savings'
        } if user.bank_name or user.bank_account_number else None,
        'pan_number': user.pan_number,
        'passport_number': user.passport_number,
        'aadhaar_number': user.aadhar_number,
        'aadhar_number': user.aadhar_number,
        'is_active': user.is_active,
        'is_superuser': user.is_superuser if hasattr(user, 'is_superuser') else False,
        'last_login': None,
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'updated_at': user.updated_at.isoformat() if user.updated_at else None,
        'role': role_data,
        'branch': branch_data,
        'branches': branches_data,
        'documents': [],  # Empty for now
        'profile': None  # Will be populated if profile exists
    }

    return EmployeeProfileSchema.model_validate(user_dict)


@router.post("/", response_model=EmployeeProfileSchema, status_code=201)
async def create_user(
    request: Request,
    user_data: EmployeeProfileCreate,
    token_data: TokenData = Depends(require_permissions([USER_CREATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user with optional multiple branch assignments
    Note: role_id is now optional and managed by the auth service

    Requires:
    - users:create
    """

    # Validate that at least one branch is provided
    branch_ids = user_data.branch_ids if user_data.branch_ids else []

    if not user_data.branch_id and not branch_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one branch must be assigned to the user"
        )

    # Auto-set branch_id from branch_ids[0] if not provided
    final_branch_id = user_data.branch_id
    if not final_branch_id and branch_ids:
        final_branch_id = branch_ids[0]

    # Verify branch exists
    try:
        await validate_branch_exists(db, final_branch_id, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if employee code already exists
    if user_data.employee_code:
        existing_query = select(EmployeeProfile).where(
            EmployeeProfile.employee_code == user_data.employee_code,
            EmployeeProfile.tenant_id == tenant_id
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Employee with this code already exists"
            )

    # Check if user_id already exists
    existing_user_query = select(EmployeeProfile).where(
        EmployeeProfile.user_id == user_data.user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    existing_user_result = await db.execute(existing_user_query)
    if existing_user_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="User profile already exists for this user ID"
        )

    # Note: role_id is now auth service role ID (stored as string)
    # No validation against company_roles table since we use auth service roles

    # Extract branch_ids for later processing (exclude from EmployeeProfile creation)
    # Already validated at the start of the function
    if not branch_ids:
        branch_ids = user_data.branch_ids if user_data.branch_ids else []

    # Add final_branch_id to branch_ids if not already there
    if final_branch_id and final_branch_id not in branch_ids:
        branch_ids.append(final_branch_id)

    # Verify all branches in branch_ids exist
    for branch_id in branch_ids:
        try:
            await validate_branch_exists(db, branch_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid branch ID {branch_id}: {str(e)}"
            )

    # Validate reporting hierarchy if reports_to is provided
    if user_data.reports_to:
        try:
            await validate_employee_exists(db, user_data.reports_to, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid manager ID: {str(e)}"
            )

    # Get user data as dict and exclude branch_ids (not a column in EmployeeProfile)
    user_data_dict = user_data.model_dump(exclude={'branch_ids'})

    # Ensure branch_id is set (use final_branch_id which may have been auto-populated)
    user_data_dict['branch_id'] = final_branch_id

    # Create new user
    user = EmployeeProfile(
        tenant_id=tenant_id,
        **user_data_dict
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create employee-branch assignments if branch_ids provided
    if branch_ids:
        for branch_id in branch_ids:
            employee_branch = EmployeeBranch(
                tenant_id=tenant_id,
                employee_profile_id=user.id,
                branch_id=branch_id,
                assigned_by=current_user_id
            )
            db.add(employee_branch)

        await db.commit()

    # Get the user with minimal relationship loading to avoid recursion
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user.id
    )

    result = await db.execute(query)
    user = result.scalar_one()

    # Get role data from auth service
    auth_token = extract_auth_token(request)
    role_data = await get_role_from_auth_service(user.role_id, auth_token)

    # Get all assigned branches
    branches_data = []
    if branch_ids:
        branches_query = select(Branch).where(Branch.id.in_(branch_ids))
        branches_result = await db.execute(branches_query)
        branches_objs = branches_result.scalars().all()

        for branch_obj in branches_objs:
            branches_data.append({
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            })

    # Get single branch data (for backward compatibility, use first branch)
    branch_data = branches_data[0] if branches_data else None

    # Convert user to dict and add relationships
    user_dict = {
        'id': user.id,
        'tenant_id': user.tenant_id,
        'user_id': user.user_id,
        'employee_code': user.employee_code,
        'role_id': user.role_id,
        'role_name': role_data.get('role_name') or role_data.get('name'),  # Add role_name at top level
        'branch_id': user.branch_id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone': user.phone,
        'email': user.email,
        'date_of_birth': user.date_of_birth,
        'gender': user.gender,
        'blood_group': user.blood_group,
        'emergency_contact_name': user.emergency_contact_name,
        'emergency_contact_phone': user.emergency_contact_phone,
        'address': user.address,
        'city': user.city,
        'state': user.state,
        'postal_code': user.postal_code,
        'country': user.country,
        'hire_date': user.hire_date,
        'employment_type': user.employment_type,
        'department': user.department,
        'designation': user.designation,
        'reports_to': user.reports_to,
        'salary': user.salary,
        'bank_account_number': user.bank_account_number,
        'bank_name': user.bank_name,
        'bank_ifsc': user.bank_ifsc,
        'pan_number': user.pan_number,
        'aadhaar_number': user.aadhar_number,
        'is_active': user.is_active,
        'created_at': user.created_at,
        'updated_at': user.updated_at,
        'role': role_data,
        'branch': branch_data,
        'branches': branches_data,  # New: All assigned branches
        'documents': []
    }

    return EmployeeProfileSchema.model_validate(user_dict)


@router.put("/{user_id}", response_model=EmployeeProfileSchema)
async def update_user(
    request: Request,
    user_id: str,
    user_data: EmployeeProfileUpdate,
    token_data: TokenData = Depends(require_any_permission([USER_UPDATE[0], USER_UPDATE_OWN[0], USER_MANAGE_ALL[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user

    Requires:
    - users:update or users:update_own or users:manage_all
    """

    # Get existing user
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user
    update_data = user_data.model_dump(exclude_unset=True)

    # Handle branch_ids - update junction table
    branch_ids_to_update = None
    if "branch_ids" in update_data:
        branch_ids_to_update = update_data["branch_ids"]

        # Validate branch_ids
        if branch_ids_to_update:
            for branch_id in branch_ids_to_update:
                try:
                    await validate_branch_exists(db, branch_id, tenant_id)
                except ValueError as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid branch ID {branch_id}: {str(e)}"
                    )

        # Auto-populate branch_id from branch_ids[0]
        if branch_ids_to_update and len(branch_ids_to_update) > 0:
            update_data["branch_id"] = branch_ids_to_update[0]

        # Exclude branch_ids from update_data (not a column in EmployeeProfile)
        del update_data["branch_ids"]

    # Verify role if updating
    if "role_id" in update_data:
        try:
            await validate_role_exists(db, update_data["role_id"], tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Verify branch if updating
    if "branch_id" in update_data and update_data["branch_id"]:
        try:
            await validate_branch_exists(db, update_data["branch_id"], tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Validate reporting hierarchy if updating reports_to
    if "reports_to" in update_data and update_data["reports_to"]:
        try:
            await validate_employee_reporting_hierarchy(
                db, user_id, update_data["reports_to"], tenant_id
            )
            # Also verify the manager exists
            await validate_employee_exists(db, update_data["reports_to"], tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Check employee code uniqueness if updating
    if "employee_code" in update_data and update_data["employee_code"]:
        existing_query = select(EmployeeProfile).where(
            EmployeeProfile.employee_code == update_data["employee_code"],
            EmployeeProfile.tenant_id == tenant_id,
            EmployeeProfile.id != user_id
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Employee with this code already exists"
            )

    # Update EmployeeProfile fields
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    # Update employee_branches junction table if branch_ids was provided
    if branch_ids_to_update is not None:
        # Delete existing employee-branch assignments
        await db.execute(
            delete(EmployeeBranch).where(EmployeeBranch.employee_profile_id == user_id)
        )

        # Create new employee-branch assignments
        if branch_ids_to_update:
            for branch_id in branch_ids_to_update:
                employee_branch = EmployeeBranch(
                    tenant_id=tenant_id,
                    employee_profile_id=user.id,
                    branch_id=branch_id,
                    assigned_by=current_user_id
                )
                db.add(employee_branch)

        await db.commit()

    # Get role data from auth service
    auth_token = extract_auth_token(request)
    role_data = await get_role_from_auth_service(user.role_id, auth_token)

    # Get all assigned branches from employee_branches table
    branches_query = select(EmployeeBranch).where(
        EmployeeBranch.employee_profile_id == user.id
    )
    branches_result = await db.execute(branches_query)
    employee_branches = branches_result.scalars().all()

    branches_data = []
    branch_data = None

    if employee_branches:
        branch_ids = [eb.branch_id for eb in employee_branches]
        branches_query = select(Branch).where(Branch.id.in_(branch_ids))
        branches_result = await db.execute(branches_query)
        branches_objs = branches_result.scalars().all()

        for branch_obj in branches_objs:
            branch_dict = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }
            branches_data.append(branch_dict)

        # Use first branch for backward compatibility
        branch_data = branches_data[0] if branches_data else None
    elif user.branch_id:
        # Fallback to single branch from employee_profile
        branch_query = select(Branch).where(Branch.id == user.branch_id)
        branch_result = await db.execute(branch_query)
        branch_obj = branch_result.scalar_one_or_none()

        if branch_obj:
            branch_data = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }
            branches_data.append(branch_data)

    # Build branch_ids array for response
    branch_ids = [b['id'] for b in branches_data] if branches_data else []

    # Convert user to dict and add relationships
    user_dict = {
        'id': user.id,
        'tenant_id': user.tenant_id,
        'user_id': user.user_id,
        'employee_code': user.employee_code,
        'role_id': user.role_id,
        'role_name': role_data.get('role_name') or role_data.get('name'),  # Add role_name at top level
        'branch_id': user.branch_id,
        'branch_ids': branch_ids,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone': user.phone,
        'email': user.email,
        'date_of_birth': user.date_of_birth,
        'gender': user.gender,
        'blood_group': user.blood_group,
        'emergency_contact_name': user.emergency_contact_name,
        'emergency_contact_phone': user.emergency_contact_phone,
        'address': user.address,
        'city': user.city,
        'state': user.state,
        'postal_code': user.postal_code,
        'country': user.country,
        'hire_date': user.hire_date,
        'employment_type': user.employment_type,
        'department': user.department,
        'designation': user.designation,
        'reports_to': user.reports_to,
        'salary': user.salary,
        'bank_account_number': user.bank_account_number,
        'bank_name': user.bank_name,
        'bank_ifsc': user.bank_ifsc,
        'pan_number': user.pan_number,
        'aadhaar_number': user.aadhar_number,
        'is_active': user.is_active,
        'created_at': user.created_at,
        'updated_at': user.updated_at,
        'role': role_data,
        'branch': branch_data,
        'branches': branches_data,
        'documents': []  # Empty for now
    }

    return EmployeeProfileSchema.model_validate(user_dict)


@router.post("/invite", response_model=UserInvitationSchema, status_code=201)
async def invite_user(
    request: Request,
    invitation_data: UserInvitationCreate,
    token_data: TokenData = Depends(require_permissions([USER_INVITE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Send user invitation

    Requires:
    - users:invite
    """

    # Check if there's already a pending invitation for this email
    existing_query = select(UserInvitation).where(
        UserInvitation.email == invitation_data.email,
        UserInvitation.tenant_id == tenant_id,
        UserInvitation.status == "pending"
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Pending invitation already exists for this email"
        )

    # Verify role exists
    try:
        await validate_role_exists(db, invitation_data.role_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Verify branch exists if provided
    if invitation_data.branch_id:
        try:
            await validate_branch_exists(db, invitation_data.branch_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Create invitation
    invitation = UserInvitation(
        tenant_id=tenant_id,
        invitation_token=secrets.token_urlsafe(32),
        invited_by=current_user_id,
        **invitation_data.model_dump(exclude={"invitation_token", "invited_at"})
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # TODO: Send invitation email
    logger.info(f"User invitation sent to {invitation_data.email} with token {invitation.invitation_token}")

    # Get role data from auth service
    auth_token = extract_auth_token(request)
    role_data = await get_role_from_auth_service(invitation.role_id, auth_token)

    # Get branch data separately
    branch_data = None
    if invitation.branch_id:
        branch_query = select(Branch).where(Branch.id == invitation.branch_id)
        branch_result = await db.execute(branch_query)
        branch_obj = branch_result.scalar_one_or_none()

        if branch_obj:
            branch_data = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }

    # Convert invitation to dict and add relationships
    invitation_dict = {
        'id': invitation.id,
        'tenant_id': invitation.tenant_id,
        'email': invitation.email,
        'invitation_token': invitation.invitation_token,
        'role_id': invitation.role_id,
        'branch_id': invitation.branch_id,
        'invited_by': invitation.invited_by,
        'invited_at': invitation.invited_at,
        'expires_at': invitation.expires_at,
        'accepted_at': invitation.accepted_at,
        'accepted_by': invitation.accepted_by,
        'status': invitation.status,
        'is_active': invitation.is_active,
        'created_at': invitation.created_at,
        'updated_at': invitation.updated_at,
        'role': role_data,
        'branch': branch_data
    }

    return UserInvitationSchema.model_validate(invitation_dict)


@router.put("/{user_id}/status", response_model=UserManagementResponse)
async def update_user_status(
    request: Request,
    user_id: str,
    status_data: dict,
    token_data: TokenData = Depends(require_permissions([USER_ACTIVATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user status (activate/deactivate)
    This updates both the company database AND the auth service

    Requires:
    - users:activate
    """

    is_active = status_data.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active field is required")

    # Get user from company database
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update in company database
    user.is_active = is_active
    await db.commit()

    # Also update in auth service (this is where authentication is managed)
    auth_token = extract_auth_token(request)
    if auth_token and user.user_id:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Call activate or deactivate endpoint based on status
                endpoint = "activate" if is_active else "deactivate"
                auth_response = await client.put(
                    f"{settings.AUTH_SERVICE_URL}/api/v1/users/{user.user_id}/{endpoint}",
                    headers={
                        "Authorization": f"Bearer {auth_token}",
                        "Content-Type": "application/json"
                    }
                )
                if auth_response.status_code == 200:
                    logger.info(f"Successfully {'activated' if is_active else 'deactivated'} user {user.user_id} in auth service")
                else:
                    logger.warning(f"Failed to update user status in auth service: {auth_response.status_code} - {auth_response.text}")
        except Exception as e:
            logger.error(f"Error updating user status in auth service: {e}")

    return UserManagementResponse(
        user_id=user.user_id,
        employee_id=user_id,
        status="activated" if is_active else "deactivated",
        message=f"User {'activated' if is_active else 'deactivated'} successfully"
    )


@router.post("/{user_id}/activate", response_model=UserManagementResponse)
async def activate_user(
    user_id: str,
    token_data: TokenData = Depends(require_permissions([USER_ACTIVATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Activate a user

    Requires:
    - users:activate
    """

    # Get user
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Activate user
    user.is_active = True
    await db.commit()

    return UserManagementResponse(
        user_id=user.user_id,
        employee_id=user_id,
        status="activated",
        message="User activated successfully"
    )


@router.post("/{user_id}/deactivate", response_model=UserManagementResponse)
async def deactivate_user(
    user_id: str,
    token_data: TokenData = Depends(require_permissions([USER_ACTIVATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a user

    Requires:
    - users:activate
    """

    # Get user
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Deactivate user
    user.is_active = False
    await db.commit()

    return UserManagementResponse(
        user_id=user.user_id,
        employee_id=user_id,
        status="deactivated",
        message="User deactivated successfully"
    )


@router.put("/{user_id}/password")
async def change_user_password(
    user_id: str,
    password_data: UserPasswordChange,
    request: Request,
    token_data: TokenData = Depends(require_permissions([USER_UPDATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Change user password by forwarding to auth service

    This endpoint allows admins to change any user's password.
    For users changing their own password, they should use the auth service directly.

    Requires:
    - users:update permission
    """
    # Get employee profile to find the auth user_id
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="User not found")

    # Get auth token from request header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    # Forward to auth service
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{settings.AUTH_SERVICE_URL}/api/v1/users/{employee.user_id}/password",
                headers={"Authorization": auth_header},
                json={
                    "current_password": password_data.current_password or "",
                    "new_password": password_data.new_password
                }
            )

            if response.status_code == 200:
                return {"message": "Password updated successfully"}
            else:
                detail = response.json().get("detail", "Failed to update password")
                raise HTTPException(status_code=response.status_code, detail=detail)

    except httpx.RequestError as e:
        logger.error(f"Error calling auth service for password change: {e}")
        raise HTTPException(status_code=503, detail="Failed to connect to auth service")


@router.delete("/{user_id}", response_model=UserManagementResponse)
async def delete_user(
    request: Request,
    user_id: str,
    token_data: TokenData = Depends(require_permissions([USER_DELETE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a user's employee profile from company database
    All dependent records are deleted first to avoid foreign key constraint violations

    Note: This endpoint is called by the auth service when a user is deleted from auth.
    The auth service is the source of truth for user deletion.

    Requires:
    - users:delete
    """

    # Get user from company database (user_id here is employee_profile.id)
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == user_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # If employee profile not found by ID, try to find by user_id (auth user UUID)
        # This handles the case when auth service passes the auth user UUID
        query_by_uuid = select(EmployeeProfile).where(
            EmployeeProfile.user_id == user_id,
            EmployeeProfile.tenant_id == tenant_id
        )
        result_by_uuid = await db.execute(query_by_uuid)
        user = result_by_uuid.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    user_uuid = user.user_id
    employee_profile_id = user.id

    # Delete dependent records first to avoid foreign key constraint violations
    # 1. Delete driver profile if exists
    await db.execute(
        delete(DriverProfile).where(DriverProfile.employee_profile_id == employee_profile_id)
    )

    # 2. Delete finance manager profile if exists
    await db.execute(
        delete(FinanceManagerProfile).where(FinanceManagerProfile.employee_profile_id == employee_profile_id)
    )

    # 3. Delete branch manager profile if exists
    await db.execute(
        delete(BranchManagerProfile).where(BranchManagerProfile.employee_profile_id == employee_profile_id)
    )

    # 4. Delete logistics manager profile if exists
    await db.execute(
        delete(LogisticsManagerProfile).where(LogisticsManagerProfile.employee_profile_id == employee_profile_id)
    )

    # 5. Delete employee documents
    await db.execute(
        delete(EmployeeDocument).where(EmployeeDocument.employee_profile_id == employee_profile_id)
    )

    # 6. Delete employee-branch assignments
    await db.execute(
        delete(EmployeeBranch).where(EmployeeBranch.employee_profile_id == employee_profile_id)
    )

    # 7. Finally delete the employee profile
    await db.delete(user)
    await db.commit()

    return UserManagementResponse(
        user_id=user_uuid,
        employee_id=employee_profile_id,
        status="deleted",
        message="Employee profile deleted successfully"
    )


@router.get("/invitations/", response_model=PaginatedResponse)
async def list_invitations(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    token_data: TokenData = Depends(require_permissions([USER_READ_ALL[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all user invitations for the current tenant

    Requires:
    - users:read_all
    """

    # Build query
    query = select(UserInvitation).where(UserInvitation.tenant_id == tenant_id)

    # Apply filters
    if status:
        query = query.where(UserInvitation.status == status)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(UserInvitation.invited_at.desc())

    # Execute query without relationships to avoid recursion
    result = await db.execute(query)
    invitations = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    # Process each invitation to get relationship data
    processed_invitations = []
    auth_token = extract_auth_token(request)
    for invitation in invitations:
        # Get role data from auth service
        role_data = await get_role_from_auth_service(invitation.role_id, auth_token)

        # Get branch data separately
        branch_data = None
        if invitation.branch_id:
            branch_query = select(Branch).where(Branch.id == invitation.branch_id)
            branch_result = await db.execute(branch_query)
            branch_obj = branch_result.scalar_one_or_none()

            if branch_obj:
                branch_data = {
                    'id': branch_obj.id,
                    'tenant_id': branch_obj.tenant_id,
                    'code': branch_obj.code,
                    'name': branch_obj.name,
                    'address': branch_obj.address,
                    'city': branch_obj.city,
                    'state': branch_obj.state,
                    'postal_code': branch_obj.postal_code,
                    'phone': branch_obj.phone,
                    'email': branch_obj.email,
                    'manager_id': branch_obj.manager_id,
                    'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                    'created_at': branch_obj.created_at,
                    'updated_at': branch_obj.updated_at
                }

        # Convert invitation to dict and add relationships
        invitation_dict = {
            'id': invitation.id,
            'tenant_id': invitation.tenant_id,
            'email': invitation.email,
            'invitation_token': invitation.invitation_token,
            'role_id': invitation.role_id,
            'branch_id': invitation.branch_id,
            'invited_by': invitation.invited_by,
            'invited_at': invitation.invited_at,
            'expires_at': invitation.expires_at,
            'accepted_at': invitation.accepted_at,
            'accepted_by': invitation.accepted_by,
            'status': invitation.status,
            'is_active': invitation.is_active,
            'created_at': invitation.created_at,
            'updated_at': invitation.updated_at,
            'role': role_data,
            'branch': branch_data
        }

        processed_invitations.append(UserInvitationSchema.model_validate(invitation_dict))

    return PaginatedResponse(
        items=processed_invitations,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.put("/invitations/{invitation_id}", response_model=UserInvitationSchema)
async def update_invitation(
    invitation_id: str,
    invitation_data: UserInvitationUpdate,
    token_data: TokenData = Depends(require_permissions([USER_UPDATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user invitation

    Requires:
    - users:update
    """

    # Get existing invitation
    query = select(UserInvitation).where(
        UserInvitation.id == invitation_id,
        UserInvitation.tenant_id == tenant_id
    )
    result = await db.execute(query)
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Update invitation
    update_data = invitation_data.model_dump(exclude_unset=True)

    # Verify role if updating
    if "role_id" in update_data:
        try:
            await validate_role_exists(db, update_data["role_id"], tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Verify branch if updating
    if "branch_id" in update_data and update_data["branch_id"]:
        try:
            await validate_branch_exists(db, update_data["branch_id"], tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    for field, value in update_data.items():
        setattr(invitation, field, value)

    await db.commit()
    await db.refresh(invitation)

    # Get role data from auth service
    auth_token = extract_auth_token(request)
    role_data = await get_role_from_auth_service(invitation.role_id, auth_token)

    # Get branch data separately
    branch_data = None
    if invitation.branch_id:
        branch_query = select(Branch).where(Branch.id == invitation.branch_id)
        branch_result = await db.execute(branch_query)
        branch_obj = branch_result.scalar_one_or_none()

        if branch_obj:
            branch_data = {
                'id': branch_obj.id,
                'tenant_id': branch_obj.tenant_id,
                'code': branch_obj.code,
                'name': branch_obj.name,
                'address': branch_obj.address,
                'city': branch_obj.city,
                'state': branch_obj.state,
                'postal_code': branch_obj.postal_code,
                'phone': branch_obj.phone,
                'email': branch_obj.email,
                'manager_id': branch_obj.manager_id,
                'is_active': branch_obj.is_active if branch_obj.is_active is not None else True,
                'created_at': branch_obj.created_at,
                'updated_at': branch_obj.updated_at
            }

    # Convert invitation to dict and add relationships
    invitation_dict = {
        'id': invitation.id,
        'tenant_id': invitation.tenant_id,
        'email': invitation.email,
        'invitation_token': invitation.invitation_token,
        'role_id': invitation.role_id,
        'branch_id': invitation.branch_id,
        'invited_by': invitation.invited_by,
        'invited_at': invitation.invited_at,
        'expires_at': invitation.expires_at,
        'accepted_at': invitation.accepted_at,
        'accepted_by': invitation.accepted_by,
        'status': invitation.status,
        'is_active': invitation.is_active,
        'created_at': invitation.created_at,
        'updated_at': invitation.updated_at,
        'role': role_data,
        'branch': branch_data
    }

    return UserInvitationSchema.model_validate(invitation_dict)

@router.post("/bulk-update", response_model=List[EmployeeProfileSchema])
async def bulk_update_users(
    request: Request,
    updates: List[dict],
    token_data: TokenData = Depends(require_permissions([USER_UPDATE[0]])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk update multiple users

    Requires:
    - users:update

    Body:
    - updates: List of dicts with 'id' and fields to update
    """
    from src.database import Branch

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    results = []

    for update_data in updates:
        user_id = update_data.get('id')
        if not user_id:
            continue

        # Get existing user
        query = select(EmployeeProfile).where(
            EmployeeProfile.id == user_id,
            EmployeeProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            continue

        # Update user fields (exclude 'id' from update_data)
        update_fields = {k: v for k, v in update_data.items() if k != 'id'}
        for field, value in update_fields.items():
            if hasattr(user, field):
                setattr(user, field, value)

        results.append(user)

    # Commit all changes
    await db.commit()

    # Get auth token for role fetching
    auth_token = extract_auth_token(request)

    # Refresh all users and build response
    response_users = []
    for user in results:
        await db.refresh(user)

        # Convert to dict manually to avoid relationship issues
        user_dict = {
            'id': user.id,
            'tenant_id': user.tenant_id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_number': user.phone_number,
            'employee_code': user.employee_code,
            'profile_type': user.profile_type,
            'role_id': user.role_id,
            'branch_id': user.branch_id,
            'branch_ids': user.branch_ids or [],
            'is_active': user.is_active,
            'is_superuser': user.is_superuser,
            'last_login': user.last_login,
            'created_at': user.created_at,
            'updated_at': user.updated_at,
            'role': None,
            'branch': None,
            'branches': [],
            'profile': None,
            'documents': []
        }

        # Get role data from auth service
        role_data = await get_role_from_auth_service(user.role_id, auth_token)
        if role_data:
            user_dict['role'] = role_data

        # Get branch data if exists
        if user.branch_id:
            branch_query = select(Branch).where(Branch.id == user.branch_id)
            branch_result = await db.execute(branch_query)
            branch_obj = branch_result.scalar_one_or_none()
            if branch_obj:
                user_dict['branch'] = {
                    'id': branch_obj.id,
                    'tenant_id': branch_obj.tenant_id,
                    'code': branch_obj.code,
                    'name': branch_obj.name,
                    'address': branch_obj.address,
                    'city': branch_obj.city,
                    'state': branch_obj.state,
                    'postal_code': branch_obj.postal_code,
                    'phone': branch_obj.phone,
                    'email': branch_obj.email,
                    'manager_id': branch_obj.manager_id,
                    'is_active': branch_obj.is_active,
                    'created_at': branch_obj.created_at,
                    'updated_at': branch_obj.updated_at
                }

        response_users.append(EmployeeProfileSchema.model_validate(user_dict))

    return response_users
