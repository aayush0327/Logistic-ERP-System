"""
Helper functions for validating foreign key references
"""
from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
import logging

from src.database import (
    Branch,
    EmployeeProfile,
    ProductCategory,
    Customer,
    Vehicle,
    Product
)
from src.config_local import settings

logger = logging.getLogger(__name__)


async def validate_branch_exists(
    db: AsyncSession,
    branch_id: Optional[UUID],
    tenant_id: str
) -> Optional[Branch]:
    """
    Validate that a branch exists for the given tenant

    Args:
        db: Database session
        branch_id: Branch UUID to validate (optional)
        tenant_id: Tenant ID for scoping

    Returns:
        Branch object if found, None if branch_id is None

    Raises:
        ValueError: If branch_id is provided but branch doesn't exist
    """
    if branch_id is None:
        return None

    query = select(Branch).where(
        Branch.id == branch_id,
        Branch.tenant_id == tenant_id
    )
    result = await db.execute(query)
    branch = result.scalar_one_or_none()

    if not branch:
        raise ValueError(f"Branch with ID {branch_id} not found")

    return branch


async def validate_role_exists(
    db: AsyncSession,
    role_id: str,
    tenant_id: str
) -> dict:
    """
    Validate that a role exists in the auth service

    Now queries auth service instead of company_roles table since roles are managed centrally

    Args:
        db: Database session (unused, kept for backward compatibility)
        role_id: Role ID to validate (can be string or int)
        tenant_id: Tenant ID for scoping (unused, auth handles this)

    Returns:
        Role dict if found

    Raises:
        ValueError: If role doesn't exist
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Call auth service to get all roles
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/roles/",
                headers={"Accept": "application/json"}
            )

            if response.status_code != 200:
                raise ValueError(f"Unable to validate role: Auth service returned {response.status_code}")

            roles = response.json()

            # Find role by ID (handle both string and int IDs)
            role_id_int = int(role_id) if role_id.isdigit() else role_id
            role = next((r for r in roles if r["id"] == role_id_int), None)

            if not role:
                raise ValueError(f"Role with ID {role_id} not found in auth service")

            return role

    except httpx.RequestError as e:
        logger.error(f"Error calling auth service for role validation: {e}")
        raise ValueError(f"Unable to validate role: Auth service unavailable")


async def validate_employee_exists(
    db: AsyncSession,
    employee_id: str,
    tenant_id: str
) -> EmployeeProfile:
    """
    Validate that an employee profile exists for the given tenant

    Args:
        db: Database session
        employee_id: Employee ID to validate
        tenant_id: Tenant ID for scoping

    Returns:
        EmployeeProfile object if found

    Raises:
        ValueError: If employee doesn't exist
    """
    query = select(EmployeeProfile).where(
        EmployeeProfile.id == employee_id,
        EmployeeProfile.tenant_id == tenant_id
    )
    result = await db.execute(query)
    employee = result.scalar_one_or_none()

    if not employee:
        raise ValueError(f"Employee with ID {employee_id} not found")

    return employee


async def validate_category_exists(
    db: AsyncSession,
    category_id: Optional[UUID],
    tenant_id: str
) -> Optional[ProductCategory]:
    """
    Validate that a product category exists for the given tenant

    Args:
        db: Database session
        category_id: Category UUID to validate (optional)
        tenant_id: Tenant ID for scoping

    Returns:
        ProductCategory object if found, None if category_id is None

    Raises:
        ValueError: If category_id is provided but category doesn't exist
    """
    if category_id is None:
        return None

    query = select(ProductCategory).where(
        ProductCategory.id == category_id,
        ProductCategory.tenant_id == tenant_id
    )
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise ValueError(f"Product category with ID {category_id} not found")

    return category


async def validate_customer_exists(
    db: AsyncSession,
    customer_id: Optional[UUID],
    tenant_id: str
) -> Optional[Customer]:
    """
    Validate that a customer exists for the given tenant

    Args:
        db: Database session
        customer_id: Customer UUID to validate (optional)
        tenant_id: Tenant ID for scoping

    Returns:
        Customer object if found, None if customer_id is None

    Raises:
        ValueError: If customer_id is provided but customer doesn't exist
    """
    if customer_id is None:
        return None

    query = select(Customer).where(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    )
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise ValueError(f"Customer with ID {customer_id} not found")

    return customer


async def validate_product_exists(
    db: AsyncSession,
    product_id: UUID,
    tenant_id: str
) -> Product:
    """
    Validate that a product exists for the given tenant

    Args:
        db: Database session
        product_id: Product UUID to validate
        tenant_id: Tenant ID for scoping

    Returns:
        Product object if found

    Raises:
        ValueError: If product doesn't exist
    """
    query = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise ValueError(f"Product with ID {product_id} not found")

    return product


async def validate_employee_reporting_hierarchy(
    db: AsyncSession,
    employee_id: str,
    reports_to_id: Optional[str],
    tenant_id: str
) -> bool:
    """
    Validate that the reporting hierarchy doesn't create circular references

    Args:
        db: Database session
        employee_id: Current employee ID
        reports_to_id: Manager ID to validate (optional)
        tenant_id: Tenant ID for scoping

    Returns:
        True if hierarchy is valid

    Raises:
        ValueError: If circular reference would be created
    """
    if not reports_to_id or reports_to_id == employee_id:
        return True

    # Check if reports_to_id would create a circular reference
    current_manager = reports_to_id
    visited = set()

    while current_manager and current_manager not in visited:
        visited.add(current_manager)

        query = select(EmployeeProfile.reports_to).where(
            EmployeeProfile.id == current_manager,
            EmployeeProfile.tenant_id == tenant_id
        )
        result = await db.execute(query)
        current_manager = result.scalar()

        if current_manager == employee_id:
            raise ValueError("Circular reference in reporting hierarchy detected")

    return True