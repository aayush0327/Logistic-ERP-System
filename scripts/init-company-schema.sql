-- Company Service Database Schema
-- Run this script to create the company service database tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
DO $$ BEGIN
    CREATE TYPE business_type AS ENUM ('individual', 'small_business', 'corporate', 'government');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('motorcycle', 'van', 'truck_small', 'truck_medium', 'truck_large', 'trailer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('available', 'assigned', 'on_trip', 'maintenance', 'out_of_service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_type AS ENUM ('express', 'standard', 'economy', 'freight');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id VARCHAR(255),
    created_by VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, code)  -- Tenant-aware unique constraint
);

-- Add created_by column if it doesn't exist (for migrations)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='branches' AND column_name='created_by'
    ) THEN
        ALTER TABLE branches ADD COLUMN created_by VARCHAR(255);
    END IF;
END $$;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    business_type business_type,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    pricing_tier VARCHAR(20) DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    available_for_all_branches BOOLEAN DEFAULT true,
    contact_person_name VARCHAR(100),
    marketing_person_name VARCHAR(100),
    marketing_person_phone VARCHAR(20),
    marketing_person_email VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, code)  -- Tenant-aware unique constraint
);

-- Junction table for customer-branch relationships (for customers not available in all branches)
CREATE TABLE IF NOT EXISTS customer_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, branch_id)
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    make VARCHAR(50),
    model VARCHAR(50),
    year INTEGER,
    vehicle_type vehicle_type,
    capacity_weight DECIMAL(10,2),  -- in kg
    capacity_volume DECIMAL(10,2),  -- in cubic meters
    status vehicle_status DEFAULT 'available',
    last_maintenance TIMESTAMP WITH TIME ZONE,
    next_maintenance TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    available_for_all_branches BOOLEAN DEFAULT true,
    current_odometer FLOAT,
    current_fuel_economy FLOAT,
    last_odometer_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, plate_number)  -- Tenant-aware unique constraint
);

-- Junction table for vehicle-branch relationships (for vehicles not available in all branches)
CREATE TABLE IF NOT EXISTS vehicle_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_id, branch_id)
);

-- Create vehicle_odometer_fuel_logs table for tracking odometer and fuel economy
CREATE TABLE IF NOT EXISTS vehicle_odometer_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_reading FLOAT NOT NULL,
    fuel_economy FLOAT,
    fuel_consumed FLOAT,
    distance_traveled FLOAT,
    log_date TIMESTAMP NOT NULL,
    log_type VARCHAR(20) NOT NULL,
    notes VARCHAR(1000),
    recorded_by_user_id VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create product_unit_types table
CREATE TABLE IF NOT EXISTS product_unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20),
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT tenant_unit_code UNIQUE (tenant_id, code)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    unit_type_id UUID REFERENCES product_unit_types(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    unit_price DECIMAL(12,2) NOT NULL,
    special_price DECIMAL(12,2),  -- For specific customers or promotions
    weight DECIMAL(10,2),  -- in kg
    length DECIMAL(10,2),  -- in cm
    width DECIMAL(10,2),   -- in cm
    height DECIMAL(10,2),  -- in cm
    volume DECIMAL(10,2),  -- in cubic meters (calculated)
    handling_requirements JSONB,  -- ["fragile", "hazardous", "refrigerated"]
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    current_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    available_for_all_branches BOOLEAN DEFAULT true,  -- New field for branch availability
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, code)  -- Tenant-aware unique constraint
);

-- Junction table for product-branch relationships (for products not available in all branches)
CREATE TABLE IF NOT EXISTS product_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, branch_id)
);

-- Create pricing_rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    service_type service_type,
    zone_origin VARCHAR(50),
    zone_destination VARCHAR(50),
    base_price DECIMAL(12,2) NOT NULL,
    price_per_km DECIMAL(10,2) DEFAULT 0,
    price_per_kg DECIMAL(10,2) DEFAULT 0,
    fuel_surcharge_percent DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create service_zones table
