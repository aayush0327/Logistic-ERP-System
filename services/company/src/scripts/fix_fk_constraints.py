"""
Script to fix foreign key constraint violations in the database
This script identifies and helps fix orphaned records that violate FK constraints
"""
import sys
import asyncio
import logging
from uuid import UUID
from pathlib import Path
from typing import Dict, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.database import AsyncSessionLocal, EmployeeProfile, UserInvitation, BranchManagerProfile, Branch, CompanyRole

logger = logging.getLogger(__name__)


async def get_orphaned_employee_profiles(db: AsyncSession) -> List[Dict]:
    """Get employee profiles with invalid branch_id references"""
    query = text("""
        SELECT ep.id, ep.branch_id, ep.tenant_id
        FROM employee_profiles ep
        LEFT JOIN branches b ON ep.branch_id = b.id
        WHERE ep.branch_id IS NOT NULL
        AND b.id IS NULL
    """)

    result = await db.execute(query)
    return [{"id": row[0], "branch_id": row[1], "tenant_id": row[2]} for row in result.fetchall()]


async def get_orphaned_user_invitations(db: AsyncSession) -> List[Dict]:
    """Get user invitations with invalid branch_id references"""
    query = text("""
        SELECT ui.id, ui.branch_id, ui.tenant_id
        FROM user_invitations ui
        LEFT JOIN branches b ON ui.branch_id = b.id
        WHERE ui.branch_id IS NOT NULL
        AND b.id IS NULL
    """)

    result = await db.execute(query)
    return [{"id": row[0], "branch_id": row[1], "tenant_id": row[2]} for row in result.fetchall()]


async def get_orphaned_branch_managers(db: AsyncSession) -> List[Dict]:
    """Get branch manager profiles with invalid managed_branch_id references"""
    query = text("""
        SELECT bmp.id, bmp.managed_branch_id, bmp.tenant_id
        FROM branch_manager_profiles bmp
        LEFT JOIN branches b ON bmp.managed_branch_id = b.id
        WHERE b.id IS NULL
    """)

    result = await db.execute(query)
    return [{"id": row[0], "managed_branch_id": row[1], "tenant_id": row[2]} for row in result.fetchall()]


async def fix_orphaned_employee_profiles(db: AsyncSession, strategy: str = "nullify") -> int:
    """
    Fix orphaned employee profiles

    Args:
        db: Database session
        strategy: "nullify" to set branch_id to NULL, "delete" to delete records

    Returns:
        Number of records fixed
    """
    orphaned = await get_orphaned_employee_profiles(db)

    if not orphaned:
        logger.info("No orphaned employee profiles found")
        return 0

    logger.warning(f"Found {len(orphaned)} orphaned employee profiles")

    if strategy == "nullify":
        # Update to set branch_id to NULL
        for record in orphaned:
            query = text("""
                UPDATE employee_profiles
                SET branch_id = NULL
                WHERE id = :id
            """)
            await db.execute(query, {"id": record["id"]})

        await db.commit()
        logger.info(f"Nullified branch_id for {len(orphaned)} employee profiles")
        return len(orphaned)

    elif strategy == "delete":
        # Delete the orphaned records
        for record in orphaned:
            query = text("""
                DELETE FROM employee_profiles
                WHERE id = :id
            """)
            await db.execute(query, {"id": record["id"]})

        await db.commit()
        logger.warning(f"Deleted {len(orphaned)} orphaned employee profiles")
        return len(orphaned)

    else:
        raise ValueError(f"Unknown strategy: {strategy}")


