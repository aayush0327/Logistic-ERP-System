"""
Authentication middleware for Orders Service
"""
from typing import List, Optional
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time
from datetime import datetime

from src.security import (
    verify_token,
    extract_token_from_header,
    log_authentication_event,
    RateLimitExceededError,
    TokenExpiredError,
    TokenInvalidError,
)
from src.config_local import settings

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
        ]

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
            log_authentication_event(
                "AUTH_ERROR",
                request=request,
                success=False,
                reason=f"Internal error: {str(e)}"
            )
            # Re-raise the original exception to preserve the actual error
            # This ensures we return the correct error code (e.g., 401, 403)
            raise

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


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle rate limiting for API requests
    """

    def __init__(self, app):
        super().__init__(app)
        self.rate_limits = {}  # Simple in-memory rate limit store
        self.requests_per_minute = getattr(settings, 'RATE_LIMIT_REQUESTS_PER_MINUTE', 60)
        self.requests_per_hour = getattr(settings, 'RATE_LIMIT_REQUESTS_PER_HOUR', 1000)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through rate limiting middleware

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        if not getattr(settings, 'RATE_LIMIT_ENABLED', True):
            return await call_next(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Check rate limits
        if not self._check_rate_limit(client_id):
            logger.warning(f"Rate limit exceeded for client: {client_id}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + 60),
                }
            )

        # Get rate limit info for response headers
        rate_info = self._get_rate_limit_info(client_id)

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset"])

        return response

    def _get_client_id(self, request: Request) -> str:
        """
        Get client identifier for rate limiting

        Args:
            request: Incoming request

        Returns:
            Client identifier string
        """
        # Try to get user ID from authenticated request
        if hasattr(request.state, 'user_id') and request.state.user_id:
            return f"user:{request.state.user_id}"

        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    def _check_rate_limit(self, client_id: str) -> bool:
        """
        Check if client has exceeded rate limits

        Args:
            client_id: Client identifier

        Returns:
            True if within limits, False if exceeded
        """
        current_time = time.time()

        # Initialize client rate limit data if not exists
        if client_id not in self.rate_limits:
            self.rate_limits[client_id] = {
                "minute_requests": [],
                "hour_requests": [],
            }

        client_data = self.rate_limits[client_id]

        # Clean old requests
        one_minute_ago = current_time - 60
        one_hour_ago = current_time - 3600

        client_data["minute_requests"] = [
            req_time for req_time in client_data["minute_requests"]
            if req_time > one_minute_ago
        ]

        client_data["hour_requests"] = [
            req_time for req_time in client_data["hour_requests"]
            if req_time > one_hour_ago
        ]

        # Check limits
        if len(client_data["minute_requests"]) >= self.requests_per_minute:
            return False

        if len(client_data["hour_requests"]) >= self.requests_per_hour:
            return False

        # Add current request
        client_data["minute_requests"].append(current_time)
        client_data["hour_requests"].append(current_time)

        return True

    def _get_rate_limit_info(self, client_id: str) -> dict:
        """
        Get rate limit information for client

        Args:
            client_id: Client identifier

        Returns:
            Dictionary with rate limit info
        """
        if client_id not in self.rate_limits:
            return {
                "limit": self.requests_per_minute,
                "remaining": self.requests_per_minute,
                "reset": int(time.time()) + 60,
            }

        client_data = self.rate_limits[client_id]
        minute_count = len(client_data["minute_requests"])

        return {
            "limit": self.requests_per_minute,
            "remaining": max(0, self.requests_per_minute - minute_count),
            "reset": int(time.time()) + 60,
        }


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to responses
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Add security headers to response

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response with security headers
        """
        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Add Cache-Control headers for sensitive endpoints
        if request.url.path.startswith("/api/"):
            # Prevent caching of API responses
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log API requests for audit purposes
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Log request details for audit

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        if not getattr(settings, 'AUDIT_LOG_ENABLED', True):
            return await call_next(request)

        start_time = time.time()

        # Log request start
        audit_data = {
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("User-Agent"),
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Add user context if available
        if hasattr(request.state, 'user_id'):
            audit_data.update({
                "user_id": request.state.user_id,
                "tenant_id": getattr(request.state, 'tenant_id', None),
                "role_id": getattr(request.state, 'role_id', None),
            })

        logger.info(f"API Request: {request.method} {request.url.path}", extra={"audit_data": audit_data})

        # Process request
        try:
            response = await call_next(request)

            # Calculate response time
            duration = time.time() - start_time

            # Log successful response
            audit_data.update({
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "success": response.status_code < 400,
            })

            logger.info(
                f"API Response: {response.status_code} in {duration:.3f}s",
                extra={"audit_data": audit_data}
            )

            return response

        except Exception as e:
            # Calculate response time for failed request
            duration = time.time() - start_time

            # Log error
            audit_data.update({
                "error": str(e),
                "duration_ms": round(duration * 1000, 2),
                "success": False,
            })

            logger.error(
                f"API Error: {str(e)} in {duration:.3f}s",
                extra={"audit_data": audit_data}
            )

            raise