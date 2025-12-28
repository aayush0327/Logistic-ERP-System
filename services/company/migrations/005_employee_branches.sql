-- Employee Multiple Branch Assignment Migration
-- This file adds support for employees to be assigned to multiple branches
-- Run this script after the user role management migration (002_user_role_management.sql)

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_branches_tenant ON employee_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_employee ON employee_branches(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_branch ON employee_branches(branch_id);

-- Add comments for documentation
COMMENT ON TABLE employee_branches IS 'Junction table for many-to-many relationship between employees and branches';
COMMENT ON COLUMN employee_branches.assigned_at IS 'Timestamp when the employee was assigned to this branch';
COMMENT ON COLUMN employee_branches.assigned_by IS 'User ID of the person who made this assignment';

-- Enable Row Level Security
ALTER TABLE employee_branches ENABLE ROW LEVEL SECURITY;

-- RLS Policies (commented out until authentication is properly integrated)
/*
CREATE POLICY employee_branches_tenant_policy ON employee_branches
    FOR ALL TO authenticated_users
    USING (tenant_id = current_tenant_id());
*/

-- Trigger for updated_at (if needed in future)
-- CREATE TRIGGER update_employee_branches_updated_at BEFORE UPDATE ON employee_branches
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
