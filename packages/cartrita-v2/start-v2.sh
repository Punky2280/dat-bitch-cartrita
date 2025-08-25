#!/bin/bash
# Cartrita V2 Multi-Agent OS - Quick Start Script
# Initializes and starts the complete V2 architecture

set -e

echo "🚀 Starting Cartrita V2 Multi-Agent OS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed. Please install it and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-flight checks passed${NC}"

# Create required directories
echo -e "${YELLOW}📁 Creating required directories...${NC}"
mkdir -p logs
mkdir -p uploads
mkdir -p backups
mkdir -p data/faiss
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/elasticsearch

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Please edit .env file with your configuration before proceeding.${NC}"
        echo -e "${YELLOW}   At minimum, set your API keys and database passwords.${NC}"
        read -p "Press Enter to continue after editing .env file..."
    else
        echo -e "${RED}❌ .env.example file not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Build the services
echo -e "${BLUE}🔨 Building Docker services...${NC}"
docker-compose -f docker-compose.v2.yml build

# Start the services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose -f docker-compose.v2.yml up -d

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Health check function
check_service() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Checking $service_name... "
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Ready${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ Failed to start${NC}"
    return 1
}

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

check_service "PostgreSQL" "http://localhost:5433" || echo -e "${YELLOW}⚠️  PostgreSQL may still be starting${NC}"
check_service "Redis" "http://localhost:6380" || echo -e "${YELLOW}⚠️  Redis may still be starting${NC}"
check_service "Backend V2" "http://localhost:8001/health"
check_service "Frontend V2" "http://localhost:3001/"
check_service "FAISS Service" "http://localhost:8002/health"
check_service "Elasticsearch" "http://localhost:9201/_cluster/health" || echo -e "${YELLOW}⚠️  Elasticsearch may still be starting${NC}"
check_service "Prometheus" "http://localhost:9090/-/ready"
check_service "Grafana" "http://localhost:3000/api/health"
check_service "Jaeger" "http://localhost:16686/"

echo ""
echo -e "${GREEN}🎉 Cartrita V2 Multi-Agent OS is running!${NC}"
echo ""
echo -e "${BLUE}📊 Service URLs:${NC}"
echo -e "  🖥️  Frontend V2:        http://localhost:3001"
echo -e "  🔧 Backend V2 API:     http://localhost:8001"
echo -e "  🔍 FAISS Search:       http://localhost:8002"
echo -e "  📈 Prometheus:         http://localhost:9090"
echo -e "  📊 Grafana:            http://localhost:3000"
echo -e "  🔍 Jaeger Tracing:     http://localhost:16686"
echo -e "  🗄️  Elasticsearch:     http://localhost:9201"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo -e "  View logs:             docker-compose -f docker-compose.v2.yml logs -f"
echo -e "  Stop services:         docker-compose -f docker-compose.v2.yml down"
echo -e "  Restart services:      docker-compose -f docker-compose.v2.yml restart"
echo -e "  Health check:          curl http://localhost:8001/health"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  - Check logs if any service fails to start"
echo -e "  - Ensure all required API keys are set in .env file"
echo -e "  - Run database migrations if this is first start"
echo -e "  - Monitor services with: docker-compose -f docker-compose.v2.yml ps"
echo ""
echo -e "${GREEN}Happy building with Cartrita V2! 🤖✨${NC}"