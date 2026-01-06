"""
Orders Service Main Application
"""
import logging
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response, JSONResponse
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from starlette.requests import Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from jose import JWTError

from src.api.endpoints import orders, order_documents, resources, tenant_cleanup
from src.config_local import OrdersSettings
from src.database import engine, Base
from src.middleware import (
    SecurityHeadersMiddleware,
    TenantIsolationMiddleware,
    AuditLoggingMiddleware,
    RateLimitMiddleware,
)
from src.middleware.tenant import TenantHeaderMiddleware
from src.middleware.auth import AuthenticationMiddleware

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

# Add security middleware (order matters - add in reverse order of execution)
# Security headers should be added first (outermost)
app.add_middleware(
    SecurityHeadersMiddleware,
    secure_cookies=settings.ENV == "production"
)

# Audit logging for all requests
app.add_middleware(
    AuditLoggingMiddleware,
    log_requests=True,
    log_responses=True,
    log_headers=False,
    log_body=False,
    exclude_health_checks=True
)

# Rate limiting
app.add_middleware(
    RateLimitMiddleware,
    default_limits={
        "requests_per_minute": 60,
        "requests_per_hour": 1000,
        "requests_per_day": 10000
    },
    endpoint_limits={
        "/api/v1/orders/": {"requests_per_minute": 120},
        "/api/v1/orders/finance-approval": {"requests_per_minute": 20},
        "/api/v1/orders/logistics-approval": {"requests_per_minute": 20},
        "/api/v1/reports/": {"requests_per_minute": 30},
    }
)

# Authentication middleware (optional - doesn't block requests)
app.add_middleware(AuthenticationMiddleware)

# Tenant isolation for multi-tenancy (after authentication so tenant context is available)
app.add_middleware(TenantIsolationMiddleware)

# Tenant Headers (adds tenant info to response)
app.add_middleware(TenantHeaderMiddleware)

# Add standard middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1",
                   "*.logistics-erp.com"] if settings.ENV == "production" else ["*"]
)

# CORS (standard middleware)
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

app.include_router(
    resources.router,
    prefix="/api/v1/resources",
    tags=["Resources"]
)

# Internal endpoints for inter-service communication
app.include_router(
    tenant_cleanup.router,
    prefix="/api/v1/internal",
    tags=["Internal"]
)


# Security exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with security context"""
    # Log security-related exceptions
    if exc.status_code in [401, 403]:
        logger.warning(
            f"Security exception - path={request.url.path}, status={exc.status_code}, "
            f"user={getattr(request.state, 'user_id', 'unknown')}, "
            f"tenant={getattr(request.state, 'tenant_id', 'unknown')}"
        )
    else:
        logger.error(
            f"HTTP exception - path={request.url.path}, status={exc.status_code}, "
            f"detail={exc.detail}"
        )

    return JSONResponse(
        content={"detail": exc.detail},
        status_code=exc.status_code,
        headers=getattr(exc, 'headers', {})
    )


@app.exception_handler(JWTError)
async def jwt_exception_handler(request: Request, exc: JWTError):
    """Handle JWT errors"""
    logger.warning(
        f"JWT error - path={request.url.path}, error={str(exc)}"
    )

    return JSONResponse(
        content={"detail": "Invalid authentication token"},
        status_code=401,
        headers={"WWW-Authenticate": "Bearer"}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler with security context"""
    logger.error(
        f"Unhandled exception - path={request.url.path}, method={request.method}, "
        f"user={getattr(request.state, 'user_id', 'unknown')}, "
        f"tenant={getattr(request.state, 'tenant_id', 'unknown')}",
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
        port=8003,
        reload=True if settings.ENV == "development" else False,
        log_level=settings.LOG_LEVEL.lower(),
    )
