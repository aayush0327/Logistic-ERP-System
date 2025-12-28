"""
Migration script for Employee Multiple Branch Assignments
Run this script to apply the employee-branch junction table changes
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
    Apply employee multiple branches migration to company database
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying Employee Multiple Branches migration to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute migration file
        migration_path = Path(__file__).parent / "005_employee_branches.sql"
        if migration_path.exists():
            print(f"Executing migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("Employee Multiple Branches table created successfully")
        else:
            print(f"Migration file not found: {migration_path}")
            return

        # Verify table was created
        table_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'employee_branches'
            )
            """
        )

        if table_exists:
            print("✅ Table 'employee_branches' verified")

            # Show indexes
            indexes = await conn.fetch(
                """
                SELECT indexname, tablename
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = 'employee_branches'
                ORDER BY indexname
                """
            )

            print("\n✅ Created/Verified indexes:")
            for idx in indexes:
                print(f"  - {idx['indexname']}")
        else:
            print("❌ Table 'employee_branches' was not created")
            return

        # Check if employee_profiles table exists for foreign key
        employee_profiles_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'employee_profiles'
            )
            """
        )

        if employee_profiles_exists:
            print("✅ Foreign key to 'employee_profiles' can be created")
        else:
            print("⚠️  Warning: 'employee_profiles' table does not exist yet")
            print("   Run user role management migration first: python run_user_role_migration.py")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

    print(f"\n✅ Employee Multiple Branches migration completed successfully!")


async def check_migration():
    """
    Check if employee branches migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)

        # Check if table exists
        table_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'employee_branches'
            )
            """
        )

        if table_exists:
            print(f"✅ Employee Branches migration has been applied to {settings.POSTGRES_COMPANY_DB}")

            # Show record count
            count = await conn.fetchval("SELECT COUNT(*) FROM employee_branches")
            print(f"   Found {count} employee-branch assignments")
        else:
            print(f"❌ Employee Branches migration not found in {settings.POSTGRES_COMPANY_DB}")

        await conn.close()
        return table_exists

    except Exception as e:
        print(f"❌ Check failed: {e}")
        return False


async def rollback_migration():
    """
    Rollback employee branches migration (for development/testing only)
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"\n⚠️  WARNING: Rolling back Employee Branches migration from: {settings.POSTGRES_COMPANY_DB}")
    print("This will DELETE all employee-branch assignment data!")

    # Confirm before proceeding
    confirm = input("Type 'yes' to confirm rollback: ")
    if confirm.lower() != 'yes':
        print("Rollback cancelled")
        return

    conn = await asyncpg.connect(company_url)

    try:
        print("Dropping table: employee_branches")
        await conn.execute("DROP TABLE IF EXISTS employee_branches CASCADE")

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
            print("  python run_employee_branches_migration.py          # Run migration")
            print("  python run_employee_branches_migration.py --check   # Check if migration applied")
            print("  python run_employee_branches_migration.py --rollback  # Rollback migration")
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
