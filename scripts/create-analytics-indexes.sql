-- Analytics Performance Indexes
-- Creates optimized indexes for audit_logs to support analytics queries
--
-- These indexes improve query performance for:
-- - Status duration calculations
-- - Entity timeline queries
-- - Bottleneck detection
-- - Cross-database joins
--
-- Run this script on the company_db database

-- ============================================================================
-- COMPOSITE INDEXES FOR ANALYTICS QUERIES
-- ============================================================================

-- Primary analytics index for orders
-- Supports: status durations, lifecycle calculations, bottlenecks
CREATE INDEX IF NOT EXISTS idx_audit_logs_analytics_orders
ON audit_logs(tenant_id, module, entity_type, entity_id, created_at DESC)
WHERE module = 'orders' AND entity_type = 'order';

-- Primary analytics index for trips
-- Supports: trip durations, pause tracking, inefficiencies
CREATE INDEX IF NOT EXISTS idx_audit_logs_analytics_trips
ON audit_logs(tenant_id, module, entity_type, entity_id, created_at DESC)
WHERE module = 'trips' AND entity_type = 'trip';

-- Primary analytics index for drivers
-- Supports: driver utilization, availability impact
CREATE INDEX IF NOT EXISTS idx_audit_logs_analytics_drivers
ON audit_logs(tenant_id, module, entity_type, entity_id, created_at DESC)
WHERE module = 'drivers' AND entity_type = 'driver';

-- Primary analytics index for vehicles
-- Supports: truck utilization, maintenance impact
CREATE INDEX IF NOT EXISTS idx_audit_logs_analytics_vehicles
ON audit_logs(tenant_id, module, entity_type, entity_id, created_at DESC)
WHERE module = 'vehicles' AND entity_type = 'vehicle';

-- ============================================================================
-- STATUS CHANGE INDEXES
-- ============================================================================

