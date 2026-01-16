# Health check endpoints for notification service
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.config import get_settings
from src.security import verify_token, TokenData, require_permissions

router = APIRouter()
settings = get_settings()


@router.post("/admin/cache/invalidate")
async def invalidate_cache(
    tenant_id: str = Query(None, description="Tenant ID to invalidate (optional, leaves empty for all)"),
    token_data: TokenData = Depends(require_permissions(["admin"]))
):
    """
    Invalidate the recipient resolver cache.

    Use this endpoint when user roles change (e.g., user assigned/removed from a role).
    The cache will automatically rebuild on the next notification request.

    Requires admin permission.
    """
    from src.services.recipient_resolver import RecipientResolver
    resolver = RecipientResolver()

    if tenant_id:
        await resolver.invalidate_cache(tenant_id=tenant_id)
        return {
            "message": f"Cache invalidated for tenant {tenant_id}",
            "tenant_id": tenant_id
        }
    else:
        await resolver.invalidate_cache()  # Invalidate all
        return {
            "message": "All caches invalidated",
            "tenant_id": "all"
        }


@router.get("/admin/cache/status")
async def cache_status(
    token_data: TokenData = Depends(require_permissions(["admin"]))
):
    """
    Get current cache status for monitoring.

    Returns information about cached tenants and cache freshness.
    Requires admin permission.
    """
    from src.services.recipient_resolver import RecipientResolver
    from datetime import datetime

    resolver = RecipientResolver()

    status = {
        "cached_tenants": [],
        "total_tenants": len(resolver._cache_timestamps),
        "cache_refresh_interval_seconds": resolver.CACHE_REFRESH_INTERVAL
    }

    for tenant_id, timestamp in resolver._cache_timestamps.items():
        age_seconds = (datetime.utcnow() - timestamp).total_seconds()
        tenant_info = {
            "tenant_id": tenant_id,
            "last_refresh": timestamp.isoformat(),
            "age_seconds": age_seconds,
            "roles_cached": list(resolver._role_cache.get(tenant_id, {}).keys())
        }
        status["cached_tenants"].append(tenant_info)

    return status


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Basic health check endpoint"""
    health_status = {
        "status": "healthy",
        "services": {}
    }

    # Check database connection
    try:
        await db.execute(text("SELECT 1"))
        health_status["services"]["database"] = "ok"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["services"]["database"] = f"error: {str(e)}"

    # Check Redis connection
    try:
        import redis.asyncio as redis
        redis_client = redis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
        health_status["services"]["redis"] = "ok"
    except Exception as e:
        health_status["services"]["redis"] = f"error: {str(e)}"

    # Check Kafka connection (basic check)
    try:
        from kafka import KafkaProducer
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            max_block_ms=5000
        )
        producer.close()
        health_status["services"]["kafka"] = "ok"
    except Exception as e:
        health_status["services"]["kafka"] = f"error: {str(e)}"

    return health_status


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check - is the service ready to accept requests?"""
    try:
        # Check if we can query the database
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return {"status": "not_ready"}, 503


@router.get("/health/live")
async def liveness_check():
    """Liveness check - is the service alive?"""
    return {"status": "alive"}
