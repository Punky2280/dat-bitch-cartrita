#!/bin/bash

# Database setup script for Dat Bitch Cartrita
set -e

echo "🗄️  Setting up Dat Bitch Cartrita Database..."

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-dat-bitch-cartrita}
DB_USER=${DB_USER:-robert}

echo "📡 Connecting to database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# Check if we're running in Docker
if [ -f /.dockerenv ]; then
  echo "🐳 Running in Docker container"
  DB_HOST="db"
fi

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "✅ Database is ready!"

# Run the initialization script
echo "🚀 Running database initialization..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f init_database.sql

echo "🎉 Database setup complete!"
