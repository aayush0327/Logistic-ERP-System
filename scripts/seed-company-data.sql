-- Seed data for Company Service
-- Run this script after creating the schema to populate initial test data

-- Insert sample branches
INSERT INTO branches (id, tenant_id, code, name, address, city, state, postal_code, phone, email, manager_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'default-tenant', 'HQ', 'Headquarters', '123 Main St', 'New York', 'NY', '10001', '212-555-0100', 'hq@logistics-erp.com', 'manager-001'),
('550e8400-e29b-41d4-a716-446655440002', 'default-tenant', 'BR001', 'Brooklyn Branch', '456 Atlantic Ave', 'Brooklyn', 'NY', '11201', '718-555-0101', 'brooklyn@logistics-erp.com', 'manager-002'),
('550e8400-e29b-41d4-a716-446655440003', 'default-tenant', 'BR002', 'Queens Branch', '789 Queens Blvd', 'Queens', 'NY', '11375', '718-555-0102', 'queens@logistics-erp.com', 'manager-003'),
('550e8400-e29b-41d4-a716-446655440004', 'default-tenant', 'NJ001', 'New Jersey Branch', '321 Market St', 'Newark', 'NJ', '07102', '973-555-0103', 'nj@logistics-erp.com', 'manager-004');

-- Insert sample product categories
INSERT INTO product_categories (id, tenant_id, name, description) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'default-tenant', 'Documents', 'Paper documents and small packages'),
('660e8400-e29b-41d4-a716-446655440002', 'default-tenant', 'Electronics', 'Electronic devices and components'),
('660e8400-e29b-41d4-a716-446655440003', 'default-tenant', 'Furniture', 'Office and home furniture'),
('660e8400-e29b-41d4-a716-446655440004', 'default-tenant', 'Clothing', 'Apparel and textiles'),
('660e8400-e29b-41d4-a716-446655440005', 'default-tenant', 'Food & Beverages', 'Perishable and non-perishable food items'),
('660e8400-e29b-41d4-a716-446655440006', 'default-tenant', 'Industrial', 'Industrial equipment and machinery');

-- Insert subcategories for Documents
INSERT INTO product_categories (id, tenant_id, name, description, parent_id) VALUES
('660e8400-e29b-41d4-a716-446655440007', 'default-tenant', 'Legal Documents', 'Legal papers and contracts', '660e8400-e29b-41d4-a716-446655440001'),
('660e8400-e29b-41d4-a716-446655440008', 'default-tenant', 'Medical Records', 'Patient files and medical documents', '660e8400-e29b-41d4-a716-446655440001'),
('660e8400-e29b-41d4-a716-446655440009', 'default-tenant', 'Financial Documents', 'Bank statements, invoices, receipts', '660e8400-e29b-41d4-a716-446655440001');

-- Insert subcategories for Electronics
INSERT INTO product_categories (id, tenant_id, name, description, parent_id) VALUES
('660e8400-e29b-41d4-a716-446655440010', 'default-tenant', 'Computers', 'Laptops, desktops, and computer accessories', '660e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440011', 'default-tenant', 'Mobile Devices', 'Smartphones, tablets, and accessories', '660e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440012', 'default-tenant', 'Home Appliances', 'TV, refrigerators, washing machines', '660e8400-e29b-41d4-a716-446655440002');

-- Insert sample customers
INSERT INTO customers (id, tenant_id, home_branch_id, code, name, phone, email, address, city, state, postal_code, business_type, credit_limit, pricing_tier) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'default-tenant', '550e8400-e29b-41d4-a716-446655440001', 'CUST001', 'Acme Corporation', '212-555-1001', 'contact@acme.com', '1 Acme Way', 'New York', 'NY', '10001', 'corporate', 50000.00, 'premium'),
('770e8400-e29b-41d4-a716-446655440002', 'default-tenant', '550e8400-e29b-41d4-a716-446655440001', 'CUST002', 'Globex Corporation', '212-555-1002', 'info@globex.com', '2 Globex Plaza', 'New York', 'NY', '10002', 'corporate', 75000.00, 'premium'),
('770e8400-e29b-41d4-a716-446655440003', 'default-tenant', '550e8400-e29b-41d4-a716-446655440002', 'CUST003', 'Stark Industries', '718-555-1003', 'shipping@stark.com', '200 Park Avenue', 'Brooklyn', 'NY', '11201', 'corporate', 100000.00, 'enterprise'),
('770e8400-e29b-41d4-a716-446655440004', 'default-tenant', '550e8400-e29b-41d4-a716-446655440002', 'CUST004', 'Wayne Enterprises', '718-555-1004', 'logistics@wayne.com', '100 Wayne Tower', 'Brooklyn', 'NY', '11201', 'corporate', 150000.00, 'enterprise'),
('770e8400-e29b-41d4-a716-446655440005', 'default-tenant', '550e8400-e29b-41d4-a716-446655440003', 'CUST005', 'John Doe', '718-555-1005', 'johndoe@email.com', '123 Main St', 'Queens', 'NY', '11375', 'individual', 5000.00, 'standard'),
('770e8400-e29b-41d4-a716-446655440006', 'default-tenant', '550e8400-e29b-41d4-a716-446655440004', 'CUST006', 'Small Business LLC', '973-555-1006', 'contact@smallbusiness.com', '456 Business Ave', 'Newark', 'NJ', '07102', 'small_business', 10000.00, 'standard');

