#!/bin/bash

# Workflow Templates API Test Suite
# Tests all endpoints of the newly implemented workflow templates system
# Run this after backend is fully operational

set -e

BASE_URL="http://localhost:8001"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Test 1: Health check
log "Testing backend health..."
if curl -s "$BASE_URL/health" > /dev/null; then
    success "Backend is healthy"
else
    error "Backend is not responding"
    exit 1
fi

# Test 2: Login to get auth token
log "Authenticating as test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "$CONTENT_TYPE" \
    -d '{"email":"lulufdez84@gmail.com","password":"password"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    success "Authentication successful"
    AUTH_HEADER="Authorization: Bearer $TOKEN"
else
    error "Authentication failed: $LOGIN_RESPONSE"
    exit 1
fi

# Test 3: Get workflow template categories
log "Testing GET /api/workflow-templates/categories..."
CATEGORIES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/categories" \
    -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

if echo "$CATEGORIES_RESPONSE" | grep -q "productivity"; then
    success "Categories endpoint working"
    echo "Found categories: $(echo "$CATEGORIES_RESPONSE" | grep -o '"name":"[^"]*"' | wc -l)"
else
    error "Categories endpoint failed: $CATEGORIES_RESPONSE"
fi

# Test 4: Get templates (should be empty initially)
log "Testing GET /api/workflow-templates/ (empty list)..."
TEMPLATES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/" \
    -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

if echo "$TEMPLATES_RESPONSE" | grep -q '"success":true'; then
    success "Templates list endpoint working"
else
    error "Templates list failed: $TEMPLATES_RESPONSE"
fi

# Test 5: Create a workflow template
log "Testing POST /api/workflow-templates/ (create template)..."
CREATE_TEMPLATE_DATA='{
  "name": "Daily Task Review Template",
  "description": "A template for daily task review with customizable priorities",
  "category_id": 1,
  "config": {
    "steps": [
      "Review {{priority_level}} priority tasks",
      "Update status for {{task_count}} items",
      "Plan {{next_action}} for tomorrow"
    ]
  },
  "variables": [
    {
      "var_name": "priority_level",
      "description": "Task priority level to focus on",
      "required": true,
      "default_value": "high",
      "var_type": "string",
      "validation_pattern": "^(high|medium|low)$"
    },
    {
      "var_name": "task_count",
      "description": "Number of tasks to review",
      "required": false,
      "default_value": "5",
      "var_type": "number"
    },
    {
      "var_name": "next_action",
      "description": "Next action to plan",
      "required": true,
      "var_type": "string"
    }
  ],
  "metadata": {
    "author": "Test Suite",
    "version": "1.0",
    "tags": ["productivity", "daily-review"]
  }
}'

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workflow-templates/" \
    -H "$AUTH_HEADER" -H "$CONTENT_TYPE" \
    -d "$CREATE_TEMPLATE_DATA")

if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
    success "Template creation successful"
    TEMPLATE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "Created template ID: $TEMPLATE_ID"
else
    error "Template creation failed: $CREATE_RESPONSE"
fi

# Test 6: Get the created template
if [ ! -z "$TEMPLATE_ID" ]; then
    log "Testing GET /api/workflow-templates/$TEMPLATE_ID (get specific template)..."
    GET_TEMPLATE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/$TEMPLATE_ID" \
        -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

    if echo "$GET_TEMPLATE_RESPONSE" | grep -q "Daily Task Review Template"; then
        success "Get template by ID working"
        VARIABLES_COUNT=$(echo "$GET_TEMPLATE_RESPONSE" | grep -o '"var_name"' | wc -l)
        echo "Found $VARIABLES_COUNT variables in template"
    else
        error "Get template by ID failed: $GET_TEMPLATE_RESPONSE"
    fi
fi

# Test 7: Get template variables
if [ ! -z "$TEMPLATE_ID" ]; then
    log "Testing GET /api/workflow-templates/$TEMPLATE_ID/variables..."
    VARIABLES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/$TEMPLATE_ID/variables" \
        -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

    if echo "$VARIABLES_RESPONSE" | grep -q "priority_level"; then
        success "Get template variables working"
    else
        error "Get template variables failed: $VARIABLES_RESPONSE"
    fi
fi

# Test 8: Instantiate the template
if [ ! -z "$TEMPLATE_ID" ]; then
    log "Testing POST /api/workflow-templates/$TEMPLATE_ID/instantiate..."
    INSTANTIATE_DATA='{
      "__workflow_name": "My Daily Review - Monday",
      "__workflow_description": "Monday daily review workflow",
      "priority_level": "high",
      "task_count": "7",
      "next_action": "prepare weekly planning meeting"
    }'

    INSTANTIATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workflow-templates/$TEMPLATE_ID/instantiate" \
        -H "$AUTH_HEADER" -H "$CONTENT_TYPE" \
        -d "$INSTANTIATE_DATA")

    if echo "$INSTANTIATE_RESPONSE" | grep -q '"success":true'; then
        success "Template instantiation successful"
        WORKFLOW_ID=$(echo "$INSTANTIATE_RESPONSE" | grep -o '"workflowId":[0-9]*' | cut -d':' -f2)
        echo "Created workflow ID: $WORKFLOW_ID"
    else
        error "Template instantiation failed: $INSTANTIATE_RESPONSE"
    fi
fi

# Test 9: Rate the template
if [ ! -z "$TEMPLATE_ID" ]; then
    log "Testing POST /api/workflow-templates/$TEMPLATE_ID/rate..."
    RATE_DATA='{
      "rating": 5,
      "review": "Excellent template for daily productivity!"
    }'

    RATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workflow-templates/$TEMPLATE_ID/rate" \
        -H "$AUTH_HEADER" -H "$CONTENT_TYPE" \
        -d "$RATE_DATA")

    if echo "$RATE_RESPONSE" | grep -q '"success":true'; then
        success "Template rating successful"
    else
        error "Template rating failed: $RATE_RESPONSE"
    fi
fi

# Test 10: Get template statistics
if [ ! -z "$TEMPLATE_ID" ]; then
    log "Testing GET /api/workflow-templates/$TEMPLATE_ID/stats..."
    STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/$TEMPLATE_ID/stats" \
        -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

    if echo "$STATS_RESPONSE" | grep -q '"total_usage"'; then
        success "Template statistics working"
        echo "Stats: $STATS_RESPONSE"
    else
        error "Template statistics failed: $STATS_RESPONSE"
    fi
fi

# Test 11: List templates with filters
log "Testing GET /api/workflow-templates/?category_id=1&include_variables=true..."
FILTERED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/workflow-templates/?category_id=1&include_variables=true" \
    -H "$AUTH_HEADER" -H "$CONTENT_TYPE")

if echo "$FILTERED_RESPONSE" | grep -q '"success":true'; then
    success "Template filtering working"
else
    error "Template filtering failed: $FILTERED_RESPONSE"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${BLUE}WORKFLOW TEMPLATES TEST SUMMARY${NC}"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Workflow Templates system is working perfectly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi