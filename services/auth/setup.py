"""
Setup script for Auth Service
This script helps initialize the database and start the service
"""
import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.config_local import AuthSettings
from src.database import engine, Base

settings = AuthSettings()


async def create_database():
    """Create the auth database if it doesn't exist"""
    import asyncpg

    # Connect to postgres server (not the specific database)
    conn = await asyncpg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database="postgres"  # Default database
    )

    try:
        # Check if database exists
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.POSTGRES_AUTH_DB
        )

        if not db_exists:
            # Create the database
            await conn.execute(f'CREATE DATABASE "{settings.POSTGRES_AUTH_DB}"')
            print(f"✓ Created database: {settings.POSTGRES_AUTH_DB}")
        else:
            print(f"✓ Database already exists: {settings.POSTGRES_AUTH_DB}")

    finally:
        await conn.close()


async def run_migrations():
    """Run database migrations"""
    import subprocess

    migration_path = Path(__file__).parent / "migrations" / "run_migrations.py"
    result = subprocess.run(
        [sys.executable, str(migration_path)],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("✗ Migration failed:")
        print(result.stderr)
        return False

    print(result.stdout)
    return True


async def main():
    """Main setup function"""
    print("🚀 Setting up Auth Service...\n")

    # Step 1: Create database
    print("Step 1: Creating database...")
    await create_database()
    print()

    # Step 2: Run migrations
    print("Step 2: Running migrations...")
    if not await run_migrations():
        print("\n❌ Setup failed!")
        sys.exit(1)
    print()

    # Step 3: Check environment
    print("Step 3: Checking environment...")
    print(f"✓ Environment: {settings.ENV}")
    print(f"✓ Database: {settings.POSTGRES_AUTH_DB}")
    print(f"✓ JWT Expiry: {settings.JWT_EXPIRE_MINUTES} minutes")
    print()

    print("✅ Setup completed successfully!")
    print("\nDefault users have been created:")
    print("  • Admin: admin@example.com / admin123")
    print("  • Manager: manager@example.com / manager123")
    print("  • Employee: employee@example.com / employee123")
    print("\n⚠️  IMPORTANT: Change these passwords after first login!")
    print("\nTo start the service, run:")
    print("  python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8001")


if __name__ == "__main__":
    asyncio.run(main())