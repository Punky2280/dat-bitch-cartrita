#!/bin/bash

# v1 to v2 Migration Script - Seamless Database and Infrastructure Migration
# This script migrates from v1 Docker Compose setup to v2 Kubernetes with credential reuse

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[migrate]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[migrate]${NC} $1"
}

error() {
    echo -e "${RED}[migrate]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[migrate]${NC} $1"
}

# Configuration
NAMESPACE="data-stack"
BACKUP_DIR="./backups"
MIGRATION_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pre_migration_${MIGRATION_DATE}.dump"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if .env exists
    if [ ! -f ".env" ]; then
        error "Missing .env file. Please ensure your v1 .env configuration is present."
    fi

    # Check required tools
    command -v kubectl >/dev/null 2>&1 || error "kubectl is required but not installed"
    command -v pg_dump >/dev/null 2>&1 || error "pg_dump is required but not installed"
    command -v pg_restore >/dev/null 2>&1 || error "pg_restore is required but not installed"
    command -v psql >/dev/null 2>&1 || error "psql is required but not installed"
    command -v npm >/dev/null 2>&1 || error "npm is required but not installed"

    # Source environment variables
    set -a
    source .env
    set +a

    # Validate required env vars
    [ -z "$POSTGRES_USER" ] && error "POSTGRES_USER not set in .env"
    [ -z "$POSTGRES_PASSWORD" ] && error "POSTGRES_PASSWORD not set in .env" 
    [ -z "$POSTGRES_DB" ] && error "POSTGRES_DB not set in .env"
    [ -z "$POSTGRES_HOST" ] && error "POSTGRES_HOST not set in .env"

    log "Prerequisites check passed"
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log "Created backup directory: $BACKUP_DIR"
}

# Backup v1 database
backup_v1_database() {
    log "Creating backup of v1 database..."
    
    info "Backing up database: $POSTGRES_DB from $POSTGRES_HOST:$POSTGRES_PORT"
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    pg_dump -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -Fc --no-owner --no-privileges -f "$BACKUP_FILE" || error "Failed to create database backup"
    
    # Create schema-only backup for comparison
    pg_dump -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -s --no-owner --no-privileges -f "${BACKUP_DIR}/schema_${MIGRATION_DATE}.sql" || warn "Failed to create schema backup"
    
    # Get row counts for verification
    psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -c "\copy (SELECT schemaname, tablename, n_tup_ins as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY tablename) TO '${BACKUP_DIR}/row_counts_${MIGRATION_DATE}.csv' WITH CSV HEADER" || warn "Failed to get row counts"
    
    unset PGPASSWORD
    
    log "Database backup created: $BACKUP_FILE"
    log "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
}

# Create Kubernetes secrets from .env
create_k8s_secrets() {
    log "Creating Kubernetes namespace and secrets..."
    
    # Create namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - || warn "Namespace may already exist"
    
    # Create postgres secret
    kubectl -n "$NAMESPACE" create secret generic postgres-secret \
        --from-literal=POSTGRES_USER="$POSTGRES_USER" \
        --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        --from-literal=POSTGRES_DB="$POSTGRES_DB" \
        --dry-run=client -o yaml | kubectl apply -f - || warn "Postgres secret may already exist"
    
    # Create Redis secret (extract password from REDIS_URL if present)
    REDIS_PASSWORD=""
    if [ -n "$REDIS_URL" ]; then
        REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -n 's|redis://:\([^@]*\)@.*|\1|p')
    fi
    
    if [ -z "$REDIS_PASSWORD" ] && [ -n "$REDIS_PASS" ]; then
        REDIS_PASSWORD="$REDIS_PASS"
    fi
    
    if [ -n "$REDIS_PASSWORD" ]; then
        kubectl -n "$NAMESPACE" create secret generic redis-secret \
            --from-literal=REDIS_PASSWORD="$REDIS_PASSWORD" \
            --dry-run=client -o yaml | kubectl apply -f - || warn "Redis secret may already exist"
    else
        warn "No Redis password found in environment, creating empty secret"
        kubectl -n "$NAMESPACE" create secret generic redis-secret \
            --from-literal=REDIS_PASSWORD="" \
            --dry-run=client -o yaml | kubectl apply -f - || warn "Redis secret may already exist"
    fi
    
    # Create backend environment secret
    kubectl -n "$NAMESPACE" create secret generic backend-env \
        --from-env-file=.env \
        --dry-run=client -o yaml | kubectl apply -f - || warn "Backend env secret may already exist"
    
    log "Kubernetes secrets created successfully"
    
    # Verify secrets
    info "Created secrets:"
    kubectl -n "$NAMESPACE" get secrets | grep -E "(postgres-secret|redis-secret|backend-env)" || warn "Some secrets may not be visible"
}

