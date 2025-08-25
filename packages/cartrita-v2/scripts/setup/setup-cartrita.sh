#!/bin/bash
# setup-cartrita.sh - Complete setup script for Cartrita Backend

set -e  # Exit on any error

PROJECT_ROOT="/home/robbie/development/dat-bitch-cartrita"
DB_INIT_PATH="$PROJECT_ROOT/db-init"

echo "🚀 Cartrita Backend Complete Setup"
echo "=================================="
echo "Project Root: $PROJECT_ROOT"
echo "DB Init Path: $DB_INIT_PATH"
echo ""

# Function to check if we're in the right directory
check_directory() {
  if [ ! -d "$DB_INIT_PATH" ]; then
      echo "❌ Error: db-init directory not found at $DB_INIT_PATH"
      echo "Please run this script from the project root or check the path"
      exit 1
  fi
  
  if [ ! -f "$DB_INIT_PATH/00_setup_pgvector.sql" ]; then
      echo "❌ Error: pgvector setup file not found"
      echo "Expected: $DB_INIT_PATH/00_setup_pgvector.sql"
      exit 1
  fi
  
  echo "✅ Found existing db-init directory with $(ls -1 $DB_INIT_PATH/*.sql | wc -l) SQL files"
}

# Function to create directory structure
create_directories() {
  echo "📁 Creating directory structure..."
  
  mkdir -p "$PROJECT_ROOT/scripts"
  mkdir -p "$PROJECT_ROOT/logs"
  mkdir -p "$PROJECT_ROOT/uploads"
  mkdir -p "$PROJECT_ROOT/backups"
  mkdir -p "$PROJECT_ROOT/utils"
  
  echo "✅ Directories created"
}

# Function to create Docker files
create_docker_files() {
  echo "🐳 Creating Docker configuration files..."
  
  # Create docker-compose.yml
  cat > "$PROJECT_ROOT/docker-compose.yml" << 'EOF'
version: '3.8'

services:
# PostgreSQL Database with pgvector
db:
  image: pgvector/pgvector:pg15
  container_name: cartrita-db
  restart: unless-stopped
  environment:
    POSTGRES_USER: robert
    POSTGRES_PASSWORD: punky1
    POSTGRES_DB: dat-bitch-cartrita
    POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./db-init:/docker-entrypoint-initdb.d
  ports:
    - "5432:5432"
  networks:
    - cartrita-network
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U robert -d dat-bitch-cartrita"]
    interval: 10s
    timeout: 5s
    retries: 5
  command: >
    postgres
    -c shared_preload_libraries=vector
    -c max_connections=200
    -c shared_buffers=256MB
    -c effective_cache_size=1GB

# Redis for caching and session management
redis:
  image: redis:7-alpine
  container_name: cartrita-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  networks:
    - cartrita-network
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru

volumes:
postgres_data:
  driver: local
redis_data:
  driver: local

networks:
cartrita-network:
  driver: bridge
EOF

  # Create docker-compose.dev.yml
  cat > "$PROJECT_ROOT/docker-compose.dev.yml" << 'EOF'
version: '3.8'

services:
# PostgreSQL Database with pgvector
db:
  image: pgvector/pgvector:pg15
  container_name: cartrita-db-dev
  restart: unless-stopped
  environment:
    POSTGRES_USER: robert
    POSTGRES_PASSWORD: punky1
    POSTGRES_DB: dat-bitch-cartrita
    POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
  volumes:
    - postgres_data_dev:/var/lib/postgresql/data
    - ./db-init:/docker-entrypoint-initdb.d
  ports:
    - "5432:5432"
  networks:
    - cartrita-network-dev
  command: >
    postgres
    -c shared_preload_libraries=vector
    -c log_statement=all
    -c log_destination=stderr
    -c logging_collector=on
    -c log_min_messages=info

# Redis for development
redis:
  image: redis:7-alpine
  container_name: cartrita-redis-dev
  restart: unless-stopped
  ports:
    - "6379:6379"
  networks:
    - cartrita-network-dev
  command: redis-server --appendonly yes

volumes:
postgres_data_dev:
  driver: local

networks:
cartrita-network-dev:
  driver: bridge
EOF

  echo "✅ Docker files created"
}

# Function to create environment template
create_env_template() {
  cat > "$PROJECT_ROOT/.env.template" << 'EOF'
# .env.template

# Server Configuration
PORT=8001
NODE_ENV=development

# PostgreSQL Configuration
POSTGRES_USER=robert
POSTGRES_PASSWORD=punky1
POSTGRES_DB=dat-bitch-cartrita
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Database URL for the application
DATABASE_URL=postgresql://robert:punky1@db:5432/dat-bitch-cartrita

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# LangChain Configuration
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langchain_api_key_here
LANGCHAIN_PROJECT=cartrita-backend

# Vector Database Configuration
VECTOR_DIMENSION=1536
EMBEDDING_MODEL=text-embedding-ada-002

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF
}

