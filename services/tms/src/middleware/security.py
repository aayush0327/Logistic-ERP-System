"""
Security headers middleware for TMS Service
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from src.config import settings


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
        if not getattr(settings, 'enable_security_headers', True):
            return await call_next(request)

        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Add API-specific headers
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response