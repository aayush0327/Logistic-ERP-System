-- Migration: Add new_values and other missing columns to audit_logs table
-- Date: 2026-01-07
-- Description: Adds new_values, from_status, to_status, approval_status, service_name columns to audit_logs table
--              This fixes the schema mismatch causing audit log failures

BEGIN;

-- Add new_values column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'new_values'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN new_values JSONB;

        RAISE NOTICE 'Added new_values column to audit_logs table';
    ELSE
        RAISE NOTICE 'new_values column already exists in audit_logs table';
    END IF;
END $$;

-- Add from_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'from_status'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN from_status VARCHAR(50);

        RAISE NOTICE 'Added from_status column to audit_logs table';
    ELSE
        RAISE NOTICE 'from_status column already exists in audit_logs table';
    END IF;
END $$;

-- Add to_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'to_status'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN to_status VARCHAR(50);

        RAISE NOTICE 'Added to_status column to audit_logs table';
    ELSE
        RAISE NOTICE 'to_status column already exists in audit_logs table';
    END IF;
END $$;

-- Add approval_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN approval_status VARCHAR(20);

        RAISE NOTICE 'Added approval_status column to audit_logs table';
    ELSE
        RAISE NOTICE 'approval_status column already exists in audit_logs table';
    END IF;
END $$;

-- Add service_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'service_name'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN service_name VARCHAR(50);

        RAISE NOTICE 'Added service_name column to audit_logs table';
    ELSE
        RAISE NOTICE 'service_name column already exists in audit_logs table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN audit_logs.new_values IS 'New values after update/create (JSON)';
COMMENT ON COLUMN audit_logs.from_status IS 'Previous status (for status changes)';
COMMENT ON COLUMN audit_logs.to_status IS 'New status (for status changes)';
COMMENT ON COLUMN audit_logs.approval_status IS 'approved/rejected (for approval actions)';
COMMENT ON COLUMN audit_logs.service_name IS 'Service that created this log (orders, tms, driver, etc.)';

-- Create indexes for new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_module_entity ON audit_logs(tenant_id, module, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user_created ON audit_logs(tenant_id, user_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(action_timestamp DESC);

COMMIT;

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
AND column_name IN ('new_values', 'from_status', 'to_status', 'approval_status', 'service_name')
ORDER BY column_name;
