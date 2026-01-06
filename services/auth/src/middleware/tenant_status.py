"""
Tenant status validation middleware for Auth Service
"""
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..database import Tenant, AsyncSessionLocal
from sqlalchemy import select

logger = logging.getLogger(__name__)


class TenantStatusMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate tenant status on authenticated requests
    Blocks requests from inactive tenants
    """

    def __init__(self, app):
        super().__init__(app)
        self._tenant_status_cache = {}
        self._cache_ttl = 60

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
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/openapi.json",
            "/redoc",
        ]

        if request.url.path in skip_paths:
            return await call_next(request)

        # Try to get tenant_id from JWT token in Authorization header
        tenant_id = None
        is_superuser = False

        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from ..auth import verify_token
                token = auth_header[7:]  # Remove "Bearer " prefix
                token_data = verify_token(token)
                tenant_id = getattr(token_data, 'tenant_id', None)
                is_superuser = getattr(token_data, 'is_superuser', False)
            except Exception as e:
                # If token is invalid, let the request proceed to endpoints
                # The endpoints will handle authentication properly
                pass

        # Skip for super admins (no tenant) or if no tenant_id
        if is_superuser or not tenant_id:
            return await call_next(request)

        # Check tenant status
        is_active = await self._get_tenant_status(tenant_id)

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

    async def _get_tenant_status(self, tenant_id: str) -> bool:
        """
        Get tenant status with caching for performance
        """
        current_time = time.time()

        # Check cache
        if tenant_id in self._tenant_status_cache:
            cached_data = self._tenant_status_cache[tenant_id]
            if current_time - cached_data['timestamp'] < self._cache_ttl:
                return cached_data['is_active']

        # Query database for tenant status
        async with AsyncSessionLocal() as db:
            query = select(Tenant.is_active).where(Tenant.id == tenant_id)
            result = await db.execute(query)
            is_active = result.scalar_one_or_none()

            # If tenant not found, assume inactive
            if is_active is None:
                is_active = False

            # Update cache
            self._tenant_status_cache[tenant_id] = {
                'is_active': is_active,
                'timestamp': current_time
            }

            return is_active

    def invalidate_tenant_cache(self, tenant_id: str):
        """
        Invalidate cache for specific tenant (call when tenant status changes)
        """
        if tenant_id in self._tenant_status_cache:
            del self._tenant_status_cache[tenant_id]
