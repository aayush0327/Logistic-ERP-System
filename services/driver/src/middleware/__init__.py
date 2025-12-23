"""Middleware for Driver Service."""

from .auth import AuthenticationMiddleware

__all__ = ["AuthenticationMiddleware"]