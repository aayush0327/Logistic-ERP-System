"""HTTP client for communicating with TMS and Orders Services"""

import httpx
from typing import Optional, List, Dict, Any
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class TMSClient:
    """Client for communicating with TMS Service"""

    def __init__(self, auth_token: Optional[str] = None):
        self.base_url = settings.TMS_API_URL
        self.timeout = settings.TMS_API_TIMEOUT
        self.auth_token = auth_token

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to TMS service"""
        url = f"{self.base_url}{endpoint}"

        # Prepare headers
        headers = {
            "Content-Type": "application/json",
        }

        # Add Authorization header if token is available
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            logger.info(f"Adding Authorization header to TMS request. Token length: {len(self.auth_token)}, prefix: {self.auth_token[:20] if len(self.auth_token) > 20 else self.auth_token}...")
        else:
            logger.warning("No auth_token available for TMS request - request may fail authentication")

        logger.info(f"TMS Request: {method} {url}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json
                )
                logger.info(f"TMS Response: Status {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"TMS API error response: {response.text}")
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"TMS API error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"TMS API request error: {str(e)}")
                raise

    async def get_driver_trips(
        self,
        driver_id: str,
        status: Optional[str] = None,
        trip_date: Optional[str] = None,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get trips for a driver"""
        params = {"driver_id": driver_id}
        if status:
            params["status"] = status
        if trip_date:
            params["trip_date"] = trip_date
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "GET",
            "/api/v1/driver/trips",
            params=params
        )

    async def get_driver_current_trip(
        self,
        company_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get current active trip for driver (driver_id extracted from JWT by TMS service)"""
        params = {}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "GET",
            "/api/v1/driver/trips/current",
            params=params
        )

    async def get_trip_detail(
        self,
        trip_id: str,
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get detailed trip information"""
        params = {"driver_id": driver_id}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "GET",
            f"/api/v1/driver/trips/{trip_id}",
            params=params
        )

    async def get_order_status(
        self,
        trip_id: str,
        order_id: str,
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get order status"""
        params = {"driver_id": driver_id}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "GET",
            f"/api/v1/driver/trips/{trip_id}/orders/{order_id}/status",
            params=params
        )

    async def update_order_delivery_status(
        self,
        trip_id: str,
        order_id: str,
        status: str,
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update order delivery status"""
        params = {"driver_id": driver_id}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "PUT",
            f"/api/v1/driver/trips/{trip_id}/orders/{order_id}/delivery",
            params=params,
            json={"status": status}
        )

    async def mark_order_delivered(
        self,
        trip_id: str,
        order_id: str,
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mark order as delivered"""
        params = {"driver_id": driver_id}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "POST",
            f"/api/v1/driver/trips/{trip_id}/orders/{order_id}/deliver",
            params=params
        )

    async def report_maintenance(
        self,
        trip_id: str,
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Report truck maintenance issues"""
        params = {"driver_id": driver_id}
        if company_id:
            params["company_id"] = company_id

        return await self._make_request(
            "POST",
            f"/api/v1/driver/trips/{trip_id}/maintenance",
            params=params
        )


# Create global client instance
tms_client = TMSClient()


class OrdersClient:
    """Client for communicating with Orders Service"""

    def __init__(self, auth_token: Optional[str] = None):
        self.base_url = settings.ORDERS_API_URL
        self.timeout = settings.ORDERS_API_TIMEOUT
        self.auth_token = auth_token

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Orders service"""
        url = f"{self.base_url}{endpoint}"

        # Prepare headers
        headers = {}

        # Add Authorization header if token is available
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            logger.info(f"Adding Authorization header to Orders request")
        else:
            logger.warning("No auth_token available for Orders request")

        # Don't set Content-Type for multipart/form-data (it will be set automatically)
        if files is None:
            headers["Content-Type"] = "application/json"

        logger.info(f"Orders Request: {method} {url}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json,
                    files=files,
                    data=data
                )
                logger.info(f"Orders Response: Status {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"Orders API error response: {response.text}")
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Orders API error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"Orders API request error: {str(e)}")
                raise

    async def upload_delivery_proof(
        self,
        order_id: str,
        file_content: bytes,
        filename: str,
        content_type: str,
        document_type: str = "delivery_proof",
        title: str = "Delivery Proof",
        description: str = "Document uploaded by driver upon delivery"
    ) -> Dict[str, Any]:
        """
        Upload delivery proof document to orders service

        Args:
            order_id: The order ID
            file_content: File content as bytes
            filename: Original filename
            content_type: MIME type of the file
            document_type: Type of document (default: delivery_proof)
            title: Document title
            description: Document description

        Returns:
            Document metadata from orders service
        """
        from io import BytesIO

        # Prepare multipart form data
        files = {
            "file": (filename, BytesIO(file_content), content_type)
        }
        data = {
            "document_type": document_type,
            "title": title,
            "description": description
        }

        return await self._make_request(
            "POST",
            f"/api/v1/orders/{order_id}/documents/delivery-proof",
            files=files,
            data=data
        )

    async def get_delivery_documents(
        self,
        order_id: str
    ) -> Dict[str, Any]:
        """
        Get delivery proof documents for an order

        Args:
            order_id: The order ID

        Returns:
            List of delivery documents
        """
        return await self._make_request(
            "GET",
            f"/api/v1/orders/{order_id}/documents/divery-proof"
        )


# Create global orders client instance
orders_client = OrdersClient()


class CompanyClient:
    """Client for communicating with Company Service"""

    def __init__(self, auth_token: Optional[str] = None):
        self.base_url = settings.COMPANY_API_URL
        self.timeout = settings.COMPANY_API_TIMEOUT
        self.auth_token = auth_token

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Company service"""
        url = f"{self.base_url}{endpoint}"

        # Prepare headers
        headers = {
            "Content-Type": "application/json",
        }

        # Add Authorization header if token is available
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            logger.info(f"Adding Authorization header to Company request")
        else:
            logger.warning("No auth_token available for Company request")

        logger.info(f"Company Request: {method} {url}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json
                )
                logger.info(f"Company Response: Status {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"Company API error response: {response.text}")
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Company API error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"Company API request error: {str(e)}")
                raise

    async def get_vehicle_id_by_plate(
        self,
        plate_number: str,
        tenant_id: str
    ) -> Optional[str]:
        """
        Get vehicle ID by plate number

        Args:
            plate_number: Vehicle plate number
            tenant_id: Tenant ID

        Returns:
            Vehicle ID or None if not found
        """
        try:
            result = await self._make_request(
                "GET",
                "/vehicles/",
                params={"plate_number": plate_number, "tenant_id": tenant_id, "per_page": 1}
            )
            items = result.get("items", [])
            if items and len(items) > 0:
                return str(items[0]["id"])
            return None
        except Exception as e:
            logger.error(f"Error getting vehicle ID by plate: {str(e)}")
            return None

    async def update_vehicle_status(
        self,
        vehicle_id: str,
        status: str,
        tenant_id: str
    ) -> bool:
        """
        Update vehicle status

        Args:
            vehicle_id: Vehicle ID
            status: New status (available, assigned, on_trip, maintenance)
            tenant_id: Tenant ID

        Returns:
            True if successful, False otherwise
        """
        try:
            await self._make_request(
                "PUT",
                f"/vehicles/{vehicle_id}/status",
                params={"status": status, "tenant_id": tenant_id}
            )
            logger.info(f"Updated vehicle {vehicle_id} status to {status}")
            return True
        except Exception as e:
            logger.error(f"Error updating vehicle status: {str(e)}")
            return False

    async def get_driver_profile_by_user_id(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get driver profile by user ID

        Args:
            user_id: User ID from auth service
            tenant_id: Tenant ID

        Returns:
            Driver profile or None if not found
        """
        try:
            result = await self._make_request(
                "GET",
                f"/profiles/drivers/by-user/{user_id}",
                params={"tenant_id": tenant_id}
            )
            return result
        except Exception as e:
            logger.error(f"Error getting driver profile: {str(e)}")
            return None

    async def update_driver_status(
        self,
        driver_profile_id: str,
        status: str,
        tenant_id: str
    ) -> bool:
        """
        Update driver status

        Args:
            driver_profile_id: Driver profile ID
            status: New status (available, assigned, on_trip, unavailable)
            tenant_id: Tenant ID

        Returns:
            True if successful, False otherwise
        """
        try:
            await self._make_request(
                "PUT",
                f"/profiles/drivers/{driver_profile_id}/status",
                params={"status": status, "tenant_id": tenant_id}
            )
            logger.info(f"Updated driver {driver_profile_id} status to {status}")
            return True
        except Exception as e:
            logger.error(f"Error updating driver status: {str(e)}")
            return False


# Create global company client instance
company_client = CompanyClient()