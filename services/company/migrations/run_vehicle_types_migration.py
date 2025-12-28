"""
Migration script for Vehicle Types feature
Run this script to apply the vehicle_types table and foreign key to vehicles table
"""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))

from src.config_local import CompanySettings
import asyncpg


async def run_migration():
    """
    Apply vehicle types migration to company database
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying Vehicle Types migration to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute migration file
        migration_path = Path(__file__).parent / "011_add_vehicle_types_table.sql"
        if migration_path.exists():
            print(f"Executing migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("Vehicle types table and foreign key added successfully")
        else:
            print(f"Migration file not found: {migration_path}")
            return

        # Verify vehicle_types table was created
        tables = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'vehicle_types'
            """
        )

        if tables:
            print("✅ vehicle_types table created")
        else:
            print("❌ vehicle_types table was not created")
            return

        # Verify vehicle_type_id column was added to vehicles
        columns = await conn.fetch(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'vehicles'
            AND column_name = 'vehicle_type_id'
            """
        )

        if columns:
            print("✅ vehicle_type_id column added to vehicles table")
        else:
            print("❌ vehicle_type_id column was not added to vehicles table")
            return

        # Check vehicle types created
        vehicle_types_count = await conn.fetchval("SELECT COUNT(*) FROM vehicle_types")
        print(f"\n📊 Total vehicle types created: {vehicle_types_count}")

        # Show vehicle types
        vehicle_types = await conn.fetch(
            "SELECT name, code, is_active FROM vehicle_types ORDER BY name"
        )
        print("\nVehicle types created:")
        for vt in vehicle_types:
            status = "✅" if vt['is_active'] else "❌"
            print(f"  {status} {vt['name']} ({vt['code']})")

        # Check vehicles migration
        vehicle_count = await conn.fetchval("SELECT COUNT(*) FROM vehicles")
        migrated_count = await conn.fetchval(
            "SELECT COUNT(*) FROM vehicles WHERE vehicle_type_id IS NOT NULL"
        )
        print(f"\n📦 Total vehicles: {vehicle_count}")
        print(f"✅ Vehicles migrated to vehicle_type_id: {migrated_count}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

    print(f"\n✅ Vehicle Types migration completed successfully!")


async def check_migration():
    """
    Check if vehicle types migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)

        # Check if vehicle_types table exists
        tables = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'vehicle_types'
            """
        )

        if tables:
            print(f"✅ Vehicle Types migration has been applied to {settings.POSTGRES_COMPANY_DB}")

            # Show vehicle types statistics
            total = await conn.fetchval("SELECT COUNT(*) FROM vehicle_types")
            active = await conn.fetchval("SELECT COUNT(*) FROM vehicle_types WHERE is_active = true")

            print(f"\n   Vehicle types:")
            print(f"   - Total: {total}")
            print(f"   - Active: {active}")

            # Show all vehicle types
            vehicle_types = await conn.fetch(
                "SELECT name, code, is_active FROM vehicle_types ORDER BY name"
            )
            print("\n   Available vehicle types:")
            for vt in vehicle_types:
                status = "✅" if vt['is_active'] else "❌"
                print(f"   {status} {vt['name']} ({vt['code']})")

            # Check vehicles with vehicle_type_id
            vehicle_count = await conn.fetchval("SELECT COUNT(*) FROM vehicles")
            migrated_count = await conn.fetchval(
                "SELECT COUNT(*) FROM vehicles WHERE vehicle_type_id IS NOT NULL"
            )

            print(f"\n   Vehicles:")
            print(f"   - Total: {vehicle_count}")
            print(f"   - With vehicle type: {migrated_count}")
            print(f"   - Without vehicle type: {vehicle_count - migrated_count}")
        else:
            print(f"❌ Vehicle Types migration not found in {settings.POSTGRES_COMPANY_DB}")
            print("   Run: python run_vehicle_types_migration.py")

        await conn.close()
        return len(tables) > 0

    except Exception as e:
        print(f"❌ Check failed: {e}")
        return False


async def rollback_migration():
    """
    Rollback vehicle types migration (for development/testing only)
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"\n⚠️  WARNING: Rolling back Vehicle Types migration from: {settings.POSTGRES_COMPANY_DB}")
    print("This will DROP the vehicle_types table and vehicle_type_id column!")

    # Confirm before proceeding
    confirm = input("Type 'yes' to confirm rollback: ")
    if confirm.lower() != 'yes':
        print("Rollback cancelled")
        return

    conn = await asyncpg.connect(company_url)

    try:
        print("Dropping vehicle_type_id column from vehicles...")
        await conn.execute("ALTER TABLE vehicles DROP COLUMN IF EXISTS vehicle_type_id")

        print("Dropping vehicle_types table...")
        await conn.execute("DROP TABLE IF EXISTS vehicle_types CASCADE")

        print("✅ Migration rollback completed")

    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        raise
    finally:
        await conn.close()


async def main():
    """
    Main migration function with command line options
    """
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()

        if command == "--check":
            await check_migration()
        elif command == "--rollback":
            await rollback_migration()
        else:
            print("Usage:")
            print("  python run_vehicle_types_migration.py          # Run migration")
            print("  python run_vehicle_types_migration.py --check   # Check if migration applied")
            print("  python run_vehicle_types_migration.py --rollback  # Rollback migration")
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
