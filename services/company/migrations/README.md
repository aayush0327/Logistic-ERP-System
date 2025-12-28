# Company Service Migrations

This directory contains migration files for the Company Service database.

## User Role Management Migration

### Overview
The user role management migration adds tables to support employee management, role-based access control, and user invitation system.

### Files
- `002_user_role_management.sql` - Creates tables for user role management
- `003_default_company_roles.sql` - Inserts default company roles
- `run_user_role_migration.py` - Python script to run the migration

### Tables Created

1. **company_roles** - Defines roles within a company with permissions
2. **user_invitations** - Tracks user invitations sent by company admins
3. **employee_profiles** - Basic employee information
4. **driver_profiles** - Driver-specific information
5. **finance_manager_profiles** - Finance manager specific data
6. **branch_manager_profiles** - Branch manager specific data
7. **logistics_manager_profiles** - Logistics manager specific data
8. **employee_documents** - Document management for employees

### Default Roles

The following default roles are created:
- `company_admin` - Full access to all company operations
- `finance_manager` - Manages financial operations
- `branch_manager` - Manages branch operations
- `logistics_manager` - Manages transportation and routing
- `driver` - Handles vehicle operations and deliveries

### Running the Migration

#### Option 1: Using Python Script (Recommended)

```bash
# Run the migration
python run_user_role_migration.py

# Check if migration has been applied
python run_user_role_migration.py --check

# Rollback migration (for development only)
python run_user_migration.py --rollback
```

#### Option 2: Manual SQL Execution

1. Execute the user role management migration:
   ```sql
   \i 002_user_role_management.sql
   ```

2. Insert default roles:
   ```sql
   \i 003_default_company_roles.sql
   ```

### Prerequisites

- PostgreSQL database should be running
- Company database should be created (using the main migrations.py)
- Ensure you have the necessary permissions to create tables

### ID Notes

- Primary keys use VARCHAR(36) for compatibility with existing system
- The system uses UUIDs but stores them as VARCHAR to maintain consistency
- Tenant IDs use VARCHAR(255) with 'default-tenant' as the default value

### Security Features

- Row Level Security (RLS) is enabled on all tables
- RLS policies are commented out until authentication is properly integrated
- All tables include tenant_id for multi-tenancy support

### Foreign Key Relationships

- The system references the auth service for user management
- Branch IDs reference the existing branches table
- Role management is self-contained within the company service

### Document Storage

The employee_documents table supports both:
- Local file storage (file_path)
- Cloud storage URLs (file_url)

This allows flexibility in document storage strategies.

### Extending for New Tenants

To create roles for a new tenant:
1. Copy the template from `003_default_company_roles.sql`
2. Replace 'NEW-TENANT-ID' with the actual tenant ID
3. Execute the modified SQL script