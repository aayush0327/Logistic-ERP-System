"""Resources API endpoints - dummy data service"""

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query, Request
from typing import List, Optional
from httpx import AsyncClient
import logging

from src.schemas import Truck, Driver, Order, Branch
from src.security import (
    TokenData,
    require_any_permission,
    get_current_tenant_id
)
from src.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Company service URL
COMPANY_SERVICE_URL = "http://company-service:8002"


# Mock orders data - will be integrated with order service later
ORDERS = [
    Order(
        id="ORD-001",
        customer="John's Farm",
        customerAddress="123 Farm Road, Rural Area, Cairo",
        status="approved",
        total=2500,
        weight=850,
        volume=1200,
        date=date(2024, 1, 15),
        priority="high",
        items=15,
        address="123 Farm Road, Rural Area, Cairo"
    ),
    Order(
        id="ORD-002",
        customer="Green Valley Store",
        customerAddress="456 Market St, City Center",
        status="approved",
        total=1800,
        weight=650,
        volume=950,
        date=date(2024, 1, 16),
        priority="medium",
        items=8,
        address="456 Market St, City Center"
    ),
    Order(
        id="ORD-003",
        customer="Tech Solutions Ltd",
        customerAddress="789 Tech Park Avenue, Innovation District",
        status="pending",
        total=3200,
        weight=1200,
        volume=1800,
        date=date(2024, 1, 17),
        priority="high",
        items=25,
        address="789 Tech Park Avenue, Innovation District"
    ),
    Order(
        id="ORD-004",
        customer="Fresh Foods Market",
        customerAddress="101 Fresh Street, Downtown",
        status="approved",
        total=950,
        weight=400,
        volume=500,
        date=date(2024, 1, 18),
        priority="low",
        items=6,
        address="101 Fresh Street, Downtown"
    ),
]


