"""
Fix migration script for User Role Management
Run this script to fix the roles constraint issue
"""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))

from src.config_local import CompanySettings
import asyncpg


async def run_fix_migration():
    """
    Apply fix for user role management migration
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying User Role Management fix to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute fix migration file
        migration_path = Path(__file__).parent / "003_fix_roles_migration.sql"
        if migration_path.exists():
            print(f"Executing fix migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("✅ User Role Management fix applied successfully")
        else:
            print(f"❌ Fix migration file not found: {migration_path}")
            return

        # Verify the roles were inserted
        result = await conn.fetch(
            "SELECT role_name, display_name FROM company_roles WHERE tenant_id = 'default-tenant'"
        )

        print("\n📋 Default roles created:")
        for row in result:
            print(f"  - {row['role_name']}: {row['display_name']}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()


async def check_migration():
    """
    Check if the migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    conn = await asyncpg.connect(company_url)

    try:
        # Check if tables exist
        tables = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'current_schema()'
            AND table_name IN ('company_roles', 'employee_profiles', 'driver_profiles')
            """
        )

        if tables:
            print(f"✅ Found {len(tables)} user management tables")

            # Check if roles exist
            roles = await conn.fetchval(
                "SELECT COUNT(*) FROM company_roles WHERE tenant_id = 'default-tenant'"
            )

            print(f"✅ Found {roles} default roles")

            # Check constraint
            constraint_exists = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM pg_constraint
                WHERE conname = 'company_roles_tenant_role_unique'
                """
            )

            if constraint_exists:
                print("✅ Unique constraint exists")
            else:
                print("⚠️  Unique constraint not found - need to run fix")
        else:
            print("❌ User management tables not found")

    except Exception as e:
        print(f"❌ Check failed: {e}")
    finally:
        await conn.close()


async def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        await check_migration()
    else:
        await run_fix_migration()


if __name__ == "__main__":
    asyncio.run(main())