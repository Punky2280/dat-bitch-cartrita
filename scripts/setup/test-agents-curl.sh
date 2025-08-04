#!/bin/bash

# Test script for Cartrita agents using curl
# Tests various agent functionalities and tracks delegation

API_BASE="http://localhost:8000"
AUTH_TOKEN=""

echo "🚀 Cartrita Agent Testing Suite"
echo "==============================="

# Function to make authenticated requests
make_request() {
    local endpoint="$1"
    local data="$2"
    local method="${3:-POST}"
    
    if [ -n "$AUTH_TOKEN" ]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $AUTH_TOKEN" \
             -d "$data" \
             "$API_BASE$endpoint"
    else
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$API_BASE$endpoint"
    fi
}

# Test authentication first
echo "🔐 Testing Authentication..."
AUTH_RESPONSE=$(make_request "/api/auth/login" '{"username":"Robert Allen","password":"test123"}')
echo "Auth Response: $AUTH_RESPONSE"

# Extract token if successful
if echo "$AUTH_RESPONSE" | grep -q '"token"'; then
    AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token' 2>/dev/null)
    echo "✅ Authentication successful"
    echo "Token: ${AUTH_TOKEN:0:20}..."
else
    echo "⚠️  Authentication failed, continuing without token"
fi

echo ""

# Test 1: Time Query (Should use getCurrentDateTime tool)
echo "⏰ Test 1: Time Query"
echo "----------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"What time is it?","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 2: Image Generation (Should delegate to ArtistAgent)
echo "🎨 Test 2: Image Generation"
echo "----------------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Create an image of a cat wearing a hat","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 3: Code Writing (Should delegate to CodeWriterAgent)
echo "💻 Test 3: Code Writing"
echo "------------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Write a Python function to calculate fibonacci numbers","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 4: Translation (Should delegate to TranslationAgent)
echo "🌍 Test 4: Translation"
echo "-----------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Translate hello world to Spanish","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 5: Scheduling (Should delegate to SchedulerAgent)
echo "📅 Test 5: Scheduling"
echo "----------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Schedule a meeting for tomorrow at 2 PM","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 6: Analytics (Should delegate to AnalyticsAgent)
echo "📊 Test 6: Analytics"
echo "---------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Analyze the performance metrics of the system","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 7: Research (Should delegate to ResearcherAgent)
echo "🔍 Test 7: Research"
echo "--------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Research the latest developments in AI","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 8: Writing (Should delegate to WriterAgent)
echo "✍️  Test 8: Creative Writing"
echo "-----------------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Write a short poem about technology","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 9: Design (Should delegate to DesignAgent)
echo "🎨 Test 9: Design"
echo "------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"Design a user interface for a mobile app","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Test 10: Complex Multi-step Query
echo "🧠 Test 10: Complex Query"
echo "--------------------------"
RESPONSE=$(make_request "/api/chat" '{"message":"What time is it, and can you also create an image of the current season?","language":"en"}')
echo "Response: $RESPONSE"
echo ""

# Check agent metrics
echo "📊 Agent Metrics"
echo "=================="
METRICS=$(curl -s "$API_BASE/api/agent/metrics")
echo "Metrics: $METRICS"
echo ""

# Check health status
echo "🏥 System Health"
echo "=================="
HEALTH=$(curl -s "$API_BASE/health")
echo "Health: $HEALTH"
echo ""

echo "✅ Agent testing completed!"
echo "Check the backend logs for detailed agent delegation information."