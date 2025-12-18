"""FastAPI application entry point for TMS Service"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from contextlib import asynccontextmanager
import logging

from src.config import settings
from src.database import engine, Base
from src.api.endpoints import trips, orders, resources, driver

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


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
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(trips.router, prefix="/api/v1/trips", tags=["trips"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(resources.router, prefix="/api/v1/resources", tags=["resources"])
app.include_router(driver.router, prefix="/api/v1/driver", tags=["driver"])


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
    return {
        "error": exc.detail,
        "status_code": exc.status_code
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    )