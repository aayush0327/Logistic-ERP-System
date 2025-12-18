"""Shared metrics collection module for all services"""

import time
import logging
from typing import Dict, Any, Optional
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Summary,
    CollectorRegistry,
    generate_latest,
    CONTENT_TYPE_LATEST
)
from fastapi import Request, Response
from fastapi.responses import PlainTextResponse
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)

# Global registry for metrics
_registry: Optional[CollectorRegistry] = None

class MetricsRegistry:
    """Centralized metrics registry for all services"""

    def __init__(self, service_name: str):
        self.service_name = service_name
        self.registry = CollectorRegistry()

        # HTTP metrics
        self.http_requests_total = Counter(
            f"{service_name}_http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status_code"],
            registry=self.registry
        )

        self.http_request_duration = Histogram(
            f"{service_name}_http_request_duration_seconds",
            "HTTP request duration in seconds",
            ["method", "endpoint", "status_code"],
            registry=self.registry
        )

        # Database metrics
        self.db_connections_active = Gauge(
            f"{service_name}_db_connections_active",
            "Active database connections",
            registry=self.registry
        )

        self.db_query_duration = Histogram(
            f"{service_name}_db_query_duration_seconds",
            "Database query duration in seconds",
            ["operation", "table"],
            registry=self.registry
        )

        self.db_queries_total = Counter(
            f"{service_name}_db_queries_total",
            "Total database queries",
            ["operation", "table", "status"],
            registry=self.registry
        )

        # Business metrics
        self.business_operations_total = Counter(
            f"{service_name}_business_operations_total",
            "Total business operations",
            ["operation", "status"],
            registry=self.registry
        )

        self.business_operation_duration = Histogram(
            f"{service_name}_business_operation_duration_seconds",
            "Business operation duration in seconds",
            ["operation"],
            registry=self.registry
        )

        # Application metrics
        self.active_users = Gauge(
            f"{service_name}_active_users",
            "Number of active users",
            registry=self.registry
        )

        self.active_tenants = Gauge(
            f"{service_name}_active_tenants",
            "Number of active tenants",
            registry=self.registry
        )

        # Cache metrics
        self.cache_hits = Counter(
            f"{service_name}_cache_hits_total",
            "Total cache hits",
            ["cache_type"],
            registry=self.registry
        )

        self.cache_misses = Counter(
            f"{service_name}_cache_misses_total",
            "Total cache misses",
            ["cache_type"],
            registry=self.registry
        )

        # Message queue metrics
        self.kafka_messages_produced = Counter(
            f"{service_name}_kafka_messages_produced_total",
            "Total Kafka messages produced",
            ["topic"],
            registry=self.registry
        )

        self.kafka_messages_consumed = Counter(
            f"{service_name}_kafka_messages_consumed_total",
            "Total Kafka messages consumed",
            ["topic", "consumer_group"],
            registry=self.registry
        )

        # Error metrics
        self.errors_total = Counter(
            f"{service_name}_errors_total",
            "Total errors",
            ["error_type", "component"],
            registry=self.registry
        )

    def generate_latest(self) -> str:
        """Generate latest metrics in Prometheus format"""
        return generate_latest(self.registry).decode('utf-8')

class MetricsMiddleware:
    """FastAPI middleware for automatic HTTP metrics collection"""

    def __init__(self, app, metrics_registry: MetricsRegistry):
        self.app = app
        self.metrics = metrics_registry

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        start_time = time.time()

        # Prepare response capture
        response_sent = {}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                response_sent["status"] = message.get("status", 200)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)

            # Record metrics
            method = request.method
            path = self._get_path_template(request)
            status_code = str(response_sent.get("status", 200))
            duration = time.time() - start_time

            self.metrics.http_requests_total.labels(
                method=method,
                endpoint=path,
                status_code=status_code
            ).inc()

            self.metrics.http_request_duration.labels(
                method=method,
                endpoint=path,
                status_code=status_code
            ).observe(duration)

        except Exception as e:
            # Record error
            status_code = "500"
            duration = time.time() - start_time

            self.metrics.http_requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=status_code
            ).inc()

            self.metrics.http_request_duration.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=status_code
            ).observe(duration)

            self.metrics.errors_total.labels(
                error_type=type(e).__name__,
                component="http_middleware"
            ).inc()

            raise

    def _get_path_template(self, request: Request) -> str:
        """Extract path template from request (e.g., /users/{id})"""
        # This is a simplified version - in a real implementation,
        # you might want to use the router's route information
        path = request.url.path
        # Simple heuristic to identify path parameters
        for part in path.split("/"):
            if part.isdigit():
                path = path.replace(part, "{id}")
        return path

