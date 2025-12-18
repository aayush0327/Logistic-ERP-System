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
    CREATE TYPE vehicle_status AS ENUM ('available', 'on_trip', 'maintenance', 'out_of_service');
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
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    home_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
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

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
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
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    coverage_areas JSONB,  -- List of postal codes or coordinates
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_manager ON branches(manager_id);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(home_branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_type ON customers(business_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_branch ON vehicles(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_pricing_tenant_zone ON pricing_rules(tenant_id, zone_origin, zone_destination);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock, min_stock_level);
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