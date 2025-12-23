#!/bin/bash
set -e

# Create all required databases for the Logistics ERP system
echo "Creating databases..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create core databases
    CREATE DATABASE auth_db;
    CREATE DATABASE company_db;
    CREATE DATABASE orders_db;
    CREATE DATABASE wms_db;
    CREATE DATABASE tms_db;
    CREATE DATABASE billing_db;
    CREATE DATABASE finance_db;
    CREATE DATABASE telemetry_db;

    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE auth_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE company_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE orders_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE wms_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE tms_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE billing_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE finance_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE telemetry_db TO $POSTGRES_USER;
EOSQL

# Initialize auth database schema
echo "Initializing auth database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "auth_db" -f /docker-entrypoint-initdb.d/02-auth-schema.sql

# Initialize orders database schema
echo "Initializing orders database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "orders_db" -f /docker-entrypoint-initdb.d/03-orders-schema.sql
echo "Database initialization complete!"+
# Initialize TMS database schema
echo "Initializing TMS database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tms_db" -f /docker-entrypoint-initdb.d/03-tms-schema.sql

# Initialize company database schema
echo "Initializing company database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "company_db" -f /docker-entrypoint-initdb.d/04-company-schema.sql

# Initialize finance database schema
echo "Initializing finance database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "finance_db" -f /docker-entrypoint-initdb.d/05-finance-schema.sql

echo "Database initialization complete!"
