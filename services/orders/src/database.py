"""
Database configuration for Orders Service (based on auth service)
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, Numeric, UUID, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.config_local import OrdersSettings

settings = OrdersSettings()

# Create async engine
engine = create_async_engine(
    settings.get_database_url(),
    echo=settings.LOG_LEVEL.lower() == "debug",
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=20,
    max_overflow=30,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()

# Dependency to get DB session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