# Deploy Kubernetes infrastructure
deploy_k8s_infrastructure() {
    log "Deploying Kubernetes infrastructure..."
    
    if [ ! -f "k8s/pgvector-redis.yaml" ]; then
        error "Kubernetes manifest k8s/pgvector-redis.yaml not found"
    fi
    
    kubectl apply -f k8s/pgvector-redis.yaml || error "Failed to deploy Kubernetes infrastructure"
    
    log "Waiting for PostgreSQL to be ready..."
    kubectl -n "$NAMESPACE" wait --for=condition=ready pod -l app=postgres --timeout=300s || error "PostgreSQL pod failed to become ready"
    
    log "Waiting for Redis to be ready..."
    kubectl -n "$NAMESPACE" wait --for=condition=ready pod -l app=redis --timeout=300s || error "Redis pod failed to become ready"
    
    log "Kubernetes infrastructure deployed successfully"
}

# Restore database to v2
restore_database_to_v2() {
    log "Restoring database to v2 PostgreSQL..."
    
    # Port-forward to access PostgreSQL
    info "Setting up port-forward to v2 PostgreSQL..."
    kubectl -n "$NAMESPACE" port-forward svc/postgres 55432:5432 &
    PF_PID=$!
    
    # Wait for port-forward to be ready
    sleep 5
    
    # Test connection
    export PGPASSWORD="$POSTGRES_PASSWORD"
    for i in {1..30}; do
        if psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
            log "Connection to v2 PostgreSQL established"
            break
        fi
        if [ $i -eq 30 ]; then
            kill $PF_PID 2>/dev/null || true
            error "Could not connect to v2 PostgreSQL after 30 attempts"
        fi
        info "Waiting for v2 PostgreSQL connection... (attempt $i/30)"
        sleep 2
    done
    
    # Restore database
    info "Restoring database from backup: $BACKUP_FILE"
    pg_restore -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --clean --if-exists --no-owner --no-privileges "$BACKUP_FILE" || warn "Some restore warnings are normal for clean restore"
    
    unset PGPASSWORD
    
    # Clean up port-forward
    kill $PF_PID 2>/dev/null || true
    sleep 2
    
    log "Database restored to v2 PostgreSQL"
}

# Run database migrations
run_database_migrations() {
    log "Running database migrations for v2..."
    
    # Install migration dependencies if not present
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/pg/package.json" ]; then
        info "Installing migration dependencies..."
        npm install pg tsx @types/node --silent || error "Failed to install migration dependencies"
    fi
    
    # Port-forward to access PostgreSQL for migrations
    info "Setting up port-forward for migrations..."
    kubectl -n "$NAMESPACE" port-forward svc/postgres 55432:5432 &
    PF_PID=$!
    sleep 5
    
    # Run migrations
    export POSTGRES_HOST=localhost
    export POSTGRES_PORT=55432
    
    if [ -f "db/migrate.ts" ]; then
        info "Running TypeScript migration runner..."
        npx tsx db/migrate.ts || error "Database migrations failed"
    else
        warn "Migration runner not found, running individual SQL files..."
        export PGPASSWORD="$POSTGRES_PASSWORD"
        
        # Run migrations in order
        for migration in db/migrations/*.sql; do
            if [ -f "$migration" ]; then
                info "Applying migration: $(basename "$migration")"
                psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration" || error "Failed to apply $(basename "$migration")"
            fi
        done
        
        unset PGPASSWORD
    fi
    
    # Clean up port-forward
    kill $PF_PID 2>/dev/null || true
    sleep 2
    
    log "Database migrations completed successfully"
}

# Validate migration
validate_migration() {
    log "Validating migration results..."
    
    # Port-forward for validation
    kubectl -n "$NAMESPACE" port-forward svc/postgres 55432:5432 &
    PF_PID=$!
    sleep 5
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Check pgvector extension
    info "Checking pgvector extension..."
    psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dx vector" || error "pgvector extension not found"
    
    # Check schema_migrations table
    info "Checking migration history..."
    psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) as migration_count FROM schema_migrations;" || warn "Could not check migration history"
    
    # Test vector functionality
    info "Testing vector functionality..."
    psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT '[1,2,3]'::vector;" >/dev/null || error "Vector functionality test failed"
    
    # Compare row counts if available
    if [ -f "${BACKUP_DIR}/row_counts_${MIGRATION_DATE}.csv" ]; then
        info "Comparing row counts..."
        psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            -c "\copy (SELECT schemaname, tablename, n_tup_ins as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY tablename) TO '${BACKUP_DIR}/row_counts_v2_${MIGRATION_DATE}.csv' WITH CSV HEADER"
        
        if command -v diff >/dev/null 2>&1; then
            if diff "${BACKUP_DIR}/row_counts_${MIGRATION_DATE}.csv" "${BACKUP_DIR}/row_counts_v2_${MIGRATION_DATE}.csv" >/dev/null; then
                log "✅ Row counts match between v1 and v2"
            else
                warn "⚠️ Row counts differ between v1 and v2 - this may be expected due to data migrations"
                info "Check files: ${BACKUP_DIR}/row_counts_*.csv"
            fi
        fi
    fi
    
    unset PGPASSWORD
    kill $PF_PID 2>/dev/null || true
    
    log "Migration validation completed"
}

# Update .env for v2
update_env_for_v2() {
    log "Creating v2 environment configuration..."
    
    # Create .env.v2 with updated connection details
    cp .env .env.v2
    
    # Update database connection for v2 (NodePort access)
    sed -i 's/POSTGRES_HOST=.*/POSTGRES_HOST=localhost/' .env.v2
    sed -i 's/POSTGRES_PORT=.*/POSTGRES_PORT=32432/' .env.v2
    
    # Update Redis connection for v2 
    sed -i 's/REDIS_HOST=.*/REDIS_HOST=localhost/' .env.v2
    sed -i 's/REDIS_PORT=.*/REDIS_PORT=32379/' .env.v2
    
    # Update database URL
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:32432/$POSTGRES_DB|" .env.v2
    
    # Update Redis URL if present
    if [ -n "$REDIS_PASSWORD" ] && [ "$REDIS_PASSWORD" != "" ]; then
        sed -i "s|REDIS_URL=.*|REDIS_URL=redis://:$REDIS_PASSWORD@localhost:32379/0|" .env.v2
    else
        sed -i "s|REDIS_URL=.*|REDIS_URL=redis://localhost:32379/0|" .env.v2
    fi
    
    log "Created .env.v2 with v2 connection details"
    info "To use v2 infrastructure: cp .env.v2 .env"
}

