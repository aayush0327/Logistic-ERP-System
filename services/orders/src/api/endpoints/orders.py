"""
Orders API endpoints
"""
from typing import List, Optional, Dict
from uuid import UUID, uuid4
from datetime import datetime
from httpx import AsyncClient

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, asc, func, cast, String

from src.database import get_db
from src.models.order import Order, OrderStatus
from src.schemas import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderListResponse,
    OrderListPaginatedResponse,
    OrderStatusUpdate,
    FinanceApprovalRequest,
    LogisticsApprovalRequest,
    OrderQueryParams,
    PaginatedResponse,
    OrderStatusHistoryResponse,
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_user_id,
    get_current_tenant_id,
)
import logging
from src.services.order_service import OrderService

logger = logging.getLogger(__name__)

# Company service URL
COMPANY_SERVICE_URL = "http://company-service:8002"


async def fetch_customers_by_ids(customer_ids: List[str], tenant_id: str, headers: dict = None) -> Dict[str, dict]:
    """Fetch customers by IDs from company service"""
    if not customer_ids:
        return {}

    customers_map = {}

    # Company service doesn't have batch get by IDs, so we fetch individually
    async with AsyncClient(timeout=30.0) as client:
        for customer_id in customer_ids:
            try:
                response = await client.get(
                    f"{COMPANY_SERVICE_URL}/customers/{customer_id}",
                    params={"tenant_id": tenant_id},
                    headers=headers or {}
                )

                if response.status_code == 200:
                    customer_data = response.json()
                    customers_map[customer_id] = customer_data
                else:
                    logger.error(f"Failed to fetch customer {customer_id}: {response.status_code}")
            except Exception as e:
                logger.error(f"Error fetching customer {customer_id}: {str(e)}")

    return customers_map


router = APIRouter()


