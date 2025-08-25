#!/bin/bash
# Cartrita Hybrid System Quick Start Script
# Simplified deployment and testing script for the hybrid architecture

set -e

PROJECT_ROOT="/home/robbie/development/dat-bitch-cartrita"
LOG_FILE="/tmp/cartrita_quickstart.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running from correct directory
check_project_root() {
    if [ ! -f "package.json" ] || [ ! -d "packages" ] || [ ! -d "py" ]; then
        error "Please run this script from the project root directory: $PROJECT_ROOT"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking system prerequisites..."
    
    local missing=()
    
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    command -v docker-compose >/dev/null 2>&1 || missing+=("docker-compose")
    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    command -v python3 >/dev/null 2>&1 || missing+=("python3")
    command -v pip >/dev/null 2>&1 || missing+=("pip")
    
    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing required tools: ${missing[*]}"
        info "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    log "✅ All prerequisites satisfied"
}

# Setup environment files
setup_environment() {
    log "⚙️  Setting up environment files..."
    
    # Python environment
    if [ ! -f "py/.env" ]; then
        if [ -f "py/.env.example" ]; then
            cp py/.env.example py/.env
            log "✅ Created py/.env from example"
        else
            error "py/.env.example not found"
            exit 1
        fi
    fi
    
    # Node.js backend environment
    if [ ! -f "packages/backend/.env" ]; then
        cat > packages/backend/.env << 'EOF'
DATABASE_URL=postgresql://robert:punky1@postgres:5432/dat-bitch-cartrita
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=sk-proj-bF1fvxRLlkLJYpN6Yld6gWjr1Z4lH2e8kxXSBvKjdPLJA_hgTpz1rVHLe8YqpHGpJ8K6Lz0-2F_9bR5dN3pE6wJ8YlT3-vU7Q2sW8z
ANTHROPIC_API_KEY=sk-ant-api03-8n5YUmHb75lNPbqhJXdIWwOgV2nqL6m7qzE-0YxkJl3mvzsN1SrKe6zBGpPJQn3xqH
HUGGINGFACE_API_KEY=hf_SdJhqRmbNXKQvzOLfG3RpK7xYcpVZq2C8K
NODE_ENV=development
PORT=8000
PYTHON_SERVICE_URL=http://python-backend:8002
MCP_SOCKET_PATH=/tmp/cartrita_mcp.sock
EOF
        log "✅ Created packages/backend/.env"
    fi
    
    # Cartrita V2 environment
    if [ ! -f "packages/cartrita-v2/backend/.env" ]; then
        cat > packages/cartrita-v2/backend/.env << 'EOF'
DATABASE_URL=postgresql://robert:punky1@postgres:5432/dat-bitch-cartrita
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=sk-proj-bF1fvxRLlkLJYpN6Yld6gWjr1Z4lH2e8kxXSBvKjdPLJA_hgTpz1rVHLe8YqpHGpJ8K6Lz0-2F_9bR5dN3pE6wJ8YlT3-vU7Q2sW8z
ANTHROPIC_API_KEY=sk-ant-api03-8n5YUmHb75lNPbqhJXdIWwOgV2nqL6m7qzE-0YxkJl3mvzsN1SrKe6zBGpPJQn3xqH
HUGGINGFACE_API_KEY=hf_SdJhqRmbNXKQvzOLfG3RpK7xYcpVZq2C8K
NODE_ENV=development
PORT=3002
EOF
        log "✅ Created packages/cartrita-v2/backend/.env"
    fi
    
    log "✅ Environment setup complete"
}

# Install dependencies
install_dependencies() {
    log "📦 Installing dependencies..."
    
    # Root dependencies
    npm install
    
    # Node.js backend dependencies
    cd packages/backend && npm install && cd ../..
    
    # Cartrita V2 dependencies
    cd packages/cartrita-v2/backend && npm install && cd ../../..
    
    # Frontend dependencies (if exists)
    if [ -d "packages/frontend" ]; then
        cd packages/frontend && npm install && cd ../..
    else
        warn "⚠️  Frontend package not found, skipping..."
    fi
    
    # Python dependencies
    cd py && pip install -r requirements.txt && cd ..
    
    log "✅ Dependencies installed"
}

# Start services
start_services() {
    log "🐳 Starting hybrid services with Docker Compose..."
    
    # Stop any existing services
    docker-compose -f docker-compose.hybrid-v2.yml down >/dev/null 2>&1 || true
    
    # Start services
    docker-compose -f docker-compose.hybrid-v2.yml up -d
    
    log "✅ Services started"
}

