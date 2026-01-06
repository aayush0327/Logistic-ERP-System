"""
Audit Log API endpoints
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from datetime import datetime
import csv
import io
import logging

from src.database import get_db, AuditLog
from src.schemas import (
    AuditLogCreate,
    AuditLogResponse,
    AuditLogListResponse
)
from src.security import TokenData, require_permissions, get_current_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/logs", response_model=AuditLogResponse, status_code=201)
async def create_audit_log(
    log_data: AuditLogCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create audit log entry (called by other services)

    This endpoint is used by other services (Orders, TMS, Driver) to send
    audit events to the Company service for centralized logging.
    """
    try:
        audit_log = AuditLog(**log_data.model_dump())
        db.add(audit_log)
        await db.commit()
        await db.refresh(audit_log)
        logger.info(f"Audit log created: {log_data.action} on {log_data.entity_type} {log_data.entity_id}")
        return audit_log
    except Exception as e:
        logger.error(f"Error creating audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create audit log: {str(e)}")


@router.get("/logs", response_model=AuditLogListResponse)
async def query_audit_logs(
    request: Request,
    date_from: Optional[datetime] = Query(None, description="Filter logs from this date"),
    date_to: Optional[datetime] = Query(None, description="Filter logs until this date"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    module: Optional[str] = Query(None, description="Filter by module (orders, trips, etc.)"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    token_data: TokenData = Depends(require_permissions(["audit:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Query audit logs with filters

    Returns paginated list of audit logs for the current tenant.
    Supports filtering by date range, user, module, action, and entity.
    """
    # Build query with tenant isolation
    filters = [AuditLog.tenant_id == tenant_id]

    if date_from:
        filters.append(AuditLog.created_at >= date_from)
    if date_to:
        filters.append(AuditLog.created_at <= date_to)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if module:
        filters.append(AuditLog.module == module)
    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)

    # Get total count
    count_query = select(func.count(AuditLog.id)).where(and_(*filters))
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    query = select(AuditLog).where(and_(*filters)).order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    logs = result.scalars().all()

    pages = (total + per_page - 1) // per_page if total > 0 else 0

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/logs/export")
async def export_audit_logs(
    request: Request,
    date_from: Optional[datetime] = Query(None, description="Filter logs from this date"),
    date_to: Optional[datetime] = Query(None, description="Filter logs until this date"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    module: Optional[str] = Query(None, description="Filter by module (orders, trips, etc.)"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    token_data: TokenData = Depends(require_permissions(["audit:export"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Export audit logs to CSV

    Exports all matching audit logs (without pagination) as a CSV file download.
    Uses the same filter parameters as the query endpoint.
    """
    # Build filters (same as query endpoint)
    filters = [AuditLog.tenant_id == tenant_id]

    if date_from:
        filters.append(AuditLog.created_at >= date_from)
    if date_to:
        filters.append(AuditLog.created_at <= date_to)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if module:
        filters.append(AuditLog.module == module)
    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)

    # Get all matching logs (no pagination for export)
    query = select(AuditLog).where(and_(*filters)).order_by(desc(AuditLog.created_at))
    result = await db.execute(query)
    logs = result.scalars().all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Timestamp", "User ID", "User Name", "Role", "Action", "Module",
        "Entity Type", "Entity ID", "Description", "From Status", "To Status",
        "Reason", "Service", "IP Address"
    ])

    # Rows
    for log in logs:
        writer.writerow([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            log.user_id,
            log.user_name or "",
            log.user_role or "",
            log.action,
            log.module,
            log.entity_type,
            log.entity_id,
            log.description,
            log.from_status or "",
            log.to_status or "",
            log.reason or "",
            log.service_name or "",
            log.ip_address or ""
        ])

    # Return as streaming response
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=audit_logs.csv'}
    )


@router.get("/logs/summary")
async def get_audit_summary(
    request: Request,
    date_from: Optional[datetime] = Query(None, description="Filter logs from this date"),
    date_to: Optional[datetime] = Query(None, description="Filter logs until this date"),
    token_data: TokenData = Depends(require_permissions(["audit:read"])),
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit log summary statistics

    Returns counts grouped by module, action, and user for the filtered date range.
    Useful for dashboards and analytics.
    """
    # Build filters
    filters = [AuditLog.tenant_id == tenant_id]

    if date_from:
        filters.append(AuditLog.created_at >= date_from)
    if date_to:
        filters.append(AuditLog.created_at <= date_to)

    base_filter = and_(*filters)

    # Get total count
    total_query = select(func.count(AuditLog.id)).where(base_filter)
    total_result = await db.execute(total_query)
    total = total_result.scalar()

    # Get counts by module
    module_query = select(
        AuditLog.module,
        func.count(AuditLog.id)
    ).where(base_filter).group_by(AuditLog.module).order_by(desc(func.count(AuditLog.id)))
    module_result = await db.execute(module_query)
    by_module = [{"module": row[0], "count": row[1]} for row in module_result.all()]

    # Get counts by action
    action_query = select(
        AuditLog.action,
        func.count(AuditLog.id)
    ).where(base_filter).group_by(AuditLog.action).order_by(desc(func.count(AuditLog.id)))
    action_result = await db.execute(action_query)
    by_action = [{"action": row[0], "count": row[1]} for row in action_result.all()]

    # Get counts by user (top 10)
    user_query = select(
        AuditLog.user_id,
        AuditLog.user_name,
        func.count(AuditLog.id)
    ).where(base_filter).group_by(
        AuditLog.user_id, AuditLog.user_name
    ).order_by(desc(func.count(AuditLog.id))).limit(10)
    user_result = await db.execute(user_query)
    by_user = [
        {"user_id": row[0], "user_name": row[1], "count": row[2]}
        for row in user_result.all()
    ]

    return {
        "total": total,
        "by_module": by_module,
        "by_action": by_action,
        "top_users": by_user
    }
