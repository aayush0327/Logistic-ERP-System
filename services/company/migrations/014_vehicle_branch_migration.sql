-- Migration 014: Vehicle branch relationship migration
-- This migration adds support for vehicles to be available in specific branches
-- Similar to the customer and product-branch relationship pattern
-- Removes the single branch_id foreign key and adds available_for_all_branches + vehicle_branches junction table

-- Step 1: Add available_for_all_branches column to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles' AND column_name = 'available_for_all_branches'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN available_for_all_branches BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add comment for the new column
COMMENT ON COLUMN vehicles.available_for_all_branches IS 'If true, vehicle is available for all branches. If false, vehicle is only available for branches specified in vehicle_branches table.';

-- Step 2: Handle existing vehicle_branches table - ensure it has the unique constraint
-- Drop the table if it exists without proper constraints and recreate it
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_branches') THEN
        -- Check if the unique constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'vehicle_branches'::regclass
            AND contype = 'u'
            AND conname LIKE '%vehicle_id%branch_id%'
        ) THEN
            -- Drop the incomplete table
            DROP TABLE vehicle_branches CASCADE;
        END IF;
    END IF;
END $$;

-- Step 3: Create vehicle_branches junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS vehicle_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_id, branch_id)
);

-- Add comment for the table
COMMENT ON TABLE vehicle_branches IS 'Junction table for vehicle-branch relationships. Used when available_for_all_branches is false.';

-- Step 4: Create indexes for vehicle_branches (must exist before inserts for performance)
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_vehicle_id ON vehicle_branches(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_branch_id ON vehicle_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_tenant_id ON vehicle_branches(tenant_id);

-- Step 5: Migrate existing branch_id data to vehicle_branches before removing branch_id
-- Only do this if branch_id column still exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles' AND column_name = 'branch_id'
    ) THEN
        -- Insert existing vehicle-branch relationships into vehicle_branches
        -- Use INSERT with ON CONFLICT to handle any duplicates
        INSERT INTO vehicle_branches (vehicle_id, branch_id, tenant_id, created_at)
        SELECT
            id as vehicle_id,
            branch_id,
            tenant_id,
            created_at
        FROM vehicles
        WHERE branch_id IS NOT NULL
        ON CONFLICT (vehicle_id, branch_id) DO NOTHING;

        -- Set available_for_all_branches to false for vehicles that had a specific branch
        UPDATE vehicles
        SET available_for_all_branches = false
        WHERE branch_id IS NOT NULL;
    END IF;
END $$;

-- Step 6: Drop the old branch_id column and its index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE vehicles DROP COLUMN branch_id;
    END IF;
END $$;

-- Note: The main schema file (init-company-schema.sql) has been updated with:
-- 1. available_for_all_branches column in vehicles table
-- 2. vehicle_branches junction table
-- 3. Related indexes
-- 4. Removed branch_id column from vehicles table
--
-- Backend changes:
-- - database.py: Updated Vehicle model with branches relationship, removed branch_id
-- - schemas.py: Updated vehicle schemas to use branch_ids and available_for_all_branches
-- - vehicles.py: Updated endpoints to handle branch relationships
