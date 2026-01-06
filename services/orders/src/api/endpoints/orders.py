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
    TmsOrderStatusUpdate,
    ItemStatusUpdate,
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

    # Fetch trip_item_assignments for ALL orders to get status breakdown
    from src.models.trip_item_assignment import TripItemAssignment
    from src.models.order_item import OrderItem
    order_ids = [order.id for order in orders]

    trip_assignments_query = select(TripItemAssignment).where(
        and_(
            TripItemAssignment.order_id.in_(order_ids),
            TripItemAssignment.tenant_id == tenant_id
        )
    ).order_by(TripItemAssignment.updated_at.desc())

    trip_assignments_result = await db.execute(trip_assignments_query)
    all_trip_assignments = trip_assignments_result.scalars().all()

    # Fetch order_items to get original weight and volume values (critical for correct per-unit calculations)
    order_items_query = select(OrderItem).where(
        OrderItem.order_id.in_(order_ids)
    )
    order_items_result = await db.execute(order_items_query)
    all_order_items = order_items_result.scalars().all()

    # Create a map of order_item_id -> original weight per unit (from database)
    original_weight_by_item_id = {item.id: float(item.weight) if item.weight else 0 for item in all_order_items}
    # Create a map of order_item_id -> original volume per unit (from database)
    original_volume_by_item_id = {item.id: float(item.volume) if item.volume else 0 for item in all_order_items}
    # Create a map of order_item_id -> original quantity (from database)
    # This is the TRUE original quantity before any splits/assignments
    original_quantity_by_item_id = {item.id: item.quantity for item in all_order_items}

    # Group assignments by order_item_id for quick lookup
    assignments_by_item = {}
    seen_trip_item_pairs = set()

    for assignment in all_trip_assignments:
        item_id = assignment.order_item_id
        trip_id = assignment.trip_id
        pair_key = (item_id, trip_id)

        # Only keep the latest status for each (item, trip) pair
        if pair_key not in seen_trip_item_pairs:
            seen_trip_item_pairs.add(pair_key)

            if item_id not in assignments_by_item:
                assignments_by_item[item_id] = []

            assignments_by_item[item_id].append({
                "trip_id": assignment.trip_id,
                "assigned_quantity": assignment.assigned_quantity,
                "item_status": assignment.item_status,
                "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                "updated_at": assignment.updated_at.isoformat() if assignment.updated_at else None
            })

    logger.info(f"Fetched {len(all_trip_assignments)} trip assignments for {len(order_ids)} orders")

    # Enrich each order with customer data and items details
    for order in orders:
        # Prepare items data - handle split orders with remaining items
        items_data = []

        # Check if this is a partial order with split items
        # This includes orders with tms_order_status "partial" OR "fully_assigned" when items_json has data
        # Because items_json contains the split item data (even when fully assigned)
        # EXCLUDE: Delivered orders should show complete order from order_items, not items_json
        is_partial_order = (
            hasattr(order, 'tms_order_status') and
            order.tms_order_status in ("partial", "fully_assigned") and
            hasattr(order, 'items_json') and
            order.items_json is not None and
            len(order.items_json) > 0 and
            order.status not in ("delivered", "partial_delivered")  # Delivered orders show complete data
        )

        if is_partial_order:
            # For partial orders, we need to merge BOTH items_json (assigned) AND remaining_items_json (remaining)
            logger.info(f"Order {order.order_number} is partial with remaining items")

            # Use a dictionary to merge items by ID (in case same item appears in both)
            items_dict_by_id = {}

            # Process assigned items from items_json
            if hasattr(order, 'items_json') and order.items_json:
                for item in order.items_json:
                    item_id = item.get('id')
                    # Get assignments from trip_item_assignments for this item
                    item_assignments = assignments_by_item.get(item_id, [])
                    assigned_qty = sum(a["assigned_quantity"] for a in item_assignments)

                    # For items in items_json, the quantity is the ASSIGNED quantity
                    assigned_qty_from_json = item.get('quantity', 0)

                    # CRITICAL: Use the TRUE original quantity from the database, not from items_json
                    # items_json.original_quantity is the quantity of the assigned portion (10)
                    # But we need the FULL original quantity from order_items (30)
                    original_qty = original_quantity_by_item_id.get(item_id, item.get('original_quantity') or assigned_qty_from_json)
                    remaining_qty = original_qty - assigned_qty  # Calculate remaining from original

                    # CRITICAL FIX: Use original weight from order_items table in database
                    # This ensures weight per unit is always correct
                    if item_id in original_weight_by_item_id:
                        # Use the original weight per unit from the database
                        weight_per_unit = original_weight_by_item_id[item_id]
                    elif item.get('original_quantity'):
                        # Fallback: If weight field has original_quantity, treat weight as per-unit
                        weight_per_unit = float(item.get('weight', 0)) if item.get('weight') else 0
                    else:
                        # Last resort: Use the weight field directly (might be per-unit or total)
                        weight_per_unit = float(item.get('weight', 0)) if item.get('weight') else 0

                    # CRITICAL FIX: Use original volume from order_items table in database
                    # This ensures volume per unit is always correct
                    if item_id in original_volume_by_item_id:
                        # Use the original volume per unit from the database
                        volume_per_unit = original_volume_by_item_id[item_id]
                    else:
                        # Fallback: Use the volume field from items_json
                        volume_per_unit = float(item.get('volume', 0)) if item.get('volume') else 0

                    # Calculate total_weight and total_volume based on original_qty (displayed quantity)
                    # NOT based on assigned_qty_from_json, because we display original_qty to the user
                    total_weight = weight_per_unit * original_qty
                    total_volume = volume_per_unit * original_qty

                    # items_json contains the ASSIGNED items
                    item_dict = {
                        'id': item_id,
                        'product_id': item.get('product_id'),
                        'product_name': item.get('product_name'),
                        'product_code': item.get('product_code'),
                        'description': item.get('description'),
                        'original_quantity': original_qty,  # True original quantity from database
                        'assigned_quantity': assigned_qty,  # Sum of all trip assignments
                        'remaining_quantity': remaining_qty,  # Calculated from original - assigned
                        'quantity': original_qty,  # Display original quantity
                        'unit': item.get('unit'),
                        'unit_price': float(item.get('unit_price')) if item.get('unit_price') else None,
                        'total_price': float(item.get('total_price')) if item.get('total_price') else None,
                        'weight': weight_per_unit,  # Weight per unit from database
                        'weight_type': item.get('weight_type', 'fixed'),
                        'fixed_weight': float(item.get('fixed_weight', 0)) if item.get('fixed_weight') else None,
                        'weight_unit': item.get('weight_unit', 'kg'),
                        'total_weight': total_weight,  # Total weight for displayed quantity (original_qty)
                        'volume': volume_per_unit,  # Volume per unit from database
                        'assignments': item_assignments,  # Include trip assignments with status breakdown
                    }
                    items_dict_by_id[item_id] = item_dict

            # Process remaining items from remaining_items_json
            for item in order.remaining_items_json:
                item_id = item.get('id')

                # If this item was already in items_json, merge/combine the data
                if item_id in items_dict_by_id:
                    # Item exists in both - this means it was partially assigned
                    existing_item = items_dict_by_id[item_id]
                    # Add the remaining quantity to the existing item
                    existing_item['remaining_quantity'] = item.get('quantity')
                    # The assigned quantity is already calculated from trip_item_assignments
                    continue

                # Get assignments from trip_item_assignments for this item
                item_assignments = assignments_by_item.get(item_id, [])
                assigned_qty = sum(a["assigned_quantity"] for a in item_assignments)

                # CRITICAL: Use the TRUE original quantity from the database, not from remaining_items_json
                original_qty = original_quantity_by_item_id.get(item_id, item.get('original_quantity') or (item.get('quantity') + assigned_qty))
                remaining_qty = item.get('quantity')  # This is the current remaining quantity

                # CRITICAL FIX: Use original weight from order_items table in database
                # This prevents weight per unit corruption (e.g., 200 kg becoming 66.67 kg)
                # The remaining_items_json may have incorrect weight due to partial assignments
                if item_id in original_weight_by_item_id:
                    # Use the original weight per unit from the database
                    weight_per_unit = original_weight_by_item_id[item_id]
                    total_weight_for_original = weight_per_unit * original_qty
                elif item.get('original_quantity'):
                    # Fallback: If weight field has original_quantity, treat weight as per-unit
                    weight_per_unit = float(item.get('weight', 0)) if item.get('weight') else 0
                    total_weight_for_original = weight_per_unit * original_qty
                else:
                    # Last resort: Calculate from total weight (old format)
                    total_weight_for_remaining = float(item.get('weight', 0)) if item.get('weight') else 0
                    weight_per_unit = total_weight_for_remaining / remaining_qty if remaining_qty > 0 else 0
                    total_weight_for_original = weight_per_unit * original_qty

                # CRITICAL FIX: Use original volume from order_items table in database
                # This prevents volume per unit corruption
                if item_id in original_volume_by_item_id:
                    # Use the original volume per unit from the database
                    volume_per_unit = original_volume_by_item_id[item_id]
                    total_volume_for_original = volume_per_unit * original_qty
                else:
                    # Fallback: Use the volume field from remaining_items_json
                    volume_per_unit = float(item.get('volume', 0)) if item.get('volume') else 0
                    total_volume_for_original = volume_per_unit * original_qty

                # remaining_items_json contains stored item data directly
                item_dict = {
                    'id': item_id,
                    'product_id': item.get('product_id'),
                    'product_name': item.get('product_name'),
                    'product_code': item.get('product_code'),
                    'description': item.get('description'),
                    'original_quantity': original_qty,  # True original quantity from database
                    'assigned_quantity': assigned_qty,  # Sum of all trip assignments
                    'remaining_quantity': remaining_qty,  # Current remaining
                    'quantity': original_qty,  # Display original quantity
                    'unit': item.get('unit'),
                    'unit_price': float(item.get('unit_price')) if item.get('unit_price') else None,
                    'total_price': float(item.get('total_price')) if item.get('total_price') else None,
                    'weight': weight_per_unit,  # Weight per unit
                    'weight_type': item.get('weight_type', 'fixed'),
                    'fixed_weight': float(item.get('fixed_weight', 0)) if item.get('fixed_weight') else None,
                    'weight_unit': item.get('weight_unit', 'kg'),
                    'total_weight': total_weight_for_original,  # Total weight for original quantity
                    'volume': volume_per_unit,  # Volume per unit from database
                    'assignments': item_assignments,  # Include trip assignments with status breakdown
                }
                items_dict_by_id[item_id] = item_dict

            # Convert dictionary to list
            items_data = list(items_dict_by_id.values())
        elif hasattr(order, 'items') and order.items:
            # For non-partial orders, use the original items from the relationship
            for item in order.items:
                # Get real product data if available, otherwise fall back to stored data
                product_data = products_data.get(item.product_id, {})

                # Get assignments from trip_item_assignments for this item
                item_assignments = assignments_by_item.get(item.id, [])

                # Split assignments by status - only count active assignments (planning/loading/on_route)
                assigned_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] in ('planning', 'loading', 'on_route'))
                delivered_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] == 'delivered')

                item_dict = {
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': product_data.get('name', item.product_name),
                    'product_code': product_data.get('code', item.product_code),
                    'description': product_data.get('description', item.description),
                    'original_quantity': item.quantity,  # Original quantity
                    'assigned_quantity': assigned_qty,  # Active assignments (planning/loading/on_route)
                    'delivered_quantity': delivered_qty,  # Completed deliveries
                    'remaining_quantity': item.quantity - assigned_qty - delivered_qty,  # Remaining after assignments and deliveries
                    'quantity': item.quantity,
                    'unit': product_data.get('unit', item.unit),
                    'unit_price': float(product_data.get('unit_price', item.unit_price)) if product_data.get('unit_price') or item.unit_price else None,
                    'total_price': float(item.total_price) if item.total_price else None,
                    'weight': float(item.weight) if item.weight else None,  # Use the actual weight stored in order item
                    'weight_type': product_data.get('weight_type', 'fixed'),  # Include product weight type
                    'fixed_weight': float(product_data.get('fixed_weight', product_data.get('weight', 0))) if product_data.get('fixed_weight') or product_data.get('weight') else None,  # Fixed weight from product
                    'weight_unit': product_data.get('weight_unit', 'kg'),  # Weight unit
                    'total_weight': float(item.weight * item.quantity) if item.weight and item.quantity else None,
                    'volume': float(product_data.get('volume', item.volume)) if product_data.get('volume') or item.volume else None,
                    'assignments': item_assignments,  # Include trip assignments with status breakdown
                }
                items_data.append(item_dict)

        # Calculate actual weight and volume based on returned items
        # Use total_weight if available (for items with quantities), otherwise use weight
        calculated_weight = sum(
            (item.get('total_weight') or (item.get('weight', 0) or 0)) for item in items_data
        )
        calculated_volume = sum(item.get('volume', 0) or 0 for item in items_data)
        calculated_total = sum(item.get('total_price', 0) or 0 for item in items_data)

        if is_partial_order:
            logger.info(f"Order {order.order_number} partial order - calculated_weight: {calculated_weight}, items: {len(items_data)}")

        order_dict = {
            'id': order.id,
            'order_number': order.order_number,
            'customer_id': order.customer_id,
            'branch_id': order.branch_id,
            'status': order.status,
            'order_type': order.order_type,
            'priority': order.priority,
            'tms_order_status': getattr(order, 'tms_order_status', 'available'),
            'total_amount': float(order.total_amount) if order.total_amount else calculated_total,
            # For partial orders, use calculated weight from remaining items
            'total_weight': calculated_weight if is_partial_order else (float(order.total_weight) if order.total_weight else 0),
            'total_volume': calculated_volume if is_partial_order else (float(order.total_volume) if order.total_volume else 0),
            'package_count': len(items_data) if is_partial_order else (order.package_count if order.package_count else 0),
            'payment_type': order.payment_type,
            'pickup_date': order.pickup_date,
            'delivery_date': order.delivery_date,
            'created_at': order.created_at,
            'updated_at': order.updated_at,
            'customer': customers_data.get(order.customer_id),
            'items': items_data,
            # For items_count, use sum of original_quantity for partial orders (shows full original quantity), otherwise count items
            'items_count': sum(item.get('original_quantity', item.get('quantity', 0)) for item in items_data) if is_partial_order else len(items_data),
            # Include TMS JSON fields for reference
            'items_json': getattr(order, 'items_json', None),
            'remaining_items_json': getattr(order, 'remaining_items_json', None),
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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["orders:update", "orders:update_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Update an order"""
    # Get auth headers for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers=auth_headers, tenant_id=tenant_id)

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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["orders:update", "orders:update_own"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Submit order for finance approval"""
    # Get auth headers for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers=auth_headers)

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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:approve_finance"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Approve or reject order in finance - Requires finance approval permission"""
    # Get auth headers for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers=auth_headers)

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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:approve_logistics"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Approve or reject order in logistics - Requires logistics approval permission"""
    # Get auth headers for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers=auth_headers)

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


@router.patch("/tms-status", response_model=OrderResponse)
async def update_tms_order_status(
    status_data: TmsOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Update TMS order status - Called by TMS service when orders are assigned"""
    from sqlalchemy import update
    from src.models.order_item import OrderItem

    # Find order by order_id (not UUID)
    order_query = select(Order).where(
        and_(
            Order.order_number == status_data.order_id,
            Order.tenant_id == tenant_id
        )
    )
    result = await db.execute(order_query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with number {status_data.order_id} not found"
        )

    # Update TMS order status
    order.tms_order_status = status_data.tms_order_status

    # Debug logging
    logger.info(
        f"Received TMS status update: order_id={status_data.order_id}, "
        f"tms_status={status_data.tms_order_status}, "
        f"items_json provided={status_data.items_json is not None}, "
        f"items_json count={len(status_data.items_json) if status_data.items_json is not None else 'N/A'}, "
        f"remaining_items_json provided={status_data.remaining_items_json is not None}, "
        f"remaining_items_json count={len(status_data.remaining_items_json) if status_data.remaining_items_json is not None else 'N/A'}"
    )

    # Update items_json and remaining_items_json if provided
    # NOTE: For split/partial orders, TMS is the source of truth. We store what TMS sends us.
    # The TMS service calculates remaining_items_json based on all trip_orders for this order.

    # CRITICAL: Clean the JSON data before storing to remove computed fields like remaining_quantity, assigned_quantity
    # These fields should NOT be stored in the database as they are calculated dynamically
    def clean_item_json(item_data):
        """Remove computed fields from item JSON before storing in database"""
        fields_to_remove = ['remaining_quantity', 'assigned_quantity', 'delivered_quantity',
                           'is_fully_assigned', 'is_partially_assigned', 'is_available', 'assignments']
        return {k: v for k, v in item_data.items() if k not in fields_to_remove}

    if status_data.items_json is not None:
        # Clean items_json before storing
        order.items_json = [clean_item_json(item) for item in status_data.items_json]

    if status_data.remaining_items_json is not None:
        # Clean remaining_items_json before storing
        order.remaining_items_json = [clean_item_json(item) for item in status_data.remaining_items_json]

    # If items_json is provided but remaining_items_json is not, recalculate it
    # This happens when TMS sends a simplified update
    if status_data.items_json is not None and status_data.remaining_items_json is None:
        # Get all items for this order
        items_query = select(OrderItem).where(OrderItem.order_id == order.id)
        items_result = await db.execute(items_query)
        all_items = items_result.scalars().all()

        # Build a set of assigned item IDs
        assigned_item_ids = set()
        if order.items_json:
            for assigned_item in order.items_json:
                if assigned_item.get("id"):
                    assigned_item_ids.add(assigned_item["id"])

        # Calculate remaining items (items not in items_json)
        remaining_items = []
        for item in all_items:
            if item.id not in assigned_item_ids:
                # This item is not assigned - add to remaining
                remaining_item = {
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "product_code": item.product_code,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "unit_price": float(item.unit_price) if item.unit_price else None,
                    "total_price": float(item.total_price) if item.total_price else None,
                    "weight": float(item.weight) if item.weight else None,
                    "volume": float(item.volume) if item.volume else None,
                    "dimensions_length": float(item.dimensions_length) if item.dimensions_length else None,
                    "dimensions_width": float(item.dimensions_width) if item.dimensions_width else None,
                    "dimensions_height": float(item.dimensions_height) if item.dimensions_height else None,
                }
                remaining_items.append(remaining_item)

        order.remaining_items_json = remaining_items if remaining_items else []

        logger.info(
            f"Recalculated remaining items for order {status_data.order_id}: "
            f"{len(assigned_item_ids)} assigned, {len(remaining_items)} remaining"
        )

    db.add(order)

    await db.commit()
    await db.refresh(order)

    return order


@router.post("/item-status", response_model=dict)
async def update_item_status(
    status_data: ItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:update"])),
):
    """
    Update item status in trip_item_assignments table when trip status changes (called by TMS service)

    Only updates trip_item_assignments table - does NOT modify order_items table.
    The order_items table maintains assignment-based status (not assigned/partial/fully assigned).

    Note: status_data.order_id is the order_number (e.g., ORD-2026...), not the UUID
    We need to first look up the order UUID from the order_number

    For split/partial assignments, we update the specific items assigned to this trip.
    The TMS trip_orders.items_json is the source of truth for which items are assigned.
    """
    from src.models.order_item import OrderItem
    from src.models.trip_item_assignment import TripItemAssignment
    import json
    import uuid

    logger.info(f"Updating item status for order {status_data.order_id} to {status_data.item_status}, trip_id: {status_data.trip_id}")

    # First, find the order by order_number to get the UUID
    order_query = select(Order).where(Order.order_number == status_data.order_id)
    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        logger.warning(f"Order not found with order_number {status_data.order_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with number {status_data.order_id} not found"
        )

    # FIRST: Update trip_item_assignments table for items assigned to this trip
    trip_assignments_updated = 0
    trip_assignments_deleted = 0

    if status_data.remove_from_trip and status_data.trip_id:
        # REMOVAL: Delete trip_item_assignments for items being removed from this trip
        if status_data.item_ids:
            # Delete specific trip_item_assignments
            assignment_query = select(TripItemAssignment).where(
                and_(
                    TripItemAssignment.order_item_id.in_(status_data.item_ids),
                    TripItemAssignment.trip_id == status_data.trip_id
                )
            )
        else:
            # Delete all trip_item_assignments for this trip and order
            assignment_query = select(TripItemAssignment).where(
                and_(
                    TripItemAssignment.order_id == order.id,
                    TripItemAssignment.trip_id == status_data.trip_id
                )
            )

        assignment_result = await db.execute(assignment_query)
        trip_assignments = assignment_result.scalars().all()

        for assignment in trip_assignments:
            await db.delete(assignment)
            trip_assignments_deleted += 1

        logger.info(f"Deleted {trip_assignments_deleted} trip_item_assignments for trip {status_data.trip_id} (removal)")

    elif status_data.trip_id:
        # UPDATE: Update trip_item_assignments for items in this trip (status change)
        if status_data.item_ids:
            # Update specific trip_item_assignments
            assignment_query = select(TripItemAssignment).where(
                and_(
                    TripItemAssignment.order_item_id.in_(status_data.item_ids),
                    TripItemAssignment.trip_id == status_data.trip_id
                )
            )
        else:
            # Update all trip_item_assignments for this trip and order
            assignment_query = select(TripItemAssignment).where(
                and_(
                    TripItemAssignment.order_id == order.id,
                    TripItemAssignment.trip_id == status_data.trip_id
                )
            )

        assignment_result = await db.execute(assignment_query)
        trip_assignments = assignment_result.scalars().all()

        for assignment in trip_assignments:
            assignment.item_status = status_data.item_status
            trip_assignments_updated += 1

        logger.info(f"Updated {trip_assignments_updated} trip_item_assignments for trip {status_data.trip_id}")

    # SECOND: Update order_items table
    # Build the query for updating items using the order UUID
    if status_data.item_ids:
        # Update specific items
        query = select(OrderItem).where(
            and_(
                OrderItem.id.in_(status_data.item_ids),
                OrderItem.order_id == order.id  # Use order.id (UUID) not order_number
            )
        )
    else:
        # Update all items in the order
        query = select(OrderItem).where(OrderItem.order_id == order.id)  # Use order.id (UUID) not order_number

    result = await db.execute(query)
    items = result.scalars().all()

    if not items:
        logger.warning(f"No items found for order {status_data.order_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No items found for order {status_data.order_id}"
        )

    # Update each item in order_items
    updated_count = 0
    for item in items:
        # For split assignments, only update if the item is assigned to THIS trip
        # If status_data.trip_id is provided, only update items assigned to that trip
        if status_data.trip_id and item.trip_id != status_data.trip_id:
            # This item is assigned to a different trip, skip it
            logger.info(f"Item {item.id} assigned to trip {item.trip_id}, skipping (target trip: {status_data.trip_id})")
            continue

        # Update the item status
        item.item_status = status_data.item_status

        # Handle trip_id update
        if status_data.remove_from_trip:
            # Clear the trip_id when removing from trip
            item.trip_id = None
        elif status_data.trip_id is not None:
            # Set trip_id to the provided value (can be None or empty string)
            item.trip_id = status_data.trip_id if status_data.trip_id else None

        updated_count += 1

    await db.commit()

    logger.info(f"Updated {updated_count} order_items, {trip_assignments_updated} trip_item_assignments updated, {trip_assignments_deleted} deleted for order {status_data.order_id} to status {status_data.item_status}")

    return {
        "message": f"Updated {updated_count} order_items and {trip_assignments_updated} trip_item_assignments, deleted {trip_assignments_deleted} to status {status_data.item_status}",
        "updated_count": updated_count,
        "trip_assignments_updated": trip_assignments_updated,
        "trip_assignments_deleted": trip_assignments_deleted,
        "order_id": status_data.order_id,
        "trip_id": status_data.trip_id,
        "item_status": status_data.item_status
    }


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    request: Request,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:cancel"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """Cancel an order - Requires order cancel permission"""
    # Get auth headers for audit client
    auth_headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    order_service = OrderService(db, auth_headers=auth_headers)

    order = await order_service.cancel_order(
        str(order_id),
        user_id,
        tenant_id,
        reason
    )
    return order

# ============================================================================
# Trip Item Assignment Endpoints - New system for tracking split/partial assignments
# ============================================================================

@router.post("/trip-item-assignments/bulk")
async def bulk_create_trip_item_assignments(
    assignment_data: dict,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Bulk create trip-item assignments from TMS service"""
    from src.models.trip_item_assignment import TripItemAssignment
    from src.models.order_item import OrderItem
    import uuid

    trip_id = assignment_data.get("trip_id")
    order_number = assignment_data.get("order_number")
    items = assignment_data.get("items", [])

    logger.info(f"Bulk creating {len(items)} trip-item assignments for trip {trip_id}, order {order_number}")

    created_count = 0
    for item in items:
        new_assignment = TripItemAssignment(
            id=str(uuid.uuid4()),
            trip_id=trip_id,
            order_id=item.get("order_id"),
            order_item_id=item.get("order_item_id"),
            order_number=order_number,
            tenant_id=tenant_id,
            assigned_quantity=item.get("assigned_quantity"),
            item_status=item.get("item_status", "pending_to_assign")
        )
        db.add(new_assignment)
        created_count += 1

        # Also update the order_item status
        order_item_id = item.get("order_item_id")
        item_status = item.get("item_status", "pending_to_assign")
        if order_item_id:
            try:
                order_item_query = select(OrderItem).where(
                    and_(
                        OrderItem.id == order_item_id,
                        OrderItem.order_id == item.get("order_id")
                    )
                )
                order_item_result = await db.execute(order_item_query)
                order_item = order_item_result.scalar_one_or_none()

                if order_item:
                    logger.info(f"Updating order_item {order_item_id} status to {item_status}")
                    order_item.item_status = item_status
                    # Also update trip_id in order_items
                    order_item.trip_id = trip_id
            except Exception as e:
                logger.error(f"Failed to update order_item {order_item_id} status: {str(e)}")

    await db.commit()

    logger.info(f"Successfully created {created_count} trip-item assignments for trip {trip_id}")
    return {"message": f"Created {created_count} trip-item assignments", "created_count": created_count}


@router.put("/trip-item-assignments/status")
async def update_trip_item_assignments_status(
    status_data: dict,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Update item status for all trip-item assignments for a trip"""
    from src.models.trip_item_assignment import TripItemAssignment

    trip_id = status_data.get("trip_id")
    item_status = status_data.get("item_status")

    query = select(TripItemAssignment).where(
        and_(TripItemAssignment.trip_id == trip_id, TripItemAssignment.tenant_id == tenant_id)
    )
    result = await db.execute(query)
    assignments = result.scalars().all()

    for assignment in assignments:
        assignment.item_status = item_status

    await db.commit()

    return {"message": f"Updated {len(assignments)} assignments", "updated_count": len(assignments)}


@router.get("/trip-item-assignments/order/{order_number}")
async def get_order_item_assignments(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Get all trip-item assignments for an order and calculate remaining quantities.

    This is the authoritative endpoint for determining:
    1. Which items are assigned to which trips
    2. How much of each item is assigned
    3. How much remains available for assignment
    """
    from src.models.trip_item_assignment import TripItemAssignment
    from src.models.order_item import OrderItem
    from src.models.order import Order

    # Get the order
    order_query = select(Order).where(
        and_(
            Order.order_number == order_number,
            Order.tenant_id == tenant_id
        )
    )
    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get all original items for this order
    items_query = select(OrderItem).where(OrderItem.order_id == order.id)
    items_result = await db.execute(items_query)
    original_items = items_result.scalars().all()

    # Get all trip-item assignments for this order
    assignments_query = select(TripItemAssignment).where(
        and_(
            TripItemAssignment.order_id == order.id,
            TripItemAssignment.tenant_id == tenant_id
        )
    )
    assignments_result = await db.execute(assignments_query)
    assignments = assignments_result.scalars().all()

    # Build a map of assigned quantities per item, split by status
    # Only count planning/loading/on_route as "assigned" - delivered/failed/returned are completed
    assigned_quantities = {}  # order_item_id -> total assigned quantity (active)
    delivered_quantities = {}  # order_item_id -> total delivered quantity
    assignment_details = {}   # order_item_id -> list of assignments

    for assignment in assignments:
        item_id = assignment.order_item_id

        # Only count active assignments (planning, loading, on_route) as "assigned"
        # Delivered, failed, returned items are completed and should not be subtracted from remaining
        if assignment.item_status in ('planning', 'loading', 'on_route'):
            assigned_quantities[item_id] = assigned_quantities.get(item_id, 0) + assignment.assigned_quantity
        elif assignment.item_status == 'delivered':
            delivered_quantities[item_id] = delivered_quantities.get(item_id, 0) + assignment.assigned_quantity
        # failed and returned statuses are also completed - don't count as assigned

        if item_id not in assignment_details:
            assignment_details[item_id] = []
        assignment_details[item_id].append({
            "trip_id": assignment.trip_id,
            "assigned_quantity": assignment.assigned_quantity,
            "item_status": assignment.item_status,
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None
        })

    # Build response with original items, assigned amounts, and remaining
    items_status = []
    total_original_quantity = 0
    total_assigned_quantity = 0
    total_delivered_quantity = 0
    total_remaining_quantity = 0

    for item in original_items:
        # The order_items.quantity is the ORIGINAL quantity (not reduced)
        # trip_item_assignments tracks what has been assigned to trips
        assigned_qty = assigned_quantities.get(item.id, 0)  # Only active assignments
        delivered_qty = delivered_quantities.get(item.id, 0)  # Completed deliveries
        original_qty = item.quantity  # This is the original quantity
        # Remaining = original - active_assignments - delivered
        remaining_qty = item.quantity - assigned_qty - delivered_qty

        total_original_quantity += original_qty
        total_assigned_quantity += assigned_qty
        total_delivered_quantity += delivered_qty
        total_remaining_quantity += remaining_qty

        item_dict = {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "product_code": item.product_code,
            "original_quantity": original_qty,  # Original quantity from order_items
            "assigned_quantity": assigned_qty,  # Active assignments (planning/loading/on_route)
            "delivered_quantity": delivered_qty,  # Completed deliveries
            "remaining_quantity": remaining_qty,  # Remaining after assignments and deliveries
            "is_fully_assigned": remaining_qty == 0,
            "is_partially_assigned": 0 < remaining_qty < original_qty,
            "is_available": remaining_qty > 0,
            "assignments": assignment_details.get(item.id, [])
        }
        items_status.append(item_dict)

    # Determine overall order status
    is_fully_assigned = total_remaining_quantity == 0
    is_partially_assigned = 0 < total_remaining_quantity < total_original_quantity
    is_available = total_remaining_quantity == total_original_quantity

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "items": items_status,
        "summary": {
            "total_original_quantity": total_original_quantity,
            "total_assigned_quantity": total_assigned_quantity,
            "total_delivered_quantity": total_delivered_quantity,
            "total_remaining_quantity": total_remaining_quantity,
            "is_fully_assigned": is_fully_assigned,
            "is_partially_assigned": is_partially_assigned,
            "is_available": is_available,
            "tms_order_status": order.tms_order_status
        }
    }


@router.post("/trip-item-assignments/bulk-fetch")
async def bulk_get_order_item_assignments(
    request_data: dict,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Bulk get trip-item assignments for multiple orders at once.

    This solves the N+1 query problem by fetching all assignments in a single query.

    Request body:
    {
        "order_numbers": ["ORD-001", "ORD-002", ...]
    }

    Returns a dictionary mapping order_number to assignment data.

    NOTE: Changed from /bulk to /bulk-fetch to avoid conflict with bulk create endpoint
    """
    from src.models.trip_item_assignment import TripItemAssignment
    from src.models.order_item import OrderItem
    from src.models.order import Order

    order_numbers = request_data.get("order_numbers", [])
    if not order_numbers:
        raise HTTPException(status_code=400, detail="order_numbers is required")

    # Get all orders
    orders_query = select(Order).where(
        and_(
            Order.order_number.in_(order_numbers),
            Order.tenant_id == tenant_id
        )
    )
    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Create a mapping of order_number to order
    order_map = {order.order_number: order for order in orders}

    # Get all original items for these orders
    order_ids = [order.id for order in orders]
    items_query = select(OrderItem).where(OrderItem.order_id.in_(order_ids))
    items_result = await db.execute(items_query)
    all_items = items_result.scalars().all()

    # Group items by order_id
    items_by_order = {}
    for item in all_items:
        if item.order_id not in items_by_order:
            items_by_order[item.order_id] = []
        items_by_order[item.order_id].append(item)

    # Get all trip-item assignments for these orders in a SINGLE query
    assignments_query = select(TripItemAssignment).where(
        and_(
            TripItemAssignment.order_id.in_(order_ids),
            TripItemAssignment.tenant_id == tenant_id
        )
    )
    assignments_result = await db.execute(assignments_query)
    all_assignments = assignments_result.scalars().all()

    # Build a map of order_id -> item_id -> assignments
    assignments_by_order_and_item = {}
    for assignment in all_assignments:
        order_id = assignment.order_id
        item_id = assignment.order_item_id

        if order_id not in assignments_by_order_and_item:
            assignments_by_order_and_item[order_id] = {}

        if item_id not in assignments_by_order_and_item[order_id]:
            assignments_by_order_and_item[order_id][item_id] = []

        assignments_by_order_and_item[order_id][item_id].append({
            "trip_id": assignment.trip_id,
            "assigned_quantity": assignment.assigned_quantity,
            "item_status": assignment.item_status,
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None
        })

    # Build response for each order
    result = {}

    for order in orders:
        items = items_by_order.get(order.id, [])
        assignments_for_order = assignments_by_order_and_item.get(order.id, {})

        items_status = []
        total_original_quantity = 0
        total_assigned_quantity = 0
        total_remaining_quantity = 0

        for item in items:
            item_assignments = assignments_for_order.get(item.id, [])

            # Split assignments by status - only count active assignments
            assigned_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] in ('planning', 'loading', 'on_route'))
            delivered_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] == 'delivered')

            # The order_items.quantity is the ORIGINAL quantity (not reduced)
            # trip_item_assignments tracks what has been assigned to trips
            original_qty = item.quantity  # This is the original quantity
            # Remaining = original - active_assignments - delivered
            remaining_qty = item.quantity - assigned_qty - delivered_qty

            total_original_quantity += original_qty
            total_assigned_quantity += assigned_qty
            total_remaining_quantity += remaining_qty

            item_dict = {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "product_code": item.product_code,
                "original_quantity": original_qty,  # Original quantity from order_items
                "assigned_quantity": assigned_qty,  # Active assignments (planning/loading/on_route)
                "delivered_quantity": delivered_qty,  # Completed deliveries
                "remaining_quantity": remaining_qty,  # Remaining after assignments and deliveries
                "is_fully_assigned": remaining_qty == 0,
                "is_partially_assigned": 0 < remaining_qty < original_qty,
                "is_available": remaining_qty > 0,
                "assignments": item_assignments
            }
            items_status.append(item_dict)

        # Determine overall order status
        is_fully_assigned = total_remaining_quantity == 0
        is_partially_assigned = 0 < total_remaining_quantity < total_original_quantity
        is_available = total_remaining_quantity == total_original_quantity

        result[order.order_number] = {
            "order_id": order.id,
            "order_number": order.order_number,
            "items": items_status,
            "summary": {
                "total_original_quantity": total_original_quantity,
                "total_assigned_quantity": total_assigned_quantity,
                "total_remaining_quantity": total_remaining_quantity,
                "is_fully_assigned": is_fully_assigned,
                "is_partially_assigned": is_partially_assigned,
                "is_available": is_available,
                "tms_order_status": order.tms_order_status
            }
        }

    return result


@router.get("/{order_id}/items-with-assignments")
async def get_order_items_with_assignments(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["orders:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Get order with items and their trip assignments

    Returns detailed information about each order item including:
    - Original quantity
    - Assigned quantity (sum of all trip_item_assignments)
    - Remaining quantity
    - List of assignments with trip details
    """
    from src.models.trip_item_assignment import TripItemAssignment
    from src.models.order_item import OrderItem

    # Get order by UUID
    order_query = select(Order).where(
        and_(
            Order.id == order_id,
            Order.tenant_id == tenant_id
        )
    )
    order_result = await db.execute(order_query)
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get all items for this order
    items_query = select(OrderItem).where(OrderItem.order_id == order_id)
    items_result = await db.execute(items_query)
    items = items_result.scalars().all()

    # Get all trip-item assignments for this order
    assignments_query = select(TripItemAssignment).where(
        and_(
            TripItemAssignment.order_id == order_id,
            TripItemAssignment.tenant_id == tenant_id
        )
    ).order_by(TripItemAssignment.updated_at.desc())
    assignments_result = await db.execute(assignments_query)
    assignments = assignments_result.scalars().all()

    # Group assignments by (order_item_id, trip_id) and get the latest status
    # Multiple rows may exist for the same item/trip due to status updates
    assignments_by_item = {}
    seen_trip_item_pairs = set()

    for assignment in assignments:
        item_id = assignment.order_item_id
        trip_id = assignment.trip_id
        pair_key = (item_id, trip_id)

        # Only keep the latest status for each (item, trip) pair
        if pair_key not in seen_trip_item_pairs:
            seen_trip_item_pairs.add(pair_key)

            if item_id not in assignments_by_item:
                assignments_by_item[item_id] = []

            assignments_by_item[item_id].append({
                "trip_id": assignment.trip_id,
                "assigned_quantity": assignment.assigned_quantity,
                "item_status": assignment.item_status,
                "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                "updated_at": assignment.updated_at.isoformat() if assignment.updated_at else None
            })

    # Build response with items and their assignments
    items_with_assignments = []
    total_original_quantity = 0
    total_assigned_quantity = 0
    total_remaining_quantity = 0

    for item in items:
        item_assignments = assignments_by_item.get(item.id, [])

        # Split assignments by status - only count active assignments
        assigned_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] in ('planning', 'loading', 'on_route'))
        delivered_qty = sum(a["assigned_quantity"] for a in item_assignments if a["item_status"] == 'delivered')

        # The order_items.quantity is the ORIGINAL quantity (not reduced)
        # trip_item_assignments tracks what has been assigned to trips
        original_qty = item.quantity  # This is the original quantity
        # Remaining = original - active_assignments - delivered
        remaining_qty = item.quantity - assigned_qty - delivered_qty

        total_original_quantity += original_qty
        total_assigned_quantity += assigned_qty
        total_remaining_quantity += remaining_qty

        # Calculate total_weight based on original quantity (weight * original_qty)
        item_weight = float(item.weight) if item.weight else 0
        total_weight = item_weight * original_qty

        items_with_assignments.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "product_code": item.product_code,
            "description": item.description,
            "original_quantity": original_qty,  # Original quantity from order_items
            "assigned_quantity": assigned_qty,  # Active assignments (planning/loading/on_route)
            "delivered_quantity": delivered_qty,  # Completed deliveries
            "remaining_quantity": remaining_qty,  # Remaining after assignments and deliveries
            "unit": item.unit,
            "unit_price": float(item.unit_price) if item.unit_price else None,
            "total_price": float(item.total_price) if item.total_price else None,
            "weight": item_weight,
            "total_weight": total_weight,  # Total weight for original quantity
            "volume": float(item.volume) if item.volume else None,
            "weight_type": getattr(item, 'weight_type', 'fixed'),
            "fixed_weight": getattr(item, 'fixed_weight', None),
            "weight_unit": getattr(item, 'weight_unit', 'kg'),
            "is_fully_assigned": remaining_qty == 0,
            "is_partially_assigned": 0 < remaining_qty < original_qty,
            "is_available": remaining_qty == original_qty,
            "assignments": item_assignments
        })

    logger.info(f"Order {order.order_number} items-with-assignments: original={total_original_quantity}, assigned={total_assigned_quantity}, remaining={total_remaining_quantity}")
    logger.info(f"Items data: {items_with_assignments}")

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "tms_order_status": order.tms_order_status,
        "items": items_with_assignments,
        "summary": {
            "total_original_quantity": total_original_quantity,
            "total_assigned_quantity": total_assigned_quantity,
            "total_remaining_quantity": total_remaining_quantity,
            "is_fully_assigned": total_remaining_quantity == 0,
            "is_partially_assigned": 0 < total_remaining_quantity < total_original_quantity,
            "is_available": total_remaining_quantity == total_original_quantity
        }
    }

