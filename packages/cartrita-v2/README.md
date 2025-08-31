# Cartrita V2

## Project Structure (2025)

- **/py**: Python backend (FastAPI, agents, AI services, MCP integration)
- **/frontend**: React 18 + TypeScript UI/UX (hybrid GPT/Claude chat)
- **/docs/project-manuals**: All project documentation and guides
- **/db-init**: Database migration scripts (pgvector, vault, workflow, agents)
- **docker-compose.yml**: Main orchestration file for all services

## Setup & Deployment

### 1. Environment

- Copy `.env.example` to `.env` and configure all required API keys
- PostgreSQL 14+ with pgvector, Redis, Python 3.11+, Docker

### 2. Install Dependencies

```bash
cd py && pip install -r requirements.txt
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

- **Frontend**: http://localhost:3000
- **Python Backend**: http://localhost:8002
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

### 🌉 Python Backend Services

- **Python/FastAPI**: Port 8002 - AI agent services, MCP integration, all APIs
- **PostgreSQL**: Database with pgvector for embeddings
- **Redis**: Caching and session management

```bash
# Start Python backend only
cd py && python3 main.py

# Or use Docker
docker-compose up python-backend
```

### 📊 API Endpoints

#### Python Backend (Port 8002)

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
├── py/                        # Python backend (FastAPI)
│   ├── main.py               # Main server entry point
│   ├── fastapi_mcp_copilot.py        # FastAPI MCP integration
│   ├── copilot_delegation_agent.py    # GUI copilot automation
│   ├── headless_copilot_delegation.py # Headless version
│   └── requirements.txt              # Python dependencies
├── frontend/                  # Next.js React frontend
│   ├── src/                  # React components and pages
│   ├── public/               # Static assets
│   └── package.json          # Frontend dependencies
├── db-init/                  # Database initialization scripts
├── docs/                     # Documentation
├── copilot-instructions.md   # Copilot delegation procedures
├── docker-compose.yml        # Docker configuration
└── Makefile                 # Build and development commands
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

### Prompt Config
- Default persona file: `py/prompts/cartrita_system_prompt.md`
- Override with env: set `CARTRITA_SYSTEM_PROMPT_PATH=/absolute/or/relative/path.md`
- `.env` auto-load: `build.py` loads `.env` at repo root; no extra step
- Scope: Persona is injected into all chat and agent flows by default
- Tip: After updating the persona file or override, restart the backend

### Copilot Instructions
Customize `copilot-instructions.md` to define project-specific delegation workflows.

## 🔧 Development

### Adding New Features

1. **Python API Routes**: Add to `py/` directory  
2. **MCP Tools**: Extend `mcp_copilot_delegation.py`
3. **Database**: Add migration to `db-init/`
4. **Frontend**: Add React components to `frontend/src/`

### Code Style

- **Python**: Follow PEP 8 standards, use Black formatter
- **TypeScript/React**: ESLint configuration in `frontend/`
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
