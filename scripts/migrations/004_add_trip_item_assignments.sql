-- Migration: Add trip_item_assignments table for tracking split/partial item assignments
-- Date: 2026-01-03
-- Description: Creates a junction table to track which order items are assigned to which trips
-- This allows partial/split assignments where the same item can be assigned to multiple trips

-- Create trip_item_assignments junction table
CREATE TABLE IF NOT EXISTS trip_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id VARCHAR(50) NOT NULL,  -- TMS trip ID (e.g., TRIP-XXXX)
    order_id VARCHAR(255) NOT NULL,  -- Order UUID from orders table
    order_item_id VARCHAR(255) NOT NULL,  -- Order item UUID from order_items table
    order_number VARCHAR(50) NOT NULL,  -- Order number for easy lookup (e.g., ORD-2026...)
    tenant_id VARCHAR(255) NOT NULL,

    -- Assignment details
    assigned_quantity INTEGER NOT NULL,  -- Quantity assigned to this trip
    item_status VARCHAR(50) DEFAULT 'pending_to_assign' CHECK (
        item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')
    ),

    -- Timestamps
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: Same item can only be assigned once to the same trip
    UNIQUE(trip_id, order_item_id)
);

-- Add comments for documentation
COMMENT ON TABLE trip_item_assignments IS 'Junction table tracking which order items are assigned to which trips with quantities';
COMMENT ON COLUMN trip_item_assignments.id IS 'Unique identifier for the assignment';
COMMENT ON COLUMN trip_item_assignments.trip_id IS 'TMS trip ID (e.g., TRIP-XXXX)';
COMMENT ON COLUMN trip_item_assignments.order_id IS 'Order UUID from orders table';
COMMENT ON COLUMN trip_item_assignments.order_item_id IS 'Order item UUID from order_items table';
COMMENT ON COLUMN trip_item_assignments.order_number IS 'Order number for easy lookup (e.g., ORD-2026...)';
COMMENT ON COLUMN trip_item_assignments.tenant_id IS 'Tenant identifier for multi-tenancy';
COMMENT ON COLUMN trip_item_assignments.assigned_quantity IS 'Quantity of this item assigned to this trip';
COMMENT ON COLUMN trip_item_assignments.item_status IS 'Current status of this item assignment';
COMMENT ON COLUMN trip_item_assignments.assigned_at IS 'When this item was assigned to the trip';
COMMENT ON COLUMN trip_item_assignments.updated_at IS 'When this assignment was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_trip_id ON trip_item_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_id ON trip_item_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_item_id ON trip_item_assignments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_number ON trip_item_assignments(order_number);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_tenant_id ON trip_item_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_item_status ON trip_item_assignments(item_status);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_trip_status ON trip_item_assignments(trip_id, item_status);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_trip ON trip_item_assignments(order_id, trip_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trip_item_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_trip_item_assignments_updated_at ON trip_item_assignments;
CREATE TRIGGER update_trip_item_assignments_updated_at
    BEFORE UPDATE ON trip_item_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_trip_item_assignments_updated_at();

-- Verification query
SELECT
    'Migration completed successfully!' as status,
    'trip_item_assignments table created' as message;
