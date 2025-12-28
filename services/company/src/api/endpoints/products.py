"""
Product management endpoints
"""
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db, Product, ProductCategory, Branch, ProductBranch
from src.helpers import validate_category_exists, validate_branch_exists
from src.schemas import (
    Product as ProductSchema,
    ProductCreate,
    ProductUpdate,
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


@router.get("/", response_model=PaginatedResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    branch_id: Optional[UUID] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    is_active: Optional[bool] = Query(None),
    low_stock: bool = Query(False),
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all products for the current tenant

    Requires:
    - products:read_all (to view all products) OR
    - products:read (to view basic product info)
    """

    # Build query
    query = select(Product).where(Product.tenant_id == tenant_id)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.code.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%")
            )
        )

    if category_id:
        query = query.where(Product.category_id == category_id)

    if branch_id:
        # Filter products available for all branches OR specific branch
        from sqlalchemy import or_
        query = query.where(
            or_(
                Product.available_for_all_branches == True,
                Product.id.in_(
                    select(ProductBranch.product_id).where(
                        ProductBranch.branch_id == branch_id,
                        ProductBranch.tenant_id == tenant_id
                    )
                )
            )
        )

    if min_price is not None:
        query = query.where(Product.unit_price >= min_price)

    if max_price is not None:
        query = query.where(Product.unit_price <= max_price)

    if low_stock:
        query = query.where(
            Product.current_stock <= Product.min_stock_level,
            Product.is_active == True
        )

    if is_active is not None:
        query = query.where(Product.is_active == is_active)

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Product.name)

    # Include category relationship with children
    query = query.options(
        selectinload(Product.branches).selectinload(ProductBranch.branch),
        selectinload(Product.category).selectinload(ProductCategory.children)
    )

    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[ProductSchema.model_validate(product) for product in products],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: UUID,
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific product by ID

    Requires:
    - products:read_all (to view any product) OR
    - products:read (to view basic product info)
    """

    # Get product with relationships
    query = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    ).options(
        selectinload(Product.branches).selectinload(ProductBranch.branch), selectinload(Product.category).selectinload(ProductCategory.children)
    )

    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return ProductSchema.model_validate(product)


@router.post("/", response_model=ProductSchema, status_code=201)
async def create_product(
    product_data: ProductCreate,
    token_data: TokenData = Depends(require_permissions(["products:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product

    Requires:
    - products:create
    """

    # Check if product code already exists
    existing_query = select(Product).where(
        Product.code == product_data.code,
        Product.tenant_id == tenant_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Product with this code already exists"
        )

    # Validate category if provided
    if product_data.category_id:
        try:
            await validate_category_exists(db, product_data.category_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Validate branches if product is not available for all branches
    branch_ids = []
    if not product_data.available_for_all_branches:
        if hasattr(product_data, 'branch_ids') and product_data.branch_ids:
            branch_ids = product_data.branch_ids
            # Validate all branches exist and belong to tenant
            for branch_id in branch_ids:
                try:
                    await validate_branch_exists(db, branch_id, tenant_id)
                except ValueError as e:
                    raise HTTPException(
                        status_code=400,
                        detail=str(e)
                    )
        else:
            raise HTTPException(
                status_code=400,
                detail="Branch IDs must be provided when product is not available for all branches"
            )

    # Create new product
    product_data_dict = product_data.model_dump(exclude_unset=True)
    # Remove branch_ids from product data as it's stored in junction table
    product_data_dict.pop('branch_ids', None)

    # Calculate volume if dimensions are provided but volume is not
    if 'volume' not in product_data_dict and all([
        product_data.length,
        product_data.width,
        product_data.height
    ]):
        # Convert cm to m3 (100 cm = 1 m)
        product_data_dict['volume'] = (product_data.length * product_data.width * product_data.height) / 1000000

    # Create new product
    product = Product(
        tenant_id=tenant_id,
        **product_data_dict
    )

    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Create branch relationships if not available for all branches
    if not product_data.available_for_all_branches and branch_ids:
        for branch_id in branch_ids:
            product_branch = ProductBranch(
                product_id=product.id,
                branch_id=branch_id,
                tenant_id=tenant_id
            )
            db.add(product_branch)

        await db.commit()

    # Load the category relationship for response with children
    result = await db.execute(
        select(Product)
        .options(
        selectinload(Product.branches).selectinload(ProductBranch.branch),
        selectinload(Product.category).selectinload(ProductCategory.children)
    )
        .where(Product.id == product.id)
    )
    product = result.scalar_one()

    return ProductSchema.model_validate(product)


@router.put("/{product_id}", response_model=ProductSchema)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    token_data: TokenData = Depends(require_permissions(["products:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a product

    Requires:
    - products:update
    """

    # Get existing product
    query = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate category if provided
    if product_data.category_id:
        try:
            await validate_category_exists(db, product_data.category_id, tenant_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # Validate branch if provided
    if product_data.branch_id:
        branch_query = select(Branch).where(
            Branch.id == product_data.branch_id,
            Branch.tenant_id == tenant_id
        )
        branch_result = await db.execute(branch_query)
        if not branch_result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Invalid branch"
            )

    # Update product
    update_data = product_data.model_dump(exclude_unset=True)

    # Calculate volume if dimensions are provided
    if 'length' in update_data or 'width' in update_data or 'height' in update_data:
        length = update_data.get('length', product.length)
        width = update_data.get('width', product.width)
        height = update_data.get('height', product.height)

        if all([length, width, height]):
            # Convert cm to m3 (100 cm = 1 m)
            update_data['volume'] = (length * width * height) / 1000000

    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)

    # Load the category relationship for response with children
    result = await db.execute(
        select(Product)
        .options(
        selectinload(Product.branches).selectinload(ProductBranch.branch),
        selectinload(Product.category).selectinload(ProductCategory.children)
    )
        .where(Product.id == product.id)
    )
    product = result.scalar_one()

    return ProductSchema.model_validate(product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID,
    token_data: TokenData = Depends(require_permissions(["products:delete"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (hard delete) a product

    Requires:
    - products:delete
    """

    # Get existing product
    query = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Hard delete - remove product from database
    await db.delete(product)
    await db.commit()

    return None


@router.get("/low-stock", response_model=PaginatedResponse)
async def get_low_stock_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get products with low stock levels

    Requires:
    - products:read_all (to view all low stock products) OR
    - products:read (to view basic low stock product info)
    """

    # Build query for low stock products
    query = select(Product).where(
        Product.tenant_id == tenant_id,
        Product.is_active == True,
        Product.current_stock <= Product.min_stock_level
    )

    # Count total items
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page).order_by(Product.name)

    # Include category relationship with children
    query = query.options(
        selectinload(Product.branches).selectinload(ProductBranch.branch),
        selectinload(Product.category).selectinload(ProductCategory.children)
    )

    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()

    # Calculate pages
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[ProductSchema.model_validate(product) for product in products],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.post("/bulk-update", response_model=List[ProductSchema])
async def bulk_update_products(
    updates: List[Dict[str, Any]],
    token_data: TokenData = Depends(require_permissions(["products:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk update products

    Requires:
    - products:update
    """
    updated_products = []

    for update in updates:
        if 'id' not in update:
            continue

        product_id = update['id']
        if isinstance(product_id, str):
            product_id = UUID(product_id)

        # Get existing product
        query = select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        )
        result = await db.execute(query)
        product = result.scalar_one_or_none()

        if not product:
            continue

        # Update product
        update_data = {k: v for k, v in update.items() if k != 'id'}
        for field, value in update_data.items():
            if hasattr(product, field):
                setattr(product, field, value)

        updated_products.append(product)

    # Commit all updates
    await db.commit()

    # Get product IDs
    product_ids = [p.id for p in updated_products]

    # Load all updated products with relationships
    result = await db.execute(
        select(Product)
        .options(
        selectinload(Product.branches).selectinload(ProductBranch.branch),
        selectinload(Product.category).selectinload(ProductCategory.children)
    )
        .where(Product.id.in_(product_ids))
    )
    loaded_products = {p.id: p for p in result.scalars().all()}

    # Return in the same order as the input
    return [ProductSchema.model_validate(loaded_products[p.id]) for p in updated_products]


@router.get("/{product_id}/stock-history")
async def get_stock_history(
    product_id: UUID,
    token_data: TokenData = Depends(require_any_permission(["products:read_all", "products:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get stock movement history for a product
    TODO: Implement stock movement tracking

    Requires:
    - products:read_all (to view any product stock history) OR
    - products:read (to view basic product stock history)
    """

    # Get product
    query = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # TODO: Implement stock movement tracking
    # This would require a StockMovement table to track changes
    return {
        "product_id": str(product_id),
        "current_stock": product.current_stock,
        "min_stock_level": product.min_stock_level,
        "max_stock_level": product.max_stock_level,
        "movements": []  # TODO: Fetch from stock movements table
    }