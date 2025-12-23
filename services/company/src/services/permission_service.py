"""
Permission service for Company Service - communicates with Auth Service
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import httpx
import logging
from src.config_local import settings

logger = logging.getLogger(__name__)


class CompanyServicePermission:
    """Permission service for Company Service that fetches permissions from Auth Service"""

    def __init__(self):
        self.auth_service_url = getattr(settings, 'AUTH_SERVICE_URL', "http://localhost:8001")
        self.cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 900  # 15 minutes cache TTL
        self._cache_hits = 0
        self._cache_misses = 0

    async def get_user_permissions(self, user_id: str, role_id: int) -> List[str]:
        """Get permissions for a user from Auth Service with caching"""
        cache_key = f"user_permissions:{user_id}"
        current_time = datetime.utcnow()

        # Check cache first
        if cache_key in self.cache:
            cache_entry = self.cache[cache_key]
            if current_time < cache_entry["expires_at"]:
                self._cache_hits += 1
                return cache_entry["permissions"]
            else:
                # Cache expired, remove it
                del self.cache[cache_key]

        self._cache_misses += 1

        try:
            # Fetch permissions from Auth Service
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.auth_service_url}/api/v1/permissions/user/{user_id}",
                    headers={"Accept": "application/json"}
                )

                if response.status_code == 200:
                    data = response.json()
                    permissions = data.get("permissions", [])
                else:
                    logger.error(f"Failed to fetch permissions: {response.status_code}")
                    permissions = []

        except Exception as e:
            logger.error(f"Error fetching permissions from auth service: {str(e)}")
            permissions = []

        # Cache the result
        self.cache[cache_key] = {
            "permissions": permissions,
            "expires_at": current_time + timedelta(seconds=self._cache_ttl)
        }

        return permissions

    async def check_permission(self, user_id: str, role_id: int, required_permission: str) -> bool:
        """Check if user has a specific permission"""
        permissions = await self.get_user_permissions(user_id, role_id)

        # Direct permission check
        if required_permission in permissions:
            return True

        # Wildcard permission checks
        resource = required_permission.split(':')[0]
        wildcard_permissions = [
            f"{resource}:*",
            f"{resource}:all",
            "*:*",
            "*:all"
        ]

        for wildcard_perm in wildcard_permissions:
            if wildcard_perm in permissions:
                return True

        return False

    async def check_any_permission(self, user_id: str, role_id: int, required_permissions: List[str]) -> bool:
        """Check if user has any of the specified permissions"""
        permissions = await self.get_user_permissions(user_id, role_id)

        # Check each required permission
        for required_perm in required_permissions:
            if required_perm in permissions:
                return True

            # Check wildcard permissions
            resource = required_perm.split(':')[0]
            wildcard_permissions = [
                f"{resource}:*",
                f"{resource}:all",
                "*:*",
                "*:all"
            ]

            for wildcard_perm in wildcard_permissions:
                if wildcard_perm in permissions:
                    return True

        return False

    async def invalidate_user_cache(self, user_id: str):
        """Invalidate cached permissions for a specific user"""
        cache_key = f"user_permissions:{user_id}"
        if cache_key in self.cache:
            del self.cache[cache_key]

    def clear_cache(self):
        """Clear all cached permissions"""
        self.cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self._cache_hits + self._cache_misses
        return {
            "cache_size": len(self.cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": self._cache_hits / total_requests if total_requests > 0 else 0,
            "total_requests": total_requests
        }