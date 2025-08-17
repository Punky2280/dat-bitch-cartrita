#!/bin/bash

# Comprehensive Backend Smoke Test Suite
# Tests all critical endpoints to ensure full functionality

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:8001}"
TIMEOUT=5
TEST_EMAIL="test@example.com"
TEST_PASSWORD="testpass123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
    local test_name="$1"
    local curl_cmd="$2"
    local expected_status="$3"
    local description="$4"
    
    ((TESTS_TOTAL++))
    log_info "Testing: $test_name - $description"
    
    # Run curl command with timeout and capture status code
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT --connect-timeout 2 $curl_cmd 2>/dev/null || echo "000")
    status_code="${response: -3}"
    response_body="${response%???}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name (HTTP $status_code)"
        if [[ -n "$response_body" && "$response_body" != "000" ]]; then
            echo "  Response: ${response_body:0:100}..."
        fi
        return 0
    else
        log_error "$test_name (Expected: $expected_status, Got: $status_code)"
        if [[ "$status_code" == "000" ]]; then
            echo "  Error: Connection failed or timeout"
        elif [[ -n "$response_body" ]]; then
            echo "  Response: ${response_body:0:200}"
        fi
        return 1
    fi
}

run_auth_test() {
    local test_name="$1"
    local endpoint="$2"
    local method="${3:-GET}"
    local data="$4"
    local token="$5"
    local expected_status="$6"
    local description="$7"
    
    ((TESTS_TOTAL++))
    log_info "Testing: $test_name - $description"
    
    local curl_cmd="$API_BASE_URL$endpoint"
    local curl_args="-X $method -H 'Content-Type: application/json'"
    
    if [[ -n "$token" ]]; then
        curl_args="$curl_args -H 'Authorization: Bearer $token'"
    fi
    
    if [[ -n "$data" ]]; then
        curl_args="$curl_args -d '$data'"
    fi
    
    local response
    local status_code
    
    response=$(eval "curl -s -w \"%{http_code}\" --max-time $TIMEOUT --connect-timeout 2 $curl_args '$curl_cmd' 2>/dev/null" || echo "000")
    status_code="${response: -3}"
    response_body="${response%???}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name (HTTP $status_code)"
        if [[ -n "$response_body" && "$response_body" != "000" ]]; then
            echo "  Response: ${response_body:0:100}..."
        fi
        return 0
    else
        log_error "$test_name (Expected: $expected_status, Got: $status_code)"
        if [[ "$status_code" == "000" ]]; then
            echo "  Error: Connection failed or timeout"
        elif [[ -n "$response_body" ]]; then
            echo "  Response: ${response_body:0:200}"
        fi
        return 1
    fi
}

echo "=================================="
echo "🧪 Comprehensive Backend Smoke Test"
echo "=================================="
echo "API Base URL: $API_BASE_URL"
echo "Timeout: ${TIMEOUT}s"
echo "Test Email: $TEST_EMAIL"
echo "=================================="
echo

# Test 1: Basic Connectivity
log_info "=== BASIC CONNECTIVITY TESTS ==="
run_test "Backend Root" "$API_BASE_URL/" "200" "Basic server response"
run_test "Health Check" "$API_BASE_URL/health" "200" "Application health status"

# Test 2: Authentication Endpoints
log_info "=== AUTHENTICATION TESTS ==="
run_test "Auth Test Endpoint" "$API_BASE_URL/api/auth/test" "200" "Auth routes accessibility"

# Test emergency login to get a token
log_info "Testing emergency login endpoint..."
EMERGENCY_RESPONSE=$(curl -s -X POST --max-time $TIMEOUT \
    -H "Content-Type: application/json" \
    "$API_BASE_URL/api/auth/emergency-login" 2>/dev/null || echo '{"error":"failed"}')

if echo "$EMERGENCY_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$EMERGENCY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
    if [[ -n "$TOKEN" ]]; then
        log_success "Emergency login successful - token obtained"
        echo "  Token: ${TOKEN:0:50}..."
    else
        log_error "Emergency login - failed to extract token"
        TOKEN=""
    fi
