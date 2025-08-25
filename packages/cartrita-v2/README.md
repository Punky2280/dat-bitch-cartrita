# Cartrita V2

## Project Structure (2025)

- **/backend**: Node.js backend (Express/Fastify, agents, API)
- **/frontend**: React 18 + TypeScript UI/UX (hybrid GPT/Claude chat)
- **/docs/project-manuals**: All project documentation and guides
- **/db-init**: Database migration scripts (pgvector, vault, workflow, agents)
- **docker-compose.yml**: Main orchestration file for all services
- **Dockerfile (backend/frontend)**: Main Dockerfiles for each service

## Setup & Deployment

### 1. Environment

- Copy `.env.example` to `.env` and configure all required API keys
- PostgreSQL 14+ with pgvector, Redis, Node.js 18+, Docker

### 2. Install Dependencies

```bash
npm install
cd backend && npm install
cd frontend && npm install
```

### 3. Database Setup

```bash
docker-compose up -d postgres redis
psql -d $DATABASE_URL -f db-init/00_setup_pgvector.sql
psql -d $DATABASE_URL -f db-init/01_create_vault_tables_fixed.sql
psql -d $DATABASE_URL -f db-init/02_create_iteration_19_tables.sql
psql -d $DATABASE_URL -f db-init/03_create_iteration_22_tables.sql
```

### 4. Start All Services

```bash
docker-compose up --build -d
```

### 5. Access

- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:8001
- **MCP Orchestrator**: http://localhost:8002
- **Grafana**: http://localhost:3002
- **Jaeger**: http://localhost:16686

## Documentation

All manuals and guides are in `/docs/project-manuals/`.

## Features

- Hierarchical multi-agent system (LangChain, HuggingFace, OpenAI, Deepgram)
- Hybrid GPT/Claude chat UI with multimodal support
- Secure API vault, fine-tuning, workflow automation, observability

See `/docs/project-manuals/COMPREHENSIVE_PROJECT_DOCUMENTATION.md` for full details.
```

### Docker Deployment
```bash
# Build and start with Docker
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.yml up -d
```

## 🎯 Core Features

### 🤖 MCP Copilot Delegation
- **GUI Automation**: Full mouse/keyboard control for GitHub Copilot
- **Project Analysis**: Intelligent codebase understanding
- **Task Planning**: AI-powered delegation strategies
- **Headless Operation**: Works in server environments without GUI

```bash
# Test Copilot delegation
npm run test:copilot

# Run delegation session
cd py && python3 copilot_delegation_agent.py
```

### 🌉 Hybrid Backend Services
- **Node.js/Fastify**: Port 8001 - Main orchestration layer
- **Python/FastAPI**: Port 8003 - AI agent services  
- **MCP Integration**: Standardized tool communication

```bash
# Start individual services
npm run dev          # Fastify backend only
npm run dev:fastapi  # FastAPI backend only
npm run dev:both     # Both services (recommended)
```

### 📊 API Endpoints

#### Fastify Backend (Port 8001)
- `GET /` - Service status
- `GET /health` - Health check
- `POST /api/chat` - Main chat interface
- `POST /api/computer` - Computer use agent
- `GET /api/agents/status` - Agent status

#### FastAPI Backend (Port 8003)  
- `GET /health` - Python service health
- `POST /api/v2/chat` - AI chat with intelligent routing
- `POST /api/v2/computer-use` - Computer automation
- `GET /api/v2/agents/status` - Python agent status

#### MCP Copilot Endpoints
- `POST /api/mcp/copilot/start-session` - Start delegation session
- `POST /api/mcp/copilot/analyze-project` - Analyze project structure
- `POST /api/mcp/copilot/create-instructions` - Create instruction templates
- `GET /api/mcp/copilot/status` - MCP service status

## 🧪 Testing

```bash
# Run all tests
npm test

# Smoke tests
npm run test:smoke

# Advanced integration tests  
npm run test:advanced

# MCP integration tests
node test-mcp-integration.js

# Copilot delegation test
npm run copilot:demo
```

## 🗂️ Project Structure

```
cartrita-v2/                    # Master directory
├── src/                       # Fastify (Node.js) backend
│   ├── index.js              # Main server entry point
│   ├── mcp-copilot-integration.js  # MCP bridge
│   └── services/             # Service layer
├── py/                       # FastAPI (Python) backend  
│   ├── copilot_delegation_agent.py    # GUI copilot automation
│   ├── headless_copilot_delegation.py # Headless version
│   ├── fastapi_mcp_copilot.py        # FastAPI MCP integration
│   ├── headless_fastapi_server.py    # Headless FastAPI server
│   └── requirements.txt              # Python dependencies
├── db-init/                  # Database initialization scripts
├── docs/                     # Documentation
├── scripts/                  # Utility scripts
├── copilot-instructions.md   # Copilot delegation procedures
├── docker-compose.yml        # Docker configuration
├── package.json             # Node.js configuration
└── start.sh                 # Quick startup script
```

## ⚙️ Configuration

### Environment Variables
```bash
# Copy template and configure
cp .env.example .env

# Required variables:
OPENAI_API_KEY=your-openai-key
POSTGRES_URL=postgresql://...
NODE_ENV=development|production
```

### Copilot Instructions
Customize `copilot-instructions.md` to define project-specific delegation workflows.

## 🔧 Development

### Adding New Features
1. **Fastify Routes**: Add to `src/` directory
2. **FastAPI Endpoints**: Add to `py/` directory  
3. **MCP Tools**: Extend `mcp_copilot_delegation.py`
4. **Database**: Add migration to `db-init/`

### Code Style
- **Node.js**: ESLint configuration in `.eslintrc.json`
- **Python**: Follow PEP 8 standards
- **Commits**: Conventional commit messages

## 📚 Documentation

- `HYBRID_BACKEND_GUIDE.md` - Architecture deep-dive
- `MCP_COPILOT_INTEGRATION_SUMMARY.md` - Copilot system details
- `docs/guides/` - Implementation guides
- `docs/project-manuals/` - Project documentation

## 🎊 Production Features

- ✅ **High Performance**: Fastify + async Python
- ✅ **Scalable Architecture**: Microservice-ready design
- ✅ **Full Observability**: Logging, metrics, tracing
- ✅ **Docker Support**: Container deployment ready
- ✅ **Database Integration**: PostgreSQL with migrations
- ✅ **Security**: Input validation, rate limiting, CORS
- ✅ **Testing**: Comprehensive test coverage
- ✅ **CI/CD Ready**: Docker and script automation

## 📞 Support

For issues and feature requests:
1. Check existing documentation
2. Run diagnostic scripts in `scripts/`
3. Review logs in `logs/` directory
4. Create issue with system info and reproduction steps

---

**Cartrita V2** - Where AI meets production-ready architecture 🚀
