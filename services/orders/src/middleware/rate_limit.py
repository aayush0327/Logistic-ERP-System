"""
Rate limiting middleware for Orders Service
"""
import time
import logging
from typing import Dict, List, Optional, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Advanced rate limiting middleware with multiple strategies
    """

    def __init__(
        self,
        app,
        default_limits: Optional[Dict[str, int]] = None,
        endpoint_limits: Optional[Dict[str, Dict[str, int]]] = None,
        user_limits: Optional[Dict[str, Dict[str, int]]] = None,
        exclude_paths: Optional[List[str]] = None,
        redis_client=None
    ):
        super().__init__(app)
        self.default_limits = default_limits or {
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000
        }
        self.endpoint_limits = endpoint_limits or {
            # Stricter limits for sensitive endpoints
            "/api/v1/orders/": {"requests_per_minute": 120},
            "/api/v1/orders/finance-approval": {"requests_per_minute": 20},
            "/api/v1/orders/logistics-approval": {"requests_per_minute": 20},
            "/api/v1/reports/": {"requests_per_minute": 30},
        }
        self.user_limits = user_limits or {
            # Different limits for different user roles
            "admin": {"requests_per_minute": 200},
            "finance_manager": {"requests_per_minute": 100},
            "logistics_manager": {"requests_per_minute": 100},
            "sales_manager": {"requests_per_minute": 150},
            "user": {"requests_per_minute": 60},
        }
        self.exclude_paths = exclude_paths or ["/health", "/ready", "/metrics", "/docs", "/openapi.json"]

        # Use Redis if available for distributed rate limiting
        self.redis_client = redis_client

        # In-memory store for development (not recommended for production)
        if not redis_client:
            self.request_tracker = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Apply rate limiting to incoming requests

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response or rate limit error
        """
        # Skip rate limiting for excluded paths
        if self._should_exclude_path(request.url.path):
            return await call_next(request)

        # Get client identifier (IP or User ID)
        client_id = self._get_client_identifier(request)

        # Get rate limits for this request
        limits = self._get_rate_limits(request)

        # Check rate limits
        violation = await self._check_rate_limits(client_id, limits, request)

        if violation:
            logger.warning(
                f"Rate limit exceeded for {client_id} on {request.url.path}: {violation}"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded: {violation['limit_type']}",
                    "retry_after": violation.get("retry_after", 60)
                },
                headers={"Retry-After": str(violation.get("retry_after", 60))}
            )

        # Record this request
        await self._record_request(client_id, limits, request)

        return await call_next(request)

    def _should_exclude_path(self, path: str) -> bool:
        """Check if path should be excluded from rate limiting"""
        if path in self.exclude_paths:
            return True

        for excluded_path in self.exclude_paths:
            if path.startswith(excluded_path):
                return True

        return False

    def _get_client_identifier(self, request: Request) -> str:
        """
        Get client identifier for rate limiting

        Prefers user ID if authenticated, otherwise falls back to IP
        """
        # Use user ID if authenticated
        if hasattr(request.state, 'user_id') and request.state.user_id:
            return f"user:{request.state.user_id}"

        # Fall back to IP address
        ip = self._get_client_ip(request)
        return f"ip:{ip}"

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _get_rate_limits(self, request: Request) -> Dict[str, int]:
        """
        Get rate limits for the specific request

        Checks endpoint-specific limits first, then user-specific limits,
        then falls back to default limits
        """
        path = request.url.path

        # Check endpoint-specific limits
        for endpoint_pattern, limits in self.endpoint_limits.items():
            if path.startswith(endpoint_pattern):
                return {**self.default_limits, **limits}

        # Check user-specific limits
        if hasattr(request.state, 'role_id') and request.state.role_id:
            role = request.state.role_id
            if role in self.user_limits:
                return {**self.default_limits, **self.user_limits[role]}

        # Use default limits
        return self.default_limits

    async def _check_rate_limits(
        self,
        client_id: str,
        limits: Dict[str, int],
        request: Request
    ) -> Optional[Dict]:
        """
        Check if client has exceeded any rate limits

        Returns violation details if exceeded, None otherwise
        """
        current_time = time.time()

        # Check each type of limit
        for limit_type, max_requests in limits.items():
            if limit_type == "requests_per_minute":
                window = 60
                key = f"{client_id}:minute"
            elif limit_type == "requests_per_hour":
                window = 3600
                key = f"{client_id}:hour"
            elif limit_type == "requests_per_day":
                window = 86400
                key = f"{client_id}:day"
            else:
                continue  # Skip unknown limit types

            # Get request count for this window
            request_count = await self._get_request_count(key, current_time, window)

            if request_count >= max_requests:
                return {
                    "limit_type": limit_type,
                    "current": request_count,
                    "max": max_requests,
                    "window": window,
                    "retry_after": window
                }

        return None

    async def _get_request_count(self, key: str, current_time: float, window: int) -> int:
        """Get request count for a specific time window"""
        if self.redis_client:
            return await self._get_redis_count(key, current_time, window)
        else:
            return self._get_memory_count(key, current_time, window)

    async def _get_redis_count(self, key: str, current_time: float, window: int) -> int:
        """Get request count from Redis"""
        try:
            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()

            # Remove expired entries
            cutoff_time = current_time - window
            pipe.zremrangebyscore(key, 0, cutoff_time)

            # Count remaining entries
            pipe.zcard(key)

            # Set expiry on the key
            pipe.expire(key, window)

            results = await pipe.execute()
            return results[1]  # zcard result
        except Exception as e:
            logger.error(f"Redis error in rate limiting: {str(e)}")
            return 0

    def _get_memory_count(self, key: str, current_time: float, window: int) -> int:
        """Get request count from in-memory store"""
        if key not in self.request_tracker:
            self.request_tracker[key] = []

        # Clean old entries
        cutoff_time = current_time - window
        requests = self.request_tracker[key]

        # Filter out old requests
        requests = [req_time for req_time in requests if req_time > cutoff_time]
        self.request_tracker[key] = requests

        return len(requests)

    async def _record_request(self, client_id: str, limits: Dict[str, int], request: Request):
        """Record the request for rate limiting"""
        current_time = time.time()

        # Record for each limit type
        for limit_type in limits:
            if limit_type == "requests_per_minute":
                window = 60
                key = f"{client_id}:minute"
            elif limit_type == "requests_per_hour":
                window = 3600
                key = f"{client_id}:hour"
            elif limit_type == "requests_per_day":
                window = 86400
                key = f"{client_id}:day"
            else:
                continue

            await self._store_request_time(key, current_time, window)

    async def _store_request_time(self, key: str, timestamp: float, window: int):
        """Store request timestamp for rate limiting"""
        if self.redis_client:
            await self._store_redis_time(key, timestamp, window)
        else:
            self._store_memory_time(key, timestamp, window)

    async def _store_redis_time(self, key: str, timestamp: float, window: int):
        """Store request timestamp in Redis"""
        try:
            # Use sorted set with timestamp as score
            await self.redis_client.zadd(key, {str(timestamp): timestamp})
            await self.redis_client.expire(key, window)
        except Exception as e:
            logger.error(f"Redis error storing request time: {str(e)}")

    def _store_memory_time(self, key: str, timestamp: float, window: int):
        """Store request timestamp in memory"""
        if key not in self.request_tracker:
            self.request_tracker[key] = []

        self.request_tracker[key].append(timestamp)

        # Clean old entries periodically
        if len(self.request_tracker[key]) > 1000:
            cutoff_time = timestamp - window
            self.request_tracker[key] = [
                ts for ts in self.request_tracker[key] if ts > cutoff_time
            ]

    def cleanup_memory_tracker(self):
        """Clean up old entries in memory tracker"""
        current_time = time.time()
        keys_to_remove = []

        for key, timestamps in self.request_tracker.items():
            # Remove if no recent requests (last hour)
            if not timestamps or current_time - timestamps[-1] > 3600:
                keys_to_remove.append(key)
            else:
                # Clean old timestamps
                cutoff_time = current_time - 86400  # Keep only last day
                self.request_tracker[key] = [
                    ts for ts in timestamps if ts > cutoff_time
                ]

        for key in keys_to_remove:
            del self.request_tracker[key]

        logger.info(f"Rate limit memory cleanup completed. Removed {len(keys_to_remove)} keys.")