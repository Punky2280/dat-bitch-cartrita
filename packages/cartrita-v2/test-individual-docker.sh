#!/bin/bash

# Test script for individual Docker container deployment
# This script tests launching Fastify and FastAPI services independently

set -e

echo "🐋 Testing Individual Docker Container Deployment"
echo "=================================================="

# Change to the correct directory
cd /home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2

# Function to cleanup containers
cleanup() {
    echo "🧹 Cleaning up test containers..."
    docker-compose -f docker-compose.individual.yml down --volumes --remove-orphans 2>/dev/null || true
}

# Cleanup on exit
trap cleanup EXIT

echo ""
echo "📋 Testing Database Services Only..."
echo "docker-compose -f docker-compose.individual.yml --profile database up -d"
docker-compose -f docker-compose.individual.yml --profile database up -d

echo ""
echo "⏱️  Waiting for database services to be healthy..."
sleep 10

echo ""
echo "🔍 Checking database container status:"
docker ps --filter "name=cartrita-postgres-individual" --filter "name=cartrita-redis-individual"

echo ""
echo "📋 Testing Fastify Service (with dependencies)..."
echo "docker-compose -f docker-compose.individual.yml --profile fastify up -d"
docker-compose -f docker-compose.individual.yml --profile fastify up -d

echo ""
echo "⏱️  Waiting for Fastify service to start..."
sleep 15

echo ""
echo "🔍 Checking Fastify container status:"
docker ps --filter "name=cartrita-fastify-standalone"

echo ""
echo "🏥 Testing Fastify health endpoint:"
if curl -f http://localhost:8001/health 2>/dev/null; then
    echo "✅ Fastify service is healthy"
else
    echo "❌ Fastify service health check failed"
fi

# Stop Fastify for next test
docker stop cartrita-fastify-standalone 2>/dev/null || true

echo ""
echo "📋 Testing FastAPI Service (with dependencies)..."
echo "docker-compose -f docker-compose.individual.yml --profile fastapi up -d"
docker-compose -f docker-compose.individual.yml --profile fastapi up -d

echo ""
echo "⏱️  Waiting for FastAPI service to start..."
sleep 15

echo ""
echo "🔍 Checking FastAPI container status:"
docker ps --filter "name=cartrita-fastapi-standalone"

echo ""
echo "🏥 Testing FastAPI health endpoint:"
if curl -f http://localhost:8002/health 2>/dev/null; then
    echo "✅ FastAPI service is healthy"
else
    echo "❌ FastAPI service health check failed"
fi

# Stop FastAPI for next test
docker stop cartrita-fastapi-standalone 2>/dev/null || true

echo ""
echo "📋 Testing Both Services Together..."
echo "docker-compose -f docker-compose.individual.yml --profile both up -d"
docker-compose -f docker-compose.individual.yml --profile both up -d

echo ""
echo "⏱️  Waiting for both services to start..."
sleep 20

echo ""
echo "🔍 Checking both containers status:"
docker ps --filter "name=cartrita-fastify-standalone" --filter "name=cartrita-fastapi-standalone"

echo ""
echo "🏥 Testing both service health endpoints:"
fastify_health=$(curl -f http://localhost:8001/health 2>/dev/null && echo "✅ Fastify OK" || echo "❌ Fastify Failed")
fastapi_health=$(curl -f http://localhost:8002/health 2>/dev/null && echo "✅ FastAPI OK" || echo "❌ FastAPI Failed")

echo "Fastify: $fastify_health"
echo "FastAPI: $fastapi_health"

echo ""
echo "📊 Final Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🎉 Individual Docker deployment test completed!"
echo ""
echo "📝 Available deployment commands:"
echo "  Database only:  docker-compose -f docker-compose.individual.yml --profile database up"
echo "  Fastify only:   docker-compose -f docker-compose.individual.yml --profile fastify up"
echo "  FastAPI only:   docker-compose -f docker-compose.individual.yml --profile fastapi up"
echo "  Both services:  docker-compose -f docker-compose.individual.yml --profile both up"