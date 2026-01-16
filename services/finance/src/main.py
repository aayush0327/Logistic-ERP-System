"""
Finance Service Main Application
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import FinanceSettings
from src.database import engine, Base
from src.middleware.auth import AuthenticationMiddleware
from src.middleware.tenant import TenantIsolationMiddleware
from src.middleware.audit import AuditLoggingMiddleware
from src.middleware.rate_limit import RateLimitMiddleware
from src.middleware.security import SecurityHeadersMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Settings
settings = FinanceSettings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("Starting Finance Service...")

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    yield

    logger.info("Shutting down Finance Service...")


# Create FastAPI app
app = FastAPI(
    title="Finance Service",
    description="Finance Management Service for Logistics ERP",
    version="1.0.0",
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
        title="Finance Service",
        version="1.0.0",
        description="Finance Management Service API",
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

# 4. Rate limiting (if enabled) - Increased limits for 30-40 concurrent users
if getattr(settings, 'RATE_LIMIT_ENABLED', True):
    app.add_middleware(
        RateLimitMiddleware,
        requests=3000,  # ~75 req/min per user for 40 users
        window=60
    )

# 5. Tenant context for database operations
app.add_middleware(TenantIsolationMiddleware)

# 6. Authentication middleware (innermost - executes first)
app.add_middleware(
    AuthenticationMiddleware,
    jwt_secret=settings.GLOBAL_JWT_SECRET,
    jwt_algorithm=settings.GLOBAL_JWT_ALGORITHM,
    skip_paths=[
        "/health",
        "/ready",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/favicon.ico",
        "/api/v1/internal"  # Skip internal endpoints for inter-service communication
    ]
)

# Include API routers
from src.api.endpoints import orders, approvals, reports, tenant_cleanup

app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["approvals"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])

# Internal endpoints for inter-service communication
app.include_router(tenant_cleanup.router, prefix="/api/v1/internal", tags=["Internal"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Finance Service is running",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "finance"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    try:
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, Gauge
    except ImportError:
        return {"error": "Prometheus client not available"}

    try:
        # Initialize metrics if not already done
        if not hasattr(app, '_metrics_initialized'):
            app.metrics_registry = CollectorRegistry()

            # Define basic metrics
            app.http_requests_total = Counter(
                'finance_http_requests_total',
                'Total HTTP requests',
                ['method', 'endpoint', 'status_code'],
                registry=app.metrics_registry
            )

            app.http_request_duration = Histogram(
                'finance_http_request_duration_seconds',
                'HTTP request duration in seconds',
                ['method', 'endpoint'],
                registry=app.metrics_registry
            )

            app.approvals_processed = Counter(
                'finance_approvals_total',
                'Total approvals processed',
                ['action', 'status'],
                registry=app.metrics_registry
            )

            app.active_approvals = Gauge(
                'finance_active_approvals',
                'Number of pending approvals',
                registry=app.metrics_registry
            )

            app._metrics_initialized = True

        # Re-import for the return statement
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return JSONResponse(generate_latest(app.metrics_registry), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        # Return empty metrics if prometheus_client is not installed
        return Response('# Metrics endpoint available but prometheus_client not installed\n', media_type='text/plain')


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Global HTTP exception handler"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
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
        port=getattr(settings, 'service_port', 8005),
        reload=True,
        log_level=getattr(settings, 'log_level', 'info').lower()
    )