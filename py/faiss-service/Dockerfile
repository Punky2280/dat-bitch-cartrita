# Cartrita V2 - Python FAISS Service Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .
COPY config/ ./config/
COPY models/ ./models/

# Create data directory for FAISS index
RUN mkdir -p /data/faiss_index

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app /data
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

EXPOSE 8002 8001

CMD ["python", "main.py"]