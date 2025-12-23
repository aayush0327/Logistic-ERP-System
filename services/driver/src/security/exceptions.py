"""Authentication exceptions."""


class TokenError(Exception):
    """Base exception for token errors."""
    pass


class TokenExpiredError(TokenError):
    """Token has expired."""
    pass


class TokenInvalidError(TokenError):
    """Token is invalid."""
    pass


class RateLimitExceededError(TokenError):
    """Rate limit exceeded."""
    pass