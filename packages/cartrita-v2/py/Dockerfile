FROM python:3.11-slim

# Install system dependencies including Playwright browser dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    wget \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers for headless automation
# Use fallback approach for font packages compatibility
RUN playwright install chromium && \
    apt-get update && apt-get install -y \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Create cache directories for ML models
RUN mkdir -p /app/.cache/torch /app/.cache/transformers

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

# Run the FastAPI server
CMD ["python", "fastapi_server.py"]