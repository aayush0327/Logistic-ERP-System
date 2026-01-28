-- Migration 026: Add remaining missing columns to audit_logs table
-- Description: This migration adds all columns that exist in working system but are missing in other system
-- Based on comparison between working schema and other system schema

-- ============================================================================
-- Add sub_module column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'sub_module'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN sub_module VARCHAR(50);

        COMMENT ON COLUMN audit_logs.sub_module IS 'Sub-module or feature within the module (e.g., "create", "update", "delete")';
    END IF;
END $$;

-- ============================================================================
-- Add old_status column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'old_status'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN old_status VARCHAR(50);

        COMMENT ON COLUMN audit_logs.old_status IS 'Previous status value before the change';
    END IF;
END $$;

-- ============================================================================
-- Add new_status column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'new_status'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN new_status VARCHAR(50);

        COMMENT ON COLUMN audit_logs.new_status IS 'New status value after the change';
    END IF;
END $$;

-- ============================================================================
-- Add status_changed column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'status_changed'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN status_changed BOOLEAN DEFAULT false;

        COMMENT ON COLUMN audit_logs.status_changed IS 'Flag to indicate if this audit log represents a status change';
    END IF;
END $$;

-- ============================================================================
-- Add notes column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN notes TEXT;

        COMMENT ON COLUMN audit_logs.notes IS 'Additional notes or comments about the audit event';
    END IF;
END $$;

-- ============================================================================
-- Add meta_data column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'meta_data'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN meta_data JSONB;

        COMMENT ON COLUMN audit_logs.meta_data IS 'Additional metadata about the audit event in JSONB format';
    END IF;
END $$;

-- ============================================================================
-- Add request_id column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'request_id'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN request_id VARCHAR(100);

        COMMENT ON COLUMN audit_logs.request_id IS 'Unique request identifier for tracing (e.g., UUID, correlation ID)';
    END IF;
END $$;

-- ============================================================================
-- Convert old_values from JSON to JSONB if needed
-- ============================================================================

DO $$
BEGIN
    -- Check if old_values column exists and is JSON type (not JSONB)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'old_values'
        AND data_type = 'json'
    ) THEN
        ALTER TABLE audit_logs
        ALTER COLUMN old_values TYPE JSONB
        USING old_values::JSONB;

        RAISE NOTICE 'Converted old_values from JSON to JSONB';
    END IF;
END $$;

-- ============================================================================
-- Convert new_values from JSON to JSONB if needed
-- ============================================================================

DO $$
BEGIN
    -- Check if new_values column exists and is JSON type (not JSONB)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'new_values'
        AND data_type = 'json'
    ) THEN
        ALTER TABLE audit_logs
        ALTER COLUMN new_values TYPE JSONB
        USING new_values::JSONB;

        RAISE NOTICE 'Converted new_values from JSON to JSONB';
    END IF;
END $$;

-- ============================================================================
-- Add updated_at column if missing
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE audit_logs
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

        COMMENT ON COLUMN audit_logs.updated_at IS 'Timestamp when the audit log record was last updated';
    END IF;
END $$;

-- ============================================================================
-- Create indexes for new columns (for better query performance)
-- ============================================================================

-- Index on sub_module
CREATE INDEX IF NOT EXISTS idx_audit_logs_sub_module
ON audit_logs (sub_module);

-- Index on status_changed
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_changed
ON audit_logs (status_changed);

-- Index on request_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
ON audit_logs (request_id);

-- Index on from_status (should exist from migration 025)
CREATE INDEX IF NOT EXISTS idx_audit_logs_from_status
ON audit_logs (from_status);

-- Index on to_status (should exist from migration 025)
CREATE INDEX IF NOT EXISTS idx_audit_logs_to_status
ON audit_logs (to_status);

-- Index on old_status
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_status
ON audit_logs (old_status);

-- Index on new_status
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_status
ON audit_logs (new_status);

-- ============================================================================
-- Create composite index for efficient status change queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_status_change
ON audit_logs (entity_type, entity_id, action, action_timestamp DESC)
WHERE action = 'status_change';

-- ============================================================================
-- Verification query - run this after migration to verify all columns exist
-- ============================================================================

-- Uncomment to run verification:
/*
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;
*/
