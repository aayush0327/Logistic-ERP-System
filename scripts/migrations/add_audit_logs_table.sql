-- Migration: Add audit_logs table
-- Description: Creates the audit_logs table for centralized audit tracking
-- Date: 2025-12-30

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,

    -- User information
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(200),
    user_email VARCHAR(255),
    user_role VARCHAR(50),

    -- Action details
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Change tracking
    old_values JSONB,
    new_values JSONB,

    -- Status change tracking
    from_status VARCHAR(50),
    to_status VARCHAR(50),

    -- Approval tracking
    approval_status VARCHAR(20),
    reason TEXT,

    -- Metadata
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    service_name VARCHAR(50),

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_module_entity ON audit_logs(tenant_id, module, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user_created ON audit_logs(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Centralized audit log table for tracking all company operations';
COMMENT ON COLUMN audit_logs.id IS 'Unique identifier for the audit log entry';
COMMENT ON COLUMN audit_logs.tenant_id IS 'Tenant identifier for multi-tenancy';
COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN audit_logs.user_name IS 'Name of the user (denormalized for query performance)';
COMMENT ON COLUMN audit_logs.user_email IS 'Email of the user (denormalized for query performance)';
COMMENT ON COLUMN audit_logs.user_role IS 'Role of the user';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (create, update, delete, status_change, approve, reject, etc.)';
COMMENT ON COLUMN audit_logs.module IS 'Module name (orders, trips, customers, vehicles, etc.)';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity (order, trip, customer, etc.)';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN audit_logs.description IS 'Human-readable description of the action';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values (for updates)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values (for updates/creates)';
COMMENT ON COLUMN audit_logs.from_status IS 'Previous status (for status changes)';
COMMENT ON COLUMN audit_logs.to_status IS 'New status (for status changes)';
COMMENT ON COLUMN audit_logs.approval_status IS 'approved/rejected (for approval actions)';
COMMENT ON COLUMN audit_logs.reason IS 'Reason for rejection/cancellation';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client information';
COMMENT ON COLUMN audit_logs.service_name IS 'Service that created this log (orders, tms, driver, etc.)';
COMMENT ON COLUMN audit_logs.created_at IS 'Timestamp of the audit event';
