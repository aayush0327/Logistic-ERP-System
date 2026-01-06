-- Migration 012: Add customer-branch relationships
-- This migration adds support for customers to be available in specific branches
-- Similar to the product-branch relationship pattern

-- Add available_for_all_branches column to customers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'available_for_all_branches'
    ) THEN
        ALTER TABLE customers ADD COLUMN available_for_all_branches BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add comment for the new column
COMMENT ON COLUMN customers.available_for_all_branches IS 'If true, customer is available for all branches. If false, customer is only available for branches specified in customer_branches table.';

-- Create customer_branches junction table
CREATE TABLE IF NOT EXISTS customer_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, branch_id)
);

-- Add comment for the table
COMMENT ON TABLE customer_branches IS 'Junction table for customer-branch relationships. Used when available_for_all_branches is false.';

-- Create indexes for customer_branches
CREATE INDEX IF NOT EXISTS idx_customer_branches_customer_id ON customer_branches(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_branches_branch_id ON customer_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_branches_tenant_id ON customer_branches(tenant_id);

-- Add index on available_for_all_branches for filtering
CREATE INDEX IF NOT EXISTS idx_customers_available_for_all_branches ON customers(available_for_all_branches);

-- Enable Row Level Security for customer_branches
ALTER TABLE customer_branches ENABLE ROW LEVEL SECURITY;

-- Note: The main schema file (init-company-schema.sql) has been updated with:
-- 1. available_for_all_branches column in customers table
-- 2. customer_branches junction table
-- 3. Related indexes

-- Backend changes:
-- - database.py: Added CustomerBranch model and updated Customer model with branches relationship
-- - schemas.py: Added branch_ids and available_for_all_branches to customer schemas
-- - customers.py endpoint: Updated create/update endpoints to handle branch relationships

-- Frontend changes:
-- - customers/new/page.tsx: Added branch availability toggle UI (same pattern as products)
