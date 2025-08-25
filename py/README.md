# Cartrita Hybrid System - Production README
# Complete guide for the Node.js/Python hybrid architecture

## 🏗️ Architecture Overview

Cartrita is a sophisticated multi-agent AI system built with a hybrid Node.js/Python architecture that leverages the strengths of both languages:

- **Node.js Backend** (Port 8000): Real-time communication, API routing, user management, system orchestration
- **Python Backend** (Port 8002): AI/ML processing, data analysis, vector search, advanced analytics
- **MCP Orchestration**: Master Control Program for intelligent task distribution and agent coordination
- **Frontend** (Port 3000): React-based user interface with real-time updates
- **Observability Stack**: Jaeger tracing, Prometheus metrics, Grafana dashboards

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm
- Python 3.11+ and pip
- 8GB+ RAM (16GB recommended)
- 20GB+ free disk space

### One-Command Deployment
```bash
cd /home/robbie/development/dat-bitch-cartrita
./py/quickstart.sh
```

### Manual Deployment
```bash
# 1. Setup environment
cp py/.env.example py/.env
npm install
cd py && pip install -r requirements.txt && cd ..

# 2. Start services
docker-compose -f docker-compose.hybrid-v2.yml up -d

# 3. Wait for services and run tests
sleep 30
python py/test_hybrid.py
```

## 🏛️ System Architecture

### Core Components

#### 1. Node.js Backend (`packages/backend/`)
- **Express.js** server with RESTful APIs
- **LangChain StateGraph** for agent orchestration
- **OpenTelemetry** tracing and metrics
- **MCP Bridge** for Python communication
- **Language Router** for intelligent task distribution

Key Services:
- Authentication and authorization
- Real-time WebSocket connections
- API gateway and routing
- System monitoring and health checks
- MCP orchestration and agent management

#### 2. Python Backend (`py/`)
- **FastAPI** server optimized for AI/ML workloads
- **Transformers** and **HuggingFace** integration
- **FAISS** vector search engine
- **scikit-learn** for data analysis
- **PyTorch** for deep learning models

Key Agents:
- **MLModelAgent**: Sentiment analysis, classification, NLP tasks
- **DataAnalysisAgent**: Statistical analysis, data visualization
- **VectorSearchAgent**: Semantic search and embeddings

#### 3. Cartrita V2 API (`packages/cartrita-v2/backend/`)
- Modern RESTful API with `/api/v2/*` structure
- 31 specialized endpoints across 8 domains:
  - System management and monitoring
  - Security and authentication
  - Knowledge management and search
  - AI and machine learning services
  - Life OS integration (calendar, contacts)
  - Settings and configuration
  - Communication services
  - HuggingFace model integration

#### 4. MCP (Master Control Program)
- **Unix Socket Transport** for inter-service communication
- **MessagePack** encoding for efficient data transfer
- **Agent Registry** with capability-based routing
- **Performance Tracking** and optimization
- **Hierarchical Task Distribution**

## 🔧 Configuration

### Environment Variables

The system uses multiple `.env` files for different components:

#### Python Backend (`py/.env`)
```env
DATABASE_URL=postgresql://robert:punky1@localhost:5432/dat-bitch-cartrita
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your-key-here
PYTHON_SERVICE_PORT=8002
MCP_SOCKET_PATH=/tmp/cartrita_mcp.sock
```

#### Node.js Backend (`packages/backend/.env`)
```env
DATABASE_URL=postgresql://robert:punky1@postgres:5432/dat-bitch-cartrita
PYTHON_SERVICE_URL=http://python-backend:8002
PORT=8000
NODE_ENV=development
```

### Docker Configuration

Services are orchestrated using `docker-compose.hybrid-v2.yml`:

- **PostgreSQL** with pgvector extension
- **Redis** for caching and message queuing
- **Node.js** backend service
- **Python** backend service
- **Frontend** React application
- **Nginx** reverse proxy
- **Jaeger** for distributed tracing
- **Prometheus** for metrics collection
- **Grafana** for observability dashboards

## 🧪 Testing

### Automated Test Suite
```bash
python py/test_hybrid.py
```

Test categories:
- Service health checks
- MCP communication validation
- Language routing accuracy
- AI agent functionality
- V2 API endpoint validation
- Cross-service integration

### Manual Testing

#### Health Checks
```bash
curl http://localhost:8000/health    # Node.js backend
curl http://localhost:8002/health    # Python backend
curl http://localhost:3002/health    # Cartrita V2 API
```

#### MCP Status
```bash
curl http://localhost:8000/api/mcp/status
```

