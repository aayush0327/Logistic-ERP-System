"""
Seed script to create sample branches for testing
"""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))

from src.config_local import CompanySettings
from src.database import engine, Base, Branch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid


async def check_and_seed_branches():
    """
    Check if branches exist, and create sample branches if needed
    """
    async with engine.begin() as conn:
        # Create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)

    # Create async session
    async with AsyncSession(engine) as db:
        print("Checking for existing branches...")

        # Check if any branches exist
        query = select(Branch).where(Branch.tenant_id == 'default-tenant')
        result = await db.execute(query)
        branches = result.scalars().all()

        if branches:
            print(f"Found {len(branches)} existing branches:")
            for branch in branches:
                print(f"  - {branch.name} (ID: {branch.id})")
            return

        print("No branches found. Creating sample branches...")

        # Create sample branches
        sample_branches = [
            {
                "id": uuid.uuid4(),
                "tenant_id": "default-tenant",
                "name": "Mumbai Main",
                "code": "MUM-001",
                "address": "123 Main Street, Mumbai",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "postal_code": "400001",
                "phone": "+91-22-12345678",
                "email": "mumbai@logistics.com",
                "is_active": True
            },
            {
                "id": uuid.uuid4(),
                "tenant_id": "default-tenant",
                "name": "Pune Branch",
                "code": "PUN-001",
                "address": "456 Market Road, Pune",
                "city": "Pune",
                "state": "Maharashtra",
                "country": "India",
                "postal_code": "411001",
                "phone": "+91-20-87654321",
                "email": "pune@logistics.com",
                "is_active": True
            },
            {
                "id": uuid.uuid4(),
                "tenant_id": "default-tenant",
                "name": "Delhi Branch",
                "code": "DEL-001",
                "address": "789 Commercial St, Delhi",
                "city": "New Delhi",
                "state": "Delhi",
                "country": "India",
                "postal_code": "110001",
                "phone": "+91-11-98765432",
                "email": "delhi@logistics.com",
                "is_active": True
            },
            {
                "id": uuid.uuid4(),
                "tenant_id": "default-tenant",
                "name": "Bangalore Branch",
                "code": "BLR-001",
                "address": "321 Tech Park, Bangalore",
                "city": "Bangalore",
                "state": "Karnataka",
                "country": "India",
                "postal_code": "560001",
                "phone": "+91-80-12345678",
                "email": "bangalore@logistics.com",
                "is_active": True
            }
        ]

        # Insert branches
        for branch_data in sample_branches:
            branch = Branch(**branch_data)
            db.add(branch)

        await db.commit()
        print(f"✅ Created {len(sample_branches)} sample branches!")

        # Display created branches with IDs
        print("\nCreated branches with IDs:")
        for branch_data in sample_branches:
            print(f"  - {branch_data['name']}: {branch_data['id']}")


if __name__ == "__main__":
    asyncio.run(check_and_seed_branches())