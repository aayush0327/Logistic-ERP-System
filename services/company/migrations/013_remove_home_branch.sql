-- Migration 013: Remove home_branch from customers
-- This migration removes the home_branch_id column and associated concepts
-- as we now use the more flexible available_for_all_branches + customer_branches pattern

-- Drop the home_branch_id column from customers table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'home_branch_id'
    ) THEN
        ALTER TABLE customers DROP COLUMN home_branch_id;
    END IF;
END $$;

-- Note: The main schema file (init-company-schema.sql) has been updated to remove home_branch_id
--
-- Backend changes:
-- - database.py: Removed home_branch_id column from Customer model and home_branch relationship
-- - schemas.py: Removed home_branch_id from CustomerBase, CustomerUpdate, and Customer response schema
-- - customers.py endpoint: Removed home_branch_id parameter, validation, and relationship loading
--
-- Frontend changes:
-- - customers/new/page.tsx: Removed home branch dropdown from customer creation form
-- - customers/[id]/page.tsx: Removed home branch display from customer details view
