# Cartrita Hierarchical Master Control Program (MCP)

## Overview

The Cartrita MCP transforms the existing Cartrita AI system into a production-grade, three-tier hierarchical agent architecture with comprehensive observability, security, and scalability. This implementation maintains full backward compatibility while providing modern microservices patterns and enterprise-grade reliability.

## Architecture

### Three-Tier Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 0: ORCHESTRATOR                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │   HTTP/WebSocket │ │    Auth & JWT   │ │  Legacy Bridge  │ │
│  │     Gateway      │ │   Management    │ │   (v2 → v3)     │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
┌───────────────▼──┐ ┌─────────▼──────┐ ┌────▼──────────────┐
│ TIER 1: INTELLIGENCE│ │TIER 1: MULTIMODAL│ │ TIER 1: SYSTEM    │
│   SUPERVISOR       │ │   SUPERVISOR     │ │   SUPERVISOR      │
│                   │ │                  │ │                   │
│ • LangChain/Graph │ │ • Vision/Audio   │ │ • Health Checks   │
│ • HuggingFace NLP │ │ • Deepgram Live  │ │ • Telemetry       │
│ • Research/Writing│ │ • Sensor Fusion  │ │ • Life OS         │
│ • Code Generation │ │ • Image/Video    │ │ • Security Audits │
└───────────────────┘ └──────────────────┘ └───────────────────┘
        │                       │                       │
   ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
   │ TIER 2: │             │ TIER 2: │             │ TIER 2: │
   │SUB-AGENTS│            │SUB-AGENTS│            │SUB-AGENTS│
   │         │             │         │             │         │
   │• Writer │             │• Artist │             │• Monitor│
   │• Coder  │             │• Vision │             │• Audit  │
   │• Research│            │• Audio  │             │• Config │
   │• Analytics│           │• Multi  │             │• Health │
   └─────────┘             └─────────┘             └─────────┘
```

### Key Features

- **🔄 Backward Compatible**: All existing v2 endpoints continue working
- **🚀 High Performance**: Fastify 4.x + MessagePack + Unix Sockets  
- **📊 Full Observability**: OpenTelemetry + Jaeger + Prometheus + Grafana
- **🔒 Enterprise Security**: JWT + mTLS + Vault + Audit Logging
- **💰 Cost Governance**: Token budgets + Model fallbacks + Smart caching
- **📈 Auto-Scaling**: Dynamic supervisor scaling + Load balancing
- **🐳 Container Ready**: Docker + Kubernetes + Helm charts

## Quick Start

### Prerequisites

- Node.js 20+ LTS
- Python 3.12+
- Docker & Docker Compose
- PostgreSQL 16 with pgvector
- Redis 7+

### 1. Environment Setup

```bash
# Clone the repository (already done)
cd /home/robbie/development/dat-bitch-cartrita

# Copy environment template
cp packages/backend/.env.example packages/backend/.env
cp .env.example .env

# Set required API keys
export OPENAI_API_KEY="your-openai-key"
export HUGGINGFACE_API_KEY="your-hf-key"
export DEEPGRAM_API_KEY="your-deepgram-key"
export JWT_SECRET="cartrita-mcp-jwt-secret-2025"
```

### 2. Generate Protocol Buffers

```bash
# Install buf CLI (if not already installed)
curl -sSL "https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m)" -o "/usr/local/bin/buf"
chmod +x /usr/local/bin/buf

# Generate TypeScript and Python types
cd proto
./generate.sh
```

### 3. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Install Python dependencies for agents
cd py && pip install -r requirements.txt
```

### 4. Start with Docker Compose

```bash
# Start the full MCP stack
docker-compose -f docker-compose.mcp.yml up -d

# Check service health
docker-compose -f docker-compose.mcp.yml ps
```

### 5. Verify Installation

```bash
# Check orchestrator health
curl http://localhost:8002/health

# Check legacy backend compatibility
curl http://localhost:8001/health

# Access Swagger UI
open http://localhost:8002/docs

# View Grafana dashboards
open http://localhost:3002 (admin/admin123)

# View Jaeger traces
open http://localhost:16686
```

## Service Endpoints

