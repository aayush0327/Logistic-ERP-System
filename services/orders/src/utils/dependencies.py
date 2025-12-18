"""
FastAPI dependencies
"""
from typing import Callable, List
from uuid import UUID
from functools import wraps

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.utils.auth import get_current_user, check_user_permission


security = HTTPBearer()
def require_permissions(permission_list: List[str]):
    async def permission_dependency(
        current_user: dict = Depends(get_current_user)
    ):
        for permission in permission_list:
            has_permission = await check_user_permission(
                current_user["id"],
                permission
            )
            if not has_permission:
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: {permission}"
                )
        return current_user

    return permission_dependency


def require_role(role: str):
    """Dependency to require specific role"""
    async def role_dependency(
        current_user: dict = Depends(get_current_user)
    ):
        if current_user.get("role") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role required: {role}"
            )
        return current_user

    return role_dependency


def require_any_role(roles: List[str]):
    """Dependency to require any of the specified roles"""
    async def role_dependency(
        current_user: dict = Depends(get_current_user)
    ):
        if current_user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {', '.join(roles)}"
            )
        return current_user

    return role_dependency


# Common permission combinations
require_orders_create = require_permissions(["orders", "create"])
require_orders_read = require_permissions(["orders", "read"])
require_orders_update = require_permissions(["orders", "update"])
require_orders_delete = require_permissions(["orders", "delete"])
require_orders_finance_approve = require_permissions(["orders", "finance_approve"])
require_orders_logistics_approve = require_permissions(["orders", "logistics_approve"])
require_orders_verify = require_permissions(["orders", "verify"])

# Common role dependencies
require_finance_manager = require_role("finance_manager")
require_logistics_manager = require_role("logistics_manager")
require_branch_manager = require_role("branch_manager")
require_driver = require_role("driver")
require_manager_or_admin = require_any_role(["branch_manager", "logistics_manager", "admin"])