"""
Simple test script to verify the new user management endpoints
"""
import asyncio
import httpx
import json

# Test configuration
BASE_URL = "http://localhost:8002"  # Adjust if your service runs on a different port

async def test_endpoints():
    """Test the user management endpoints"""
    async with httpx.AsyncClient() as client:
        print("Testing User Management Endpoints\n")

        # Test 1: List roles
        print("1. Testing GET /roles/")
        try:
            response = await client.get(f"{BASE_URL}/roles/")
            if response.status_code == 200:
                roles = response.json()
                print(f"   ✅ Found {len(roles)} roles")
                for role in roles:
                    print(f"      - {role['role_name']}: {role['display_name']}")
            else:
                print(f"   ❌ Failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        print("\n" + "="*50 + "\n")

        # Test 2: List users (should be empty initially)
        print("2. Testing GET /users/")
        try:
            response = await client.get(f"{BASE_URL}/users/")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Successfully fetched users")
                print(f"   📊 Total: {data.get('total', 0)} users")
            else:
                print(f"   ❌ Failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        print("\n" + "="*50 + "\n")

        # Test 3: Create a test user invitation
        print("3. Testing POST /users/invite")
        test_invitation = {
            "email": "test@example.com",
            "role_id": "company_admin",  # This would be the actual role_id from the roles list
            "branch_id": None  # Optional
        }

        try:
            response = await client.post(
                f"{BASE_URL}/users/invite",
                json=test_invitation
            )
            if response.status_code in [200, 201]:
                invitation = response.json()
                print(f"   ✅ Invitation created successfully")
                print(f"   📧 Email: {invitation.get('email')}")
                print(f"   🔑 Token: {invitation.get('invitation_token')[:20]}...")
            else:
                print(f"   ❌ Failed with status {response.status_code}")
                print(f"   📄 Response: {response.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        print("\n" + "="*50 + "\n")

        # Test 4: Check API documentation
        print("4. Checking API Documentation")
        try:
            response = await client.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                print("   ✅ API docs available at: http://localhost:8000/docs")
                print("   📚 You can view and test all endpoints there")
            else:
                print(f"   ❌ Docs not available (status {response.status_code})")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        print("\n" + "="*50 + "\n")
        print("Testing complete!")
        print("\n📝 Next Steps:")
        print("1. Start the company service: uvicorn src.main:app --reload")
        print("2. Visit http://localhost:8000/docs to test all endpoints")
        print("3. Check that the database has the required tables")

if __name__ == "__main__":
    asyncio.run(test_endpoints())