| Service | Port | Purpose | URL |
|---------|------|---------|-----|
| **MCP Orchestrator** | 8002 | Main MCP API Gateway | http://localhost:8002 |
| **Legacy Backend** | 8001 | Backward compatibility | http://localhost:8001 |
| **Frontend** | 3001 | User interface | http://localhost:3001 |
| **Grafana** | 3002 | Dashboards & monitoring | http://localhost:3002 |
| **Jaeger** | 16686 | Distributed tracing | http://localhost:16686 |
| **Prometheus** | 9090 | Metrics collection | http://localhost:9090 |
| **PostgreSQL** | 5435 | Database (pgvector) | localhost:5435 |
| **Redis** | 6380 | Cache & message broker | localhost:6380 |

## API Usage

### MCP v3 API (Recommended)

```javascript
// Authenticate
const authResponse = await fetch('http://localhost:8002/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password' })
});
const { token } = await authResponse.json();

// Execute a task
const taskResponse = await fetch('http://localhost:8002/v3/tasks', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    taskType: 'huggingface.text.summarization',
    parameters: {
      text: 'Long text to summarize...',
      maxLength: 150
    },
    priority: 5,
    timeout: 30000
  })
});
const result = await taskResponse.json();
```

### WebSocket Real-time

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8002', {
  auth: { token: 'your-jwt-token' }
});

// Send MCP message
socket.emit('mcp:message', {
  messageType: 'TASK_REQUEST',
  payload: {
    taskType: 'langchain.chat.execute',
    parameters: { message: 'Hello, how are you?' }
  }
});

// Receive response
socket.on('mcp:response', (response) => {
  console.log('Task result:', response);
});
```

### Legacy v2 API (Backward Compatible)

```javascript
// All existing endpoints work unchanged
const response = await fetch('http://localhost:8001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello Cartrita!' })
});
```

## Development

### Local Development

```bash
# Start dependencies only
docker-compose up postgres redis -d

# Start orchestrator in development mode
cd packages/orchestrator
npm run dev

# Start supervisors in development mode (separate terminals)
cd packages/supervisor-intelligence && npm run dev
cd packages/supervisor-multimodal && npm run dev
cd packages/supervisor-system && npm run dev
```

### Building Components

```bash
# Build all MCP packages
npm run build

# Build specific package
cd packages/mcp-core && npm run build
cd packages/orchestrator && npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
cd packages/mcp-core && npm run test:coverage
cd packages/orchestrator && npm run test

# Run integration tests
npm run test:integration

# Run load tests
npm run test:load
```

## Configuration

### Environment Variables

```bash
# Core MCP Configuration
MCP_PORT=8002
MCP_HOST=0.0.0.0
JWT_SECRET=your-secret-key

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=dat-bitch-cartrita
POSTGRES_USER=robert
POSTGRES_PASSWORD=punky1

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=optional

# AI Services
OPENAI_API_KEY=your-openai-key
OPENAI_ORGANIZATION=your-org-id
HUGGINGFACE_API_KEY=your-hf-key
DEEPGRAM_API_KEY=your-deepgram-key

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=cartrita-mcp
LOG_LEVEL=info
```

### Custom Configuration

```typescript
// packages/orchestrator/config/production.ts
import { OrchestratorConfig } from '../src/index';

export const config: OrchestratorConfig = {
  port: 8002,
  cors: {
    origin: ['https://your-domain.com'],
    credentials: true
  },
  rateLimit: {
    max: 1000,
    timeWindow: 60000
  },
  enableMetrics: true,
  enableTracing: true
};
```

## Monitoring & Observability

### Grafana Dashboards

Pre-built dashboards included:

- **MCP Overview**: System health, throughput, latency
- **Agent Performance**: Task completion rates, response times
- **Cost Analysis**: Token usage, model costs, budget tracking
- **Error Analysis**: Error rates, failure patterns, alerts
- **Infrastructure**: Database, Redis, system resources

### Key Metrics

```
# Task Metrics
cartrita_mcp_tasks_started_total
cartrita_mcp_tasks_completed_total  
cartrita_mcp_tasks_failed_total
cartrita_mcp_task_duration_seconds

# Message Metrics
cartrita_mcp_messages_sent_total
cartrita_mcp_messages_received_total
cartrita_mcp_message_latency_seconds

