"""
Tenant isolation utilities for Company Service
"""
from typing import Optional, Any, Dict
from sqlalchemy import Select, Table, Column
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
import logging

from ..security import TokenData, TenantAccessError

logger = logging.getLogger(__name__)


def add_tenant_filter(
    query: Select,
    model_class: Any,
    tenant_id: str
) -> Select:
    """
    Add tenant isolation filter to SQLAlchemy query

    Args:
        query: SQLAlchemy Select query
        model_class: Model class to filter
        tenant_id: Tenant ID to filter by

    Returns:
        Query with tenant filter applied
    """
    # Check if model has tenant_id column
    if hasattr(model_class, 'tenant_id'):
        return query.where(model_class.tenant_id == tenant_id)

    # If model doesn't have tenant_id, return original query
    # (for models that don't support multi-tenancy)
    return query


async def verify_tenant_access(
    token_data: TokenData,
    resource_tenant_id: str
) -> bool:
    """
    Verify if user can access resource from specific tenant

    Args:
        token_data: User's token data
        resource_tenant_id: Tenant ID of the resource

    Returns:
        True if access is allowed, False otherwise

    Raises:
        TenantAccessError: If access is denied
    """
    # Super admins can access any tenant
    if token_data.is_super_user():
        return True

    # Check if user belongs to the resource's tenant
    if token_data.tenant_id != resource_tenant_id:
        raise TenantAccessError(
            user_tenant_id=token_data.tenant_id,
            resource_tenant_id=resource_tenant_id
        )

    return True


async def set_tenant_context(db_session: AsyncSession, tenant_id: str) -> None:
    """
    Set tenant context for database session (for RLS)

    Args:
        db_session: Database session
        tenant_id: Tenant ID to set as context
    """
    try:
        # Set PostgreSQL session variable for RLS policies
        await db_session.execute(
            text("SET app.current_tenant_id = :tenant_id"),
            {"tenant_id": tenant_id}
        )
    except Exception as e:
        logger.warning(f"Failed to set tenant context: {str(e)}")
        # Continue without RLS if we can't set the context


async def clear_tenant_context(db_session: AsyncSession) -> None:
    """
    Clear tenant context from database session

    Args:
        db_session: Database session
    """
    try:
        # Clear PostgreSQL session variable
        await db_session.execute(text("RESET app.current_tenant_id"))
    except Exception as e:
        logger.warning(f"Failed to clear tenant context: {str(e)}")


class TenantQueryHelper:
    """Helper class for building tenant-aware queries"""

    def __init__(self, tenant_id: str, is_super_user: bool = False):
        self.tenant_id = tenant_id
        self.is_super_user = is_super_user

    def filter_by_tenant(self, query: Select, model_class: Any) -> Select:
        """Add tenant filter to query"""
        if self.is_super_user:
            # Super users can see all data across all tenants
            return query

        return add_tenant_filter(query, model_class, self.tenant_id)

    def can_access_tenant(self, resource_tenant_id: str) -> bool:
        """Check if user can access specific tenant"""
        if self.is_super_user:
            return True

        return self.tenant_id == resource_tenant_id


def get_tenant_scoped_count(
    db_session: AsyncSession,
    model_class: Any,
    tenant_id: str,
    additional_filters: list = None
) -> int:
    """
    Get count of records scoped to tenant

    Args:
        db_session: Database session
        model_class: Model class to count
        tenant_id: Tenant ID to scope by
        additional_filters: Additional where clauses

    Returns:
        Count of records
    """
    from sqlalchemy import func, select

    query = select(func.count()).select_from(model_class)
    query = add_tenant_filter(query, model_class, tenant_id)

    if additional_filters:
        for filter_condition in additional_filters:
            query = query.where(filter_condition)

    result = db_session.execute(query)
    return result.scalar() or 0


