"""Service client for communicating with Company Service"""
import httpx
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class CompanyServiceClient:
    """Client for interacting with Company Service API"""

    def __init__(self):
        self.base_url = "http://company-service:8002"  # Service name in Docker
        self.timeout = 30.0

    async def get_branches(self, tenant_id: str = "default-tenant") -> List[Dict[str, Any]]:
        """Get all active branches for a tenant"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/branches/",
                    params={"is_active": True, "per_page": 100}
                )

                if response.status_code == 200:
                    data = response.json()
                    branches = data.get("items", [])

                    # Filter by tenant_id (since Company service might not enforce it yet)
                    filtered_branches = [
                        {
                            "id": str(branch["id"]),
                            "code": branch["code"],
                            "name": branch["name"],
                            "location": f"{branch.get('city', '')}, {branch.get('state', '')}",
                            "address": branch.get("address", ""),
                            "manager": branch.get("manager_id", "Not assigned"),
                            "phone": branch.get("phone", ""),
                            "email": branch.get("email", ""),
                            "status": "active" if branch.get("is_active") else "inactive"
                        }
                        for branch in branches
                        # TODO: Remove this filter when Company service implements tenant filtering
                        # if branch.get("tenant_id") == tenant_id
                    ]
                    return filtered_branches
                else:
                    logger.error(f"Failed to fetch branches: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching branches from Company service: {e}")
            return []

    async def get_vehicles(self, tenant_id: str = "default-tenant") -> List[Dict[str, Any]]:
        """Get all active vehicles for a tenant"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/vehicles/",
                    params={"is_active": True, "per_page": 100}
                )

                if response.status_code == 200:
                    data = response.json()
                    vehicles = data.get("items", [])

                    # Transform vehicle data to match TMS expectations
                    filtered_vehicles = [
                        {
                            "id": str(vehicle["id"]),
                            "plate": vehicle["plate_number"],
                            "model": f"{vehicle.get('make', '')} {vehicle.get('model', '')}".strip(),
                            "capacity": float(vehicle.get("capacity_weight", 0)),
                            "capacity_volume": float(vehicle.get("capacity_volume", 0)),
                            "type": vehicle.get("vehicle_type", "unknown"),
                            "status": "available" if vehicle.get("status") == "available" else "unavailable",
                            "branch_id": str(vehicle["branch_id"]) if vehicle.get("branch_id") else None,
                            "year": vehicle.get("year"),
                            "last_maintenance": vehicle.get("last_maintenance"),
                            "next_maintenance": vehicle.get("next_maintenance")
                        }
                        for vehicle in vehicles
                        # TODO: Remove this filter when Company service implements tenant filtering
                        # if vehicle.get("tenant_id") == tenant_id
                    ]
                    return filtered_vehicles
                else:
                    logger.error(f"Failed to fetch vehicles: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching vehicles from Company service: {e}")
            return []

    async def get_branch_by_id(self, branch_id: str, tenant_id: str = "default-tenant") -> Optional[Dict[str, Any]]:
        """Get a specific branch by ID"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/branches/{branch_id}")

                if response.status_code == 200:
                    branch = response.json()
                    return {
                        "id": str(branch["id"]),
                        "code": branch["code"],
                        "name": branch["name"],
                        "location": f"{branch.get('city', '')}, {branch.get('state', '')}",
                        "address": branch.get("address", ""),
                        "manager": branch.get("manager_id", "Not assigned"),
                        "phone": branch.get("phone", ""),
                        "email": branch.get("email", ""),
                        "status": "active" if branch.get("is_active") else "inactive"
                    }
                else:
                    logger.error(f"Failed to fetch branch {branch_id}: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching branch {branch_id} from Company service: {e}")
            return None

    async def get_vehicles_by_branch(self, branch_id: str, tenant_id: str = "default-tenant") -> List[Dict[str, Any]]:
        """Get vehicles for a specific branch"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/vehicles/",
                    params={"branch_id": branch_id, "is_active": True, "per_page": 100}
                )

                if response.status_code == 200:
                    data = response.json()
                    vehicles = data.get("items", [])

                    return [
                        {
                            "id": str(vehicle["id"]),
                            "plate": vehicle["plate_number"],
                            "model": f"{vehicle.get('make', '')} {vehicle.get('model', '')}".strip(),
                            "capacity": float(vehicle.get("capacity_weight", 0)),
                            "capacity_volume": float(vehicle.get("capacity_volume", 0)),
                            "type": vehicle.get("vehicle_type", "unknown"),
                            "status": "available" if vehicle.get("status") == "available" else "unavailable",
                            "branch_id": str(vehicle["branch_id"]) if vehicle.get("branch_id") else None,
                        }
                        for vehicle in vehicles
                    ]
                else:
                    logger.error(f"Failed to fetch vehicles for branch {branch_id}: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching vehicles for branch {branch_id}: {e}")
            return []

    async def get_vehicle_id_by_plate(self, truck_plate: str, tenant_id: str = "default-tenant", auth_token: Optional[str] = None) -> Optional[str]:
        """Get vehicle ID by plate number"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/vehicles/",
                    params={"plate_number": truck_plate, "tenant_id": tenant_id, "per_page": 1},
                    headers=headers
                )

                if response.status_code == 200:
                    data = response.json()
                    vehicles = data.get("items", [])
                    if vehicles:
                        return str(vehicles[0]["id"])
                return None
        except Exception as e:
            logger.error(f"Error getting vehicle ID by plate: {e}")
            return None

    async def update_vehicle_status(self, vehicle_id: str, status: str = "available", tenant_id: str = "default-tenant", auth_token: Optional[str] = None) -> bool:
        """Update vehicle status to available or unavailable"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.put(
                    f"{self.base_url}/vehicles/{vehicle_id}/status",
                    params={"status": status, "tenant_id": tenant_id},
                    headers=headers
                )

                if response.status_code == 200:
                    logger.info(f"Successfully updated vehicle {vehicle_id} status to {status}")
                    return True
                else:
                    logger.error(f"Failed to update vehicle status: {response.status_code} - {response.text}")
                    return False

        except Exception as e:
            logger.error(f"Error updating vehicle {vehicle_id} status: {e}")
            return False

    async def update_driver_status(self, driver_id: str, status: str = "available", tenant_id: str = "default-tenant", auth_token: Optional[str] = None) -> bool:
        """Update driver current_status using the dedicated status endpoint"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Use the dedicated driver status endpoint (requires tms:status_update permission)
                response = await client.put(
                    f"{self.base_url}/profiles/drivers/{driver_id}/status",
                    params={"status": status, "tenant_id": tenant_id},
                    headers=headers
                )

                if response.status_code == 200:
                    logger.info(f"Successfully updated driver {driver_id} status to {status}")
                    return True
                else:
                    logger.error(f"Failed to update driver status: {response.status_code} - {response.text}")
                    return False

        except Exception as e:
            logger.error(f"Error updating driver {driver_id} status: {e}")
            return False


# Create a singleton instance
company_client = CompanyServiceClient()