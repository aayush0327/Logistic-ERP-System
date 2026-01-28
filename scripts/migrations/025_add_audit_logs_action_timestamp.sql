-- Migration 025: Add missing columns to audit_logs table
-- Description: This migration ensures the action_timestamp and entity_name columns exist in audit_logs table
-- These columns are used by TMS service to track the latest status change timestamp

-- Check if action_timestamp column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'action_timestamp'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

        COMMENT ON COLUMN audit_logs.action_timestamp IS 'Timestamp when the action occurred (used for tracking status changes)';
    END IF;
END $$;

-- Check if entity_name column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'entity_name'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN entity_name VARCHAR(500);

        COMMENT ON COLUMN audit_logs.entity_name IS 'Human-readable name of the entity (e.g., order number, trip name)';
    END IF;
END $$;

-- Create index on action_timestamp if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp
ON audit_logs (action_timestamp DESC);

-- Create composite index for tenant and action_timestamp (for efficient queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
ON audit_logs (tenant_id, action_timestamp DESC);


docker exec -it postgres_ERP psql -U postgres -d company_db -c "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP; ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR(500); CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs (action_timestamp DESC); CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, action_timestamp DESC);"
