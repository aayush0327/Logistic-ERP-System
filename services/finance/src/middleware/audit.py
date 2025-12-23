"""
Audit logging middleware for Finance Service
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("finance_audit")


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Audit logging middleware for Finance Service
    """

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        """
        Process request through audit logging middleware
        """
        if not self.enabled:
            return await call_next(request)

        start_time = time.time()

        try:
            # Get request details
            method = request.method
            path = request.url.path
            query_params = str(request.query_params)
            client_ip = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent", "unknown")

            # Get user info from request state (set by auth middleware)
            user_id = getattr(request.state, 'user_id', None)
            tenant_id = getattr(request.state, 'tenant_id', None)

            response = await call_next(request)

            # Calculate duration
            process_time = time.time() - start_time

            # Log request details
            logger.info(
                f"API Request: {method} {path} - "
                f"Status: {response.status_code} - "
                f"Duration: {process_time:.3f}s - "
                f"IP: {client_ip} - "
                f"User: {user_id} - "
                f"Tenant: {tenant_id} - "
                f"Query: {query_params} - "
                f"User-Agent: {user_agent}"
            )

            # Log sensitive operations
            if path.startswith("/api/v1/approvals") and method in ["POST", "PUT", "PATCH"]:
                logger.info(
                    f"APPROVAL OPERATION: {method} {path} - "
                    f"User: {user_id} - "
                    f"Tenant: {tenant_id} - "
                    f"Status: {response.status_code}"
                )

            return response

        except Exception as e:
            # Log error
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {method} {path} - "
                f"Duration: {process_time:.3f}s - "
                f"Error: {str(e)} - "
                f"User: {getattr(request.state, 'user_id', 'unknown')} - "
                f"Tenant: {getattr(request.state, 'tenant_id', 'unknown')}"
            )
            raise