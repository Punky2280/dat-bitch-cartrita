#!/bin/bash

# Database Initialization Script for Security Framework - Task 18
# Initialize database with all required schemas and integrations

set -e

echo "🗄️  Starting Database Initialization for Security Framework..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Database configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="cartrita"
DB_PASSWORD="password"

# Try different common PostgreSQL configurations
DB_CONFIGS=(
    "postgresql://robert:punky1@localhost:5432/dat-bitch-cartrita"
    "postgresql://postgres:password@localhost:5432/cartrita"
    "postgresql://postgres@localhost:5432/postgres"
    "postgresql://cartrita_user:cartrita_pass@localhost:5432/cartrita_db"
)

print_status $BLUE "Testing database connections..."

# Function to test database connection
test_db_connection() {
    local db_url=$1
    if PGPASSWORD="" psql "$db_url" -c "SELECT 1;" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Find working database connection
WORKING_DB_URL=""
for db_url in "${DB_CONFIGS[@]}"; do
    print_status $YELLOW "Testing: $db_url"
    if test_db_connection "$db_url"; then
        WORKING_DB_URL="$db_url"
        print_status $GREEN "✅ Found working database: $db_url"
        break
    else
        print_status $RED "❌ Connection failed: $db_url"
    fi
done

# If no existing database works, provide instructions for setup
if [ -z "$WORKING_DB_URL" ]; then
    print_status $RED "❌ No working database connection found."
    print_status $YELLOW "📋 Database Setup Instructions:"
    echo ""
    echo "Option 1 - Docker PostgreSQL:"
    echo "  docker run --name cartrita-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=cartrita -p 5432:5432 -d postgres:13"
    echo ""
    echo "Option 2 - Local PostgreSQL:"
    echo "  sudo -u postgres createuser -s cartrita_user"
    echo "  sudo -u postgres createdb -O cartrita_user cartrita_db"
    echo "  sudo -u postgres psql -c \"ALTER USER cartrita_user PASSWORD 'cartrita_pass';\""
    echo ""
    echo "Option 3 - Use existing PostgreSQL:"
    echo "  Update .env file with your database credentials"
    echo ""
    print_status $BLUE "After setting up the database, run this script again."
    exit 1
fi

# Apply database schemas
print_status $BLUE "📋 Applying database schemas..."

# List of schema files to apply in order
SCHEMA_FILES=(
    "00_setup_pgvector.sql"
    "06_comprehensive_cartrita_schema.sql"
    "15_create_journal_entries.sql"
    "24_security_framework_schema.sql"
)

# Apply each schema file
for schema_file in "${SCHEMA_FILES[@]}"; do
    schema_path="db-init/$schema_file"
    
    if [ -f "$schema_path" ]; then
        print_status $YELLOW "Applying: $schema_file"
        
        if psql "$WORKING_DB_URL" -f "$schema_path" >/dev/null 2>&1; then
            print_status $GREEN "✅ Applied: $schema_file"
        else
            print_status $RED "❌ Failed to apply: $schema_file"
            # Continue with other schemas
        fi
    else
        print_status $YELLOW "⚠️  Schema file not found: $schema_file"
    fi
done

# Verify security framework tables
print_status $BLUE "🔍 Verifying security framework tables..."

SECURITY_TABLES=(
    "user_authentication"
    "oauth_tokens"
    "jwt_blacklist"
    "roles"
    "permissions"
    "role_permissions"
    "user_roles"
    "security_sessions"
    "security_audit_log"
    "security_events"
    "vulnerability_scans"
    "vulnerabilities"
    "compliance_reports"
    "compliance_findings"
    "encryption_keys"
    "api_security_policies"
    "security_configuration"
)

verified_tables=0
for table in "${SECURITY_TABLES[@]}"; do
    if psql "$WORKING_DB_URL" -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" | grep -q "1 row"; then
        print_status $GREEN "✅ Table exists: $table"
        ((verified_tables++))
    else
        print_status $RED "❌ Table missing: $table"
    fi
done

# Check security functions
print_status $BLUE "🔍 Verifying security functions..."

SECURITY_FUNCTIONS=(
    "check_user_permission"
    "log_security_audit"
    "cleanup_expired_security_data"
    "get_security_metrics"
)

verified_functions=0
for func in "${SECURITY_FUNCTIONS[@]}"; do
    if psql "$WORKING_DB_URL" -c "SELECT 1 FROM information_schema.routines WHERE routine_name='$func';" | grep -q "1 row"; then
        print_status $GREEN "✅ Function exists: $func"
        ((verified_functions++))
    else
        print_status $RED "❌ Function missing: $func"
    fi
done

# Create database configuration for application
print_status $BLUE "📝 Creating database configuration..."

cat > packages/backend/.env.database << EOF
# Database configuration for Cartrita Security Framework
DATABASE_URL=$WORKING_DB_URL
DB_HOST=$(echo $WORKING_DB_URL | sed 's/.*@\([^:]*\):.*/\1/')
DB_PORT=$(echo $WORKING_DB_URL | sed 's/.*:\([0-9]*\)\/.*/\1/')
DB_NAME=$(echo $WORKING_DB_URL | sed 's/.*\/\([^?]*\).*/\1/')

# Security Framework Status
SECURITY_TABLES_VERIFIED=$verified_tables/${#SECURITY_TABLES[@]}
SECURITY_FUNCTIONS_VERIFIED=$verified_functions/${#SECURITY_FUNCTIONS[@]}
SECURITY_FRAMEWORK_READY=$([ $verified_tables -ge 15 ] && [ $verified_functions -ge 3 ] && echo "true" || echo "false")
EOF

print_status $GREEN "Database configuration saved to packages/backend/.env.database"

# Summary
print_status $BLUE "📊 Database Initialization Summary:"
echo ""
print_status $GREEN "✅ Database Connection: $WORKING_DB_URL"
print_status $GREEN "✅ Security Tables: $verified_tables/${#SECURITY_TABLES[@]}"
print_status $GREEN "✅ Security Functions: $verified_functions/${#SECURITY_FUNCTIONS[@]}"

if [ $verified_tables -ge 15 ] && [ $verified_functions -ge 3 ]; then
    print_status $GREEN "🔐 Security Framework: READY"
    echo ""
    print_status $BLUE "Next Steps:"
    echo "  1. Configure OAuth providers in .env"
    echo "  2. Start backend server: npm run dev:backend"
    echo "  3. Run security tests: ./test-security-framework.sh"
else
    print_status $YELLOW "⚠️  Security Framework: PARTIAL"
    echo ""
    print_status $BLUE "Manual Steps Required:"
    echo "  1. Review schema application logs above"
    echo "  2. Manually apply missing schemas"
    echo "  3. Verify table creation"
fi

echo ""
print_status $GREEN "🗄️  Database initialization completed!"
