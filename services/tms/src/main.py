"""FastAPI application entry point for TMS Service"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from contextlib import asynccontextmanager
import logging

from src.config import settings
from src.database import engine, Base
from src.api.endpoints import trips, orders, resources, driver, tenant_cleanup
from src.middleware import (
    AuthenticationMiddleware,
    TenantContextMiddleware,
    TenantIsolationMiddleware,
    SecurityHeadersMiddleware,
    AuditLoggingMiddleware,
    RateLimitMiddleware,
)

# Configure logging
logging.basicConfig(
    level=getattr(settings, 'log_level', 'INFO'),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configure audit logger
audit_logger = logging.getLogger("tms_audit")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting TMS Service...")
    # Create tables (in production, use Alembic migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    yield

    # Shutdown
    logger.info("Shutting down TMS Service...")


# Create FastAPI app
app = FastAPI(
    title="TMS Service",
    description="Transport Management System API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add OpenAPI security scheme for JWT Bearer tokens
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="TMS Service",
        version="0.1.0",
        description="Transport Management System API",
        routes=app.routes,
    )
    # Add security scheme for JWT Bearer tokens
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your Bearer token (JWT) without the 'Bearer ' prefix"
        }
    }

    # Apply security to all paths except public ones
    public_paths = [
        "/",
        "/health",
        "/ready",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/favicon.ico"
    ]

    for path in openapi_schema.get("paths", {}):
        # Skip public paths
        if path in public_paths:
            continue

        for method in openapi_schema["paths"][path]:
            if method in ["get", "post", "put", "delete", "patch"]:
                # Add security requirement to all operations
                openapi_schema["paths"][path][method]["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Add security middleware (order matters - middleware executes in reverse order of addition)
# 1. Security headers (outermost - executes last)
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS (executes after security headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=getattr(settings, 'allowed_origins', ["*"]),
    allow_credentials=True,
    allow_methods=getattr(settings, 'allowed_methods', ["*"]),
    allow_headers=getattr(settings, 'allowed_headers', ["*"]),
    expose_headers=getattr(settings, 'expose_headers', []),
)

# 3. Audit logging (captures all requests)
if getattr(settings, 'AUDIT_LOG_ENABLED', True):
    app.add_middleware(AuditLoggingMiddleware)

# 4. Rate limiting (if enabled)
if getattr(settings, 'RATE_LIMIT_ENABLED', True):
    app.add_middleware(RateLimitMiddleware)

# 5. Tenant context for database operations
app.add_middleware(TenantContextMiddleware)

# 6. Tenant isolation for multi-tenancy (executes after authentication)
app.add_middleware(TenantIsolationMiddleware)

# 7. Authentication middleware (innermost - executes first)
app.add_middleware(
    AuthenticationMiddleware,
    skip_paths=[
        "/health",
        "/ready",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/favicon.ico"
    ]
)

# Add security exception handlers
from src.security.exceptions import (
    SecurityException,
    security_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from fastapi.exceptions import RequestValidationError

app.add_exception_handler(SecurityException, security_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routers
app.include_router(trips.router, prefix="/api/v1/trips", tags=["trips"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(resources.router, prefix="/api/v1/resources", tags=["resources"])
app.include_router(driver.router, prefix="/api/v1/driver", tags=["driver"])

# Internal endpoints for inter-service communication
app.include_router(tenant_cleanup.router, prefix="/api/v1/internal", tags=["Internal"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TMS Service is running",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "tms"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    # Initialize metrics if not already done
    if not hasattr(app, '_metrics_initialized'):
        try:
            from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, Gauge
        except ImportError:
            # prometheus_client not available, return simple metrics
            return {"error": "Prometheus client not available"}
    try:
        # Initialize metrics if not already done
        if not hasattr(app, '_metrics_initialized'):
            from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, Gauge

            app.metrics_registry = CollectorRegistry()

            # Define basic metrics
            app.http_requests_total = Counter(
                'tms_http_requests_total',
                'Total HTTP requests',
                ['method', 'endpoint', 'status_code'],
                registry=app.metrics_registry
            )

            app.http_request_duration = Histogram(
                'tms_http_request_duration_seconds',
                'HTTP request duration in seconds',
                ['method', 'endpoint'],
                registry=app.metrics_registry
            )

            app.trips_created = Counter(
                'tms_trips_created_total',
                'Total trips created',
                registry=app.metrics_registry
            )

            app.active_trips = Gauge(
                'tms_active_trips',
                'Number of active trips',
                registry=app.metrics_registry
            )

            app._metrics_initialized = True

        # Re-import for the return statement
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return Response(generate_latest(app.metrics_registry), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        # Return empty metrics if prometheus_client is not installed
        return Response('# Metrics endpoint available but prometheus_client not installed\n', media_type='text/plain')


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Global HTTP exception handler"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=getattr(settings, 'service_host', '0.0.0.0'),
        port=getattr(settings, 'service_port', 8004),
        reload=True,
        log_level=getattr(settings, 'log_level', 'info').lower()
    )