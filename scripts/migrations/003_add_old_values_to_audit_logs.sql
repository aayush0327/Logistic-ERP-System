-- Migration: Add old_values column to audit_logs table
-- Date: 2026-01-03
-- Description: Adds the old_values JSON column to track previous values in audit logs

-- Add old_values column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'old_values'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN old_values JSONB;

        RAISE NOTICE 'Added old_values column to audit_logs table';
    ELSE
        RAISE NOTICE 'old_values column already exists in audit_logs table';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before update (JSON)';

-- Verify the column was added
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
AND column_name = 'old_values';
