#!/bin/bash
# Cartrita V2 Master - Hybrid Fastify + FastAPI Startup Script

echo "🚀 Starting Cartrita V2 - Hybrid Architecture"
echo "============================================="
echo ""
echo "🔧 Architecture: Fastify (Node.js) + FastAPI (Python) + MCP Copilot"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️ No .env file found. Copying from template..."
    cp .env.v2.template .env 2>/dev/null || cp .env.example .env 2>/dev/null
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies  
echo "🐍 Installing Python dependencies..."
cd py && pip install -r requirements.txt && cd ..

# Start both services
echo "🌉 Starting hybrid backend services..."
npm run dev:both
