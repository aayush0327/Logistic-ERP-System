"""Resources API endpoints - integration with Company service for branches, products, and customers"""

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, Request, Depends
from httpx import AsyncClient
import logging

# Import schemas from company service
from src.schemas import Branch, Product, Customer
from src.security import (
    TokenData,
    require_any_permission,
    get_current_tenant_id
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Company service URL
COMPANY_SERVICE_URL = "http://company-service:8002"


@router.get("/branches", response_model=List[dict])
async def get_branches(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "orders:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get all active branches from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        try:
            # Call Company service branches endpoint
            response = await client.get(
                f"{COMPANY_SERVICE_URL}/branches/",
                params={
                    "is_active": True,
                    "per_page": 100,
                    "tenant_id": tenant_id
                },
                headers=headers
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch branches from Company service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch branches from Company service"
                )

            data = response.json()
            return data.get("items", [])
        except Exception as e:
            logger.error(f"Error fetching branches: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error while fetching branches")


@router.get("/products", response_model=List[dict])
async def get_products(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "orders:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    is_active: Optional[bool] = Query(True, description="Filter active products only"),
    include_branches: Optional[bool] = Query(False, description="Include branch relationships")
):
    """Get all products from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        try:
            params = {
                "is_active": is_active,
                "per_page": 100,  # Maximum allowed by company service
                "tenant_id": tenant_id
            }

            if branch_id:
                params["branch_id"] = branch_id

            # Call Company service products endpoint
            response = await client.get(
                f"{COMPANY_SERVICE_URL}/products/",
                params=params,
                headers=headers
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch products from Company service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch products from Company service"
                )

            data = response.json()
            products = data.get("items", [])

            # Transform products to include availability info
            transformed_products = []
            for product in products:
                transformed_product = {
                    "id": str(product["id"]),
                    "code": product["code"],
                    "name": product["name"],
                    "category_id": product.get("category_id"),
                    "category": product.get("category"),
                    "unit_price": product["unit_price"],
                    "special_price": product.get("special_price"),
                    "weight": product.get("weight", 0),
                    "current_stock": product.get("current_stock", 0),
                    "is_active": product["is_active"],
                    "available_for_all_branches": product.get("available_for_all_branches", True),
                    "branches": product.get("branches", [])
                }
                transformed_products.append(transformed_product)

            return transformed_products
        except Exception as e:
            logger.error(f"Error fetching products: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error while fetching products")


@router.get("/customers", response_model=List[dict])
async def get_customers(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "orders:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    branch_id: Optional[str] = Query(None, description="Filter by home branch ID"),
    is_active: Optional[bool] = Query(True, description="Filter active customers only"),
    search: Optional[str] = Query(None, description="Search customers by name or email")
):
    """Get all customers from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        try:
            params = {
                "is_active": is_active,
                "per_page": 100,  # Maximum allowed by company service
                "tenant_id": tenant_id
            }

            if branch_id:
                params["home_branch_id"] = branch_id

            if search:
                params["search"] = search

            # Call Company service customers endpoint
            response = await client.get(
                f"{COMPANY_SERVICE_URL}/customers/",
                params=params,
                headers=headers
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch customers from Company service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch customers from Company service"
                )

            data = response.json()
            return data.get("items", [])
        except Exception as e:
            logger.error(f"Error fetching customers: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error while fetching customers")


@router.get("/products/by-category")
async def get_products_by_category(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "orders:read"])
    ),
    tenant_id: str = Depends(get_current_tenant_id),
    category_id: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None)
):
    """Get products grouped by category for dropdown with sections"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        try:
            params = {
                "is_active": True,
                "per_page": 100,
                "tenant_id": tenant_id,
                "include_category": True
            }

            if branch_id:
                params["branch_id"] = branch_id
            if category_id:
                params["category_id"] = category_id

            response = await client.get(
                f"{COMPANY_SERVICE_URL}/products/",
                params=params,
                headers=headers
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch products from Company service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch products from Company service"
                )

            data = response.json()
            products = data.get("items", [])

            # Group products by category
            categories = {}
            for product in products:
                category_name = "Uncategorized"
                if product.get("category"):
                    category_name = product["category"]["name"]

                if category_name not in categories:
                    categories[category_name] = []

                categories[category_name].append({
                    "id": str(product["id"]),
                    "code": product["code"],
                    "name": product["name"],
                    "unit_price": product["unit_price"],
                    "special_price": product.get("special_price"),
                    "weight": product.get("weight", 0),
                    "current_stock": product.get("current_stock", 0),
                    "available_for_all_branches": product.get("available_for_all_branches", True)
                })

            return categories
        except Exception as e:
            logger.error(f"Error fetching products by category: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error while fetching products")