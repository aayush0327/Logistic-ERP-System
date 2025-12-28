"""
Migration script for Auth Service Role ID
Run this script to modify the employee_profiles role_id column to store auth service role IDs
"""
import asyncio
import sys
import os
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
os.chdir(str(Path(__file__).parent.parent))

from src.config_local import CompanySettings
import asyncpg


async def run_migration():
    """
    Apply auth role ID migration to company database
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying Auth Role ID migration to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute migration file
        migration_path = Path(__file__).parent / "006_modify_role_id_for_auth.sql"
        if migration_path.exists():
            print(f"Executing migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("Auth Role ID migration applied successfully")
        else:
            print(f"Migration file not found: {migration_path}")
            return

        # Verify the column was modified
        column_info = await conn.fetchrow(
            """
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                is_nullable
            FROM information_schema.columns
            WHERE table_name = 'employee_profiles'
            AND column_name = 'role_id'
            """
        )

        if column_info:
            print(f"\n✅ Column 'role_id' verified:")
            print(f"  - Type: {column_info['data_type']}")
            print(f"  - Max Length: {column_info['character_maximum_length']}")
            print(f"  - Nullable: {column_info['is_nullable']}")

            if column_info['data_type'] == 'character varying' and column_info['is_nullable'] == 'YES':
                print("\n✅ Migration successful! role_id now accepts auth service role IDs")
            else:
                print("\n⚠️  Warning: Column structure may not be as expected")
        else:
            print("❌ Column 'role_id' not found in employee_profiles table")
            return

        # Check if foreign key constraint was removed
        constraints = await conn.fetch(
            """
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'employee_profiles'
            AND constraint_name LIKE '%role_id%'
            """
        )

        if not constraints:
            print("✅ Foreign key constraint removed from role_id")
        else:
            print("\n⚠️  Warning: Some constraints still exist:")
            for constraint in constraints:
                print(f"  - {constraint['constraint_name']} ({constraint['constraint_type']})")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

    print(f"\n✅ Auth Role ID migration completed successfully!")


async def check_migration():
    """
    Check if auth role ID migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)

        # Check if column exists and has correct properties
        column_info = await conn.fetchrow(
            """
            SELECT
                data_type,
                character_maximum_length,
                is_nullable
            FROM information_schema.columns
            WHERE table_name = 'employee_profiles'
            AND column_name = 'role_id'
            """
        )

        if column_info:
            is_applied = (
                column_info['data_type'] == 'character varying' and
                column_info['character_maximum_length'] == 50 and
                column_info['is_nullable'] == 'YES'
            )

            if is_applied:
                print(f"✅ Auth Role ID migration has been applied to {settings.POSTGRES_COMPANY_DB}")
                print(f"   role_id is VARCHAR(50) and nullable")
            else:
                print(f"⚠️  Partial migration found in {settings.POSTGRES_COMPANY_DB}")
                print(f"   Current: {column_info['data_type']}({column_info['character_maximum_length']}), nullable={column_info['is_nullable']}")
        else:
            print(f"❌ Column 'role_id' not found in {settings.POSTGRES_COMPANY_DB}")

        await conn.close()
        return column_info is not None

    except Exception as e:
        print(f"❌ Check failed: {e}")
        return False


async def rollback_migration():
    """
    Rollback auth role ID migration (for development/testing only)
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"\n⚠️  WARNING: Rolling back Auth Role ID migration from: {settings.POSTGRES_COMPANY_DB}")
    print("This will restore role_id to its original state!")

    # Confirm before proceeding
    confirm = input("Type 'yes' to confirm rollback: ")
    if confirm.lower() != 'yes':
        print("Rollback cancelled")
        return

    conn = await asyncpg.connect(company_url)

    try:
        print("Restoring role_id column...")

        # Restore foreign key and make it NOT NULL
        await conn.execute("""
            ALTER TABLE employee_profiles
            ALTER COLUMN role_id SET NOT NULL
        """)

        await conn.execute("""
            ALTER TABLE employee_profiles
            ALTER COLUMN role_id TYPE VARCHAR(36) USING role_id::VARCHAR(36)
        """)

        await conn.execute("""
            ALTER TABLE employee_profiles
            ADD CONSTRAINT employee_profiles_role_id_fkey
            FOREIGN KEY (role_id) REFERENCES company_roles(id)
        """)

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
            print("  python run_auth_role_migration.py          # Run migration")
            print("  python run_auth_role_migration.py --check   # Check if migration applied")
            print("  python run_auth_role_migration.py --rollback  # Rollback migration")
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
