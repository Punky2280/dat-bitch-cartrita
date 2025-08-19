#!/bin/bash

# Cartrita v1 to v2 Migration - Docker Compose Version
# This script migrates from v1 to v2 using Docker Compose instead of Kubernetes

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[migrate]${NC} $1"
}

success() {
    echo -e "${GREEN}[migrate]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[migrate]${NC} $1"
}

error() {
    echo -e "${RED}[migrate]${NC} $1" >&2
    cleanup
    exit 1
}

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
V1_ENV_FILE="$SCRIPT_DIR/.env"
V2_ENV_FILE="$SCRIPT_DIR/.env.v2"
MIGRATION_STATE_FILE="$SCRIPT_DIR/.migration_state"

# Cleanup function
cleanup() {
    log "Cleaning up..."
    # Remove temporary files if any
    [ -f "$SCRIPT_DIR/.temp_migration" ] && rm -f "$SCRIPT_DIR/.temp_migration"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required commands
    command -v docker >/dev/null 2>&1 || error "docker is required but not installed"
    command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || error "docker-compose is required but not installed"
    command -v npm >/dev/null 2>&1 || error "npm is required but not installed"
    command -v psql >/dev/null 2>&1 || warn "psql not found - will try using container"
    
    # Check if .env file exists
    [ -f "$V1_ENV_FILE" ] || error "v1 .env file not found at $V1_ENV_FILE"
    
    # Check Docker daemon
    docker info >/dev/null 2>&1 || error "Docker daemon is not running"
    
    success "Prerequisites check passed"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    # Copy current .env for rollback
    cp "$V1_ENV_FILE" "$BACKUP_DIR/.env.v1.backup"
    
    success "Backup directory created"
}

# Backup v1 database
backup_v1_database() {
    log "Backing up v1 database..."
    
    # Get database connection info from .env file
    source "$V1_ENV_FILE"
    local db_container="cartrita-db-new"
    local backup_file="$BACKUP_DIR/v1_database_backup.sql"
    local db_user="${POSTGRES_USER:-robert}"
    local db_name="${POSTGRES_DB:-dat-bitch-cartrita}"
    
    # Check if database container is running
    if ! docker ps --format "table {{.Names}}" | grep -q "^${db_container}$"; then
        error "Database container '$db_container' is not running"
    fi
    
    # Create database backup using the running container
    log "Creating database backup with user: $db_user, database: $db_name"
    docker exec "$db_container" pg_dump -U "$db_user" "$db_name" > "$backup_file" || error "Failed to create database backup"
    
    # Verify backup
    local backup_size=$(wc -l < "$backup_file")
    log "Database backup created with $backup_size lines"
    
    # Also backup the schema for comparison
    docker exec "$db_container" pg_dump -U "$db_user" -s "$db_name" > "$BACKUP_DIR/v1_schema_backup.sql"
    
    success "Database backup completed: $backup_file"
}

