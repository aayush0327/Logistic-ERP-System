"""
Audit Client for sending audit events to Company Service (Driver)
"""
import logging
from typing import Optional, Dict, Any
from httpx import AsyncClient, HTTPError
from src.config import settings

logger = logging.getLogger(__name__)

# Company service URL - adjust based on your environment
COMPANY_SERVICE_URL = "http://company-service:8002"
AUTH_SERVICE_URL = "http://auth-service:8001"

# Cache for user details to avoid repeated lookups
_user_cache: Dict[str, Dict[str, str]] = {}


class AuditClient:
    """
    Client for sending audit logs to Company service

    This client provides a non-blocking way to send audit events.
    If the audit log fails to send, it logs the error but doesn't
    affect the main business logic.
    """

    def __init__(self, auth_headers: dict):
        """
        Initialize audit client

        Args:
            auth_headers: Dictionary containing authorization headers
                         (typically {"Authorization": "Bearer <token>"})
        """
        self.auth_headers = auth_headers
        self.client = AsyncClient(timeout=10.0)
        self.auth_client = AsyncClient(timeout=5.0)

    async def _fetch_user_details(self, user_id: str) -> Dict[str, str]:
        """
        Fetch user details from auth service

        Args:
            user_id: ID of the user to fetch details for

        Returns:
            Dictionary with user_name and user_email
        """
        # Check cache first
        if user_id in _user_cache:
            return _user_cache[user_id]

        try:
            response = await self.auth_client.get(
                f"{AUTH_SERVICE_URL}/api/v1/users/{user_id}",
                headers=self.auth_headers
            )

            if response.status_code == 200:
                user_data = response.json()
                user_details = {
                    "user_name": user_data.get("full_name") or user_data.get("username", ""),
                    "user_email": user_data.get("email", ""),
                    "user_role": user_data.get("role_name", "")
                }
                # Cache the result
                _user_cache[user_id] = user_details
                return user_details
            else:
                logger.warning(f"Failed to fetch user details: {response.status_code}")
                return {"user_name": "", "user_email": "", "user_role": ""}
        except Exception as e:
            logger.error(f"Error fetching user details: {str(e)}")
            return {"user_name": "", "user_email": "", "user_role": ""}

    async def log_event(
        self,
        tenant_id: str,
        user_id: str,
        user_name: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        action: str = "status_change",
        module: str = "trips",
        entity_type: str = "trip_order",
        entity_id: str = "",
        description: str = "",
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        from_status: Optional[str] = None,
        to_status: Optional[str] = None,
        approval_status: Optional[str] = None,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        Send audit log to Company service

        Args:
            tenant_id: Tenant ID
            user_id: ID of the user performing the action
            user_name: Name of the user (optional, will be fetched if not provided)
            user_email: Email of the user (optional, will be fetched if not provided)
            user_role: Role of the user (optional)
            action: Action performed (create, update, delete, status_change, etc.)
            module: Module name (orders, trips, customers, etc.)
            entity_type: Type of entity (order, trip, customer, etc.)
            entity_id: ID of the affected entity
            description: Human-readable description of the action
            old_values: Previous values (for updates)
            new_values: New values (for updates/creates)
            from_status: Previous status (for status changes)
            to_status: New status (for status changes)
            approval_status: approved/rejected (for approvals)
            reason: Reason for the action (for rejections, cancellations)
            ip_address: IP address of the user
            user_agent: Browser/client info

        Returns:
            True if successful, False otherwise (non-blocking)
        """
        # Fetch user details if not provided
        if not user_name or not user_email or not user_role:
            user_details = await self._fetch_user_details(user_id)
            if not user_name:
                user_name = user_details.get("user_name", "")
            if not user_email:
                user_email = user_details.get("user_email", "")
            if not user_role:
                user_role = user_details.get("user_role", "")

        try:
            payload = {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "user_name": user_name,
                "user_email": user_email,
                "user_role": user_role,
                "action": action,
                "module": module,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "description": description,
                "old_values": old_values,
                "new_values": new_values,
                "from_status": from_status,
                "to_status": to_status,
                "approval_status": approval_status,
                "reason": reason,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "service_name": "driver"
            }

            response = await self.client.post(
                f"{COMPANY_SERVICE_URL}/audit/logs",
                json=payload,
                headers=self.auth_headers
            )

            if response.status_code == 201:
                logger.debug(f"Audit log created: {action} on {entity_type} {entity_id}")
                return True
            else:
                logger.warning(
                    f"Failed to create audit log: {response.status_code} - {response.text}"
                )
                return False

        except HTTPError as e:
            logger.error(f"HTTP error sending audit log: {str(e)}")
            return False
        except Exception as e:
            # Don't let audit logging failures break the main flow
            logger.error(f"Error sending audit log: {str(e)}")
            return False

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
        await self.auth_client.aclose()
