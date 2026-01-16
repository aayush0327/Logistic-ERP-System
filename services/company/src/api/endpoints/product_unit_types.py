"""
Product Unit Type API endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload

from src.database import get_db, ProductUnitType
from src.schemas import (
    ProductUnitTypeCreate,
    ProductUnitTypeUpdate,
    ProductUnitType as ProductUnitTypeSchema
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["product_unit_types"])


@router.get("/")
async def get_unit_types(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all product unit types for the current tenant with pagination and filtering
    """
    # Build query
    query = select(ProductUnitType).where(ProductUnitType.tenant_id == tenant_id)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (ProductUnitType.name.ilike(search_pattern)) |
            (ProductUnitType.code.ilike(search_pattern)) |
            (ProductUnitType.abbreviation.ilike(search_pattern))
        )

    # Apply active filter
    if is_active is not None:
        query = query.where(ProductUnitType.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Apply pagination and ordering
    query = query.order_by(ProductUnitType.name)
    query = query.offset((page - 1) * per_page).limit(per_page)

    # Execute query
    result = await db.execute(query)
    unit_types = result.scalars().all()

    return {
        "items": [ProductUnitTypeSchema.model_validate(ut) for ut in unit_types],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@router.get("/all")
async def get_all_unit_types(
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active product unit types for dropdowns (no pagination)
    """
    query = select(ProductUnitType).where(
        and_(
            ProductUnitType.tenant_id == tenant_id,
            ProductUnitType.is_active == True
        )
    ).order_by(ProductUnitType.name)

    result = await db.execute(query)
    unit_types = result.scalars().all()

    return [ProductUnitTypeSchema.model_validate(ut) for ut in unit_types]


@router.get("/{unit_type_id}")
async def get_unit_type(
    unit_type_id: str,
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific product unit type by ID
    """
    from uuid import UUID
    try:
        unit_type_uuid = UUID(unit_type_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unit type ID")

    query = select(ProductUnitType).where(
        and_(
            ProductUnitType.id == unit_type_uuid,
            ProductUnitType.tenant_id == tenant_id
        )
    )
    result = await db.execute(query)
    unit_type = result.scalar_one_or_none()

    if not unit_type:
        raise HTTPException(status_code=404, detail="Unit type not found")

    return ProductUnitTypeSchema.model_validate(unit_type)


@router.post("/")
async def create_unit_type(
    unit_type_data: ProductUnitTypeCreate,
    token_data: TokenData = Depends(require_permissions(["products:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product unit type
    """
    # Check if unit type code already exists for this tenant
    existing_query = select(ProductUnitType).where(
        and_(
            ProductUnitType.tenant_id == tenant_id,
            ProductUnitType.code == unit_type_data.code
        )
    )
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Unit type with code '{unit_type_data.code}' already exists"
        )

    try:
        new_unit_type = ProductUnitType(
            tenant_id=tenant_id,
            code=unit_type_data.code.upper(),
            name=unit_type_data.name,
            abbreviation=unit_type_data.abbreviation,
            description=unit_type_data.description,
            is_active=unit_type_data.is_active
        )
        db.add(new_unit_type)
        await db.commit()
        await db.refresh(new_unit_type)

        logger.info(f"Created product unit type {new_unit_type.id}: {new_unit_type.code}")
        return ProductUnitTypeSchema.model_validate(new_unit_type)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating unit type: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create unit type: {str(e)}")


@router.put("/{unit_type_id}")
async def update_unit_type(
    unit_type_id: str,
    unit_type_data: ProductUnitTypeUpdate,
    token_data: TokenData = Depends(require_permissions(["products:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing product unit type
    """
    from uuid import UUID
    try:
        unit_type_uuid = UUID(unit_type_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unit type ID")

    # Get existing unit type
    query = select(ProductUnitType).where(
        and_(
            ProductUnitType.id == unit_type_uuid,
            ProductUnitType.tenant_id == tenant_id
        )
    )
    result = await db.execute(query)
    unit_type = result.scalar_one_or_none()

    if not unit_type:
        raise HTTPException(status_code=404, detail="Unit type not found")

    # Check if new code conflicts with existing unit type (excluding current one)
    if unit_type_data.code and unit_type_data.code != unit_type.code:
        existing_query = select(ProductUnitType).where(
            and_(
                ProductUnitType.tenant_id == tenant_id,
                ProductUnitType.code == unit_type_data.code.upper(),
                ProductUnitType.id != unit_type_uuid
            )
        )
        result = await db.execute(existing_query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Unit type with code '{unit_type_data.code}' already exists"
            )

    try:
        # Update fields
        if unit_type_data.code:
            unit_type.code = unit_type_data.code.upper()
        if unit_type_data.name:
            unit_type.name = unit_type_data.name
        if unit_type_data.abbreviation is not None:
            unit_type.abbreviation = unit_type_data.abbreviation
        if unit_type_data.description is not None:
            unit_type.description = unit_type_data.description
        if unit_type_data.is_active is not None:
            unit_type.is_active = unit_type_data.is_active

        await db.commit()
        await db.refresh(unit_type)

        logger.info(f"Updated product unit type {unit_type_id}")
        return ProductUnitTypeSchema.model_validate(unit_type)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating unit type: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update unit type: {str(e)}")


@router.delete("/{unit_type_id}")
async def delete_unit_type(
    unit_type_id: str,
    token_data: TokenData = Depends(require_permissions(["products:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a product unit type (hard delete - removes from database)
    """
    from uuid import UUID
    try:
        unit_type_uuid = UUID(unit_type_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unit type ID")

    # Get existing unit type
    query = select(ProductUnitType).where(
        and_(
            ProductUnitType.id == unit_type_uuid,
            ProductUnitType.tenant_id == tenant_id
        )
    )
    result = await db.execute(query)
    unit_type = result.scalar_one_or_none()

    if not unit_type:
        raise HTTPException(status_code=404, detail="Unit type not found")

    try:
        # Hard delete - remove from database
        await db.delete(unit_type)
        await db.commit()

        logger.info(f"Deleted product unit type {unit_type_id} (hard delete)")
        return {"message": "Unit type deleted successfully"}

    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting unit type: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete unit type: {str(e)}")
