"""
Tenant status validation middleware for Company Service
"""
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import httpx

from ..config_local import settings

logger = logging.getLogger(__name__)


class CompanyTenantStatusMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate tenant status by calling auth service
    Blocks requests from inactive tenants
    """

    def __init__(self, app):
        super().__init__(app)
        self._tenant_status_cache = {}
        self._cache_ttl = 60
        self._auth_service_url = settings.AUTH_SERVICE_URL

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate tenant status before processing request
        """
        # Skip tenant validation for public endpoints
        skip_paths = [
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/api/v1/internal",  # Skip internal endpoints for inter-service communication
        ]

        if request.url.path in skip_paths:
            return await call_next(request)

        # Get tenant_id from request state (set by authentication middleware)
        tenant_id = getattr(request.state, 'tenant_id', None)
        is_superuser = getattr(request.state, 'is_super_user', False)

        # Skip for super admins or if no tenant_id
        if is_superuser or not tenant_id:
            return await call_next(request)

        # Check tenant status via auth service
        is_active = await self._get_tenant_status_from_auth(tenant_id)

        if not is_active:
            logger.warning(
                f"Blocked request from inactive tenant {tenant_id} "
                f"path={request.url.path}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your company account has been deactivated. Please contact support."
            )

        return await call_next(request)

    async def _get_tenant_status_from_auth(self, tenant_id: str) -> bool:
        """
        Get tenant status from auth service with caching
        """
        current_time = time.time()

        # Check cache
        if tenant_id in self._tenant_status_cache:
            cached_data = self._tenant_status_cache[tenant_id]
            if current_time - cached_data['timestamp'] < self._cache_ttl:
                return cached_data['is_active']

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Call auth service to check tenant status
                response = await client.get(
                    f"{self._auth_service_url}/api/v1/companies/{tenant_id}/status",
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code == 200:
                    data = response.json()
                    is_active = data.get("is_active", False)

                    # Update cache
                    self._tenant_status_cache[tenant_id] = {
                        'is_active': is_active,
                        'timestamp': current_time
                    }

                    return is_active
                else:
                    # If auth service returns error, assume inactive for safety
                    logger.error(f"Failed to get tenant status from auth service: {response.status_code}")
                    return False

        except Exception as e:
            logger.error(f"Error checking tenant status: {e}")
            # Fail open for safety - don't block requests on auth service failure
            return True

    def invalidate_tenant_cache(self, tenant_id: str):
        """Invalidate cache for specific tenant"""
        if tenant_id in self._tenant_status_cache:
            del self._tenant_status_cache[tenant_id]
