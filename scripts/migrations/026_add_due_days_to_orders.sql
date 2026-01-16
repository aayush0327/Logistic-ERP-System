-- Migration: Add due_days tracking to orders table
-- Date: 2025-01-11
-- Description: Adds due_days and due_days_marked_created columns to support the Branch Manager Due Days dashboard

-- Add due_days column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_days INTEGER;

-- Add due_days_marked_created column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_days_marked_created BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN orders.due_days IS 'Number of days from order creation for expected delivery';
COMMENT ON COLUMN orders.due_days_marked_created IS 'Whether order has been marked as created/dismissed from due days list';

-- Create index on due_days for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_due_days ON orders(due_days) WHERE due_days IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_due_days_marked_created ON orders(due_days_marked_created);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
