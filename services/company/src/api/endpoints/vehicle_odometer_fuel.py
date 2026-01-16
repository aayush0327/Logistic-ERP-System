"""
Vehicle Odometer and Fuel Log API endpoints
"""
from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload

from src.database import get_db, Vehicle, VehicleOdometerFuelLog
from src.schemas import (
    VehicleOdometerFuelLogCreate,
    VehicleOdometerFuelLogUpdate,
    VehicleOdometerFuelLog as VehicleOdometerFuelLogSchema,
    VehicleInDB
)
from src.security import (
    TokenData,
    require_permissions,
    require_any_permission,
    get_current_tenant_id,
    get_current_user_id
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["vehicle_odometer_fuel"])


@router.get("/{vehicle_id}/odometer-logs")
async def get_odometer_logs(
    vehicle_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    token_data: TokenData = Depends(require_any_permission(["vehicles:read_all", "vehicles:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get odometer and fuel logs for a vehicle with pagination and date filtering
    """
    # Verify vehicle exists and belongs to tenant
    from uuid import UUID
    try:
        vehicle_uuid = UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle ID")

    vehicle_query = select(Vehicle).where(
        and_(
            Vehicle.id == vehicle_uuid,
            Vehicle.tenant_id == tenant_id
        )
    )
    result = await db.execute(vehicle_query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Build query for odometer logs
    query = select(VehicleOdometerFuelLog).where(
        and_(
            VehicleOdometerFuelLog.vehicle_id == vehicle_uuid,
            VehicleOdometerFuelLog.tenant_id == tenant_id
        )
    )

    # Apply date filters
    if date_from:
        query = query.where(VehicleOdometerFuelLog.log_date >= date_from)
    if date_to:
        query = query.where(VehicleOdometerFuelLog.log_date <= date_to)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Apply pagination and ordering
    query = query.order_by(desc(VehicleOdometerFuelLog.log_date))
    query = query.offset((page - 1) * per_page).limit(per_page)

    # Execute query
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "items": [VehicleOdometerFuelLogSchema.model_validate(log) for log in logs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@router.post("/{vehicle_id}/odometer-logs")
async def create_odometer_log(
    vehicle_id: str,
    log_data: VehicleOdometerFuelLogCreate,
    token_data: TokenData = Depends(require_permissions(["vehicles:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new odometer/fuel log for a vehicle
    Also updates the vehicle's current_odometer, current_fuel_economy, and last_odometer_update
    """
    # Verify vehicle exists and belongs to tenant
    from uuid import UUID
    try:
        vehicle_uuid = UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle ID")

    vehicle_query = select(Vehicle).where(
        and_(
            Vehicle.id == vehicle_uuid,
            Vehicle.tenant_id == tenant_id
        )
    )
    result = await db.execute(vehicle_query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        # Create new odometer log
        new_log = VehicleOdometerFuelLog(
            tenant_id=tenant_id,
            vehicle_id=vehicle_uuid,
            odometer_reading=log_data.odometer_reading,
            fuel_economy=log_data.fuel_economy,
            fuel_consumed=log_data.fuel_consumed,
            distance_traveled=log_data.distance_traveled,
            log_date=log_data.log_date,
            log_type=log_data.log_type,
            notes=log_data.notes,
            recorded_by_user_id=user_id
        )
        db.add(new_log)

        # Update vehicle's current odometer values
        vehicle.current_odometer = log_data.odometer_reading
        if log_data.fuel_economy:
            vehicle.current_fuel_economy = log_data.fuel_economy
        vehicle.last_odometer_update = log_data.log_date

        await db.commit()
        await db.refresh(new_log)

        logger.info(f"Created odometer log {new_log.id} for vehicle {vehicle_id}")
        return VehicleOdometerFuelLogSchema.model_validate(new_log)

    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating odometer log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create odometer log: {str(e)}")


@router.get("/{vehicle_id}/odometer-current")
async def get_current_odometer(
    vehicle_id: str,
    token_data: TokenData = Depends(require_any_permission(["vehicles:read_all", "vehicles:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the current odometer reading for a vehicle
    """
    # Verify vehicle exists and belongs to tenant
    from uuid import UUID
    try:
        vehicle_uuid = UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle ID")

    vehicle_query = select(Vehicle).where(
        and_(
            Vehicle.id == vehicle_uuid,
            Vehicle.tenant_id == tenant_id
        )
    )
    result = await db.execute(vehicle_query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return {
        "vehicle_id": str(vehicle.id),
        "current_odometer": vehicle.current_odometer,
        "current_fuel_economy": vehicle.current_fuel_economy,
        "last_odometer_update": vehicle.last_odometer_update
    }


@router.put("/{vehicle_id}/odometer-current")
async def update_current_odometer(
    vehicle_id: str,
    odometer_reading: float = Query(..., ge=0),
    fuel_economy: Optional[float] = Query(None, ge=0),
    token_data: TokenData = Depends(require_permissions(["vehicles:update"])),
    tenant_id: str = Depends(get_current_tenant_id),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update the current odometer reading for a vehicle
    Creates a log entry with log_type='manual'
    """
    # Verify vehicle exists and belongs to tenant
    from uuid import UUID
    try:
        vehicle_uuid = UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle ID")

    vehicle_query = select(Vehicle).where(
        and_(
            Vehicle.id == vehicle_uuid,
            Vehicle.tenant_id == tenant_id
        )
    )
    result = await db.execute(vehicle_query)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        # Create a manual log entry
        new_log = VehicleOdometerFuelLog(
            tenant_id=tenant_id,
            vehicle_id=vehicle_uuid,
            odometer_reading=odometer_reading,
            fuel_economy=fuel_economy,
            log_date=datetime.utcnow(),
            log_type="manual",
            recorded_by_user_id=user_id
        )
        db.add(new_log)

        # Update vehicle's current odometer
        vehicle.current_odometer = odometer_reading
        if fuel_economy:
            vehicle.current_fuel_economy = fuel_economy
        vehicle.last_odometer_update = datetime.utcnow()

        await db.commit()
        await db.refresh(vehicle)

        logger.info(f"Updated current odometer for vehicle {vehicle_id} to {odometer_reading}")
        return VehicleInDB.model_validate(vehicle)

    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating current odometer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update odometer: {str(e)}")
