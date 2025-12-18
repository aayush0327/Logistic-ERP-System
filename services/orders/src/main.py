"""
Orders Service Main Application
"""
import logging
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response, JSONResponse
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from starlette.requests import Request

from src.api.endpoints import orders, order_documents
from src.config_local import OrdersSettings
from src.database import engine, Base

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = OrdersSettings()

# Initialize Prometheus metrics registry
registry = CollectorRegistry()

# Define metrics
http_requests_total = Counter(
    'orders_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=registry
)

http_request_duration_seconds = Histogram(
    'orders_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    registry=registry
)

orders_operations_total = Counter(
    'orders_operations_total',
    'Total order operations',
    ['operation', 'status'],
    registry=registry
)

active_orders = Gauge(
    'orders_active_orders',
    'Number of active orders',
    registry=registry
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info(f"Starting orders service - version=1.0.0")

    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Shutting down orders service")


# Create FastAPI application
app = FastAPI(
    title="Logistics ERP Orders Service",
    description="Orders management service for multi-tenant Logistics ERP",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.logistics-erp.com"] if settings.ENV == "production" else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add metrics tracking middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)

    # Calculate request duration
    duration = time.time() - start_time

    # Get endpoint path (simplified)
    endpoint = request.url.path
    if endpoint.startswith("/api/v1/"):
        endpoint = endpoint.split("/")[-1] or "root"

    # Record metrics
    http_requests_total.labels(
        method=request.method,
        endpoint=endpoint,
        status_code=str(response.status_code)
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=endpoint
    ).observe(duration)

    return response


# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "orders-service"}


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check endpoint"""
    try:
        # Check database connection
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")

        return {
            "status": "ready",
            "service": "orders-service",
            "checks": {
                "database": "ok"
            }
        }
    except Exception as e:
        logger.error(f"Readiness check failed - error={str(e)}")
        return Response(
            content={"status": "not ready", "error": str(e)},
            status_code=503
        )


# Include API routers
app.include_router(
    orders.router,
    prefix="/api/v1/orders",
    tags=["Orders"]
)

app.include_router(
    order_documents.router,
    prefix="/api/v1/orders",
    tags=["Order Documents"]
)


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(
        f"Unhandled exception - path={request.url.path}, method={request.method}",
        exc_info=exc
    )

    return JSONResponse(
        content={"detail": "Internal server error"},
        status_code=500
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True if settings.ENV == "development" else False,
        log_level=settings.LOG_LEVEL.lower(),
    )