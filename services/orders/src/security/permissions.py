"""
Orders-specific permissions and permission utilities
"""
from typing import List, Dict, Set, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class Permission(Enum):
    """Permission enumeration for orders service"""

    # Order Management
    ORDER_CREATE = "orders:create"
    ORDER_READ = "orders:read"
    ORDER_READ_OWN = "orders:read_own"
    ORDER_READ_ALL = "orders:read_all"
    ORDER_UPDATE = "orders:update"
    ORDER_UPDATE_OWN = "orders:update_own"
    ORDER_DELETE = "orders:delete"
    ORDER_DELETE_OWN = "orders:delete_own"
    ORDER_CANCEL = "orders:cancel"
    ORDER_EXPORT = "orders:export"
    ORDER_IMPORT = "orders:import"

    # Order Status Management
    ORDER_STATUS_UPDATE = "orders:status_update"
    ORDER_PRIORITY_UPDATE = "orders:priority_update"
    ORDER_ASSIGN = "orders:assign"

    # Order Approvals
    ORDER_APPROVE_FINANCE = "orders:approve_finance"
    ORDER_APPROVE_LOGISTICS = "orders:approve_logistics"
    ORDER_APPROVE_ANY = "orders:approve_any"
    ORDER_BULK_APPROVE = "orders:bulk_approve"

    # Order Financial Operations
    ORDER_FINANCIAL_VIEW = "orders:financial_view"
    ORDER_FINANCIAL_EDIT = "orders:financial_edit"
    ORDER_PAYMENT_PROCESS = "orders:payment_process"
    ORDER_REFUND_PROCESS = "orders:refund_process"
    ORDER_INVOICE_CREATE = "orders:invoice_create"

    # Order Logistics Operations
    ORDER_LOGISTICS_VIEW = "orders:logistics_view"
    ORDER_LOGISTICS_EDIT = "orders:logistics_edit"
    ORDER_SHIPMENT_CREATE = "orders:shipment_create"
    ORDER_TRACKING_UPDATE = "orders:tracking_update"
    ORDER_DELIVERY_CONFIRM = "orders:delivery_confirm"

    # Order Documents
    ORDER_DOCUMENTS_UPLOAD = "order_documents:upload"
    ORDER_DOCUMENTS_READ = "order_documents:read"
    ORDER_DOCUMENTS_READ_OWN = "order_documents:read_own"
    ORDER_DOCUMENTS_UPDATE = "order_documents:update"
    ORDER_DOCUMENTS_UPDATE_OWN = "order_documents:update_own"
    ORDER_DOCUMENTS_DELETE = "order_documents:delete"
    ORDER_DOCUMENTS_DELETE_OWN = "order_documents:delete_own"
    ORDER_DOCUMENTS_VERIFY = "order_documents:verify"
    ORDER_DOCUMENTS_DOWNLOAD = "order_documents:download"

    # Order Reports
    ORDER_REPORTS_READ = "order_reports:read"
    ORDER_REPORTS_READ_OWN = "order_reports:read_own"
    ORDER_REPORTS_CREATE = "order_reports:create"
    ORDER_REPORTS_EXPORT = "order_reports:export"
    ORDER_REPORTS_FINANCIAL = "order_reports:financial"
    ORDER_REPORTS_OPERATIONAL = "order_reports:operational"

    # Order Analytics
    ORDER_ANALYTICS_VIEW = "order_analytics:view"
    ORDER_ANALYTICS_DASHBOARD = "order_analytics:dashboard"
    ORDER_METRICS_VIEW = "order_metrics:view"

    # Order Bulk Operations
    ORDER_BULK_CREATE = "orders:bulk_create"
    ORDER_BULK_UPDATE = "orders:bulk_update"
    ORDER_BULK_CANCEL = "orders:bulk_cancel"
    ORDER_BULK_DELETE = "orders:bulk_delete"

    # Order Templates
    ORDER_TEMPLATES_CREATE = "order_templates:create"
    ORDER_TEMPLATES_READ = "order_templates:read"
    ORDER_TEMPLATES_UPDATE = "order_templates:update"
    ORDER_TEMPLATES_DELETE = "order_templates:delete"

    # General Permissions
    ORDER_SETTINGS_VIEW = "orders:settings_view"
    ORDER_SETTINGS_UPDATE = "orders:settings_update"
    ORDER_INTEGRATIONS_MANAGE = "orders:integrations_manage"


