"""
Security middleware for Orders Service
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging
import time
from typing import Callable

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to HTTP responses
    """

    def __init__(self, app, secure_cookies: bool = True):
        super().__init__(app)
        self.secure_cookies = secure_cookies

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Add security headers to response

        Args:
            request: Incoming HTTP request
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
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",  # Allow Swagger UI CDN
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",  # Allow Swagger UI CSS
            "img-src 'self' data: https:",
            "font-src 'self' https://cdn.jsdelivr.net",
            "connect-src 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "frame-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # Strict Transport Security (HTTPS only)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Secure cookie flags
        if self.secure_cookies and "set-cookie" in response.headers:
            cookies = response.headers.get_list("set-cookie")
            new_cookies = []
            for cookie in cookies:
                if request.url.scheme == "https":
                    if "secure" not in cookie.lower():
                        cookie += "; Secure"
                if "httponly" not in cookie.lower():
                    cookie += "; HttpOnly"
                if "samesite" not in cookie.lower():
                    cookie += "; SameSite=Strict"
                new_cookies.append(cookie)
            response.headers["set-cookie"] = new_cookies

        # Remove server information
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware for API endpoints
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.exclude_paths = exclude_paths or ["/health", "/ready", "/metrics", "/docs", "/openapi.json"]
        self.request_tracker = {}  # In production, use Redis or similar

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
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Get client IP
        client_ip = self._get_client_ip(request)

        # Get current time
        now = time.time()

        # Initialize tracker for this IP if not exists
        if client_ip not in self.request_tracker:
            self.request_tracker[client_ip] = {
                "minute_requests": [],
                "hour_requests": []
            }

        tracker = self.request_tracker[client_ip]

        # Clean old requests (older than 1 hour)
        tracker["hour_requests"] = [req_time for req_time in tracker["hour_requests"]
                                   if now - req_time < 3600]
        tracker["minute_requests"] = [req_time for req_time in tracker["minute_requests"]
                                     if now - req_time < 60]

        # Check hourly limit
        if len(tracker["hour_requests"]) >= self.requests_per_hour:
            logger.warning(f"Rate limit exceeded for IP {client_ip} (hourly)")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Try again later.",
                    "retry_after": 3600
                },
                headers={"Retry-After": "3600"}
            )

        # Check minute limit
        if len(tracker["minute_requests"]) >= self.requests_per_minute:
            logger.warning(f"Rate limit exceeded for IP {client_ip} (minute)")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Try again in a minute.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )

        # Record this request
        tracker["minute_requests"].append(now)
        tracker["hour_requests"].append(now)

        # Clean up old entries periodically
        if len(self.request_tracker) > 10000:  # Arbitrary limit
            self._cleanup_tracker()

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _cleanup_tracker(self):
        """Clean up old entries in the request tracker"""
        now = time.time()
        keys_to_remove = []

        for ip, tracker in self.request_tracker.items():
            # Remove if no requests in the last hour
            if (not tracker["hour_requests"] or
                now - tracker["hour_requests"][-1] > 3600):
                keys_to_remove.append(ip)

        for ip in keys_to_remove:
            del self.request_tracker[ip]


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """
    Middleware to restrict access to whitelisted IP addresses
    """

    def __init__(
        self,
        app,
        allowed_ips: list = None,
        allowed_networks: list = None,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.allowed_ips = allowed_ips or []
        self.allowed_networks = allowed_networks or []
        self.exclude_paths = exclude_paths or ["/health", "/ready", "/metrics"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Check if client IP is allowed to access the resource

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response or 403 Forbidden
        """
        # Skip IP check for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # Check if IP is in whitelist
        if not self._is_ip_allowed(client_ip):
            logger.warning(f"Access denied for IP {client_ip}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _is_ip_allowed(self, ip: str) -> bool:
        """Check if IP address is allowed"""
        # Check exact match
        if ip in self.allowed_ips:
            return True

        # Check network ranges (simplified - in production, use ipaddress module)
        for network in self.allowed_networks:
            if ip.startswith(network):
                return True

        return False