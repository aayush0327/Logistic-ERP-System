"""
Role management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from ...database import get_db, Role
from ...dependencies import get_current_user_token, TokenData

router = APIRouter()


@router.get("/")
async def get_roles(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all non-system roles for the current tenant.
    Only returns roles where is_system = false.
    Filters by tenant_id to ensure tenant isolation.
    """
    # Build query - filter by is_system = false and tenant_id
    query = select(Role).where(
        Role.is_system == False,
        Role.tenant_id == token_data.tenant_id
    )

    # Order by id for consistent ordering
    query = query.order_by(Role.id)

    result = await db.execute(query)
    roles = result.scalars().all()

    # Return as simple list of dicts to avoid lazy loading issues with relationships
    return [
        {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "tenant_id": role.tenant_id,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        }
        for role in roles
    ]


@router.get("/by-name/{role_name}")
async def get_role_by_name(
    role_name: str,
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get role by name (case-insensitive) for the current tenant.

    Path Parameters:
    - role_name: Role name to search for (case-insensitive)

    Returns:
    - Role object if found
    - 404 if role not found for current tenant
    """
    # Query roles table with tenant filtering and case-insensitive name matching
    query = select(Role).where(
        Role.tenant_id == token_data.tenant_id,
        func.lower(Role.name) == func.lower(role_name)
    )

    result = await db.execute(query)
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=404,
            detail=f"Role '{role_name}' not found for current tenant"
        )

    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "tenant_id": role.tenant_id,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }
