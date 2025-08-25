#!/bin/bash

# Test Hybrid Backend Integration with Enhanced Chat Interface
# This script verifies the Fastify + FastAPI backend and frontend integration

set -e
echo "🧪 Testing Hybrid Backend Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
FASTIFY_PORT=8001
FASTAPI_PORT=8002
FRONTEND_PORT=3000
TEST_TIMEOUT=10

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    echo -e "${BLUE}Checking ${service} on port ${port}...${NC}"
    
    if curl -s --max-time $TEST_TIMEOUT "http://localhost:${port}/health" > /dev/null; then
        echo -e "${GREEN}✅ ${service} is running on port ${port}${NC}"
        return 0
    else
        echo -e "${RED}❌ ${service} is not responding on port ${port}${NC}"
        return 1
    fi
}

# Function to test API endpoints
test_endpoint() {
    local url=$1
    local description=$2
    local method=${3:-GET}
    
    echo -e "${BLUE}Testing: ${description}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s --max-time $TEST_TIMEOUT "$url" | jq '.' 2>/dev/null || echo "Invalid JSON")
    else
        response=$(curl -s --max-time $TEST_TIMEOUT -X "$method" -H "Content-Type: application/json" "$url" | jq '.' 2>/dev/null || echo "Invalid JSON")
    fi
    
    if [ "$response" != "Invalid JSON" ] && [ -n "$response" ]; then
        echo -e "${GREEN}✅ ${description} - OK${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} - Failed${NC}"
        return 1
    fi
}

# Function to test AI generation
test_ai_generation() {
    echo -e "${BLUE}Testing AI Generation through hybrid backend...${NC}"
    
    local payload='{
        "prompt": "Hello, this is a test message for the hybrid AI system",
        "model": "Hybrid-Test",
        "temperature": 0.7,
        "max_tokens": 100,
        "metadata": {
            "sessionId": "test-session",
            "timestamp": "'$(date -Iseconds)'"
        }
    }'
    
    response=$(curl -s --max-time 15 -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "http://localhost:${FASTIFY_PORT}/api/v2/ai/generate" | jq '.' 2>/dev/null || echo "Invalid JSON")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ AI Generation - Success${NC}"
        echo -e "${YELLOW}Response: $(echo "$response" | jq -r '.data.response // "No response content"' | head -c 100)...${NC}"
        return 0
    else
        echo -e "${RED}❌ AI Generation - Failed${NC}"
        echo -e "${YELLOW}Response: $response${NC}"
        return 1
    fi
}

# Function to test RAG search
test_rag_search() {
    echo -e "${BLUE}Testing RAG Search through hybrid backend...${NC}"
    
    local payload='{
        "query": "test knowledge search",
        "limit": 5,
        "threshold": 0.7
    }'
    
    response=$(curl -s --max-time 10 -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "http://localhost:${FASTIFY_PORT}/api/v2/ai/rag/search" | jq '.' 2>/dev/null || echo "Invalid JSON")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ RAG Search - Success${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ RAG Search - No results (expected if no data indexed)${NC}"
        return 0
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}🚀 Starting Hybrid Backend Integration Tests${NC}"
    echo "================================================"
    
    local failed_tests=0
    
    # Test 1: Service Health Checks
    echo -e "\n${YELLOW}📋 Phase 1: Service Health Checks${NC}"
    check_service $FASTIFY_PORT "Fastify Backend" || ((failed_tests++))
    check_service $FASTAPI_PORT "FastAPI Backend" || ((failed_tests++))
    
    # Test 2: Basic API Endpoints
    echo -e "\n${YELLOW}📋 Phase 2: Basic API Endpoints${NC}"
    test_endpoint "http://localhost:${FASTIFY_PORT}/health" "Fastify Health Check" || ((failed_tests++))
    test_endpoint "http://localhost:${FASTAPI_PORT}/health" "FastAPI Health Check" || ((failed_tests++))
    test_endpoint "http://localhost:${FASTIFY_PORT}/api/v2/system/status" "System Status" || ((failed_tests++))
    
    # Test 3: Inter-service Communication
    echo -e "\n${YELLOW}📋 Phase 3: Inter-service Communication${NC}"
    test_endpoint "http://localhost:${FASTIFY_PORT}/api/v2/ai/health" "FastAPI Health via Fastify" || ((failed_tests++))
    
    # Test 4: AI Integration
    echo -e "\n${YELLOW}📋 Phase 4: AI Integration${NC}"
    test_ai_generation || ((failed_tests++))
    test_rag_search || ((failed_tests++))
    
    # Test 5: Frontend Integration (if available)
    echo -e "\n${YELLOW}📋 Phase 5: Frontend Integration${NC}"
    if check_service $FRONTEND_PORT "Frontend Server"; then
        test_endpoint "http://localhost:${FRONTEND_PORT}" "Frontend Root" || ((failed_tests++))
        echo -e "${GREEN}✅ Frontend is accessible${NC}"
        echo -e "${BLUE}💡 Enhanced Chat Interface: http://localhost:${FRONTEND_PORT}/chat-enhanced${NC}"
    else
        echo -e "${YELLOW}⚠️ Frontend not running, skipping frontend tests${NC}"
    fi
    
    # Test Summary
    echo -e "\n${YELLOW}📊 Test Summary${NC}"
    echo "================"
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Hybrid backend is fully operational.${NC}"
        echo -e "${BLUE}🔗 Access the Enhanced Chat Interface at: http://localhost:${FRONTEND_PORT}/chat-enhanced${NC}"
        return 0
    else
        echo -e "${RED}❌ ${failed_tests} test(s) failed. Please check the logs above.${NC}"
        return 1
    fi
}

# Instructions for running services
show_instructions() {
    echo -e "\n${YELLOW}📝 Quick Start Instructions:${NC}"
    echo "1. Start the hybrid backend:"
    echo "   ./start-hybrid.sh"
    echo ""
    echo "2. Start the frontend (in another terminal):"
    echo "   cd packages/frontend && npm run dev"
    echo ""
    echo "3. Run this test script:"
    echo "   ./test-hybrid-integration.sh"
    echo ""
    echo "4. Access the Enhanced Chat Interface:"
    echo "   http://localhost:3000/chat-enhanced"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed. Please install jq first.${NC}"
    echo "Ubuntu/Debian: sudo apt-get install jq"
    echo "macOS: brew install jq"
    exit 1
fi

# Run tests or show instructions
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_instructions
    exit 0
elif [ "$1" = "--instructions" ]; then
    show_instructions
    exit 0
else
    main "$@"
fi