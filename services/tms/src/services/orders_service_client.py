"""Orders Service Client for fetching order items and assignments"""
import logging
from typing import List, Dict, Any, Optional
from httpx import AsyncClient, HTTPError, TimeoutException
from src.config import settings

logger = logging.getLogger(__name__)


class OrdersServiceError(Exception):
    """Base exception for Orders service errors"""
    pass


class OrdersServiceUnavailable(OrdersServiceError):
    """Raised when Orders service is unavailable"""
    pass


class OrdersServiceClient:
    """Client for interacting with Orders Service API"""

    def __init__(self):
        self.base_url = settings.ORDERS_SERVICE_URL  # "http://orders-service:8003"
        self.timeout = settings.ORDERS_SERVICE_TIMEOUT
        self.bulk_timeout = settings.ORDERS_SERVICE_BULK_TIMEOUT  # Longer timeout for bulk requests

    async def get_bulk_order_items(
        self,
        order_numbers: List[str],
        trip_id: str,
        auth_token: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Bulk fetch order items for multiple orders, filtered by trip_id.

        Args:
            order_numbers: List of order numbers (e.g., ["ORD-001", "ORD-002"])
            trip_id: Current trip ID to filter assignments
            auth_token: JWT token for authentication
            tenant_id: Tenant ID for filtering

        Returns:
            Dictionary mapping order_number to list of items assigned to this trip
            Format: {
                "ORD-001": [
                    {
                        "id": "item-uuid",
                        "product_name": "Widget",
                        "assigned_quantity": 50,
                        ...
                    }
                ]
            }

        Raises:
            OrdersServiceError: If service is unavailable or request fails
        """
        if not order_numbers:
            return {}

        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        try:
            async with AsyncClient(timeout=self.bulk_timeout) as client:
                # Call bulk-fetch endpoint
                params = {}
                if tenant_id:
                    params["tenant_id"] = tenant_id

                response = await client.post(
                    f"{self.base_url}/api/v1/orders/trip-item-assignments/bulk-fetch",
                    json={"order_numbers": order_numbers},
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    # Log the raw response from Orders service
                    logger.info(f"===== RECEIVED BULK ITEMS FROM ORDERS SERVICE =====")
                    logger.info(f"Request: order_numbers={order_numbers}, trip_id={trip_id}")
                    logger.info(f"Raw response keys: {list(data.keys())}")
                    for order_num, order_data in data.items():
                        logger.info(f"\nOrder: {order_num}")
                        items = order_data.get("items", [])
                        logger.info(f"  Total items: {len(items)}")
                        for item in items:
                            logger.info(f"  - Item ID: {item.get('id')} (from order_items)")
                            logger.info(f"    Product: {item.get('product_name')}")
                            logger.info(f"    Original Quantity: {item.get('original_quantity')}")
                            assignments = item.get("assignments", [])
                            logger.info(f"    Assignments: {len(assignments)}")
                            for assignment in assignments:
                                logger.info(f"      - Trip: {assignment.get('trip_id')}, Qty: {assignment.get('assigned_quantity')}, Status: {assignment.get('item_status')}")
                    logger.info(f"===== END RAW BULK ITEMS RESPONSE =====")

                    # Filter items by trip_id
                    return self._filter_items_by_trip(data, trip_id)
                elif response.status_code == 401:
                    logger.error("Orders service authentication failed")
                    raise OrdersServiceError("Authentication failed")
                elif response.status_code == 403:
                    logger.error("Orders service authorization failed")
                    raise OrdersServiceError("Authorization failed")
                else:
                    logger.error(f"Orders service returned error: {response.status_code}")
                    raise OrdersServiceError(f"Service error: {response.status_code}")

        except TimeoutException:
            logger.error("Orders service timeout")
            raise OrdersServiceUnavailable("Service timeout")
        except HTTPError as e:
            logger.error(f"HTTP error calling Orders service: {e}")
            raise OrdersServiceUnavailable(f"HTTP error: {str(e)}")
        except OrdersServiceError:
            # Re-raise our custom exceptions
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Orders service: {e}")
            raise OrdersServiceUnavailable(f"Unexpected error: {str(e)}")

    def _filter_items_by_trip(
        self,
        bulk_data: Dict[str, Dict],
        trip_id: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Filter bulk response to include only items assigned to the specified trip.

        Args:
            bulk_data: Response from bulk-fetch endpoint
            trip_id: Trip ID to filter by

        Returns:
            Filtered dictionary with only items assigned to this trip
        """
        filtered_result = {}

        logger.info(f"===== FILTERING ITEMS FOR TRIP: {trip_id} =====")
        logger.info(f"Raw bulk_data keys (orders): {list(bulk_data.keys())}")

        for order_number, order_data in bulk_data.items():
            items = order_data.get("items", [])
            filtered_items = []

            logger.info(f"--- Processing Order: {order_number} ---")
            logger.info(f"Total items in order: {len(items)}")

            for item in items:
                assignments = item.get("assignments", [])

                # Log item details from order_items table
                logger.info(f"  Item from order_items:")
                logger.info(f"    - id (order_items.id): {item.get('id')}")
                logger.info(f"    - product_id: {item.get('product_id')}")
                logger.info(f"    - product_name: {item.get('product_name')}")
                logger.info(f"    - product_code: {item.get('product_code')}")
                logger.info(f"    - original_quantity: {item.get('original_quantity')}")
                logger.info(f"    - delivered_quantity: {item.get('delivered_quantity')}")
                logger.info(f"    - remaining_quantity: {item.get('remaining_quantity')}")

                # Log assignments from trip_item_assignments table
                logger.info(f"  Assignments from trip_item_assignments (count: {len(assignments)}):")
                for assignment in assignments:
                    logger.info(f"    - trip_id: {assignment.get('trip_id')}")
                    logger.info(f"    - assigned_quantity: {assignment.get('assigned_quantity')}")
                    logger.info(f"    - item_status: {assignment.get('item_status')}")
                    logger.info(f"    - assigned_at: {assignment.get('assigned_at')}")

                # Find assignment for this trip
                trip_assignment = None
                other_trips = []

                for assignment in assignments:
                    if assignment.get("trip_id") == trip_id:
                        trip_assignment = assignment
                    else:
                        other_trips.append(assignment.get("trip_id"))

                # Only include items assigned to this trip
                if trip_assignment:
                    filtered_item = {
                        "id": item.get("id"),
                        "product_id": item.get("product_id"),
                        "product_name": item.get("product_name"),
                        "product_code": item.get("product_code"),
                        "description": None,  # Not in bulk response
                        "quantity": item.get("original_quantity"),
                        "unit": "pcs",  # Default, not in bulk response
                        "unit_price": None,  # Not in bulk response
                        "total_price": None,  # Not in bulk response
                        "weight": None,  # Not in bulk response
                        "volume": None,  # Not in bulk response
                        "dimensions": None,
                        "assigned_quantity": trip_assignment.get("assigned_quantity"),
                        "item_status": trip_assignment.get("item_status"),
                        "assigned_at": trip_assignment.get("assigned_at"),
                        "is_partially_assigned": len(other_trips) > 0,
                        "other_trips": other_trips
                    }
                    filtered_items.append(filtered_item)
                    logger.info(f"  ✓ Item INCLUDED for trip {trip_id}")
                else:
                    logger.info(f"  ✗ Item SKIPPED (not assigned to trip {trip_id})")

            filtered_result[order_number] = filtered_items
            logger.info(f"--- Filtered {len(filtered_items)} items for order {order_number} ---")

        logger.info(f"===== FINAL FILTERED RESULT FOR TRIP {trip_id} =====")
        for order_num, items in filtered_result.items():
            logger.info(f"Order {order_num}: {len(items)} items")
            for item in items:
                logger.info(f"  - Item ID: {item.get('id')} (from order_items.id)")
                logger.info(f"    Product: {item.get('product_name')}")
                logger.info(f"    Quantity: {item.get('quantity')}")
                logger.info(f"    Assigned Quantity: {item.get('assigned_quantity')} (from trip_item_assignments)")
                logger.info(f"    Status: {item.get('item_status')}")

        return filtered_result

    async def update_order_items_status(
        self,
        order_number: str,
        trip_id: str,
        item_status: str,
        auth_token: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update all items for an order to a specific status (e.g., "delivered").
        This updates BOTH order_items and trip_item_assignments tables.

        Args:
            order_number: Order number (e.g., "ORD-001")
            trip_id: Trip ID for filtering assignments
            item_status: New status (e.g., "delivered", "on_route", etc.)
            auth_token: JWT token for authentication
            tenant_id: Tenant ID for filtering

        Returns:
            Response from Orders service with update details

        Raises:
            OrdersServiceError: If service is unavailable or request fails
        """
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        try:
            async with AsyncClient(timeout=self.timeout) as client:
                params = {}
                if tenant_id:
                    params["tenant_id"] = tenant_id

                # Call the item-status endpoint to update both tables
                response = await client.post(
                    f"{self.base_url}/api/v1/orders/item-status",
                    json={
                        "order_id": order_number,
                        "item_status": item_status,
                        "trip_id": trip_id
                    },
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        f"===== UPDATED ITEMS FOR ORDER: {order_number} TO STATUS: {item_status} ====="
                    )
                    logger.info(f"Trip ID: {trip_id}")
                    logger.info(f"Response: {result}")
                    logger.info(
                        f"This updated BOTH tables:"
                        f"\n  1. order_items: Set item_status = '{item_status}' for all items in order {order_number}"
                        f"\n  2. trip_item_assignments: Set item_status = '{item_status}' for all assignments for trip {trip_id}"
                    )
                    logger.info(f"===== END UPDATE ORDER ITEMS STATUS =====")
                    return result
                elif response.status_code == 401:
                    logger.error("Orders service authentication failed")
                    raise OrdersServiceError("Authentication failed")
                elif response.status_code == 403:
                    logger.error("Orders service authorization failed")
                    raise OrdersServiceError("Authorization failed")
                elif response.status_code == 404:
                    logger.error(f"Order {order_number} not found")
                    raise OrdersServiceError(f"Order {order_number} not found")
                else:
                    logger.error(f"Orders service returned error: {response.status_code} - {response.text}")
                    raise OrdersServiceError(f"Service error: {response.status_code}")

        except TimeoutException:
            logger.error("Orders service timeout")
            raise OrdersServiceUnavailable("Service timeout")
        except HTTPError as e:
            logger.error(f"HTTP error calling Orders service: {e}")
            raise OrdersServiceUnavailable(f"HTTP error: {str(e)}")
        except OrdersServiceError:
            # Re-raise our custom exceptions
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Orders service: {e}")
            raise OrdersServiceUnavailable(f"Unexpected error: {str(e)}")


# Create singleton instance
orders_client = OrdersServiceClient()
