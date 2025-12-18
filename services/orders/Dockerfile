# ====================================
# Stage 1: Base Image with Dependencies
# ====================================
FROM python:3.13-slim AS base

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# ====================================
# Stage 2: Dependencies Installation
# ====================================
FROM base AS dependencies

# Copy dependency files
COPY pyproject.toml ./
COPY uv.lock* ./

# Install Python dependencies
RUN uv pip install --system --no-cache .

# ====================================
# Stage 3: Production Image
# ====================================
FROM base AS production

# Copy installed dependencies
COPY --from=dependencies /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# ✅ Copy ONLY application source (important)
COPY . .

# Create directories
RUN mkdir -p /app/logs /app/uploads && \
    chmod 755 /app/logs /app/uploads

# Create non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose service port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Start Orders Service
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8003", "--reload"]
