"""
Tenant isolation middleware for Finance Service
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Tenant isolation middleware for Finance Service
    Ensures tenant isolation at the application level
    """

    async def dispatch(self, request: Request, call_next):
        """
        Process request through tenant isolation middleware
        """
        # Extract tenant ID from JWT token (set by auth middleware)
        tenant_id = getattr(request.state, 'tenant_id', None)

        if not tenant_id:
            # Skip tenant check for non-tenant routes
            skip_paths = ["/health", "/ready", "/metrics", "/docs", "/openapi.json", "/redoc"]
            if request.url.path in skip_paths:
                return await call_next(request)

            logger.error(f"Tenant ID missing for request: {request.url.path}")
            return JSONResponse(
                status_code=401,
                content={"error": "Tenant identification required"}
            )

        # Add tenant context to request state for use in endpoints
        request.state.tenant_id = tenant_id

        # Log request with tenant context
        logger.info(f"Request: {request.method} {request.url.path} - Tenant: {tenant_id}")

        response = await call_next(request)

        return response