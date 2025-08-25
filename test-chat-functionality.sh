#!/bin/bash

# Test script for chat functionality between frontend and backend
echo "🚀 Testing Cartrita Chat Functionality"
echo "======================================"

# Function to check if a service is running
check_service() {
    local url=$1
    local service_name=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ $service_name is running"
        return 0
    else
        echo "❌ $service_name is not responding"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local description=$2
    local method=${3:-GET}
    local data=${4:-""}
    
    echo -n "Testing $description... "
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -H "Content-Type: application/json" -X POST -d "$data" "$endpoint")
    else
        response=$(curl -s -w "%{http_code}" "$endpoint")
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [[ "$http_code" =~ ^[23][0-9][0-9]$ ]]; then
        echo "✅ $http_code"
        return 0
    else
        echo "❌ $http_code"
        echo "Response: $body"
        return 1
    fi
}

echo ""
echo "1. Checking service health..."
echo "----------------------------"

# Check backend health
check_service "http://localhost:8001/health" "Node.js Backend"
backend_status=$?

# Check Python backend health
check_service "http://localhost:8002/health" "Python Backend"
python_status=$?

# Check frontend
check_service "http://localhost:3000" "Frontend"
frontend_status=$?

echo ""
echo "2. Testing API endpoints..."
echo "--------------------------"

# Test router health
test_api "http://localhost:8001/api/router/health" "Router health"

# Test chat history endpoint (requires auth, expect 401)
test_api "http://localhost:8001/api/chatHistory/test" "Chat history test endpoint"

# Test AI hub health
test_api "http://localhost:8001/api/ai-hub/health" "AI Hub health"

# Test unified inference health  
test_api "http://localhost:8001/api/unified/health" "Unified inference health"

echo ""
echo "3. Testing chat functionality..."
echo "-------------------------------"

# Create a simple test message (this will likely fail due to auth, but tests the endpoint)
echo "Testing chat completion endpoint..."
chat_data='{"task":"chat","prompt":"Hello, this is a test message","options":{"model":"gpt-4o","temperature":0.7}}'

test_api "http://localhost:8001/api/router" "Chat completion" "POST" "$chat_data"

echo ""
echo "4. Summary"
echo "----------"

if [ $backend_status -eq 0 ] && [ $python_status -eq 0 ] && [ $frontend_status -eq 0 ]; then
    echo "✅ All core services are running"
    echo ""
    echo "🎉 Chat functionality should be working!"
    echo ""
    echo "Next steps:"
    echo "1. Open your browser to http://localhost:3000"
    echo "2. Navigate to the chat component"
    echo "3. Try sending a message"
    echo ""
    echo "If you encounter authentication errors:"
    echo "- Make sure you have a user account set up"
    echo "- Check that JWT tokens are being generated correctly"
    echo "- Verify the authenticateToken middleware is working"
    
else
    echo "❌ Some services are not running properly"
    echo ""
    echo "To fix this:"
    echo "1. Run: docker-compose -f docker-compose.v2.yml up -d"
    echo "2. Check logs: docker-compose -f docker-compose.v2.yml logs"
    echo "3. Wait for all services to start (may take 1-2 minutes)"
fi

echo ""
echo "🔧 Development mode testing:"
echo "If running in development mode (not Docker):"
echo "1. Backend: cd packages/cartrita-v2/backend && npm run dev"
echo "2. Python: cd py && python main.py"  
echo "3. Frontend: cd packages/cartrita-v2/frontend && npm run dev"