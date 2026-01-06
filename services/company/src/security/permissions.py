"""
Company-specific permissions and permission utilities
"""
from typing import List, Dict, Set, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class Permission(Enum):
    """Permission enumeration for company service"""

    # Branch Management
    BRANCH_CREATE = "branches:create"
    BRANCH_READ = "branches:read"
    BRANCH_READ_ALL = "branches:read_all"
    BRANCH_UPDATE = "branches:update"
    BRANCH_DELETE = "branches:delete"
    BRANCH_MANAGE_OWN = "branches:manage_own"
    BRANCH_MANAGE_ALL = "branches:manage_all"
    BRANCH_VIEW_METRICS = "branches:view_metrics"

    # Customer Management
    CUSTOMER_CREATE = "customers:create"
    CUSTOMER_READ = "customers:read"
    CUSTOMER_READ_OWN = "customers:read_own"
    CUSTOMER_READ_ALL = "customers:read_all"
    CUSTOMER_UPDATE = "customers:update"
    CUSTOMER_UPDATE_OWN = "customers:update_own"
    CUSTOMER_DELETE = "customers:delete"
    CUSTOMER_EXPORT = "customers:export"

    # Vehicle Management
    VEHICLE_CREATE = "vehicles:create"
    VEHICLE_READ = "vehicles:read"
    VEHICLE_READ_ALL = "vehicles:read_all"
    VEHICLE_UPDATE = "vehicles:update"
    VEHICLE_DELETE = "vehicles:delete"
    VEHICLE_ASSIGN = "vehicles:assign"
    VEHICLE_MAINTENANCE = "vehicles:maintenance"
    VEHICLE_TRACKING = "vehicles:tracking"
    VEHICLE_STATUS_UPDATE = "vehicles:status_update"

    # Product Management
    PRODUCT_CREATE = "products:create"
    PRODUCT_READ = "products:read"
    PRODUCT_READ_ALL = "products:read_all"
    PRODUCT_UPDATE = "products:update"
    PRODUCT_DELETE = "products:delete"
    PRODUCT_STOCK_ADJUST = "products:stock_adjust"
    PRODUCT_PRICING_UPDATE = "products:pricing_update"
    PRODUCT_BULK_UPDATE = "products:bulk_update"
    PRODUCT_LOW_STOCK_VIEW = "products:low_stock_view"
    PRODUCT_STOCK_HISTORY = "products:stock_history"

    # Product Categories
    PRODUCT_CATEGORIES_CREATE = "product_categories:create"
    PRODUCT_CATEGORIES_READ = "product_categories:read"
    PRODUCT_CATEGORIES_READ_ALL = "product_categories:read_all"
    PRODUCT_CATEGORIES_UPDATE = "product_categories:update"
    PRODUCT_CATEGORIES_DELETE = "product_categories:delete"
    PRODUCT_CATEGORIES_REORGANIZE = "product_categories:reorganize"

    # Service Zones
    SERVICE_ZONES_CREATE = "service_zones:create"
    SERVICE_ZONES_READ = "service_zones:read"
    SERVICE_ZONES_UPDATE = "service_zones:update"
    SERVICE_ZONES_DELETE = "service_zones:delete"

    # Pricing Rules
    PRICING_RULES_CREATE = "pricing_rules:create"
    PRICING_RULES_READ = "pricing_rules:read"
    PRICING_RULES_UPDATE = "pricing_rules:update"
    PRICING_RULES_DELETE = "pricing_rules:delete"

    # Reports and Analytics
    COMPANY_REPORTS_READ = "company_reports:read"
    COMPANY_REPORTS_READ_OWN = "company_reports:read_own"
    COMPANY_REPORTS_EXPORT = "company_reports:export"
    COMPANY_REPORTS_FINANCIAL = "company_reports:financial"
    COMPANY_REPORTS_OPERATIONAL = "company_reports:operational"

    # General Permissions
    COMPANY_SETTINGS_VIEW = "company:settings_view"
    COMPANY_SETTINGS_UPDATE = "company:settings_update"
    COMPANY_INTEGRATIONS_MANAGE = "company:integrations_manage"

    # Audit Logs
    AUDIT_READ = "audit:read"
    AUDIT_EXPORT = "audit:export"


