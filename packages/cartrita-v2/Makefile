# Cartrita V2 - Python-Only Build System Integration
# Comprehensive development and deployment automation

.PHONY: setup dev prod test docker clean install lint build start health help
.DEFAULT_GOAL := help

# Python build system integration
PYTHON_BUILD := python3 build.py
CLI_WRAPPER := ./cartrita

# Environment setup
setup-env: ## Setup development environment
	@echo "🔧 Setting up Cartrita V2 environment..."
	@chmod +x setup-environment.sh
	@./setup-environment.sh

# Core build commands
setup: ## Complete initial setup
	@echo "📋 Running complete setup..."
	@$(PYTHON_BUILD) setup

dev: ## Start development environment
	@echo "🚀 Starting development mode..."
	@$(PYTHON_BUILD) dev

prod: ## Deploy to production
	@echo "🏭 Deploying to production..."
	@$(PYTHON_BUILD) prod

test: ## Run comprehensive test suite
	@echo "🧪 Running tests..."
	@$(PYTHON_BUILD) test

docker: ## Docker-only build and deployment
	@echo "🐳 Docker deployment..."
	@$(PYTHON_BUILD) docker

clean: ## Clean build artifacts and caches
	@echo "🧹 Cleaning build artifacts..."
	@$(PYTHON_BUILD) clean

# Development commands
install: ## Install dependencies only
	@echo "📦 Installing dependencies..."
	@$(PYTHON_BUILD) install

lint: ## Run code linting
	@echo "🔍 Linting code..."
	@$(PYTHON_BUILD) lint

build: ## Build frontend assets
	@echo "🏗️ Building frontend..."
	@$(PYTHON_BUILD) build

start: ## Start services in development mode
	@echo "▶️ Starting services..."
	@$(PYTHON_BUILD) start

start-prod: ## Start services in production mode
	@echo "▶️ Starting production services..."
	@$(PYTHON_BUILD) start-prod

health: ## Run health checks
	@echo "🏥 Running health checks..."
	@$(PYTHON_BUILD) health

# Complete pipeline
all: ## Run complete build pipeline
	@echo "🎯 Running complete build pipeline..."
	@$(PYTHON_BUILD) all

# Database operations
db-setup: ## Setup database with migrations
	@echo "🗃️ Setting up database..."
	@docker-compose up -d postgres redis
	@sleep 10
	@$(PYTHON_BUILD) setup

db-migrate: ## Run database migrations only
	@echo "🗃️ Running database migrations..."
	@if [ -f "db-init/init.sql" ]; then \
		psql postgresql://robert:secure_password@localhost:5432/dat-bitch-cartrita -f db-init/init.sql || true; \
	fi
	@for file in db-init/*.sql; do \
		if [ -f "$$file" ]; then \
			echo "Running migration: $$file"; \
			psql postgresql://robert:secure_password@localhost:5432/dat-bitch-cartrita -f "$$file" || true; \
		fi \
	done

# Help system
help: ## Show this help message
	@echo "🎯 Cartrita V2 - Python-Only Build System"
	@echo "=========================================="
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup-env     # First-time environment setup"
	@echo "  make setup         # Complete project setup"
	@echo "  make dev           # Start development environment"
	@echo ""
	@echo "📋 Available Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "🔧 Build System:"
	@echo "  You can also use the Python build system directly:"
	@echo "    python3 build.py --help"
	@echo "    ./cartrita --help"
	@echo ""
	@echo "📊 Service URLs (when running):"
	@echo "  • Python API: http://localhost:8002"
	@echo "  • Frontend:   http://localhost:3000"
	@echo "  • Database:   localhost:5432"
	@echo "  • Redis:      localhost:6379"