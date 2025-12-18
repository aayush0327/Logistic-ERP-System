# Logistics ERP - Developer Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Development Setup](#development-setup)
4. [Manual Deployment](#manual-deployment)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

## Architecture Overview

### System Design

The Logistics ERP is a **multi-tenant microservices architecture** designed to handle logistics operations at scale. The system is built around the following principles:

- **Service Isolation**: Each business domain (Auth, Orders, WMS, TMS, Billing) is a separate microservice
- **Database per Service**: Each microservice has its own PostgreSQL database for isolation
- **Event-Driven**: Services communicate via Apache Kafka for loose coupling
- **Containerized**: All services run in Docker containers
- **Observability**: Built-in logging, metrics, and distributed tracing

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│                   (Next.js + React)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
│                 (Authentication + Routing)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌──────────────┐
│   Auth    │ │  Orders   │ │     WMS      │
│  Service  │ │ Service   │ │   Service    │
└───────────┘ └───────────┘ └──────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Event Bus (Kafka)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               PostgreSQL (Single Instance)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Auth DB   │ │ Orders DB   │ │     WMS DB          │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │   TMS DB    │ │ Billing DB  │                           │
│  └─────────────┘ └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies

#### Backend Services
- **FastAPI**: Modern, fast web framework for building APIs with Python
- **SQLAlchemy**: ORM for database operations with async support
- **Alembic**: Database migration tool
- **Pydantic**: Data validation using Python type annotations
- **JWT & Refresh Tokens**: Stateless authentication with automatic token refresh
- **Kafka-Python**: Apache Kafka producer and consumer

#### Infrastructure
- **PostgreSQL**: Single instance with multiple databases for resource efficiency
  - Each service has its own database within the same PostgreSQL instance
  - Databases: auth_db, orders_db, wms_db, tms_db, billing_db
  - Maintains data isolation while optimizing resource usage
- **TimescaleDB**: Separate PostgreSQL extension for time-series telemetry data
- **Redis**: In-memory caching and session storage
- **Kafka**: Distributed event streaming platform
- **Elasticsearch**: Full-text search and log aggregation
- **MinIO**: S3-compatible object storage for documents

#### Observability
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Metrics visualization dashboards
- **Jaeger**: Distributed tracing for microservices
- **ELK Stack**: Elasticsearch, Logstash, Kibana for centralized logging

## File Structure

```
LogisticERPSystem/
│
├── config/                        # Global configuration
│   └── settings.py               # Centralized settings with Pydantic
│
├── shared/                       # Shared utilities across services
│   ├── exceptions.py            # Custom exception classes
│   ├── logging.py               # Structured logging configuration
│   ├── metrics.py               # Prometheus metrics collection
│   └── tracing.py               # OpenTelemetry distributed tracing
│
├── services/                     # Microservices
│   └── auth/                     # Authentication Service
│       ├── pyproject.toml        # Poetry dependencies
│       └── src/
│           ├── __init__.py
│           ├── api/             # API endpoints
│           │   └── endpoints/
│           │       ├── __init__.py
│           │       ├── auth.py  # Auth endpoints
│           │       ├── users.py # User management
│           │       └── tenants.py # Tenant management
│           ├── config.py        # Service-specific config
│           ├── database.py      # Database models and connection
│           ├── schemas.py       # Pydantic models for API
│           ├── services/        # Business logic
│           │   ├── auth_service.py
│           │   └── user_service.py
│           └── main.py          # FastAPI application entry point
│
├── gateway/                      # API Gateway (to be implemented)
│   ├── Dockerfile
│   ├── main.py                  # Gateway entry point
│   └── routes/                  # Route definitions per service
│
├── frontend/                     # Next.js Frontend
│   ├── src/                     # Source code
│   │   ├── components/          # Reusable React components
│   │   ├── pages/              # Next.js pages (file-based routing)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client services
│   │   ├── store/              # Redux store
│   │   └── utils/              # Utility functions
│   ├── public/                  # Static assets
│   └── package.json
│
├── k8s/                         # Kubernetes manifests
│   ├── configmaps/             # Configuration data
│   ├── secrets/                # Sensitive data
│   ├── deployments/            # Service deployments
│   ├── services/               # Service exposure
│   └── ingress/                # External access
│
├── scripts/                     # Utility scripts
│   ├── setup-dev.sh            # Unix setup script
│   └── setup-dev.bat           # Windows setup script
│
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── .pre-commit-config.yaml      # Pre-commit hooks
├── docker-compose.yml           # Local development
├── docker-compose.prod.yml      # Production environment
├── pyproject.toml              # Python project configuration
└── README.md                   # Project documentation
```

### Service Structure Pattern

Each microservice follows this consistent structure:

```
service-name/
├── pyproject.toml       # Dependencies and project metadata
├── Dockerfile           # Container definition
├── src/
│   ├── __init__.py
│   ├── main.py          # FastAPI app entry point
│   ├── config.py        # Service-specific settings
│   ├── database.py      # SQLAlchemy models
│   ├── schemas.py       # Pydantic models
│   ├── api/
│   │   └── endpoints/   # Route handlers
│   └── services/        # Business logic layer
├── tests/               # Unit and integration tests
├── alembic/            # Database migrations
└── migrations/         # Generated migration files
```

## Development Setup

### Prerequisites

1. **Python 3.13+**
   ```bash
   # Verify installation
   python --version
   ```

2. **Node.js 20+**
   ```bash
   # Verify installation
   node --version
   npm --version
   ```

3. **Docker & Docker Compose**
   ```bash
   # Verify installation
   docker --version
   docker-compose --version
   ```

4. **PostgreSQL Client** (optional, for direct database access)
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install postgresql-client

   # On macOS
   brew install postgresql
   ```

### Manual Setup Process

#### Step 1: Clone the Repository
```bash
git clone https://github.com/your-org/logistics-erp.git
cd logistics-erp
```

#### Step 2: Set Up Python Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Unix/macOS:
source .venv/bin/activate

# Install Poetry (if not installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install
```

#### Step 3: Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env  # or use your favorite editor
```

Key variables to configure:
```bash
# Database
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_secure_password

# Application
JWT_SECRET=your_jwt_secret_key
ENV=development

# Services
REDIS_URL=redis://localhost:6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

#### Step 4: Start Infrastructure Services

```bash
# Start all infrastructure services
docker-compose up -d

# Verify all services are running
docker-compose ps

# View logs if needed
docker-compose logs -f
```

Expected services:
- PostgreSQL (ports 5432-5437 for different databases)
- Redis (port 6379)
- Kafka (port 9092)
- Zookeeper (port 2181)
- Elasticsearch (port 9200)
- MinIO (ports 9000-9001)

#### Step 5: Initialize Databases

```bash
# Wait for databases to be ready (10-15 seconds)
sleep 15

# Initialize Auth database
cd services/auth
poetry run alembic upgrade head
cd ../..

# Initialize other service databases (repeat for each service)
# cd services/orders
# poetry run alembic upgrade head
# cd ../..
```

#### Step 6: Run Services Individually

**Terminal 1 - Auth Service (with auto-reload):**
```bash
cd services/auth
poetry run python -m src.main
# OR use uvicorn with reload for development:
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 8001
```

**Note**: The auth service Docker container is configured with auto-reload. When running with Docker Compose, code changes will automatically reload the service.

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Terminal 3 - Other Services:**
```bash
cd services/orders  # or wms, tms, billing
poetry run python -m src.main
```

#### Step 7: Verify Everything Works

- Frontend: http://localhost:3000
- Auth Service API: http://localhost:8001/docs
- Kafka UI: http://localhost:8080

## Manual Deployment

### Production Deployment

#### Step 1: Prepare Environment

```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
# IMPORTANT: Use secure passwords and secrets!
```

#### Step 2: Build and Push Images

```bash
# Build Auth service image
cd services/auth
docker build -t logistics-erp/auth-service:latest .

# Repeat for each service
# cd ../orders
# docker build -t logistics-erp/order-service:latest .
```

#### Step 3: Deploy Infrastructure

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d
```

#### Step 4: Configure Load Balancer

If using Nginx:
```nginx
upstream api_gateway {
    server gateway:80;
}

server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}
```

### Kubernetes Deployment

#### Step 1: Prepare Kubernetes Manifests

```bash
# Create namespace
kubectl create namespace logistics-erp

