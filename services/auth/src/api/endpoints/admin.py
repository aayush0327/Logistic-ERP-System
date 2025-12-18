"""
Super Admin endpoints for managing the entire system
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from ...database import get_db
from ...services.tenant_service import TenantService
from ...services.user_service import UserService
from ...dependencies import get_current_user_token, TokenData
from ...schemas import UserCreate

router = APIRouter()


@router.post("/companies", response_model=dict)
async def create_company_with_admin(
    company_data: Dict[str, Any],
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Create a new company with admin user (Super Admin only)"""
    # Check if user is super admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create companies"
        )

    # Validate required fields
    required_fields = ["name", "domain", "admin"]
    for field in required_fields:
        if field not in company_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Check if domain already exists
    existing_tenants = await TenantService.get_all_tenants(db)
    for t in existing_tenants:
        if t.domain == company_data["domain"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Domain already exists"
            )

    try:
        # Create tenant with admin
        tenant = await TenantService.create_tenant(
            db=db,
            name=company_data["name"],
            domain=company_data["domain"],
            admin_data=company_data["admin"]
        )

        # Get stats to return complete info
        stats = await TenantService.get_tenant_stats(db, tenant.id)

        return {
            "message": "Company created successfully",
            "company": {
                "id": tenant.id,
                "name": tenant.name,
                "domain": tenant.domain,
                "status": "active" if tenant.is_active else "disabled",
                "created_at": tenant.created_at,
                "admin_email": company_data["admin"]["email"]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create company: {str(e)}"
        )


@router.post("/users", response_model=dict)
async def create_admin_user(
    user_data: Dict[str, Any],
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Create an admin user for any tenant (Super Admin only)"""
    # Check if user is super admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create admin users"
        )

    # Validate required fields
    required_fields = ["email", "password",
                       "first_name", "last_name", "tenant_id"]
    for field in required_fields:
        if field not in user_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Verify tenant exists
    tenant = await TenantService.get_tenant_by_id(db, user_data["tenant_id"])
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    try:
        # Create user
        user_create = UserCreate(
            email=user_data["email"],
            password=user_data["password"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            tenant_id=user_data["tenant_id"],
            # Default to admin role (ID = 2)
            role_id=user_data.get("role_id", 2),
            is_active=True
        )

        user = await UserService.create_user(db, user_create)

        return {
            "message": "Admin user created successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "tenant_id": user.tenant_id,
                "role_id": user.role_id,
                "is_active": user.is_active,
                "created_at": user.created_at
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create admin user: {str(e)}"
        )


@router.get("/stats", response_model=Dict[str, Any])
async def get_companies_stats(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get overall companies statistics (Super Admin only)"""
    # Check if user is super admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can view statistics"
        )

    # Use the optimized method that already includes user counts
    tenants_with_stats = await TenantService.get_all_tenants_with_stats(db)

    total_companies = len(tenants_with_stats)
    active_companies = sum(1 for t in tenants_with_stats if t["is_active"])
    total_users = sum(t["total_users"] for t in tenants_with_stats)

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "disabled_companies": total_companies - active_companies,
        "total_users": total_users,
        "last_updated": datetime.utcnow().isoformat()
    }