# Apply database migrations
apply_database_migrations() {
    log "Applying database migrations..."
    
    # Get database connection info from .env file
    source "$V1_ENV_FILE"
    local db_container="cartrita-db-new"
    local migration_dir="$SCRIPT_DIR/db/migrations"
    local db_user="${POSTGRES_USER:-robert}"
    local db_name="${POSTGRES_DB:-dat-bitch-cartrita}"
    
    # Check if migrations directory exists
    [ -d "$migration_dir" ] || error "Migrations directory not found: $migration_dir"
    
    # Install migration dependencies if not already installed
    log "Installing migration dependencies..."
    cd "$SCRIPT_DIR"
    npm install --save-dev typescript ts-node @types/node @types/pg || warn "Failed to install migration dependencies"
    
    # Create migrations table if it doesn't exist
    log "Setting up migration tracking..."
    docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c "
        CREATE TABLE IF NOT EXISTS migration_history (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    " || error "Failed to create migration_history table"
    
    # Apply each migration in order
    for migration_file in "$migration_dir"/*.sql; do
        if [ -f "$migration_file" ]; then
            local filename=$(basename "$migration_file")
            local version=$(echo "$filename" | sed 's/^\([0-9]*\)_.*/\1/')
            local name=$(echo "$filename" | sed 's/^[0-9]*_\(.*\)\.sql$/\1/')
            
            log "Checking migration: $filename"
            
            # Check if migration already applied
            local already_applied=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM migration_history WHERE version = '$version';" | xargs)
            
            if [ "$already_applied" -eq "0" ]; then
                log "Applying migration: $filename"
                
                # Calculate checksum
                local checksum=$(sha256sum "$migration_file" | cut -d' ' -f1)
                
                # Apply migration
                docker exec -i "$db_container" psql -U "$db_user" -d "$db_name" < "$migration_file" || error "Failed to apply migration: $filename"
                
                # Record migration
                docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c "
                    INSERT INTO migration_history (version, name, checksum) 
                    VALUES ('$version', '$name', '$checksum');
                " || error "Failed to record migration: $filename"
                
                success "Applied migration: $filename"
            else
                log "Migration already applied: $filename"
            fi
        fi
    done
    
    success "Database migrations completed"
}

# Create v2 environment configuration
create_v2_config() {
    log "Creating v2 environment configuration..."
    
    # Copy v1 .env to v2 .env (preserving all credentials)
    cp "$V1_ENV_FILE" "$V2_ENV_FILE"
    
    # Add v2-specific configurations if not present
    if ! grep -q "REDIS_HOST" "$V2_ENV_FILE"; then
        echo "" >> "$V2_ENV_FILE"
        echo "# V2 Infrastructure Configuration" >> "$V2_ENV_FILE"
        echo "REDIS_HOST=localhost" >> "$V2_ENV_FILE"
        echo "REDIS_PORT=6379" >> "$V2_ENV_FILE"
    fi
    
    if ! grep -q "VECTOR_DB_ENABLED" "$V2_ENV_FILE"; then
        echo "VECTOR_DB_ENABLED=true" >> "$V2_ENV_FILE"
        echo "EMBEDDING_DIMENSION=1536" >> "$V2_ENV_FILE"
        echo "VECTOR_INDEX_TYPE=hnsw" >> "$V2_ENV_FILE"
    fi
    
    success "v2 environment configuration created: $V2_ENV_FILE"
}

# Test database connectivity and migrations
test_database_connectivity() {
    log "Testing database connectivity and migrations..."
    
    # Get database connection info from .env file
    source "$V1_ENV_FILE"
    local db_container="cartrita-db-new"
    local db_user="${POSTGRES_USER:-robert}"
    local db_name="${POSTGRES_DB:-dat-bitch-cartrita}"
    
    # Test basic connectivity
    docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null || error "Database connectivity test failed"
    
    # Test pgvector extension
    local has_pgvector=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" | xargs)
    if [ "$has_pgvector" -eq "1" ]; then
        success "pgvector extension is installed and working"
    else
        warn "pgvector extension not found - some v2 features may not work"
    fi
    
    # Test embeddings table
    local has_embeddings_table=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'embeddings';" | xargs)
    if [ "$has_embeddings_table" -eq "1" ]; then
        success "Embeddings table exists"
        
        # Test vector operations
        docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c "SELECT similarity_search(ARRAY[0.1,0.2,0.3]::real[], 'test', 1);" >/dev/null 2>&1 && success "Vector search functions working" || warn "Vector search functions may have issues"
    else
        warn "Embeddings table not found - vector search features unavailable"
    fi
    
    # Count total migrations applied
    local migrations_count=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM migration_history;" | xargs)
    success "Database tests completed - $migrations_count migrations applied"
}

# Restart services with v2 configuration
restart_services_v2() {
    log "Restarting services with v2 configuration..."
    
    # Stop current v1 services
    log "Stopping v1 services..."
    docker-compose down || warn "Could not stop services with docker-compose"
    
    # Wait a moment for services to stop
    sleep 5
    
    # Start with v2 configuration if available
    if [ -f "$SCRIPT_DIR/docker-compose.v2.yml" ]; then
        log "Starting v2 services..."
        cp "$V2_ENV_FILE" "$V1_ENV_FILE"  # Use v2 config as main config
        docker-compose -f docker-compose.v2.yml up -d || warn "Could not start v2 services"
    else
        log "Starting services with updated configuration..."
        cp "$V2_ENV_FILE" "$V1_ENV_FILE"  # Use v2 config as main config
        docker-compose up -d || error "Failed to restart services"
    fi
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Test service health
    if curl -f http://localhost:8001/health >/dev/null 2>&1; then
        success "Backend service is responding"
    else
        warn "Backend service may not be ready yet"
    fi
    
    success "Services restarted with v2 configuration"
}

# Create migration state file
create_migration_state() {
    log "Creating migration state file..."
    
    cat > "$MIGRATION_STATE_FILE" << EOF
{
    "migration_version": "v1_to_v2",
    "migration_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_location": "$BACKUP_DIR",
    "status": "completed",
    "database_migrated": true,
    "config_migrated": true,
    "services_restarted": true
}
EOF
    
    success "Migration state recorded: $MIGRATION_STATE_FILE"
}

# Validate migration completion
validate_migration() {
    log "Validating migration completion..."
    
    # Get database connection info from .env file
    source "$V1_ENV_FILE"
    local db_user="${POSTGRES_USER:-robert}"
    local db_name="${POSTGRES_DB:-dat-bitch-cartrita}"
    
    # Check if v2 .env file exists and has required content
    [ -f "$V2_ENV_FILE" ] || error "v2 .env file missing"
    
    # Check database migrations
    local db_container="cartrita-db-new"
    if docker ps --format "table {{.Names}}" | grep -q "^${db_container}$"; then
        local migrations_count=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM migration_history WHERE version >= '0002';" 2>/dev/null | xargs || echo "0")
        if [ "$migrations_count" -gt "0" ]; then
            success "v2 database migrations validated"
        else
            warn "v2 database migrations may not be complete"
        fi
    else
        warn "Database container not available for validation"
    fi
    
    # Check if services are running
    if docker ps --format "table {{.Names}}" | grep -q "cartrita"; then
        success "Cartrita services are running"
    else
        warn "Cartrita services may not be running"
    fi
    
    success "Migration validation completed"
}

# Main migration function
main() {
    log "Starting v1 to v2 migration (Docker Compose version)..."
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    # Execute migration steps
    check_prerequisites
    create_backup_dir
    backup_v1_database
    apply_database_migrations
    create_v2_config
    test_database_connectivity
    restart_services_v2
    create_migration_state
    validate_migration
    
    success "🎉 Migration completed successfully!"
    success "v1 backup stored in: $BACKUP_DIR"
    success "v2 configuration: $V2_ENV_FILE"
    success "Migration state: $MIGRATION_STATE_FILE"
    
    log "Next steps:"
    log "1. Test your application thoroughly"
    log "2. If everything works, you can remove the backup: rm -rf $BACKUP_DIR"
    log "3. Consider transitioning to Kubernetes later using the full migration script"
    
    success "🚀 Cartrita v2 is now running!"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi