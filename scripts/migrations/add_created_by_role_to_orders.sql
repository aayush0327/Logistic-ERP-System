-- Migration: Add created_by_role column to orders table
-- Description: Track the role of user who created the order (admin, branch_manager, marketing_person)
-- Date: 2025-01-XX

-- Add new column to track who created the order
ALTER TABLE orders
ADD COLUMN created_by_role VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN orders.created_by_role IS 'Role of user who created the order: admin, branch_manager, marketing_person';

-- Update existing orders to have 'admin' as default
-- You can adjust this based on your actual needs
UPDATE orders
SET created_by_role = 'admin'
WHERE created_by_role IS NULL;

-- Make the column NOT NULL with default
ALTER TABLE orders
ALTER COLUMN created_by_role SET NOT NULL;

-- Add default value for new orders
ALTER TABLE orders
ALTER COLUMN created_by_role SET DEFAULT 'admin';

-- Add index for potential filtering
CREATE INDEX idx_orders_created_by_role ON orders(created_by_role);

-- Add check constraint for valid values
ALTER TABLE orders
ADD CONSTRAINT chk_created_by_role
CHECK (created_by_role IN ('admin', 'branch_manager', 'marketing_person'));

-- Verify the migration
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'created_by_role';
