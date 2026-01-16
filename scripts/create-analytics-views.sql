-- Analytics Database Optimization Scripts
-- Materialized Views for Analytics Performance
--
-- This script creates materialized views to improve analytics query performance.
-- Materialized views should be refreshed periodically (e.g., every hour).
--
-- Refresh strategy:
--   REFRESH MATERIALIZED VIEW mv_order_status_summary;
--   REFRESH MATERIALIZED VIEW mv_trip_status_summary;
--   REFRESH MATERIALIZED VIEW mv_driver_status_summary;
--   REFRESH MATERIALIZED VIEW mv_vehicle_status_summary;

-- ============================================================================
-- ORDER STATUS SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-aggregates order status changes by day for faster trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_order_status_summary AS
SELECT
    tenant_id,
    to_status as status,
    DATE_TRUNC('day', created_at) as date,
    COUNT(DISTINCT entity_id) as order_count,
    COUNT(*) as status_change_count,
    MIN(created_at) as first_change,
    MAX(created_at) as last_change
FROM audit_logs
WHERE module = 'orders'
    AND entity_type = 'order'
    AND to_status IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'  -- Only keep last 90 days
GROUP BY tenant_id, to_status, DATE_TRUNC('day', created_at);

-- Create indexes for the materialized view
CREATE INDEX IF NOT EXISTS idx_mv_order_status_tenant_date
ON mv_order_status_summary(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_order_status_date
ON mv_order_status_summary(date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_order_status_status
ON mv_order_status_summary(status);

-- ============================================================================
-- TRIP STATUS SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-aggregates trip status changes by day
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trip_status_summary AS
SELECT
    tenant_id,
    to_status as status,
    DATE_TRUNC('day', created_at) as date,
    COUNT(DISTINCT entity_id) as trip_count,
    COUNT(*) as status_change_count
FROM audit_logs
WHERE module = 'trips'
    AND entity_type = 'trip'
    AND to_status IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, to_status, DATE_TRUNC('day', created_at);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_trip_status_tenant_date
ON mv_trip_status_summary(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_trip_status_status
ON mv_trip_status_summary(status);

-- ============================================================================
-- DRIVER STATUS SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-aggregates driver status changes by day
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_driver_status_summary AS
SELECT
    tenant_id,
    to_status as status,
    DATE_TRUNC('day', created_at) as date,
    COUNT(DISTINCT entity_id) as driver_count
FROM audit_logs
WHERE module = 'drivers'
    AND entity_type = 'driver'
    AND to_status IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, to_status, DATE_TRUNC('day', created_at);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_driver_status_tenant_date
ON mv_driver_status_summary(tenant_id, date DESC);

-- ============================================================================
-- VEHICLE STATUS SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-aggregates vehicle status changes by day
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vehicle_status_summary AS
SELECT
    tenant_id,
    to_status as status,
    DATE_TRUNC('day', created_at) as date,
    COUNT(DISTINCT entity_id) as vehicle_count
FROM audit_logs
WHERE module = 'vehicles'
    AND entity_type = 'vehicle'
    AND to_status IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, to_status, DATE_TRUNC('day', created_at);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_vehicle_status_tenant_date
ON mv_vehicle_status_summary(tenant_id, date DESC);

-- ============================================================================
-- ORDER LIFECYCLE SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-computes order lifecycle metrics (draft to delivered/cancelled)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_order_lifecycle_summary AS
SELECT
    tenant_id,
    entity_id as order_id,
    MIN(CASE WHEN to_status = 'draft' THEN created_at END) as created_at,
    MIN(CASE WHEN to_status = 'submitted' THEN created_at END) as submitted_at,
    MIN(CASE WHEN to_status = 'finance_approved' THEN created_at END) as finance_approved_at,
    MIN(CASE WHEN to_status = 'logistics_approved' THEN created_at END) as logistics_approved_at,
    MIN(CASE WHEN to_status = 'assigned' THEN created_at END) as assigned_at,
    MIN(CASE WHEN to_status = 'picked_up' THEN created_at END) as picked_up_at,
    MIN(CASE WHEN to_status = 'in_transit' THEN created_at END) as in_transit_at,
    MIN(CASE WHEN to_status = 'delivered' THEN created_at END) as delivered_at,
    MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) as cancelled_at,
    CASE
        WHEN MIN(CASE WHEN to_status = 'delivered' THEN created_at END) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                MIN(CASE WHEN to_status = 'delivered' THEN created_at END) -
                MIN(CASE WHEN to_status = 'draft' THEN created_at END)
            )) / 3600.0
        WHEN MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) -
                MIN(CASE WHEN to_status = 'draft' THEN created_at END)
            )) / 3600.0
        ELSE NULL
    END as lifecycle_hours,
    MAX(created_at) as last_updated
FROM audit_logs
WHERE module = 'orders'
    AND entity_type = 'order'
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, entity_id;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_order_lifecycle_tenant
ON mv_order_lifecycle_summary(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mv_order_lifecycle_created
ON mv_order_lifecycle_summary(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mv_order_lifecycle_delivered
ON mv_order_lifecycle_summary(delivered_at) WHERE delivered_at IS NOT NULL;

-- ============================================================================
-- TRIP LIFECYCLE SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Pre-computes trip lifecycle metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trip_lifecycle_summary AS
SELECT
    tenant_id,
    entity_id as trip_id,
    MIN(CASE WHEN to_status = 'planning' THEN created_at END) as planning_start,
    MIN(CASE WHEN to_status = 'loading' THEN created_at END) as loading_at,
    MIN(CASE WHEN to_status = 'on-route' THEN created_at END) as on_route_at,
    MIN(CASE WHEN to_status = 'paused' THEN created_at END) as first_paused_at,
    MIN(CASE WHEN to_status = 'completed' THEN created_at END) as completed_at,
    MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) as cancelled_at,
    CASE
        WHEN MIN(CASE WHEN to_status = 'completed' THEN created_at END) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                MIN(CASE WHEN to_status = 'completed' THEN created_at END) -
                MIN(CASE WHEN to_status = 'planning' THEN created_at END)
            )) / 3600.0
        WHEN MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                MIN(CASE WHEN to_status = 'cancelled' THEN created_at END) -
                MIN(CASE WHEN to_status = 'planning' THEN created_at END)
            )) / 3600.0
        ELSE NULL
    END as total_trip_hours,
    MAX(created_at) as last_updated
FROM audit_logs
WHERE module = 'trips'
    AND entity_type = 'trip'
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, entity_id;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_trip_lifecycle_tenant
ON mv_trip_lifecycle_summary(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mv_trip_lifecycle_planning
ON mv_trip_lifecycle_summary(planning_start DESC);

-- ============================================================================
-- AUTOMATIC REFRESH FUNCTION (Optional - for scheduled refresh)
-- ============================================================================
-- Uncomment to enable automatic refresh every hour
-- Requires pg_cron extension or external scheduler

/*
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_status_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_status_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_driver_status_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_status_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_lifecycle_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_lifecycle_summary;
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON MATERIALIZED VIEW mv_order_status_summary IS 'Pre-aggregated order status changes by day for analytics. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_trip_status_summary IS 'Pre-aggregated trip status changes by day for analytics. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_driver_status_summary IS 'Pre-aggregated driver status changes by day for analytics. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_vehicle_status_summary IS 'Pre-aggregated vehicle status changes by day for analytics. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_order_lifecycle_summary IS 'Pre-computed order lifecycle metrics (creation to delivery/cancellation). Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_trip_lifecycle_summary IS 'Pre-computed trip lifecycle metrics (planning to completion). Refresh hourly.';
