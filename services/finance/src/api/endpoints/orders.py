"""
Orders API endpoints for Finance Service
Fetches orders from Orders Service for finance approval
"""
from typing import List, Optional
from datetime import datetime
from httpx import AsyncClient

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas import (
    OrderListResponse,
    OrderApprovalResponse,
    ApprovalQueryParams,
)
from src.security import (
    TokenData,
    require_any_permission,
    get_current_tenant_id,
)
import logging

logger = logging.getLogger(__name__)

# Orders Service URL
ORDERS_SERVICE_URL = "http://orders-service:8003"


async def fetch_orders_from_service(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    headers: dict = None
) -> dict:
    """
    Fetch orders from Orders Service.
    tenant_id is extracted from JWT token by Orders Service.
    """
    params = {
        "page": page,
        "per_page": per_page,
    }

    if status:
        params["status"] = status
    if customer_id:
        params["customer_id"] = customer_id

    async with AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{ORDERS_SERVICE_URL}/api/v1/orders/",
                params=params,
                headers=headers or {},
                follow_redirects=True
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch orders from Orders Service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch orders: {response.text}"
                )
        except Exception as e:
            logger.error(f"Error fetching orders from Orders Service: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orders service unavailable"
            )


async def fetch_order_by_id_from_service(
    order_id: str,
    headers: dict = None
) -> dict:
    """
    Fetch specific order from Orders Service.
    tenant_id is extracted from JWT token by Orders Service.
    """
    async with AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{ORDERS_SERVICE_URL}/api/v1/orders/{order_id}/",
                headers=headers or {},
                follow_redirects=True
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Order not found"
                )
            else:
                logger.error(f"Failed to fetch order from Orders Service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch order: {response.text}"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching order from Orders Service: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orders service unavailable"
            )


router = APIRouter()