@router.get("/trucks", response_model=list[Truck])
async def get_trucks(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get available trucks from Company service filtered by assigned branches

    For Admin users: Returns ALL trucks for the tenant
    For Logistics Managers: Returns trucks from assigned branches only
    """
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    # Check if user is Admin
    is_admin = token_data.role == "Admin" or token_data.is_super_user()
    logger.info(f"Trucks access check - user_id: {token_data.user_id}, role: {token_data.role}, is_admin: {is_admin}")

    # Determine parameters for vehicle query
    if is_admin:
        # Admin - get all trucks for tenant
        params = {
            "status": "available",
            "is_active": True,
            "per_page": 100,
            "tenant_id": tenant_id
        }
    else:
        # Non-admin - get only trucks from assigned branches
        # First, get assigned branches for this user
        async with AsyncClient(timeout=30.0) as client:
            branches_response = await client.get(
                f"{COMPANY_SERVICE_URL}/branches/my/assigned",
                params={
                    "is_active": True,
                    "per_page": 100,
                    "tenant_id": tenant_id
                },
                headers=headers
            )

            if branches_response.status_code != 200:
                logger.error(f"Failed to fetch assigned branches: {branches_response.status_code}")
                return []

            branches_data = branches_response.json()
            assigned_branch_ids = [branch["id"] for branch in branches_data.get("items", [])]

            if not assigned_branch_ids:
                logger.warning(f"No assigned branches found for user {token_data.user_id}")
                return []

            params = {
                "status": "available",
                "is_active": True,
                "per_page": 100,
                "tenant_id": tenant_id,
                "branch_id": assigned_branch_ids  # Pass multiple branch IDs
            }
            logger.info(f"Fetching trucks for assigned branch IDs: {assigned_branch_ids}")

    async with AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{COMPANY_SERVICE_URL}/vehicles/",
            params=params,
            headers=headers
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch vehicles from Company service: {response.status_code}")
            # Return fallback data when company service is unavailable
            return [Truck(
                id="fallback-1",
                plate="TEMP-001",
                model="Fallback Truck",
                capacity=1000.0,
                status="available"
            )]

        data = response.json()
        vehicles = data.get("items", [])

        # Convert vehicle data to Truck schema
        trucks = []
        for vehicle in vehicles:
            # Extract capacity from vehicle data
            capacity = vehicle.get("capacity_weight", 0) or 0

            # Create truck model from make and model
            make = vehicle.get("make", "")
            model = vehicle.get("model", "")
            truck_model = f"{make} {model}".strip() if make or model else "Unknown"

            trucks.append(Truck(
                id=str(vehicle["id"]),
                plate=vehicle["plate_number"],
                model=truck_model,
                capacity=float(capacity),
                status="available"  # All vehicles from /available endpoint are available
            ))

        logger.info(f"Returning {len(trucks)} trucks for user {token_data.user_id}")
        return trucks


@router.get("/drivers", response_model=List[Driver])
async def get_drivers(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by driver status"),
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "drivers:read", "drivers:read_all", "drivers:update"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get drivers from Company service based on user role and assigned branches

    Fetches data from driver_profiles and employee_profiles tables via company service

    For Admin users: Returns ALL drivers for the tenant
    For Logistics Managers: Returns drivers from assigned branches only

    This uses the /profiles/drivers/my/assigned endpoint which:
    - Returns all drivers for Admin users
    - Returns drivers from assigned branches for regular users (like Logistics Managers)
    """
    # Log user info for debugging
    logger.info(f"TMS RESOURCES - User: {token_data.user_id}, Role: {token_data.role}, Tenant: {tenant_id}")

    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header
        logger.info(f"TMS RESOURCES - Auth header found and will be forwarded to company service")
    else:
        logger.warning(f"TMS RESOURCES - No auth header found in request!")

    async with AsyncClient(timeout=30.0) as client:
        # Call Company service driver profiles assigned endpoint
        # This endpoint joins driver_profiles with employee_profiles and branches
        # It filters based on user role (Admin gets all, others get assigned branches)
        params = {}

        # Add status filter if provided
        if status:
            params["status"] = status

        response = await client.get(
            f"{COMPANY_SERVICE_URL}/profiles/drivers/my/assigned",
            params=params,
            headers=headers
        )

        logger.info(f"TMS RESOURCES - Company service response status: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"Failed to fetch drivers from Company service: {response.status_code}")
            logger.error(f"Response: {response.text}")
            # Return empty list when company service is unavailable
            return []

        driver_profiles = response.json()
        logger.info(f"TMS RESOURCES - Received {len(driver_profiles)} driver profiles from company service")

        # Convert driver profiles to TMS Driver schema
        drivers = []
        for driver_profile in driver_profiles:
            # Extract employee information from nested employee object
            employee = driver_profile.get("employee")
            if not employee:
                logger.warning(f"Driver profile {driver_profile.get('id')} has no employee data, skipping")
                continue

            # Use full_name from employee, fallback to first_name
            full_name = employee.get("full_name") or f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()

            # Map current_status from driver_profile to status for Driver schema
            driver_status = driver_profile.get("current_status", "available")

            logger.info(f"TMS RESOURCES - Processing driver: {full_name}, status={driver_status}, user_id={employee.get('user_id')}")

            drivers.append(Driver(
                id=driver_profile.get("id", ""),
                name=full_name,
                phone=employee.get("phone", ""),
                license=driver_profile.get("license_number", ""),
                experience=f"{driver_profile.get('experience_years', 0)} years",
                status=driver_status,
                currentTruck=None,  # Would need to be populated from active trip
                branch_id=employee.get("branch_id"),  # Include branch_id for filtering
                user_id=employee.get("user_id")  # Include user_id
            ))

        logger.info(f"TMS RESOURCES - Successfully returning {len(drivers)} drivers")
        for driver in drivers:
            logger.info(f"TMS RESOURCES - Driver: {driver.name}, status={driver.status}, user_id={driver.user_id}")
        return drivers


@router.get("/orders", response_model=List[dict])
async def get_orders(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by order status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "orders:read", "orders:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get all orders from Orders service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        try:
            # Build query parameters for orders service
            params = {
                "tenant_id": tenant_id,
                "per_page": 100  # Get up to 100 orders
            }

            # Add status filter if provided
            if status:
                params["status"] = status

            # Add priority filter if provided
            if priority:
                params["priority"] = priority

            # Call Orders service
            logger.info(f"Calling orders service with params: {params}")
            response = await client.get(
                f"{settings.ORDERS_SERVICE_URL}/api/v1/orders/",
                params=params,
                headers=headers
            )

            logger.info(f"Orders service response status: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"Failed to fetch orders from Orders service: {response.status_code}")
                logger.error(f"Response text: {response.text}")
                # Return empty list if orders service is unavailable
                return []

            data = response.json()
            logger.info(f"Orders service response data: {data}")
            orders = data.get("items", [])
            logger.info(f"Extracted orders count: {len(orders)}")

            # Transform orders to match TMS Order schema format
            transformed_orders = []
            for order in orders:
                logger.info(f"Processing order: {order}")

                # Handle the created_at field - it might be a string or datetime object
                created_at = order.get("created_at")
                if isinstance(created_at, str):
                    # Parse the string datetime
                    try:
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00')).date()
                    except:
                        date_obj = date.today()
                elif created_at:
                    # It's already a datetime object
                    date_obj = created_at.date()
                else:
                    date_obj = date.today()

                transformed_order = {
                    "id": order.get("order_number", order.get("id")),
                    "customer": order.get("customer", {}).get("name", "Unknown Customer") if order.get("customer") else "Unknown Customer",
                    "customerAddress": order.get("customer", {}).get("address", "Unknown Address") if order.get("customer") else "Unknown Address",
                    "status": order.get("status", "unknown"),
                    "total": order.get("total_amount", 0),
                    # Use order's total_weight directly, or sum item weights if not available
                    "weight": order.get("total_weight", 0) or sum(item.get("weight", 0) or 0 for item in order.get("items", [])),
                    "volume": sum(item.get("volume", 0) or 0 for item in order.get("items", [])),
                    "date": date_obj,
                    "priority": order.get("priority", "medium"),
                    "items": len(order.get("items", [])),
                    "address": order.get("customer", {}).get("address", "Unknown Address") if order.get("customer") else "Unknown Address"
                }
                logger.info(f"Transformed order: {transformed_order}")
                transformed_orders.append(transformed_order)

            logger.info(f"Final transformed orders count: {len(transformed_orders)}")
            return transformed_orders

        except Exception as e:
            logger.error(f"Error fetching orders: {str(e)}")
            # Return empty list on error
            return []


@router.get("/branches", response_model=list[Branch])
async def get_branches(
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get branches assigned to the current user from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        # Call Company service branches endpoint - get assigned branches for user
        response = await client.get(
            f"{COMPANY_SERVICE_URL}/branches/my/assigned",
            params={
                "is_active": True,
                "per_page": 100,
                "tenant_id": tenant_id
            },
            headers=headers
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch branches from Company service: {response.status_code}")
            # Return fallback data when company service is unavailable
            return [Branch(
                id="default-branch",
                code="MAIN",
                name="Main Branch",
                location="Default Location",
                manager="System Manager",
                phone="000-000-0000",
                status="active"
            )]

        data = response.json()
        branches_data = data.get("items", [])

        # Convert branch data to Branch schema
        branches = []
        for branch in branches_data:
            # Create location from city and state
            city = branch.get("city", "")
            state = branch.get("state", "")
            location = f"{city}, {state}".strip(", ") if city or state else "Unknown"

            branches.append(Branch(
                id=str(branch["id"]),
                code=branch["code"],
                name=branch["name"],
                location=location,
                manager=branch.get("manager_id", "Not assigned"),
                phone=branch.get("phone", ""),
                status="active" if branch.get("is_active", True) else "inactive"
            ))

        return branches


@router.get("/branches/{branch_id}/trucks", response_model=list[Truck])
async def get_trucks_by_branch(
    branch_id: str,
    request: Request,
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get available trucks for a specific branch"""
    logger.info(f"Fetching trucks for branch_id: {branch_id}")

    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        # Call Company service vehicles endpoint filtered by branch
        response = await client.get(
            f"{COMPANY_SERVICE_URL}/vehicles/",
            params={
                "branch_id": branch_id,
                "status": "available",
                "is_active": True,
                "per_page": 100,
                "tenant_id": tenant_id
            },
            headers=headers
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch vehicles for branch {branch_id}: {response.status_code}")
            logger.error(f"Response text: {response.text}")
            # Return fallback data when company service is unavailable
            return [Truck(
                id="fallback-branch-1",
                plate=f"TEMP-{branch_id}",
                model="Branch Truck",
                capacity=1000.0,
                status="available"
            )]

        data = response.json()
        vehicles = data.get("items", [])
        logger.info(f"Found {len(vehicles)} vehicles for branch {branch_id}")

        # Convert vehicle data to Truck schema
        trucks = []
        for vehicle in vehicles:
            capacity = vehicle.get("capacity_weight", 0) or 0

            make = vehicle.get("make", "")
            model = vehicle.get("model", "")
            truck_model = f"{make} {model}".strip() if make or model else "Unknown"

            trucks.append(Truck(
                id=str(vehicle["id"]),
                plate=vehicle["plate_number"],
                model=truck_model,
                capacity=float(capacity),
                status="available"
            ))

        return trucks