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



# Mock drivers data - will be integrated with driver service later
DRIVERS = [
    Driver(id="DRV-001", name="Mike Johnson", phone="+201234567890", license="DL-001234", experience="5 years", status="active", currentTruck=None),
    Driver(id="DRV-002", name="Sarah Ahmed", phone="+201112223333", license="DL-002345", experience="3 years", status="active", currentTruck=None),
    Driver(id="DRV-003", name="Ali Hassan", phone="+201445556666", license="DL-003456", experience="7 years", status="active", currentTruck=None),
    Driver(id="DRV-004", name="Mohamed Ali", phone="+201556667778", license="DL-004567", experience="4 years", status="active", currentTruck=None),
]

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
        require_any_permission(["resources: read", "resources:read_all", "trips:read", "trips:read_all"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get all available trucks from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        # Call Company service vehicles endpoint with status filter
        response = await client.get(
            f"{COMPANY_SERVICE_URL}/vehicles/",
            params={
                "status": "available",
                "is_active": True,
                "per_page": 100,
                "tenant_id": tenant_id
            },
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

        return trucks


@router.get("/drivers", response_model=List[Driver])
async def get_drivers(
    status: Optional[str] = Query(None, description="Filter by driver status"),
    token_data: TokenData = Depends(
        require_any_permission(["resources:read", "resources:read_all", "drivers:read", "drivers:read_all", "drivers:update"])
    ),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Get all drivers with optional status filter"""
    # In production, filter by tenant_id
    drivers = DRIVERS

    # Filter by status if provided
    if status:
        drivers = [driver for driver in drivers if driver.status == status]

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
                    "weight": sum(item.get("total_weight", 0) or 0 for item in order.get("items", [])),
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
    """Get all active branches from Company service"""
    # Get authorization header from the request and forward it
    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    async with AsyncClient(timeout=30.0) as client:
        # Call Company service branches endpoint
        response = await client.get(
            f"{COMPANY_SERVICE_URL}/branches/",
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