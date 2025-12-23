"""
Audit logging middleware for Orders Service
"""
import json
import logging
import time
from typing import Callable, Optional, Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log API requests and responses for audit purposes
    """

    def __init__(
        self,
        app,
        log_requests: bool = True,
        log_responses: bool = True,
        log_headers: bool = False,
        log_body: bool = False,
        exclude_paths: Optional[list] = None,
        exclude_health_checks: bool = True
    ):
        super().__init__(app)
        self.log_requests = log_requests
        self.log_responses = log_responses
        self.log_headers = log_headers
        self.log_body = log_body
        self.exclude_paths = exclude_paths or ["/metrics", "/docs", "/redoc", "/openapi.json"]
        self.exclude_health_checks = exclude_health_checks

        # Configure audit logger
        self.audit_logger = logging.getLogger("orders_audit")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Log request and response details for audit purposes

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Skip logging for excluded paths
        if self._should_exclude_path(request.url.path):
            return await call_next(request)

        # Get request start time
        start_time = time.time()

        # Collect request information
        request_data = await self._collect_request_data(request)

        # Log request
        if self.log_requests:
            self._log_request(request_data)

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Collect response information
        response_data = self._collect_response_data(response, duration)

        # Log response
        if self.log_responses:
            self._log_response(request_data, response_data)

        # Store request data in state for potential downstream use
        request.state.audit_data = {
            "request": request_data,
            "response": response_data
        }

        return response

    def _should_exclude_path(self, path: str) -> bool:
        """
        Check if path should be excluded from audit logging

        Args:
            path: Request path

        Returns:
            True if path should be excluded, False otherwise
        """
        # Check specific excluded paths
        if path in self.exclude_paths:
            return True

        # Check health checks
        if self.exclude_health_checks and path in ["/health", "/ready"]:
            return True

        # Check path prefixes
        for excluded_path in self.exclude_paths:
            if path.startswith(excluded_path):
                return True

        return False

    async def _collect_request_data(self, request: Request) -> Dict[str, Any]:
        """
        Collect request information for audit logging

        Args:
            request: HTTP request

        Returns:
            Dictionary containing request information
        """
        request_data = {
            "timestamp": time.time(),
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent"),
        }

        # Add user and tenant information if available
        if hasattr(request.state, 'user_id'):
            request_data["user_id"] = request.state.user_id
        if hasattr(request.state, 'tenant_id'):
            request_data["tenant_id"] = request.state.tenant_id
        if hasattr(request.state, 'role_id'):
            request_data["role_id"] = request.state.role_id

        # Add headers if enabled
        if self.log_headers:
            request_data["headers"] = dict(request.headers)

        # Add body if enabled and safe to log
        if self.log_body and request.method in ["POST", "PUT", "PATCH"]:
            try:
                # Only log if content type is JSON and size is reasonable
                content_type = request.headers.get("content-type", "")
                if "application/json" in content_type:
                    body = await request.body()
                    if len(body) < 10000:  # 10KB limit
                        request_data["body"] = json.loads(body.decode())
                    else:
                        request_data["body"] = "<too large>"
            except Exception as e:
                logger.warning(f"Failed to log request body: {str(e)}")

        return request_data

    def _collect_response_data(self, response: Response, duration: float) -> Dict[str, Any]:
        """
        Collect response information for audit logging

        Args:
            response: HTTP response
            duration: Request duration in seconds

        Returns:
            Dictionary containing response information
        """
        response_data = {
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
        }

        # Add response headers if enabled
        if self.log_headers:
            response_data["headers"] = dict(response.headers)

        # Add content length if available
        if hasattr(response, 'headers') and 'content-length' in response.headers:
            response_data["content_length"] = response.headers['content-length']

        return response_data

    def _log_request(self, request_data: Dict[str, Any]):
        """
        Log request information

        Args:
            request_data: Request information dictionary
        """
        log_message = (
            f"API Request: {request_data['method']} {request_data['path']} | "
            f"IP: {request_data['client_ip']}"
        )

        # Add user information if available
        if 'user_id' in request_data:
            log_message += f" | User: {request_data['user_id']}"
        if 'tenant_id' in request_data:
            log_message += f" | Tenant: {request_data['tenant_id']}"

        # Log at INFO level for normal requests
        self.audit_logger.info(log_message, extra={"request_data": request_data})

        # Log sensitive operations at WARNING level
        if self._is_sensitive_operation(request_data):
            self.audit_logger.warning(
                f"Sensitive operation: {log_message}",
                extra={"request_data": request_data}
            )

    def _log_response(self, request_data: Dict[str, Any], response_data: Dict[str, Any]):
        """
        Log response information

        Args:
            request_data: Request information dictionary
            response_data: Response information dictionary
        """
        log_message = (
            f"API Response: {response_data['status_code']} | "
            f"Duration: {response_data['duration_ms']}ms | "
            f"{request_data['method']} {request_data['path']}"
        )

        # Add user information if available
        if 'user_id' in request_data:
            log_message += f" | User: {request_data['user_id']}"

        # Log based on status code
        if response_data['status_code'] >= 500:
            self.audit_logger.error(log_message, extra={
                "request_data": request_data,
                "response_data": response_data
            })
        elif response_data['status_code'] >= 400:
            self.audit_logger.warning(log_message, extra={
                "request_data": request_data,
                "response_data": response_data
            })
        else:
            self.audit_logger.info(log_message, extra={
                "request_data": request_data,
                "response_data": response_data
            })

    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address from request

        Args:
            request: HTTP request

        Returns:
            Client IP address
        """
        # Check for forwarded headers first
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _is_sensitive_operation(self, request_data: Dict[str, Any]) -> bool:
        """
        Check if the operation is sensitive and requires special logging

        Args:
            request_data: Request information dictionary

        Returns:
            True if operation is sensitive, False otherwise
        """
        sensitive_patterns = [
            "/delete",
            "/approve",
            "/cancel",
            "/payment",
            "/refund",
            "/login",
            "/logout",
        ]

        path = request_data.get('path', '').lower()
        method = request_data.get('method', '').upper()

        # Check for sensitive paths
        for pattern in sensitive_patterns:
            if pattern in path:
                return True

        # Check for sensitive methods
        if method in ["DELETE", "POST"] and any(keyword in path for keyword in ["password", "token", "auth"]):
            return True

        return False


class DatabaseAuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware to audit database operations
    """

    def __init__(self, app):
        super().__init__(app)
        self.audit_logger = logging.getLogger("orders_db_audit")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Track database operations for audit purposes

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Set up database audit context in request state
        request.state.db_audit = {
            "operations": [],
            "start_time": time.time()
        }

        # Process request
        response = await call_next(request)

        # Log database operations if any were tracked
        if hasattr(request.state, 'db_audit') and request.state.db_audit["operations"]:
            self._log_database_operations(request)

        return response

    def _log_database_operations(self, request: Request):
        """
        Log tracked database operations

        Args:
            request: HTTP request with audit data
        """
        audit_data = request.state.db_audit
        operations = audit_data["operations"]

        user_id = getattr(request.state, 'user_id', 'unknown')
        tenant_id = getattr(request.state, 'tenant_id', 'unknown')

        for operation in operations:
            log_message = (
                f"DB Operation: {operation['operation']} on {operation['table']} | "
                f"User: {user_id} | Tenant: {tenant_id}"
            )

            if operation['operation'] in ['DELETE', 'UPDATE']:
                self.audit_logger.warning(log_message, extra={
                    "operation": operation,
                    "request_path": request.url.path,
                    "request_method": request.method
                })
            else:
                self.audit_logger.info(log_message, extra={
                    "operation": operation,
                    "request_path": request.url.path,
                    "request_method": request.method
                })