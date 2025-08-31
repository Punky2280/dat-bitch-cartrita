#!/bin/bash
# Cartrita V2 - Docker entrypoint script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Cartrita V2 Hybrid System${NC}"

# Function to check if a service is running
check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - waiting for $service_name...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within timeout${NC}"
    return 1
}

# Function to start Python backend
start_python_backend() {
    if [ "$ENABLE_PYTHON_AGENTS" = "true" ]; then
        echo -e "${BLUE}🐍 Starting Python FastAPI backend...${NC}"
        
        cd /app/py
        python3 fastapi_server.py &
        PYTHON_PID=$!
        cd /app
        
        # Wait for Python backend to be ready
        if check_service "Python Backend" "http://localhost:8002/health"; then
            echo -e "${GREEN}✅ Python backend started successfully (PID: $PYTHON_PID)${NC}"
        else
            echo -e "${RED}❌ Python backend failed to start${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️ Python agents disabled${NC}"
    fi
}

# Function to start Node.js backend
start_node_backend() {
    echo -e "${BLUE}📦 Starting Node.js hybrid backend...${NC}"
    
    if [ "$NODE_ENV" = "production" ]; then
        node src/index-hybrid.js &
        NODE_PID=$!
    else
        # Development mode with more verbose logging
        NODE_ENV=development node src/index-hybrid.js &
        NODE_PID=$!
    fi
    
    # Wait for Node.js backend to be ready
    if check_service "Node.js Backend" "http://localhost:8001/health"; then
        echo -e "${GREEN}✅ Node.js backend started successfully (PID: $NODE_PID)${NC}"
    else
        echo -e "${RED}❌ Node.js backend failed to start${NC}"
        exit 1
    fi
}

# Function to run health checks
run_health_checks() {
    echo -e "${BLUE}🏥 Running health checks...${NC}"
    
    # Check Node.js backend
    if curl -f -s "http://localhost:8001/health" > /dev/null; then
        echo -e "${GREEN}✅ Node.js backend health check passed${NC}"
    else
        echo -e "${RED}❌ Node.js backend health check failed${NC}"
        return 1
    fi
    
    # Check Python backend if enabled
    if [ "$ENABLE_PYTHON_AGENTS" = "true" ]; then
        if curl -f -s "http://localhost:8002/health" > /dev/null; then
            echo -e "${GREEN}✅ Python backend health check passed${NC}"
        else
            echo -e "${RED}❌ Python backend health check failed${NC}"
            return 1
        fi
    fi
    
    echo -e "${GREEN}🎉 All health checks passed!${NC}"
}

# Function to show system status
show_status() {
    echo -e "${BLUE}📊 Cartrita V2 System Status${NC}"
    echo "=================================="
    echo "Environment: $NODE_ENV"
    echo "Node.js Port: $PORT"
    echo "Python Port: $PYTHON_SERVER_PORT"
    echo "Python Agents: $ENABLE_PYTHON_AGENTS"
    echo "Node.js Agents: $ENABLE_NODE_AGENTS"
    echo "OpenAI API Key: $([ -n "$OPENAI_API_KEY" ] && echo "✅ Set" || echo "❌ Missing")"
    echo "=================================="
}

# Function to handle graceful shutdown
graceful_shutdown() {
    echo -e "\n${YELLOW}🛑 Received shutdown signal${NC}"
    
    if [ -n "$NODE_PID" ]; then
        echo -e "${YELLOW}🔄 Stopping Node.js backend (PID: $NODE_PID)${NC}"
        kill -TERM "$NODE_PID" 2>/dev/null || true
    fi
    
    if [ -n "$PYTHON_PID" ]; then
        echo -e "${YELLOW}🔄 Stopping Python backend (PID: $PYTHON_PID)${NC}"
        kill -TERM "$PYTHON_PID" 2>/dev/null || true
    fi
    
    # Wait for processes to exit gracefully
    wait 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cartrita V2 stopped gracefully${NC}"
    exit 0
}

# Set up signal handlers
trap graceful_shutdown SIGTERM SIGINT

# Main execution
case "${1:-start}" in
    start)
        # Validate environment
        if [ -z "$OPENAI_API_KEY" ]; then
            echo -e "${RED}❌ Error: OPENAI_API_KEY environment variable is required${NC}"
            exit 1
        fi
        
        show_status
        
        # Start services
        start_python_backend
        start_node_backend
        
        # Run health checks
        run_health_checks
        
        echo -e "${GREEN}🎉 Cartrita V2 is ready and serving requests!${NC}"
        echo -e "${BLUE}📡 Main API: http://localhost:$PORT${NC}"
        if [ "$ENABLE_PYTHON_AGENTS" = "true" ]; then
            echo -e "${BLUE}🐍 Python API: http://localhost:$PYTHON_SERVER_PORT${NC}"
        fi
        
        # Keep container running and wait for processes
        wait
        ;;
    
    health)
        run_health_checks
        ;;
    
    test)
        echo -e "${BLUE}🧪 Running smoke tests...${NC}"
        npm run test:smoke
        ;;
    
    shell)
        echo -e "${BLUE}🐚 Opening shell...${NC}"
        exec /bin/bash
        ;;
    
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo "Available commands: start, health, test, shell"
        exit 1
        ;;
esac