-- Insert sample vehicles
INSERT INTO vehicles (id, tenant_id, branch_id, plate_number, make, model, year, vehicle_type, capacity_weight, capacity_volume, status) VALUES
('880e8400-e29b-41d4-a716-446655440001', 'default-tenant', '550e8400-e29b-41d4-a716-446655440001', 'ABC123', 'Ford', 'Transit', 2023, 'van', 1000.00, 15.00, 'available'),
('880e8400-e29b-41d4-a716-446655440002', 'default-tenant', '550e8400-e29b-41d4-a716-446655440001', 'ABC124', 'Mercedes', 'Sprinter', 2023, 'van', 1500.00, 20.00, 'available'),
('880e8400-e29b-41d4-a716-446655440003', 'default-tenant', '550e8400-e29b-41d4-a716-446655440002', 'ABC125', 'Isuzu', 'NQR', 2022, 'truck_medium', 3000.00, 25.00, 'on_trip'),
('880e8400-e29b-41d4-a716-446655440004', 'default-tenant', '550e8400-e29b-41d4-a716-446655440002', 'ABC126', 'Hino', '195', 2022, 'truck_medium', 3500.00, 30.00, 'available'),
('880e8400-e29b-41d4-a716-446655440005', 'default-tenant', '550e8400-e29b-41d4-a716-446655440003', 'ABC127', 'Honda', 'CB500', 2023, 'motorcycle', 50.00, 0.50, 'available'),
('880e8400-e29b-41d4-a716-446655440006', 'default-tenant', '550e8400-e29b-41d4-a716-446655440003', 'ABC128', 'Yamaha', 'MT-07', 2023, 'motorcycle', 60.00, 0.60, 'available'),
('880e8400-e29b-41d4-a716-446655440007', 'default-tenant', '550e8400-e29b-41d4-a716-446655440004', 'ABC129', 'Mack', 'Anthem', 2021, 'truck_large', 8000.00, 50.00, 'maintenance'),
('880e8400-e29b-41d4-a716-446655440008', 'default-tenant', '550e8400-e29b-41d4-a716-446655440004', 'ABC130', 'Volvo', 'VNL', 2021, 'truck_large', 9000.00, 55.00, 'available');

