"""
Migration 020: Add contact_person_name to customers table
"""
from sqlalchemy import text
from src.database import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

async def upgrade():
    """Add contact_person_name column to customers table"""
    async with AsyncSessionLocal() as session:
        try:
            # Add contact_person_name column
            query = text("""
                ALTER TABLE customers
                ADD COLUMN contact_person_name VARCHAR(100);
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 020 complete: Added contact_person_name to customers table")
            return {"success": True, "message": "Added contact_person_name to customers table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 020 failed: {str(e)}")
            return {"success": False, "error": str(e)}


async def downgrade():
    """Remove contact_person_name column from customers table"""
    async with AsyncSessionLocal() as session:
        try:
            query = text("""
                ALTER TABLE customers
                DROP COLUMN IF EXISTS contact_person_name;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 020 downgrade complete: Removed contact_person_name from customers table")
            return {"success": True, "message": "Removed contact_person_name from customers table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 020 downgrade failed: {str(e)}")
            return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(upgrade())
    if result.get("success"):
        print("✓ Migration completed successfully")
    else:
        print(f"✗ Migration failed: {result.get('error')}")
