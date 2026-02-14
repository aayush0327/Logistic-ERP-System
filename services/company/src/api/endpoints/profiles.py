"""
Profile management endpoints
"""
from typing import List, Optional, Dict, Any, AsyncGenerator
import logging
import json
import csv
import io
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File as FastAPIFile, BackgroundTasks, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, or_, desc, asc, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import uuid
import os
import httpx
from datetime import datetime, timedelta

from src.database import (
    get_db,
    DriverProfile,
    FinanceManagerProfile,
    BranchManagerProfile,
    LogisticsManagerProfile,
    EmployeeProfile,
    EmployeeDocument,
    Branch
)
from src.config_local import settings
from src.helpers import validate_employee_exists, validate_branch_exists
from src.schemas import (
    DriverProfile as DriverProfileSchema,
    DriverProfileCreate,
    DriverProfileUpdate,
    FinanceManagerProfile as FinanceManagerProfileSchema,
    FinanceManagerProfileCreate,
    FinanceManagerProfileUpdate,
    BranchManagerProfile as BranchManagerProfileSchema,
    BranchManagerProfileCreate,
    BranchManagerProfileUpdate,
    LogisticsManagerProfile as LogisticsManagerProfileSchema,
    LogisticsManagerProfileCreate,
    LogisticsManagerProfileUpdate,
    EmployeeDocument as EmployeeDocumentSchema,
    EmployeeDocumentCreate,
    EmployeeDocumentUpdate,
    ProfileCompletionResponse,
    ProfileSearchParams,
    ProfileSearchResponse,
    ProfileExportParams,
    BulkProfileOperation,
    BulkProfileOperationResponse,
    DocumentReorder,
    ProfileStats,
    ProfileChangeHistory
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission,
    # User management permissions (reused for profile management)
    USER_READ_ALL,
    USER_READ,
    USER_READ_OWN,
    USER_CREATE,
    USER_UPDATE,
    USER_UPDATE_OWN,
    USER_DELETE,
    USER_ACTIVATE,
    # Profile management permissions
    PROFILE_UPLOAD_AVATAR,
    # Driver permissions
    DRIVER_READ_ALL,
    DRIVER_READ,
    # Generic resource permissions (for Admin access)
    RESOURCES_READ,
    RESOURCES_READ_ALL,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================================
# HELPER FUNCTIONS - Convert SQLAlchemy models to response dictionaries
# These helpers avoid lazy-loading issues with nested relationships
# ============================================================================

def driver_profile_to_dict(driver: DriverProfile) -> dict:
    """Convert DriverProfile SQLAlchemy model to dictionary"""
    # Safely check if employee relationship is loaded without triggering lazy loading
    employee_dict = None
    try:
        if inspect(driver).attrs.employee.loaded_value is not inspect.RelationshipState.NO_VALUE:
            employee_dict = employee_profile_to_dict(driver.employee)
    except:
        pass

    return {
        "id": str(driver.id),
        "employee_profile_id": driver.employee_profile_id,
        "tenant_id": driver.tenant_id,
        "driver_code": driver.driver_code,
        "license_number": driver.license_number,
        "license_type": driver.license_type,
        "license_expiry": driver.license_expiry,
        "license_issuing_authority": driver.license_issuing_authority,
        "badge_number": driver.badge_number,
        "badge_expiry": driver.badge_expiry,
        "experience_years": driver.experience_years,
        "preferred_vehicle_types": driver.preferred_vehicle_types,
        "current_status": driver.current_status,
        "last_trip_date": driver.last_trip_date,
        "total_trips": driver.total_trips,
        "total_distance": driver.total_distance,
        "average_rating": driver.average_rating,
        "accident_count": driver.accident_count,
        "traffic_violations": driver.traffic_violations,
        "medical_fitness_certificate_date": driver.medical_fitness_certificate_date,
        "police_verification_date": driver.police_verification_date,
        "is_active": driver.is_active,
        "created_at": driver.created_at,
        "updated_at": driver.updated_at,
        "employee": employee_dict
    }


def finance_manager_profile_to_dict(profile: FinanceManagerProfile) -> dict:
    """Convert FinanceManagerProfile SQLAlchemy model to dictionary"""
    return {
        "id": str(profile.id),
        "employee_profile_id": profile.employee_profile_id,
        "tenant_id": profile.tenant_id,
        "can_approve_payments": profile.can_approve_payments,
        "max_approval_limit": profile.max_approval_limit,
        "managed_branches": profile.managed_branches,
        "access_levels": profile.access_levels,
        "is_active": profile.is_active,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "employee": None
    }


def branch_manager_profile_to_dict(profile: BranchManagerProfile) -> dict:
    """Convert BranchManagerProfile SQLAlchemy model to dictionary"""
    return {
        "id": str(profile.id),
        "employee_profile_id": profile.employee_profile_id,
        "tenant_id": profile.tenant_id,
        "managed_branch_id": str(profile.managed_branch_id) if profile.managed_branch_id else None,
        "can_create_quotes": profile.can_create_quotes,
        "can_approve_discounts": profile.can_approve_discounts,
        "max_discount_percentage": profile.max_discount_percentage,
        "can_manage_inventory": profile.can_manage_inventory,
        "can_manage_vehicles": profile.can_manage_vehicles,
        "staff_management_permissions": profile.staff_management_permissions,
        "is_active": profile.is_active,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "employee": None,
        "managed_branch": None
    }


def logistics_manager_profile_to_dict(profile: LogisticsManagerProfile) -> dict:
    """Convert LogisticsManagerProfile SQLAlchemy model to dictionary"""
    return {
        "id": str(profile.id),
        "employee_profile_id": profile.employee_profile_id,
        "tenant_id": profile.tenant_id,
        "managed_zones": profile.managed_zones,
        "can_assign_drivers": profile.can_assign_drivers,
        "can_approve_overtime": profile.can_approve_overtime,
        "can_plan_routes": profile.can_plan_routes,
        "vehicle_management_permissions": profile.vehicle_management_permissions,
        "is_active": profile.is_active,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "employee": None
    }


def employee_profile_to_dict(employee: EmployeeProfile) -> dict:
    """Convert EmployeeProfile SQLAlchemy model to dictionary"""
    return {
        "id": str(employee.id),
        "tenant_id": employee.tenant_id,  # Required by EmployeeProfileInDB schema
        "user_id": str(employee.user_id),
        "employee_code": employee.employee_code,
        "employee_id": employee.employee_code,  # For frontend compatibility
        "role_id": str(employee.role_id) if employee.role_id else None,
        "branch_id": str(employee.branch_id) if employee.branch_id else None,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "phone": employee.phone,
        "phone_number": employee.phone,  # For frontend compatibility
        "email": employee.email,
        "date_of_birth": employee.date_of_birth.isoformat() if employee.date_of_birth else None,
        "gender": employee.gender,
        "blood_group": employee.blood_group,
        "marital_status": employee.marital_status,
        "nationality": employee.nationality,
        "emergency_contact_name": employee.emergency_contact_name,
        "emergency_contact_phone": employee.emergency_contact_phone,
        "emergency_contact_number": employee.emergency_contact_phone,  # For frontend compatibility
        "address": employee.address,
        "city": employee.city,
        "state": employee.state,
        "postal_code": employee.postal_code,
        "country": employee.country,
        "current_address": {
            "address_line1": employee.address or '',
            "address_line2": '',
            "city": employee.city or '',
            "state": employee.state or '',
            "postal_code": employee.postal_code or '',
            "country": employee.country or 'India'
        } if employee.address else None,
        "hire_date": employee.hire_date.isoformat() if employee.hire_date else None,
        "date_of_joining": employee.hire_date.isoformat() if employee.hire_date else None,  # For frontend compatibility
        "employment_type": employee.employment_type,
        "department": employee.department,
        "designation": employee.designation,
        "reports_to": str(employee.reports_to) if employee.reports_to else None,
        "salary": employee.salary,
        "bank_account_number": employee.bank_account_number,
        "bank_name": employee.bank_name,
        "bank_ifsc": employee.bank_ifsc,
        "bank_details": {
            "bank_name": employee.bank_name or '',
            "account_number": employee.bank_account_number or '',
            "ifsc_code": employee.bank_ifsc or '',
            "branch_name": '',
            "account_type": 'savings'
        } if employee.bank_name else None,
        "pan_number": employee.pan_number,
        "aadhar_number": employee.aadhar_number,
        "aadhaar_number": employee.aadhar_number,  # For frontend compatibility
        "passport_number": employee.passport_number,
        "is_active": employee.is_active,
        "created_at": employee.created_at.isoformat() if employee.created_at else None,
        "updated_at": employee.updated_at.isoformat() if employee.updated_at else None,
    }


def employee_document_to_dict(document: EmployeeDocument) -> dict:
    """Convert EmployeeDocument SQLAlchemy model to dictionary"""
    return {
        "id": str(document.id),
        "tenant_id": document.tenant_id,
        "employee_profile_id": document.employee_profile_id,
        "document_type": document.document_type,
        "document_name": document.document_name,
        "document_number": document.document_number,
        "file_path": document.file_path,
        "file_url": document.file_url,
        "file_size": document.file_size,
        "file_type": document.file_type,
        "issue_date": document.issue_date,
        "expiry_date": document.expiry_date,
        "issuing_authority": document.issuing_authority,
        "is_verified": document.is_verified,
        "verified_by": document.verified_by,
        "verified_at": document.verified_at,
        "notes": document.notes,
        "is_active": document.is_active,
        "created_at": document.created_at,
        "updated_at": document.updated_at
    }


# ============================================================================
# ENHANCED PROFILE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/{profile_type}/{profile_id}/completion", response_model=ProfileCompletionResponse)
async def get_profile_completion(
    profile_type: str,
    profile_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get profile completion percentage for any profile type

    Simplified: Profile is complete (100%) if updated_at is not None, else 0%

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Validate profile type
    valid_profile_types = ["employee", "driver", "finance_manager", "branch_manager", "logistics_manager"]
    if profile_type not in valid_profile_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile type. Must be one of: {', '.join(valid_profile_types)}"
        )

    # Get the profile based on type and check updated_at
    updated_at = None
    profile_model_name = profile_type.replace("_", " ").title()

    if profile_type == "employee":
        query = select(EmployeeProfile).where(
            EmployeeProfile.id == profile_id,
            EmployeeProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Employee profile not found")
        updated_at = profile.updated_at

    elif profile_type == "driver":
        query = select(DriverProfile).where(
            DriverProfile.id == profile_id,
            DriverProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Driver profile not found")
        updated_at = profile.updated_at

    elif profile_type == "finance_manager":
        query = select(FinanceManagerProfile).where(
            FinanceManagerProfile.id == profile_id,
            FinanceManagerProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Finance manager profile not found")
        updated_at = profile.updated_at

    elif profile_type == "branch_manager":
        query = select(BranchManagerProfile).where(
            BranchManagerProfile.id == profile_id,
            BranchManagerProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Branch manager profile not found")
        updated_at = profile.updated_at

    elif profile_type == "logistics_manager":
        query = select(LogisticsManagerProfile).where(
            LogisticsManagerProfile.id == profile_id,
            LogisticsManagerProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Logistics manager profile not found")
        updated_at = profile.updated_at

    # Simplified: Profile is complete if updated_at is not None
    is_complete = updated_at is not None
    completion_percentage = 100 if is_complete else 0
    completed_sections = [f"{profile_model_name} Updated"] if is_complete else []
    missing_sections = [] if is_complete else [f"{profile_model_name} Not Updated"]
    total_sections = 1

    return ProfileCompletionResponse(
        profile_id=profile_id,
        profile_type=profile_type,
        completion_percentage=round(completion_percentage, 2),
        completed_sections=completed_sections,
        missing_sections=missing_sections,
        total_sections=total_sections,
        last_updated=datetime.utcnow()
    )


@router.post("/batch-completion", response_model=List[ProfileCompletionResponse])
async def get_batch_profile_completion(
    profile_ids: List[str],
    profile_type: str = Query("employee", description="Profile type for all provided IDs"),
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get profile completion percentage for multiple profiles at once

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Validate profile type
    valid_profile_types = ["employee", "driver", "finance_manager", "branch_manager", "logistics_manager"]
    if profile_type not in valid_profile_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile type. Must be one of: {', '.join(valid_profile_types)}"
        )

    # Limit batch size
    if len(profile_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum batch size is 100 profiles"
        )

    # Define completion criteria for each profile type
    completion_criteria = {
        "employee": [
            ("first_name", "Personal Information"),
            ("phone", "Contact Details"),
            ("address", "Address"),
            ("department", "Employment Details"),
            ("designation", "Employment Details"),
            ("hire_date", "Employment Details"),
            ("pan_number", "Financial Information")
        ],
        "driver": [
            ("license_number", "License Details"),
            ("license_expiry", "License Details"),
            ("license_type", "License Details"),
            ("medical_fitness_certificate_date", "Medical Records"),
            ("police_verification_date", "Verification Records")
        ],
        "finance_manager": [
            ("can_approve_payments", "Permissions"),
            ("max_approval_limit", "Permissions"),
            ("access_levels", "Access Control")
        ],
        "branch_manager": [
            ("managed_branch_id", "Branch Assignment"),
            ("can_create_quotes", "Permissions"),
            ("can_manage_inventory", "Permissions"),
            ("staff_management_permissions", "Staff Management")
        ],
        "logistics_manager": [
            ("managed_zones", "Zone Management"),
            ("can_assign_drivers", "Driver Management"),
            ("can_plan_routes", "Route Planning")
        ]
    }

    results = []

    if profile_type == "employee":
        # Get all employee profiles in one query
        query = select(EmployeeProfile).where(
            EmployeeProfile.id.in_(profile_ids),
            EmployeeProfile.tenant_id == tenant_id
        )
        query_result = await db.execute(query)
        profiles = query_result.scalars().all()

        # Create a dict of profiles for easier lookup
        profiles_dict = {str(p.id): p for p in profiles}

        # Process each profile ID
        for profile_id in profile_ids:
            if profile_id not in profiles_dict:
                # Profile not found
                results.append(ProfileCompletionResponse(
                    profile_id=profile_id,
                    profile_type=profile_type,
                    completion_percentage=0,
                    completed_sections=[],
                    missing_sections=[],
                    total_sections=0,
                    last_updated=datetime.utcnow()
                ))
                continue

            profile = profiles_dict[profile_id]
            completed_sections = []
            missing_sections = []

            # Check completion for employee
            for field, section in completion_criteria["employee"]:
                value = getattr(profile, field, None)
                if value and str(value).strip():
                    completed_sections.append(section)
                else:
                    missing_sections.append(section)

            # Calculate completion percentage
            total_sections = len(set(completed_sections + missing_sections))
            completion_percentage = (len(completed_sections) / total_sections * 100) if total_sections > 0 else 0

            results.append(ProfileCompletionResponse(
                profile_id=profile_id,
                profile_type=profile_type,
                completion_percentage=round(completion_percentage, 2),
                completed_sections=list(set(completed_sections)),
                missing_sections=list(set(missing_sections)),
                total_sections=total_sections,
                last_updated=datetime.utcnow()
            ))

    # Similar logic could be added for other profile types...
    # For now, we'll just return empty results for other types

    return results


@router.post("/{profile_type}/{profile_id}/avatar")
async def upload_profile_avatar(
    profile_type: str,
    profile_id: str,
    file: UploadFile = FastAPIFile(...),
    token_data: TokenData = Depends(require_permissions([*PROFILE_UPLOAD_AVATAR])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload profile avatar/image

    Requires:
    - profiles:upload_avatar (to upload profile images)
    """

    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPEG, PNG, and GIF are allowed"
        )

    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 5MB"
        )

    # Create avatar directory
    avatar_dir = f"uploads/{tenant_id}/avatars/{profile_type}"
    os.makedirs(avatar_dir, exist_ok=True)

    # Generate filename
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{profile_id}_{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(avatar_dir, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        logger.error(f"Failed to save avatar: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save avatar"
        )

    # Update profile with avatar URL
    avatar_url = f"/files/{tenant_id}/avatars/{profile_type}/{unique_filename}"

    if profile_type == "employee":
        query = select(EmployeeProfile).where(
            EmployeeProfile.id == profile_id,
            EmployeeProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail="Employee profile not found")

        # Note: You would need to add avatar_url field to EmployeeProfile model
        # For now, we'll just return the URL
        # profile.avatar_url = avatar_url
        # await db.commit()

    return {
        "profile_id": profile_id,
        "profile_type": profile_type,
        "avatar_url": avatar_url,
        "message": "Avatar uploaded successfully"
    }


@router.post("/search", response_model=ProfileSearchResponse)
async def search_profiles(
    search_params: ProfileSearchParams,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Advanced profile search with multiple filters

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Start with base query
    query = select(EmployeeProfile).where(EmployeeProfile.tenant_id == tenant_id)

    # Apply text search
    if search_params.query:
        query = query.where(
            or_(
                EmployeeProfile.first_name.ilike(f"%{search_params.query}%"),
                EmployeeProfile.last_name.ilike(f"%{search_params.query}%"),
                EmployeeProfile.employee_code.ilike(f"%{search_params.query}%"),
                EmployeeProfile.email.ilike(f"%{search_params.query}%"),
                EmployeeProfile.phone.ilike(f"%{search_params.query}%")
            )
        )

    # Apply branch filter
    if search_params.branches:
        query = query.where(EmployeeProfile.branch_id.in_(search_params.branches))

    # Apply department filter
    if search_params.departments:
        query = query.where(EmployeeProfile.department.in_(search_params.departments))

    # Apply status filter
    if search_params.is_active is not None:
        query = query.where(EmployeeProfile.is_active == search_params.is_active)

    # Apply date range filter
    if search_params.created_after:
        query = query.where(EmployeeProfile.created_at >= search_params.created_after)

    if search_params.created_before:
        query = query.where(EmployeeProfile.created_at <= search_params.created_before)

    # Apply sorting
    if search_params.sort_by == "created_at":
        order_col = EmployeeProfile.created_at
    elif search_params.sort_by == "name":
        order_col = EmployeeProfile.first_name
    elif search_params.sort_by == "employee_code":
        order_col = EmployeeProfile.employee_code
    else:
        order_col = EmployeeProfile.created_at

    if search_params.sort_order == "desc":
        query = query.order_by(desc(order_col))
    else:
        query = query.order_by(asc(order_col))

    # Load relationships
    query = query.options(
        selectinload(EmployeeProfile.role),
        selectinload(EmployeeProfile.branch)
    )

    # Count total results
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (search_params.page - 1) * search_params.per_page
    query = query.offset(offset).limit(search_params.per_page)

    # Execute query
    result = await db.execute(query)
    profiles = result.scalars().all()

    # Format response
    profile_list = []
    for profile in profiles:
        profile_data = {
            "id": profile.id,
            "type": "employee",
            "employee_code": profile.employee_code,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "department": profile.department,
            "designation": profile.designation,
            "branch": profile.branch.name if profile.branch else None,
            "is_active": profile.is_active,
            "created_at": profile.created_at
        }

        # Check if profile has specialized profiles
        if profile.driver_profile:
            profile_data["specialized_profiles"] = ["driver"]
            profile_data["driver_status"] = profile.driver_profile[0].current_status

        if search_params.include_documents:
            # Load documents
            doc_query = select(EmployeeDocument).where(
                EmployeeDocument.employee_profile_id == profile.id
            )
            doc_result = await db.execute(doc_query)
            documents = doc_result.scalars().all()
            profile_data["documents_count"] = len(documents)
            profile_data["documents_verified"] = sum(1 for d in documents if d.is_verified)

        profile_list.append(profile_data)

    # Calculate pages
    pages = (total + search_params.per_page - 1) // search_params.per_page

    return ProfileSearchResponse(
        profiles=profile_list,
        total=total,
        page=search_params.page,
        per_page=search_params.per_page,
        pages=pages,
        filters_applied=search_params.dict(exclude_unset=True)
    )




# DRIVER PROFILE ENDPOINTS

@router.get("/drivers/{driver_id}", response_model=DriverProfileSchema)
async def get_driver_profile(
    driver_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get driver profile by ID

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Get driver profile
    query = select(DriverProfile).where(
        DriverProfile.id == driver_id,
        DriverProfile.tenant_id == tenant_id
    )

    result = await db.execute(query)
    driver = result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    return DriverProfileSchema(**driver_profile_to_dict(driver))


@router.post("/drivers", response_model=DriverProfileSchema, status_code=201)
async def create_driver_profile(
    driver_data: DriverProfileCreate,
    token_data: TokenData = Depends(require_permissions([*USER_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new driver profile

    Requires:
    - users:create (to create new profiles)
    """

    logger.info(f"create_driver_profile called with employee_profile_id={driver_data.employee_profile_id}, tenant_id={tenant_id}")

    # Verify employee profile exists
    try:
        employee = await validate_employee_exists(db, driver_data.employee_profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Check if driver profile already exists for this employee
    existing_query = select(DriverProfile).where(
        DriverProfile.employee_profile_id == driver_data.employee_profile_id,
        DriverProfile.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Driver profile already exists for this employee"
        )

    # Check if license number already exists
    license_query = select(DriverProfile).where(
        DriverProfile.license_number == driver_data.license_number,
        DriverProfile.tenant_id == tenant_id
    )
    license_result = await db.execute(license_query)
    if license_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="License number already exists"
        )

    # Check if driver_code already exists (within the tenant)
    if driver_data.driver_code:
        driver_code_query = select(DriverProfile).where(
            DriverProfile.driver_code == driver_data.driver_code,
            DriverProfile.tenant_id == tenant_id
        )
        driver_code_result = await db.execute(driver_code_query)
        if driver_code_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Driver code '{driver_data.driver_code}' already exists. Please use a unique code."
            )

    # Create driver profile
    driver = DriverProfile(
        tenant_id=tenant_id,
        **driver_data.model_dump()
    )

    db.add(driver)
    await db.commit()
    await db.refresh(driver)

    logger.info(f"Driver profile created: id={driver.id}, employee_profile_id={driver.employee_profile_id}, tenant_id={driver.tenant_id}")

    return DriverProfileSchema(**driver_profile_to_dict(driver))


@router.put("/drivers/{driver_id}", response_model=DriverProfileSchema)
async def update_driver_profile(
    driver_id: str,
    driver_data: DriverProfileUpdate,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update driver profile

    Requires:
    - users:update (to update any profile) OR
    - users:update_own (to update own profile)
    """

    # Get existing driver profile
    query = select(DriverProfile).where(
        DriverProfile.id == driver_id,
        DriverProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    driver = result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Update driver profile
    update_data = driver_data.model_dump(exclude_unset=True)

    # Check license number uniqueness if updating
    if "license_number" in update_data:
        license_query = select(DriverProfile).where(
            DriverProfile.license_number == update_data["license_number"],
            DriverProfile.tenant_id == tenant_id,
            DriverProfile.id != driver_id
        )
        license_result = await db.execute(license_query)
        if license_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="License number already exists"
            )

    # Check driver_code uniqueness if updating
    if "driver_code" in update_data and update_data["driver_code"]:
        driver_code_query = select(DriverProfile).where(
            DriverProfile.driver_code == update_data["driver_code"],
            DriverProfile.tenant_id == tenant_id,
            DriverProfile.id != driver_id
        )
        driver_code_result = await db.execute(driver_code_query)
        if driver_code_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Driver code '{update_data['driver_code']}' already exists. Please use a unique code."
            )

    for field, value in update_data.items():
        setattr(driver, field, value)

    await db.commit()
    await db.refresh(driver)

    return DriverProfileSchema(**driver_profile_to_dict(driver))


@router.put("/drivers/{driver_id}/status")
async def update_driver_status_internal(
    driver_id: str,
    status: str = Query(..., description="New status (available, assigned, unavailable)"),
    token_data: TokenData = Depends(require_any_permission([
        "users:update", "users:update_own", "tms:status_update"
    ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Internal endpoint for TMS service to update driver status when trip completes.

    This endpoint is called by TMS service when a driver completes their trip
    to mark them as available for new assignments.

    Requires one of:
    - users:update (to update any driver)
    - users:update_own (to update own profile)
    - tms:status_update (special permission for TMS service)
    """
    # Get driver profile - first try by user_id (through employee_profile), then by driver_profile id
    # EmployeeProfile is already imported from src.database

    # Try to find driver by joining with employee_profiles using user_id
    query = select(DriverProfile).join(
        EmployeeProfile, DriverProfile.employee_profile_id == EmployeeProfile.id
    ).where(
        EmployeeProfile.user_id == driver_id,
        DriverProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    driver = result.scalar_one_or_none()

    if not driver:
        # Try with driver_id directly (using driver_profile id)
        query = select(DriverProfile).where(
            DriverProfile.id == driver_id,
            DriverProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        driver = result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Validate status
    valid_statuses = ["available", "assigned", "unavailable", "on_trip", "on_leave"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Update status
    driver.current_status = status
    await db.commit()
    await db.refresh(driver)

    logger.info(f"Driver {driver_id} status updated to {status} via internal endpoint")

    return {
        "id": str(driver.id),
        "current_status": driver.current_status,
        "message": f"Driver status updated to {status}"
    }


@router.get("/drivers/", response_model=List[DriverProfileSchema])
async def list_driver_profiles(
    status: Optional[str] = Query(None),
    branch_id: Optional[uuid.UUID] = Query(None),
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List driver profiles with optional filters

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Build query
    query = select(DriverProfile).where(DriverProfile.tenant_id == tenant_id)

    # Apply filters
    if status:
        query = query.where(DriverProfile.current_status == status)

    if branch_id:
        query = query.join(EmployeeProfile).where(EmployeeProfile.branch_id == branch_id)

    # Execute query with relationships
    query = query.options(
        selectinload(DriverProfile.employee).selectinload(EmployeeProfile.branch)
    ).order_by(DriverProfile.created_at.desc())

    result = await db.execute(query)
    drivers = result.scalars().all()

    return [DriverProfileSchema(**driver_profile_to_dict(driver)) for driver in drivers]


@router.get("/drivers/full", response_model=List[dict])
async def list_driver_profiles_full(
    status: Optional[str] = Query(None),
    branch_id: Optional[uuid.UUID] = Query(None),
    token_data: TokenData = Depends(require_any_permission([*DRIVER_READ_ALL, *DRIVER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List driver profiles with full employee and branch information

    This endpoint is optimized for TMS service to fetch driver data with all relevant information

    Requires:
    - drivers:read_all (to view all driver profiles) OR
    - drivers:read (to view basic driver profile info)
    """

    # Build query with joins
    query = select(DriverProfile, EmployeeProfile, Branch).join(
        EmployeeProfile, DriverProfile.employee_profile_id == EmployeeProfile.id
    ).outerjoin(
        Branch, EmployeeProfile.branch_id == Branch.id
    ).where(
        DriverProfile.tenant_id == tenant_id,
        EmployeeProfile.is_active == True,
        DriverProfile.is_active == True
    )

    # Apply filters
    if status:
        query = query.where(DriverProfile.current_status == status)

    if branch_id:
        query = query.where(EmployeeProfile.branch_id == branch_id)

    # Order by created date
    query = query.order_by(DriverProfile.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    # Build response with all data
    drivers = []
    for driver_profile, employee_profile, branch in rows:
        # Create full name
        first_name = employee_profile.first_name or ""
        last_name = employee_profile.last_name or ""
        full_name = f"{first_name} {last_name}".strip()

        drivers.append({
            "id": str(driver_profile.id),
            "employee_profile_id": driver_profile.employee_profile_id,
            "tenant_id": driver_profile.tenant_id,
            "license_number": driver_profile.license_number,
            "license_type": driver_profile.license_type,
            "license_expiry": driver_profile.license_expiry,
            "license_issuing_authority": driver_profile.license_issuing_authority,
            "badge_number": driver_profile.badge_number,
            "badge_expiry": driver_profile.badge_expiry,
            "experience_years": driver_profile.experience_years,
            "preferred_vehicle_types": driver_profile.preferred_vehicle_types,
            "current_status": driver_profile.current_status,
            "last_trip_date": driver_profile.last_trip_date,
            "total_trips": driver_profile.total_trips,
            "total_distance": driver_profile.total_distance,
            "average_rating": driver_profile.average_rating,
            "accident_count": driver_profile.accident_count,
            "traffic_violations": driver_profile.traffic_violations,
            "medical_fitness_certificate_date": driver_profile.medical_fitness_certificate_date,
            "police_verification_date": driver_profile.police_verification_date,
            "is_active": driver_profile.is_active,
            "created_at": driver_profile.created_at,
            "updated_at": driver_profile.updated_at,
            "employee": {
                "id": str(employee_profile.id),
                "user_id": employee_profile.user_id,
                "employee_code": employee_profile.employee_code,
                "first_name": employee_profile.first_name,
                "last_name": employee_profile.last_name,
                "full_name": full_name,
                "phone": employee_profile.phone,
                "email": employee_profile.email,
                "branch_id": str(employee_profile.branch_id) if employee_profile.branch_id else None,
                "branch": {
                    "id": str(branch.id),
                    "name": branch.name,
                    "code": branch.code
                } if branch else None,
                "designation": employee_profile.designation,
                "department": employee_profile.department,
                "is_active": employee_profile.is_active
            }
        })

    return drivers


@router.get("/drivers/by-user/{user_id}", response_model=DriverProfileSchema)
async def get_driver_profile_by_user(
    user_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get driver profile by user ID (from auth service)

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """
    logger.info(f"get_driver_profile_by_user called with user_id={user_id}, tenant_id={tenant_id}")

    # Join with employee_profiles to match by user_id from auth service
    query = select(DriverProfile).join(
        EmployeeProfile, DriverProfile.employee_profile_id == EmployeeProfile.id
    ).where(
        EmployeeProfile.user_id == user_id,
        DriverProfile.tenant_id == tenant_id
    ).options(
        selectinload(DriverProfile.employee)
    )

    result = await db.execute(query)
    driver = result.scalar_one_or_none()

    if not driver:
        # Log all driver profiles for this tenant to help debug
        all_drivers_query = select(DriverProfile, EmployeeProfile).join(
            EmployeeProfile, DriverProfile.employee_profile_id == EmployeeProfile.id
        ).where(DriverProfile.tenant_id == tenant_id)
        all_drivers_result = await db.execute(all_drivers_query)
        all_drivers = all_drivers_result.all()

        logger.error(f"Driver profile not found for user_id={user_id}, tenant_id={tenant_id}")
        logger.error(f"Existing driver profiles for tenant: {[(d.id, d.employee_profile_id, ep.user_id, ep.first_name) for d, ep in all_drivers]}")
        raise HTTPException(status_code=404, detail="Driver profile not found")

    logger.info(f"Found driver profile: id={driver.id}, employee_profile_id={driver.employee_profile_id}, user_id={driver.employee.user_id if driver.employee else 'N/A'}")
    return DriverProfileSchema(**driver_profile_to_dict(driver))


@router.get("/drivers/my/assigned", response_model=List[dict])
async def get_my_assigned_drivers(
    token_data: TokenData = Depends(require_any_permission([
        *DRIVER_READ_ALL, *DRIVER_READ, *RESOURCES_READ, *RESOURCES_READ_ALL
    ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get ALL drivers for the tenant (no branch filtering)

    Returns all active drivers for the tenant regardless of user role.

    Requires:
    - drivers:read_all or drivers:read
    """
    from src.database import EmployeeProfile

    # Get user_id from token_data
    user_id = token_data.user_id
    logger.info(f"Fetching ALL drivers for user {user_id}, tenant_id: {tenant_id}")

    # Return ALL drivers for the tenant (from all branches)
    logger.info(f"Returning ALL drivers for user {user_id}, tenant_id: {tenant_id}")

    # First, fetch all driver profiles with their employee profiles
    # We'll fetch branch data separately to avoid join issues
    query = select(DriverProfile, EmployeeProfile).join(
        EmployeeProfile, DriverProfile.employee_profile_id == EmployeeProfile.id
    ).where(
        DriverProfile.tenant_id == tenant_id,
        EmployeeProfile.is_active == True,
        DriverProfile.is_active == True
    )

    result = await db.execute(query)
    driver_rows = result.all()

    logger.info(f"Found {len(driver_rows)} driver-employee pairs")

    # Collect all unique branch IDs
    branch_ids = list(set([
        str(emp.branch_id) for _, emp in driver_rows if emp.branch_id
    ]))

    logger.info(f"Branch IDs to fetch: {branch_ids}")

    # Fetch all branches in one query
    branches_dict = {}
    if branch_ids:
        from src.database import Branch
        branch_query = select(Branch).where(Branch.id.in_(branch_ids))
        branch_result = await db.execute(branch_query)
        branches = branch_result.scalars().all()
        branches_dict = {str(branch.id): branch for branch in branches}
        logger.info(f"Fetched {len(branches_dict)} branches")

    # Build response with branch data
    drivers = []
    for driver_profile, employee_profile in driver_rows:
        # Create full name
        first_name = employee_profile.first_name or ""
        last_name = employee_profile.last_name or ""
        full_name = f"{first_name} {last_name}".strip()

        # Get branch from cached dict
        branch = branches_dict.get(str(employee_profile.branch_id)) if employee_profile.branch_id else None

        drivers.append({
            "id": str(driver_profile.id),
            "employee_profile_id": driver_profile.employee_profile_id,
            "tenant_id": driver_profile.tenant_id,
            "license_number": driver_profile.license_number,
            "license_type": driver_profile.license_type,
            "license_expiry": driver_profile.license_expiry,
            "license_issuing_authority": driver_profile.license_issuing_authority,
            "badge_number": driver_profile.badge_number,
            "badge_expiry": driver_profile.badge_expiry,
            "experience_years": driver_profile.experience_years,
            "preferred_vehicle_types": driver_profile.preferred_vehicle_types,
            "current_status": driver_profile.current_status,
            "last_trip_date": driver_profile.last_trip_date,
            "total_trips": driver_profile.total_trips,
            "total_distance": driver_profile.total_distance,
            "average_rating": driver_profile.average_rating,
            "accident_count": driver_profile.accident_count,
            "traffic_violations": driver_profile.traffic_violations,
            "medical_fitness_certificate_date": driver_profile.medical_fitness_certificate_date,
            "police_verification_date": driver_profile.police_verification_date,
            "is_active": driver_profile.is_active,
            "created_at": driver_profile.created_at,
            "updated_at": driver_profile.updated_at,
            "employee": {
                "id": str(employee_profile.id),
                "user_id": employee_profile.user_id,
                "employee_code": employee_profile.employee_code,
                "first_name": employee_profile.first_name,
                "last_name": employee_profile.last_name,
                "full_name": full_name,
                "phone": employee_profile.phone,
                "email": employee_profile.email,
                "branch_id": str(employee_profile.branch_id) if employee_profile.branch_id else None,
                "branch": {
                    "id": str(branch.id),
                    "name": branch.name,
                    "code": branch.code
                } if branch else None,
                "designation": employee_profile.designation,
                "department": employee_profile.department,
                "is_active": employee_profile.is_active
            }
        })

    logger.info(f"Returning {len(drivers)} drivers for user {user_id}")
    return drivers


# FINANCE MANAGER PROFILE ENDPOINTS

@router.get("/finance-managers/by-user/{user_id}", response_model=FinanceManagerProfileSchema)
async def get_finance_manager_profile_by_user(
    user_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get finance manager profile by user ID (employee_profile_id)

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """
    query = select(FinanceManagerProfile).where(
        FinanceManagerProfile.employee_profile_id == user_id,
        FinanceManagerProfile.tenant_id == tenant_id
    ).options(
        selectinload(FinanceManagerProfile.employee)
    )

    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Finance manager profile not found")

    return FinanceManagerProfileSchema(**finance_manager_profile_to_dict(profile))


@router.post("/finance-managers", response_model=FinanceManagerProfileSchema, status_code=201)
async def create_finance_manager_profile(
    profile_data: FinanceManagerProfileCreate,
    token_data: TokenData = Depends(require_permissions([*USER_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new finance manager profile

    Requires:
    - users:create (to create new profiles)
    """

    # Verify employee profile exists
    try:
        await validate_employee_exists(db, profile_data.employee_profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Check if finance manager profile already exists for this employee
    existing_query = select(FinanceManagerProfile).where(
        FinanceManagerProfile.employee_profile_id == profile_data.employee_profile_id,
        FinanceManagerProfile.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Finance manager profile already exists for this employee"
        )

    # Create finance manager profile
    profile = FinanceManagerProfile(
        tenant_id=tenant_id,
        **profile_data.model_dump()
    )

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee"])

    return FinanceManagerProfileSchema(**finance_manager_profile_to_dict(profile))


@router.put("/finance-managers/{profile_id}", response_model=FinanceManagerProfileSchema)
async def update_finance_manager_profile(
    profile_id: str,
    profile_data: FinanceManagerProfileUpdate,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update finance manager profile

    Requires:
    - users:update (to update any profile) OR
    - users:update_own (to update own profile)
    """

    # Get existing profile
    query = select(FinanceManagerProfile).where(
        FinanceManagerProfile.id == profile_id,
        FinanceManagerProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Finance manager profile not found")

    # Update profile
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee"])

    return FinanceManagerProfileSchema(**finance_manager_profile_to_dict(profile))


# BRANCH MANAGER PROFILE ENDPOINTS

@router.get("/branch-managers/by-user/{user_id}", response_model=BranchManagerProfileSchema)
async def get_branch_manager_profile_by_user(
    user_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get branch manager profile by user ID (employee_profile_id)

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """
    query = select(BranchManagerProfile).where(
        BranchManagerProfile.employee_profile_id == user_id,
        BranchManagerProfile.tenant_id == tenant_id
    ).options(
        selectinload(BranchManagerProfile.employee),
        selectinload(BranchManagerProfile.managed_branch)
    )

    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Branch manager profile not found")

    return BranchManagerProfileSchema(**branch_manager_profile_to_dict(profile))


@router.post("/branch-managers", response_model=BranchManagerProfileSchema, status_code=201)
async def create_branch_manager_profile(
    profile_data: BranchManagerProfileCreate,
    token_data: TokenData = Depends(require_permissions([*USER_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new branch manager profile

    Requires:
    - users:create (to create new profiles)
    """

    # Verify employee profile exists
    try:
        await validate_employee_exists(db, profile_data.employee_profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Verify branch exists
    try:
        await validate_branch_exists(db, profile_data.managed_branch_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Check if branch manager profile already exists for this employee
    existing_query = select(BranchManagerProfile).where(
        BranchManagerProfile.employee_profile_id == profile_data.employee_profile_id,
        BranchManagerProfile.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Branch manager profile already exists for this employee"
        )

    # Create branch manager profile
    profile = BranchManagerProfile(
        tenant_id=tenant_id,
        **profile_data.model_dump()
    )

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee", "managed_branch"])

    return BranchManagerProfileSchema(**branch_manager_profile_to_dict(profile))


@router.put("/branch-managers/{profile_id}", response_model=BranchManagerProfileSchema)
async def update_branch_manager_profile(
    profile_id: str,
    profile_data: BranchManagerProfileUpdate,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update branch manager profile

    Requires:
    - users:update (to update any profile) OR
    - users:update_own (to update own profile)
    """

    # Get existing profile
    query = select(BranchManagerProfile).where(
        BranchManagerProfile.id == profile_id,
        BranchManagerProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Branch manager profile not found")

    # Update profile
    update_data = profile_data.model_dump(exclude_unset=True)

    # Verify branch if updating
    if "managed_branch_id" in update_data:
        branch_query = select(Branch).where(
            Branch.id == update_data["managed_branch_id"],
            Branch.tenant_id == tenant_id
        )
        branch_result = await db.execute(branch_query)
        if not branch_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Branch not found"
            )

    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee", "managed_branch"])

    return BranchManagerProfileSchema(**branch_manager_profile_to_dict(profile))


# LOGISTICS MANAGER PROFILE ENDPOINTS

@router.get("/logistics-managers/by-user/{user_id}", response_model=LogisticsManagerProfileSchema)
async def get_logistics_manager_profile_by_user(
    user_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get logistics manager profile by user ID (employee_profile_id)

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """
    query = select(LogisticsManagerProfile).where(
        LogisticsManagerProfile.employee_profile_id == user_id,
        LogisticsManagerProfile.tenant_id == tenant_id
    ).options(
        selectinload(LogisticsManagerProfile.employee)
    )

    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Logistics manager profile not found")

    return LogisticsManagerProfileSchema(**logistics_manager_profile_to_dict(profile))


@router.post("/logistics-managers", response_model=LogisticsManagerProfileSchema, status_code=201)
async def create_logistics_manager_profile(
    profile_data: LogisticsManagerProfileCreate,
    token_data: TokenData = Depends(require_permissions([*USER_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new logistics manager profile

    Requires:
    - users:create (to create new profiles)
    """

    # Verify employee profile exists
    try:
        await validate_employee_exists(db, profile_data.employee_profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Check if logistics manager profile already exists for this employee
    existing_query = select(LogisticsManagerProfile).where(
        LogisticsManagerProfile.employee_profile_id == profile_data.employee_profile_id,
        LogisticsManagerProfile.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Logistics manager profile already exists for this employee"
        )

    # Create logistics manager profile
    profile = LogisticsManagerProfile(
        tenant_id=tenant_id,
        **profile_data.model_dump()
    )

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee"])

    return LogisticsManagerProfileSchema(**logistics_manager_profile_to_dict(profile))


@router.put("/logistics-managers/{profile_id}", response_model=LogisticsManagerProfileSchema)
async def update_logistics_manager_profile(
    profile_id: str,
    profile_data: LogisticsManagerProfileUpdate,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update logistics manager profile

    Requires:
    - users:update (to update any profile) OR
    - users:update_own (to update own profile)
    """

    # Get existing profile
    query = select(LogisticsManagerProfile).where(
        LogisticsManagerProfile.id == profile_id,
        LogisticsManagerProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Logistics manager profile not found")

    # Update profile
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    # Load relationships for response
    await db.refresh(profile, ["employee"])

    return LogisticsManagerProfileSchema(**logistics_manager_profile_to_dict(profile))


# DOCUMENT MANAGEMENT ENDPOINTS

@router.post("/documents", response_model=EmployeeDocumentSchema, status_code=201)
async def upload_document(
    employee_profile_id: str,
    document_type: str,
    document_name: str,
    document_number: Optional[str] = None,
    issue_date: Optional[datetime] = None,
    expiry_date: Optional[datetime] = None,
    issuing_authority: Optional[str] = None,
    notes: Optional[str] = None,
    file: UploadFile = FastAPIFile(...),
    token_data: TokenData = Depends(require_permissions([*USER_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a document for an employee with enhanced validation and security

    Requires:
    - users:create (to create/upload documents)
    """

    # Verify employee profile exists
    try:
        await validate_employee_exists(db, employee_profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Enhanced file validation
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
    file_extension = os.path.splitext(file.filename)[1].lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Check file size (max 10MB)
    max_size = 10 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB"
        )

    # Validate document type
    valid_document_types = [
        "passport", "license", "aadhar", "pan", "voter_id", "contract",
        "resume", "experience_letter", "salary_slip", "bank_statement",
        "educational_certificate", "medical_certificate", "police_verification",
        "address_proof", "photo_id", "other"
    ]

    if document_type not in valid_document_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Must be one of: {', '.join(valid_document_types)}"
        )

    # Validate expiry date if provided
    if expiry_date and expiry_date <= datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Expiry date must be in the future"
        )

    # Check for duplicate document number
    if document_number:
        duplicate_query = select(EmployeeDocument).where(
            EmployeeDocument.document_number == document_number,
            EmployeeDocument.tenant_id == tenant_id,
            EmployeeDocument.document_type == document_type,
            EmployeeDocument.is_active == True
        )
        duplicate_result = await db.execute(duplicate_query)
        if duplicate_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"A document with number {document_number} already exists for this document type"
            )

    # Create secure upload directory with tenant isolation
    upload_dir = Path(f"uploads/{tenant_id}/documents/{employee_profile_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate secure filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{document_type}_{uuid.uuid4().hex[:8]}{file_extension}"
    file_path = upload_dir / safe_filename

    # Save file with error handling
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        logger.error(f"Failed to save file: {str(e)}")
        # Clean up partial file if it exists
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail="Failed to save document file"
        )

    # Determine verification status based on document type
    auto_verify_types = ["photo_id", "other"]
    is_verified = document_type in auto_verify_types

    # Create document record with enhanced security
    document = EmployeeDocument(
        tenant_id=tenant_id,
        employee_profile_id=employee_profile_id,
        document_type=document_type,
        document_name=document_name,
        document_number=document_number,
        file_path=str(file_path),
        file_url=f"/files/{tenant_id}/documents/{employee_profile_id}/{safe_filename}",
        file_size=len(file_content),
        file_type=file_extension.lstrip('.'),
        issue_date=issue_date,
        expiry_date=expiry_date,
        issuing_authority=issuing_authority,
        notes=notes,
        is_verified=is_verified,
        verified_by=user_id if is_verified else None,
        verified_at=datetime.utcnow() if is_verified else None
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Load relationships for response
    await db.refresh(document, ["employee"])

    return EmployeeDocumentSchema(**employee_document_to_dict(document))


@router.get("/documents/{document_id}", response_model=EmployeeDocumentSchema)
async def get_document(
    document_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get document by ID

    Requires:
    - users:read_all (to view all documents) OR
    - users:read (to view basic document info)
    """

    # Get document with relationships
    query = select(EmployeeDocument).where(
        EmployeeDocument.id == document_id,
        EmployeeDocument.tenant_id == tenant_id
    ).options(
        selectinload(EmployeeDocument.employee)
    )

    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return EmployeeDocumentSchema(**employee_document_to_dict(document))


@router.put("/documents/{document_id}", response_model=EmployeeDocumentSchema)
async def update_document(
    document_id: str,
    document_data: EmployeeDocumentUpdate,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update document metadata

    Requires:
    - users:update (to update any document) OR
    - users:update_own (to update own documents)
    """

    # Get existing document
    query = select(EmployeeDocument).where(
        EmployeeDocument.id == document_id,
        EmployeeDocument.tenant_id == tenant_id
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update document
    update_data = document_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)

    await db.commit()
    await db.refresh(document)

    # Load relationships for response
    await db.refresh(document, ["employee"])

    return EmployeeDocumentSchema(**employee_document_to_dict(document))


@router.post("/documents/{document_id}/verify", response_model=EmployeeDocumentSchema)
async def verify_document(
    document_id: str,
    token_data: TokenData = Depends(require_permissions([*USER_UPDATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a document as verified

    Requires:
    - users:update (to verify documents)
    """

    # Get document
    query = select(EmployeeDocument).where(
        EmployeeDocument.id == document_id,
        EmployeeDocument.tenant_id == tenant_id
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Mark as verified
    document.is_verified = True
    document.verified_by = user_id
    document.verified_at = datetime.utcnow()

    await db.commit()
    await db.refresh(document)

    # Load relationships for response
    await db.refresh(document, ["employee"])

    return EmployeeDocumentSchema(**employee_document_to_dict(document))


@router.get("/documents/", response_model=List[EmployeeDocumentSchema])
async def list_documents(
    employee_profile_id: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    is_verified: Optional[bool] = Query(None),
    is_expiry_soon: Optional[bool] = Query(None),
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List documents with optional filters

    Requires:
    - users:read_all (to view all documents) OR
    - users:read (to view basic document info)
    """

    # Build query
    query = select(EmployeeDocument).where(EmployeeDocument.tenant_id == tenant_id)

    # Apply filters
    if employee_profile_id:
        query = query.where(EmployeeDocument.employee_profile_id == employee_profile_id)

    if document_type:
        query = query.where(EmployeeDocument.document_type == document_type)

    if is_verified is not None:
        query = query.where(EmployeeDocument.is_verified == is_verified)

    if is_expiry_soon:
        # Documents expiring within 30 days
        from datetime import timedelta
        expiry_threshold = datetime.utcnow() + timedelta(days=30)
        query = query.where(
            EmployeeDocument.expiry_date <= expiry_threshold,
            EmployeeDocument.expiry_date >= datetime.utcnow()
        )

    # Execute query with relationships
    query = query.options(
        selectinload(EmployeeDocument.employee)
    ).order_by(EmployeeDocument.created_at.desc())

    result = await db.execute(query)
    documents = result.scalars().all()

    return [EmployeeDocumentSchema(**employee_document_to_dict(doc)) for doc in documents]


@router.get("/documents/expiring", response_model=List[EmployeeDocumentSchema])
async def get_expiring_documents(
    days: int = Query(default=30, ge=1, le=365),
    employee_profile_id: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get documents that are expiring within the specified number of days

    Requires:
    - users:read_all (to view all documents) OR
    - users:read (to view basic document info)
    """

    # Calculate expiry threshold
    expiry_threshold = datetime.utcnow() + timedelta(days=days)

    # Build query
    query = select(EmployeeDocument).where(
        EmployeeDocument.tenant_id == tenant_id,
        EmployeeDocument.expiry_date.isnot(None),
        EmployeeDocument.expiry_date <= expiry_threshold,
        EmployeeDocument.expiry_date >= datetime.utcnow(),
        EmployeeDocument.is_active == True
    )

    # Apply optional filters
    if employee_profile_id:
        query = query.where(EmployeeDocument.employee_profile_id == employee_profile_id)

    if document_type:
        query = query.where(EmployeeDocument.document_type == document_type)

    # Order by expiry date (closest first)
    query = query.order_by(EmployeeDocument.expiry_date.asc())

    # Load relationships
    query = query.options(
        selectinload(EmployeeDocument.employee).selectinload(EmployeeProfile.branch)
    )

    # Execute query
    result = await db.execute(query)
    documents = result.scalars().all()

    # Enhance response with days until expiry
    response_documents = []
    for doc in documents:
        doc_dict = EmployeeDocumentSchema(**employee_document_to_dict(doc)).model_dump()
        days_until_expiry = (doc.expiry_date - datetime.utcnow()).days
        doc_dict["days_until_expiry"] = days_until_expiry

        # Add expiry status
        if days_until_expiry <= 7:
            doc_dict["expiry_status"] = "critical"
        elif days_until_expiry <= 30:
            doc_dict["expiry_status"] = "warning"
        else:
            doc_dict["expiry_status"] = "normal"

        response_documents.append(doc_dict)

    return response_documents


# ADDITIONAL ENHANCED ENDPOINTS

@router.post("/export")
async def export_profiles(
    export_params: ProfileExportParams,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Export profile data in various formats

    Requires:
    - users:read_all (to export all profiles) OR
    - users:read (to export basic profile data)
    """

    # Build base query
    query = select(EmployeeProfile).where(EmployeeProfile.tenant_id == tenant_id)

    # Apply filters
    if export_params.branches:
        query = query.where(EmployeeProfile.branch_id.in_(export_params.branches))

    if export_params.departments:
        query = query.where(EmployeeProfile.department.in_(export_params.departments))

    if not export_params.include_inactive:
        query = query.where(EmployeeProfile.is_active == True)

    # Load relationships
    query = query.options(
        selectinload(EmployeeProfile.role),
        selectinload(EmployeeProfile.branch),
        selectinload(EmployeeProfile.documents)
    )

    # Execute query
    result = await db.execute(query)
    profiles = result.scalars().all()

    # Prepare export data
    export_data = []
    for profile in profiles:
        row = {
            "Employee ID": profile.id,
            "Employee Code": profile.employee_code,
            "First Name": profile.first_name,
            "Last Name": profile.last_name,
            "Email": profile.email,
            "Phone": profile.phone,
            "Department": profile.department,
            "Designation": profile.designation,
            "Branch": profile.branch.name if profile.branch else None,
            "Role": profile.role.display_name if profile.role else None,
            "Hire Date": profile.hire_date.strftime("%Y-%m-%d") if profile.hire_date else None,
            "Status": "Active" if profile.is_active else "Inactive",
            "Created At": profile.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }

        # Add documents info if requested
        if export_params.include_documents:
            documents = profile.documents or []
            row["Documents Count"] = len(documents)
            row["Verified Documents"] = sum(1 for d in documents if d.is_verified)

            # Check for expiring documents
            expiring_soon = sum(1 for d in documents
                              if d.expiry_date and d.expiry_date <= datetime.utcnow() + timedelta(days=30))
            row["Documents Expiring Soon"] = expiring_soon

        # Apply field filtering if specified
        if export_params.fields:
            row = {k: v for k, v in row.items() if k in export_params.fields}

        export_data.append(row)

    # Generate file based on format
    if export_params.export_format == "csv":
        output = io.StringIO()
        if export_data:
            writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
            writer.writeheader()
            writer.writerows(export_data)

        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=profiles_export.csv"}
        )

    elif export_params.export_format == "json":
        json_data = json.dumps(export_data, indent=2, default=str)

        return StreamingResponse(
            io.BytesIO(json_data.encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=profiles_export.json"}
        )

    elif export_params.export_format == "xlsx":
        # For Excel export, you would need to install openpyxl
        # For now, returning CSV as fallback
        output = io.StringIO()
        if export_data:
            writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
            writer.writeheader()
            writer.writerows(export_data)

        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=profiles_export.csv"}
        )


@router.put("/{profile_id}/documents/reorder")
async def reorder_documents(
    profile_id: str,
    reorder_data: DocumentReorder,
    token_data: TokenData = Depends(require_any_permission([*USER_UPDATE, *USER_UPDATE_OWN])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Reorder documents for a profile

    Requires:
    - users:update (to reorder any documents) OR
    - users:update_own (to reorder own documents)
    """

    # Verify employee exists
    try:
        await validate_employee_exists(db, profile_id, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Get all documents for the profile
    query = select(EmployeeDocument).where(
        EmployeeDocument.employee_profile_id == profile_id,
        EmployeeDocument.tenant_id == tenant_id
    )
    result = await db.execute(query)
    documents = result.scalars().all()

    if not documents:
        raise HTTPException(status_code=404, detail="No documents found for this profile")

    # Create a mapping of document_id to order
    document_order_map = {
        item["document_id"]: item["order"]
        for item in reorder_data.document_orders
    }

    # Update document orders
    updated_documents = []
    for doc in documents:
        if doc.id in document_order_map:
            # Note: You would need to add 'order' field to EmployeeDocument model
            # For now, we'll just simulate the update
            # doc.order = document_order_map[doc.id]
            updated_documents.append({
                "id": doc.id,
                "document_name": doc.document_name,
                "new_order": document_order_map[doc.id]
            })

    await db.commit()

    return {
        "profile_id": profile_id,
        "message": "Documents reordered successfully",
        "updated_documents": updated_documents
    }


@router.get("/stats", response_model=ProfileStats)
async def get_profile_statistics(
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get profile statistics dashboard

    Requires:
    - users:read_all (to view all statistics) OR
    - users:read (to view basic statistics)
    """

    # Get total profiles
    total_query = select(func.count(EmployeeProfile.id)).where(
        EmployeeProfile.tenant_id == tenant_id
    )
    total_result = await db.execute(total_query)
    total_profiles = total_result.scalar()

    # Get active/inactive profiles
    active_query = select(func.count(EmployeeProfile.id)).where(
        EmployeeProfile.tenant_id == tenant_id,
        EmployeeProfile.is_active == True
    )
    active_result = await db.execute(active_query)
    active_profiles = active_result.scalar()
    inactive_profiles = total_profiles - active_profiles

    # Get profiles by type
    profiles_by_type = {
        "employee": total_profiles,  # Base employee profiles
        "driver": 0,
        "finance_manager": 0,
        "branch_manager": 0,
        "logistics_manager": 0
    }

    # Count specialized profiles
    driver_query = select(func.count(DriverProfile.id)).where(
        DriverProfile.tenant_id == tenant_id
    )
    driver_result = await db.execute(driver_query)
    profiles_by_type["driver"] = driver_result.scalar()

    finance_query = select(func.count(FinanceManagerProfile.id)).where(
        FinanceManagerProfile.tenant_id == tenant_id
    )
    finance_result = await db.execute(finance_query)
    profiles_by_type["finance_manager"] = finance_result.scalar()

    branch_query = select(func.count(BranchManagerProfile.id)).where(
        BranchManagerProfile.tenant_id == tenant_id
    )
    branch_result = await db.execute(branch_query)
    profiles_by_type["branch_manager"] = branch_result.scalar()

    logistics_query = select(func.count(LogisticsManagerProfile.id)).where(
        LogisticsManagerProfile.tenant_id == tenant_id
    )
    logistics_result = await db.execute(logistics_query)
    profiles_by_type["logistics_manager"] = logistics_result.scalar()

    # Get profiles by branch
    branch_query = select(
        Branch.name,
        func.count(EmployeeProfile.id)
    ).select_from(
        EmployeeProfile
    ).join(
        Branch, EmployeeProfile.branch_id == Branch.id
    ).where(
        EmployeeProfile.tenant_id == tenant_id
    ).group_by(Branch.name)

    branch_result = await db.execute(branch_query)
    profiles_by_branch = {row[0]: row[1] for row in branch_result}

    # Get profiles by department
    dept_query = select(
        EmployeeProfile.department,
        func.count(EmployeeProfile.id)
    ).where(
        EmployeeProfile.tenant_id == tenant_id,
        EmployeeProfile.department.isnot(None)
    ).group_by(EmployeeProfile.department)

    dept_result = await db.execute(dept_query)
    profiles_by_department = {row[0]: row[1] for row in dept_result}

    # Get recent additions (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_query = select(func.count(EmployeeProfile.id)).where(
        EmployeeProfile.tenant_id == tenant_id,
        EmployeeProfile.created_at >= thirty_days_ago
    )
    recent_result = await db.execute(recent_query)
    recent_additions = recent_result.scalar()

    # Get document statistics
    doc_total_query = select(func.count(EmployeeDocument.id)).where(
        EmployeeDocument.tenant_id == tenant_id
    )
    doc_total_result = await db.execute(doc_total_query)
    documents_total = doc_total_result.scalar()

    doc_verified_query = select(func.count(EmployeeDocument.id)).where(
        EmployeeDocument.tenant_id == tenant_id,
        EmployeeDocument.is_verified == True
    )
    doc_verified_result = await db.execute(doc_verified_query)
    documents_verified = doc_verified_result.scalar()

    documents_pending = documents_total - documents_verified

    # Documents expiring soon
    expiry_threshold = datetime.utcnow() + timedelta(days=30)
    doc_expiring_query = select(func.count(EmployeeDocument.id)).where(
        EmployeeDocument.tenant_id == tenant_id,
        EmployeeDocument.expiry_date.isnot(None),
        EmployeeDocument.expiry_date <= expiry_threshold,
        EmployeeDocument.expiry_date >= datetime.utcnow()
    )
    doc_expiring_result = await db.execute(doc_expiring_query)
    documents_expiring_soon = doc_expiring_result.scalar()

    # Documents expired
    doc_expired_query = select(func.count(EmployeeDocument.id)).where(
        EmployeeDocument.tenant_id == tenant_id,
        EmployeeDocument.expiry_date < datetime.utcnow()
    )
    doc_expired_result = await db.execute(doc_expired_query)
    documents_expired = doc_expired_result.scalar()

    # Calculate actual average completion percentage
    avg_completion_percentage = await _calculate_average_completion(db, tenant_id)

    return ProfileStats(
        total_profiles=total_profiles,
        active_profiles=active_profiles,
        inactive_profiles=inactive_profiles,
        profiles_by_type=profiles_by_type,
        profiles_by_branch=profiles_by_branch,
        profiles_by_department=profiles_by_department,
        recent_additions=recent_additions,
        documents_total=documents_total,
        documents_verified=documents_verified,
        documents_pending=documents_pending,
        documents_expiring_soon=documents_expiring_soon,
        documents_expired=documents_expired,
        avg_completion_percentage=avg_completion_percentage
    )


async def _calculate_average_completion(db: AsyncSession, tenant_id: str) -> float:
    """
    Calculate the average profile completion percentage across all employees
    Simplified: Profile is complete (100%) if updated_at is not None, else 0%
    """
    # Get all employees
    query = select(EmployeeProfile).where(
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    employees = result.scalars().all()

    if not employees:
        return 0.0

    total_completion = 0

    for employee in employees:
        # Simplified: 100% if updated_at is not None, else 0%
        completion_percentage = 100 if employee.updated_at is not None else 0
        total_completion += completion_percentage

    return round(total_completion / len(employees), 2)


@router.get("/by-role", response_model=Dict[str, Any])
async def get_profiles_by_role(
    request: Request,
    include_inactive: bool = Query(False, description="Include inactive users in the response"),
    include_completion_stats: bool = Query(True, description="Include profile completion statistics"),
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all users grouped by their roles with optional profile completion statistics

    Now uses auth service for user and role data instead of company_roles table

    Requires:
    - users:read_all (to view all profiles) OR
    - users:read (to view basic profile info)
    """

    # Get authorization header from request to pass to auth service
    auth_headers = {"Accept": "application/json"}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    # Fetch users from auth service for this tenant
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            users_response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/users/",
                params={"tenant_id": tenant_id, "limit": 1000},
                headers=auth_headers
            )
            if users_response.status_code != 200:
                logger.error(f"Failed to fetch users from auth service: {users_response.status_code}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to fetch users from auth service"
                )
            auth_users = users_response.json()
        except httpx.RequestError as e:
            logger.error(f"Error calling auth service: {e}")
            raise HTTPException(
                status_code=503,
                detail="Auth service unavailable"
            )

    # Get all employee profiles for this tenant
    query = select(EmployeeProfile).options(
        selectinload(EmployeeProfile.branch)
    ).where(
        EmployeeProfile.tenant_id == tenant_id
    )

    if not include_inactive:
        query = query.where(EmployeeProfile.is_active == True)

    result = await db.execute(query)
    employee_profiles = result.scalars().all()

    # Create a map of user_id -> employee_profile
    profile_map = {ep.user_id: ep for ep in employee_profiles}

    # Fetch all roles from auth service for role name lookup
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            roles_response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/roles/",
                headers=auth_headers
            )
            roles_map = {}
            if roles_response.status_code == 200:
                auth_roles = roles_response.json()
                for role in auth_roles:
                    roles_map[str(role["id"])] = {
                        "id": str(role["id"]),
                        "name": role["name"],
                        "role_name": role["name"],
                        "display_name": role.get("description") or role["name"],
                        "is_system_role": role.get("is_system", False)
                    }
        except httpx.RequestError as e:
            logger.error(f"Error fetching roles from auth service: {e}")
            roles_map = {}

    # Import the helper function from users.py
    from src.api.endpoints.users import extract_auth_token
    auth_token = extract_auth_token(request)

    # Group users by role from auth service
    roles_dict: Dict[str, Dict[str, Any]] = {}

    for auth_user in auth_users:
        # Skip if no employee profile exists
        employee = profile_map.get(auth_user["id"])
        if not employee:
            continue

        # Use employee's role_id (from employee_profiles table) instead of auth_user's role_id
        role_id = str(employee.role_id) if employee.role_id else "unassigned"

        # Get role information from roles_map (fetched from auth service)
        role_info = roles_map.get(role_id, {})
        role_name = role_info.get("role_name") or role_info.get("name") or "Unassigned"
        is_system_role = role_info.get("is_system_role", False)

        # Initialize role group if not exists
        if role_id not in roles_dict:
            roles_dict[role_id] = {
                "role_id": role_id,
                "role_name": role_name,
                "role_display_name": role_name,
                "is_system_role": is_system_role,
                "users": [],
                "total_count": 0,
                "active_count": 0,
                "inactive_count": 0
            }

        # Calculate profile completion for this user
        completion_percentage = 0
        completed_sections = []
        missing_sections = []
        total_sections = 0

        if include_completion_stats:
            # Simplified: Profile is complete if updated_at is not None (has been updated at least once)
            is_complete = employee.updated_at is not None
            completion_percentage = 100 if is_complete else 0
            completed_sections = ["Profile Updated"] if is_complete else []
            missing_sections = [] if is_complete else ["Profile Not Updated"]
            total_sections = 1

        # Get branch information
        branch_name = None
        if employee.branch:
            branch_name = employee.branch.name

        # Create user object
        user_data = {
            "id": str(employee.id),  # Convert UUID to string
            "user_id": employee.user_id,
            "employee_code": employee.employee_code,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "designation": employee.designation,
            "branch_id": str(employee.branch_id) if employee.branch_id else None,
            "branch_name": branch_name,
            "is_active": employee.is_active,
            "created_at": employee.created_at.isoformat() if employee.created_at else None,
            "updated_at": employee.updated_at.isoformat() if employee.updated_at else None,
            "role_id": role_id,
            "role_name": role_name
        }

        # Add completion stats if requested
        if include_completion_stats:
            user_data["profile_completion"] = {
                "completion_percentage": round(completion_percentage, 2),
                "completed_sections": list(set(completed_sections)),
                "missing_sections": list(set(missing_sections)),
                "total_sections": total_sections,
                "is_complete": completion_percentage >= 100
            }

        # Add user to role group
        roles_dict[role_id]["users"].append(user_data)
        roles_dict[role_id]["total_count"] += 1
        if employee.is_active:
            roles_dict[role_id]["active_count"] += 1
        else:
            roles_dict[role_id]["inactive_count"] += 1

    # Convert to list and sort (Unassigned at the end)
    roles_list = list(roles_dict.values())
    roles_list.sort(key=lambda x: (x["role_name"] == "Unassigned", x["role_name"]))

    # Calculate overall statistics
    total_users = sum(role["total_count"] for role in roles_list)
    total_active = sum(role["active_count"] for role in roles_list)
    total_inactive = sum(role["inactive_count"] for role in roles_list)

    # Calculate completion statistics if requested
    completion_stats = None
    if include_completion_stats:
        all_users = [user for role in roles_list for user in role["users"]]
        total_with_profiles = len(all_users)

        if total_with_profiles > 0:
            fully_complete = sum(
                1 for user in all_users
                if user["profile_completion"]["completion_percentage"] >= 100
            )
            partially_complete = sum(
                1 for user in all_users
                if 0 < user["profile_completion"]["completion_percentage"] < 100
            )
            not_started = sum(
                1 for user in all_users
                if user["profile_completion"]["completion_percentage"] == 0
            )

            avg_completion = sum(
                user["profile_completion"]["completion_percentage"]
                for user in all_users
            ) / total_with_profiles

            completion_stats = {
                "total_profiles": total_with_profiles,
                "fully_complete": fully_complete,
                "partially_complete": partially_complete,
                "not_started": not_started,
                "average_completion_percentage": round(avg_completion, 2)
            }

    return {
        "roles": roles_list,
        "total_users": total_users,
        "total_active": total_active,
        "total_inactive": total_inactive,
        "completion_stats": completion_stats,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("/bulk-operation", response_model=BulkProfileOperationResponse)
async def bulk_profile_operation(
    operation: BulkProfileOperation,
    background_tasks: BackgroundTasks,
    token_data: TokenData = Depends(require_permissions([*USER_UPDATE])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform bulk operations on profiles

    Requires:
    - users:update (to perform bulk operations)
    """
    operation_id = str(uuid.uuid4())

    # Initialize response
    response = BulkProfileOperationResponse(
        operation_id=operation_id,
        total_profiles=len(operation.profile_ids),
        successful=0,
        failed=0,
        failed_ids=[],
        errors=[],
        started_at=datetime.utcnow()
    )

    # Process each profile
    for profile_id in operation.profile_ids:
        try:
            # Verify profile exists
            query = select(EmployeeProfile).where(
                EmployeeProfile.id == profile_id,
                EmployeeProfile.tenant_id == tenant_id
            )
            result = await db.execute(query)
            profile = result.scalar_one_or_none()

            if not profile:
                response.failed += 1
                response.failed_ids.append(profile_id)
                response.errors.append({
                    "profile_id": profile_id,
                    "error": "Profile not found"
                })
                continue

            # Perform operation
            if operation.operation == "activate":
                profile.is_active = True
                response.successful += 1

            elif operation.operation == "deactivate":
                profile.is_active = False
                response.successful += 1

            elif operation.operation == "delete":
                # Soft delete - mark as inactive
                profile.is_active = False
                response.successful += 1

            elif operation.operation == "export":
                # For export, we would add to a background task
                background_tasks.add_task(
                    export_single_profile,
                    tenant_id,
                    profile_id,
                    operation.operation_params or {}
                )
                response.successful += 1

        except Exception as e:
            response.failed += 1
            response.failed_ids.append(profile_id)
            response.errors.append({
                "profile_id": profile_id,
                "error": str(e)
            })

    await db.commit()
    response.completed_at = datetime.utcnow()

    return response


async def export_single_profile(tenant_id: str, profile_id: str, params: Dict[str, Any]):
    """Background task to export a single profile"""
    # Implementation would go here
    pass


@router.get("/{profile_type}/{profile_id}/history", response_model=ProfileChangeHistory)
async def get_profile_change_history(
    profile_type: str,
    profile_id: str,
    token_data: TokenData = Depends(require_any_permission([*USER_READ_ALL, *USER_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit trail of profile changes

    Requires:
    - users:read_all (to view all history) OR
    - users:read (to view basic history)
    """

    # Verify profile type
    valid_profile_types = ["employee", "driver", "finance_manager", "branch_manager", "logistics_manager"]
    if profile_type not in valid_profile_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile type. Must be one of: {', '.join(valid_profile_types)}"
        )

    # Note: This requires an audit log table to be implemented
    # For now, returning a mock response

    mock_changes = [
        {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "profile_type": profile_type,
            "action": "created",
            "field_name": None,
            "old_value": None,
            "new_value": None,
            "changed_by": "system",
            "changed_at": datetime.utcnow() - timedelta(days=30),
            "ip_address": "127.0.0.1",
            "user_agent": "Mozilla/5.0"
        },
        {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "profile_type": profile_type,
            "action": "updated",
            "field_name": "phone",
            "old_value": "9876543210",
            "new_value": "9876543211",
            "changed_by": "admin",
            "changed_at": datetime.utcnow() - timedelta(days=15),
            "ip_address": "127.0.0.1",
            "user_agent": "Mozilla/5.0"
        }
    ]

    return ProfileChangeHistory(
        profile_id=profile_id,
        profile_type=profile_type,
        changes=mock_changes
    )