# Apply secrets (create from .env)
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  --namespace=logistics-erp

# Apply configuration
kubectl apply -f k8s/configmaps/ --namespace=logistics-erp
kubectl apply -f k8s/deployments/ --namespace=logistics-erp
kubectl apply -f k8s/services/ --namespace=logistics-erp
```

#### Step 2: Configure Ingress

```yaml
# k8s/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: logistics-erp-ingress
  namespace: logistics-erp
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: logistics-erp-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway-service
            port:
              number: 80
```

## Development Workflow

### 1. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make your changes
# ...

# Run linting
black .
isort .
flake8 .

# Run tests
poetry run pytest

# Commit changes
git add .
git commit -m "feat: add new feature"
```

### 2. Database Migrations

```bash
# Create new migration
cd services/auth
poetry run alembic revision --autogenerate -m "Add new table"

# Review generated migration
# Edit if necessary

# Apply migration
poetry run alembic upgrade head

# To rollback
poetry run alembic downgrade -1
```

### 3. Adding New Service

1. Create service directory: `services/new-service/`
2. Copy structure from `services/auth/`
3. Update `pyproject.toml` with specific dependencies
4. Configure database in `docker-compose.yml`
5. Add service to CI/CD pipeline

### 4. Local Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=html

# Run specific test
poetry run pytest tests/test_auth.py

