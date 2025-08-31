#!/bin/bash

# Cartrita V2 Enhanced - Comprehensive Smoke Test
# Test all major V2 endpoints to ensure everything is working

echo "🚀 Starting Cartrita V2 Enhanced Smoke Test..."
echo "=============================================="

# Base URL for API
BASE_URL="${1:-http://localhost:8000}"
echo "🌐 Testing against: $BASE_URL"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "\n${BLUE}🧪 Test $TESTS_RUN: $test_name${NC}"
    echo "   URL: $method $url"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" \
                      -H "Content-Type: application/json" \
                      -d "$data" \
                      "$url" 2>/dev/null)
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$url" 2>/dev/null)
    fi
    
    # Extract HTTP status and body
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "   ${GREEN}✅ PASSED${NC} (Status: $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Show interesting parts of response
        if echo "$body" | jq -e . >/dev/null 2>&1; then
            echo "   Response: $(echo "$body" | jq -c '. | {success, version?, cartritaGreeting?, status?}')"
        fi
    else
        echo -e "   ${RED}❌ FAILED${NC} (Expected: $expected_status, Got: $http_code)"
        echo "   Response: $body"
    fi
}

# Wait for server to be ready
echo -e "\n${YELLOW}⏳ Checking if server is ready...${NC}"
for i in {1..30}; do
    if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        break
    fi
    echo "   Attempt $i/30 - Server not ready, waiting 2 seconds..."
    sleep 2
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server failed to start within 60 seconds${NC}"
        exit 1
    fi
done

# Start tests
echo -e "\n${YELLOW}🔥 Running Comprehensive V2 Smoke Tests...${NC}"

# Basic health checks
run_test "Basic Health Check" "$BASE_URL/health"
run_test "Detailed Health Check" "$BASE_URL/health/detailed"

# API V2 endpoints
run_test "API V2 Root" "$BASE_URL/api/v2"
run_test "Enhanced Chat Status" "$BASE_URL/api/v2/chat/enhanced/status"
run_test "Agent Management - List Agents" "$BASE_URL/api/v2/agents"
run_test "Agent Metrics" "$BASE_URL/api/v2/agents/metrics"
run_test "AI Services - Models List" "$BASE_URL/api/v2/ai/models"
run_test "AI Services Status" "$BASE_URL/api/v2/ai/status"
run_test "System Monitoring - Services Status" "$BASE_URL/api/v2/monitoring/status/services"
run_test "System Monitoring - Metrics" "$BASE_URL/api/v2/monitoring/metrics"

# Test some POST endpoints with sample data
echo -e "\n${BLUE}🧪 Testing POST Endpoints...${NC}"

# Test chat endpoint (without auth for basic functionality check)
chat_data='{"message": "Hello Cartrita! This is a smoke test.", "options": {"use_rag": false, "use_agent_delegation": false}}'
run_test "Enhanced Chat - Basic Message" "$BASE_URL/api/v2/chat/enhanced/chat" "POST" "$chat_data"

# Test embeddings generation
embedding_data='{"text": "This is a test for embeddings generation"}'
run_test "AI Services - Generate Embeddings" "$BASE_URL/api/v2/ai/embeddings" "POST" "$embedding_data"

# Test AI completion
completion_data='{"prompt": "What is 2+2?"}'
run_test "AI Services - Text Completion" "$BASE_URL/api/v2/ai/completions" "POST" "$completion_data"

# Test knowledge addition
knowledge_data='{"content": "Cartrita is an AI assistant with Miami street-smart personality", "metadata": {"category": "test", "source": "smoke_test"}}'
run_test "AI Services - Add Knowledge" "$BASE_URL/api/v2/ai/knowledge/add" "POST" "$knowledge_data"

# Test knowledge search
search_data='{"query": "What is Cartrita?", "limit": 3}'
run_test "AI Services - Search Knowledge" "$BASE_URL/api/v2/ai/knowledge/search" "POST" "$search_data"

# Test conversation management
conversation_data='{"title": "Smoke Test Conversation", "type": "general"}'
run_test "Conversations - Create New" "$BASE_URL/api/v2/conversations" "POST" "$conversation_data"

# Test 404 handling
run_test "404 Handling" "$BASE_URL/api/v2/nonexistent" "GET" "" "404"

# Documentation endpoint
run_test "API Documentation" "$BASE_URL/docs"

echo -e "\n${YELLOW}📊 SMOKE TEST SUMMARY${NC}"
echo "======================="
echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $((TESTS_RUN - TESTS_PASSED))"

if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! Cartrita V2 Enhanced is ready to dominate! 🚀${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi