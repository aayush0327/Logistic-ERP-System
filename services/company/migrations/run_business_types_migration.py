"""
Migration script for Business Types feature
Run this script to apply the business_types table and foreign key to customers table
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
    Apply business types migration to company database
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying Business Types migration to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute migration file
        migration_path = Path(__file__).parent / "010_add_business_types_table.sql"
        if migration_path.exists():
            print(f"Executing migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("Business types table and foreign key added successfully")
        else:
            print(f"Migration file not found: {migration_path}")
            return

        # Verify business_types table was created
        tables = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'business_types'
            """
        )

        if tables:
            print("✅ business_types table created")
        else:
            print("❌ business_types table was not created")
            return

        # Verify business_type_id column was added to customers
        columns = await conn.fetch(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'customers'
            AND column_name = 'business_type_id'
            """
        )

        if columns:
            print("✅ business_type_id column added to customers table")
        else:
            print("❌ business_type_id column was not added to customers table")
            return

        # Check business types created
        business_types_count = await conn.fetchval("SELECT COUNT(*) FROM business_types")
        print(f"\n📊 Total business types created: {business_types_count}")

        # Show business types
        business_types = await conn.fetch(
            "SELECT name, code, is_active FROM business_types ORDER BY name"
        )
        print("\nBusiness types created:")
        for bt in business_types:
            status = "✅" if bt['is_active'] else "❌"
            print(f"  {status} {bt['name']} ({bt['code']})")

        # Check customers migration
        customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        migrated_count = await conn.fetchval(
            "SELECT COUNT(*) FROM customers WHERE business_type_id IS NOT NULL"
        )
        print(f"\n📦 Total customers: {customer_count}")
        print(f"✅ Customers migrated to business_type_id: {migrated_count}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

    print(f"\n✅ Business Types migration completed successfully!")


async def check_migration():
    """
    Check if business types migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)

        # Check if business_types table exists
        tables = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'business_types'
            """
        )

        if tables:
            print(f"✅ Business Types migration has been applied to {settings.POSTGRES_COMPANY_DB}")

            # Show business types statistics
            total = await conn.fetchval("SELECT COUNT(*) FROM business_types")
            active = await conn.fetchval("SELECT COUNT(*) FROM business_types WHERE is_active = true")

            print(f"\n   Business types:")
            print(f"   - Total: {total}")
            print(f"   - Active: {active}")

            # Show all business types
            business_types = await conn.fetch(
                "SELECT name, code, is_active FROM business_types ORDER BY name"
            )
            print("\n   Available business types:")
            for bt in business_types:
                status = "✅" if bt['is_active'] else "❌"
                print(f"   {status} {bt['name']} ({bt['code']})")

            # Check customers with business_type_id
            customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
            migrated_count = await conn.fetchval(
                "SELECT COUNT(*) FROM customers WHERE business_type_id IS NOT NULL"
            )

            print(f"\n   Customers:")
            print(f"   - Total: {customer_count}")
            print(f"   - With business type: {migrated_count}")
            print(f"   - Without business type: {customer_count - migrated_count}")
        else:
            print(f"❌ Business Types migration not found in {settings.POSTGRES_COMPANY_DB}")
            print("   Run: python run_business_types_migration.py")

        await conn.close()
        return len(tables) > 0

    except Exception as e:
        print(f"❌ Check failed: {e}")
        return False


async def rollback_migration():
    """
    Rollback business types migration (for development/testing only)
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"\n⚠️  WARNING: Rolling back Business Types migration from: {settings.POSTGRES_COMPANY_DB}")
    print("This will DROP the business_types table and business_type_id column!")

    # Confirm before proceeding
    confirm = input("Type 'yes' to confirm rollback: ")
    if confirm.lower() != 'yes':
        print("Rollback cancelled")
        return

    conn = await asyncpg.connect(company_url)

    try:
        print("Dropping business_type_id column from customers...")
        await conn.execute("ALTER TABLE customers DROP COLUMN IF EXISTS business_type_id")

        print("Dropping business_types table...")
        await conn.execute("DROP TABLE IF EXISTS business_types CASCADE")

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
            print("  python run_business_types_migration.py          # Run migration")
            print("  python run_business_types_migration.py --check   # Check if migration applied")
            print("  python run_business_types_migration.py --rollback  # Rollback migration")
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
