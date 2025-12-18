"""
Utility modules
"""
from src.utils.auth import get_current_user, get_tenant_id, check_user_permission
from src.utils.dependencies import (
    require_permissions,
    require_role,
    require_any_role,
    require_orders_create,
    require_orders_read,
    require_orders_update,
    require_orders_delete,
    require_orders_finance_approve,
    require_orders_logistics_approve,
    require_orders_verify,
    require_finance_manager,
    require_logistics_manager,
    require_branch_manager,
    require_driver,
    require_manager_or_admin,
)
from src.utils.file_handler import FileHandler

__all__ = [
    # Auth utilities
    "get_current_user",
    "get_tenant_id",
    "check_user_permission",

    # Dependencies
    "require_permissions",
    "require_role",
    "require_any_role",
    "require_orders_create",
    "require_orders_read",
    "require_orders_update",
    "require_orders_delete",
    "require_orders_finance_approve",
    "require_orders_logistics_approve",
    "require_orders_verify",
    "require_finance_manager",
    "require_logistics_manager",
    "require_branch_manager",
    "require_driver",
    "require_manager_or_admin",

    # File handler
    "FileHandler",
]
