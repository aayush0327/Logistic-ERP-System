"""
Import all schemas
"""
from src.schemas.order import (
    OrderBase,
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
    OrderStatusHistoryResponse,
)
from src.schemas.common import PaginatedResponse
from src.schemas.order_item import (
    OrderItemBase,
    OrderItemCreate,
    OrderItemUpdate,
    OrderItemResponse,
)
from src.schemas.order_document import (
    OrderDocumentBase,
    OrderDocumentCreate,
    OrderDocumentUpdate,
    OrderDocumentResponse,
    DocumentVerificationRequest,
    DocumentUploadResponse,
    DocumentListResponse,
)
from src.schemas.external import (
    Branch,
    Product,
    Customer
)

__all__ = [
    # Common schemas
    "PaginatedResponse",

    # Order schemas
    "OrderBase",
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "OrderListResponse",
    "OrderListPaginatedResponse",
    "OrderStatusUpdate",
    "TmsOrderStatusUpdate",
    "ItemStatusUpdate",
    "FinanceApprovalRequest",
    "LogisticsApprovalRequest",
    "OrderQueryParams",
    "OrderStatusHistoryResponse",

    # Order item schemas
    "OrderItemBase",
    "OrderItemCreate",
    "OrderItemUpdate",
    "OrderItemResponse",

    # Order document schemas
    "OrderDocumentBase",
    "OrderDocumentCreate",
    "OrderDocumentUpdate",
    "OrderDocumentResponse",
    "DocumentVerificationRequest",
    "DocumentUploadResponse",
    "DocumentListResponse",

    # External service schemas
    "Branch",
    "Product",
    "Customer",
]
