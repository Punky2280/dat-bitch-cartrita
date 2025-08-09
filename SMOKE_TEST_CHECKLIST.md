# 30-Minute MCP Smoke Test Checklist

## Overview
This checklist verifies that the Cartrita Hierarchical MCP system is properly installed and functional. Complete all checks within 30 minutes to ensure system readiness.

## Pre-Test Setup (2 minutes)
- [ ] Open terminal windows:
  - Terminal 1: For docker commands
  - Terminal 2: For curl/testing commands  
  - Terminal 3: For log monitoring
- [ ] Browser tabs:
  - http://localhost:8002/docs (Swagger UI)
  - http://localhost:3002 (Grafana)
  - http://localhost:16686 (Jaeger)

## Infrastructure Verification (8 minutes)

### Docker Services (3 minutes)
```bash
# 1. Check all services are running
docker-compose -f docker-compose.mcp.yml ps
# ✅ Expected: All services should show "Up" status

# 2. Check service health
docker-compose -f docker-compose.mcp.yml exec postgres pg_isready -U robert
# ✅ Expected: "postgres:5432 - accepting connections"

docker-compose -f docker-compose.mcp.yml exec redis redis-cli ping
# ✅ Expected: "PONG"

# 3. Check MCP services
curl -s http://localhost:8002/health | jq '.status'
# ✅ Expected: "healthy"
```

### Database Schema (2 minutes)
```bash
# Verify MCP tables exist
PGPASSWORD=punky1 psql -h localhost -U robert -d dat-bitch-cartrita -p 5435 \
  -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'mcp_%';"
# ✅ Expected: 7 tables (mcp_messages, mcp_agents, mcp_task_executions, etc.)

# Check initial data
PGPASSWORD=punky1 psql -h localhost -U robert -d dat-bitch-cartrita -p 5435 \
  -c "SELECT agent_id, agent_type FROM mcp_agents WHERE is_active = true;"
# ✅ Expected: At least mcp-orchestrator entry
```

### Protobuf Generation (1 minute)
```bash
# Verify generated files exist
ls -la packages/mcp-core/src/generated/
# ✅ Expected: mcp_pb.ts, mcp.client.ts, index.ts files

ls -la py/mcp_core/generated/
# ✅ Expected: mcp_pb2.py, mcp_pb2_grpc.py, __init__.py files
```

### Monitoring Stack (2 minutes)
```bash
# Check Jaeger
curl -s http://localhost:16686/api/traces?limit=1 | jq '.data | length'
# ✅ Expected: 0 or more (service responding)

# Check Prometheus metrics
curl -s http://localhost:9090/api/v1/label/__name__/values | jq '.data | length'
# ✅ Expected: >0 (metrics being collected)

# Verify Grafana
curl -s http://localhost:3002/api/health | jq '.database'
# ✅ Expected: "ok"
```

## API Testing (10 minutes)

### Authentication (2 minutes)
```bash
# Test login (using existing user or create test user)
JWT_TOKEN=$(curl -s -X POST http://localhost:8002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@cartrita.com","password":"test123"}' | jq -r '.token')

# Verify token works
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8002/v3/agents/status | jq '.message'
# ✅ Expected: Success response (not 401/403)
```

### MCP v3 API (4 minutes)
```bash
# Test task execution - Text generation
curl -s -X POST http://localhost:8002/v3/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "huggingface.text.generation",
    "parameters": {"text": "Hello world", "maxLength": 50},
    "priority": 5
  }' | jq '.status'
# ✅ Expected: "COMPLETED" or "RUNNING" (not "FAILED")

# Test task execution - Simple chat
curl -s -X POST http://localhost:8002/v3/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "langchain.chat.execute",
    "parameters": {"message": "What is 2+2?"},
    "priority": 5
  }' | jq '.result'
# ✅ Expected: Response with "4" or mathematical answer

# Test agent status
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8002/v3/agents/intelligence-supervisor/status" | jq '.healthy'
# ✅ Expected: true
```

### Legacy v2 Compatibility (2 minutes)
```bash
# Test v2 endpoint still works
curl -s http://localhost:8001/health | jq '.status'
# ✅ Expected: "healthy" or similar positive response

# Test v2 bridge through orchestrator
curl -s http://localhost:8002/api/health | jq '.status'
# ✅ Expected: "healthy" (proxied through MCP bridge)
```

### WebSocket Connection (2 minutes)
```bash
# Test WebSocket upgrade (using websocat if available)
echo '{"messageType":"HEALTH_CHECK","payload":{}}' | \
  websocat ws://localhost:8002/ws --header "Authorization: Bearer $JWT_TOKEN" || \
  echo "WebSocket test skipped (websocat not available)"
# ✅ Expected: Health response or skip if websocat not installed
```

## Agent Verification (5 minutes)

### Supervisor Status (2 minutes)
```bash
# Check Intelligence Supervisor
docker-compose -f docker-compose.mcp.yml logs --tail=10 mcp-supervisor-intelligence | \
  grep -i "initialized"
# ✅ Expected: "Intelligence Supervisor initialized successfully"

# Check Multi-Modal Supervisor  
docker-compose -f docker-compose.mcp.yml logs --tail=10 mcp-supervisor-multimodal | \
  grep -i "initialized"
# ✅ Expected: Supervisor initialization message

# Check System Supervisor
docker-compose -f docker-compose.mcp.yml logs --tail=10 mcp-supervisor-system | \
  grep -i "initialized"
# ✅ Expected: Supervisor initialization message
```