# Permission groups for easier management
PERMISSION_GROUPS = {
    "order_full": [
        Permission.ORDER_CREATE.value,
        Permission.ORDER_READ.value,
        Permission.ORDER_READ_ALL.value,
        Permission.ORDER_UPDATE.value,
        Permission.ORDER_DELETE.value,
        Permission.ORDER_CANCEL.value,
        Permission.ORDER_EXPORT.value,
        Permission.ORDER_IMPORT.value,
        Permission.ORDER_STATUS_UPDATE.value,
        Permission.ORDER_PRIORITY_UPDATE.value,
        Permission.ORDER_ASSIGN.value,
        Permission.ORDER_APPROVE_FINANCE.value,
        Permission.ORDER_APPROVE_LOGISTICS.value,
        Permission.ORDER_APPROVE_ANY.value,
        Permission.ORDER_BULK_APPROVE.value,
        Permission.ORDER_FINANCIAL_VIEW.value,
        Permission.ORDER_FINANCIAL_EDIT.value,
        Permission.ORDER_PAYMENT_PROCESS.value,
        Permission.ORDER_REFUND_PROCESS.value,
        Permission.ORDER_INVOICE_CREATE.value,
        Permission.ORDER_LOGISTICS_VIEW.value,
        Permission.ORDER_LOGISTICS_EDIT.value,
        Permission.ORDER_SHIPMENT_CREATE.value,
        Permission.ORDER_TRACKING_UPDATE.value,
        Permission.ORDER_DELIVERY_CONFIRM.value,
        Permission.ORDER_BULK_CREATE.value,
        Permission.ORDER_BULK_UPDATE.value,
        Permission.ORDER_BULK_CANCEL.value,
        Permission.ORDER_BULK_DELETE.value,
    ],
    "order_limited": [
        Permission.ORDER_READ.value,
        Permission.ORDER_READ_OWN.value,
        Permission.ORDER_UPDATE_OWN.value,
        Permission.ORDER_CANCEL.value,
        Permission.ORDER_STATUS_UPDATE.value,
    ],
    "order_financial": [
        Permission.ORDER_FINANCIAL_VIEW.value,
        Permission.ORDER_FINANCIAL_EDIT.value,
        Permission.ORDER_PAYMENT_PROCESS.value,
        Permission.ORDER_REFUND_PROCESS.value,
        Permission.ORDER_INVOICE_CREATE.value,
        Permission.ORDER_REPORTS_FINANCIAL.value,
    ],
    "order_logistics": [
        Permission.ORDER_LOGISTICS_VIEW.value,
        Permission.ORDER_LOGISTICS_EDIT.value,
        Permission.ORDER_SHIPMENT_CREATE.value,
        Permission.ORDER_TRACKING_UPDATE.value,
        Permission.ORDER_DELIVERY_CONFIRM.value,
        Permission.ORDER_REPORTS_OPERATIONAL.value,
    ],
    "order_approval": [
        Permission.ORDER_APPROVE_FINANCE.value,
        Permission.ORDER_APPROVE_LOGISTICS.value,
        Permission.ORDER_BULK_APPROVE.value,
        Permission.ORDER_STATUS_UPDATE.value,
    ],
    "documents_full": [
        Permission.ORDER_DOCUMENTS_UPLOAD.value,
        Permission.ORDER_DOCUMENTS_READ.value,
        Permission.ORDER_DOCUMENTS_UPDATE.value,
        Permission.ORDER_DOCUMENTS_DELETE.value,
        Permission.ORDER_DOCUMENTS_VERIFY.value,
        Permission.ORDER_DOCUMENTS_DOWNLOAD.value,
    ],
    "documents_limited": [
        Permission.ORDER_DOCUMENTS_READ.value,
        Permission.ORDER_DOCUMENTS_READ_OWN.value,
        Permission.ORDER_DOCUMENTS_UPDATE_OWN.value,
        Permission.ORDER_DOCUMENTS_DOWNLOAD.value,
    ],
    "reports_full": [
        Permission.ORDER_REPORTS_READ.value,
        Permission.ORDER_REPORTS_CREATE.value,
        Permission.ORDER_REPORTS_EXPORT.value,
        Permission.ORDER_REPORTS_FINANCIAL.value,
        Permission.ORDER_REPORTS_OPERATIONAL.value,
        Permission.ORDER_ANALYTICS_VIEW.value,
        Permission.ORDER_ANALYTICS_DASHBOARD.value,
        Permission.ORDER_METRICS_VIEW.value,
    ],
    "reports_limited": [
        Permission.ORDER_REPORTS_READ_OWN.value,
    ],
    "templates_full": [
        Permission.ORDER_TEMPLATES_CREATE.value,
        Permission.ORDER_TEMPLATES_READ.value,
        Permission.ORDER_TEMPLATES_UPDATE.value,
        Permission.ORDER_TEMPLATES_DELETE.value,
    ],
    "admin_full": [
        Permission.ORDER_SETTINGS_VIEW.value,
        Permission.ORDER_SETTINGS_UPDATE.value,
        Permission.ORDER_INTEGRATIONS_MANAGE.value,
    ],
}


