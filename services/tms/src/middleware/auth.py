"""
Authentication middleware for TMS Service - Based on Company Service Implementation
"""
from typing import List, Optional
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time

from src.security import (
    verify_token,
    extract_token_from_header,
    log_authentication_event,
)
from src.security.exceptions import (
    RateLimitExceededError,
    TokenExpiredError,
    TokenInvalidError,
)
from src.config import settings

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle JWT authentication for all requests
    """

    def __init__(self, app, skip_paths: List[str] = None):
        """
        Initialize authentication middleware

        Args:
            app: ASGI application
            skip_paths: List of paths to skip authentication
        """
        super().__init__(app)
        self.skip_paths = skip_paths or [
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/favicon.ico",
            "/static",
            "/api/v1/internal",  # Skip internal endpoints for inter-service communication
        ]

    def _should_skip_path(self, path: str) -> bool:
        """
        Check if the path should be skipped from authentication

        Args:
            path: Request path

        Returns:
            True if path should be skipped, False otherwise
        """
        # Skip exact matches
        if path in self.skip_paths:
            return True

        # Skip paths that start with any skip path
        for skip_path in self.skip_paths:
            if skip_path.endswith("/"):
                if path.startswith(skip_path):
                    return True
            else:
                if path == skip_path or path.startswith(skip_path + "/"):
                    return True
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through authentication middleware

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Check if path should be skipped
        if self._should_skip_path(request.url.path):
            return await call_next(request)

        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization:
            log_authentication_event(
                "MISSING_TOKEN",
                request=request,
                success=False,
                reason="Missing Authorization header"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            # Extract token from header
            token = extract_token_from_header(authorization)

            # Verify token and get user data
            token_data = verify_token(token)

            # Add user context to request state
            request.state.user_id = token_data.user_id
            request.state.tenant_id = token_data.tenant_id
            request.state.role_id = token_data.role_id
            request.state.permissions = token_data.permissions
            request.state.is_super_user = token_data.is_super_user()

            # Log successful authentication
            log_authentication_event(
                "TOKEN_VALIDATED",
                token_data=token_data,
                request=request,
                success=True
            )

            # Continue to next middleware
            return await call_next(request)

        except TokenExpiredError as e:
            log_authentication_event(
                "TOKEN_EXPIRED",
                request=request,
                success=False,
                reason="Token has expired"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        except TokenInvalidError as e:
            log_authentication_event(
                "TOKEN_INVALID",
                request=request,
                success=False,
                reason=str(e)
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        except Exception as e:
            logger.error(f"Authentication middleware error: {str(e)}")
            # For security exceptions, raise HTTPException with proper status
            if isinstance(e, (TokenExpiredError, TokenInvalidError)):
                raise
            # For other exceptions, raise a generic 401 to avoid leaking details
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

    

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for TMS Service
    """

    def __init__(self, app):
        super().__init__(app)
        self.requests = {}
        self.settings = getattr(settings, 'rate_limit', {})
        self.per_minute_limit = self.settings.get('per_minute', 60)
        self.per_hour_limit = self.settings.get('per_hour', 1000)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through rate limiting middleware
        """
        client_id = self._get_client_id(request)
        now = time.time()

        # Clean old entries
        self._cleanup_old_entries(now)

        # Check rate limits
        if not self._check_rate_limit(client_id, now):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={
                    "X-RateLimit-Limit": str(self.per_minute_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + 60))
                }
            )

        # Record request
        self._record_request(client_id, now)

        # Continue to next middleware
        response = await call_next(request)

        # Add rate limit headers
        self._add_rate_limit_headers(response, client_id)

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Try to get user_id from request state (set by auth middleware)
        if hasattr(request.state, 'user_id'):
            return f"user:{request.state.user_id}"

        # Fall back to IP address
        return f"ip:{request.client.host if request.client else 'unknown'}"

    def _cleanup_old_entries(self, now: float):
        """Clean up old rate limit entries"""
        cutoff = now - 3600  # 1 hour
        self.requests = {
            client_id: requests
            for client_id, requests in self.requests.items()
            if any(req_time > cutoff for req_time in requests)
        }

    def _check_rate_limit(self, client_id: str, now: float) -> bool:
        """Check if client has exceeded rate limits"""
        requests = self.requests.get(client_id, [])

        # Check minute limit
        minute_requests = [req_time for req_time in requests if now - req_time < 60]
        if len(minute_requests) >= self.per_minute_limit:
            return False

        # Check hour limit
        hour_requests = [req_time for req_time in requests if now - req_time < 3600]
        if len(hour_requests) >= self.per_hour_limit:
            return False

        return True

    def _record_request(self, client_id: str, now: float):
        """Record a request for rate limiting"""
        if client_id not in self.requests:
            self.requests[client_id] = []
        self.requests[client_id].append(now)

    def _add_rate_limit_headers(self, response: Response, client_id: str):
        """Add rate limit headers to response"""
        requests = self.requests.get(client_id, [])
        now = time.time()

        # Count requests in current minute and hour
        minute_count = len([req_time for req_time in requests if now - req_time < 60])
        hour_count = len([req_time for req_time in requests if now - req_time < 3600])

        response.headers["X-RateLimit-Limit"] = str(self.per_minute_limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.per_minute_limit - minute_count))
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Security headers middleware for TMS Service
    """

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through security headers middleware
        """
        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Add cache control headers for API endpoints
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Audit logging middleware for TMS Service
    """

    def __init__(self, app):
        super().__init__(app)
        self.enabled = getattr(settings, 'AUDIT_LOG_ENABLED', True)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through audit logging middleware
        """
        if not self.enabled:
            return await call_next(request)

        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log successful request
            logger.info(
                "API Request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "client_ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "status_code": response.status_code,
                    "duration_ms": int(duration * 1000),
                    "success": True
                }
            )

            return response

        except Exception as e:
            duration = time.time() - start_time

            # Log failed request
            logger.error(
                "API Error",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "client_ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "status_code": 500,
                    "duration_ms": int(duration * 1000),
                    "success": False,
                    "error": str(e)
                }
            )

            raise