"""
Finance approval API endpoints
Handles finance approval and rejection of orders
"""
from typing import List, Optional
from datetime import datetime
from httpx import AsyncClient
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func, cast, String as SQLString

from src.database import get_db
from src.models.approval import ApprovalAction, ApprovalAudit, ApprovalType, ApprovalStatus
from src.schemas import (
    FinanceApprovalRequest,
    BulkApprovalRequest,
    ApprovalActionResponse,
    BulkApprovalResponse,
    ApprovalListResponse,
    ApprovalAuditResponse,
    ApprovalQueryParams,
    MessageResponse,
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_user_id,
    get_current_tenant_id,
)
import logging

logger = logging.getLogger(__name__)

# Orders Service URL
ORDERS_SERVICE_URL = "http://orders-service:8003"


async def update_order_status_in_service(
    order_id: str,
    status: str,
    approved: bool,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    payment_type: Optional[str] = None,
    headers: dict = None
) -> dict:
    """
    Update order status in Orders Service.
    tenant_id and user_id are extracted from JWT token by Orders Service.
    """
    async with AsyncClient(timeout=30.0) as client:
        try:
            if approved:
                # Approve the order
                approval_data = {
                    "approved": True,
                    "reason": reason,
                    "notes": notes,
                    "payment_type": payment_type
                }
            else:
                # Reject the order
                approval_data = {
                    "approved": False,
                    "reason": reason,
                    "notes": notes
                }

            response = await client.post(
                f"{ORDERS_SERVICE_URL}/api/v1/orders/{order_id}/finance-approval",
                json=approval_data,
                headers=headers or {}
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to update order status in Orders Service: {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to update order: {response.text}"
                )
        except Exception as e:
            logger.error(f"Error updating order status in Orders Service: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orders service unavailable"
            )


async def get_order_details_from_service(
    order_id: str,
    headers: dict = None
) -> dict:
    """
    Get order details from Orders Service.
    tenant_id is extracted from JWT token by Orders Service.
    """
    async with AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{ORDERS_SERVICE_URL}/api/v1/orders/{order_id}",
                headers=headers or {}
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Order not found"
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get order details: {response.text}"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting order details from Orders Service: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orders service unavailable"
            )


