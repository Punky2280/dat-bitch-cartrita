#!/bin/bash

echo "🔧 Fixing and Running Cartrita Chat System"
echo "=========================================="

echo ""
echo "Step 1: Navigate to the correct directory"
echo "----------------------------------------"
cd /home/robbie/development/dat-bitch-cartrita
echo "✅ Changed to: $(pwd)"

echo ""
echo "Step 2: Check Docker service"
echo "----------------------------"
if systemctl is-active --quiet docker; then
    echo "✅ Docker service is running"
else
    echo "❌ Docker service is not running. Starting it..."
    sudo systemctl start docker
    sleep 3
fi

echo ""
echo "Step 3: Clean up any existing containers"
echo "---------------------------------------"
echo "Stopping any existing containers..."
docker-compose -f docker-compose.v2.yml down 2>/dev/null || echo "No existing containers to stop"

echo ""
echo "Step 4: Build and start the chat system"
echo "--------------------------------------"
echo "Building and starting services..."

# Use the newer docker compose command (without hyphen)
if command -v docker &> /dev/null; then
    if docker compose version &> /dev/null; then
        echo "Using newer 'docker compose' command..."
        docker compose -f docker-compose.v2.yml up --build -d
    else
        echo "Using legacy 'docker-compose' command..."
        docker-compose -f docker-compose.v2.yml up --build -d
    fi
else
    echo "❌ Docker is not available"
    exit 1
fi

echo ""
echo "Step 5: Wait for services to start"
echo "---------------------------------"
echo "Waiting 30 seconds for services to initialize..."
sleep 30

echo ""
echo "Step 6: Check service status"
echo "---------------------------"
docker-compose -f docker-compose.v2.yml ps

echo ""
echo "Step 7: Test the endpoints"
echo "------------------------"

# Test each service
echo "Testing Node.js Backend (port 8001)..."
if curl -s -f http://localhost:8001/health > /dev/null; then
    echo "✅ Node.js Backend is running"
else
    echo "❌ Node.js Backend is not responding"
    echo "Checking logs..."
    docker-compose -f docker-compose.v2.yml logs --tail=10 node-backend
fi

echo ""
echo "Testing Python Backend (port 8002)..."
if curl -s -f http://localhost:8002/health > /dev/null; then
    echo "✅ Python Backend is running"
else
    echo "❌ Python Backend is not responding"
    echo "Checking logs..."
    docker-compose -f docker-compose.v2.yml logs --tail=10 python-backend
fi

echo ""
echo "Testing Frontend (port 3000)..."
if curl -s -f http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend is not responding"
    echo "Checking logs..."
    docker-compose -f docker-compose.v2.yml logs --tail=10 frontend
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Your chat system should now be running:"
echo "• Frontend: http://localhost:3000"
echo "• Node.js Backend API: http://localhost:8001"
echo "• Python Backend API: http://localhost:8002"
echo ""
echo "If any services failed to start, check the logs:"
echo "docker-compose -f docker-compose.v2.yml logs [service-name]"
echo ""
echo "To stop the system:"
echo "docker-compose -f docker-compose.v2.yml down"

# Also provide development mode instructions
echo ""
echo "🛠️  Alternative: Development Mode"
echo "================================"
echo "If Docker isn't working, you can run in development mode:"
echo ""
echo "Terminal 1 (Node.js Backend):"
echo "cd packages/cartrita-v2/backend"
echo "npm install"
echo "npm run dev"
echo ""
echo "Terminal 2 (Python Backend):"
echo "cd py"
echo "pip install -r requirements.txt"
echo "python main.py"
echo ""
echo "Terminal 3 (Frontend):"
echo "cd packages/cartrita-v2/frontend"
echo "npm install"
echo "npm run dev"