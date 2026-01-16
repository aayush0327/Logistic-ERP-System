# Notification Service - Main FastAPI Application
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import asyncio
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sse_starlette.sse import EventSourceResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.config import get_settings
from src.database import engine, get_db, init_db
from src.security import verify_token
from src.api.endpoints import health, notifications, preferences, sse
from src.services.sse_manager import sse_connection_manager
from src.services.kafka_consumer import notification_kafka_consumer
from src.services.scheduler import run_scheduler_tasks

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

settings = get_settings()
logger = logging.getLogger(__name__)

# Global scheduler for scheduled notifications
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan events"""
    # Startup
    print("=" * 50)
    print("Starting notification service...")
    logger.info("Starting notification service...")

    # Initialize database
    print("Initializing database...")
    await init_db()
    print("Database initialized")

    # Initialize SSE connection manager with Redis
    print("Initializing SSE connection manager...")
    await sse_connection_manager.initialize()
    print("SSE connection manager initialized")

    # Start Kafka consumer (runs in background thread)
    print("Starting Kafka consumer...")
    await notification_kafka_consumer.start()
    print("Kafka consumer started")

    # Configure scheduler jobs
    scheduler.add_job(
        run_scheduler_tasks,
        'interval',
        minutes=1,
        args=[get_db],
        id='scheduled_notifications',
        replace_existing=True
    )

    # Start scheduler
    scheduler.start()

    print("Notification service started successfully")
    logger.info("Notification service started successfully")
    print("=" * 50)

    yield

    # Shutdown
    print("=" * 50)
    logger.info("Shutting down notification service...")
    print("Shutting down notification service...")

    # Stop Kafka consumer
    print("Stopping Kafka consumer...")
    notification_kafka_consumer.stop()

    # Shutdown SSE manager
    await sse_connection_manager.shutdown()

    # Shutdown scheduler
    scheduler.shutdown()

    # Close database connection
    await engine.dispose()

    print("Notification service shutdown complete")
    logger.info("Notification service shutdown complete")
    print("=" * 50)


# Create FastAPI application
app = FastAPI(
    title="Notification Service",
    description="Real-time notification service for Logistics ERP",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# Include routers
app.include_router(health.router, tags=["Health"])
# IMPORTANT: SSE router must be included BEFORE notifications router
# because /{notification_id} would match /stream as a parameter
app.include_router(sse.router, prefix="/api/notifications", tags=["SSE"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["Preferences"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Notification Service",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8007,
        reload=settings.ENV == "development",
        log_level="info"
    )
