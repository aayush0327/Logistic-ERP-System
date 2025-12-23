"""
Product category management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, ProductCategory
from src.schemas import (
    ProductCategory as ProductCategorySchema,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    get_current_user_id,
    require_permissions,
    require_any_permission
)

router = APIRouter()


def safe_validate_category(category):
    """
    Safely validate a category without causing recursion errors
    """
    try:
        return ProductCategorySchema.model_validate(category)
    except Exception:
        # If validation fails due to recursion, convert to dict first
        def category_to_dict(cat, include_children=True):
            category_dict = {
                "id": cat.id,
                "tenant_id": cat.tenant_id,
                "name": cat.name,
                "description": cat.description,
                "parent_id": cat.parent_id,
                "is_active": cat.is_active,
                "created_at": cat.created_at,
                "updated_at": cat.updated_at,
                "parent": cat.parent if cat.parent and not include_children else None,
                "children": []
            }

            if include_children and hasattr(cat, 'children') and cat.children:
                category_dict["children"] = [
                    category_to_dict(child, include_children=False)
                    for child in cat.children
                ]

            return category_dict

        return ProductCategorySchema.model_validate(category_to_dict(category))




@router.get("/", response_model=PaginatedResponse)
async def list_product_categories(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    parent_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    include_children: bool = Query(True),
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all product categories for the current tenant

    Requires:
    - products:read_all (to view all product categories) OR
    - products:read (to view basic product category info)
    """

    # Build query
    query = select(ProductCategory).where(ProductCategory.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            ProductCategory.name.ilike(f"%{search}%") |
            ProductCategory.description.ilike(f"%{search}%")
        )

    if parent_id is not None:
        if parent_id:
            query = query.where(ProductCategory.parent_id == parent_id)
        else:
            # Get root categories (no parent)
            query = query.where(ProductCategory.parent_id.is_(None))

    if is_active is not None:
        query = query.where(ProductCategory.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(ProductCategory.name)

    # Include relationships
    if include_children:
        query = query.options(
            selectinload(ProductCategory.children),
            selectinload(ProductCategory.parent)
        )

    # Execute query
    result = await db.execute(query)
    categories = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    # Safely validate categories to avoid recursion errors
    items = [safe_validate_category(category) for category in categories]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/tree", response_model=List[ProductCategorySchema])
async def get_category_tree(
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product categories as a tree structure

    Requires:
    - products:read_all (to view all product category trees) OR
    - products:read (to view basic product category tree)
    """

    # Get all active categories
    query = select(ProductCategory).where(
        ProductCategory.tenant_id == tenant_id,
        ProductCategory.is_active == True
    ).options(
        selectinload(ProductCategory.children)
    ).order_by(ProductCategory.name)

    result = await db.execute(query)
    all_categories = result.scalars().all()

    # Build tree structure
    root_categories = []
    category_dict = {cat.id: cat for cat in all_categories}

    for category in all_categories:
        if category.parent_id is None:
            root_categories.append(category)
        else:
            parent = category_dict.get(category.parent_id)
            if parent:
                if not hasattr(parent, '_children'):
                    parent._children = []
                parent._children.append(category)

    return [safe_validate_category(cat) for cat in root_categories]


@router.get("/{category_id}", response_model=ProductCategorySchema)
async def get_product_category(
    category_id: UUID,
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific product category by ID

    Requires:
    - products:read_all (to view any product category) OR
    - products:read (to view basic product category info)
    """

    # Get category with relationships
    query = select(ProductCategory).where(
        ProductCategory.id == category_id,
        ProductCategory.tenant_id == tenant_id
    ).options(
        selectinload(ProductCategory.parent),
        selectinload(ProductCategory.children)
    )

    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Product category not found")

    return safe_validate_category(category)


@router.post("/", response_model=ProductCategorySchema, status_code=201)
async def create_product_category(
    category_data: ProductCategoryCreate,
    token_data: TokenData = Depends(require_permissions(["products:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product category

    Requires:
    - products:create
    """

    # Check if category name already exists under same parent
    existing_query = select(ProductCategory).where(
        ProductCategory.name == category_data.name,
        ProductCategory.tenant_id == tenant_id,
        ProductCategory.parent_id == category_data.parent_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Category with this name already exists under the specified parent"
        )

    # Validate parent category if provided
    if category_data.parent_id:
        parent_query = select(ProductCategory).where(
            ProductCategory.id == category_data.parent_id,
            ProductCategory.tenant_id == tenant_id
        )
        parent_result = await db.execute(parent_query)
        if not parent_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Invalid parent category"
            )

    # Create new category
    category = ProductCategory(
        tenant_id=tenant_id,
        **category_data.model_dump()
    )

    db.add(category)
    await db.commit()
    await db.refresh(category)

    # Load relationships for response
    await db.refresh(category, ["parent"])

    # Convert to dict and exclude children to avoid lazy loading
    category_dict = {
        "id": category.id,
        "tenant_id": category.tenant_id,
        "name": category.name,
        "description": category.description,
        "parent_id": category.parent_id,
        "is_active": category.is_active,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
        "parent": category.parent,
        "children": []  # Initialize empty children array to avoid lazy loading
    }

    return ProductCategorySchema.model_validate(category_dict)


@router.put("/{category_id}", response_model=ProductCategorySchema)
async def update_product_category(
    category_id: UUID,
    category_data: ProductCategoryUpdate,
    token_data: TokenData = Depends(require_permissions(["products:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a product category

    Requires:
    - products:update
    """

    # Get existing category
    query = select(ProductCategory).where(
        ProductCategory.id == category_id,
        ProductCategory.tenant_id == tenant_id
    )
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Product category not found")

    # Validate parent category if provided and different
    if category_data.parent_id is not None and category_data.parent_id != category.parent_id:
        # Prevent circular reference
        if category_data.parent_id == category_id:
            raise HTTPException(
                status_code=400,
                detail="Category cannot be its own parent"
            )

        # Validate parent exists
        parent_query = select(ProductCategory).where(
            ProductCategory.id == category_data.parent_id,
            ProductCategory.tenant_id == tenant_id
        )
        parent_result = await db.execute(parent_query)
        if not parent_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Invalid parent category"
            )

    # Update category
    update_data = category_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)

    # Load relationships for response
    await db.refresh(category, ["parent", "children"])

    return safe_validate_category(category)


@router.delete("/{category_id}", status_code=204)
async def delete_product_category(
    category_id: UUID,
    token_data: TokenData = Depends(require_permissions(["products:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) a product category

    Requires:
    - products:delete
    """

    # Get existing category
    query = select(ProductCategory).where(
        ProductCategory.id == category_id,
        ProductCategory.tenant_id == tenant_id
    ).options(
        selectinload(ProductCategory.children)
    )
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Product category not found")

    # Check if category has children
    if category.children:
        # Soft delete - deactivate category
        category.is_active = False
        await db.commit()
    else:
        # Hard delete if no children
        await db.delete(category)
        await db.commit()