# Function to create management scripts
create_scripts() {
  echo "📜 Creating management scripts..."
  
  # Create main docker setup script
  cat > "$PROJECT_ROOT/scripts/docker-setup.sh" << 'EOF'
#!/bin/bash
# scripts/docker-setup.sh

echo "🐳 Docker Setup for Cartrita Backend"
echo "===================================="

# Function to start development environment with build
start_dev() {
  echo "🛠️  Starting development environment with build..."
  
  if [ ! -f .env ]; then
      echo "⚠️  .env file not found. Creating from template..."
      if [ -f .env.template ]; then
          cp .env.template .env
          echo "📝 Please edit .env file with your API keys before starting"
          return 1
      fi
  fi
  
  mkdir -p logs uploads
  
  echo "🔨 Building and starting development containers..."
  docker compose -f docker-compose.dev.yml up --build -d
  
  echo "✅ Development environment started!"
  echo "Database: localhost:5432"
  echo "Redis: localhost:6379"
  
  # Wait for containers to be ready
  echo "⏳ Waiting for containers to be ready..."
  sleep 10
  
  echo "🔍 Checking database structure..."
  ./scripts/check-db-structure.sh
}

# Function to start production environment with build
start_prod() {
  echo "🚀 Starting production environment with build..."
  
  if [ ! -f .env ]; then
      echo "⚠️  .env file not found. Creating from template..."
      if [ -f .env.template ]; then
          cp .env.template .env
          echo "📝 Please edit .env file with your API keys before starting"
          return 1
      fi
  fi
  
  mkdir -p logs uploads
  
  echo "🔨 Building and starting containers..."
  docker compose up --build -d
  
  echo "✅ Production environment started!"
  echo "Database: localhost:5432"
  echo "Redis: localhost:6379"
  
  # Wait for containers to be ready
  echo "⏳ Waiting for containers to be ready..."
  sleep 10
  
  # Check status
  ./scripts/docker-setup.sh status
}

# Function to stop all services
stop_all() {
  echo "🛑 Stopping all services..."
  docker compose down
  docker compose -f docker-compose.dev.yml down
  echo "✅ All services stopped!"
}

# Function to view logs
view_logs() {
  echo "📋 Viewing logs..."
  
  # Determine which compose file to use
  compose_file=""
  if docker ps | grep -q "cartrita.*dev"; then
      compose_file="-f docker-compose.dev.yml"
  fi
  
  if [ "$2" = "db" ]; then
      docker compose $compose_file logs -f db
  elif [ "$2" = "redis" ]; then
      docker compose $compose_file logs -f redis
  else
      docker compose $compose_file logs -f
  fi
}

# Function to reset database
reset_db() {
  echo "🗑️  Resetting database..."
  echo "⚠️  This will destroy all data! Are you sure? (y/N)"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
      docker compose down -v
      docker compose -f docker-compose.dev.yml down -v
      docker volume rm $(docker volume ls -q | grep postgres) 2>/dev/null || true
      echo "✅ Database reset complete!"
      echo "💡 Run './scripts/docker-setup.sh dev' to recreate with your db-init scripts"
  else
      echo "❌ Database reset cancelled"
  fi
}

# Function to backup database
backup_db() {
  echo "💾 Creating database backup..."
  mkdir -p backups
  timestamp=$(date +%Y%m%d_%H%M%S)
  
  if docker ps | grep -q "cartrita-db-dev"; then
      container="cartrita-db-dev"
  elif docker ps | grep -q "cartrita-db"; then
      container="cartrita-db"
  else
      echo "❌ No database container running"
      return 1
  fi
  
  docker exec $container pg_dump -U robert dat-bitch-cartrita > "backups/backup_${timestamp}.sql"
  echo "✅ Backup created: backups/backup_${timestamp}.sql"
}

# Function to connect to database
db_shell() {
  echo "🔗 Connecting to database..."
  
  if docker ps | grep -q "cartrita-db-dev"; then
      container="cartrita-db-dev"
  elif docker ps | grep -q "cartrita-db"; then
      container="cartrita-db"
  else
      echo "❌ No database container running"
      return 1
  fi
  
  docker exec -it $container psql -U robert dat-bitch-cartrita
}

# Function to show status
show_status() {
  echo "�� Current Status"
  echo "================"
  echo ""
  echo "🐳 Docker Containers:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cartrita
  echo ""
  echo "💾 Docker Volumes:"
  docker volume ls | grep cartrita
  echo ""
  echo "🌐 Networks:"
  docker network ls | grep cartrita
}

# Main menu
case "$1" in
  "dev") start_dev ;;
  "prod") start_prod ;;
  "stop") stop_all ;;
  "logs") view_logs "$@" ;;
  "reset") reset_db ;;
  "backup") backup_db ;;
  "db") db_shell ;;
  "status") show_status ;;
  "check") ./scripts/check-db-structure.sh ;;
  *)
      echo "Usage: $0 {dev|prod|stop|logs|reset|backup|db|status|check}"
      echo ""
      echo "Commands:"
      echo "  dev            - Start development environment (with --build)"
      echo "  prod           - Start production environment (with --build)"
      echo "  stop           - Stop all services"
      echo "  logs [service] - View application logs"
      echo "  reset          - Reset database (WARNING: destroys data)"
      echo "  backup         - Create database backup"
      echo "  db             - Connect to database shell"
      echo "  status         - Show current status"
      echo "  check          - Check database structure"
      echo ""
      echo "Examples:"
      echo "  $0 dev                    # Build and start development"
      echo "  $0 logs db                # View database logs only"
      exit 1
      ;;