# Run integration tests
poetry run pytest -m integration
```

## Authentication

### Overview

The authentication system provides secure access control with the following features:

- **JWT Access Tokens**: Short-lived tokens (24 hours) for API access
- **Refresh Tokens**: Long-lived tokens (30 days) stored in database for session renewal
- **Multi-tenant Support**: Users belong to specific tenants
- **Role-based Access Control (RBAC)**: Fine-grained permissions
- **Password Security**: SHA256 hashing with salt
- **Account Lockout**: Automatic lock after failed attempts
- **Token Validation**: Synchronized between localStorage and cookies

### Default Users

The system is initialized with the following default users:

| Role | Email | Password | Tenant |
|------|-------|----------|---------|
| Super Admin | admin@example.com | admin123 | default-tenant |
| Manager | manager@example.com | manager123 | default-tenant |
| Employee | employee@example.com | employee123 | default-tenant |

### API Endpoints

#### Authentication
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/refresh` - Refresh access token

#### User Management
- `GET /api/v1/users` - List users (admin only)
- `POST /api/v1/users` - Create new user (admin only)
- `PUT /api/v1/users/{id}` - Update user (admin or owner)
- `DELETE /api/v1/users/{id}` - Delete user (admin only)

### Security Features

1. **Token Refresh**: Automatic token renewal without requiring re-login
2. **Cookie Validation**: Tokens stored in cookies must match localStorage
3. **Route Protection**: Middleware protects all non-public routes
4. **Password Hashing**: Using SHA256 with configurable salt
5. **Session Management**: Refresh tokens can be revoked
6. **UUID-based IDs**: All users and resources use UUIDs for unique identification

### Frontend Integration

The frontend automatically handles:
- Token storage in localStorage and cookies
- Automatic token refresh on API calls
- Redirects to login on authentication failure
- Logout on token manipulation

## Testing

### Test Structure

```
tests/
├── unit/                 # Unit tests for individual functions
├── integration/          # Tests between components
├── e2e/                 # End-to-end tests
└── conftest.py          # Pytest configuration and fixtures
```

### Running Tests

```bash
# All tests
poetry run pytest

# Only unit tests
poetry run pytest -m unit

# With coverage
poetry run pytest --cov=src

# Generate coverage report
poetry run pytest --cov=src --cov-report=html
open htmlcov/index.html
```

### Test Examples

**Unit Test Example:**
```python
# tests/unit/test_auth.py
import pytest
from src.services.auth_service import AuthService

def test_password_hashing():
    service = AuthService()
    password = "test123"
    hashed = service.hash_password(password)
    assert service.verify_password(password, hashed)
    assert not service.verify_password("wrong", hashed)
```

**Integration Test Example:**
```python
# tests/integration/test_auth_api.py
import pytest
from httpx import AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_login():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
```

## Debugging

### Local Debugging

**Using Python Debugger:**
```python
# In your code
import pdb; pdb.set_trace()

# Or with ipdb (better)
import ipdb; ipdb.set_trace()
```

**VS Code Debug Configuration:**
```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/services/auth/src/main.py",
            "console": "integratedTerminal",
            "justMyCode": true
        }
    ]
}
```

### Database Debugging

```bash
# Connect to database
psql -h localhost -p 5432 -U postgres -d auth_db

# View tables
\dt

# View tenant data
SELECT * FROM tenants;

# Check RLS policies
\dp
```

### Service Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service

# View last 100 lines
docker-compose logs --tail=100 auth-service
```

### Tracing

```bash
# Access Jaeger UI
http://localhost:16686

# Search traces by:
# - Service name
# - Operation
# - Tags
# - Time range
```

## Common Issues & Solutions

### 1. Database Connection Errors

**Problem**: Service can't connect to PostgreSQL
**Solution**:
```bash
# Check if database is running
docker-compose ps postgres-auth

# Check logs
docker-compose logs postgres-auth

# Reset database
docker-compose down
docker volume rm logisticserpsystem_postgres_auth_data
docker-compose up -d postgres-auth
```

### 2. Kafka Connection Issues

**Problem**: Messages not being published/consumed
**Solution**:
```bash
# Check Kafka logs
docker-compose logs kafka

# Verify topic exists
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topic manually
docker-compose exec kafka kafka-topics --create --topic orders --bootstrap-server localhost:9092
```

### 3. Redis Connection

**Problem**: Cache not working
**Solution**:
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Clear cache
docker-compose exec redis redis-cli flushall
```

## Contributing

### Code Style

We use automated tools to ensure code quality:

- **Black**: Code formatting
- **isort**: Import sorting
- **flake8**: Linting
- **mypy**: Type checking
- **bandit**: Security scanning

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with tests
3. Ensure all tests pass:
   ```bash
   poetry run pre-commit run --all-files
   poetry run pytest
   ```
4. Update documentation
5. Create PR with clear description
6. Request code review

### Commit Message Format

```
type(scope): brief description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(auth): add multi-factor authentication
fix(orders): resolve null reference in order creation
docs(readme): update installation instructions
```

## Getting Help

- **Documentation**: Check this guide and code comments
- **Slack**: #logistics-erp-dev channel
- **Issues**: GitHub Issues for bugs and feature requests
- **Architecture Decisions**: docs/adr/ directory

Remember: The best way to learn is by exploring the codebase and experimenting! Happy coding! 🚀