async def create_approval_audit_entry(
    db: AsyncSession,
    approval_action_id: str,
    action: str,
    old_status: Optional[str],
    new_status: Optional[str],
    user_id: str,
    user_name: Optional[str],
    user_role: Optional[str],
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> ApprovalAudit:
    """Create an audit entry for approval action"""
    audit_entry = ApprovalAudit(
        approval_action_id=approval_action_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        user_id=user_id,
        user_name=user_name,
        user_role=user_role,
        reason=reason,
        notes=notes,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )

    db.add(audit_entry)
    await db.commit()
    await db.refresh(audit_entry)

    return audit_entry


router = APIRouter()


@router.post("/order/{order_id}", response_model=ApprovalActionResponse)
async def approve_or_reject_order(
    order_id: str,
    approval_data: FinanceApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["finance:approve"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """
    Approve or reject a single order for finance.
    This updates both the finance approval records and the order status in Orders Service.
    """
    # Get authorization header from the request
    auth_headers = {}
    if request and hasattr(request, 'headers'):
        auth_header = request.headers.get("authorization")
        if auth_header:
            auth_headers["Authorization"] = auth_header

    # Get IP address and user agent for audit
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    try:
        # Check if approval action already exists
        existing_approval = await db.execute(
            select(ApprovalAction).where(
                and_(
                    ApprovalAction.order_id == order_id,
                    ApprovalAction.tenant_id == tenant_id,
                    cast(ApprovalAction.approval_type, SQLString) == ApprovalType.FINANCE.value,
                    ApprovalAction.is_active == True
                )
            )
        )
        existing_approval = existing_approval.scalar_one_or_none()

        if existing_approval and existing_approval.status != ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order has already been processed"
            )

        # Get order details from Orders Service
        order_details = await get_order_details_from_service(
            order_id=order_id,
            headers=auth_headers
        )

        # Create or update approval action
        if existing_approval:
            # Update existing approval
            old_status = existing_approval.status
            existing_approval.status = ApprovalStatus.APPROVED if approval_data.approved else ApprovalStatus.REJECTED
            existing_approval.approver_id = user_id
            existing_approval.approval_reason = approval_data.reason if approval_data.approved else None
            existing_approval.rejection_reason = approval_data.reason if not approval_data.approved else None
            existing_approval.approved_amount = approval_data.approved_amount if approval_data.approved else None
            existing_approval.updated_at = datetime.utcnow()
            existing_approval.approved_at = datetime.utcnow()

            approval_action = existing_approval
        else:
            # Create new approval action
            approval_action = ApprovalAction(
                tenant_id=tenant_id,
                order_id=order_id,
                approval_type=ApprovalType.FINANCE,
                status=ApprovalStatus.APPROVED if approval_data.approved else ApprovalStatus.REJECTED,
                order_amount=order_details.get("total_amount"),
                approved_amount=approval_data.approved_amount if approval_data.approved else None,
                approver_id=user_id,
                approver_name=request.state.user_name if request and hasattr(request.state, 'user_name') else None,
                approval_reason=approval_data.reason if approval_data.approved else None,
                rejection_reason=approval_data.reason if not approval_data.approved else None,
                customer_id=order_details.get("customer_id"),
                customer_name=order_details.get("customer", {}).get("name") if order_details.get("customer") else None,
                order_priority=order_details.get("priority"),
                payment_type=order_details.get("payment_type"),
                requested_by=order_details.get("created_by"),
                created_at=datetime.utcnow(),
                approved_at=datetime.utcnow()
            )

            db.add(approval_action)
            await db.commit()
            await db.refresh(approval_action)

        # Create audit entry
        await create_approval_audit_entry(
            db=db,
            approval_action_id=approval_action.id,
            action="approved" if approval_data.approved else "rejected",
            old_status=old_status if existing_approval else ApprovalStatus.PENDING,
            new_status=approval_action.status,
            user_id=user_id,
            user_name=request.state.user_name if request and hasattr(request.state, 'user_name') else None,
            user_role=request.state.user_role if request and hasattr(request.state, 'user_role') else None,
            reason=approval_data.reason,
            notes=approval_data.notes,
            ip_address=ip_address,
            user_agent=user_agent
        )

        # Update order status in Orders Service
        await update_order_status_in_service(
            order_id=order_id,
            status="finance_approved" if approval_data.approved else "finance_rejected",
            approved=approval_data.approved,
            reason=approval_data.reason,
            notes=approval_data.notes,
            payment_type=order_details.get("payment_type"),
            headers=auth_headers
        )

        logger.info(f"Order {order_id} {'approved' if approval_data.approved else 'rejected'} by user {user_id}")

        # Return response
        return ApprovalActionResponse.model_validate(approval_action)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing approval for order {order_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process approval"
        )


@router.post("/bulk", response_model=BulkApprovalResponse)
async def bulk_approve_or_reject_orders(
    request: Request,
    bulk_data: BulkApprovalRequest,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_permissions(["finance:approve_bulk"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
):
    """
    Approve or reject multiple orders in bulk.
    Processes each order and returns summary of results.
    """
    # Get authorization header from the request
    auth_headers = {}
    if request and hasattr(request, 'headers'):
        auth_header = request.headers.get("authorization")
        if auth_header:
            auth_headers["Authorization"] = auth_header

    # Get IP address and user agent for audit
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    if not bulk_data.order_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No order IDs provided"
        )

    approval_actions = []
    failed_orders = []
    approved_count = 0
    rejected_count = 0

    for order_id in bulk_data.order_ids:
        try:
            # Similar logic to single approval, but simplified for bulk processing
            approval_action = ApprovalAction(
                tenant_id=tenant_id,
                order_id=order_id,
                approval_type=ApprovalType.FINANCE,
                status=ApprovalStatus.APPROVED if bulk_data.approved else ApprovalStatus.REJECTED,
                approver_id=user_id,
                approver_name=request.state.user_name if request and hasattr(request.state, 'user_name') else None,
                approval_reason=bulk_data.reason if bulk_data.approved else None,
                rejection_reason=bulk_data.reason if not bulk_data.approved else None,
                requested_by=user_id,
                created_at=datetime.utcnow(),
                approved_at=datetime.utcnow()
            )

            db.add(approval_action)
            await db.flush()  # Get the ID without committing
            await db.refresh(approval_action)

            # Create audit entry
            await create_approval_audit_entry(
                db=db,
                approval_action_id=approval_action.id,
                action="approved" if bulk_data.approved else "rejected",
                old_status=ApprovalStatus.PENDING,
                new_status=approval_action.status,
                user_id=user_id,
                user_name=request.state.user_name if request and hasattr(request.state, 'user_name') else None,
                user_role=request.state.user_role if request and hasattr(request.state, 'user_role') else None,
                reason=bulk_data.reason,
                notes=bulk_data.notes,
                ip_address=ip_address,
                user_agent=user_agent
            )

            # Try to update order status in Orders Service
            try:
                await update_order_status_in_service(
                    order_id=order_id,
                    status="finance_approved" if bulk_data.approved else "finance_rejected",
                    approved=bulk_data.approved,
                    reason=bulk_data.reason,
                    notes=bulk_data.notes,
                    headers=auth_headers
                )
            except Exception as e:
                # Log the error but continue processing other orders
                logger.error(f"Failed to update order {order_id} in Orders Service: {str(e)}")
                failed_orders.append({
                    "order_id": order_id,
                    "error": f"Failed to update order status: {str(e)}"
                })
                continue

            approval_actions.append(ApprovalActionResponse.model_validate(approval_action))

            if bulk_data.approved:
                approved_count += 1
            else:
                rejected_count += 1

        except Exception as e:
            logger.error(f"Failed to process approval for order {order_id}: {str(e)}")
            failed_orders.append({
                "order_id": order_id,
                "error": str(e)
            })

    # Commit all successful transactions
    await db.commit()

    logger.info(f"Bulk approval completed: {approved_count} approved, {rejected_count} rejected, {len(failed_orders)} failed")

    return BulkApprovalResponse(
        total_orders=len(bulk_data.order_ids),
        approved_orders=approved_count,
        rejected_orders=rejected_count,
        failed_orders=failed_orders,
        approval_actions=approval_actions
    )


@router.get("/", response_model=ApprovalListResponse)
async def list_approval_actions(
    status: Optional[ApprovalStatus] = Query(None, description="Filter by approval status"),
    approval_type: Optional[ApprovalType] = Query(None, description="Filter by approval type"),
    approver_id: Optional[str] = Query(None, description="Filter by approver ID"),
    order_id: Optional[str] = Query(None, description="Filter by order ID"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    date_from: Optional[datetime] = Query(None, description="Filter by date from"),
    date_to: Optional[datetime] = Query(None, description="Filter by date to"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["finance:read", "finance:approve"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """List approval actions with filtering and pagination"""
    # Build base query
    query = select(ApprovalAction).where(ApprovalAction.tenant_id == tenant_id)

    # Apply filters
    if status:
        query = query.where(ApprovalAction.status == status)
    if approval_type:
        query = query.where(ApprovalAction.approval_type == approval_type)
    if approver_id:
        query = query.where(ApprovalAction.approver_id == approver_id)
    if order_id:
        query = query.where(ApprovalAction.order_id == order_id)
    if customer_id:
        query = query.where(ApprovalAction.customer_id == customer_id)
    if date_from:
        query = query.where(ApprovalAction.created_at >= date_from)
    if date_to:
        query = query.where(ApprovalAction.created_at <= date_to)

    # Order by created date descending
    query = query.order_by(ApprovalAction.created_at.desc())

    # Get total count
    count_query = select(func.count(ApprovalAction.id)).where(ApprovalAction.tenant_id == tenant_id)
    if status:
        count_query = count_query.where(ApprovalAction.status == status)
    if approval_type:
        count_query = count_query.where(ApprovalAction.approval_type == approval_type)
    if approver_id:
        count_query = count_query.where(ApprovalAction.approver_id == approver_id)
    if order_id:
        count_query = count_query.where(ApprovalAction.order_id == order_id)
    if customer_id:
        count_query = count_query.where(ApprovalAction.customer_id == customer_id)
    if date_from:
        count_query = count_query.where(ApprovalAction.created_at >= date_from)
    if date_to:
        count_query = count_query.where(ApprovalAction.created_at <= date_to)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    approval_actions = result.scalars().all()

    # Calculate total pages
    pages = (total + per_page - 1) // per_page

    return ApprovalListResponse(
        items=[ApprovalActionResponse.model_validate(action) for action in approval_actions],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{approval_id}/audit", response_model=List[ApprovalAuditResponse])
async def get_approval_audit_trail(
    approval_id: str,
    db: AsyncSession = Depends(get_db),
    token_data: TokenData = Depends(require_any_permission(["finance:read", "finance:approve"])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Get audit trail for a specific approval action"""
    # Verify approval exists and belongs to tenant
    approval_query = select(ApprovalAction).where(
        and_(
            ApprovalAction.id == approval_id,
            ApprovalAction.tenant_id == tenant_id
        )
    )
    approval_result = await db.execute(approval_query)
    approval = approval_result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval action not found"
        )

    # Get audit entries
    audit_query = select(ApprovalAudit).where(
        ApprovalAudit.approval_action_id == approval_id
    ).order_by(ApprovalAudit.created_at.desc())

    audit_result = await db.execute(audit_query)
    audit_entries = audit_result.scalars().all()

    return [ApprovalAuditResponse.model_validate(entry) for entry in audit_entries]