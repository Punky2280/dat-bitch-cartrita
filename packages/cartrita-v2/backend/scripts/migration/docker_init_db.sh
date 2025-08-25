#!/bin/bash

# This script runs inside the database container to initialize the schema
set -e

echo "🐳 Docker database initialization starting..."

# Wait a moment for PostgreSQL to fully start
sleep 5

# Run the initialization
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init_database.sql

echo "✅ Docker database initialization complete!"
