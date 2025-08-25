#!/bin/bash

# Cartrita Database Setup Script
echo "🚀 Setting up Cartrita database schema..."

# Database connection details
DB_HOST="localhost"
DB_PORT="5435"
DB_NAME="dat-bitch-cartrita"
DB_USER="robert"
DB_PASSWORD="punky1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if PostgreSQL is running
check_postgres() {
    echo "🔍 Checking PostgreSQL connection..."
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is running and accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
        echo "Make sure your Docker containers are running:"
        echo "docker-compose up -d postgres"
        return 1
    fi
}

# Function to execute SQL script
execute_sql() {
    echo "📝 Executing database schema setup..."
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f fix-database-schema.sql; then
        echo -e "${GREEN}✅ Database schema setup completed successfully!${NC}"
        return 0
    else
        echo -e "${RED}❌ Error executing SQL script${NC}"
        return 1
    fi
}

# Function to verify tables were created
verify_setup() {
    echo "🔍 Verifying database setup..."
    TABLES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    " | tr -d ' ' | grep -v '^$')
    
    echo -e "${YELLOW}📋 Created tables:${NC}"
    echo "$TABLES" | while read table; do
        if [ ! -z "$table" ]; then
            echo "  ✓ $table"
        fi
    done
}

# Main execution
main() {
    echo "🎯 Cartrita Database Setup"
    echo "=========================="
    
    # Check if SQL file exists
    if [ ! -f "fix-database-schema.sql" ]; then
        echo -e "${RED}❌ fix-database-schema.sql file not found!${NC}"
        echo "Please create the SQL file first."
        exit 1
    fi
    
    # Check PostgreSQL connection
    if ! check_postgres; then
        exit 1
    fi
    
    # Execute SQL script
    if ! execute_sql; then
        exit 1
    fi
    
    # Verify setup
    verify_setup
    
    echo ""
    echo -e "${GREEN}🎉 Database setup completed!${NC}"
    echo "You can now restart your Cartrita application:"
    echo "  docker-compose restart backend"
}

# Run main function
main
