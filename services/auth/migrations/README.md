# Auth Service Database Migrations

This directory contains SQL migrations for setting up the Auth Service database.

## Migration Files

1. **001_initial_schema.sql** - Creates the basic database schema:
   - `tenants` - Multi-tenant support
   - `roles` - Role-based access control (RBAC)
   - `permissions` - System permissions
   - `role_permissions` - Role-permission associations
   - `users` - User accounts
   - `refresh_tokens` - JWT refresh token storage

2. **002_default_permissions.sql** - Inserts default permissions for the system:
   - User management permissions
   - Role management permissions
   - Order management permissions
   - Inventory management permissions
   - Customer/supplier management permissions
   - Shipping permissions
   - Reporting permissions
   - System permissions

3. **003_default_admin.sql** - Creates default system setup:
   - Default tenant
   - Admin, Manager, and Employee roles
   - Default admin user (email: admin@example.com, password: admin123)
   - Demo manager user (email: manager@example.com, password: manager123)
   - Demo employee user (email: employee@example.com, password: employee123)

## Running Migrations

### Using Python Script

The recommended way to run migrations is using the Python script:

```bash
# Run all pending migrations
python run_migrations.py

# Or explicitly
python run_migrations.py migrate

# Reset database (WARNING: This deletes all data!)
python run_migrations.py reset
```

### Manual Execution

You can also run the SQL files manually using psql:

```bash
psql -h localhost -U postgres -d auth_db -f 001_initial_schema.sql
psql -h localhost -U postgres -d auth_db -f 002_default_permissions.sql
psql -h localhost -U postgres -d auth_db -f 003_default_admin.sql
```

## Default Users

After running the migrations, you'll have these default users:

1. **Administrator**
   - Email: admin@example.com
   - Password: admin123
   - Role: Administrator (full access)

2. **Demo Manager**
   - Email: manager@example.com
   - Password: manager123
   - Role: Manager (business-level access)

3. **Demo Employee**
   - Email: employee@example.com
   - Password: employee123
   - Role: Employee (basic access)

⚠️ **Important**: Change these default passwords immediately after first login!

## Security Notes

- Passwords are hashed using bcrypt
- The database uses Row Level Security (RLS) for PostgreSQL
- JWT tokens include user permissions for efficient authorization checks
- Login attempts are tracked and accounts can be locked after failed attempts