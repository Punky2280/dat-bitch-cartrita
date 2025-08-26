#!/bin/bash

# Cartrita V2 Development Startup Script
echo "🚀 Starting Cartrita V2 Development Environment..."

# Kill any existing processes on our target ports
echo "🧹 Cleaning up existing processes..."
pkill -f "nodemon" || true
pkill -f "uvicorn" || true
sleep 2

# Set environment variables for free ports
export PORT=9001
export PYTHON_PORT=9002
export PYTHON_SERVER_URL=http://localhost:9002

# Start Python FastAPI server in background
echo "🐍 Starting Python FastAPI server on port $PYTHON_PORT..."
cd py
PORT=$PYTHON_PORT nohup /home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2/.venv/bin/python -m uvicorn main:app --reload --port $PYTHON_PORT > /tmp/cartrita-fastapi.log 2>&1 &
PYTHON_PID=$!
cd ..

# Wait for Python server to start
echo "⏳ Waiting for Python server to initialize..."
sleep 5

# Start Node.js server
echo "🚀 Starting Node.js server on port $PORT..."
PORT=$PORT npm run dev

echo "✅ Development environment started!"
echo "📖 Main Application: http://localhost:$PORT"
echo "📖 API Documentation: http://localhost:$PYTHON_PORT/docs"