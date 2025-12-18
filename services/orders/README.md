# Logistics ERP Orders Service

A FastAPI-based microservice for managing orders in the Logistics ERP system.

## Features

- Order management with full CRUD operations
- Order status workflow (Draft → Submitted → Finance → Logistics → Driver)
- Document management and verification
- Multi-tenant support
- Authentication and authorization integration
- RESTful API with OpenAPI documentation
- PostgreSQL database with SQLAlchemy ORM
- Redis caching
- Docker containerization

## Quick Start

### Prerequisites

- Python 3.13+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. Clone the repository:
```bash
cd services/orders
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -e .
```

4. Copy environment variables:
```bash
cp .env.example .env
```

5. Update the `.env` file with your configuration

6. Run database migrations:
```bash
psql -h localhost -U postgres -d logistics_erp -f scripts/init-orders-schema.sql
```

7. Start the service:
```bash
python -m src.main
```

### Docker Compose

```bash
docker-compose up -d
```

## API Documentation

Once the service is running, you can access:
- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc
- OpenAPI JSON: http://localhost:8002/openapi.json

## API Endpoints

### Orders

- `GET /api/v1/orders/` - List orders with filtering and pagination
- `GET /api/v1/orders/{order_id}` - Get order by ID
- `POST /api/v1/orders/` - Create new order
- `PUT /api/v1/orders/{order_id}` - Update order
- `DELETE /api/v1/orders/{order_id}` - Delete order (soft delete)
- `POST /api/v1/orders/{order_id}/submit` - Submit order for finance approval
- `POST /api/v1/orders/{order_id}/finance-approval` - Approve/reject in finance
- `POST /api/v1/orders/{order_id}/logistics-approval` - Approve/reject in logistics
- `PATCH /api/v1/orders/{order_id}/status` - Update order status
- `GET /api/v1/orders/{order_id}/history` - Get order status history
- `POST /api/v1/orders/{order_id}/cancel` - Cancel order

### Order Documents

- `GET /api/v1/orders/{order_id}/documents` - List order documents
- `POST /api/v1/orders/{order_id}/documents` - Upload document
- `GET /api/v1/orders/documents/{document_id}` - Get document by ID
- `PUT /api/v1/orders/documents/{document_id}` - Update document
- `DELETE /api/v1/orders/documents/{document_id}` - Delete document
- `POST /api/v1/orders/documents/{document_id}/verify` - Verify document
- `GET /api/v1/orders/documents/{document_id}/download` - Download document

### Health & Monitoring

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics

## Order Status Flow

```
DRAFT
  ↓
SUBMITTED
  ↓
FINANCE_APPROVED ←→ FINANCE_REJECTED
  ↓
LOGISTICS_APPROVED ←→ LOGISTICS_REJECTED
  ↓
ASSIGNED
  ↓
PICKED_UP
  ↓
IN_TRANSIT
  ↓
DELIVERED
```

## Configuration

The service can be configured through environment variables. See `.env.example` for all available options.

### Key Configuration

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `AUTH_SERVICE_URL`: Authentication service endpoint
- `JWT_SECRET_KEY`: Secret key for JWT tokens
- `CORS_ORIGINS`: Allowed CORS origins
- `MAX_FILE_SIZE`: Maximum file upload size (bytes)

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black src/
isort src/
```

### Type Checking

```bash
mypy src/
```

## Architecture

```
src/
├── api/
│   └── endpoints/          # API route handlers
│       ├── orders.py       # Order endpoints
│       └── order_documents.py  # Document endpoints
├── models/                 # SQLAlchemy models
│   ├── order.py           # Order model
│   ├── order_item.py      # Order item model
│   ├── order_document.py  # Document model
│   └── order_status_history.py  # Status history model
├── schemas/               # Pydantic schemas
│   ├── order.py          # Order schemas
│   ├── order_item.py     # Order item schemas
│   └── order_document.py # Document schemas
├── services/             # Business logic
│   ├── order_service.py  # Order service
│   └── order_document_service.py  # Document service
├── utils/                # Utilities
│   ├── auth.py          # Authentication utilities
│   ├── dependencies.py  # FastAPI dependencies
│   └── file_handler.py  # File handling utilities
├── database.py          # Database configuration
├── main.py              # FastAPI application
└── config_local.py      # Local configuration
```

## Monitoring

The service includes:
- Prometheus metrics endpoint
- Health check endpoints
- Structured logging
- OpenTelemetry tracing support

## License

© 2024 Logistics ERP Team. All rights reserved.