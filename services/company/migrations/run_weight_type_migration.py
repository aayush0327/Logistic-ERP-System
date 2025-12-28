"""
Migration script for Product Weight Type feature
Run this script to apply the weight type columns to products table
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
    Apply product weight type migration to company database
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Applying Product Weight Type migration to: {settings.POSTGRES_COMPANY_DB}")

    # Connect to company database
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute migration file
        migration_path = Path(__file__).parent / "009_add_product_weight_type.sql"
        if migration_path.exists():
            print(f"Executing migration: {migration_path.name}")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()

            await conn.execute(migration_sql)
            print("Product weight type columns added successfully")
        else:
            print(f"Migration file not found: {migration_path}")
            return

        # Verify columns were added
        columns = await conn.fetch(
            """
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'products'
            AND column_name IN ('weight_type', 'fixed_weight', 'variable_weight_min', 'variable_weight_max', 'weight_unit')
            ORDER BY ordinal_position
            """
        )

        if columns:
            print("\n✅ Columns verified:")
            for col in columns:
                default = col['column_default'] or 'none'
                print(f"  - {col['column_name']}: {col['data_type']} (default: {default})")
        else:
            print("❌ Columns were not added")
            return

        # Check existing products
        product_count = await conn.fetchval("SELECT COUNT(*) FROM products")
        print(f"\n📦 Total products in database: {product_count}")

        # Show migration status of existing products
        migrated_count = await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE weight_type IS NOT NULL"
        )
        print(f"✅ Products migrated to new weight type: {migrated_count}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

    print(f"\n✅ Product Weight Type migration completed successfully!")


async def check_migration():
    """
    Check if weight type migration has been applied
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)

        # Check if columns exist
        columns = await conn.fetch(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'products'
            AND column_name IN ('weight_type', 'fixed_weight', 'variable_weight_min', 'variable_weight_max', 'weight_unit')
            """
        )

        if columns:
            print(f"✅ Product Weight Type migration has been applied to {settings.POSTGRES_COMPANY_DB}")
            print(f"   Found {len(columns)} new columns")

            # Show product statistics
            total = await conn.fetchval("SELECT COUNT(*) FROM products")
            fixed_count = await conn.fetchval("SELECT COUNT(*) FROM products WHERE weight_type = 'fixed'")
            variable_count = await conn.fetchval("SELECT COUNT(*) FROM products WHERE weight_type = 'variable'")
            null_count = await conn.fetchval("SELECT COUNT(*) FROM products WHERE weight_type IS NULL")

            print(f"\n   Product weight type distribution:")
            print(f"   - Total: {total}")
            print(f"   - Fixed: {fixed_count}")
            print(f"   - Variable: {variable_count}")
            print(f"   - Not set: {null_count}")
        else:
            print(f"❌ Product Weight Type migration not found in {settings.POSTGRES_COMPANY_DB}")

        await conn.close()
        return len(columns) > 0

    except Exception as e:
        print(f"❌ Check failed: {e}")
        return False


async def rollback_migration():
    """
    Rollback weight type migration (for development/testing only)
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"\n⚠️  WARNING: Rolling back Product Weight Type migration from: {settings.POSTGRES_COMPANY_DB}")
    print("This will DROP the weight type columns from products!")

    # Confirm before proceeding
    confirm = input("Type 'yes' to confirm rollback: ")
    if confirm.lower() != 'yes':
        print("Rollback cancelled")
        return

    conn = await asyncpg.connect(company_url)

    try:
        print("Dropping weight type columns...")
        await conn.execute("""
            ALTER TABLE products
            DROP COLUMN IF EXISTS weight_type,
            DROP COLUMN IF EXISTS fixed_weight,
            DROP COLUMN IF EXISTS variable_weight_min,
            DROP COLUMN IF EXISTS variable_weight_max,
            DROP COLUMN IF EXISTS weight_unit
        """)

        # Drop the enum type
        await conn.execute("DROP TYPE IF EXISTS weight_type")

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
            print("  python run_weight_type_migration.py          # Run migration")
            print("  python run_weight_type_migration.py --check   # Check if migration applied")
            print("  python run_weight_type_migration.py --rollback  # Rollback migration")
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
