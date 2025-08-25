#!/bin/bash

echo "🔄 Restarting Cartrita Backend..."

# Kill any existing Node.js processes on port 8001
echo "📝 Checking for existing processes on port 8001..."
EXISTING_PID=$(ss -tlnp | grep :8001 | grep -o 'pid=[0-9]*' | cut -d'=' -f2 | head -1)

if [ ! -z "$EXISTING_PID" ]; then
    echo "🔴 Found existing process (PID: $EXISTING_PID) on port 8001"
    echo "🔪 Attempting to stop process..."
    
    # Try to kill gracefully first
    kill $EXISTING_PID 2>/dev/null
    sleep 2
    
    # Check if still running
    if kill -0 $EXISTING_PID 2>/dev/null; then
        echo "🔪 Force killing process..."
        kill -9 $EXISTING_PID 2>/dev/null
    fi
    
    echo "✅ Process terminated"
else
    echo "✅ No existing processes found on port 8001"
fi

# Wait a moment for port to be released
sleep 2

# Navigate to backend directory
cd packages/backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check environment variables
if [ ! -f ".env" ]; then
    echo "⚠️ Warning: .env file not found in backend directory"
    echo "📝 Creating basic .env file..."
    cat > .env << EOF
# Backend Environment Configuration
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=your-openai-key-here
DEEPGRAM_API_KEY=your-deepgram-key-here

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cartrita
DB_USER=postgres
DB_PASSWORD=postgres

# Server Configuration
PORT=8001
NODE_ENV=development
EOF
    echo "✅ Basic .env file created. Please update with your actual API keys."
fi

# Start the backend
echo "🚀 Starting backend server..."
echo "📊 Backend will run on http://localhost:8001"
echo "📋 Logs will be shown below..."
echo "============================================"

# Start with proper logging
npm start 2>&1 | tee backend.log