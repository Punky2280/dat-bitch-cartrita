#!/bin/bash

# Cartrita V2 - Docker Setup Test Script
echo "🧪 Testing Cartrita V2 Docker Setup"
echo "================================="

# Check if docker-compose.unified.yml exists
if [ ! -f "docker-compose.unified.yml" ]; then
    echo "❌ docker-compose.unified.yml not found"
    exit 1
fi

# Check if Dockerfiles exist
echo "📋 Checking Dockerfiles..."
for dockerfile in "frontend/Dockerfile" "backend/Dockerfile" "py/Dockerfile"; do
    if [ -f "$dockerfile" ]; then
        echo "✅ $dockerfile exists"
    else
        echo "❌ $dockerfile missing"
        exit 1
    fi
done

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    # Check for required keys
    if grep -q "OPENAI_API_KEY" .env; then
        echo "✅ OPENAI_API_KEY found in .env"
    else
        echo "⚠️  OPENAI_API_KEY not found in .env"
    fi
else
    echo "⚠️  .env file missing - you'll need this for full functionality"
fi

# Check Docker is running
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is running"
else
    echo "❌ Docker is not running"
    exit 1
fi

# Check if Docker Compose is available (modern or legacy)
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not installed or not available"
    exit 1
fi

# Validate docker-compose file
if $COMPOSE_CMD -f docker-compose.unified.yml config > /dev/null 2>&1; then
    echo "✅ docker-compose.unified.yml is valid"
else
    echo "❌ docker-compose.unified.yml has errors"
    exit 1
fi

echo ""
echo "🎉 Docker setup validation passed!"
echo "📝 To start Cartrita V2:"
echo "   ./start-cartrita.sh"
echo ""
echo "🔧 Manual commands:"
echo "   $COMPOSE_CMD -f docker-compose.unified.yml up --build -d"
echo "   $COMPOSE_CMD -f docker-compose.unified.yml logs -f"