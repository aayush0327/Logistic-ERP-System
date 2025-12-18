"""
Migration runner for Auth Service
This script runs SQL migrations to set up the database schema
"""
import asyncio
import os
from pathlib import Path
import asyncpg

# Add the parent directory to the path to import config
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.config_local import AuthSettings

settings = AuthSettings()


async def run_migration(connection, migration_file):
    """Run a single migration file"""
    print(f"Running migration: {migration_file}")

    # Read the migration file
    migration_path = Path(__file__).parent / migration_file
    with open(migration_path, 'r') as f:
        migration_sql = f.read()

    # Execute the migration
    try:
        await connection.execute(migration_sql)
        print(f"✓ Successfully ran: {migration_file}")
    except Exception as e:
        print(f"✗ Error running {migration_file}: {str(e)}")
        raise


async def create_migration_table(connection):
    """Create a table to track migrations"""
    await connection.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(255) PRIMARY KEY,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)


async def get_executed_migrations(connection):
    """Get list of already executed migrations"""
    rows = await connection.fetch(
        "SELECT filename FROM schema_migrations ORDER BY filename"
    )
    return [row['filename'] for row in rows]


async def mark_migration_executed(connection, filename):
    """Mark a migration as executed"""
    await connection.execute(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        filename
    )


async def run_all_migrations():
    """Run all pending migrations"""
    # Get database connection
    conn = await asyncpg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_AUTH_DB
    )

    try:
        # Create migration tracking table
        await create_migration_table(conn)

        # Get list of executed migrations
        executed = await get_executed_migrations(conn)

        # Get list of migration files
        migration_files = sorted([
            f for f in os.listdir(Path(__file__).parent)
            if f.endswith('.sql') and f != 'run_migrations.py'
        ])

        # Run pending migrations
        for migration_file in migration_files:
            if migration_file not in executed:
                await run_migration(conn, migration_file)
                await mark_migration_executed(conn, migration_file)
            else:
                print(f"Skipping already executed: {migration_file}")

        print("\n✓ All migrations completed successfully!")

    except Exception as e:
        print(f"\n✗ Migration failed: {str(e)}")
        raise
    finally:
        await conn.close()


async def reset_database():
    """Reset the database by dropping and recreating all tables"""
    print("WARNING: This will delete all data in the database!")
    confirm = input("Are you sure you want to continue? (yes/no): ")

    if confirm.lower() != 'yes':
        print("Operation cancelled.")
        return

    conn = await asyncpg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_AUTH_DB
    )

    try:
        # Drop all tables in correct order
        tables = [
            'refresh_tokens',
            'role_permissions',
            'users',
            'permissions',
            'roles',
            'tenants',
            'schema_migrations'
        ]

        for table in tables:
            await connection.execute(f'DROP TABLE IF EXISTS {table} CASCADE')
            print(f"Dropped table: {table}")

        print("\n✓ Database reset successfully!")

    finally:
        await conn.close()


async def main():
    """Main function"""
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "reset":
            await reset_database()
        elif command == "migrate":
            await run_all_migrations()
        else:
            print("Usage: python run_migrations.py [migrate|reset]")
    else:
        await run_all_migrations()


if __name__ == "__main__":
    asyncio.run(main())