# Cost Metrics
cartrita_mcp_tokens_used_total
cartrita_mcp_cost_incurred_usd_total
cartrita_mcp_model_usage_total

# System Metrics
cartrita_mcp_agent_health
cartrita_mcp_agent_cpu_usage_percent
cartrita_mcp_agent_memory_usage_bytes
```

### Alerting Rules

```yaml
# config/alerts/mcp-alerts.yml
groups:
  - name: cartrita-mcp
    rules:
      - alert: HighErrorRate
        expr: rate(cartrita_mcp_tasks_failed_total[5m]) > 0.1
        for: 2m
        annotations:
          summary: "High error rate detected"
          
      - alert: HighLatency  
        expr: histogram_quantile(0.95, cartrita_mcp_task_duration_seconds) > 10
        for: 5m
        annotations:
          summary: "95th percentile latency > 10s"
```

## Security

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication with RS256 signing
- **Role-Based Access**: User, admin, system roles with granular permissions
- **API Rate Limiting**: Per-user and global rate limits
- **Request Validation**: Comprehensive input validation with Zod

### Transport Security

- **mTLS**: Mutual TLS for inter-service communication
- **TLS 1.3**: All external connections encrypted
- **Network Policies**: Kubernetes network segmentation
- **Secrets Management**: HashiCorp Vault integration

### Data Protection

- **Encryption at Rest**: AES-256-GCM for sensitive data
- **PII Redaction**: Automatic detection and masking
- **Audit Logging**: Complete audit trail with retention policies
- **GDPR Compliance**: Data minimization and right to erasure

## Cost Management

### Budget Controls

```typescript
// Set user budget limits
const budget: CostBudget = {
  maxUsd: 100.00,      // Daily limit
  maxTokens: 1000000,  // Token limit
  usedUsd: 0,
  usedTokens: 0,
  modelCosts: {
    'gpt-4': 0.03,     // Per 1K tokens
    'gpt-3.5-turbo': 0.002
  }
};
```

### Model Fallbacks

Automatic cost optimization:
- `gpt-4` → `gpt-4o-mini` when approaching budget
- Cache frequent queries to reduce API calls
- Batch processing for efficiency
- Smart model selection based on complexity

## Troubleshooting

### Common Issues

**1. Service Won't Start**
```bash
# Check logs
docker-compose -f docker-compose.mcp.yml logs mcp-orchestrator

# Check database connection
docker-compose exec postgres pg_isready -U robert

# Verify environment variables
docker-compose exec mcp-orchestrator env | grep MCP
```

**2. Agent Tasks Failing**
```bash
# Check supervisor logs
docker-compose -f docker-compose.mcp.yml logs mcp-supervisor-intelligence

# Verify API keys
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check Redis connectivity
docker-compose exec redis redis-cli ping
```

**3. High Latency**
```bash
# Check Jaeger traces
open http://localhost:16686

# Monitor queue depths
curl http://localhost:8002/health | jq '.queues'

# Check resource usage
docker stats
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
export OTEL_LOG_LEVEL=debug

# Run with debug flags
docker-compose -f docker-compose.mcp.yml up --build
```

### Performance Tuning

```typescript
// Adjust concurrency limits
const config = {
  maxConcurrentTasks: 50,      // Per supervisor
  connectionPoolSize: 20,      // Database
  redisPoolSize: 10,          // Redis connections  
  messageQueueSize: 1000,     // Message buffer
  cacheTimeout: 3600,         // Cache TTL (seconds)
};
```

## Migration from v2 to v3

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide including:

- Phase-by-phase migration plan
- Backward compatibility matrix
- Performance comparison
- Migration testing procedures
- Rollback strategies

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/mcp-enhancement`
3. Follow existing code style and conventions
4. Add tests for new functionality
5. Update documentation
6. Submit pull request

### Development Standards

- **TypeScript**: Strict mode, comprehensive typing
- **ESLint**: Standard configuration with custom rules
- **Testing**: >80% coverage, unit + integration tests
- **Documentation**: JSDoc for all public APIs
- **Git**: Conventional commits, signed commits

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/cartrita/mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cartrita/mcp/discussions)
- **Security**: security@cartrita.com

---

**Built with ❤️ by the Cartrita Team**

*Transforming AI agent architecture for the future* 🚀