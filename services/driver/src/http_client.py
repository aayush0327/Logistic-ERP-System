"""HTTP client for communicating with TMS Service"""

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
        driver_id: str,
        company_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get current active trip for driver"""
        params = {"driver_id": driver_id}
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