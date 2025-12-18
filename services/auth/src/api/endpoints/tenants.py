"""
Tenant management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from ...database import get_db, User
from ...schemas import TenantCreate, TenantUpdate, Tenant as TenantSchema
from ...services.tenant_service import TenantService
from ...dependencies import get_current_user_token, TokenData
from ...auth import get_password_hash

router = APIRouter()


@router.get("/")
async def list_tenants(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """List all tenants (Super Admin only)"""
    # Check if user is super admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can list all tenants"
        )

    # Use the optimized method that gets all data in fewer queries
    result = await TenantService.get_all_tenants_with_stats(db)

    return result


@router.post("/create_tenant", response_model=TenantSchema)
async def create_tenant(
    tenant_data: dict,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Create a new tenant with admin (Super Admin only)"""
    # Check if user is super admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create tenants"
        )

    # Validate required fields
    required_fields = ["name", "domain", "admin"]
    for field in required_fields:
        if field not in tenant_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Check if domain already exists
    existing_tenants = await TenantService.get_all_tenants(db)
    for t in existing_tenants:
        if t.domain == tenant_data["domain"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Domain already exists"
            )

    # Check if admin email already exists
    # TODO: Add email uniqueness validation

    try:
        tenant = await TenantService.create_tenant_with_admin(
            db=db,
            name=tenant_data["name"],
            domain=tenant_data["domain"],
            admin_data=tenant_data["admin"]
        )

        return tenant
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tenant: {str(e)}"
        )


@router.get("/{tenant_id}", response_model=TenantSchema)
async def get_tenant(
    tenant_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get tenant details"""
    # Super admin can access any tenant
    if token_data.permissions and "superuser:access" in token_data.permissions:
        tenant = await TenantService.get_tenant_by_id(db, tenant_id)
    else:
        # Regular users can only access their own tenant
        if token_data.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        tenant = await TenantService.get_tenant_by_id(db, tenant_id)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    return tenant


@router.put("/{tenant_id}", response_model=TenantSchema)
async def update_tenant(
    tenant_id: str,
    update_data: TenantUpdate,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update tenant details"""
    # Only super admin can update tenants
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can update tenants"
        )

    tenant = await TenantService.update_tenant(db, tenant_id, update_data.model_dump(exclude_unset=True))

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    return tenant


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Delete/Deactivate a tenant"""
    # Only super admin can delete tenants
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can delete tenants"
        )

    success = await TenantService.delete_tenant(db, tenant_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    return {"message": "Tenant deactivated successfully"}


@router.get("/{tenant_id}/users")
async def get_tenant_users(
    tenant_id: str,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get all users for a tenant"""
    # Super admin can access any tenant
    if not (token_data.permissions and "superuser:access" in token_data.permissions) and token_data.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get users for this tenant
    query = select(User).where(User.tenant_id == tenant_id).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    return [{
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "role_id": user.role_id
    } for user in users]


@router.put("/{tenant_id}/admin", response_model=dict)
async def update_tenant_admin(
    tenant_id: str,
    admin_data: dict,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update tenant admin credentials"""
    # Only super admin can update tenant admin
    if not token_data.permissions or "superuser:access" not in token_data.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can update tenant admin"
        )

    # Verify tenant exists
    tenant = await TenantService.get_tenant_by_id(db, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    if not tenant.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant has no admin assigned"
        )

    try:
        # Update admin user
        update_data = {}
        if "email" in admin_data:
            update_data["email"] = admin_data["email"].lower()
        if "password" in admin_data:
            update_data["password_hash"] = get_password_hash(admin_data["password"])
        if "first_name" in admin_data:
            update_data["first_name"] = admin_data["first_name"]
        if "last_name" in admin_data:
            update_data["last_name"] = admin_data["last_name"]

        if update_data:
            update_data["updated_at"] = datetime.now(timezone.utc)
            query = update(User).where(User.id == tenant.admin_id).values(**update_data)
            await db.execute(query)
            await db.commit()

        # Get updated admin info
        admin_query = select(User).where(User.id == tenant.admin_id)
        admin_result = await db.execute(admin_query)
        admin = admin_result.scalar_one_or_none()

        return {
            "message": "Admin updated successfully",
            "admin": {
                "id": admin.id,
                "email": admin.email,
                "first_name": admin.first_name,
                "last_name": admin.last_name,
                "updated_at": admin.updated_at
            }
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update admin: {str(e)}"
        )
