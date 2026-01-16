"""
Analytics Service Main Application
"""
import logging
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from starlette.responses import Response as StarletteResponse

from src.api.endpoints import orders, trips, drivers, trucks, dashboard
from src.config import settings
from src.database import company_engine, Base

# Configure logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics registry
registry = CollectorRegistry()

# Define metrics
http_requests_total = Counter(
    'analytics_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=registry
)

http_request_duration_seconds = Histogram(
    'analytics_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    registry=registry
)

analytics_queries_total = Counter(
    'analytics_queries_total',
    'Total analytics queries',
    ['query_type', 'status'],
    registry=registry
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info(f"Starting analytics service - version={settings.VERSION}")

    # Initialize database tables (if needed)
    # async with company_engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Shutting down analytics service")


# Create FastAPI application
app = FastAPI(
    title="Logistics ERP Analytics Service",
    description="Analytics and reporting service for multi-tenant Logistics ERP",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware
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

        raise

    duration = time.time() - start_time

    endpoint = request.url.path
    if endpoint.startswith("/"):
        endpoint = endpoint.split("/")[-1] or "root"

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
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION
    }


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check endpoint"""
    return {
        "status": "ready",
        "service": settings.SERVICE_NAME,
        "checks": {
            "database": "ok"
        }
    }


# Include API routers (dashboard first to avoid route conflicts)
app.include_router(
    dashboard.router,
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)

app.include_router(
    orders.router,
    prefix="/api/v1/orders",
    tags=["Order Analytics"]
)

app.include_router(
    trips.router,
    prefix="/api/v1/trips",
    tags=["Trip Analytics"]
)

app.include_router(
    drivers.router,
    prefix="/api/v1/drivers",
    tags=["Driver Analytics"]
)

app.include_router(
    trucks.router,
    prefix="/api/v1/trucks",
    tags=["Truck Analytics"]
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
