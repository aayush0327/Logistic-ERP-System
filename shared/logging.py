"""
Structured logging configuration
"""
import logging
import sys
from typing import Any, Dict

import structlog
from structlog.stdlib import LoggerFactory


def configure_logging() -> None:
    """Configure structured logging with structlog"""

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if _is_production() else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # Make loggers less noisy
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("kafka").setLevel(logging.WARNING)
    logging.getLogger("kombu").setLevel(logging.WARNING)
    logging.getLogger("elasticsearch").setLevel(logging.WARNING)


def _is_production() -> bool:
    """Check if running in production"""
    import os
    return os.getenv("ENV", "development").lower() == "production"


class LoggingMixin:
    """Mixin to add structured logging capabilities"""

    @property
    def logger(self):
        """Get structured logger instance"""
        return structlog.get_logger(self.__class__.__module__, self.__class__.__name__)

    def log_event(self, event: str, level: str = "info", **kwargs: Any) -> None:
        """Log an event with structured data"""
        log_method = getattr(self.logger, level, self.logger.info)
        log_method(event, **kwargs)

    def log_error(self, error: Exception, **kwargs: Any) -> None:
        """Log an error with structured data"""
        self.logger.error(
            "Error occurred",
            error_type=type(error).__name__,
            error_message=str(error),
            **kwargs
        )

    def log_operation(self, operation: str, duration: float = None, **kwargs: Any) -> None:
        """Log an operation with optional duration"""
        data = {"operation": operation, **kwargs}
        if duration is not None:
            data["duration_seconds"] = duration

        self.logger.info("Operation completed", **data)


def get_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)