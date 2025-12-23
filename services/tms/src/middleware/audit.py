"""
Audit logging middleware for TMS Service
"""
from datetime import datetime
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time

logger = logging.getLogger("tms_audit")


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log API requests for audit purposes
    """

    def __init__(self, app, sensitive_fields: list = None):
        """
        Initialize audit logging middleware

        Args:
            app: ASGI application
            sensitive_fields: List of sensitive field names to redact in logs
        """
        super().__init__(app)
        self.sensitive_fields = sensitive_fields or [
            'password', 'token', 'secret', 'key', 'authorization'
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Log request details for audit

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        if not request.url.path.startswith("/api/"):
            # Only audit API endpoints
            return await call_next(request)

        start_time = time.time()

        # Prepare audit data
        audit_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query_params": self._sanitize_data(dict(request.query_params)),
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("User-Agent"),
        }

        # Add user context if available (should be set by auth middleware)
        if hasattr(request.state, 'user_id'):
            audit_data.update({
                "user_id": request.state.user_id,
                "tenant_id": getattr(request.state, 'tenant_id', None),
                "role_id": getattr(request.state, 'role_id', None),
                "permissions": getattr(request.state, 'permissions', []),
            })

        # Log request
        logger.info(f"API Request: {request.method} {request.url.path}", extra={"audit_data": audit_data})

        # Process request
        try:
            response = await call_next(request)

            # Calculate response time
            duration = time.time() - start_time

            # Update audit data with response info
            audit_data.update({
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "success": response.status_code < 400,
            })

            # Log response
            logger.info(
                f"API Response: {response.status_code} | Duration: {duration:.3f}s",
                extra={"audit_data": audit_data}
            )

            return response

        except HTTPException as e:
            # Calculate response time for HTTP exceptions
            duration = time.time() - start_time

            # Update audit data with error info
            audit_data.update({
                "status_code": e.status_code,
                "duration_ms": round(duration * 1000, 2),
                "success": False,
                "error": e.detail,
            })

            # Log HTTP exception
            logger.warning(
                f"API Error: {e.status_code} | Duration: {duration:.3f}s",
                extra={"audit_data": audit_data}
            )

            raise

        except Exception as e:
            # Calculate response time for other exceptions
            duration = time.time() - start_time

            # Update audit data with error info
            audit_data.update({
                "status_code": 500,
                "duration_ms": round(duration * 1000, 2),
                "success": False,
                "error": str(e),
            })

            # Log unexpected error
            logger.error(
                f"API Unexpected Error: {str(e)} | Duration: {duration:.3f}s",
                extra={"audit_data": audit_data},
                exc_info=True
            )

            raise

    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address from request, considering proxies

        Args:
            request: FastAPI request object

        Returns:
            Client IP address
        """
        # Check for forwarded IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            return forwarded_for.split(",")[0].strip()

        # Check for real IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct connection IP
        return request.client.host if request.client else "unknown"

    def _sanitize_data(self, data: dict) -> dict:
        """
        Sanitize data by redacting sensitive fields

        Args:
            data: Dictionary to sanitize

        Returns:
            Sanitized dictionary
        """
        if not data:
            return data

        sanitized = {}
        for key, value in data.items():
            if key.lower() in self.sensitive_fields:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            else:
                sanitized[key] = value

        return sanitized