# Role-based permission mappings
ROLE_PERMISSIONS = {
    # Super Admin has all permissions
    "super_admin": [perm.value for perm in Permission],

    # Admin can manage everything within their tenant
    "admin": (
        PERMISSION_GROUPS["order_full"] +
        PERMISSION_GROUPS["documents_full"] +
        PERMISSION_GROUPS["reports_full"] +
        PERMISSION_GROUPS["templates_full"] +
        PERMISSION_GROUPS["admin_full"] +
        [
            Permission.ORDER_BULK_CREATE.value,
            Permission.ORDER_BULK_UPDATE.value,
            Permission.ORDER_BULK_CANCEL.value,
            Permission.ORDER_BULK_DELETE.value,
        ]
    ),

    # Finance Manager can handle financial aspects
    "finance_manager": (
        PERMISSION_GROUPS["order_limited"] +
        PERMISSION_GROUPS["order_financial"] +
        PERMISSION_GROUPS["order_approval"] +
        PERMISSION_GROUPS["documents_limited"] +
        PERMISSION_GROUPS["reports_limited"] +
        [
            Permission.ORDER_READ_ALL.value,
            Permission.ORDER_EXPORT.value,
        ]
    ),

    # Logistics Manager can handle logistics aspects
    "logistics_manager": (
        PERMISSION_GROUPS["order_limited"] +
        PERMISSION_GROUPS["order_logistics"] +
        PERMISSION_GROUPS["order_approval"] +
        PERMISSION_GROUPS["documents_limited"] +
        PERMISSION_GROUPS["reports_limited"] +
        [
            Permission.ORDER_READ_ALL.value,
            Permission.ORDER_EXPORT.value,
        ]
    ),

    # Sales Manager can manage orders
    "sales_manager": (
        PERMISSION_GROUPS["order_limited"] +
        PERMISSION_GROUPS["order_approval"] +
        PERMISSION_GROUPS["documents_limited"] +
        PERMISSION_GROUPS["templates_full"] +
        PERMISSION_GROUPS["reports_limited"] +
        [
            Permission.ORDER_CREATE.value,
            Permission.ORDER_READ_ALL.value,
            Permission.ORDER_EXPORT.value,
            Permission.ORDER_ASSIGN.value,
            Permission.ORDER_PRIORITY_UPDATE.value,
        ]
    ),

    # Operations Manager can handle day-to-day operations
    "operations_manager": (
        PERMISSION_GROUPS["order_limited"] +
        PERMISSION_GROUPS["order_logistics"] +
        PERMISSION_GROUPS["documents_limited"] +
        PERMISSION_GROUPS["templates_full"] +
        [
            Permission.ORDER_CREATE.value,
            Permission.ORDER_READ_ALL.value,
            Permission.ORDER_EXPORT.value,
            Permission.ORDER_STATUS_UPDATE.value,
            Permission.ORDER_ASSIGN.value,
        ]
    ),

    # Customer Service can view and update orders
    "customer_service": (
        PERMISSION_GROUPS["order_limited"] +
        PERMISSION_GROUPS["documents_limited"] +
        PERMISSION_GROUPS["reports_limited"] +
        [
            Permission.ORDER_READ_ALL.value,
            Permission.ORDER_STATUS_UPDATE.value,
            Permission.ORDER_CANCEL.value,
        ]
    ),

    # Regular user has limited access to their own orders
    "user": (
        [
            Permission.ORDER_CREATE.value,
            Permission.ORDER_READ_OWN.value,
            Permission.ORDER_UPDATE_OWN.value,
            Permission.ORDER_CANCEL.value,
            Permission.ORDER_DOCUMENTS_READ_OWN.value,
            Permission.ORDER_DOCUMENTS_UPLOAD.value,
            Permission.ORDER_DOCUMENTS_UPDATE_OWN.value,
            Permission.ORDER_DOCUMENTS_DELETE_OWN.value,
            Permission.ORDER_REPORTS_READ_OWN.value,
        ]
    ),
}