# Permission groups for easier management
PERMISSION_GROUPS = {
    "branch_full": [
        Permission.BRANCH_CREATE.value,
        Permission.BRANCH_READ.value,
        Permission.BRANCH_READ_ALL.value,
        Permission.BRANCH_UPDATE.value,
        Permission.BRANCH_DELETE.value,
        Permission.BRANCH_MANAGE_ALL.value,
        Permission.BRANCH_VIEW_METRICS.value,
    ],
    "branch_limited": [
        Permission.BRANCH_READ.value,
        Permission.BRANCH_UPDATE.value,
        Permission.BRANCH_MANAGE_OWN.value,
        Permission.BRANCH_VIEW_METRICS.value,
    ],
    "customer_full": [
        Permission.CUSTOMER_CREATE.value,
        Permission.CUSTOMER_READ.value,
        Permission.CUSTOMER_READ_ALL.value,
        Permission.CUSTOMER_UPDATE.value,
        Permission.CUSTOMER_DELETE.value,
        Permission.CUSTOMER_EXPORT.value,
    ],
    "customer_limited": [
        Permission.CUSTOMER_READ.value,
        Permission.CUSTOMER_READ_OWN.value,
        Permission.CUSTOMER_UPDATE_OWN.value,
    ],
    "vehicle_full": [
        Permission.VEHICLE_CREATE.value,
        Permission.VEHICLE_READ.value,
        Permission.VEHICLE_READ_ALL.value,
        Permission.VEHICLE_UPDATE.value,
        Permission.VEHICLE_DELETE.value,
        Permission.VEHICLE_ASSIGN.value,
        Permission.VEHICLE_MAINTENANCE.value,
        Permission.VEHICLE_TRACKING.value,
        Permission.VEHICLE_STATUS_UPDATE.value,
    ],
    "vehicle_limited": [
        Permission.VEHICLE_READ.value,
        Permission.VEHICLE_UPDATE.value,
        Permission.VEHICLE_STATUS_UPDATE.value,
    ],
    "product_full": [
        Permission.PRODUCT_CREATE.value,
        Permission.PRODUCT_READ.value,
        Permission.PRODUCT_READ_ALL.value,
        Permission.PRODUCT_UPDATE.value,
        Permission.PRODUCT_DELETE.value,
        Permission.PRODUCT_STOCK_ADJUST.value,
        Permission.PRODUCT_PRICING_UPDATE.value,
        Permission.PRODUCT_BULK_UPDATE.value,
        Permission.PRODUCT_LOW_STOCK_VIEW.value,
        Permission.PRODUCT_STOCK_HISTORY.value,
    ],
    "product_limited": [
        Permission.PRODUCT_READ.value,
        Permission.PRODUCT_STOCK_ADJUST.value,
        Permission.PRODUCT_LOW_STOCK_VIEW.value,
    ],
    "reports_full": [
        Permission.COMPANY_REPORTS_READ.value,
        Permission.COMPANY_REPORTS_EXPORT.value,
        Permission.COMPANY_REPORTS_FINANCIAL.value,
        Permission.COMPANY_REPORTS_OPERATIONAL.value,
    ],
    "reports_limited": [
        Permission.COMPANY_REPORTS_READ_OWN.value,
    ],
    "admin_full": [
        Permission.COMPANY_SETTINGS_VIEW.value,
        Permission.COMPANY_SETTINGS_UPDATE.value,
        Permission.COMPANY_INTEGRATIONS_MANAGE.value,
    ],
}


# Role-based permission mappings
ROLE_PERMISSIONS = {
    # Super Admin has all permissions
    "super_admin": [perm.value for perm in Permission],

    # Admin can manage everything within their tenant
    "admin": (
        PERMISSION_GROUPS["branch_full"] +
        PERMISSION_GROUPS["customer_full"] +
        PERMISSION_GROUPS["vehicle_full"] +
        PERMISSION_GROUPS["product_full"] +
        PERMISSION_GROUPS["reports_full"] +
        PERMISSION_GROUPS["admin_full"] +
        [
            Permission.SERVICE_ZONES_CREATE.value,
            Permission.SERVICE_ZONES_READ.value,
            Permission.SERVICE_ZONES_UPDATE.value,
            Permission.SERVICE_ZONES_DELETE.value,
            Permission.PRICING_RULES_CREATE.value,
            Permission.PRICING_RULES_READ.value,
            Permission.PRICING_RULES_UPDATE.value,
            Permission.PRICING_RULES_DELETE.value,
            Permission.AUDIT_READ.value,
            Permission.AUDIT_EXPORT.value,
        ]
    ),

    # Manager can manage their assigned branches
    "manager": (
        PERMISSION_GROUPS["branch_limited"] +
        PERMISSION_GROUPS["customer_limited"] +
        PERMISSION_GROUPS["vehicle_limited"] +
        PERMISSION_GROUPS["product_limited"] +
        PERMISSION_GROUPS["reports_limited"] +
        [
            Permission.CUSTOMER_CREATE.value,
            Permission.CUSTOMER_READ_ALL.value,
            Permission.VEHICLE_READ_ALL.value,
            Permission.VEHICLE_ASSIGN.value,
            Permission.PRODUCT_READ_ALL.value,
        ]
    ),

    # Regular user has read-only access
    "user": (
        PERMISSION_GROUPS["customer_limited"] +
        [
            Permission.VEHICLE_READ.value,
            Permission.PRODUCT_READ.value,
            Permission.BRANCH_READ.value,
            Permission.PRODUCT_CATEGORIES_READ.value,
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
        "branches": [],
        "customers": [],
        "vehicles": [],
        "products": [],
        "product_categories": [],
        "service_zones": [],
        "pricing_rules": [],
        "reports": [],
        "company": [],
        "other": []
    }

    for perm in permissions:
        if perm.startswith("branches:"):
            grouped["branches"].append(perm)
        elif perm.startswith("customers:"):
            grouped["customers"].append(perm)
        elif perm.startswith("vehicles:"):
            grouped["vehicles"].append(perm)
        elif perm.startswith("products:"):
            grouped["products"].append(perm)
        elif perm.startswith("product_categories:"):
            grouped["product_categories"].append(perm)
        elif perm.startswith("service_zones:"):
            grouped["service_zones"].append(perm)
        elif perm.startswith("pricing_rules:"):
            grouped["pricing_rules"].append(perm)
        elif perm.startswith("company_reports:"):
            grouped["reports"].append(perm)
        elif perm.startswith("company:"):
            grouped["company"].append(perm)
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
BRANCH_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("branches:")]
CUSTOMER_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("customers:")]
VEHICLE_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("vehicles:")]
PRODUCT_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("products:")]
REPORT_PERMISSIONS = [perm.value for perm in Permission if perm.value.startswith("company_reports:")]