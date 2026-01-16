"""
Migration 022: Create product_unit_types table
"""
from sqlalchemy import text
from src.database import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

async def upgrade():
    """Create product_unit_types table"""
    async with AsyncSessionLocal() as session:
        try:
            query = text("""
                CREATE TABLE IF NOT EXISTS product_unit_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id VARCHAR NOT NULL,
                    code VARCHAR(20) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    abbreviation VARCHAR(20),
                    description VARCHAR(500),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT tenant_unit_code UNIQUE (tenant_id, code)
                );

                CREATE INDEX IF NOT EXISTS idx_put_tenant ON product_unit_types(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_put_code ON product_unit_types(code);
                CREATE INDEX IF NOT EXISTS idx_put_is_active ON product_unit_types(is_active);
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 022 complete: Created product_unit_types table")
            return {"success": True, "message": "Created product_unit_types table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 022 failed: {str(e)}")
            return {"success": False, "error": str(e)}


async def downgrade():
    """Drop product_unit_types table"""
    async with AsyncSessionLocal() as session:
        try:
            query = text("""
                DROP TABLE IF EXISTS product_unit_types CASCADE;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 022 downgrade complete: Dropped product_unit_types table")
            return {"success": True, "message": "Dropped product_unit_types table"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 022 downgrade failed: {str(e)}")
            return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(upgrade())
    if result.get("success"):
        print("✓ Migration completed successfully")
    else:
        print(f"✗ Migration failed: {result.get('error')}")
