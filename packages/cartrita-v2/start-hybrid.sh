#!/bin/bash
set -e

echo "🚀 Starting Cartrita Hybrid Backend (Fastify + FastAPI)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}Warning: Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    echo -e "${YELLOW}Waiting for $name to be ready...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}❌ $name failed to start after $max_attempts attempts${NC}"
    return 1
}

echo -e "${BLUE}📋 Pre-flight checks...${NC}"

# Check ports
check_port 8001 && echo -e "${GREEN}✅ Port 8001 (Fastify) available${NC}" || echo -e "${RED}❌ Port 8001 in use${NC}"
check_port 8002 && echo -e "${GREEN}✅ Port 8002 (FastAPI) available${NC}" || echo -e "${RED}❌ Port 8002 in use${NC}"

# Install FastAPI dependencies
echo -e "${PURPLE}📦 Installing FastAPI dependencies...${NC}"
cd apps/fastapi-service
if command -v python3 > /dev/null; then
    python3 -m pip install -r requirements.txt --quiet
    echo -e "${GREEN}✅ FastAPI dependencies installed${NC}"
else
    echo -e "${RED}❌ Python 3 not found${NC}"
    exit 1
fi
cd ../..

# Start FastAPI service in background
echo -e "${PURPLE}🐍 Starting FastAPI service on port 8002...${NC}"
cd apps/fastapi-service
python3 main.py &
FASTAPI_PID=$!
cd ../..

# Start Fastify service in background
echo -e "${BLUE}⚡ Starting Fastify service on port 8001...${NC}"
cd apps/backend-v2
npm run dev &
FASTIFY_PID=$!
cd ../..

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $FASTAPI_PID $FASTIFY_PID 2>/dev/null || true
    wait $FASTAPI_PID $FASTIFY_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Register cleanup function to run on script exit
trap cleanup EXIT INT TERM

# Wait for services to be ready
sleep 5
wait_for_service "http://localhost:8002/health" "FastAPI"
wait_for_service "http://localhost:8001/health" "Fastify"

echo -e "${GREEN}🎉 Hybrid backend is running!${NC}"
echo -e "${BLUE}Fastify (Node.js): http://localhost:8001${NC}"
echo -e "${PURPLE}FastAPI (Python): http://localhost:8002${NC}"
echo -e "${YELLOW}📚 API Documentation:${NC}"
echo -e "  Fastify: http://localhost:8001/api/docs"
echo -e "  FastAPI: http://localhost:8002/docs"

echo -e "\n${YELLOW}Press Ctrl+C to stop both services${NC}"

# Keep the script running
wait