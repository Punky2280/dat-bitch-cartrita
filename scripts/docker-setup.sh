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
