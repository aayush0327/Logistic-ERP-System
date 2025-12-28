"""
Migration to populate branch_id from employee_branches for existing users
Run this after deploying the backend changes
"""
from sqlalchemy import text
from src.database import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

async def migrate_branch_id():
    """Populate branch_id from branch_ids for users where branch_id is NULL"""

    async with AsyncSessionLocal() as session:
        try:
            # Get all users where branch_id is NULL but they have branch assignments
            query = text("""
                UPDATE employee_profiles ep
                SET branch_id = eb.branch_id
                FROM employee_branches eb
                WHERE ep.id = eb.employee_profile_id
                AND ep.branch_id IS NULL
                AND eb.branch_id IS NOT NULL
                RETURNING ep.id, ep.employee_code
            """)

            result = await session.execute(query)
            updated_users = result.fetchall()

            await session.commit()

            logger.info(f"Migration complete: Updated {len(updated_users)} users with branch_id")

            # Log users that still don't have branch_id
            query2 = text("""
                SELECT id, employee_code, user_id
                FROM employee_profiles
                WHERE branch_id IS NULL
                AND is_active = true
            """)

            result2 = await session.execute(query2)
            orphan_users = result2.fetchall()

            if orphan_users:
                logger.warning(f"Warning: {len(orphan_users)} active users still have no branch_id:")
                for user in orphan_users:
                    logger.warning(f"  - {user.employee_code} (ID: {user.id})")

            return {
                'updated': len(updated_users),
                'orphan_users': len(orphan_users)
            }

        except Exception as e:
            await session.rollback()
            logger.error(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    import asyncio
    result = asyncio.run(migrate_branch_id())
    print(f"Migration Result: {result}")
