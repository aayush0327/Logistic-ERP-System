"""Business logic layer for Driver Service using TMS Service API"""

from typing import Optional, Dict, Any, List
from datetime import date
from src.http_client import tms_client
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class DriverService:
    """Service class for driver operations using TMS Service API"""

    def __init__(self):
        """Initialize driver service"""
        self.driver_id = settings.DRIVER_ID
        self.company_id = "company-001"  # Default company_id for driver operations

    async def get_driver_trips(
        self,
        status: Optional[str] = None,
        trip_date: Optional[date] = None,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get all trips assigned to the current driver.

        Args:
            status: Optional status filter
            trip_date: Optional date filter
            company_id: Optional company ID filter

        Returns:
            DriverTripListResponse from TMS service
        """
        try:
            trip_date_str = trip_date.isoformat() if trip_date else None
            result = await tms_client.get_driver_trips(
                driver_id=self.driver_id,
                status=status,
                trip_date=trip_date_str,
                company_id=company_id or self.company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error getting driver trips: {str(e)}")
            raise

    async def get_trip_detail(self, trip_id: str, company_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific trip.

        Args:
            trip_id: The trip ID to retrieve
            company_id: Optional company ID filter

        Returns:
            DriverTripDetailResponse from TMS service or None if not found
        """
        try:
            result = await tms_client.get_trip_detail(
                trip_id=trip_id,
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error getting trip {trip_id}: {str(e)}")
            raise

    async def update_order_delivery_status(
        self,
        trip_id: str,
        order_id: str,
        status: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update the delivery status of an order.

        Args:
            trip_id: The trip ID
            order_id: The order ID
            status: New delivery status
            company_id: Optional company ID filter

        Returns:
            Message response from TMS service
        """
        try:
            result = await tms_client.update_order_delivery_status(
                trip_id=trip_id,
                order_id=order_id,
                status=status,
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error updating order {order_id} delivery status: {str(e)}")
            raise

    async def report_truck_maintenance(
        self,
        trip_id: str,
        company_id: Optional[str] = None
    ) -> bool:
        """
        Report truck maintenance and update trip status.

        Args:
            trip_id: The trip ID
            company_id: Optional company ID filter

        Returns:
            True if successful, False otherwise
        """
        try:
            await tms_client.report_maintenance(
                trip_id=trip_id,
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return True
        except Exception as e:
            logger.error(f"Error reporting maintenance for trip {trip_id}: {str(e)}")
            return False

    async def get_current_active_trip(self, company_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the current active trip for the driver.

        Args:
            company_id: Optional company ID filter

        Returns:
            TripSummary from TMS service or None
        """
        try:
            result = await tms_client.get_driver_current_trip(
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error getting current active trip: {str(e)}")
            raise

    async def get_order_status(
        self,
        trip_id: str,
        order_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get the status of a specific order.

        Args:
            trip_id: The trip ID
            order_id: The order ID
            company_id: Optional company ID filter

        Returns:
            Order status from TMS service
        """
        try:
            result = await tms_client.get_order_status(
                trip_id=trip_id,
                order_id=order_id,
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error getting order {order_id} status: {str(e)}")
            raise

    async def mark_order_delivered(
        self,
        trip_id: str,
        order_id: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mark an order as delivered.

        Args:
            trip_id: The trip ID
            order_id: The order ID
            company_id: Optional company ID filter

        Returns:
            Message response from TMS service
        """
        try:
            result = await tms_client.mark_order_delivered(
                trip_id=trip_id,
                order_id=order_id,
                driver_id=self.driver_id,
                company_id=company_id or self.company_id
            )
            return result
        except Exception as e:
            logger.error(f"Error marking order {order_id} as delivered: {str(e)}")
            raise


# Dependency to get driver service instance
def get_driver_service() -> DriverService:
    """Get driver service instance"""
    return DriverService()