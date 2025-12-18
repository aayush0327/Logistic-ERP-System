#!/bin/bash
# Development environment setup script for Logistics ERP

set -e

echo "🚀 Setting up Logistics ERP development environment..."

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."

    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3.13 is required but not installed"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is required but not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is required but not installed"
        exit 1
    fi

    echo "✅ All requirements satisfied"
}

# Install Python dependencies
install_python_deps() {
    echo "🐍 Installing Python dependencies..."

    # Install uv if not present
    if ! command -v uv &> /dev/null; then
        echo "Installing uv..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
    fi

    # Install dependencies for each service
    for service in services/*/; do
        if [ -f "$service/pyproject.toml" ]; then
            echo "Installing dependencies for $(basename $service)..."
            cd "$service"
            uv sync
            cd - > /dev/null
        fi
    done

    # Install root dependencies
    uv sync --extra dev

    echo "✅ Python dependencies installed"
}

# Install Node.js dependencies
install_node_deps() {
    echo "📦 Installing Node.js dependencies..."

    if [ -d "frontend" ]; then
        cd frontend
        npm ci
        cd - > /dev/null
        echo "✅ Frontend dependencies installed"
    fi
}

# Set up pre-commit hooks
setup_precommit() {
    echo "🔧 Setting up pre-commit hooks..."

    # Install pre-commit if not present
    if ! command -v pre-commit &> /dev/null; then
        pip install pre-commit
    fi

    pre-commit install
    echo "✅ Pre-commit hooks installed"
}

# Create environment files
create_env_files() {
    echo "📝 Creating environment files..."

    # Create .env from template if it doesn't exist
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "✅ Created .env from template"
    fi

    # Create service-specific .env files
    for service in services/*/; do
        if [ ! -f "$service/.env" ] && [ -f ".env.example" ]; then
            cp .env.example "$service/.env"
            echo "✅ Created $(basename $service)/.env"
        fi
    done

    if [ -d "frontend" ] && [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << EOF
# Frontend environment variables
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF
        echo "✅ Created frontend/.env.local"
    fi
}

# Start infrastructure services
start_infrastructure() {
    echo "🏗️ Starting infrastructure services..."

    # Start single PostgreSQL instance and other infrastructure
    docker-compose up -d postgres timescaledb redis kafka zookeeper minio elasticsearch

    echo "⏳ Waiting for services to be ready..."
    sleep 10

    echo "✅ Infrastructure services started"
}

# Initialize databases
init_databases() {
    echo "💾 Initializing databases..."

    # Run database migrations
    for service in services/*/; do
        if [ -d "$service/migrations" ]; then
            echo "Running migrations for $(basename $service)..."
            cd "$service"
            poetry run alembic upgrade head
            cd - > /dev/null
        fi
    done

    echo "✅ Databases initialized"
}

# Create initial data
create_initial_data() {
    echo "📊 Creating initial data..."

    # Create initial tenant and admin user
    cd services/auth
    poetry run python -c "
import asyncio
import sys
sys.path.append('src')
from database import AsyncSessionLocal, Base
from models import Tenant, User, Role, Permission
import uuid

async def create_initial_data():
    async with AsyncSessionLocal() as session:
        # Create default tenant
        tenant = Tenant(
            id=str(uuid.uuid4()),
            name='Default Tenant',
            domain='localhost'
        )
        session.add(tenant)

        # Create default roles
        admin_role = Role(
            id=str(uuid.uuid4()),
            name='Super Admin',
            tenant_id=tenant.id,
            is_system=True
        )
        session.add(admin_role)

        # Create default permissions
        permissions = [
            Permission(id=str(uuid.uuid4()), resource='*', action='*')
        ]
        for perm in permissions:
            session.add(perm)

        await session.commit()
        print('✅ Initial data created')

asyncio.run(create_initial_data())
"
    cd - > /dev/null
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup complete! Here's what you can do next:"
    echo ""
    echo "1. Review and update .env files with your configuration"
    echo "2. Start the development services:"
    echo "   docker-compose up -d"
    echo ""
    echo "3. Run individual services:"
    echo "   cd services/auth && poetry run python -m src.main"
    echo "   cd services/orders && poetry run python -m src.main"
    echo ""
    echo "4. Start the frontend:"
    echo "   cd frontend && npm run dev"
    echo ""
    echo "5. Run tests:"
    echo "   poetry run pytest"
    echo ""
    echo "6. View service documentation:"
    echo "   Auth Service: http://localhost:8001/docs"
    echo "   Frontend: http://localhost:3000"
    echo ""
    echo "Happy coding! 🚀"
}

# Main execution
main() {
    check_requirements
    install_python_deps
    install_node_deps
    setup_precommit
    create_env_files
    start_infrastructure
    init_databases
    create_initial_data
    show_next_steps
}

# Run the setup
main "$@"