async def get_user_accessible_branches(
    db_session: AsyncSession,
    user_id: str,
    tenant_id: str,
    user_permissions: list,
    is_super_user: bool = False
) -> list:
    """
    Get list of branches user can access

    Args:
        db_session: Database session
        user_id: User ID
        tenant_id: User's tenant ID
        user_permissions: User's permissions
        is_super_user: Whether user is super admin

    Returns:
        List of branch IDs user can access

    Note:
        This is a placeholder implementation. In a real system,
        you would query a user_branches table or similar to
        determine branch assignments.
    """
    from sqlalchemy import select
    from ..database import Branch

    # Super users can access all branches
    if is_super_user or "branches:manage_all" in user_permissions:
        query = select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.is_active == True)
        result = await db_session.execute(query)
        return [row[0] for row in result.fetchall()]

    # Users with branches:read_all can see all branches
    if "branches:read_all" in user_permissions:
        query = select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.is_active == True)
        result = await db_session.execute(query)
        return [row[0] for row in result.fetchall()]

    # TODO: Implement branch assignment logic for users with branches:manage_own
    # This would typically query a user_branches association table
    # For now, return empty list (no branch access)
    return []


async def check_resource_ownership(
    db_session: AsyncSession,
    model_class: Any,
    resource_id: str,
    user_id: str,
    tenant_id: str,
    owner_field: str = "created_by"
) -> bool:
    """
    Check if user owns a specific resource

    Args:
        db_session: Database session
        model_class: Model class of resource
        resource_id: ID of resource
        user_id: User ID to check ownership
        tenant_id: Tenant ID
        owner_field: Field name that stores owner ID

    Returns:
        True if user owns the resource, False otherwise
    """
    from sqlalchemy import select

    query = select(model_class).where(
        model_class.id == resource_id,
        model_class.tenant_id == tenant_id
    )

    # Add ownership check if model has the owner field
    if hasattr(model_class, owner_field):
        query = query.where(getattr(model_class, owner_field) == user_id)

    result = await db_session.execute(query)
    return result.scalar_one_or_none() is not None


def create_tenant_audit_fields(
    create_data: Dict[str, Any],
    user_id: str,
    operation: str = "create"
) -> Dict[str, Any]:
    """
    Add tenant audit fields to data dictionary

    Args:
        create_data: Original data dictionary
        user_id: User ID performing operation
        operation: Type of operation (create/update)

    Returns:
        Data dictionary with audit fields added
    """
    if operation == "create":
        create_data["created_by"] = user_id
    elif operation == "update":
        create_data["updated_by"] = user_id
    elif operation == "delete":
        create_data["deleted_by"] = user_id

    return create_data


# Common tenant validation patterns
class TenantValidators:
    """Common validation patterns for tenant access"""

    @staticmethod
    def validate_cross_tenant_access(
        user_tenant_id: str,
        resource_tenant_id: str,
        user_permissions: list,
        raise_exception: bool = True
    ) -> bool:
        """
        Validate cross-tenant access based on permissions

        Args:
            user_tenant_id: User's tenant ID
            resource_tenant_id: Resource's tenant ID
            user_permissions: User's permissions
            raise_exception: Whether to raise exception on denied access

        Returns:
            True if access is allowed

        Raises:
            TenantAccessError: If access is denied and raise_exception is True
        """
        # Check for super admin access
        if "superuser:access" in user_permissions:
            return True

        # Check for cross-tenant management permissions
        if "tenants:manage_all" in user_permissions:
            return True

        # Check if resource belongs to user's tenant
        if user_tenant_id == resource_tenant_id:
            return True

        # Access denied
        if raise_exception:
            raise TenantAccessError(
                user_tenant_id=user_tenant_id,
                resource_tenant_id=resource_tenant_id,
                details={
                    "user_permissions": user_permissions,
                    "reason": "No cross-tenant access permissions"
                }
            )

        return False

    @staticmethod
    def validate_branch_access(
        user_id: str,
        branch_id: str,
        user_permissions: list,
        accessible_branches: list = None
    ) -> bool:
        """
        Validate user can access specific branch

        Args:
            user_id: User ID
            branch_id: Branch ID to access
            user_permissions: User's permissions
            accessible_branches: List of branches user can access

        Returns:
            True if branch access is allowed
        """
        # Super admins and branch managers can access all branches
        if ("superuser:access" in user_permissions or
            "branches:manage_all" in user_permissions):
            return True

        # Check if branch is in user's accessible branches
        if accessible_branches and branch_id in accessible_branches:
            return True

        # Check for full branch read access
        if "branches:read_all" in user_permissions:
            return True

        return False