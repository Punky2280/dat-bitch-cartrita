#!/bin/bash
# Copilot Environment Validation Script
# Tests the advanced setup workflow components

echo "🎯 GitHub Copilot Environment Validation for Cartrita AI OS"
echo "============================================================"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✅ $1${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}❌ $1${NC}"
        ((TESTS_FAILED++))
    fi
}

echo -e "\n${BLUE}📋 1. Basic Project Structure Validation${NC}"
echo "----------------------------------------"

# Check for key directories and files
test -d "packages/backend/src/agi" && echo -e "  ${GREEN}✅ Multi-agent system directory exists${NC}" || echo -e "  ${RED}❌ Multi-agent system directory missing${NC}"
test -d "db-init" && echo -e "  ${GREEN}✅ Database migrations directory exists${NC}" || echo -e "  ${RED}❌ Database migrations directory missing${NC}"
test -f "packages/backend/src/system/OpenTelemetryTracing.js" && echo -e "  ${GREEN}✅ Observability core exists${NC}" || echo -e "  ${RED}❌ Observability core missing${NC}"
test -f ".github/workflows/copilot-setup-steps.yml" && echo -e "  ${GREEN}✅ Copilot setup workflow exists${NC}" || echo -e "  ${RED}❌ Copilot setup workflow missing${NC}"

echo -e "\n${BLUE}📦 2. Package Dependencies Check${NC}"
echo "--------------------------------"

# Check for critical dependencies in package.json files
if test -f "packages/backend/package.json"; then
    grep -q "@langchain/core" packages/backend/package.json
    test_result "LangChain core dependency"
    
    grep -q "@opentelemetry" packages/backend/package.json
    test_result "OpenTelemetry dependencies"
    
    grep -q "@huggingface/inference" packages/backend/package.json
    test_result "HuggingFace integration"
fi

if test -f "packages/frontend/package.json"; then
    grep -q "react.*18" packages/frontend/package.json
    test_result "React 18+ dependency"
    
    grep -q "vite" packages/frontend/package.json
    test_result "Vite build system"
fi

echo -e "\n${BLUE}🗄️ 3. Database Migration System${NC}"
echo "------------------------------"

# Check migration file sequence
LATEST_MIGRATION=$(ls db-init/ | grep -E '^[0-9]+_.*\.sql$' | sort -V | tail -1)
if [ -n "$LATEST_MIGRATION" ]; then
    echo -e "  ${GREEN}✅ Latest migration: $LATEST_MIGRATION${NC}"
    
    # Check for pgvector setup
    test -f "db-init/00_setup_pgvector.sql"
    test_result "pgvector extension setup"
    
    # Check for comprehensive schema
    ls db-init/ | grep -q "comprehensive.*schema"
    test_result "Comprehensive schema migration"
else
    echo -e "  ${RED}❌ No migration files found${NC}"
    ((TESTS_FAILED++))
fi

echo -e "\n${BLUE}🤖 4. Agent System Architecture${NC}"
echo "------------------------------"

# Check for supervisor agent
test -f "packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js"
test_result "Supervisor agent exists"

# Check for tool registry
test -f "packages/backend/src/agi/orchestration/AgentToolRegistry.js"
test_result "Tool registry exists"

# Count available agents
if test -d "packages/backend/src/agi/consciousness/"; then
    AGENT_COUNT=$(ls packages/backend/src/agi/consciousness/*.js 2>/dev/null | wc -l)
    if [ "$AGENT_COUNT" -gt 5 ]; then
        echo -e "  ${GREEN}✅ Multi-agent pool ($AGENT_COUNT agents available)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${YELLOW}⚠️ Limited agent pool ($AGENT_COUNT agents)${NC}"
    fi
fi

echo -e "\n${BLUE}🔧 5. Build System & Scripts${NC}"
echo "---------------------------"

# Check for build scripts
test -f "packages/backend/jest.config.cjs"
test_result "Backend Jest testing configuration"

test -f "packages/frontend/vite.config.ts" -o -f "packages/frontend/vite.config.js"
test_result "Frontend Vite configuration"

# Check for npm scripts
if test -f "package.json"; then
    grep -q "dev:backend" package.json
    test_result "Backend development script"
    
    grep -q "dev:full" package.json
    test_result "Full-stack development script"
    
    grep -q "smoke:run" package.json
    test_result "Smoke test script"
fi

echo -e "\n${BLUE}🔐 6. Security & Environment${NC}"
echo "----------------------------"

# Check for environment templates
test -f ".env.example"
test_result "Environment template exists"

test -f "packages/backend/.env.example"
test_result "Backend environment template"

# Check for security-related files
test -d ".github" && ls .github/ | grep -q "workflows"
test_result "GitHub Actions workflows directory"

grep -q "ENCRYPTION_KEY" packages/backend/.env.example 2>/dev/null
test_result "Encryption configuration template"

echo -e "\n${BLUE}📊 7. Advanced Features Validation${NC}"
echo "--------------------------------"

# Check for HuggingFace integration
test -d "packages/backend/src/integrations/huggingface"
test_result "HuggingFace integration directory"

# Check for observability
grep -q "OpenTelemetry" packages/backend/src/system/OpenTelemetryTracing.js 2>/dev/null
test_result "OpenTelemetry tracing implementation"

# Check for workflow tools
test -f "packages/backend/src/routes/workflowTools.js"
test_result "Workflow tools API"

# Check for MCP transport
test -f "packages/backend/src/unix-socket.ts"
test_result "Unix socket transport (MCP)"

echo -e "\n${BLUE}📝 8. Documentation & Specs${NC}"
echo "---------------------------"

test -f "docs/PROJECT_NOTEBOOK.md"
test_result "Project notebook documentation"

test -d "docs/specs"
test_result "Specifications directory"

test -f ".github/copilot-instructions.md"
test_result "GitHub Copilot instructions"

# Check for comprehensive documentation
if test -d "docs/project-manuals"; then
    MANUAL_COUNT=$(ls docs/project-manuals/*.md 2>/dev/null | wc -l)
    if [ "$MANUAL_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}✅ Comprehensive manuals ($MANUAL_COUNT guides)${NC}"
        ((TESTS_PASSED++))
    fi
fi

echo -e "\n${BLUE}🎯 9. Copilot Setup Workflow Validation${NC}"
echo "------------------------------------"

# Validate YAML syntax
if command -v python3 &> /dev/null; then
    python3 -c "import yaml; yaml.safe_load(open('.github/workflows/copilot-setup-steps.yml'))" 2>/dev/null
    test_result "Copilot setup workflow YAML syntax"
fi

# Check workflow components
grep -q "copilot-setup-steps:" .github/workflows/copilot-setup-steps.yml
test_result "Correct workflow job name"

grep -q "ubuntu-4-core" .github/workflows/copilot-setup-steps.yml
test_result "Larger runner configuration"

grep -q "pgvector" .github/workflows/copilot-setup-steps.yml
test_result "PostgreSQL with pgvector setup"

grep -q "lfs: true" .github/workflows/copilot-setup-steps.yml
test_result "Git LFS configuration"

echo -e "\n${YELLOW}📈 VALIDATION SUMMARY${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All validations passed! GitHub Copilot environment is ready.${NC}"
    echo -e "${GREEN}🚀 Cartrita AI OS development environment is fully configured.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some validations failed. Review the items above.${NC}"
    echo -e "${BLUE}💡 Tip: Most failures indicate missing dependencies that will be installed by the copilot-setup-steps workflow.${NC}"
    exit 1
fi