@router.get("/", response_model=OrderListResponse)
async def list_orders_for_approval(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by order status"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    date_from: Optional[datetime] = Query(None, description="Filter by date from"),
    date_to: Optional[datetime] = Query(None, description="Filter by date to"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Page size"),
    token_data: TokenData = Depends(require_any_permission(["orders:read", "finance:approve"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    List orders that need finance approval.
    Fetches orders from Orders Service with appropriate filters for finance team.
    """
    # Log user info for debugging
    logger.info(f"FINANCE SERVICE - User: {token_data.user_id}, Role: {token_data.role}, Tenant: {tenant_id}")

    # Get authorization header from the request
    auth_headers = {}
    if request and hasattr(request, 'headers'):
        auth_header = request.headers.get("authorization")
        if auth_header:
            auth_headers["Authorization"] = auth_header
            logger.info(f"FINANCE SERVICE - Auth header found and will be forwarded to orders service")
        else:
            logger.warning(f"FINANCE SERVICE - No auth header found in request!")

    # For finance approval, we want orders that are submitted, approved, or rejected
    # but we allow flexible filtering
    if not status:
        # Fetch all finance-relevant orders (submitted, finance_approved, finance_rejected)
        # We'll make multiple calls to get all relevant statuses
        relevant_statuses = ["submitted", "finance_approved", "finance_rejected"]
        all_orders = []

        for status_filter in relevant_statuses:
            try:
                orders_data = await fetch_orders_from_service(
                    status=status_filter,
                    customer_id=customer_id,
                    page=page,
                    per_page=per_page,
                    headers=auth_headers
                )
                all_orders.extend(orders_data.get("items", []))
            except Exception as e:
                logger.warning(f"Failed to fetch orders with status {status_filter}: {str(e)}")
                continue

        # Combine all orders
        orders_data = {
            "items": all_orders,
            "total": len(all_orders),
            "page": page,
            "per_page": per_page,
            "pages": 1
        }
    else:
        # If specific status filter is provided, use it
        orders_data = await fetch_orders_from_service(
            status=status,
            customer_id=customer_id,
            page=page,
            per_page=per_page,
            headers=auth_headers
        )

    try:
        # Log orders received from orders service
        logger.info(f"FINANCE SERVICE - Total orders received from orders service: {len(orders_data.get('items', []))}")
        for item in orders_data.get("items", []):
            logger.info(f"FINANCE SERVICE - Order: {item.get('order_number')}, Branch: {item.get('branch_id')}, Status: {item.get('status')}")

        # Transform Orders Service response to Finance Service response format
        finance_orders = []
        for item in orders_data.get("items", []):
            # Transform items to OrderItemResponse format
            items_data = []
            for order_item in item.get("items", []):
                items_data.append({
                    "id": order_item.get("id"),
                    "product_id": order_item.get("product_id"),
                    "product_name": order_item.get("product_name"),
                    "product_code": order_item.get("product_code"),
                    "description": order_item.get("description"),
                    "quantity": order_item.get("quantity"),
                    "unit": order_item.get("unit"),
                    "unit_price": order_item.get("unit_price"),
                    "total_price": order_item.get("total_price"),
                    "weight": order_item.get("weight"),
                    "total_weight": order_item.get("total_weight"),
                    "volume": order_item.get("volume")
                })

            order_data = {
                "id": item.get("id"),
                "order_number": item.get("order_number"),
                "customer_id": item.get("customer_id"),
                "customer": item.get("customer"),  # Customer details from Orders Service
                "branch_id": item.get("branch_id"),
                "status": item.get("status"),
                "total_amount": item.get("total_amount"),
                "payment_type": item.get("payment_type"),
                "priority": item.get("priority"),
                "created_at": item.get("created_at"),
                "submitted_at": None,  # This would need to be determined from order status changes
                "items": items_data,
                "items_count": len(items_data),
                "approval_status": None,  # This would be determined from finance approval table
                "finance_approved_at": item.get("finance_approved_at"),
                "finance_approved_by": item.get("finance_approved_by"),
                "approval_action_id": None,  # This would be determined from finance approval table
                "approval_reason": None,  # This would be determined from finance approval table
            }
            finance_orders.append(OrderApprovalResponse(**order_data))

        return OrderListResponse(
            items=finance_orders,
            total=orders_data.get("total", 0),
            page=orders_data.get("page", page),
            per_page=orders_data.get("per_page", per_page),
            pages=orders_data.get("pages", 1)
        )

    except Exception as e:
        logger.error(f"Error listing orders for approval: {str(e)}")
        raise


@router.get("/{order_id}", response_model=OrderApprovalResponse)
async def get_order_for_approval(
    order_id: str,
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["orders:read", "finance:approve"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Get specific order details for finance approval.
    Fetches order details from Orders Service.
    """
    # Get authorization header from the request
    auth_headers = {}
    if request and hasattr(request, 'headers'):
        auth_header = request.headers.get("authorization")
        if auth_header:
            auth_headers["Authorization"] = auth_header

    try:
        # Fetch order from Orders Service
        order_data = await fetch_order_by_id_from_service(
            order_id=order_id,
            headers=auth_headers
        )

        # Transform Orders Service response to Finance Service response format
        # Transform items to OrderItemResponse format
        items_data = []
        for order_item in order_data.get("items", []):
            items_data.append({
                "id": order_item.get("id"),
                "product_id": order_item.get("product_id"),
                "product_name": order_item.get("product_name"),
                "product_code": order_item.get("product_code"),
                "description": order_item.get("description"),
                "quantity": order_item.get("quantity"),
                "unit": order_item.get("unit"),
                "unit_price": order_item.get("unit_price"),
                "total_price": order_item.get("total_price"),
                "weight": order_item.get("weight"),
                "total_weight": order_item.get("total_weight"),
                "volume": order_item.get("volume")
            })

        finance_order = {
            "id": order_data.get("id"),
            "order_number": order_data.get("order_number"),
            "customer_id": order_data.get("customer_id"),
            "customer": order_data.get("customer"),  # Customer details from Orders Service
            "branch_id": order_data.get("branch_id"),
            "status": order_data.get("status"),
            "total_amount": order_data.get("total_amount"),
            "payment_type": order_data.get("payment_type"),
            "priority": order_data.get("priority"),
            "created_at": order_data.get("created_at"),
            "submitted_at": None,  # This would need to be determined from order status changes
            "items": items_data,
            "items_count": len(items_data),
            "approval_status": None,  # This would be determined from finance approval table
            "finance_approved_at": order_data.get("finance_approved_at"),
            "finance_approved_by": order_data.get("finance_approved_by"),
            "approval_action_id": None,  # This would be determined from finance approval table
            "approval_reason": None,  # This would be determined from finance approval table
        }

        return OrderApprovalResponse(**finance_order)

    except Exception as e:
        logger.error(f"Error getting order for approval: {str(e)}")
        raise


@router.get("/pending/summary")
async def get_pending_approvals_summary(
    request: Request,
    token_data: TokenData = Depends(require_any_permission(["finance:approve", "finance:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Get summary of pending finance approvals.
    This provides a quick overview for the finance dashboard.
    """
    # Get authorization header from the request
    auth_headers = {}
    if request and hasattr(request, 'headers'):
        auth_header = request.headers.get("authorization")
        if auth_header:
            auth_headers["Authorization"] = auth_header

    try:
        # Fetch submitted orders that need finance approval
        orders_data = await fetch_orders_from_service(
            status="submitted",
            per_page=100,  # Get more for summary
            headers=auth_headers
        )

        # Calculate summary statistics
        total_pending = orders_data.get("total", 0)
        total_amount = sum(
            order.get("total_amount", 0)
            for order in orders_data.get("items", [])
        )

        # Group by priority
        priority_summary = {}
        for order in orders_data.get("items", []):
            priority = order.get("priority", "normal")
            if priority not in priority_summary:
                priority_summary[priority] = {"count": 0, "amount": 0}
            priority_summary[priority]["count"] += 1
            priority_summary[priority]["amount"] += order.get("total_amount", 0)

        return {
            "total_pending_orders": total_pending,
            "total_pending_amount": total_amount,
            "priority_breakdown": priority_summary,
            "last_updated": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting pending approvals summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pending approvals summary"
        )