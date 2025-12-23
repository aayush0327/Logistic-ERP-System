"""
Permission service for database lookup with caching
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import json

from ..database import Role, Permission, RolePermission


class PermissionService:
    """Service for managing user permissions with database lookup and caching"""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 900  # 15 minutes cache TTL
        self._cache_hits = 0
        self._cache_misses = 0

    async def get_user_permissions(self, user_id: str, role_id: int) -> List[str]:
        """Get all permissions for a user based on their role with caching"""
        cache_key = f"user_permissions:{user_id}"
        current_time = datetime.utcnow()

        # Check cache first
        if cache_key in self._cache:
            cache_entry = self._cache[cache_key]
            if current_time < cache_entry["expires_at"]:
                self._cache_hits += 1
                return cache_entry["permissions"]
            else:
                # Cache expired, remove it
                del self._cache[cache_key]

        self._cache_misses += 1

        # Query database for permissions
        query = (
            select(Permission)
            .join(RolePermission)
            .where(RolePermission.role_id == role_id)
            .order_by(Permission.resource, Permission.action)
        )

        result = await self.db.execute(query)
        permissions = [
            f"{perm.resource}:{perm.action}"
            for perm in result.scalars().all()
        ]

        # Cache the result
        self._cache[cache_key] = {
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

    async def get_permissions_with_metadata(self, user_id: str, role_id: int) -> Dict[str, Any]:
        """Get permissions with additional metadata for debugging"""
        permissions = await self.get_user_permissions(user_id, role_id)

        return {
            "user_id": user_id,
            "role_id": role_id,
            "permissions": permissions,
            "permission_count": len(permissions),
            "cache_stats": {
                "hits": self._cache_hits,
                "misses": self._cache_misses,
                "hit_rate": self._cache_hits / (self._cache_hits + self._cache_misses) if (self._cache_hits + self._cache_misses) > 0 else 0
            },
            "cached_at": datetime.utcnow().isoformat()
        }

    async def invalidate_user_cache(self, user_id: str):
        """Invalidate cached permissions for a specific user"""
        cache_key = f"user_permissions:{user_id}"
        if cache_key in self._cache:
            del self._cache[cache_key]

    async def invalidate_role_cache(self, role_id: int):
        """Invalidate cache for all users with a specific role"""
        keys_to_remove = []
        for cache_key in self._cache.keys():
            if cache_key.startswith("user_permissions:"):
                # This is a simplified approach - in production, you'd want to maintain
                # a reverse index of role_id -> user_ids for efficient invalidation
                keys_to_remove.append(cache_key)

        for key in keys_to_remove:
            del self._cache[key]

    def clear_cache(self):
        """Clear all cached permissions"""
        self._cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self._cache_hits + self._cache_misses
        return {
            "cache_size": len(self._cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": self._cache_hits / total_requests if total_requests > 0 else 0,
            "total_requests": total_requests
        }

    async def preload_permissions(self, user_ids: List[str], role_ids: List[int]):
        """Preload permissions for multiple users (batch operation)"""
        # Batch query for all roles
        query = (
            select(RolePermission.role_id, Permission.resource, Permission.action)
            .join(Permission)
            .where(RolePermission.role_id.in_(role_ids))
            .order_by(RolePermission.role_id, Permission.resource, Permission.action)
        )

        result = await self.db.execute(query)
        role_permissions = {}

        for row in result.all():
            role_id, resource, action = row
            if role_id not in role_permissions:
                role_permissions[role_id] = []
            role_permissions[role_id].append(f"{resource}:{action}")

        # Cache permissions for each user
        current_time = datetime.utcnow()
        for user_id, role_id in zip(user_ids, role_ids):
            if role_id in role_permissions:
                cache_key = f"user_permissions:{user_id}"
                self._cache[cache_key] = {
                    "permissions": role_permissions[role_id],
                    "expires_at": current_time + timedelta(seconds=self._cache_ttl)
                }