# Global metrics registry instance
_metrics_registry: Optional[MetricsRegistry] = None

def get_metrics_registry() -> Optional[MetricsRegistry]:
    """Get the global metrics registry instance"""
    return _metrics_registry

def init_metrics(service_name: str) -> MetricsRegistry:
    """Initialize metrics for a service"""
    global _metrics_registry
    _metrics_registry = MetricsRegistry(service_name)
    return _metrics_registry

def track_request_metrics(metrics_registry: MetricsRegistry):
    """Decorator to track request metrics for specific endpoints"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                metrics_registry.errors_total.labels(
                    error_type=type(e).__name__,
                    component=func.__name__
                ).inc()
                raise
        return wrapper
    return decorator

def track_database_metrics(metrics_registry: MetricsRegistry):
    """Decorator to track database operation metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            operation = func.__name__
            # Extract table name if possible (simplified)
            table = "unknown"
            try:
                result = await func(*args, **kwargs)
                metrics_registry.db_queries_total.labels(
                    operation=operation,
                    table=table,
                    status="success"
                ).inc()
                return result
            except Exception as e:
                metrics_registry.db_queries_total.labels(
                    operation=operation,
                    table=table,
                    status="error"
                ).inc()
                raise
            finally:
                duration = time.time() - start_time
                metrics_registry.db_query_duration.labels(
                    operation=operation,
                    table=table
                ).observe(duration)
        return wrapper
    return decorator

def track_business_metric(metrics_registry: MetricsRegistry, operation_name: str):
    """Decorator to track business operation metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                metrics_registry.business_operations_total.labels(
                    operation=operation_name,
                    status="success"
                ).inc()
                return result
            except Exception as e:
                metrics_registry.business_operations_total.labels(
                    operation=operation_name,
                    status="error"
                ).inc()
                raise
            finally:
                duration = time.time() - start_time
                metrics_registry.business_operation_duration.labels(
                    operation=operation_name
                ).observe(duration)
        return wrapper
    return decorator

# Helper functions for common metrics
def increment_cache_hit(metrics_registry: MetricsRegistry, cache_type: str = "redis"):
    """Increment cache hit counter"""
    metrics_registry.cache_hits.labels(cache_type=cache_type).inc()

def increment_cache_miss(metrics_registry: MetricsRegistry, cache_type: str = "redis"):
    """Increment cache miss counter"""
    metrics_registry.cache_misses.labels(cache_type=cache_type).inc()

def increment_kafka_message_produced(metrics_registry: MetricsRegistry, topic: str):
    """Increment Kafka messages produced counter"""
    metrics_registry.kafka_messages_produced.labels(topic=topic).inc()

def increment_kafka_message_consumed(metrics_registry: MetricsRegistry, topic: str, consumer_group: str):
    """Increment Kafka messages consumed counter"""
    metrics_registry.kafka_messages_consumed.labels(
        topic=topic,
        consumer_group=consumer_group
    ).inc()

def update_active_users(metrics_registry: MetricsRegistry, count: int):
    """Update active users gauge"""
    metrics_registry.active_users.set(count)

def update_active_tenants(metrics_registry: MetricsRegistry, count: int):
    """Update active tenants gauge"""
    metrics_registry.active_tenants.set(count)

def update_db_connections(metrics_registry: MetricsRegistry, count: int):
    """Update database connections gauge"""
    metrics_registry.db_connections_active.set(count)