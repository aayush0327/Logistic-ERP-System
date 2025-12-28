"""
Finance approval Pydantic schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from src.models.approval import ApprovalType, ApprovalStatus


# Base schemas
class ApprovalActionBase(BaseModel):
    """Base approval action schema"""
    order_id: str = Field(..., description="Order ID from orders service")
    approval_type: ApprovalType = Field(..., description="Type of approval")
    order_amount: Optional[float] = Field(None, ge=0, description="Total order amount")
    payment_type: Optional[str] = Field(None, max_length=20, description="Payment type")


# Request schemas
class FinanceApprovalRequest(BaseModel):
    """Finance approval request schema"""
    approved: bool = Field(..., description="Whether to approve or reject")
    reason: Optional[str] = Field(None, description="Reason for approval/rejection")
    notes: Optional[str] = Field(None, description="Additional notes")
    approved_amount: Optional[float] = Field(None, ge=0, description="Approved amount (if different from order amount)")


class BulkApprovalRequest(BaseModel):
    """Bulk approval request schema"""
    order_ids: List[str] = Field(..., min_items=1, description="List of order IDs to approve/reject")
    approved: bool = Field(..., description="Whether to approve or reject all orders")
    reason: Optional[str] = Field(None, description="Common reason for approval/rejection")
    notes: Optional[str] = Field(None, description="Additional notes")


# Response schemas
class ApprovalActionResponse(BaseModel):
    """Approval action response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Approval action ID")
    tenant_id: str = Field(..., description="Tenant ID")
    order_id: str = Field(..., description="Order ID")
    approval_type: ApprovalType = Field(..., description="Type of approval")
    status: ApprovalStatus = Field(..., description="Current status")
    order_amount: Optional[float] = Field(None, description="Order amount")
    approved_amount: Optional[float] = Field(None, description="Approved amount")
    approver_id: Optional[str] = Field(None, description="Approver user ID")
    approver_name: Optional[str] = Field(None, description="Approver name")
    approval_reason: Optional[str] = Field(None, description="Approval reason")
    rejection_reason: Optional[str] = Field(None, description="Rejection reason")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    customer_name: Optional[str] = Field(None, description="Customer name")
    order_priority: Optional[str] = Field(None, description="Order priority")
    payment_type: Optional[str] = Field(None, description="Payment type")
    requested_by: str = Field(..., description="User who requested approval")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")


class OrderItemResponse(BaseModel):
    """Order item response schema"""
    id: str = Field(..., description="Item ID")
    product_id: str = Field(..., description="Product ID")
    product_name: str = Field(..., description="Product name")
    product_code: Optional[str] = Field(None, description="Product code")
    description: Optional[str] = Field(None, description="Product description")
    quantity: int = Field(..., description="Item quantity")
    unit: str = Field(..., description="Unit of measure")
    unit_price: Optional[float] = Field(None, description="Unit price")
    total_price: Optional[float] = Field(None, description="Total price")
    weight: Optional[float] = Field(None, description="Weight per unit")
    total_weight: Optional[float] = Field(None, description="Total weight")
    volume: Optional[float] = Field(None, description="Volume per unit")


class OrderApprovalResponse(BaseModel):
    """Order with approval status response schema"""
    id: str = Field(..., description="Order ID")
    order_number: str = Field(..., description="Order number")
    customer_id: str = Field(..., description="Customer ID")
    customer: Optional[dict] = Field(None, description="Customer details")
    branch_id: str = Field(..., description="Branch ID")
    status: str = Field(..., description="Order status")
    total_amount: Optional[float] = Field(None, description="Order total amount")
    payment_type: Optional[str] = Field(None, description="Payment type")
    priority: Optional[str] = Field(None, description="Order priority")
    created_at: datetime = Field(..., description="Order creation timestamp")
    submitted_at: Optional[datetime] = Field(None, description="Order submission timestamp")
    # Order items
    items: List[OrderItemResponse] = Field(default_factory=list, description="Order items")
    items_count: int = Field(0, description="Number of items")
    # Approval status
    approval_status: Optional[ApprovalStatus] = Field(None, description="Finance approval status")
    finance_approved_at: Optional[datetime] = Field(None, description="Finance approval timestamp")
    finance_approved_by: Optional[str] = Field(None, description="Finance approver ID")
    approval_action_id: Optional[str] = Field(None, description="Approval action ID")
    approval_reason: Optional[str] = Field(None, description="Approval reason")


class ApprovalListResponse(BaseModel):
    """Paginated approval list response schema"""
    items: List[ApprovalActionResponse] = Field(..., description="List of approval actions")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


class OrderListResponse(BaseModel):
    """Paginated order list response schema"""
    items: List[OrderApprovalResponse] = Field(..., description="List of orders")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


class ApprovalAuditResponse(BaseModel):
    """Approval audit response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Audit entry ID")
    approval_action_id: str = Field(..., description="Approval action ID")
    action: str = Field(..., description="Action performed")
    old_status: Optional[str] = Field(None, description="Previous status")
    new_status: Optional[str] = Field(None, description="New status")
    user_id: str = Field(..., description="User ID who performed action")
    user_name: Optional[str] = Field(None, description="User name")
    user_role: Optional[str] = Field(None, description="User role")
    reason: Optional[str] = Field(None, description="Action reason")
    notes: Optional[str] = Field(None, description="Additional notes")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    created_at: datetime = Field(..., description="Audit timestamp")


class BulkApprovalResponse(BaseModel):
    """Bulk approval response schema"""
    total_orders: int = Field(..., description="Total orders processed")
    approved_orders: int = Field(..., description="Number of orders approved")
    rejected_orders: int = Field(..., description="Number of orders rejected")
    failed_orders: List[dict] = Field(..., description="Failed orders with reasons")
    approval_actions: List[ApprovalActionResponse] = Field(..., description="Created approval actions")


# Query parameter schemas
class ApprovalQueryParams(BaseModel):
    """Approval query parameters schema"""
    status: Optional[ApprovalStatus] = Field(None, description="Filter by approval status")
    approval_type: Optional[ApprovalType] = Field(None, description="Filter by approval type")
    approver_id: Optional[str] = Field(None, description="Filter by approver ID")
    order_id: Optional[str] = Field(None, description="Filter by order ID")
    customer_id: Optional[str] = Field(None, description="Filter by customer ID")
    date_from: Optional[datetime] = Field(None, description="Filter by date from")
    date_to: Optional[datetime] = Field(None, description="Filter by date to")


# Common response schemas
class MessageResponse(BaseModel):
    """Generic message response schema"""
    message: str = Field(..., description="Response message")


class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")