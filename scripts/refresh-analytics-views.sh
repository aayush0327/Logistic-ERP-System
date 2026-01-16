#!/bin/bash
# Analytics Materialized Views Refresh Script
#
# This script refreshes all analytics materialized views.
# Schedule this to run periodically (e.g., every hour via cron)
#
# Usage: ./refresh-analytics-views.sh
#
# Cron example (every hour at minute 5):
# 5 * * * * /path/to/scripts/refresh-analytics-views.sh

set -e

# Database connection settings
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_COMPANY_DB:-company_db}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting analytics views refresh..."

# Refresh each materialized view concurrently
echo "Refreshing mv_order_status_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_status_summary;"

echo "Refreshing mv_trip_status_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_status_summary;"

echo "Refreshing mv_driver_status_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_driver_status_summary;"

echo "Refreshing mv_vehicle_status_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_status_summary;"

echo "Refreshing mv_order_lifecycle_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_lifecycle_summary;"

echo "Refreshing mv_trip_lifecycle_summary..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_lifecycle_summary;"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Analytics views refresh completed successfully."

# Optional: Vacuum analyze for better query planning
# echo "Running VACUUM ANALYZE on audit_logs..."
# psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
#     "VACUUM ANALYZE audit_logs;"
