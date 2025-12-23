"""
Rate limiting middleware for Finance Service
"""
import time
import logging
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for Finance Service
    """

    def __init__(self, app, requests: int = 100, window: int = 60):
        super().__init__(app)
        self.requests = requests
        self.window = window
        self.clients = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        """
        Process request through rate limiting middleware
        """
        # Get client identifier
        client_id = self._get_client_id(request)

        # Get current time
        now = time.time()

        # Clean up old requests
        self._cleanup_old_requests(client_id, now)

        # Check rate limit
        if len(self.clients[client_id]) >= self.requests:
            logger.warning(f"Rate limit exceeded for client: {client_id}")
            return JSONResponse(
                status_code=429,
                headers={
                    "X-RateLimit-Limit": str(self.requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + self.window))
                },
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Limit is {self.requests} requests per {self.window} seconds."
                }
            )

        # Record request
        self._record_request(client_id, now)

        response = await call_next(request)

        # Add rate limit headers
        self._add_rate_limit_headers(response, client_id)

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Try to get user_id from request state (set by auth middleware)
        if hasattr(request.state, 'user_id'):
            return f"user:{request.state.user_id}"

        # Try to get tenant_id
        if hasattr(request.state, 'tenant_id'):
            return f"tenant:{request.state.tenant_id}"

        # Fall back to IP address
        return f"ip:{request.client.host if request.client else 'unknown'}"

    def _cleanup_old_requests(self, client_id: str, now: float):
        """Clean up old requests outside the time window"""
        cutoff = now - self.window
        self.clients[client_id] = [
            req_time for req_time in self.clients[client_id]
            if req_time > cutoff
        ]

    def _record_request(self, client_id: str, now: float):
        """Record a new request"""
        self.clients[client_id].append(now)

    def _add_rate_limit_headers(self, response: Response, client_id: str):
        """Add rate limit headers to response"""
        now = time.time()
        remaining = max(0, self.requests - len(self.clients[client_id]))
        reset_time = int(now + self.window)

        response.headers["X-RateLimit-Limit"] = str(self.requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)