@router.get("/", response_model=OrderListPaginatedResponse)
async def list_orders(
    request: Request,
    status: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    order_type: Optional[str] = Query(None, description="Filter by order type"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    payment_type: Optional[str] = Query(None, description="Filter by payment type"),
    date_from: Optional[datetime] = Query(None, description="Filter by date from"),
    date_to: Optional[datetime] = Query(None, description="Filter by date to"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Page size"),
    page_size: int = Query(None, description="Page size (deprecated, use per_page)"),
    sort_by: str = Query("created_at", regex="^(created_at|updated_at|order_number|total_amount)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """List orders with filtering and pagination"""
    # Log incoming request details
    logger.info(f"ORDERS SERVICE - Incoming request: user_id={token_data.user_id}, role={token_data.role}, tenant={tenant_id}")
    logger.info(f"ORDERS SERVICE - Request params: status={status}, branch_id={branch_id}, page={page}, per_page={per_page}")

    # Get authorization header from the request and forward it
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header
        logger.info(f"ORDERS SERVICE - Auth header present, will forward to company service")
    else:
        logger.warning(f"ORDERS SERVICE - No auth header found!")

    order_service = OrderService(db, auth_headers, tenant_id)

    # Build filters
    filters = [Order.tenant_id == tenant_id, Order.is_active == True]

    # Check if user is Admin - if not, filter by assigned branches
    is_admin = token_data.role == "Admin"
    logger.info(f"Orders access check - user_id: {token_data.user_id}, role: {token_data.role}, is_admin: {is_admin}")

    if not is_admin:
        # Fetch assigned branches for non-admin users
        logger.info(f"ORDERS SERVICE - Non-admin user detected, fetching assigned branches from company service")
        try:
            async with AsyncClient(timeout=30.0) as client:
                branches_response = await client.get(
                    f"{COMPANY_SERVICE_URL}/branches/my/assigned",
                    params={
                        "is_active": True,
                        "per_page": 100,
                        "tenant_id": tenant_id
                    },
                    headers=auth_headers
                )
                logger.info(f"ORDERS SERVICE - Company service branches response status: {branches_response.status_code}")

                if branches_response.status_code == 200:
                    branches_data = branches_response.json()
                    assigned_branch_ids = [branch["id"] for branch in branches_data.get("items", [])]
                    logger.info(f"ORDERS SERVICE - Assigned branches for user {token_data.user_id}: {assigned_branch_ids}")

                    if assigned_branch_ids:
                        # Filter orders by assigned branches
                        filters.append(Order.branch_id.in_(assigned_branch_ids))
                        logger.info(f"ORDERS SERVICE - Filtering orders by assigned branches: {assigned_branch_ids}")
                    else:
                        # No assigned branches - return empty result
                        logger.warning(f"ORDERS SERVICE - No assigned branches found for user {token_data.user_id}")
                        return OrderListPaginatedResponse(
                            items=[],
                            total=0,
                            page=page,
                            per_page=per_page or 20,
                            pages=0
                        )
                else:
                    logger.error(f"ORDERS SERVICE - Failed to fetch assigned branches: {branches_response.status_code}, response: {branches_response.text}")
        except Exception as e:
            logger.error(f"ORDERS SERVICE - Error fetching assigned branches: {str(e)}", exc_info=True)

    if status:
        filters.append(Order.status == status.value)
    if customer_id:
        filters.append(Order.customer_id == customer_id)
    if branch_id:
        filters.append(Order.branch_id == branch_id)
    if order_type:
        filters.append(Order.order_type == order_type)
    if priority:
        filters.append(Order.priority == priority)
    if payment_type:
        filters.append(Order.payment_type == payment_type)
    if date_from:
        filters.append(Order.created_at >= date_from)
    if date_to:
        filters.append(Order.created_at <= date_to)

    # Build sort order
    sort_column = getattr(Order, sort_by)
    if sort_order == "desc":
        order_by = desc(sort_column)
    else:
        order_by = asc(sort_column)

    # Use per_page parameter, fallback to page_size for backward compatibility
    limit = per_page or page_size or 20

    # Get orders
    orders, total = await order_service.get_orders_paginated(
        filters=filters,
        order_by=order_by,
        page=page,
        page_size=limit
    )

    # Log query results for debugging
    logger.info(f"ORDERS SERVICE - Query returned {len(orders)} orders (total: {total})")
    for order in orders:
        logger.info(f"ORDERS SERVICE - Order: {order.order_number}, Branch: {order.branch_id}, Status: {order.status}")

    # Calculate total pages
    pages = (total + limit - 1) // limit

    # Prepare enriched orders with customer data and items count
    enriched_orders = []

    # Get unique customer IDs from orders
    customer_ids = list(set([order.customer_id for order in orders]))

    # Get unique product IDs from order items
    product_ids = set()
    for order in orders:
        if hasattr(order, 'items') and order.items:
            for item in order.items:
                product_ids.add(item.product_id)

    # Fetch customer data in batch
    customers_data = {}
    if customer_ids:
        try:
            customers_data = await fetch_customers_by_ids(customer_ids, tenant_id, auth_headers)
        except Exception as e:
            logger.error(f"Failed to fetch customers: {e}")

    # Fetch product data in batch
    products_data = {}
    if product_ids:
        try:
            order_service = OrderService(db, auth_headers, tenant_id)
            for product_id in product_ids:
                product = await order_service._fetch_product_details(product_id)
                products_data[product_id] = product
        except Exception as e:
            logger.error(f"Failed to fetch products: {e}")

    # Enrich each order with customer data and items details
    for order in orders:
        # Prepare items data
        items_data = []
        if hasattr(order, 'items') and order.items:
            for item in order.items:
                # Get real product data if available, otherwise fall back to stored data
                product_data = products_data.get(item.product_id, {})

                item_dict = {
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': product_data.get('name', item.product_name),
                    'product_code': product_data.get('code', item.product_code),
                    'description': product_data.get('description', item.description),
                    'quantity': item.quantity,
                    'unit': product_data.get('unit', item.unit),
                    'unit_price': float(product_data.get('unit_price', item.unit_price)) if product_data.get('unit_price') or item.unit_price else None,
                    'total_price': float(item.total_price) if item.total_price else None,
                    'weight': float(product_data.get('weight', item.weight)) if product_data.get('weight') or item.weight else None,
                    'total_weight': float(product_data.get('weight', item.weight) * item.quantity) if (product_data.get('weight') or item.weight) and item.quantity else None,
                    'volume': float(product_data.get('volume', item.volume)) if product_data.get('volume') or item.volume else None,
                }
                items_data.append(item_dict)

        order_dict = {
            'id': order.id,
            'order_number': order.order_number,
            'customer_id': order.customer_id,
            'branch_id': order.branch_id,
            'status': order.status,
            'order_type': order.order_type,
            'priority': order.priority,
            'total_amount': float(order.total_amount) if order.total_amount else 0,
            'total_weight': float(order.total_weight) if order.total_weight else 0,
            'total_volume': float(order.total_volume) if order.total_volume else 0,
            'package_count': order.package_count if order.package_count else 0,
            'payment_type': order.payment_type,
            'pickup_date': order.pickup_date,
            'delivery_date': order.delivery_date,
            'created_at': order.created_at,
            'updated_at': order.updated_at,
            'customer': customers_data.get(order.customer_id),
            'items': items_data,
            'items_count': len(items_data)
        }
        enriched_orders.append(OrderListResponse(**order_dict))

    return OrderListPaginatedResponse(
        items=enriched_orders,
        total=total,
        page=page,
        per_page=limit,
        pages=pages
    )


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Get order by ID with customer details"""
    # Get authorization header from the request and forward it
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers, tenant_id)
    order = await order_service.get_order_by_id(str(order_id), tenant_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Fetch customer data
    customer_data = None
    try:
        async with AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMPANY_SERVICE_URL}/customers/{order.customer_id}",
                params={"tenant_id": tenant_id},
                headers=auth_headers
            )
            if response.status_code == 200:
                customer_data = response.json()
    except Exception as e:
        logger.error(f"Error fetching customer {order.customer_id}: {str(e)}")

    # Prepare order data with customer info
    order_dict = {
        'id': order.id,
        'order_number': order.order_number,
        'customer_id': order.customer_id,
        'branch_id': order.branch_id,
        'status': order.status,
        'order_type': order.order_type,
        'priority': order.priority,
        'total_amount': float(order.total_amount) if order.total_amount else 0,
        'payment_type': order.payment_type,
        'pickup_date': order.pickup_date,
        'delivery_date': order.delivery_date,
        'pickup_address': order.pickup_address,
        'pickup_contact_name': order.pickup_contact_name,
        'pickup_contact_phone': order.pickup_contact_phone,
        'delivery_address': order.delivery_address,
        'delivery_contact_name': order.delivery_contact_name,
        'delivery_contact_phone': order.delivery_contact_phone,
        'total_weight': float(order.total_weight) if order.total_weight else 0,
        'total_volume': float(order.total_volume) if order.total_volume else 0,
        'package_count': order.package_count,
        'special_instructions': order.special_instructions,
        'delivery_instructions': order.delivery_instructions,
        'created_by': order.created_by,
        'updated_by': order.updated_by,
        'driver_id': order.driver_id,
        'trip_id': order.trip_id,
        'created_at': order.created_at,
        'updated_at': order.updated_at,
        'finance_approved_at': order.finance_approved_at,
        'finance_approved_by': order.finance_approved_by,
        'logistics_approved_at': order.logistics_approved_at,
        'logistics_approved_by': order.logistics_approved_by,
        'customer': customer_data,
        'items': [],
        'items_count': 0
    }

    # Add items
    if order.items:
        for item in order.items:
            order_dict['items'].append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': item.product_name,
                'product_code': item.product_code,
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit,
                'unit_price': float(item.unit_price) if item.unit_price else 0,
                'total_price': float(item.total_price) if item.total_price else 0,
                'weight': float(item.weight) if item.weight else 0,
                'total_weight': float(item.weight) * item.quantity if item.weight else 0,
                'volume': float(item.volume) if item.volume else 0
            })
        order_dict['items_count'] = len(order.items)

    return order_dict


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:create"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Create a new order"""
    # Get authorization header from the request and forward it
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers, tenant_id)

    # Order service will use the tenant_id from the token
    order = await order_service.create_order(order_data, user_id, tenant_id)

    return order


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["orders:update", "orders:update_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Update an order"""
    order_service = OrderService(db)

    # Check if order exists and belongs to tenant
    existing_order = await order_service.get_order_by_id(str(order_id), tenant_id)
    if not existing_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check if order can be updated (only draft or submitted status)
    if existing_order.status not in [OrderStatus.DRAFT, OrderStatus.SUBMITTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order cannot be updated in current status"
        )

    # Check if user can update this order
    # Disabled - allowing users with update permission to update any order
    # if (not token_data.is_super_user() and
    #     "orders:update_own" in token_data.permissions and
    #         existing_order.created_by != user_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You can only update your own orders"
    #     )

    order = await order_service.update_order(str(order_id), order_data, user_id)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["orders:delete", "orders:delete_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Delete an order (soft delete)"""
    order_service = OrderService(db)

    # Check if order exists and belongs to tenant
    existing_order = await order_service.get_order_by_id(str(order_id), tenant_id)
    if not existing_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check if order can be deleted (only draft status)
    if existing_order.status != OrderStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order cannot be deleted in current status"
        )

    # Check if user can delete this order
    # Disabled - allowing users with delete permission to delete any order
    # if (not token_data.is_super_user() and
    #     "orders:delete_own" in token_data.permissions and
    #         existing_order.created_by != user_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You can only delete your own orders"
    #     )

    await order_service.delete_order(str(order_id))


@router.post("/{order_id}/submit", response_model=OrderResponse)
async def submit_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["orders:update", "orders:update_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Submit order for finance approval"""
    order_service = OrderService(db)

    # Check if order exists and belongs to tenant
    existing_order = await order_service.get_order_by_id(order_id, tenant_id)
    if not existing_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check if user can submit this order
    if (not token_data.is_super_user() and
        "orders:update_own" in token_data.permissions and
            existing_order.created_by != UUID(user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit your own orders"
        )

    order = await order_service.submit_order(order_id, user_id, tenant_id)
    return order


@router.post("/{order_id}/finance-approval", response_model=OrderResponse)
async def finance_approval(
    order_id: str,
    approval_data: FinanceApprovalRequest,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:approve_finance"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Approve or reject order in finance - Requires finance approval permission"""
    order_service = OrderService(db)

    order = await order_service.finance_approval(
        order_id,
        approval_data.approved,
        user_id,
        tenant_id,
        approval_data.reason,
        approval_data.notes,
        approval_data.payment_type
    )
    return order


@router.post("/{order_id}/logistics-approval", response_model=OrderResponse)
async def logistics_approval(
    order_id: str,
    approval_data: LogisticsApprovalRequest,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:approve_logistics"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Approve or reject order in logistics - Requires logistics approval permission"""
    order_service = OrderService(db)

    order = await order_service.logistics_approval(
        order_id,
        approval_data.approved,
        user_id,
        tenant_id,
        approval_data.reason,
        approval_data.notes,
        approval_data.driver_id,
        approval_data.trip_id
    )
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:status_update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Update order status - Requires status update permission"""
    order_service = OrderService(db)

    order = await order_service.update_order_status(
        str(order_id),
        status_data.status,
        user_id,
        tenant_id,
        status_data.reason,
        status_data.notes
    )
    return order


@router.get("/{order_id}/history", response_model=List[OrderStatusHistoryResponse])
async def get_order_status_history(
    order_id: str,
    db: AsyncSession = Depends(get_db),    token_data: TokenData = Depends(require_permissions(["orders:read"])),

    tenant_id: str = Depends(get_current_tenant_id),
):
    """Get order status history"""
    order_service = OrderService(db)

    # Check if order exists and belongs to tenant
    order = await order_service.get_order_by_id(str(order_id), tenant_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    history = await order_service.get_order_status_history(str(order_id))

    # Convert to response schema
    return [
        OrderStatusHistoryResponse(
            from_status=item.from_status,
            to_status=item.to_status,
            reason=item.reason,
            notes=item.notes,
            created_at=item.created_at
        )
        for item in history
    ]


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:cancel"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Cancel an order - Requires order cancel permission"""
    order_service = OrderService(db)

    order = await order_service.cancel_order(
        str(order_id),
        user_id,
        tenant_id,
        reason
    )
    return order