esac
EOF

  # Create database check script
  cat > "$PROJECT_ROOT/scripts/check-db-structure.sh" << 'EOF'
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
EOF

  chmod +x "$PROJECT_ROOT/scripts/docker-setup.sh"
  chmod +x "$PROJECT_ROOT/scripts/check-db-structure.sh"
  
  echo "✅ Management scripts created and made executable"
}

# Function to create .env file if it doesn't exist
setup_env_file() {
  if [ ! -f "$PROJECT_ROOT/.env" ]; then
      echo "📝 Creating .env file from template..."
      cp "$PROJECT_ROOT/.env.template" "$PROJECT_ROOT/.env"
      echo "⚠️  Please edit .env file with your actual API keys!"
      echo "Required: OPENAI_API_KEY, LANGCHAIN_API_KEY"
  else
      echo "✅ .env file already exists"
  fi
}

# Function to verify existing db-init files
verify_db_init() {
  echo "🔍 Verifying existing db-init files..."
  
  echo "Found SQL files:"
  ls -la "$DB_INIT_PATH"/*.sql | while read -r file; do
      filename=$(basename "$file")
      echo "  ✅ $filename"
  done
  
  echo ""
  echo "✅ All db-init files verified and will be executed during docker compose up --build"
}

# Function to start the development environment
start_development() {
  echo "🚀 Starting development environment with build..."
  
  cd "$PROJECT_ROOT"
  
  # Check if .env has API keys
  if grep -q "your_openai_api_key_here" .env 2>/dev/null; then
      echo "⚠️  Warning: Please update your API keys in .env file"
      echo "Edit: $PROJECT_ROOT/.env"
      echo ""
  fi
  
  # Start the development environment with build
  ./scripts/docker-setup.sh dev
}

# Main execution flow
main() {
  echo "Starting complete setup process..."
  echo ""
  
  # Change to project directory
  cd "$PROJECT_ROOT" || exit 1
  
  # Run all setup functions
  check_directory
  create_directories
  create_docker_files
  create_env_template
  create_scripts
  setup_env_file
  verify_db_init
  
  echo ""
  echo "🎉 Setup Complete!"
  echo "================="
  echo ""
  echo "📁 Project structure created at: $PROJECT_ROOT"
  echo "🗄️  Database init files found at: $DB_INIT_PATH"
  echo ""
  echo "📝 Next steps:"
  echo "1. Edit .env file with your API keys (if needed):"
  echo "   nano $PROJECT_ROOT/.env"
  echo ""
  echo "2. Start development environment:"
  echo "   cd $PROJECT_ROOT"
  echo "   ./scripts/docker-setup.sh dev"
  echo ""
  echo "3. Check database structure:"
  echo "   ./scripts/docker-setup.sh check"
  echo ""
  echo "🔧 Available commands:"
  echo "   ./scripts/docker-setup.sh {dev|prod|stop|logs|backup|db|status|check}"
  echo ""
  
  # Ask if user wants to start development environment
  echo "🚀 Would you like to start the development environment now? (y/N)"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
      start_development
  else
      echo "✅ Setup complete. Run './scripts/docker-setup.sh dev' when ready to start."
  fi
}

# Run main function
main "$@"
EOF
