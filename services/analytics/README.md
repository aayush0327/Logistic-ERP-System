# Logistics ERP Analytics Service

## Overview

The Analytics Service provides comprehensive operational analytics for the Logistics ERP system. It aggregates data from multiple databases (Company, Orders, TMS) using centralized audit logs as the source of truth for status change tracking.

## Features

### Order Analytics
- **Status Counts**: Number of orders in each status (draft, submitted, approved, assigned, in transit, delivered, cancelled)
- **Status Durations**: Average, min, max, and median time spent in each order status
- **Lifecycle Times**: Total time from order creation to delivery/cancellation
- **Bottleneck Detection**: Identifies orders stuck in a status longer than threshold

### Trip Analytics
- **Status Counts**: Number of trips in each status (planning, loading, on-route, paused, completed, cancelled)
- **Status Durations**: Time spent by trips in each status
- **Pause Tracking**: Total pause time with count and average duration
- **Inefficiency Detection**: Identifies planning, loading, and route delays

### Driver Analytics
- **Status Counts**: Number of drivers in each status (available, assigned, on_trip, off_duty, on_leave, suspended)
- **Utilization Metrics**: Time spent in each status with utilization percentage
- **Availability Impact**: Correlation between driver availability and trip delays

### Truck/Vehicle Analytics
- **Status Counts**: Number of trucks in each status (available, assigned, on_trip, maintenance, out_of_service)
- **Utilization Metrics**: Time spent in each status with utilization percentage
- **Maintenance Impact**: Trips affected by vehicle maintenance periods

### Dashboard Summary
- Executive KPIs across all entities
- Configurable date ranges (Today, 7 days, 30 days, Custom)
- High-level metrics for operations teams

### Entity Timeline
- Drill-down view for individual entities
- Complete status change history
- Duration between status transitions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Analytics Service                         │
│                  (Port 8008)                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Orders    │  │    Trips    │  │   Drivers   │        │
│  │  Analytics  │  │  Analytics  │  │  Analytics  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Trucks    │  │  Dashboard  │  │   Entity    │        │
│  │  Analytics  │  │  Summary    │  │  Timeline   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │ Company │          │ Orders  │          │   TMS   │
    │    DB   │          │   DB    │          │   DB    │
    │(audit   │          │         │          │         │
    │ _logs)  │          │         │          │         │
    └─────────┘          └─────────┘          └─────────┘
```

## API Endpoints

### Orders
- `GET /api/v1/analytics/orders/status-counts` - Order counts by status
- `GET /api/v1/analytics/orders/status-durations` - Time in each status
- `GET /api/v1/analytics/orders/lifecycle-times` - Order lifecycle metrics
- `GET /api/v1/analytics/orders/bottlenecks` - Stuck order detection

### Trips
- `GET /api/v1/analytics/trips/status-counts` - Trip counts by status
- `GET /api/v1/analytics/trips/status-durations` - Time in each status
- `GET /api/v1/analytics/trips/pauses` - Pause duration tracking
- `GET /api/v1/analytics/trips/inefficiencies` - Delay detection

### Drivers
- `GET /api/v1/analytics/drivers/status-counts` - Driver counts by status
- `GET /api/v1/analytics/drivers/utilization` - Driver utilization metrics
- `GET /api/v1/analytics/drivers/availability-impact` - Availability vs delays

### Trucks
- `GET /api/v1/analytics/trucks/status-counts` - Truck counts by status
- `GET /api/v1/analytics/trucks/utilization` - Truck utilization metrics
- `GET /api/v1/analytics/trucks/maintenance-impact` - Maintenance vs performance

### Dashboard
- `GET /api/v1/analytics/dashboard/summary` - Executive dashboard KPIs
- `GET /api/v1/analytics/dashboard/timeline/{entity_type}/{entity_id}` - Entity drill-down

### Query Parameters

All endpoints support:
- `preset`: `today` | `last_7_days` | `last_30_days` | `custom` (default: `last_7_days`)
- `date_from`: Custom start date (required when preset=`custom`)
- `date_to`: Custom end date (required when preset=`custom`)

Example:
```
GET /api/v1/analytics/orders/status-counts?preset=last_30_days
GET /api/v1/analytics/orders/status-counts?preset=custom&date_from=2026-01-01T00:00:00Z&date_to=2026-01-15T23:59:59Z
```

## Database Optimization

### Materialized Views

Pre-aggregated views for performance:
- `mv_order_status_summary` - Daily order status counts
- `mv_trip_status_summary` - Daily trip status counts
- `mv_driver_status_summary` - Daily driver status counts
- `mv_vehicle_status_summary` - Daily vehicle status counts
- `mv_order_lifecycle_summary` - Order lifecycle metrics
- `mv_trip_lifecycle_summary` - Trip lifecycle metrics

Refresh views hourly:
```bash
./scripts/refresh-analytics-views.sh
```

### Performance Indexes

Specialized indexes for analytics queries:
- `idx_audit_logs_analytics_orders` - Order status queries
- `idx_audit_logs_analytics_trips` - Trip status queries
- `idx_audit_logs_analytics_drivers` - Driver status queries
- `idx_audit_logs_analytics_vehicles` - Vehicle status queries
- `idx_audit_logs_status_transitions` - Duration calculations
- `idx_audit_logs_bottleneck_detection` - Stuck entity detection

## Development

### Setup
```bash
cd services/analytics
pip install uv
uv sync
```

### Run Locally
```bash
uv run uvicorn src.main:app --reload --port 8008
```

### Run Tests
```bash
uv run pytest
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_COMPANY_DB` | Company database name | `company_db` |
| `POSTGRES_ORDERS_DB` | Orders database name | `orders_db` |
| `POSTGRES_TMS_DB` | TMS database name | `tms_db` |
| `REDIS_HOST` | Redis host | `redis` |
| `PORT` | Service port | `8008` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

## Status Definitions

### Order Statuses (Independent)
- `draft`, `submitted`, `finance_approved`, `finance_rejected`
- `logistics_approved`, `logistics_rejected`, `assigned`
- `picked_up`, `in_transit`, `partial_in_transit`
- `partial_delivered`, `delivered`, `cancelled`

### Trip Statuses (Independent)
- `planning`, `loading`, `on-route`, `paused`
- `completed`, `cancelled`, `truck-malfunction`

### Driver Statuses (Independent)
- `available`, `assigned`, `on_trip`, `off_duty`
- `on_leave`, `suspended`

### Truck Statuses (Independent)
- `available`, `assigned`, `on_trip`, `maintenance`
- `out_of_service`

**Important**: Status values MUST NOT be mixed between entities. Each entity type has its own independent status lifecycle.

## Metrics

Prometheus metrics available at `/metrics`:
- `analytics_http_requests_total` - Total HTTP requests
- `analytics_http_request_duration_seconds` - Request duration
- `analytics_queries_total` - Analytics query counts

## Health Checks

- `/health` - Service health status
- `/ready` - Readiness check (includes database connectivity)
- `/metrics` - Prometheus metrics
- `/docs` - API documentation (Swagger UI)
