# SSE Connection Manager with Redis Pub/Sub for multi-instance support
import asyncio
import json
import logging
from typing import Dict, Set, Optional
from collections import defaultdict
from dataclasses import dataclass, field

import redis.asyncio as redis

from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


@dataclass
class SSEConnection:
    """Represents a single SSE client connection"""
    user_id: str
    tenant_id: str
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


class SSEConnectionManager:
    """
    Manages SSE connections and uses Redis pub/sub for multi-instance support.

    This allows multiple notification-service instances to run behind a load balancer,
    with Redis coordinating message delivery to connected clients across all instances.
    """

    def __init__(self):
        # Local connections (this instance only)
        self._connections: Dict[str, SSEConnection] = {}
        # User to connection IDs mapping
        self._user_connections: Dict[str, Set[str]] = defaultdict(set)
        # Redis connection for pub/sub
        self._redis: Optional[redis.Redis] = None
        self._pubsub = None
        self._listener_task: Optional[asyncio.Task] = None
        self._channel_name = "notifications:sse"

    async def initialize(self):
        """Initialize Redis connection and start listener"""
        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            self._pubsub = self._redis.pubsub()
            await self._pubsub.subscribe(self._channel_name)
            # Start listener task
            self._listener_task = asyncio.create_task(self._redis_listener())
            logger.info("SSE Connection Manager initialized with Redis")
        except Exception as e:
            logger.error(f"Failed to initialize SSE Connection Manager: {e}")
            # Continue without Redis - will use local-only mode
            self._redis = None

    async def shutdown(self):
        """Cleanup resources"""
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            await self._pubsub.unsubscribe(self._channel_name)
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()

    async def connect(self, user_id: str, tenant_id: str) -> asyncio.Queue:
        """
        Register a new SSE connection

        Returns a queue that will receive notification events
        """
        connection_id = f"{user_id}:{tenant_id}:{id(asyncio.current_task())}"

        connection = SSEConnection(
            user_id=user_id,
            tenant_id=tenant_id
        )

        self._connections[connection_id] = connection
        self._user_connections[user_id].add(connection_id)

        logger.info(f"SSE connection established: {connection_id}")

        return connection.queue

    async def disconnect(self, user_id: str):
        """Disconnect all connections for a user"""
        connection_ids = self._user_connections.get(user_id, set()).copy()

        for conn_id in connection_ids:
            if conn_id in self._connections:
                del self._connections[conn_id]

        self._user_connections[user_id].clear()
        logger.info(f"SSE connections closed for user: {user_id}")

    async def broadcast_to_user(
        self,
        user_id: str,
        tenant_id: str,
        event_type: str,
        data: dict
    ):
        """
        Broadcast an event to a specific user across all instances

        Uses Redis pub/sub to ensure all instances receive the message.
        Only the instance with the connected user will deliver it.
        """
        message = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "data": data
        }

        if self._redis:
            # Multi-instance mode: publish to Redis
            try:
                await self._redis.publish(
                    self._channel_name,
                    json.dumps(message)
                )
            except Exception as e:
                logger.error(f"Failed to publish to Redis: {e}")
                # Fall back to local delivery
                await self._deliver_local(message)
        else:
            # Local-only mode (no Redis)
            await self._deliver_local(message)

    async def _deliver_local(self, message: dict):
        """
        Deliver message to local connections only

        Called by Redis listener or as fallback when Redis is unavailable.
        """
        user_id = message["user_id"]

        if user_id not in self._user_connections:
            # No local connections for this user
            return

        connection_ids = self._user_connections[user_id]

        for conn_id in connection_ids:
            if conn_id in self._connections:
                connection = self._connections[conn_id]
                # Queue the event for the client
                # Serialize data to JSON string for SSE
                await connection.queue.put({
                    "event": message["event_type"],
                    "data": json.dumps(message["data"])
                })

    async def _redis_listener(self):
        """
        Listen for messages from Redis pub/sub and deliver to local connections

        This runs as a background task and handles messages published by other instances.
        """
        if not self._pubsub:
            return

        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._deliver_local(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in Redis message: {e}")
                    except Exception as e:
                        logger.error(f"Error processing Redis message: {e}")
        except asyncio.CancelledError:
            # Task was cancelled during shutdown
            pass
        except Exception as e:
            logger.error(f"Redis listener error: {e}")

    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self._connections)

    def get_user_connection_count(self, user_id: str) -> int:
        """Get the number of connections for a specific user"""
        return len(self._user_connections.get(user_id, set()))


# Global singleton instance
sse_connection_manager = SSEConnectionManager()
