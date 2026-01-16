"""
Migration 021: Add odometer and fuel economy tracking to vehicles
"""
from sqlalchemy import text
from src.database import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

async def upgrade():
    """Add odometer fields to vehicles table and create vehicle_odometer_fuel_logs table"""
    async with AsyncSessionLocal() as session:
        try:
            # Add odometer fields to vehicles table
            query = text("""
                ALTER TABLE vehicles
                ADD COLUMN IF NOT EXISTS current_odometer FLOAT,
                ADD COLUMN IF NOT EXISTS current_fuel_economy FLOAT,
                ADD COLUMN IF NOT EXISTS last_odometer_update TIMESTAMP;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Added odometer fields to vehicles table")

            # Create vehicle_odometer_fuel_logs table
            query = text("""
                CREATE TABLE IF NOT EXISTS vehicle_odometer_fuel_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id VARCHAR NOT NULL,
                    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                    odometer_reading FLOAT NOT NULL,
                    fuel_economy FLOAT,
                    fuel_consumed FLOAT,
                    distance_traveled FLOAT,
                    log_date TIMESTAMP NOT NULL,
                    log_type VARCHAR(20) NOT NULL,
                    notes VARCHAR(1000),
                    recorded_by_user_id VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_vofl_vehicle ON vehicle_odometer_fuel_logs(vehicle_id);
                CREATE INDEX IF NOT EXISTS idx_vofl_date ON vehicle_odometer_fuel_logs(log_date DESC);
                CREATE INDEX IF NOT EXISTS idx_vofl_tenant ON vehicle_odometer_fuel_logs(tenant_id);
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 021 complete: Added odometer tracking")
            return {"success": True, "message": "Added odometer tracking to vehicles"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 021 failed: {str(e)}")
            return {"success": False, "error": str(e)}


async def downgrade():
    """Remove odometer fields and drop vehicle_odometer_fuel_logs table"""
    async with AsyncSessionLocal() as session:
        try:
            # Drop vehicle_odometer_fuel_logs table
            query = text("""
                DROP TABLE IF EXISTS vehicle_odometer_fuel_logs CASCADE;
            """)
            await session.execute(query)

            # Remove odometer fields from vehicles table
            query = text("""
                ALTER TABLE vehicles
                DROP COLUMN IF EXISTS current_odometer,
                DROP COLUMN IF EXISTS current_fuel_economy,
                DROP COLUMN IF EXISTS last_odometer_update;
            """)
            await session.execute(query)
            await session.commit()
            logger.info("Migration 021 downgrade complete: Removed odometer tracking")
            return {"success": True, "message": "Removed odometer tracking from vehicles"}
        except Exception as e:
            await session.rollback()
            logger.error(f"Migration 021 downgrade failed: {str(e)}")
            return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(upgrade())
    if result.get("success"):
        print("✓ Migration completed successfully")
    else:
        print(f"✗ Migration failed: {result.get('error')}")
