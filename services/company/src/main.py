"""
Company Service Main Application
"""
import logging
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from starlette.responses import Response as StarletteResponse
from sqlalchemy.exc import IntegrityError

from src.api.endpoints import branches, customers, vehicles, products, product_categories, product_unit_types, business_types, vehicle_types, users, roles, profiles, audit, tenant_cleanup, marketing_person_assignments
from src.config_local import settings
from src.database import engine, Base
from src.security import (
    SecurityException,
    security_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from src.middleware import (
    AuthenticationMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    AuditLoggingMiddleware,
    TenantIsolationMiddleware,
    TenantContextMiddleware,
    CompanyTenantStatusMiddleware,
)

# Configure logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics registry
registry = CollectorRegistry()

# Define metrics
http_requests_total = Counter(
    'company_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=registry
)

http_request_duration_seconds = Histogram(
    'company_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    registry=registry
)

company_operations_total = Counter(
    'company_operations_total',
    'Total company operations',
    ['operation', 'status'],
    registry=registry
)

active_branches = Gauge(
    'company_active_branches',
    'Number of active branches',
    registry=registry
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info(f"Starting company service - version=1.0.0")

    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Shutting down company service")


# Create FastAPI application
app = FastAPI(
    title="Logistics ERP Company Service",
    description="Company management service for multi-tenant Logistics ERP",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add security middleware (order matters - add in reverse order of execution)
# Security headers should be added first (outermost)
app.add_middleware(SecurityHeadersMiddleware)

# Audit logging for all requests
if settings.AUDIT_LOG_ENABLED:
    app.add_middleware(AuditLoggingMiddleware)

# Rate limiting (if enabled)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Tenant isolation for multi-tenancy
app.add_middleware(TenantIsolationMiddleware)

# Tenant context for database operations
app.add_middleware(TenantContextMiddleware)

# Authentication middleware (must come before CORS for proper header handling)
app.add_middleware(AuthenticationMiddleware)

# Tenant status validation middleware
app.add_middleware(CompanyTenantStatusMiddleware)

# Add standard middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.TRUSTED_HOSTS if settings.SECURITY_ENABLE_TRUSTED_HOST else ["*"]
)

# Log CORS configuration for debugging
logger.info(f"CORS Origins: {settings.ALLOW_ORIGINS}")

if settings.SECURITY_ENABLE_CORS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOW_ORIGINS,
        allow_credentials=settings.ALLOW_CREDENTIALS,
        allow_methods=settings.ALLOW_METHODS,
        allow_headers=settings.ALLOW_HEADERS,
    )

# Add metrics tracking middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()

    try:
        response = await call_next(request)
    except HTTPException as e:
        # Don't convert HTTPExceptions to responses here
        # Let them be handled by the exception handlers
        # Still record the metrics for monitoring
        endpoint = request.url.path
        if endpoint.startswith("/"):
            endpoint = endpoint.split("/")[-1] or "root"

        http_requests_total.labels(
            method=request.method,
            endpoint=endpoint,
            status_code=str(e.status_code)
        ).inc()

        duration = time.time() - start_time
        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=endpoint
        ).observe(duration)

        # Re-raise the HTTPException to be handled by proper exception handlers
        raise

    # Calculate request duration
    duration = time.time() - start_time

    # Get endpoint path (simplified)
    endpoint = request.url.path
    if endpoint.startswith("/"):
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
    return StarletteResponse(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "company-service"}


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check endpoint"""
    try:
        # Check database connection
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")

        return {
            "status": "ready",
            "service": "company-service",
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
    branches.router,
    prefix="/branches",
    tags=["Branches"]
)

app.include_router(
    customers.router,
    prefix="/customers",
    tags=["Customers"]
)

app.include_router(
    vehicles.router,
    prefix="/vehicles",
    tags=["Vehicles"]
)

app.include_router(
    products.router,
    prefix="/products",
    tags=["Products"]
)

app.include_router(
    product_categories.router,
    prefix="/product-categories",
    tags=["Product Categories"]
)

# Use separate prefix to avoid conflict with products/{product_id} route
app.include_router(
    product_unit_types.router,
    prefix="/product-unit-types",
    tags=["Product Unit Types"]
)

app.include_router(
    business_types.router,
    prefix="/business-types",
    tags=["Business Types"]
)

app.include_router(
    vehicle_types.router,
    prefix="/vehicle-types",
    tags=["Vehicle Types"]
)

app.include_router(
    users.router,
    prefix="/users",
    tags=["User Management"]
)

app.include_router(
    roles.router,
    prefix="/roles",
    tags=["Role Management"]
)

app.include_router(
    profiles.router,
    prefix="/profiles",
    tags=["Profile Management"]
)

app.include_router(
    audit.router,
    prefix="/audit",
    tags=["Audit Logs"]
)

app.include_router(
    marketing_person_assignments.router,
    prefix="/api/v1/marketing-person-assignments",
    tags=["Marketing Person Assignments"]
)

# Internal endpoints for inter-service communication
app.include_router(
    tenant_cleanup.router,
    prefix="/api/v1/internal",
    tags=["Internal"]
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP exception handler"""
    logger.warning(
        f"HTTP exception - path={request.url.path}, method={request.method}, "
        f"status={exc.status_code}, detail={exc.detail}"
    )
    return JSONResponse(
        content={"detail": exc.detail},
        status_code=exc.status_code
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Handle database integrity errors (duplicate entries, foreign key violations, etc.)
    Convert them to user-friendly error messages
    """
    logger.warning(
        f"Integrity error - path={request.url.path}, method={request.method}, "
        f"error={str(exc)}"
    )

    # Parse the error message to extract useful information
    error_message = str(exc).lower()

    # Check for unique constraint violations
    if "unique constraint" in error_message or "duplicate key" in error_message:
        # Extract field name from error if possible
        if "branch" in error_message and "code" in error_message:
            detail = "Branch with this code already exists. Please use a different code."
        elif "customer" in error_message and ("code" in error_message or "email" in error_message):
            if "email" in error_message:
                detail = "Customer with this email already exists."
            else:
                detail = "Customer with this code already exists. Please use a different code."
        elif "vehicle" in error_message and ("plate" in error_message or "registration" in error_message):
            detail = "Vehicle with this registration number already exists. Please use a different registration number."
        elif "user" in error_message and "email" in error_message:
            detail = "User with this email already exists."
        else:
            detail = "This record already exists. Please use a different value."
    # Check for foreign key violations
    elif "foreign key constraint" in error_message:
        detail = "Cannot perform this operation because it references a record that does not exist."
    # Check for not null violations
    elif "not null" in error_message:
        detail = "A required field is missing. Please fill in all required fields."
    else:
        detail = "Database constraint violation. Please check your data and try again."

    return JSONResponse(
        content={"detail": detail},
        status_code=400
    )


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
        "src.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True if settings.ENV == "development" else False,
        log_level=settings.LOG_LEVEL.lower(),
    )