### Agent Registration (1 minute)
```bash
# Verify agents are registered
PGPASSWORD=punky1 psql -h localhost -U robert -d dat-bitch-cartrita -p 5435 \
  -c "SELECT agent_id, agent_type, tier, is_active FROM mcp_agents ORDER BY tier;"
# ✅ Expected: Orchestrator (tier 0), 3 Supervisors (tier 1), multiple Sub-agents (tier 2)
```

### Task Routing (2 minutes)
```bash
# Test routing to Intelligence Supervisor
curl -s -X POST http://localhost:8002/v3/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "research.web.search",
    "parameters": {"query": "OpenAI GPT", "maxResults": 3}
  }' | jq '.metrics.supervisor_id'
# ✅ Expected: "intelligence-supervisor"

# Test routing to System Supervisor
curl -s -X POST http://localhost:8002/v3/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "system.health_check",
    "parameters": {}
  }' | jq '.metrics.supervisor_id'
# ✅ Expected: "system-supervisor"
```

## Observability Verification (3 minutes)

### OpenTelemetry Traces (1 minute)
```bash
# Generate some activity and check traces
sleep 10  # Wait for traces to propagate

# Check Jaeger has traces
curl -s "http://localhost:16686/api/traces?service=cartrita-mcp-orchestrator&limit=5" | \
  jq '.data | length'
# ✅ Expected: >0 (traces are being collected)
```

### Metrics Collection (1 minute)
```bash
# Check MCP-specific metrics
curl -s "http://localhost:9090/api/v1/query?query=cartrita_mcp_messages_sent_total" | \
  jq '.data.result | length'
# ✅ Expected: >0 (metrics are being collected)

# Check task metrics
curl -s "http://localhost:9090/api/v1/query?query=cartrita_mcp_tasks_started_total" | \
  jq '.data.result | length'  
# ✅ Expected: >0 (if tasks were executed)
```

### Log Aggregation (1 minute)
```bash
# Check orchestrator logs
docker-compose -f docker-compose.mcp.yml logs --tail=20 mcp-orchestrator | \
  grep -c "INFO\|ERROR\|WARN"
# ✅ Expected: >0 (structured logs are being generated)

# Check for any error patterns
docker-compose -f docker-compose.mcp.yml logs mcp-orchestrator | \
  grep -i "error\|exception" | wc -l
# ✅ Expected: 0 or minimal errors (system is stable)
```

## Performance Verification (2 minutes)

### Response Times (1 minute)
```bash
# Test orchestrator response time
time curl -s http://localhost:8002/health > /dev/null
# ✅ Expected: <200ms real time

# Test task execution time
time curl -s -X POST http://localhost:8002/v3/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "huggingface.text.generation",
    "parameters": {"text": "Quick test", "maxLength": 10}
  }' > /dev/null
# ✅ Expected: <5s real time (depending on model)
```

### Resource Usage (1 minute)
```bash
# Check container resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | \
  grep mcp
# ✅ Expected: CPU <50%, Memory reasonable for container size

# Check system resources
df -h / | tail -1 | awk '{print "Disk usage: " $5}'
free -h | grep "Mem:" | awk '{print "Memory usage: " $3 "/" $2}'
# ✅ Expected: Disk <80%, Memory <80%
```

## Final Checklist Summary

### ✅ PASS Criteria (All must be checked)
- [ ] All Docker services running and healthy
- [ ] Database schema installed with 7 MCP tables
- [ ] Generated protobuf files exist in both TypeScript and Python
- [ ] Orchestrator responds to health checks <200ms
- [ ] Authentication working (JWT tokens valid)
- [ ] At least one successful task execution
- [ ] Legacy v2 endpoints still functional
- [ ] Three supervisors initialized and registered
- [ ] OpenTelemetry traces being collected
- [ ] Prometheus metrics being scraped
- [ ] No critical errors in logs
- [ ] Resource usage within acceptable limits

### 🚨 FAIL Criteria (Any of these require immediate attention)
- [ ] Critical services not starting
- [ ] Database connection failures
- [ ] Authentication completely broken
- [ ] All task executions failing
- [ ] Memory/disk usage >90%
- [ ] Continuous error loops in logs
- [ ] Major performance degradation (>5s response times)

## Quick Fixes for Common Issues

### Issue: Services won't start
```bash
# Solution: Clean restart
docker-compose -f docker-compose.mcp.yml down
docker-compose -f docker-compose.mcp.yml up -d
```

### Issue: Database connection errors
```bash
# Solution: Check and restart PostgreSQL
docker-compose -f docker-compose.mcp.yml restart postgres
# Wait 30 seconds, then test connection
```

### Issue: Missing protobuf files
```bash
# Solution: Regenerate protobuf files
cd proto && ./generate.sh
```

### Issue: Authentication failures
```bash
# Solution: Check JWT secret and create test user
# Verify JWT_SECRET environment variable is set
echo $JWT_SECRET
```

### Issue: High resource usage
```bash
# Solution: Restart resource-heavy services
docker-compose -f docker-compose.mcp.yml restart mcp-supervisor-intelligence
```

## Test Results Log

**Date**: _______________  
**Tester**: _______________  
**Duration**: _____ minutes

**Results**:
- Infrastructure: ✅/❌
- API Testing: ✅/❌  
- Agent Verification: ✅/❌
- Observability: ✅/❌
- Performance: ✅/❌

**Issues Found**:
_________________________________
_________________________________
_________________________________

**Actions Taken**:
_________________________________
_________________________________
_________________________________

**Overall Status**: ✅ READY FOR PRODUCTION / ❌ NEEDS ATTENTION

---

*Complete this checklist before deploying MCP to production. All checks should pass within 30 minutes for a properly configured system.*