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

from src.api.endpoints import branches, customers, vehicles, products, product_categories
from src.config_local import CompanySettings
from src.database import engine, Base

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = CompanySettings()

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

# Add middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.logistics-erp.com"] if settings.ENV == "production" else ["*"]
)

# Log CORS configuration for debugging
logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")

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