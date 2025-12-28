# Foreign Key Constraint Fixes

This document describes the fixes implemented to resolve foreign key constraint violations in the Logistics ERP system.

## Problem Description

The system was encountering errors like:
```
insert or update on table 'employee_profiles' violates foreign key constraint 'employee_profiles_branch_id_fkey'
Key (branch_id)=(3fa85f64-5717-4562-b3fc-2c963f66afa6) is not present in table 'branches'.
```

This occurred when trying to create or update employee profiles with branch_id values that don't exist in the branches table.

## Root Causes Identified

1. **Missing validation in endpoints**: The API endpoints were not validating foreign key references before insertion/update
2. **No helper functions for validation**: Each endpoint was implementing its own validation logic
3. **Inconsistent error handling**: Different endpoints had different approaches to handling FK violations

## Implemented Solutions

### 1. Created Validation Helper Functions (`src/helpers/validators.py`)

- `validate_branch_exists()`: Validates that a branch exists for the given tenant
- `validate_role_exists()`: Validates that a company role exists
- `validate_employee_exists()`: Validates that an employee profile exists
- `validate_category_exists()`: Validates that a product category exists
- `validate_customer_exists()`: Validates that a customer exists
- `validate_product_exists()`: Validates that a product exists
- `validate_employee_reporting_hierarchy()`: Prevents circular references in reporting hierarchy

### 2. Updated Endpoints with Proper Validation

#### `users.py`:
- Added branch validation in `create_user()`
- Added branch validation in `update_user()`
- Added branch validation in `invite_user()`
- Added branch and role validation in `update_invitation()`
- Added reporting hierarchy validation to prevent circular references

#### `customers.py`:
- Updated to use helper functions for branch validation

#### `vehicles.py`:
- Updated to use helper functions for branch validation

#### `products.py`:
- Updated to use helper functions for category and branch validation

#### `profiles.py`:
- Updated to use helper functions for employee and branch validation

### 3. Created Migration Script (`src/scripts/fix_fk_constraints.py`)

A script to identify and fix existing orphaned records in the database. It can:
- Scan for orphaned records
- Fix them by either nullifying invalid FKs or deleting the records
- Provide detailed logging of the fix process

## Usage

### Running the Migration Script

```bash
cd services/company
python -m src.scripts.fix_fk_constraints
```

The script will:
1. Scan all tables for FK violations
2. Report the violations found
3. Fix them using the appropriate strategy
4. Verify all violations are resolved

### Using the Validation Helpers

In your endpoints, import the validators:

```python
from src.helpers import validate_branch_exists, validate_role_exists

# Then use them in your endpoint functions
try:
    await validate_branch_exists(db, branch_id, tenant_id)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
```

## Model Changes

The database models were already correctly defined with nullable foreign keys where appropriate. No model changes were required.

## Best Practices Added

1. **Always validate foreign keys** before using them in create/update operations
2. **Use tenant-scoped queries** to ensure data isolation
3. **Provide clear error messages** that help identify the issue
4. **Use helper functions** to avoid code duplication
5. **Check for circular references** in hierarchical relationships

## Testing Recommendations

1. Test creating users with non-existent branch IDs (should fail gracefully)
2. Test updating users with invalid branch IDs (should fail gracefully)
3. Test the migration script on a copy of production data
4. Verify that tenant isolation is maintained

## Future Considerations

1. Consider adding database-level triggers for additional validation
2. Implement soft deletes to maintain referential integrity
3. Add more comprehensive logging for FK violations
4. Consider implementing a cache for frequently referenced entities