else
    log_error "Emergency login failed"
    TOKEN=""
fi

# Test normal login
run_auth_test "Normal Login" "/api/auth/login" "POST" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "" "401" "Expected 401 for non-existent user"

# Test 3: Protected Endpoints (with token if available)
log_info "=== PROTECTED ENDPOINT TESTS ==="
if [[ -n "$TOKEN" ]]; then
    run_auth_test "Token Verification" "/api/auth/verify" "GET" "" "$TOKEN" "200" "JWT token validation"
    run_auth_test "User Profile" "/api/user/profile" "GET" "" "$TOKEN" "200" "User profile access"
    run_auth_test "Chat Health" "/api/cartrita/ping" "GET" "" "$TOKEN" "200" "Chat service status"
else
    log_warning "Skipping protected endpoint tests - no valid token available"
fi

# Test 4: Service Status Endpoints
log_info "=== SERVICE STATUS TESTS ==="
run_test "API Health Status" "$API_BASE_URL/api/health" "200" "API health endpoint"
run_test "Email Status" "$API_BASE_URL/api/email/status" "401" "Email service status (expected 401 without auth)"
run_test "Calendar Status" "$API_BASE_URL/api/calendar/status" "401" "Calendar service status (expected 401 without auth)"
run_test "Contacts Status" "$API_BASE_URL/api/contacts/status" "401" "Contacts service status (expected 401 without auth)"

# Test 5: AI and Model Endpoints
log_info "=== AI SERVICE TESTS ==="
run_test "AI Health" "$API_BASE_URL/api/ai/health" "200" "AI provider health"
run_test "AI Providers" "$API_BASE_URL/api/ai/providers" "200" "Available AI providers"
run_test "Unified Health" "$API_BASE_URL/api/unified/health" "200" "Unified AI health"

# Test 6: Workflow and Template Endpoints  
log_info "=== WORKFLOW TESTS ==="
if [[ -n "$TOKEN" ]]; then
    run_auth_test "Workflows List" "/api/workflows" "GET" "" "$TOKEN" "200" "User workflows"
    run_auth_test "Workflow Templates" "/api/workflow-templates" "GET" "" "$TOKEN" "200" "Available templates"
else
    log_warning "Skipping workflow tests - no valid token available"
fi

# Test 7: Knowledge and Vault Endpoints
log_info "=== KNOWLEDGE & VAULT TESTS ==="
if [[ -n "$TOKEN" ]]; then
    run_auth_test "Knowledge Hub" "/api/knowledge" "GET" "" "$TOKEN" "200" "Knowledge management"
    run_auth_test "API Vault" "/api/vault" "GET" "" "$TOKEN" "200" "API key vault"
else
    log_warning "Skipping knowledge/vault tests - no valid token available"
fi

# Test 8: Monitoring and Metrics
log_info "=== MONITORING TESTS ==="
run_test "Metrics" "$API_BASE_URL/metrics" "200" "System metrics"
run_test "Custom Metrics" "$API_BASE_URL/api/metrics/custom" "200" "Custom application metrics"

# Test 9: Chat and Agent Endpoints
log_info "=== AGENT TESTS ==="
run_test "Agent Role Call" "$API_BASE_URL/api/agents/role-call" "200" "Available agents"
if [[ -n "$TOKEN" ]]; then
    run_auth_test "Chat Test" "/api/cartrita/chat" "POST" \
        "{\"message\":\"Hello test\"}" "$TOKEN" "200" "Chat functionality"
else
    log_warning "Skipping chat test - no valid token available"
fi

# Final Summary
echo
echo "=================================="
echo "🎯 TEST RESULTS SUMMARY"
echo "=================================="
echo "Total Tests: $TESTS_TOTAL"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Success Rate: $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%"
echo "=================================="

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Backend is fully functional.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Backend needs attention.${NC}"
    echo
    echo "Common issues to check:"
    echo "1. Is the backend server running on $API_BASE_URL?"
    echo "2. Are there OpenTelemetry or database connection issues?"
    echo "3. Are authentication endpoints properly configured?"
    echo "4. Check backend logs for specific error details"
    exit 1
fi