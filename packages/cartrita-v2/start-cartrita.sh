#!/bin/bash

# Cartrita V2 - Unified Startup Script
# Starts frontend, backend, and Python services in Docker containers

set -e

echo "🚀 Starting Cartrita V2 - Unified Docker Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is available (modern or legacy)
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ Docker Compose is not installed or not available.${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down Cartrita V2...${NC}"
    $COMPOSE_CMD -f docker-compose.unified.yml down
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}📋 Pre-flight checks...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found. Please create it with required environment variables.${NC}"
    echo "Required variables:"
    echo "  - OPENAI_API_KEY"
    echo "  - HUGGINGFACE_API_KEY (optional)"
    echo "  - DEEPGRAM_API_KEY (optional)"
    exit 1
fi

# Check if required directories exist
echo -e "${BLUE}📁 Checking directory structure...${NC}"
for dir in "frontend" "backend" "py"; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Directory '$dir' not found.${NC}"
        exit 1
    fi
done

# Clean up any existing containers
echo -e "${YELLOW}🧹 Cleaning up existing containers...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml down --remove-orphans

# Pull latest base images
echo -e "${BLUE}📦 Pulling base images...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml pull postgres redis

# Build and start services
echo -e "${GREEN}🔨 Building and starting services...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml up --build -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready${NC}"
            return 0
        fi
        echo -e "${YELLOW}⏳ Waiting for $service_name... ($attempt/$max_attempts)${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within timeout${NC}"
    return 1
}

# Check database
echo -e "${BLUE}🗄️  Waiting for PostgreSQL...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml exec -T postgres pg_isready -U robert -d dat-bitch-cartrita
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
fi

# Check Redis
echo -e "${BLUE}💾 Waiting for Redis...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml exec -T redis redis-cli ping
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
else
    echo -e "${RED}❌ Redis failed to start${NC}"
    exit 1
fi

# Check Python backend
check_service "Python Backend" "http://localhost:8002/health"

# Check Node.js backend  
check_service "Node.js Backend" "http://localhost:8001/health"

# Check Frontend
check_service "Frontend" "http://localhost:3000"

echo -e "\n${GREEN}🎉 Cartrita V2 is fully operational!${NC}"
echo -e "=================================================="
echo -e "${BLUE}📱 Frontend:${NC}          http://localhost:3000"
echo -e "${BLUE}🔧 Node.js API:${NC}       http://localhost:8001"
echo -e "${BLUE}🤖 Python AI API:${NC}     http://localhost:8002"
echo -e "${BLUE}🗄️  Database Admin:${NC}    http://localhost:5432"
echo -e "${BLUE}💾 Redis:${NC}             http://localhost:6379"
echo -e "=================================================="
echo -e "\n${YELLOW}📝 Service Logs:${NC}"
echo "  View all logs:       $COMPOSE_CMD -f docker-compose.unified.yml logs -f"
echo "  View specific logs:  $COMPOSE_CMD -f docker-compose.unified.yml logs -f [service-name]"
echo "  Services: postgres, redis, python-backend, node-backend, frontend"
echo ""
echo -e "${YELLOW}🛑 To stop:${NC} Press Ctrl+C or run:"
echo "  $COMPOSE_CMD -f docker-compose.unified.yml down"

# Follow logs for all services
echo -e "\n${BLUE}📋 Following service logs (Ctrl+C to exit)...${NC}"
$COMPOSE_CMD -f docker-compose.unified.yml logs -f