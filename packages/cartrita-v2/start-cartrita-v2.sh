#!/bin/bash

# 🏝️ Cartrita V2 - Complete System Startup Script
# Builds and runs the full OpenAI-powered Miami AI assistant

set -e  # Exit on any error

echo "🏝️  ¡Hola! Starting Cartrita V2 - Miami AI Assistant"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${CYAN}🔍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_status "Working directory: $SCRIPT_DIR"

# Step 1: Environment Setup
print_status "Step 1: Checking environment setup..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << 'EOF'
# Cartrita V2 Environment Configuration
# Copy this to .env and fill in your values

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration  
DATABASE_URL=postgresql://localhost:5432/cartrita_v2
REDIS_URL=redis://localhost:6379

# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=true
LOG_LEVEL=INFO

# Miami Configuration
MIAMI_MODE=true
PERSONALITY_LEVEL=high
CULTURAL_REFERENCES=true
EOF
    print_error "Please update .env file with your OpenAI API key and database credentials"
    exit 1
else
    print_success ".env file found"
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Environment variables loaded"
fi

# Check required environment variables
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    print_error "OPENAI_API_KEY not set in .env file"
    print_info "Get your API key from: https://platform.openai.com/api-keys"
    exit 1
fi

print_success "OpenAI API key configured"

# Step 2: Python Environment Setup
print_status "Step 2: Setting up Python environment..."

# Check Python version
PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "not found")
if [[ $PYTHON_VERSION == *"not found"* ]]; then
    print_error "Python 3 not found. Please install Python 3.8 or higher"
    exit 1
fi

print_success "Python found: $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_success "Virtual environment exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate
print_success "Virtual environment activated"

# Step 3: Install Dependencies
print_status "Step 3: Installing Python dependencies..."

# Create requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    print_status "Creating requirements.txt..."
    cat > requirements.txt << 'EOF'
# Cartrita V2 Python Dependencies

# Core Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0

# OpenAI
openai==1.45.0

# Database
asyncpg==0.29.0
psycopg2-binary==2.9.9

# Data Processing
pandas==2.1.3
numpy==1.24.4

# Validation and Security
jsonschema==4.20.0
cryptography==41.0.8

# HTTP and Networking
httpx==0.25.2
requests==2.31.0

# Utilities
python-dotenv==1.0.0
python-multipart==0.0.6
semantic-version==2.10.0

# Development
pytest==7.4.3
pytest-asyncio==0.21.1
EOF
    print_success "requirements.txt created"
fi

# Install/upgrade dependencies
print_status "Installing/upgrading dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

print_success "Python dependencies installed"

# Step 4: Database Setup
print_status "Step 4: Checking database setup..."

# Check if PostgreSQL is running (optional)
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        print_success "PostgreSQL is running"
    else
        print_warning "PostgreSQL not running. Starting with mock database mode."
    fi
else
    print_warning "PostgreSQL not found. Will use mock database mode."
fi

# Step 5: Build Frontend (if exists)
print_status "Step 5: Checking frontend build..."

if [ -d "../frontend" ]; then
    print_status "Frontend directory found, checking build..."
    
    # Check if Node.js is available
    if command -v npm &> /dev/null; then
        cd ../frontend
        print_status "Installing frontend dependencies..."
        npm install
        
        print_status "Building frontend..."
        npm run build
        
        print_success "Frontend built successfully"
        cd "$SCRIPT_DIR"
    else
        print_warning "Node.js/npm not found. Skipping frontend build."
    fi
else
    print_info "No frontend directory found. Running backend only."
fi

# Step 6: Run System Checks
print_status "Step 6: Running system health checks..."

# Create a simple health check script
python3 -c "
import sys
import os
sys.path.insert(0, os.getcwd())

try:
    # Test imports
    from cartrita_main import CartritalV2Application
    from cartrita_core.responses_adapter import ResponsesAdapter
    from cartrita_core.orchestrator_agent import CartritalOrchestrator
    from cartrita_core.security_governance import SecurityGovernanceIntegrator
    print('✅ All core modules import successfully')
    
    # Test OpenAI API key format
    if os.getenv('OPENAI_API_KEY', '').startswith('sk-'):
        print('✅ OpenAI API key format looks correct')
    else:
        print('⚠️  OpenAI API key format may be incorrect')
    
    print('✅ System health checks passed')
    
except Exception as e:
    print(f'❌ System health check failed: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    print_success "System health checks passed"
else
    print_error "System health checks failed"
    exit 1
fi

# Step 7: Start the Application
print_status "Step 7: Starting Cartrita V2 application..."

echo ""
echo "🚀 ¡Dale! Starting Cartrita V2..."
echo "================================="
print_info "API Server: http://${HOST:-0.0.0.0}:${PORT:-8000}"
print_info "Documentation: http://${HOST:-0.0.0.0}:${PORT:-8000}/docs"
print_info "Health Check: http://${HOST:-0.0.0.0}:${PORT:-8000}/health"
echo ""
print_info "Press Ctrl+C to stop the server"
echo "================================="

# Choose startup mode
if [ "$1" = "cli" ]; then
    print_status "Starting in CLI mode..."
    python3 cartrita_main.py
elif [ "$1" = "server" ] || [ -z "$1" ]; then
    print_status "Starting FastAPI server..."
    python3 fastapi_server_v2.py
else
    print_error "Unknown startup mode: $1"
    print_info "Usage: $0 [cli|server]"
    print_info "  cli    - Start in command line interface mode"
    print_info "  server - Start FastAPI web server (default)"
    exit 1
fi