-- Index for finding latest status of each entity (for current status queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_latest_status
ON audit_logs(entity_type, entity_id, created_at DESC)
WHERE to_status IS NOT NULL;

-- Index for status transition analysis (from_status -> to_status)
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_transitions
ON audit_logs(module, entity_type, from_status, to_status, created_at)
WHERE from_status IS NOT NULL AND to_status IS NOT NULL;

-- ============================================================================
-- DATE RANGE INDEXES
-- ============================================================================

-- Index for date-filtered queries with tenant isolation
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_desc
ON audit_logs(tenant_id, created_at DESC)
INCLUDE (module, entity_type, entity_id, to_status, from_status);

-- Index for time-series analysis by module
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created
ON audit_logs(module, created_at DESC)
INCLUDE (entity_type, entity_id, to_status, from_status, tenant_id);

-- ============================================================================
-- SPECIFIC ANALYTICS USE CASE INDEXES
-- ============================================================================

-- Index for bottleneck detection (find entities stuck in status)
CREATE INDEX IF NOT EXISTS idx_audit_logs_bottleneck_detection
ON audit_logs(module, entity_type, entity_id, to_status, created_at DESC)
WHERE to_status NOT IN ('delivered', 'cancelled', 'completed');

-- Index for pause tracking (trips)
CREATE INDEX IF NOT EXISTS idx_audit_logs_pause_tracking
ON audit_logs(entity_id, created_at)
WHERE module = 'trips' AND entity_type = 'trip' AND to_status = 'paused';

-- Index for maintenance tracking (vehicles)
CREATE INDEX IF NOT EXISTS idx_audit_logs_maintenance_tracking
ON audit_logs(entity_id, created_at)
WHERE module = 'vehicles' AND entity_type = 'vehicle' AND to_status = 'maintenance';

-- ============================================================================
-- ACTION-SPECIFIC INDEXES
-- ============================================================================

-- Index for trip assignment tracking
CREATE INDEX IF NOT EXISTS idx_audit_logs_trip_assignments
ON audit_logs(module, created_at, entity_id)
WHERE action = 'assign_driver' OR action = 'assign_to_trip';

-- Index for approval workflows
CREATE INDEX IF NOT EXISTS idx_audit_logs_approvals
ON audit_logs(module, created_at, entity_id, approval_status)
WHERE action IN ('approve', 'reject') AND approval_status IS NOT NULL;

-- ============================================================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Recent audit logs (last 30 days) - for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_recent
ON audit_logs(tenant_id, module, entity_type, created_at DESC)
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Today's audit logs - for real-time monitoring
CREATE INDEX IF NOT EXISTS idx_audit_logs_today
ON audit_logs(created_at DESC, module, entity_type)
WHERE created_at >= DATE_TRUNC('day', NOW());

-- ============================================================================
-- COVERING INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Order lifecycle query covering index
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_lifecycle
ON audit_logs(entity_id, to_status, created_at)
INCLUDE (from_status, module, tenant_id)
WHERE module = 'orders' AND entity_type = 'order'
AND to_status IN ('draft', 'submitted', 'finance_approved', 'logistics_approved',
                   'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled');

-- Trip lifecycle query covering index
CREATE INDEX IF NOT EXISTS idx_audit_logs_trip_lifecycle
ON audit_logs(entity_id, to_status, created_at)
INCLUDE (from_status, module, tenant_id)
WHERE module = 'trips' AND entity_type = 'trip'
AND to_status IN ('planning', 'loading', 'on-route', 'paused', 'completed', 'cancelled');

-- ============================================================================
-- STATISTICS FOR OPTIMIZER
-- ============================================================================

-- Increase statistics target for audit_logs for better query planning
ALTER TABLE audit_logs SET (statistics_target = 1000);

-- Create extended statistics on commonly filtered columns
CREATE STATISTICS IF NOT EXISTS stat_audit_logs_tenant_module
ON tenant_id, module, created_at
FROM audit_logs;

CREATE STATISTICS IF NOT EXISTS stat_audit_logs_entity_type_status
ON entity_type, to_status, from_status
FROM audit_logs;

-- ============================================================================
-- INDEX MAINTENANCE NOTES
-- ============================================================================

-- These indexes should be maintained regularly:
-- 1. REINDEX CONCURRENTLY idx_audit_logs_* (periodically, e.g., monthly)
-- 2. ANALYZE audit_logs (after large data imports or changes)
-- 3. VACUUM ANALYZE audit_logs (regular maintenance)
--
-- Monitor index usage with:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
--
-- Find unused indexes:
-- SELECT * FROM pg_stat_user_indexes
-- WHERE idx_scan = 0 AND indexrelname LIKE 'idx_audit_logs_%';

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_audit_logs_analytics_orders IS 'Primary index for order analytics queries. Covers tenant, module, entity filtering with time ordering.';
COMMENT ON INDEX idx_audit_logs_analytics_trips IS 'Primary index for trip analytics queries. Supports duration, pause, and inefficiency calculations.';
COMMENT ON INDEX idx_audit_logs_analytics_drivers IS 'Primary index for driver analytics queries. Supports utilization and availability analysis.';
COMMENT ON INDEX idx_audit_logs_analytics_vehicles IS 'Primary index for vehicle analytics queries. Supports utilization and maintenance analysis.';
COMMENT ON INDEX idx_audit_logs_latest_status IS 'Quick lookup of latest status for any entity. Used for current status queries.';
COMMENT ON INDEX idx_audit_logs_status_transitions IS 'Optimizes status change analysis. Supports duration calculations between statuses.';
COMMENT ON INDEX idx_audit_logs_bottleneck_detection IS 'Identifies orders/trips stuck in non-terminal statuses. Used for bottleneck detection.';
COMMENT ON INDEX idx_audit_logs_pause_tracking IS 'Tracks trip pause/resume events for pause duration calculations.';
COMMENT ON INDEX idx_audit_logs_maintenance_tracking IS 'Tracks vehicle maintenance periods for maintenance impact analysis.';
