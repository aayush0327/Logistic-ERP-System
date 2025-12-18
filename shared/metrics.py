"""
Prometheus metrics configuration
"""
import time
from functools import wraps
from typing import Callable, Optional

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.requests import Request
from starlette.responses import Response

# Request metrics
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code", "tenant_id"]
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint", "tenant_id"]
)

ACTIVE_CONNECTIONS = Gauge(
    "active_connections",
    "Number of active connections"
)

# Business metrics
ORDERS_CREATED = Counter(
    "orders_created_total",
    "Total orders created",
    ["tenant_id"]
)

SHIPMENTS_CREATED = Counter(
    "shipments_created_total",
    "Total shipments created",
    ["tenant_id"]
)

INVENTORY_UPDATES = Counter(
    "inventory_updates_total",
    "Total inventory updates",
    ["tenant_id", "operation"]
)

# Database metrics
DB_CONNECTION_POOL_SIZE = Gauge(
    "db_connection_pool_size",
    "Database connection pool size",
    ["database"]
)

DB_CONNECTION_POOL_USED = Gauge(
    "db_connection_pool_used",
    "Database connections in use",
    ["database"]
)

# Kafka metrics
KAFKA_MESSAGES_PRODUCED = Counter(
    "kafka_messages_produced_total",
    "Total Kafka messages produced",
    ["topic"]
)

KAFKA_MESSAGES_CONSUMED = Counter(
    "kafka_messages_consumed_total",
    "Total Kafka messages consumed",
    ["topic", "group_id"]
)

KAFKA_CONSUMER_LAG = Gauge(
    "kafka_consumer_lag",
    "Kafka consumer lag",
    ["topic", "group_id"]
)

# Cache metrics
CACHE_HITS = Counter(
    "cache_hits_total",
    "Total cache hits",
    ["cache_type"]
)

CACHE_MISSES = Counter(
    "cache_misses_total",
    "Total cache misses",
    ["cache_type"]
)


def init_metrics() -> None:
    """Initialize metrics collection"""
    pass


def track_request_metrics(func: Callable) -> Callable:
    """Decorator to track request metrics"""

    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        start_time = time.time()

        try:
            response = await func(request, *args, **kwargs)

            # Record request metrics
            method = request.method
            endpoint = request.url.path
            status_code = str(response.status_code)
            tenant_id = getattr(request.state, "tenant_id", "unknown")

            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=status_code,
                tenant_id=tenant_id
            ).inc()

            REQUEST_DURATION.labels(
                method=method,
                endpoint=endpoint,
                tenant_id=tenant_id
            ).observe(time.time() - start_time)

            return response

        except Exception as e:
            # Record error metrics
            method = request.method
            endpoint = request.url.path
            status_code = "500"
            tenant_id = getattr(request.state, "tenant_id", "unknown")

            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=status_code,
                tenant_id=tenant_id
            ).inc()

            REQUEST_DURATION.labels(
                method=method,
                endpoint=endpoint,
                tenant_id=tenant_id
            ).observe(time.time() - start_time)

            raise

    return wrapper


def track_function_execution(
    histogram: Histogram,
    labels: Optional[dict] = None
) -> Callable:
    """Decorator to track function execution time"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)

                # Record execution time
                if labels:
                    histogram.labels(**labels).observe(time.time() - start_time)
                else:
                    histogram.observe(time.time() - start_time)

                return result

            except Exception:
                # Still record execution time for failed requests
                if labels:
                    histogram.labels(**labels).observe(time.time() - start_time)
                else:
                    histogram.observe(time.time() - start_time)
                raise

        return wrapper

    return decorator


def increment_counter(counter: Counter, labels: Optional[dict] = None) -> None:
    """Increment a counter with optional labels"""
    if labels:
        counter.labels(**labels).inc()
    else:
        counter.inc()


def set_gauge(gauge: Gauge, value: float, labels: Optional[dict] = None) -> None:
    """Set a gauge value with optional labels"""
    if labels:
        gauge.labels(**labels).set(value)
    else:
        gauge.set(value)


def get_metrics() -> Response:
    """Get Prometheus metrics"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)