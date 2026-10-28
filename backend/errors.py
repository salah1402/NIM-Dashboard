from typing import Optional, List, Any


class RouterError(Exception):
    """Base exception for router-related errors."""
    pass


class RateLimitedError(RouterError):
    """Maps to HTTP 429 - Rate limit exceeded."""
    pass


class DeadModelError(RouterError):
    """Maps to HTTP 404 - Dead or removed model slug."""
    pass


class ServerError(RouterError):
    """Maps to HTTP 5xx - Provider internal server error."""
    pass


class TimeoutError(RouterError):
    """Maps to timeout - Wall-clock timeout exceeded."""
    pass


class ConnectionError(RouterError):
    """Maps to connection failure - Network failure."""
    pass


class AllModelsFailed(RouterError):
    """Raised when every candidate model in all tiers fails."""

    def __init__(self, message: str = "All candidate models failed", attempts: Optional[List[Any]] = None):
        super().__init__(message)
        self.attempts = attempts or []
