"""Simple metrics helper for services that don't need the full monitoring module"""

import time
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry

def create_service_metrics(service_name: str):
    """Create basic metrics for a service"""
    registry = CollectorRegistry()

    # HTTP metrics
    http_requests_total = Counter(
        f'{service_name}_http_requests_total',
        'Total HTTP requests',
        ['method', 'endpoint', 'status_code'],
        registry=registry
    )

    http_request_duration_seconds = Histogram(
        f'{service_name}_http_request_duration_seconds',
        'HTTP request duration in seconds',
        ['method', 'endpoint'],
        registry=registry
    )

    # Basic service metrics
    operations_total = Counter(
        f'{service_name}_operations_total',
        'Total operations',
        ['operation', 'status'],
        registry=registry
    )

    # Return all metrics and the registry
    return {
        'registry': registry,
        'http_requests_total': http_requests_total,
        'http_request_duration_seconds': http_request_duration_seconds,
        'operations_total': operations_total
    }

def create_metrics_middleware(metrics):
    """Create a middleware function to track HTTP requests"""
    async def metrics_middleware(request, call_next):
        start_time = time.time()
        response = await call_next(request)

        # Calculate request duration
        duration = time.time() - start_time

        # Get endpoint path (simplified)
        endpoint = request.url.path
        if "/api/v1/" in endpoint:
            parts = endpoint.split("/api/v1/")
            endpoint = parts[-1] if len(parts) > 1 else "root"
            # Extract resource type
            endpoint = endpoint.split("/")[0] or "root"

        # Record metrics
        metrics['http_requests_total'].labels(
            method=request.method,
            endpoint=endpoint,
            status_code=str(response.status_code)
        ).inc()

        metrics['http_request_duration_seconds'].labels(
            method=request.method,
            endpoint=endpoint
        ).observe(duration)

        return response

    return metrics_middleware

def get_metrics_response(metrics):
    """Get the metrics response for Prometheus"""
    from fastapi.responses import Response
    return Response(generate_latest(metrics['registry']), media_type=CONTENT_TYPE_LATEST)