#### AI Agent Testing
```bash
# Sentiment analysis
curl -X POST http://localhost:8002/api/ml/inference \
  -H "Content-Type: application/json" \
  -d '{"model_type": "sentiment", "input_text": "I love this system!"}'

# Vector search
curl -X POST http://localhost:8002/api/vector/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "top_k": 5}'
```

## 📊 Monitoring and Observability

### Access Points
- **Grafana**: http://localhost:3001 (admin/admin)
- **Jaeger**: http://localhost:16686
- **Prometheus**: http://localhost:9090

### Key Metrics
- Request latency and throughput
- Agent execution times
- MCP bridge performance
- Database connection pools
- Memory and CPU utilization
- Error rates by service

### Logging
- **Structured JSON** logging across all services
- **Centralized logs** via Docker Compose
- **OpenTelemetry traces** with correlation IDs
- **Performance spans** for agent operations

## 🔒 Security

### API Keys Management
- Environment-based configuration
- Secure storage in Docker secrets
- Rate limiting and authentication
- CORS protection

### Network Security
- Internal Docker networking
- Nginx reverse proxy
- Service-to-service authentication
- Unix socket security for MCP

## 🛠️ Development

### Local Development Setup
```bash
# Start databases only
docker-compose -f docker-compose.hybrid-v2.yml up -d postgres redis

# Run Node.js backend locally
cd packages/backend
npm run dev

# Run Python backend locally (separate terminal)
cd py
python main.py

# Run frontend locally (separate terminal)
cd packages/frontend
npm run dev
```

### Adding New Agents

#### Python Agent
```python
# py/agents/my_agent.py
from mcp_core.bridge.python_bridge import PythonAgent

class MyCustomAgent(PythonAgent):
    def __init__(self):
        super().__init__(name="my_custom_agent", capabilities=["custom_task"])
    
    async def execute_task(self, task_data):
        # Your implementation here
        return {"result": "success", "data": task_data}
```

#### Node.js Agent
```javascript
// packages/backend/src/agi/consciousness/MyAgent.js
class MyAgent extends BaseAgent {
    constructor() {
        super({
            name: 'my_agent',
            role: 'sub',
            config: { allowedTools: ['custom_tool'] }
        });
    }
    
    async execute(state) {
        // Your implementation here
        return { messages: [...], next_agent: 'cartrita' };
    }
}
```

### Database Migrations
```bash
# Run migrations
cd packages/backend
npm run migrate

# Create new migration
npm run migrate:create migration_name
```

## 🚦 Deployment

### Production Deployment
```bash
# Build and deploy
docker-compose -f docker-compose.hybrid-v2.yml up -d --build

# Verify deployment
./py/quickstart.sh status
python py/test_hybrid.py
```

### Scaling Considerations
- Horizontal scaling for Node.js workers
- GPU acceleration for Python AI workloads
- Redis cluster for high availability
- Database read replicas
- CDN for frontend assets

## 🔄 Maintenance

### Regular Tasks
```bash
# View service logs
docker-compose -f docker-compose.hybrid-v2.yml logs -f

# Restart specific service
docker-compose -f docker-compose.hybrid-v2.yml restart python-backend

# Cleanup old containers
docker system prune -f

# Backup database
pg_dump -h localhost -U robert dat-bitch-cartrita > backup.sql
```

### Performance Tuning
- Monitor agent execution times
- Optimize vector search indices
- Tune database connection pools
- Adjust worker processes
- Cache frequently accessed data

## 🆘 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker daemon
sudo systemctl status docker

# Check port conflicts
netstat -tulpn | grep :8000

# View service logs
docker-compose logs python-backend
```

#### MCP Communication Issues
```bash
# Check Unix socket
ls -la /tmp/cartrita_mcp.sock

# Verify bridge status
curl http://localhost:8000/api/mcp/status
```

#### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U robert -d dat-bitch-cartrita -c "SELECT version();"

# Check database logs
docker-compose logs postgres
```

### Performance Issues
- Monitor Grafana dashboards
- Check agent execution times in Jaeger
- Review database query performance
- Analyze memory usage patterns

## 📚 Additional Resources

- **Architecture Documentation**: `docs/specs/architecture/`
- **API Documentation**: `docs/api/`
- **Development Guide**: `docs/DEVELOPMENT.md`
- **Migration Guide**: `docs/MIGRATION_V1_TO_V2.md`
- **Project Notebook**: `docs/PROJECT_NOTEBOOK.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `python py/test_hybrid.py`
4. Submit a pull request
5. Ensure all CI checks pass

## 📄 License

See `LICENSE` file for details.

---

**Built with ❤️ by the Cartrita team**