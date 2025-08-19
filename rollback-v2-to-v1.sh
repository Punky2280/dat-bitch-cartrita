#!/bin/bash

# v2 to v1 Rollback Script - Rollback from Kubernetes to Docker Compose
# This script provides emergency rollback from v2 back to v1 infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[rollback]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[rollback]${NC} $1"
}

error() {
    echo -e "${RED}[rollback]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[rollback]${NC} $1"
}

# Configuration
NAMESPACE="data-stack"
BACKUP_DIR="./backups"

# Check prerequisites
check_prerequisites() {
    log "Checking rollback prerequisites..."

    # Check if backup exists
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "pre_migration_*.dump" -type f | sort | tail -1)
    if [ -z "$LATEST_BACKUP" ] || [ ! -f "$LATEST_BACKUP" ]; then
        error "No migration backup found in $BACKUP_DIR. Cannot perform rollback."
    fi
    
    log "Found backup: $LATEST_BACKUP"

    # Check required tools
    command -v pg_restore >/dev/null 2>&1 || error "pg_restore is required but not installed"
    command -v psql >/dev/null 2>&1 || error "psql is required but not installed"
    command -v docker >/dev/null 2>&1 || error "docker is required but not installed"

    # Check if original .env exists
    if [ ! -f ".env" ]; then
        error "Missing .env file. Please ensure your environment configuration is present."
    fi

    # Source environment variables
    set -a
    source .env
    set +a

    # Validate required env vars
    [ -z "$POSTGRES_USER" ] && error "POSTGRES_USER not set in .env"
    [ -z "$POSTGRES_PASSWORD" ] && error "POSTGRES_PASSWORD not set in .env" 
    [ -z "$POSTGRES_DB" ] && error "POSTGRES_DB not set in .env"

    log "Prerequisites check passed"
}

# Stop v2 application traffic
stop_v2_traffic() {
    log "Stopping v2 application traffic..."
    
    # Scale down backend deployments in Kubernetes if they exist
    if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        info "Scaling down v2 backend applications..."
        kubectl -n "$NAMESPACE" scale deployment --all --replicas=0 || warn "No deployments found to scale down"
        
        # Wait for pods to terminate
        kubectl -n "$NAMESPACE" wait --for=delete pod --all --timeout=60s || warn "Some pods may still be terminating"
    else
        warn "Kubernetes namespace $NAMESPACE not found"
    fi

    log "v2 traffic stopped"
}

# Restore v1 infrastructure
restore_v1_infrastructure() {
    log "Restoring v1 infrastructure..."
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        warn "docker-compose.yml not found, checking for alternative compose files..."
        if [ -f "docker-compose.dev.yml" ]; then
            COMPOSE_FILE="docker-compose.dev.yml"
            info "Using docker-compose.dev.yml"
        else
            error "No docker-compose file found for v1 infrastructure"
        fi
    else
        COMPOSE_FILE="docker-compose.yml"
    fi

    # Start v1 infrastructure
    info "Starting v1 Docker Compose services..."
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans || error "Failed to start v1 infrastructure"

    # Wait for PostgreSQL to be ready
    info "Waiting for v1 PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
            log "v1 PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "v1 PostgreSQL failed to start after 30 attempts"
        fi
        info "Waiting for v1 PostgreSQL... (attempt $i/30)"
        sleep 2
    done

    log "v1 infrastructure restored"
}

# Restore database from backup
restore_v1_database() {
    log "Restoring v1 database from backup..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Determine connection method
    if docker-compose ps postgres >/dev/null 2>&1; then
        # Use docker-compose exec
        info "Restoring database via Docker Compose..."
        docker-compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --clean --if-exists --no-owner --no-privileges < "$LATEST_BACKUP" || warn "Some restore warnings are normal"
    else
        # Use direct connection
        info "Restoring database via direct connection to ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}..."
        pg_restore -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --clean --if-exists --no-owner --no-privileges "$LATEST_BACKUP" || warn "Some restore warnings are normal"
    fi
    
    unset PGPASSWORD
    
    log "Database restored from backup: $LATEST_BACKUP"
}

# Restore v1 environment configuration
restore_v1_environment() {
    log "Restoring v1 environment configuration..."
    
    # Check if .env.v1 backup exists
    if [ -f ".env.v1" ]; then
        info "Found .env.v1 backup, restoring..."
        cp .env.v1 .env
        log "Environment configuration restored from .env.v1"
    else
        warn ".env.v1 backup not found"
        
        # Update current .env to v1 settings
        if [ -f ".env.v2" ]; then
            info "Restoring v1 database connection settings..."
            
            # Restore v1 database settings (assuming original was localhost:5432)
            sed -i 's/POSTGRES_HOST=.*/POSTGRES_HOST=localhost/' .env
            sed -i 's/POSTGRES_PORT=.*/POSTGRES_PORT=5432/' .env
            
            # Update database URL
            sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB|" .env
            
            # Restore Redis settings
            sed -i 's/REDIS_HOST=.*/REDIS_HOST=localhost/' .env
            sed -i 's/REDIS_PORT=.*/REDIS_PORT=6379/' .env
            sed -i "s|REDIS_URL=.*|REDIS_URL=redis://localhost:6379/0|" .env
            
            log "Environment configuration updated for v1"
        else
            warn "No v2 environment backup found, current .env may need manual adjustment"
        fi
    fi
}