CREATE TABLE IF NOT EXISTS service_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    coverage_areas JSONB,  -- List of postal codes or coordinates
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, code)  -- Tenant-aware unique constraint
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_manager ON branches(manager_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_type ON customers(business_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_vehicle_id ON vehicle_branches(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_branch_id ON vehicle_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_branches_tenant_id ON vehicle_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vofl_vehicle ON vehicle_odometer_fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vofl_date ON vehicle_odometer_fuel_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_vofl_tenant ON vehicle_odometer_fuel_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_pricing_tenant_zone ON pricing_rules(tenant_id, zone_origin, zone_destination);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_unit_type ON products(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_put_tenant ON product_unit_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_put_code ON product_unit_types(code);
CREATE INDEX IF NOT EXISTS idx_put_is_active ON product_unit_types(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock, min_stock_level);
CREATE INDEX idx_product_branches_product_id ON product_branches(product_id);
CREATE INDEX idx_product_branches_branch_id ON product_branches(branch_id);
CREATE INDEX idx_product_branches_tenant_id ON product_branches(tenant_id);
CREATE INDEX idx_customer_branches_customer_id ON customer_branches(customer_id);
CREATE INDEX idx_customer_branches_branch_id ON customer_branches(branch_id);
CREATE INDEX idx_customer_branches_tenant_id ON customer_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant ON product_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_service_zones_tenant ON service_zones(tenant_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_zones_updated_at BEFORE UPDATE ON service_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) setup
-- Note: These policies assume you have a function current_tenant_id() that returns
-- the tenant ID from the current session/context

-- Enable Row Level Security
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- These policies will be activated when authentication is properly integrated

-- For now, comment out the policies as we're using mock authentication
/*
CREATE POLICY branch_tenant_policy ON branches
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY customer_tenant_policy ON customers
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY vehicle_tenant_policy ON vehicles
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY product_category_tenant_policy ON product_categories
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY product_tenant_policy ON products
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY pricing_tenant_policy ON pricing_rules
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());

CREATE POLICY zone_tenant_policy ON service_zones
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());
*/

-- ================================================================================
-- EMPLOYEE ROLE MANAGEMENT
-- These tables manage employee profiles, invitations, and role-specific data
-- role_id columns reference auth service roles table (INTEGER ID stored as string)
-- ================================================================================

-- Create user_invitations table
-- role_id stores auth service role ID as string (references roles table in auth service)
CREATE TABLE IF NOT EXISTS user_invitations (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,  -- Global uniqueness for security
    role_id VARCHAR(50),  -- Auth service role ID stored as string (no FK constraint)
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    invited_by VARCHAR(255) NOT NULL,  -- User ID who sent the invitation
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by VARCHAR(255),  -- User ID who accepted
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, email)  -- Tenant-aware unique constraint (allows same email across tenants)
);

-- Create employee_profiles table
-- role_id stores auth service role ID as string (references roles table in auth service)
CREATE TABLE IF NOT EXISTS employee_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL UNIQUE,  -- Reference to auth service users table (global uniqueness)
    employee_code VARCHAR(20),
    role_id VARCHAR(50) NOT NULL,  -- Auth service role ID stored as string (no FK constraint)
    branch_id UUID REFERENCES branches(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    blood_group VARCHAR(5),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'India',
    hire_date DATE,
    employment_type VARCHAR(20) DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract', 'probation')),
    department VARCHAR(50),
    designation VARCHAR(100),
    reports_to VARCHAR(36),  -- Self-reference to manager's employee profile
    salary DECIMAL(12,2),
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(100),
    bank_ifsc VARCHAR(20),
    pan_number VARCHAR(20),
    aadhar_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, employee_code)  -- Tenant-aware unique constraint
);

-- Create driver_profiles table (extends employee_profiles)
CREATE TABLE IF NOT EXISTS driver_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_profile_id VARCHAR(36) NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    license_type VARCHAR(20) NOT NULL CHECK (license_type IN ('light_motor', 'heavy_motor', 'transport', 'goods')),
    license_expiry DATE NOT NULL,
    license_issuing_authority VARCHAR(100),
    badge_number VARCHAR(50),
    badge_expiry DATE,
    experience_years INTEGER DEFAULT 0,
    preferred_vehicle_types JSONB,  -- Array of preferred vehicle types
    current_status VARCHAR(20) DEFAULT 'available' CHECK (current_status IN ('available', 'assigned', 'on_trip', 'off_duty', 'on_leave', 'suspended')),
    last_trip_date DATE,
    total_trips INTEGER DEFAULT 0,
    total_distance DECIMAL(12,2) DEFAULT 0,  -- Total kilometers driven
    average_rating DECIMAL(3,2) DEFAULT 0.00 CHECK (average_rating >= 0 AND average_rating <= 5),
    accident_count INTEGER DEFAULT 0,
    traffic_violations INTEGER DEFAULT 0,
    driver_code VARCHAR(50),
    medical_fitness_certificate_date DATE,
    police_verification_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, license_number)  -- Tenant-aware unique constraint
);