class PermissionChecker:
    """Utility class for checking permissions"""

    @staticmethod
    def has_permission(user_permissions: List[str], required_permission: str) -> bool:
        """Check if user has specific permission"""
        return required_permission in user_permissions

    @staticmethod
    def has_any_permission(user_permissions: List[str], required_permissions: List[str]) -> bool:
        """Check if user has any of the required permissions"""
        return any(perm in user_permissions for perm in required_permissions)

    @staticmethod
    def has_all_permissions(user_permissions: List[str], required_permissions: List[str]) -> bool:
        """Check if user has all required permissions"""
        return all(perm in user_permissions for perm in required_permissions)

    @staticmethod
    def has_permission_group(user_permissions: List[str], group_name: str) -> bool:
        """Check if user has all permissions in a permission group"""
        if group_name not in PERMISSION_GROUPS:
            logger.warning(f"Unknown permission group: {group_name}")
            return False

        group_permissions = PERMISSION_GROUPS[group_name]
        return PermissionChecker.has_all_permissions(user_permissions, group_permissions)

    @staticmethod
    def can_access_resource(
        user_permissions: List[str],
        user_role: str,
        user_tenant_id: str,
        resource_tenant_id: str,
        user_branch_ids: List[str] = None,
        resource_branch_id: str = None,
        user_id: str = None,
        resource_owner_id: str = None
    ) -> bool:
        """
        Comprehensive access check for resources

        Args:
            user_permissions: List of user permissions
            user_role: User's role
            user_tenant_id: User's tenant ID
            resource_tenant_id: Resource's tenant ID
            user_branch_ids: List of branch IDs user can access
            resource_branch_id: Resource's branch ID
            user_id: User's ID
            resource_owner_id: Resource owner's ID

        Returns:
            True if user can access the resource
        """
        # Super admin can access everything
        if PermissionChecker.has_permission(user_permissions, "superuser:access"):
            return True

        # Tenant check - users can only access their own tenant resources
        if user_tenant_id != resource_tenant_id:
            return False

        # Owner check - users can access their own resources
        if user_id and resource_owner_id and str(user_id) == str(resource_owner_id):
            return True

        # Branch check - for managers with branch restrictions
        if user_branch_ids and resource_branch_id:
            if resource_branch_id not in user_branch_ids:
                return False

        # Role-based access check
        role_perms = ROLE_PERMISSIONS.get(user_role, [])
        required_perms = ROLE_PERMISSIONS.get(user_role, [])

        # Check if user has the necessary permissions for their role
        return any(perm in user_permissions for perm in required_perms)

    @staticmethod
    def get_permissions_for_role(role: str) -> List[str]:
        """Get all permissions for a specific role"""
        return ROLE_PERMISSIONS.get(role, [])

    @staticmethod
    def validate_permission_exists(permission: str) -> bool:
        """Check if a permission exists in the system"""
        return permission in [perm.value for perm in Permission]


def get_readable_permissions(permissions: List[str]) -> Dict[str, List[str]]:
    """
    Group permissions by resource for better readability

    Args:
        permissions: List of permission strings

    Returns:
        Dictionary with resource names as keys and permission lists as values
    """
    grouped = {
        "orders": [],
        "order_documents": [],
        "order_reports": [],
        "order_analytics": [],
        "order_metrics": [],
        "order_templates": [],
        "order_settings": [],
        "other": []
    }

    for perm in permissions:
        if perm.startswith("orders:"):
            grouped["orders"].append(perm)
        elif perm.startswith("order_documents:"):
            grouped["order_documents"].append(perm)
        elif perm.startswith("order_reports:"):
            grouped["order_reports"].append(perm)
        elif perm.startswith("order_analytics:"):
            grouped["order_analytics"].append(perm)
        elif perm.startswith("order_metrics:"):
            grouped["order_metrics"].append(perm)
        elif perm.startswith("order_templates:"):
            grouped["order_templates"].append(perm)
        elif perm.startswith("order_settings:"):
            grouped["order_settings"].append(perm)
        else:
            grouped["other"].append(perm)

    # Remove empty groups
    return {k: v for k, v in grouped.items() if v}


def validate_permissions(permissions: List[str]) -> List[str]:
    """
    Validate and filter valid permissions

    Args:
        permissions: List of permission strings to validate

    Returns:
        List of valid permissions
    """
    valid_permissions = []

    for perm in permissions:
        if PermissionChecker.validate_permission_exists(perm):
            valid_permissions.append(perm)
        else:
            logger.warning(f"Unknown permission: {perm}")

    return valid_permissions


# Export commonly used permission lists
ORDER_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("orders:")]
ORDER_DOCUMENT_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("order_documents:")]
ORDER_REPORT_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("order_reports:")]