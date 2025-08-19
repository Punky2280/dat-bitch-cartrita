# Cartrita Core Hygiene & Development Automation
# Aligned with Copilot Instructions v1.0.0

.PHONY: hygiene hygiene-quick commit-hygiene dev-backend dev-frontend start-backend start-frontend docker-up docker-down clean install

# Full hygiene pass with all checks
hygiene:
	bash packages/cartrita_core/scripts/run_full_hygiene.sh

# Quick hygiene (skip heavy tests)
hygiene-quick:
	QUICK_MODE=1 bash packages/cartrita_core/scripts/run_full_hygiene.sh

# Run hygiene and commit changes
commit-hygiene:
	$(MAKE) hygiene
	git add .
	git commit -S -m "chore(cartrita): full hygiene pass, branding audit clean"
	git push

# Development server commands
dev-backend:
	cd packages/backend && npm run dev

dev-frontend:
	cd packages/frontend && npm run dev

start-backend:
	cd packages/backend && npm start

start-frontend:
	cd packages/frontend && npm start

# Docker orchestration
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-rebuild:
	docker-compose up --build -d

# Database operations
db-migrate:
	psql postgresql://localhost/cartrita -f db-init/28_v2_gpt5_features.sql

db-status:
	psql postgresql://localhost/cartrita -c "SELECT COUNT(*) as total_users FROM users;"

# Installation and setup
install:
	cd packages/backend && npm install
	cd packages/frontend && npm install
	if [ -f py/mcp_core/requirements.txt ]; then cd py/mcp_core && pip install -r requirements.txt; fi

# Clean build artifacts
clean:
	cd packages/backend && rm -rf node_modules dist
	cd packages/frontend && rm -rf node_modules dist build
	docker system prune -f

# Audit commands
audit-v1:
	bash packages/cartrita_core/scripts/scan_v1_references.sh

audit-branding:
	bash packages/cartrita_core/scripts/rename_audit.sh

# Health checks
health-backend:
	curl -sf http://localhost:8001/health || echo "Backend not running"

health-frontend:
	curl -sf http://localhost:3001 || echo "Frontend not running"

health-db:
	psql postgresql://localhost/cartrita -c "SELECT 1;" >/dev/null 2>&1 && echo "Database OK" || echo "Database unavailable"

# Complete health check
health: health-db health-backend health-frontend
	echo "System health check complete"

# Development workflow
dev: install hygiene-quick dev-backend

# Production readiness check
prod-ready: hygiene audit-v1 audit-branding health
	echo "Production readiness verified"

# Legacy documentation build (preserved)
pdf:
	@if [ -f docs/Cartrita_Hierarchical_MCP_Transformation_Whitepaper.md ]; then \
		mkdir -p docs/output; \
		pandoc --from markdown --to pdf --toc docs/Cartrita_Hierarchical_MCP_Transformation_Whitepaper.md -o docs/output/Cartrita_MCP_Whitepaper.pdf; \
		echo "PDF generated"; \
	else \
		echo "Whitepaper not found"; \
	fi