"""Trip business logic services"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from datetime import datetime

from src.database import Trip, TripOrder
from src.schemas import TripCreate, TripUpdate


class TripService:
    """Service for trip operations"""

    @staticmethod
    async def generate_trip_id(db: AsyncSession, company_id: str) -> str:
        """
        Generate trip ID: TRIP-DDMMYYYY-{sequence}
        Sequence resets to 1 for each new day
        """
        # Get current date in DDMMYYYY format
        today_date = datetime.now().strftime("%d%m%Y")

        # Find last trip ID for today's date for this company
        prefix = f"TRIP-{today_date}"
        last_trip_query = select(Trip.id).where(
            and_(
                Trip.company_id == company_id,
                Trip.id.like(f"{prefix}-%")
            )
        ).order_by(desc(Trip.id)).limit(1)

        result = await db.execute(last_trip_query)
        last_trip_id = result.scalar()

        # Extract sequence number and increment
        if last_trip_id:
            last_seq = int(last_trip_id.split("-")[-1])
            new_seq = last_seq + 1
        else:
            new_seq = 1

        return f"{prefix}-{new_seq}"

    @staticmethod
    async def create_trip(
        db: AsyncSession,
        trip_data: TripCreate,
        user_id: str,
        company_id: str
    ) -> Trip:
        """Create a new trip with sequential trip ID"""
        # Generate sequential trip ID
        trip_id = await TripService.generate_trip_id(db, company_id)

        # Create trip instance with user_id and company_id
        trip = Trip(
            id=trip_id,
            user_id=user_id,
            company_id=company_id,
            **trip_data.dict()
        )

        db.add(trip)
        await db.commit()
        await db.refresh(trip)

        return trip

    @staticmethod
    async def get_trip_statistics(db: AsyncSession) -> dict:
        """Get trip statistics"""
        # Count trips by status
        status_counts = await db.execute(
            select(
                Trip.status,
                func.count(Trip.id).label('count')
            ).group_by(Trip.status)
        )

        stats = {
            "total_trips": 0,
            "by_status": {},
            "capacity_utilization": 0
        }

        for status, count in status_counts:
            stats["by_status"][status] = count
            stats["total_trips"] += count

        # Calculate average capacity utilization
        capacity_avg = await db.execute(
            select(func.avg(
                func.cast(Trip.capacity_used, float) /
                func.nullif(Trip.capacity_total, 0) * 100
            ))
        )
        avg_capacity = capacity_avg.scalar()
        if avg_capacity:
            stats["capacity_utilization"] = round(avg_capacity, 2)

        return stats

    @staticmethod
    async def optimize_trips(db: AsyncSession) -> List[Trip]:
        """Optimize trip assignments based on priority and capacity"""
        # Get all planning trips
        planning_trips = await db.execute(
            select(Trip).where(Trip.status == "planning")
        )
        trips = planning_trips.scalars().all()

        # TODO: Implement optimization algorithm
        # For now, return trips sorted by capacity utilization
        return sorted(trips, key=lambda t: t.capacity_used / t.capacity_total if t.capacity_total > 0 else 0)