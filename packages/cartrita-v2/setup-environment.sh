#!/bin/bash
"""
Cartrita V2 - Environment Setup Script
=====================================

Sets up the development environment with all required dependencies
and system packages for Cartrita V2 Python-only architecture.
"""

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if script is run from correct directory
check_directory() {
    if [[ ! -f "build.py" ]] || [[ ! -f "docker-compose.yml" ]]; then
        log_error "Please run this script from the cartrita-v2 project root"
        exit 1
    fi
}

# Check system requirements
check_system() {
    log_info "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_success "Linux OS detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_success "macOS detected"
    else
        log_warning "Unsupported OS: $OSTYPE"
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        log_success "Python $PYTHON_VERSION found"
        
        # Check minimum version
        if python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"; then
            log_success "Python version is 3.8+"
        else
            log_error "Python 3.8+ required, found $PYTHON_VERSION"
            exit 1
        fi
    else
        log_error "Python 3 not found. Please install Python 3.8+"
        exit 1
    fi
    
    # Check pip
    if command -v pip3 &> /dev/null; then
        log_success "pip3 found"
    elif command -v pip &> /dev/null; then
        log_success "pip found"
    else
        log_error "pip not found. Please install pip"
        exit 1
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        log_success "Docker found"
        
        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            log_success "Docker daemon is running"
        else
            log_warning "Docker daemon is not running. Please start Docker."
        fi
    else
        log_error "Docker not found. Please install Docker"
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose found"
    else
        log_error "Docker Compose not found. Please install Docker Compose"
        exit 1
    fi
}

# Install system packages (Ubuntu/Debian)
install_system_packages() {
    if command -v apt-get &> /dev/null; then
        log_info "Installing system packages (Ubuntu/Debian)..."
        
        sudo apt-get update
        sudo apt-get install -y \
            python3-dev \
            python3-pip \
            python3-venv \
            build-essential \
            curl \
            git \
            postgresql-client \
            redis-tools \
            jq
        
        log_success "System packages installed"
    else
        log_warning "Not an Ubuntu/Debian system. Please install required packages manually:"
        log_warning "  - python3-dev, python3-pip, python3-venv"
        log_warning "  - build-essential, curl, git"
        log_warning "  - postgresql-client, redis-tools, jq"
    fi
}

# Setup Python virtual environment
setup_python_env() {
    log_info "Setting up Python virtual environment..."
    
    VENV_DIR="venv"
    
    if [[ ! -d "$VENV_DIR" ]]; then
        log_info "Creating virtual environment..."
        python3 -m venv "$VENV_DIR"
        log_success "Virtual environment created in $VENV_DIR"
    else
        log_info "Virtual environment already exists"
    fi
    
    # Activate virtual environment
    log_info "Activating virtual environment..."
    source "$VENV_DIR/bin/activate"
    
    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip
    
    log_success "Python environment ready"
}

# Setup environment file
setup_env_file() {
    log_info "Setting up environment file..."
    
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            log_success "Created .env from .env.example"
        else
            log_info "Creating basic .env file..."
            cat > .env << EOF
# Cartrita V2 Environment Configuration
NODE_ENV=development
ENVIRONMENT=development

# Database Configuration
POSTGRES_USER=robert
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=dat-bitch-cartrita
DATABASE_URL=postgresql://robert:secure_password@localhost:5432/dat-bitch-cartrita

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Keys (REQUIRED - Please configure)
OPENAI_API_KEY=your-openai-api-key-here

# Service Ports
PORT=8002
PYTHON_PORT=8002
FRONTEND_PORT=3000

# Development Settings
DEBUG=true
LOG_LEVEL=INFO
EOF
            log_success "Created basic .env file"
        fi
        
        log_warning "Please configure your API keys in .env file:"
        log_warning "  - OPENAI_API_KEY: Required for AI functionality"
    else
        log_info ".env file already exists"
    fi
}

# Create convenience scripts
create_scripts() {
    log_info "Creating convenience scripts..."
    
    # Development start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Cartrita V2 Development Environment..."
python3 build.py dev
EOF
    chmod +x start-dev.sh
    
    # Production deployment script
    cat > deploy-prod.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying Cartrita V2 to Production..."
python3 build.py prod
EOF
    chmod +x deploy-prod.sh
    
    # Quick test script
    cat > run-tests.sh << 'EOF'
#!/bin/bash
echo "🧪 Running Cartrita V2 Tests..."
python3 build.py test
EOF
    chmod +x run-tests.sh
    
    log_success "Convenience scripts created"
}

# Main setup function
main() {
    echo "🎯 Cartrita V2 - Environment Setup"
    echo "=================================="
    
    check_directory
    check_system
    
    # Ask for confirmation before installing system packages
    read -p "Install system packages? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_system_packages
    fi
    
    setup_python_env
    setup_env_file
    create_scripts
    
    echo
    echo "🎉 Environment setup completed!"
    echo
    echo "Next steps:"
    echo "  1. Configure API keys in .env file"
    echo "  2. Run: ./cartrita setup     (or python3 build.py setup)"
    echo "  3. Run: ./cartrita dev       (or python3 build.py dev)"
    echo
    echo "Convenience scripts:"
    echo "  ./start-dev.sh     - Start development environment"
    echo "  ./deploy-prod.sh   - Deploy to production"
    echo "  ./run-tests.sh     - Run test suite"
    echo
}

# Run main function
main "$@"