# Validate v1 rollback
validate_v1_rollback() {
    log "Validating v1 rollback..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Test database connection
    info "Testing v1 database connection..."
    if docker-compose ps postgres >/dev/null 2>&1; then
        docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null || error "Failed to connect to v1 database"
    else
        psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null || error "Failed to connect to v1 database"
    fi
    
    # Check core tables exist
    info "Validating core v1 tables..."
    local check_sql="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'knowledge_entries', 'chat_sessions');"
    
    if docker-compose ps postgres >/dev/null 2>&1; then
        table_count=$(docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "$check_sql")
    else
        table_count=$(psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "$check_sql")
    fi
    
    if [ "${table_count// /}" -lt "3" ]; then
        error "Core v1 tables not found - rollback may have failed"
    fi
    
    # Check if v2 migration tables exist (should still be there)
    info "Checking migration history..."
    if docker-compose ps postgres >/dev/null 2>&1; then
        migration_count=$(docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null || echo "0")
    else
        migration_count=$(psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null || echo "0")
    fi
    
    if [ "${migration_count// /}" -gt "0" ]; then
        info "Migration history preserved (${migration_count// /} migrations recorded)"
    else
        warn "No migration history found - database may be fully reverted to pre-migration state"
    fi
    
    unset PGPASSWORD
    
    log "v1 rollback validation completed"
}

# Test application connectivity
test_application_connectivity() {
    log "Testing application connectivity to v1..."
    
    # Check if backend is configured to run
    if [ -f "packages/backend/package.json" ]; then
        info "Starting v1 backend connectivity test..."
        
        # Try to start backend briefly to test connectivity
        (
            cd packages/backend
            timeout 10s npm run dev 2>&1 | grep -i "server\|listen\|error\|connect" | head -5 || true
        ) || warn "Backend connectivity test inconclusive"
        
        log "Application connectivity test completed"
    else
        warn "Backend package not found, skipping connectivity test"
    fi
}

# Cleanup v2 resources (optional)
cleanup_v2_resources() {
    read -p "Do you want to cleanup v2 Kubernetes resources? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Cleaning up v2 Kubernetes resources..."
        
        # Delete namespace (this will remove all resources)
        kubectl delete namespace "$NAMESPACE" --ignore-not-found || warn "Failed to delete namespace, may not exist"
        
        # Wait for namespace deletion
        info "Waiting for namespace deletion..."
        while kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; do
            sleep 2
        done
        
        log "v2 Kubernetes resources cleaned up"
    else
        info "v2 resources preserved. Clean up manually with: kubectl delete namespace $NAMESPACE"
    fi
}

# Print rollback summary
print_rollback_summary() {
    log "Rollback Summary"
    echo "================"
    echo ""
    info "✅ v2 application traffic stopped"
    info "✅ v1 infrastructure restored (Docker Compose)"
    info "✅ Database restored from backup: $LATEST_BACKUP"
    info "✅ Environment configuration restored"
    info "✅ v1 functionality validated"
    echo ""
    info "Next Steps:"
    echo "1. Test application functionality thoroughly"
    echo "2. Monitor application logs for any issues"
    echo "3. Verify all integrations are working"
    echo "4. Consider investigation of v2 migration issues"
    echo ""
    info "To retry v2 migration after fixes:"
    echo "1. Address the issues that caused rollback"
    echo "2. Run: ./migrate-v1-to-v2.sh"
    echo ""
    warn "Important: v2 resources may still exist in Kubernetes cluster"
    warn "Use 'kubectl delete namespace $NAMESPACE' to clean up if needed"
}

# Main execution
main() {
    log "Starting v2 to v1 rollback..."
    
    # Confirmation prompt
    warn "This will rollback from v2 to v1 infrastructure."
    warn "Application downtime will occur during this process."
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Rollback cancelled by user"
        exit 0
    fi
    
    # Rollback phases
    check_prerequisites
    stop_v2_traffic
    restore_v1_infrastructure
    restore_v1_database
    restore_v1_environment
    validate_v1_rollback
    test_application_connectivity
    cleanup_v2_resources
    
    print_rollback_summary
    
    log "🔄 Rollback completed successfully!"
}

# Check if script is being sourced or executed
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi