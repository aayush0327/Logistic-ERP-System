"""
Migration script for Company Service database
Run this script to create and initialize the company database
"""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from src.config_local import CompanySettings
from sqlalchemy.ext.asyncio import create_async_engine
import asyncpg


async def run_migration():
    """
    Create and initialize the company database
    """
    settings = CompanySettings()

    # Get database URL for postgres (default database)
    postgres_url = settings.get_database_url("postgres")
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    print(f"Creating company database: {settings.POSTGRES_COMPANY_DB}")

    # Connect to postgres database
    conn = await asyncpg.connect(postgres_url)

    try:
        # Create company database if it doesn't exist
        await conn.execute(f'CREATE DATABASE "{settings.POSTGRES_COMPANY_DB}"')
        print(f"Database {settings.POSTGRES_COMPANY_DB} created successfully")
    except asyncpg.exceptions.DuplicateDatabaseError:
        print(f"Database {settings.POSTGRES_COMPANY_DB} already exists")
    finally:
        await conn.close()

    # Connect to company database and run schema
    conn = await asyncpg.connect(company_url)

    try:
        # Read and execute schema file
        schema_path = Path(__file__).parent.parent / "scripts" / "init-company-schema.sql"
        if schema_path.exists():
            with open(schema_path, 'r') as f:
                schema_sql = f.read()

            await conn.execute(schema_sql)
            print("Database schema initialized successfully")
        else:
            print("Warning: Schema file not found at:", schema_path)

        # Read and execute seed data file
        seed_path = Path(__file__).parent.parent / "scripts" / "seed-company-data.sql"
        if seed_path.exists():
            with open(seed_path, 'r') as f:
                seed_sql = f.read()

            await conn.execute(seed_sql)
            print("Seed data inserted successfully")
        else:
            print("Warning: Seed data file not found at:", seed_path)

        # Verify tables were created
        tables = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
        print("\nCreated tables:")
        for table in tables:
            print(f"  - {table['tablename']}")

    finally:
        await conn.close()

    print(f"\nMigration completed successfully for database: {settings.POSTGRES_COMPANY_DB}")


async def check_connection():
    """
    Check if database connection is working
    """
    settings = CompanySettings()
    company_url = settings.get_database_url(settings.POSTGRES_COMPANY_DB)

    try:
        conn = await asyncpg.connect(company_url)
        result = await conn.fetchval("SELECT 1")
        await conn.close()
        print(f"✅ Database connection successful: {settings.POSTGRES_COMPANY_DB}")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


async def main():
    """
    Main migration function
    """
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        await check_connection()
    else:
        await run_migration()


if __name__ == "__main__":
    asyncio.run(main())