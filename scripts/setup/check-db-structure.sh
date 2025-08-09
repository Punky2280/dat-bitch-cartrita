#!/bin/bash
# scripts/check-db-structure.sh

echo "🔍 Checking Database Structure"
echo "=============================="

# Function to check if Docker containers are running
check_containers() {
  echo "📋 Checking Docker containers..."
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cartrita
  echo ""
}

# Function to check database connection
check_db_connection() {
  echo "🔌 Testing database connection..."
  if docker ps | grep -q "cartrita-db-dev"; then
      container="cartrita-db-dev"
  elif docker ps | grep -q "cartrita-db"; then
      container="cartrita-db"
  else
      echo "❌ No database container running"
      echo "💡 Run: ./scripts/docker-setup.sh dev"
      return 1
  fi
  
  docker exec $container pg_isready -U robert -d dat-bitch-cartrita
  if [ $? -eq 0 ]; then
      echo "✅ Database connection successful!"
      return 0
  else
      echo "❌ Database connection failed!"
      return 1
  fi
}

# Function to list all tables
list_tables() {
  echo "📊 Database tables:"
  docker exec $container psql -U robert -d dat-bitch-cartrita -c "\dt"
  echo ""
}

# Function to check pgvector extension
check_pgvector() {
  echo "🔍 Checking pgvector extension..."
  docker exec $container psql -U robert -d dat-bitch-cartrita -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
  echo ""
}

# Function to check vector columns
check_vector_columns() {
  echo "📐 Checking vector columns..."
  docker exec $container psql -U robert -d dat-bitch-cartrita -c "
      SELECT 
          table_name, 
          column_name, 
          data_type,
          udt_name
      FROM information_schema.columns 
      WHERE data_type = 'USER-DEFINED' 
      AND udt_name = 'vector';"
  echo ""
}

# Function to show database size
show_db_size() {
  echo "💾 Database size information..."
  docker exec $container psql -U robert -d dat-bitch-cartrita -c "
      SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
  echo ""
}

# Function to check init scripts execution
check_init_scripts() {
  echo "📜 Checking if init scripts were executed..."
  echo "Files in db-init directory:"
  ls -la ./db-init/
  echo ""
  
  echo "Checking if tables from init scripts exist..."
  docker exec $container psql -U robert -d dat-bitch-cartrita -c "
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;"
  echo ""
}

# Main execution
main() {
  check_containers
  if check_db_connection; then
      list_tables
      check_pgvector
      check_vector_columns
      show_db_size
      check_init_scripts
  else
      echo "Cannot proceed with database checks."
      echo ""
      echo "🔧 Troubleshooting:"
      echo "1. Start the database: ./scripts/docker-setup.sh dev"
      echo "2. Check container logs: docker logs cartrita-db-dev"
      echo "3. Verify db-init files are present in ./db-init/"
  fi
}

# Run main function
main