async def fix_orphaned_user_invitations(db: AsyncSession, strategy: str = "nullify") -> int:
    """
    Fix orphaned user invitations

    Args:
        db: Database session
        strategy: "nullify" to set branch_id to NULL, "delete" to delete records

    Returns:
        Number of records fixed
    """
    orphaned = await get_orphaned_user_invitations(db)

    if not orphaned:
        logger.info("No orphaned user invitations found")
        return 0

    logger.warning(f"Found {len(orphaned)} orphaned user invitations")

    if strategy == "nullify":
        # Update to set branch_id to NULL
        for record in orphaned:
            query = text("""
                UPDATE user_invitations
                SET branch_id = NULL
                WHERE id = :id
            """)
            await db.execute(query, {"id": record["id"]})

        await db.commit()
        logger.info(f"Nullified branch_id for {len(orphaned)} user invitations")
        return len(orphaned)

    elif strategy == "delete":
        # Delete the orphaned records
        for record in orphaned:
            query = text("""
                DELETE FROM user_invitations
                WHERE id = :id
            """)
            await db.execute(query, {"id": record["id"]})

        await db.commit()
        logger.warning(f"Deleted {len(orphaned)} orphaned user invitations")
        return len(orphaned)

    else:
        raise ValueError(f"Unknown strategy: {strategy}")


async def fix_orphaned_branch_managers(db: AsyncSession, strategy: str = "nullify") -> int:
    """
    Fix orphaned branch manager profiles

    Args:
        db: Database session
        strategy: "delete" to delete records (nullify not allowed as managed_branch_id is required)

    Returns:
        Number of records fixed
    """
    orphaned = await get_orphaned_branch_managers(db)

    if not orphaned:
        logger.info("No orphaned branch manager profiles found")
        return 0

    logger.warning(f"Found {len(orphaned)} orphaned branch manager profiles")

    if strategy == "delete":
        # Delete the orphaned records (only option since managed_branch_id is required)
        for record in orphaned:
            query = text("""
                DELETE FROM branch_manager_profiles
                WHERE id = :id
            """)
            await db.execute(query, {"id": record["id"]})

        await db.commit()
        logger.warning(f"Deleted {len(orphaned)} orphaned branch manager profiles")
        return len(orphaned)

    else:
        raise ValueError(f"Strategy '{strategy}' not allowed for branch_manager_profiles. Only 'delete' is supported.")


async def check_fk_constraints(db: AsyncSession) -> Dict[str, List[Dict]]:
    """
    Check all foreign key constraints for violations

    Returns:
        Dictionary with table names as keys and lists of orphaned records as values
    """
    results = {
        "employee_profiles": await get_orphaned_employee_profiles(db),
        "user_invitations": await get_orphaned_user_invitations(db),
        "branch_manager_profiles": await get_orphaned_branch_managers(db)
    }

    return results


async def main():
    """Main function to run the fix"""
    logging.basicConfig(level=logging.INFO)

    async with AsyncSessionLocal() as db:
        # First, check for violations
        logger.info("Checking for foreign key constraint violations...")
        violations = await check_fk_constraints(db)

        total_violations = sum(len(records) for records in violations.values())

        if total_violations == 0:
            logger.info("No foreign key constraint violations found!")
            return

        logger.error(f"Found {total_violations} total foreign key constraint violations:")
        for table, records in violations.items():
            if records:
                logger.error(f"  {table}: {len(records)} violations")

        # Fix violations
        logger.info("\nFixing violations...")

        # Fix employee profiles
        await fix_orphaned_employee_profiles(db, strategy="nullify")

        # Fix user invitations
        await fix_orphaned_user_invitations(db, strategy="nullify")

        # Fix branch manager profiles
        await fix_orphaned_branch_managers(db, strategy="delete")

        # Verify all violations are fixed
        logger.info("\nVerifying all violations are fixed...")
        final_violations = await check_fk_constraints(db)

        total_final = sum(len(records) for records in final_violations.values())

        if total_final == 0:
            logger.info("All foreign key constraint violations have been fixed!")
        else:
            logger.error(f"Still have {total_final} violations after fixing attempt")
            for table, records in final_violations.items():
                if records:
                    logger.error(f"  {table}: {len(records)} remaining")


if __name__ == "__main__":
    asyncio.run(main())