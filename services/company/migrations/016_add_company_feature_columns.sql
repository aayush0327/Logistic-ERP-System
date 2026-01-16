-- Migration 016: Add columns for 4 key features to company service
-- Description: This migration adds all the database columns needed for:
-- 1. Contact person name for customers
-- 2. Vehicle odometer and fuel economy tracking
-- 3. Product unit types table and foreign key
-- 4. Driver code field for driver profiles

-- ============================================================================
-- 1. CUSTOMER TABLE - Add contact_person_name column
-- ============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_person_name VARCHAR(100);

COMMENT ON COLUMN customers.contact_person_name IS 'Name of the primary contact person at the customer organization';


-- ============================================================================
-- 2. VEHICLES TABLE - Add odometer and fuel economy tracking columns
-- ============================================================================

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS current_odometer FLOAT,
  ADD COLUMN IF NOT EXISTS current_fuel_economy FLOAT,
  ADD COLUMN IF NOT EXISTS last_odometer_update TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN vehicles.current_odometer IS 'Current odometer reading in kilometers';
COMMENT ON COLUMN vehicles.current_fuel_economy IS 'Current fuel economy in km/liter';
COMMENT ON COLUMN vehicles.last_odometer_update IS 'Timestamp of the last odomometer update';


-- ============================================================================
-- 3. VEHICLE ODOMETER FUEL LOGS TABLE - Create tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_odometer_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    log_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    odometer_reading FLOAT NOT NULL,
    fuel_quantity DECIMAL(10,2),  -- in liters
    fuel_economy DECIMAL(10,2),  -- calculated km/liter
    notes TEXT,
    logged_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for vehicle_odometer_fuel_logs
CREATE INDEX IF NOT EXISTS idx_vofl_vehicle ON vehicle_odometer_fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vofl_date ON vehicle_odometer_fuel_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_vofl_tenant ON vehicle_odometer_fuel_logs(tenant_id);

COMMENT ON TABLE vehicle_odometer_fuel_logs IS 'Logs for tracking vehicle odometer readings and fuel economy over time';


-- ============================================================================
-- 4. PRODUCT UNIT TYPES TABLE - Create unit types reference table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, code)
);

-- Create indexes for product_unit_types
CREATE INDEX IF NOT EXISTS idx_put_tenant ON product_unit_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_put_code ON product_unit_types(code);
CREATE INDEX IF NOT EXISTS idx_put_is_active ON product_unit_types(is_active);

COMMENT ON TABLE product_unit_types IS 'Reference table for product measurement units (e.g., kg, liters, pieces)';
COMMENT ON COLUMN product_unit_types.code IS 'Unique code for the unit type (e.g., KG, LTR, PCS)';
COMMENT ON COLUMN product_unit_types.abbreviation IS 'Short abbreviation (e.g., kg, L, pcs)';


-- ============================================================================
-- 5. PRODUCTS TABLE - Add unit_type_id foreign key
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_type_id UUID REFERENCES product_unit_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_unit_type ON products(unit_type_id);

COMMENT ON COLUMN products.unit_type_id IS 'Foreign key reference to the unit type for this product';


-- ============================================================================
-- 6. DRIVER PROFILES TABLE - Add driver_code column
-- ============================================================================

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS driver_code VARCHAR(50);

-- Create unique index for driver_code per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_code_tenant
  ON driver_profiles(driver_code, tenant_id)
  WHERE driver_code IS NOT NULL;

COMMENT ON COLUMN driver_profiles.driver_code IS 'Unique driver code for identification (e.g., DRV-001)';


-- ============================================================================
-- 7. Add updated_at trigger for product_unit_types
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_unit_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_unit_types_updated_at ON product_unit_types;
CREATE TRIGGER update_product_unit_types_updated_at
    BEFORE UPDATE ON product_unit_types
    FOR EACH ROW
    EXECUTE FUNCTION update_product_unit_types_updated_at();


-- ============================================================================
-- 8. Enable Row Level Security for new tables
-- ============================================================================

ALTER TABLE vehicle_odometer_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_unit_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vehicle_odometer_fuel_logs
CREATE POLICY vehicle_odometer_fuel_logs_tenant_policy
    ON vehicle_odometer_fuel_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255));

-- Create RLS policies for product_unit_types
CREATE POLICY product_unit_types_tenant_policy
    ON product_unit_types
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255));


COMMIT;
