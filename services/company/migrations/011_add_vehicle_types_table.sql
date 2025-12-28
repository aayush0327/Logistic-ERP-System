-- Migration: Add vehicle_types table for dynamic vehicle type management
-- This allows users to create custom vehicle types instead of using hardcoded enum

-- Make the old vehicle_type column nullable to support the new vehicle_type_id
DO $$
BEGIN
    -- Check if vehicle_type column exists and is not nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles'
        AND column_name = 'vehicle_type'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE vehicles ALTER COLUMN vehicle_type DROP NOT NULL;
    END IF;
END $$;

-- Create vehicle_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- Create index on tenant_id for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicle_types_tenant_id ON vehicle_types(tenant_id);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_vehicle_types_is_active ON vehicle_types(is_active);

-- Insert default vehicle types for existing tenants
-- These correspond to the old enum values: motorcycle, van, truck_small, truck_medium, truck_large, trailer
INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Motorcycle', 'motorcycle', 'Two-wheeled motor vehicle', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Van', 'van', 'Small delivery van', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Small Truck', 'truck_small', 'Small capacity truck (up to 3 tons)', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Medium Truck', 'truck_medium', 'Medium capacity truck (3-7 tons)', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Large Truck', 'truck_large', 'Large capacity truck (7-15 tons)', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO vehicle_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Trailer', 'trailer', 'Heavy trailer for large cargo', TRUE
FROM vehicles
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Add new column to vehicles table to reference vehicle_types
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id) ON DELETE SET NULL;

-- Migrate existing vehicle_type enum values to vehicle_type_id
-- Cast vehicle_type enum to text for comparison
UPDATE vehicles
SET vehicle_type_id = (
    SELECT vt.id
    FROM vehicle_types vt
    WHERE vt.tenant_id = vehicles.tenant_id
    AND vt.code = (vehicles.vehicle_type::text)
    LIMIT 1
)
WHERE vehicle_type IS NOT NULL
AND vehicle_type_id IS NULL;

-- Create index on vehicle_type_id
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type_id ON vehicles(vehicle_type_id);

-- Add comments
COMMENT ON TABLE vehicle_types IS 'Dynamic vehicle types for vehicles - replaces hardcoded enum';
COMMENT ON COLUMN vehicles.vehicle_type_id IS 'Foreign key reference to dynamic vehicle types table';

-- Create trigger for vehicle_types updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_vehicle_types_updated_at'
    ) THEN
        CREATE TRIGGER update_vehicle_types_updated_at BEFORE UPDATE ON vehicle_types
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable Row Level Security for vehicle_types
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

-- Note: We're keeping the old vehicle_type column for now to allow rollback
-- After verification, the old column can be dropped with:
-- ALTER TABLE vehicles DROP COLUMN vehicle_type;
-- DROP TYPE vehicle_type;
