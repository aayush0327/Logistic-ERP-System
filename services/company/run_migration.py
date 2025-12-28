"""
Run a specific SQL migration file
Usage: python run_migration.py <migration_file>
"""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from src.config_local import CompanySettings
import asyncpg


async def run_sql_migration(migration_file: str):
    """
    Run a single SQL migration file
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Connecting to database: {settings.POSTGRES_COMPANY_DB}")

    # Read migration file
    migration_path = Path(__file__).parent / "migrations" / migration_file
    if not migration_path.exists():
        print(f"Error: Migration file not found: {migration_path}")
        return False

    with open(migration_path, 'r') as f:
        migration_sql = f.read()

    print(f"Running migration: {migration_file}")
    print("-" * 50)

    # Connect to company database and run migration
    conn = await asyncpg.connect(company_url)

    try:
        await conn.execute(migration_sql)
        print(f"✅ Migration {migration_file} completed successfully!")
        print("-" * 50)
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False
    finally:
        await conn.close()


async def main():
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file>")
        print("\nAvailable migrations:")
        migrations_dir = Path(__file__).parent / "migrations"
        for f in sorted(migrations_dir.glob("*.sql")):
            print(f"  - {f.name}")
        sys.exit(1)

    migration_file = sys.argv[1]
    success = await run_sql_migration(migration_file)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
