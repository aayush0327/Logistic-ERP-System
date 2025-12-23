"""
Rate limiting middleware for TMS Service
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import logging
from collections import defaultdict, deque

from src.config import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware to prevent API abuse
    """

    def __init__(self, app):
        """
        Initialize rate limiting middleware

        Args:
            app: ASGI application
        """
        super().__init__(app)
        self.enabled = getattr(settings, 'enable_rate_limiting', True)
        if self.enabled:
            self.requests_per_minute = getattr(settings, 'rate_limit_requests_per_minute', 60)
            self.requests_per_hour = getattr(settings, 'rate_limit_requests_per_hour', 1000)
            self.client_limits = defaultdict(lambda: {
                "minute": deque(),
                "hour": deque()
            })
            self.cleanup_interval = 300  # Clean up old records every 5 minutes
            self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Apply rate limiting to incoming requests

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Skip rate limiting for health endpoints
        if not self.enabled or request.url.path in ["/health", "/ready", "/metrics"]:
            return await call_next(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Clean up old records periodically
        self._cleanup_old_records()

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

        # Get rate limit info for headers
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
        Get unique client identifier for rate limiting

        Args:
            request: FastAPI request object

        Returns:
            Client identifier string
        """
        # Try to get authenticated user ID
        if hasattr(request.state, 'user_id') and request.state.user_id:
            return f"user:{request.state.user_id}"

        # Fall back to IP address
        client_ip = self._get_client_ip(request)
        return f"ip:{client_ip}"

    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address, considering proxies

        Args:
            request: FastAPI request object

        Returns:
            Client IP address
        """
        # Check for forwarded IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        # Check for real IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Direct connection
        return request.client.host if request.client else "unknown"

    def _check_rate_limit(self, client_id: str) -> bool:
        """
        Check if client has exceeded rate limits

        Args:
            client_id: Client identifier

        Returns:
            True if within limits, False if exceeded
        """
        current_time = time.time()

        # Get client's request history
        client_history = self.client_limits[client_id]

        # Clean old minute requests
        one_minute_ago = current_time - 60
        while client_history["minute"] and client_history["minute"][0] < one_minute_ago:
            client_history["minute"].popleft()

        # Clean old hour requests
        one_hour_ago = current_time - 3600
        while client_history["hour"] and client_history["hour"][0] < one_hour_ago:
            client_history["hour"].popleft()

        # Check minute limit
        if len(client_history["minute"]) >= self.requests_per_minute:
            return False

        # Check hour limit
        if len(client_history["hour"]) >= self.requests_per_hour:
            return False

        # Record this request
        client_history["minute"].append(current_time)
        client_history["hour"].append(current_time)

        return True

    def _get_rate_limit_info(self, client_id: str) -> dict:
        """
        Get current rate limit information for client

        Args:
            client_id: Client identifier

        Returns:
            Dictionary with rate limit info
        """
        if not self.enabled:
            return {
                "limit": float('inf'),
                "remaining": float('inf'),
                "reset": 0
            }

        current_time = time.time()
        client_history = self.client_limits[client_id]

        # Count requests in current minute
        one_minute_ago = current_time - 60
        minute_count = sum(
            1 for req_time in client_history["minute"]
            if req_time >= one_minute_ago
        )

        # Calculate remaining requests
        remaining = max(0, self.requests_per_minute - minute_count)
        reset_time = int(current_time + 60)

        return {
            "limit": self.requests_per_minute,
            "remaining": remaining,
            "reset": reset_time
        }

    def _cleanup_old_records(self):
        """
        Clean up old rate limit records to prevent memory leaks
        """
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return

        # Update cleanup time
        self.last_cleanup = current_time

        # Clean old records for all clients
        clients_to_remove = []
        one_hour_ago = current_time - 3600

        for client_id, history in self.client_limits.items():
            # Clean minute requests
            while history["minute"] and history["minute"][0] < one_hour_ago:
                history["minute"].popleft()

            # Clean hour requests
            while history["hour"] and history["hour"][0] < one_hour_ago:
                history["hour"].popleft()

            # Mark empty clients for removal
            if not history["minute"] and not history["hour"]:
                clients_to_remove.append(client_id)

        # Remove inactive clients
        for client_id in clients_to_remove:
            del self.client_limits[client_id]

        if clients_to_remove:
            logger.debug(f"Cleaned up rate limit records for {len(clients_to_remove)} inactive clients")