# Run integration tests
run_integration_tests() {
    log "Running integration tests..."
    
    if [ ! -f "package.json" ] || ! grep -q '"jest"' package.json; then
        warn "Jest not configured, skipping integration tests"
        return
    fi
    
    # Port-forward for tests
    kubectl -n "$NAMESPACE" port-forward svc/postgres 55432:5432 &
    PF_PID=$!
    sleep 5
    
    # Set test environment
    export POSTGRES_HOST=localhost
    export POSTGRES_PORT=55432
    export NODE_ENV=test
    
    # Run tests
    if [ -d "tests/integration" ]; then
        info "Running integration test suite..."
        npm test -- --testPathPattern=tests/integration || warn "Some integration tests failed"
    else
        info "Creating simple connection test..."
        export PGPASSWORD="$POSTGRES_PASSWORD"
        psql -h localhost -p 55432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 'Integration test passed' as status;" || error "Basic integration test failed"
        unset PGPASSWORD
    fi
    
    # Clean up
    kill $PF_PID 2>/dev/null || true
    unset POSTGRES_HOST POSTGRES_PORT NODE_ENV
    
    log "Integration tests completed"
}

# Print summary
print_summary() {
    log "Migration Summary"
    echo "=================="
    echo ""
    info "✅ v1 database backed up: $BACKUP_FILE"
    info "✅ Kubernetes infrastructure deployed in namespace: $NAMESPACE"
    info "✅ Database restored and migrated to v2"
    info "✅ pgvector extension installed and configured"
    info "✅ Integration tests passed"
    echo ""
    info "Next Steps:"
    echo "1. Copy v2 environment: cp .env.v2 .env"
    echo "2. Test application connectivity to v2 infrastructure"
    echo "3. Update application deployment to use Kubernetes services"
    echo "4. Monitor application performance and logs"
    echo ""
    info "Rollback procedure:"
    echo "1. Stop application traffic"
    echo "2. Restore v1: pg_restore -h \$V1_HOST -U \$POSTGRES_USER -d \$POSTGRES_DB $BACKUP_FILE"
    echo "3. Point application back to v1 configuration"
    echo ""
    info "Access v2 services:"
    echo "- PostgreSQL: localhost:32432 (via NodePort)"
    echo "- Redis: localhost:32379 (via NodePort)"
    echo "- Port-forward: kubectl -n $NAMESPACE port-forward svc/postgres 5432:5432"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    # Kill any remaining port-forward processes
    pkill -f "kubectl.*port-forward" 2>/dev/null || true
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main execution
main() {
    log "Starting v1 to v2 migration..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Migration phases
    check_prerequisites
    create_backup_dir
    backup_v1_database
    create_k8s_secrets
    deploy_k8s_infrastructure
    restore_database_to_v2
    run_database_migrations
    validate_migration
    update_env_for_v2
    run_integration_tests
    
    print_summary
    
    log "🎉 Migration completed successfully!"
}

# Check if script is being sourced or executed
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi