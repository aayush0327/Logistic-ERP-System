"""
Migration 023: Add driver_code to driver_profiles table
"""
from sqlalchemy import text
from src.database import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

async def upgrade():
    """Add driver_code column to driver_profiles table"""
    async with AsyncSessionLocal() as session:
        try:
            # Add driver_code column
            query = text("""
                ALTER TABLE driver_profiles
                ADD COLUMN IF NOT EXISTS driver_code VARCHAR(50);
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 023 complete: Added driver_code to driver_profiles table")

            # Create unique index for driver_code within tenant
            query = text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_code_tenant
                ON driver_profiles(driver_code, tenant_id)
                WHERE driver_code IS NOT NULL;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Created unique index on driver_code and tenant_id")
            return {"success": True, "message": "Added driver_code to driver_profiles table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 023 failed: {str(e)}")
            return {"success": False, "error": str(e)}


async def downgrade():
    """Remove driver_code column from driver_profiles table"""
    async with AsyncSessionLocal() as session:
        try:
            # Drop unique index first
            query = text("""
                DROP INDEX IF EXISTS idx_driver_code_tenant;
            """)
            await session.execute(query)

            # Remove driver_code column
            query = text("""
                ALTER TABLE driver_profiles
                DROP COLUMN IF EXISTS driver_code;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 023 downgrade complete: Removed driver_code from driver_profiles table")
            return {"success": True, "message": "Removed driver_code from driver_profiles table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 023 downgrade failed: {str(e)}")
            return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(upgrade())
    if result.get("success"):
        print("✓ Migration completed successfully")
    else:
        print(f"✗ Migration failed: {result.get('error')}")
