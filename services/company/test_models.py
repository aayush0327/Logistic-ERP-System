"""
Test script to verify database models are working correctly
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from src.database import Base

async def test_models():
    """Test that all database models are properly configured"""

    # Create engine
    engine = create_async_engine(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/test_company",
        echo=True
    )

    try:
        print("Testing database model configurations...\n")

        # Test creating all tables
        print("Creating all tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("✅ All tables created successfully!")

        # List all tables
        print("\n📋 Tables created:")
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")

        print("\n✅ Database models are configured correctly!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_models())