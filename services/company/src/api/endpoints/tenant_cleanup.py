"""
Internal endpoint for tenant data cleanup
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
import logging

from ...database import get_db
from ...database import (
    Branch, Customer, Vehicle, Product, ProductCategory,
    EmployeeProfile, EmployeeBranch, CustomerBranch, VehicleBranch,
    PricingRule, ServiceZone, UserInvitation, EmployeeDocument
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/tenant/{tenant_id}")
async def delete_tenant_data(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Internal endpoint to delete all data for a tenant

    Called by auth service when a tenant is deleted
    """
    try:
        # Delete in correct order to respect foreign keys

        # 1. Delete employee documents (child of employee_profiles)
        await db.execute(delete(EmployeeDocument).where(
            EmployeeDocument.employee_profile_id.in_(
                select(EmployeeProfile.id).where(EmployeeProfile.tenant_id == tenant_id)
            )
        ))

        # 2. Delete employee-branch junctions
        await db.execute(delete(EmployeeBranch).where(
            EmployeeBranch.employee_profile_id.in_(
                select(EmployeeProfile.id).where(EmployeeProfile.tenant_id == tenant_id)
            )
        ))

        # 3. Delete employee profiles (may reference other entities)
        await db.execute(delete(EmployeeProfile).where(EmployeeProfile.tenant_id == tenant_id))

        # 4. Delete user invitations
        await db.execute(delete(UserInvitation).where(UserInvitation.tenant_id == tenant_id))

        # 5. Delete product categories
        await db.execute(delete(ProductCategory).where(ProductCategory.tenant_id == tenant_id))

        # 6. Delete products
        await db.execute(delete(Product).where(Product.tenant_id == tenant_id))

        # 7. Delete vehicles
        await db.execute(delete(Vehicle).where(Vehicle.tenant_id == tenant_id))

        # 8. Delete customers
        await db.execute(delete(Customer).where(Customer.tenant_id == tenant_id))

        # 9. Delete branches
        await db.execute(delete(Branch).where(Branch.tenant_id == tenant_id))

        # 10. Delete pricing rules
        await db.execute(delete(PricingRule).where(PricingRule.tenant_id == tenant_id))

        # 11. Delete service zones
        await db.execute(delete(ServiceZone).where(ServiceZone.tenant_id == tenant_id))

        await db.commit()

        logger.info(f"Successfully deleted all data for tenant {tenant_id}")
        return {"message": "Tenant data deleted successfully"}

    except Exception as e:
        logger.error(f"Error deleting tenant data: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete tenant data: {str(e)}"
        )
