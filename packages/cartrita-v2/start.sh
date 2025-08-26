#!/bin/bash
# Cartrita V2 Master - Python Backend Startup Script

echo "🚀 Starting Cartrita V2 - Python Architecture"
echo "============================================="
echo ""
echo "🔧 Architecture: Python FastAPI + MCP Copilot + Next.js Frontend"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️ No .env file found. Copying from template..."
    cp .env.v2.template .env 2>/dev/null || cp .env.example .env 2>/dev/null
fi

# Install Python dependencies  
echo "� Installing Python dependencies..."
cd py && pip install -r requirements.txt && cd ..

# Install Frontend dependencies (if frontend directory exists)
if [ -d "frontend" ]; then
    echo "� Installing Frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start Python backend
echo "🐍 Starting Python backend service..."
cd py && python3 main.py