-- Insert sample products
INSERT INTO products (id, tenant_id, category_id, code, name, description, unit_price, weight, length, width, height, handling_requirements, min_stock_level, max_stock_level, current_stock) VALUES
('990e8400-e29b-41d4-a716-446655440001', 'default-tenant', '660e8400-e29b-41d4-a716-446655440007', 'DOC001', 'Standard Document', 'Standard A4 document envelope', 5.00, 0.05, 30.0, 22.0, 1.0, '["standard"]', 100, 1000, 500),
('990e8400-e29b-41d4-a716-446655440002', 'default-tenant', '660e8400-e29b-41d4-a716-446655440007', 'DOC002', 'Legal Document', 'Legal size document envelope', 8.00, 0.08, 35.0, 25.0, 1.0, '["confidential"]', 50, 500, 250),
('990e8400-e29b-41d4-a716-446655440003', 'default-tenant', '660e8400-e29b-41d4-a716-446655440008', 'DOC003', 'Medical Record', 'Patient medical file folder', 12.00, 0.15, 40.0, 30.0, 2.0, '["confidential", "fragile"]', 30, 300, 150),
('990e8400-e29b-41d4-a716-446655440004', 'default-tenant', '660e8400-e29b-41d4-a716-446655440010', 'ELEC001', 'Laptop Computer', '15-inch laptop computer', 1500.00, 2.50, 40.0, 30.0, 5.0, '["fragile", "electronic"]', 10, 100, 45),
('990e8400-e29b-41d4-a716-446655440005', 'default-tenant', '660e8400-e29b-41d4-a716-446655440011', 'ELEC002', 'Smartphone', 'Latest smartphone model', 800.00, 0.20, 16.0, 8.0, 1.0, '["fragile", "electronic"]', 20, 200, 85),
('990e8400-e29b-41d4-a716-446655440006', 'default-tenant', '660e8400-e29b-41d4-a716-446655440012', 'ELEC003', 'LED TV', '55-inch LED television', 1200.00, 15.00, 125.0, 75.0, 8.0, '["fragile", "electronic", "large"]', 5, 50, 20),
('990e8400-e29b-41d4-a716-446655440007', 'default-tenant', '660e8400-e29b-41d4-a716-446655440003', 'FURN001', 'Office Chair', 'Ergonomic office chair', 300.00, 20.00, 70.0, 70.0, 120.0, '["fragile"]', 15, 150, 60),
('990e8400-e29b-41d4-a716-446655440008', 'default-tenant', '660e8400-e29b-41d4-a716-446655440003', 'FURN002', 'Desk', 'Executive office desk', 800.00, 50.00, 180.0, 90.0, 75.0, '["fragile", "large"]', 5, 50, 25),
('990e8400-e29b-41d4-a716-446655440009', 'default-tenant', '660e8400-e29b-41d4-a716-446655440004', 'CLOTH001', 'T-Shirt', 'Cotton t-shirt', 25.00, 0.20, 30.0, 25.0, 2.0, '["foldable"]', 100, 1000, 450),
('990e8400-e29b-41d4-a716-446655440010', 'default-tenant', '660e8400-e29b-41d4-a716-446655440005', 'FOOD001', 'Fresh Produce Box', 'Box of fresh vegetables', 50.00, 10.00, 50.0, 40.0, 40.0, '["perishable", "refrigerated"]', 20, 200, 90),
('990e8400-e29b-41d4-a716-446655440011', 'default-tenant', '660e8400-e29b-41d4-a716-446655440006', 'IND001', 'Industrial Pump', 'Heavy duty industrial pump', 5000.00, 500.00, 150.0, 100.0, 120.0, '["heavy", "hazardous"]', 2, 20, 8);

-- Insert sample pricing rules
INSERT INTO pricing_rules (id, tenant_id, name, service_type, zone_origin, zone_destination, base_price, price_per_km, price_per_kg, fuel_surcharge_percent) VALUES
('AA0e8400-e29b-41d4-a716-446655440001', 'default-tenant', 'Standard Delivery', 'standard', 'NYC', 'NYC', 10.00, 2.00, 0.50, 15.00),
('AA0e8400-e29b-41d4-a716-446655440002', 'default-tenant', 'Express Delivery', 'express', 'NYC', 'NYC', 20.00, 3.00, 1.00, 20.00),
('AA0e8400-e29b-41d4-a716-446655440003', 'default-tenant', 'Economy Delivery', 'economy', 'NYC', 'NYC', 5.00, 1.00, 0.30, 10.00),
('AA0e8400-e29b-41d4-a716-446655440004', 'default-tenant', 'Standard Inter-state', 'standard', 'NY', 'NJ', 50.00, 5.00, 2.00, 18.00),
('AA0e8400-e29b-41d4-a716-446655440005', 'default-tenant', 'Freight Service', 'freight', 'ANY', 'ANY', 100.00, 10.00, 5.00, 25.00);

-- Insert sample service zones
INSERT INTO service_zones (id, tenant_id, code, name, description, coverage_areas) VALUES
('BB0e8400-e29b-41d4-a716-446655440001', 'default-tenant', 'NYC-MAN', 'Manhattan', 'Manhattan area coverage', '{"postal_codes": ["10001", "10002", "10003", "10004", "10005"], "coordinates": []}'),
('BB0e8400-e29b-41d4-a716-446655440002', 'default-tenant', 'NYC-BKN', 'Brooklyn', 'Brooklyn area coverage', '{"postal_codes": ["11201", "11202", "11203", "11204", "11205"], "coordinates": []}'),
('BB0e8400-e29b-41d4-a716-446655440003', 'default-tenant', 'NYC-QUEENS', 'Queens', 'Queens area coverage', '{"postal_codes": ["11375", "11354", "11355", "11356", "11357"], "coordinates": []}'),
('BB0e8400-e29b-41d4-a716-446655440004', 'default-tenant', 'NJ-NEWARK', 'Newark NJ', 'Newark area coverage', '{"postal_codes": ["07102", "07103", "07104", "07105", "07106"], "coordinates": []}'),
('BB0e8400-e29b-41d4-a716-446655440005', 'default-tenant', 'TRI-STATE', 'Tri-State Area', 'NYC Tri-state area coverage', '{"states": ["NY", "NJ", "CT"], "coordinates": []}');