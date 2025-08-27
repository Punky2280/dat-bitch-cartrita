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

dev: ## Start unified development environment (Backend on 8000 + Frontend on 3000)
	@echo "🚀 Starting Cartrita V2 development environment..."
	@echo "   - PostgreSQL + Redis"
	@echo "   - Python Backend (8000) with /api/v2/* routes"
	@echo "   - Frontend (3000) → pointing to backend"
	docker compose up --build --remove-orphans

start: ## Start services in detached mode
	@echo "▶️ Starting services in background..."
	docker compose up -d --remove-orphans

stop: ## Stop all services
	@echo "� Stopping all services..."
	docker compose down

restart: ## Restart all services
	@echo "� Restarting services..."
	docker compose down && docker compose up -d --remove-orphans

clean: ## Clean up containers and volumes
	@echo "🧹 Cleaning up containers and volumes..."
	docker compose down -v --remove-orphans
	docker system prune -f

logs: ## Show logs for all services
	@echo "📄 Showing logs for all services..."
	docker compose logs -f

logs-backend: ## Show backend logs (8000)
	@echo "📄 Backend logs (8000)..."
	docker compose logs -f python-backend

logs-frontend: ## Show frontend logs (3000)
	@echo "📄 Frontend logs (3000)..."
	docker compose logs -f frontend

status: ## Show status of all services
	@echo "📊 Service Status:"
	docker compose ps

health-dev: ## Check health of all development services
	@echo "🏥 Development Health Check:"
	@echo "Frontend (3000): $$(curl -s -w '%{http_code}' -o /dev/null http://localhost:3000 2>/dev/null || echo 'DOWN')"
	@echo "Backend (8000): $$(curl -s -w '%{http_code}' -o /dev/null http://localhost:8000/health 2>/dev/null || echo 'DOWN')"
	@echo "PostgreSQL (5432): $$(docker compose exec -T postgres pg_isready -h localhost -p 5432 >/dev/null 2>&1 && echo '200 OK' || echo 'DOWN')"
	@echo "Redis (6379): $$(docker compose exec -T redis redis-cli ping >/dev/null 2>&1 && echo '200 OK' || echo 'DOWN')"

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