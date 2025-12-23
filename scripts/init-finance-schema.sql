-- Finance Service Database Schema Initialization
-- This file will be executed after the main schemas are created

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create finance approval actions table
CREATE TABLE IF NOT EXISTS approval_actions (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    approval_type VARCHAR(20) NOT NULL DEFAULT 'finance',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    order_amount NUMERIC(12, 2),
    approved_amount NUMERIC(12, 2),
    approver_id VARCHAR(50),
    approver_name VARCHAR(100),
    approval_reason TEXT,
    rejection_reason TEXT,
    customer_id VARCHAR(50),
    customer_name VARCHAR(200),
    order_priority VARCHAR(20),
    payment_type VARCHAR(20),
    requested_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create approval audit trail table
CREATE TABLE IF NOT EXISTS approval_audit (
    id SERIAL PRIMARY KEY,
    approval_action_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    user_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    reason TEXT,
    notes TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_approval_actions_tenant_id ON approval_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_order_id ON approval_actions(order_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_status ON approval_actions(status);
CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_type ON approval_actions(approval_type);
CREATE INDEX IF NOT EXISTS idx_approval_actions_approver_id ON approval_actions(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_customer_id ON approval_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_created_at ON approval_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_approval_actions_is_active ON approval_actions(is_active);

CREATE INDEX IF NOT EXISTS idx_approval_audit_approval_action_id ON approval_audit(approval_action_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_user_id ON approval_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_created_at ON approval_audit(created_at);

-- Create triggers to update updated_at
CREATE TRIGGER update_approval_actions_updated_at BEFORE UPDATE ON approval_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraints (commented out as they may not be needed with multi-service architecture)
-- ALTER TABLE approval_audit ADD CONSTRAINT fk_approval_audit_approval_action_id FOREIGN KEY (approval_action_id) REFERENCES approval_actions(id) ON DELETE CASCADE;

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create an index for composite queries
CREATE INDEX IF NOT EXISTS idx_approval_actions_tenant_status ON approval_actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_actions_tenant_order ON approval_actions(tenant_id, order_id);