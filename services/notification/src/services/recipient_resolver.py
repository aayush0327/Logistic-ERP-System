# Recipient Resolver Service - Determines who should receive notifications
import logging
from typing import List, Dict, Any, Optional, Set
import httpx
import asyncio
from datetime import datetime, timedelta

from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class RecipientResolver:
    """
    Resolves notification recipients based on event type and entity relationships.

    This service:
    1. Maps event types to roles (e.g., order.submitted -> finance_manager)
    2. Uses cached role-to-user mappings to avoid repeated auth-service calls
    3. Periodically refreshes the cache (every 5 minutes)
    4. Handles entity-specific recipients (e.g., specific driver for a trip)
    5. Filters by tenant_id

    Cache Structure:
    {
        "tenant_id": {
            "role_name": ["user_id1", "user_id2", ...],
            ...
        },
        ...
    }
    """

    # Cache refresh interval in seconds
    CACHE_REFRESH_INTERVAL = 300  # 5 minutes

    def __init__(self):
        self._auth_service_url = settings.AUTH_SERVICE_URL
        # Cache: tenant_id -> {role_name -> [user_ids]}
        self._role_cache: Dict[str, Dict[str, List[str]]] = {}
        # Cache timestamps: tenant_id -> last_refresh_time
        self._cache_timestamps: Dict[str, datetime] = {}
        # Lock for cache updates
        self._cache_lock = asyncio.Lock()

    async def resolve_recipients(
        self,
        tenant_id: str,
        event_type: str,
        entity_type: Optional[str],
        entity_id: Optional[str],
        role_list: List[str],
        data: Dict[str, Any]
    ) -> List[str]:
        """
        Resolve the list of user IDs who should receive a notification.

        Args:
            tenant_id: The tenant ID
            event_type: The event type (e.g., "order.submitted")
            entity_type: The entity type (e.g., "order", "trip")
            entity_id: The entity ID
            role_list: List of roles that should receive the notification
            data: Additional event data

        Returns:
            List of user IDs to notify
        """
        recipients: Set[str] = set()

        # Check for dynamic role resolution (for admin actions)
        dynamic_roles = data.get("notify_roles")
        if dynamic_roles and isinstance(dynamic_roles, list):
            # Use dynamic roles instead of role_list
            role_list = dynamic_roles

        # Resolve role-based recipients
        for role in role_list:
            users = await self._get_users_by_role(tenant_id, role)
            recipients.update(users)

        # Handle entity-specific recipients
        if entity_type and entity_id:
            entity_recipients = await self._get_entity_recipients(
                tenant_id,
                entity_type,
                entity_id,
                data
            )
            recipients.update(entity_recipients)

        # Filter out duplicates and convert to list
        result = list(recipients)

        logger.info(
            f"Resolved {len(result)} recipients for event {event_type}: {result}"
        )

        return result

    async def _get_users_by_role(self, tenant_id: str, role: str) -> List[str]:
        """
        Get list of user IDs with a specific role in a tenant.

        Uses cached role-to-user mappings to avoid repeated auth-service calls.
        Cache is refreshed every 5 minutes.

        This eliminates the performance bottleneck of calling auth-service
        for every notification. With caching, recipient resolution is
        virtually instant (in-memory lookup vs HTTP call).
        """
        # Check if we need to refresh the cache for this tenant
        await self._ensure_cache_fresh(tenant_id)

        # Get users from cache (fast in-memory lookup)
        if tenant_id in self._role_cache and role in self._role_cache[tenant_id]:
            cached_users = self._role_cache[tenant_id][role]
            logger.debug(
                f"Cache HIT: tenant={tenant_id}, role={role}, users={len(cached_users)}"
            )
            return cached_users

        # Cache miss - fetch from auth service (this should rarely happen)
        logger.warning(
            f"Cache MISS: tenant={tenant_id}, role={role}. "
            f"Fetching from auth-service (this is rare)"
        )
        return await self._fetch_users_by_role_from_auth(tenant_id, role)

    async def _ensure_cache_fresh(self, tenant_id: str) -> None:
        """
        Ensure the cache for a tenant is fresh.
        Refresh if: cache is empty OR cache is older than CACHE_REFRESH_INTERVAL
        """
        now = datetime.utcnow()
        needs_refresh = (
            tenant_id not in self._role_cache or
            tenant_id not in self._cache_timestamps or
            (now - self._cache_timestamps[tenant_id]).total_seconds() > self.CACHE_REFRESH_INTERVAL
        )

        if needs_refresh:
            async with self._cache_lock:
                # Double-check after acquiring lock (another task might have refreshed)
                if tenant_id in self._cache_timestamps:
                    time_since_refresh = (now - self._cache_timestamps[tenant_id]).total_seconds()
                    if time_since_refresh <= self.CACHE_REFRESH_INTERVAL:
                        return  # Already refreshed

                logger.info(f"Refreshing role cache for tenant {tenant_id}")
                await self._refresh_tenant_cache(tenant_id)

    async def _refresh_tenant_cache(self, tenant_id: str) -> None:
        """
        Refresh the role cache for a tenant by fetching all roles at once.

        This is more efficient than fetching roles one at a time.
        We batch fetch all common roles in a single request or minimal requests.
        """
        # Common roles we need to cache
        roles_to_cache = [
            "admin",
            "finance_manager",
            "branch_manager",
            "logistics_manager",
            "driver"
        ]

        if tenant_id not in self._role_cache:
            self._role_cache[tenant_id] = {}

        # Fetch each role and cache the results
        for role in roles_to_cache:
            users = await self._fetch_users_by_role_from_auth(tenant_id, role)
            self._role_cache[tenant_id][role] = users
            logger.debug(
                f"Cached {len(users)} users for role '{role}' in tenant {tenant_id}"
            )

        # Update timestamp
        self._cache_timestamps[tenant_id] = datetime.utcnow()
        logger.info(
            f"Cache refreshed for tenant {tenant_id}: "
            f"{sum(len(users) for users in self._role_cache[tenant_id].values())} total users"
        )

    async def _fetch_users_by_role_from_auth(self, tenant_id: str, role: str) -> List[str]:
        """
        Fetch users by role from auth-service (actual HTTP call).

        This is only called when:
        1. Cache is being refreshed (every 5 minutes)
        2. Cache miss occurs (rare)
        """
        try:
            # Convert role name from snake_case to Title Case for database lookup
            # e.g., "finance_manager" -> "Finance Manager"
            role_name_mapping = {
                "finance_manager": "Finance Manager",
                "branch_manager": "Branch Manager",
                "logistics_manager": "Logistics Manager",
                "driver": "Driver",
                "admin": "Admin",
                "superadmin": "Superadmin"
            }
            role_name = role_name_mapping.get(role, role.replace("_", " ").title())

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._auth_service_url}/api/v1/users/by-role/{role_name}",
                    params={"tenant_id": tenant_id},
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("users", [])
                else:
                    logger.error(
                        f"Failed to get users by role {role} (mapped to {role_name}): "
                        f"HTTP {response.status_code}"
                    )
                    return []

        except Exception as e:
            logger.error(f"Error querying auth-service for role {role}: {e}")
            return []

    async def invalidate_cache(self, tenant_id: Optional[str] = None) -> None:
        """
        Invalidate the cache for a tenant or all tenants.

        Useful when user roles change (e.g., user assigned/removed from a role).

        Args:
            tenant_id: If provided, invalidate only this tenant's cache.
                      If None, invalidate all caches.
        """
        async with self._cache_lock:
            if tenant_id:
                if tenant_id in self._role_cache:
                    del self._role_cache[tenant_id]
                if tenant_id in self._cache_timestamps:
                    del self._cache_timestamps[tenant_id]
                logger.info(f"Invalidated cache for tenant {tenant_id}")
            else:
                self._role_cache.clear()
                self._cache_timestamps.clear()
                logger.info("Invalidated all tenant caches")

    async def _get_entity_recipients(
        self,
        tenant_id: str,
        entity_type: str,
        entity_id: str,
        data: Dict[str, Any]
    ) -> List[str]:
        """
        Get entity-specific recipients.

        For example:
        - For a trip, get the assigned driver
        - For an order, get the branch manager
        """
        if entity_type == "trip":
            return await self._get_trip_recipients(tenant_id, entity_id, data)
        elif entity_type == "order":
            return await self._get_order_recipients(tenant_id, entity_id, data)
        else:
            return []

    async def _get_trip_recipients(
        self,
        tenant_id: str,
        trip_id: str,
        data: Dict[str, Any]
    ) -> List[str]:
        """
        Get recipients for a trip notification.

        Returns:
        - The assigned driver (if any)
        - The branch manager (from the trip's branch)
        """
        recipients = []

        # Check if driver_id is in event data
        driver_id = data.get("driver_id")
        if driver_id:
            recipients.append(driver_id)

        # Get trip details from TMS service if needed
        # For now, we'll extract from event data if present
        if "branch_id" in data:
            # Could get branch manager from auth-service
            pass

        return recipients

    async def _get_order_recipients(
        self,
        tenant_id: str,
        order_id: str,
        data: Dict[str, Any]
    ) -> List[str]:
        """
        Get recipients for an order notification.

        Returns:
        - The branch manager (from the order's branch)
        - The creator of the order (if different from current user)
        """
        recipients = []

        # Check if branch_manager_id is in event data
        branch_manager_id = data.get("branch_manager_id")
        if branch_manager_id:
            recipients.append(branch_manager_id)

        # Check if created_by is in event data
        created_by = data.get("created_by")
        if created_by:
            recipients.append(created_by)

        return recipients

    async def resolve_branch_managers(
        self,
        tenant_id: str
    ) -> List[str]:
        """
        Get all branch managers for a tenant.

        Useful for notifications that need to go to all branch managers.
        """
        return await self._get_users_by_role(tenant_id, "branch_manager")

    async def resolve_finance_managers(
        self,
        tenant_id: str
    ) -> List[str]:
        """
        Get all finance managers for a tenant.
        """
        return await self._get_users_by_role(tenant_id, "finance_manager")

    async def resolve_logistics_managers(
        self,
        tenant_id: str
    ) -> List[str]:
        """
        Get all logistics managers for a tenant.
        """
        return await self._get_users_by_role(tenant_id, "logistics_manager")

    async def resolve_drivers(
        self,
        tenant_id: str
    ) -> List[str]:
        """
        Get all drivers for a tenant.
        """
        return await self._get_users_by_role(tenant_id, "driver")

    async def get_user_details(
        self,
        user_ids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get details for multiple users from auth-service.

        Returns a mapping of user_id -> user_details
        """
        if not user_ids:
            return {}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self._auth_service_url}/api/v1/users/batch",
                    json={"user_ids": user_ids},
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("users", {})
                else:
                    logger.error(
                        f"Failed to get user details: HTTP {response.status_code}"
                    )
                    return {}

        except Exception as e:
            logger.error(f"Error getting user details: {e}")
            return {}