# Wait for services to be ready
wait_for_services() {
    log "⏳ Waiting for services to be ready..."
    
    local services=(
        "postgres:5432"
        "redis:6379"
        "localhost:8000"
        "localhost:8002"
        "localhost:3000"
    )
    
    for service in "${services[@]}"; do
        local host=$(echo "$service" | cut -d: -f1)
        local port=$(echo "$service" | cut -d: -f2)
        
        info "Waiting for $service..."
        local retries=30
        while [ $retries -gt 0 ]; do
            if nc -z "$host" "$port" 2>/dev/null; then
                log "✅ $service is ready"
                break
            fi
            sleep 2
            ((retries--))
        done
        
        if [ $retries -eq 0 ]; then
            warn "⚠️  $service did not become ready in time"
        fi
    done
}

# Run basic health checks
health_check() {
    log "🔍 Running health checks..."
    
    # Check Node.js backend
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        log "✅ Node.js backend is healthy"
    else
        warn "⚠️  Node.js backend health check failed"
    fi
    
    # Check Python backend
    if curl -s http://localhost:8002/health >/dev/null 2>&1; then
        log "✅ Python backend is healthy"
    else
        warn "⚠️  Python backend health check failed"
    fi
    
    # Check frontend
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        log "✅ Frontend is accessible"
    else
        warn "⚠️  Frontend accessibility check failed"
    fi
}

# Display service information
show_services() {
    echo ""
    log "🎉 Cartrita Hybrid System is running!"
    echo ""
    info "🌐 Service URLs:"
    info "- Frontend:        http://localhost:3000"
    info "- Node.js API:     http://localhost:8000"
    info "- Python API:      http://localhost:8002"
    info "- Cartrita V2 API: http://localhost:3002"
    info "- Grafana:         http://localhost:3001"
    info "- Jaeger Tracing:  http://localhost:16686"
    info "- Prometheus:      http://localhost:9090"
    echo ""
    info "📋 Useful Commands:"
    info "- View logs:       docker-compose -f docker-compose.hybrid-v2.yml logs -f"
    info "- Stop services:   docker-compose -f docker-compose.hybrid-v2.yml down"
    info "- Restart:         ./py/quickstart.sh"
    info "- Full cleanup:    ./py/quickstart.sh cleanup"
    echo ""
    info "📊 Monitor system health:"
    info "- Node.js Health:  curl http://localhost:8000/health"
    info "- Python Health:   curl http://localhost:8002/health"
    info "- MCP Status:      curl http://localhost:8000/api/mcp/status"
}

# Cleanup function
cleanup() {
    log "🧹 Cleaning up services..."
    
    docker-compose -f docker-compose.hybrid-v2.yml down --volumes --remove-orphans
    
    # Clean up log files older than 7 days
    find /tmp -name "cartrita_*.log" -type f -mtime +7 -delete 2>/dev/null || true
    
    log "✅ Cleanup complete"
}

# Main deployment function
deploy() {
    log "🚀 Starting Cartrita Hybrid System Deployment"
    echo "============================================================="
    
    check_project_root
    check_prerequisites
    setup_environment
    install_dependencies
    start_services
    wait_for_services
    health_check
    show_services
    
    log "🎯 Deployment completed successfully!"
}

# Script entry point
main() {
    case "${1:-deploy}" in
        "cleanup")
            cleanup
            ;;
        "deploy"|"start"|"")
            deploy
            ;;
        "logs")
            docker-compose -f docker-compose.hybrid-v2.yml logs -f
            ;;
        "stop")
            docker-compose -f docker-compose.hybrid-v2.yml down
            ;;
        "status")
            docker-compose -f docker-compose.hybrid-v2.yml ps
            health_check
            ;;
        "help"|"-h"|"--help")
            echo "Cartrita Hybrid System Quick Start"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the full hybrid system (default)"
            echo "  start    - Alias for deploy"
            echo "  stop     - Stop all services"
            echo "  cleanup  - Stop services and clean up volumes"
            echo "  logs     - Follow service logs"
            echo "  status   - Show service status and health"
            echo "  help     - Show this help message"
            ;;
        *)
            error "Unknown command: $1"
            info "Use '$0 help' for available commands"
            exit 1
            ;;
    esac
}

# Change to project root directory
cd "$PROJECT_ROOT"

# Run main function with all arguments
main "$@"