-- Create finance_manager_profiles table (extends employee_profiles)
CREATE TABLE IF NOT EXISTS finance_manager_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_profile_id VARCHAR(36) NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    can_approve_payments BOOLEAN DEFAULT false,
    max_approval_limit DECIMAL(12,2) DEFAULT 0,
    managed_branches JSONB,  -- Array of branch IDs this manager oversees
    access_levels JSONB,  -- Define what financial modules they can access
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create branch_manager_profiles table (extends employee_profiles)
CREATE TABLE IF NOT EXISTS branch_manager_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_profile_id VARCHAR(36) NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    managed_branch_id UUID NOT NULL REFERENCES branches(id),
    can_create_quotes BOOLEAN DEFAULT true,
    can_approve_discounts BOOLEAN DEFAULT false,
    max_discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    can_manage_inventory BOOLEAN DEFAULT true,
    can_manage_vehicles BOOLEAN DEFAULT false,
    staff_management_permissions JSONB,  -- Define what staff operations they can perform
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create logistics_manager_profiles table (extends employee_profiles)
CREATE TABLE IF NOT EXISTS logistics_manager_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_profile_id VARCHAR(36) NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    managed_zones JSONB,  -- Array of zones or areas they manage
    can_assign_drivers BOOLEAN DEFAULT true,
    can_approve_overtime BOOLEAN DEFAULT false,
    can_plan_routes BOOLEAN DEFAULT true,
    vehicle_management_permissions JSONB,  -- Define vehicle operations they can perform
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create employee_documents table
CREATE TABLE IF NOT EXISTS employee_documents (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(255) NOT NULL,
    employee_profile_id VARCHAR(36) NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,  -- e.g., 'passport', 'license', 'aadhar', 'pan', 'contract', 'resume'
    document_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    file_path VARCHAR(500),  -- Path to stored document
    file_url VARCHAR(500),   -- URL if stored in cloud storage
    file_size INTEGER,
    file_type VARCHAR(50),   -- e.g., 'pdf', 'jpg', 'png'
    issue_date DATE,
    expiry_date DATE,
    issuing_authority VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(36),  -- Employee profile ID of verifier
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for employee role management tables
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_tenant ON employee_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_role ON employee_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_branch ON employee_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_code ON employee_profiles(employee_code);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_employee ON driver_profiles(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_license ON driver_profiles(license_number);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles(current_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_code_tenant ON driver_profiles(driver_code, tenant_id) WHERE driver_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_manager_profiles_employee ON finance_manager_profiles(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_branch_manager_profiles_employee ON branch_manager_profiles(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_branch_manager_profiles_branch ON branch_manager_profiles(managed_branch_id);
CREATE INDEX IF NOT EXISTS idx_logistics_manager_profiles_employee ON logistics_manager_profiles(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date);

-- Create triggers for updated_at on employee tables
CREATE TRIGGER update_user_invitations_updated_at BEFORE UPDATE ON user_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_profiles_updated_at BEFORE UPDATE ON employee_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_manager_profiles_updated_at BEFORE UPDATE ON finance_manager_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_manager_profiles_updated_at BEFORE UPDATE ON branch_manager_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_logistics_manager_profiles_updated_at BEFORE UPDATE ON logistics_manager_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_documents_updated_at BEFORE UPDATE ON employee_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for employee tables
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- ================================================================================
-- EMPLOYEE MULTIPLE BRANCH ASSIGNMENTS
-- This section creates the junction table for employee-branch many-to-many relationship
-- ================================================================================

-- Create junction table for employee-branch relationships
CREATE TABLE IF NOT EXISTS employee_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    employee_profile_id VARCHAR(36) NOT NULL,
    branch_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(255),  -- User ID who made the assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_profile FOREIGN KEY (employee_profile_id)
        REFERENCES employee_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_branch FOREIGN KEY (branch_id)
        REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT employee_branch_unique UNIQUE(employee_profile_id, branch_id)
);

-- Create indexes for employee_branches table
CREATE INDEX IF NOT EXISTS idx_employee_branches_tenant ON employee_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_employee ON employee_branches(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_branch ON employee_branches(branch_id);

-- Add comments for documentation
COMMENT ON TABLE employee_branches IS 'Junction table for many-to-many relationship between employees and branches';
COMMENT ON COLUMN employee_branches.assigned_at IS 'Timestamp when the employee was assigned to this branch';
COMMENT ON COLUMN employee_branches.assigned_by IS 'User ID of the person who made this assignment';

-- Enable Row Level Security for employee_branches
ALTER TABLE employee_branches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_branches (commented out until authentication is properly integrated)
/*
CREATE POLICY employee_branches_tenant_policy ON employee_branches
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());
*/

-- ================================================================================
-- MIGRATION 007: Alter driver_profiles license_type column length
-- ================================================================================
-- Drop the CHECK constraint that restricts values
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'driver_profiles_license_type_check'
    ) THEN
        ALTER TABLE driver_profiles DROP CONSTRAINT driver_profiles_license_type_check;
    END IF;
END $$;

-- Alter the license_type column to VARCHAR(50)
ALTER TABLE driver_profiles
ALTER COLUMN license_type TYPE VARCHAR(50) USING license_type::VARCHAR(50);

-- Add comment
COMMENT ON COLUMN driver_profiles.license_type IS 'License type (e.g., Light Motor Vehicle (LMV), Heavy Motor Vehicle (HMV), Transport Vehicle, Goods Vehicle)';

-- ================================================================================
-- MIGRATION 008: Add employee profile fields
-- ================================================================================
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'India';

ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS passport_number VARCHAR(20);

-- Add comments
COMMENT ON COLUMN employee_profiles.marital_status IS 'Marital status: single, married, divorced, widowed';
COMMENT ON COLUMN employee_profiles.nationality IS 'Nationality of the employee';
COMMENT ON COLUMN employee_profiles.passport_number IS 'Passport number for international employees';

-- ================================================================================
-- MIGRATION 009: Add product weight type fields
-- ================================================================================
-- Add weight_type enum type
DO $$ BEGIN
    CREATE TYPE weight_type AS ENUM ('fixed', 'variable');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to products table
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS weight_type weight_type DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS fixed_weight FLOAT,
    ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT 'kg';

-- Add comments for documentation
COMMENT ON COLUMN products.weight_type IS 'Type of weight: fixed (pre-determined) or variable (entered when creating order)';
COMMENT ON COLUMN products.fixed_weight IS 'Standard weight for FIXED weight type products';
COMMENT ON COLUMN products.weight_unit IS 'Weight unit (kg, lb, g, etc.)';

-- Create index on weight_type for filtering
CREATE INDEX IF NOT EXISTS idx_products_weight_type ON products(weight_type);

-- ================================================================================
-- MIGRATION 010: Add business_types table for dynamic business type management
-- ================================================================================
CREATE TABLE IF NOT EXISTS business_types (
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
CREATE INDEX IF NOT EXISTS idx_business_types_tenant_id ON business_types(tenant_id);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_business_types_is_active ON business_types(is_active);

-- Add new column to customers table to reference business_types
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_type_id UUID REFERENCES business_types(id) ON DELETE SET NULL;

-- Create index on business_type_id
CREATE INDEX IF NOT EXISTS idx_customers_business_type_id ON customers(business_type_id);

-- Add comments
COMMENT ON TABLE business_types IS 'Dynamic business types for customers - replaces hardcoded enum';
COMMENT ON COLUMN customers.business_type_id IS 'Foreign key reference to dynamic business types table';

-- Create trigger for business_types updated_at
CREATE TRIGGER update_business_types_updated_at BEFORE UPDATE ON business_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for business_types
ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;

-- ================================================================================
-- MIGRATION 017: Add customer_business_types junction table for multiple business types
-- ================================================================================

-- Create junction table for customer-business type relationships (many-to-many)
CREATE TABLE IF NOT EXISTS customer_business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    business_type_id UUID NOT NULL REFERENCES business_types(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    UNIQUE(customer_id, business_type_id)  -- Prevent duplicate relationships
);

-- Create indexes for customer_business_types table
CREATE INDEX IF NOT EXISTS idx_customer_business_types_customer_id ON customer_business_types(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_business_types_business_type_id ON customer_business_types(business_type_id);
CREATE INDEX IF NOT EXISTS idx_customer_business_types_tenant_id ON customer_business_types(tenant_id);

-- Add comments
COMMENT ON TABLE customer_business_types IS 'Junction table for many-to-many relationship between customers and business types';
COMMENT ON COLUMN customer_business_types.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN customer_business_types.business_type_id IS 'Reference to business_types table';
COMMENT ON COLUMN customer_business_types.tenant_id IS 'Tenant ID for multi-tenancy';

-- Enable Row Level Security for customer_business_types
ALTER TABLE customer_business_types ENABLE ROW LEVEL SECURITY;

-- ================================================================================
-- MIGRATION 011: Add vehicle_types table for dynamic vehicle type management
-- ================================================================================
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
WHERE vehicle_type IS NOT NULL;

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
