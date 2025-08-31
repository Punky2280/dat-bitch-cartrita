# Cartrita V2 - Python-Only Architecture Documentation
======================================================

## Overview

Cartrita V2 has been refactored to use a **Python-only backend architecture** with FastAPI, removing all Node.js dependencies and hybrid complexity. This provides a cleaner, more maintainable system focused on AI agents, MCP integration, and modern web development practices.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Cartrita V2 System                      │
├─────────────────────────────────────────────────────────┤
│  Frontend (Next.js 15)          │  Python Backend       │
│  ├─ React 19                   │  ├─ FastAPI           │
│  ├─ TypeScript                 │  ├─ AI Agents         │
│  ├─ Tailwind CSS              │  ├─ MCP Integration   │
│  └─ Modern UI Components      │  └─ Computer Use      │
├─────────────────────────────────────────────────────────┤
│              Infrastructure                             │
│  ├─ PostgreSQL + pgvector     │  ├─ Redis Cache       │
│  ├─ Docker Compose            │  ├─ Health Checks     │
│  └─ Monitoring & Logging      │  └─ Security          │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
cartrita-v2/
├── build.py                    # Comprehensive Python build system
├── cartrita                    # CLI wrapper script
├── setup-environment.sh        # Environment setup script
├── docker-compose.yml          # Docker orchestration
├── Makefile                    # Make targets for common tasks
├── README.md                   # Project documentation
│
├── py/                         # Python Backend (FastAPI)
│   ├── main.py                 # FastAPI application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── constraints.txt         # Dependency constraints
│   ├── Dockerfile              # Python backend container
│   ├── config.py               # Application configuration
│   ├── mcp_tools_server.py     # MCP tools integration
│   ├── copilot_delegation_agent.py  # AI agent delegation
│   └── cartrita_core/          # Core business logic
│       ├── agents/             # AI agent implementations
│       ├── tools/              # MCP tool definitions
│       └── utils/              # Utility functions
│
├── frontend/                   # Next.js Frontend
│   ├── package.json            # Node.js dependencies
│   ├── next.config.ts          # Next.js configuration
│   ├── Dockerfile              # Frontend container
│   ├── src/                    # Source code
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Utility libraries
│   │   └── types/              # TypeScript types
│   └── public/                 # Static assets
│
├── db-init/                    # Database initialization
│   ├── init.sql                # Basic database setup
│   └── *.sql                   # Migration scripts
│
└── docs/                       # Documentation
    ├── API.md                  # API documentation
    ├── DEPLOYMENT.md           # Deployment guide
    └── DEVELOPMENT.md          # Development guide
```

## Key Features

### 🐍 Python-Only Backend
- **FastAPI**: High-performance async web framework
- **Pydantic**: Data validation and serialization
- **SQLAlchemy**: Database ORM with async support
- **Redis**: Caching and session management
- **AI Integration**: OpenAI, LangChain, Qiskit

### 🤖 AI Agent System
- **MCP Integration**: Model Context Protocol support
- **Computer Use**: Automated UI interaction
- **Copilot Delegation**: GitHub Copilot automation
- **Quantum Computing**: Qiskit integration for advanced algorithms

### 🌐 Modern Frontend
- **Next.js 15**: Latest React framework with App Router
- **React 19**: Modern React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Responsive Design**: Mobile-first approach

### 🐳 Infrastructure
- **Docker Compose**: Container orchestration
- **PostgreSQL**: Primary database with pgvector
- **Redis**: Fast caching and real-time features
- **Health Checks**: Comprehensive monitoring
- **Logging**: Structured logging with log levels

## Build System

The project includes a comprehensive Python-based build system with multiple interfaces:

### Python Build Script
```bash
# Complete setup
python3 build.py setup

# Development mode
python3 build.py dev

# Production deployment
python3 build.py prod

# Run tests
python3 build.py test

# Docker deployment
python3 build.py docker

# Clean artifacts
python3 build.py clean

# Show help
python3 build.py --help
```

### CLI Wrapper
```bash
# Same commands, shorter syntax
./cartrita setup
./cartrita dev
./cartrita prod
./cartrita test
./cartrita docker
./cartrita clean
```

### Make Interface
```bash
# Environment setup (first time only)
make setup-env

# Common commands
make setup      # Complete setup
make dev        # Development mode
make prod       # Production deployment
make test       # Run tests
make docker     # Docker deployment
make clean      # Clean artifacts
make help       # Show available commands
```

## Quick Start

### 1. Environment Setup (First Time Only)
```bash
# Setup system dependencies and environment
make setup-env

# Or manually:
./setup-environment.sh
```

### 2. Project Setup
```bash
# Complete project setup
make setup

# Or using Python directly:
python3 build.py setup
```

### 3. Development
```bash
# Start development environment
make dev

# Services will be available at:
# - Frontend: http://localhost:3000
# - Python API: http://localhost:8002
# - Database: localhost:5432
# - Redis: localhost:6379
```

### 4. Production Deployment
```bash
# Deploy to production
make prod

# Or with comprehensive testing:
python3 build.py prod
```

## Development Workflow

### Daily Development
1. **Start Development Environment**
   ```bash
   make dev
   ```

2. **Make Changes**
   - Python code in `py/`
   - Frontend code in `frontend/src/`

3. **Test Changes**
   ```bash
   make test
   ```

4. **Lint Code**
   ```bash
   make lint
   ```

### Adding New Features

1. **Backend (Python)**
   - Add endpoints in `py/main.py`
   - Create agents in `py/cartrita_core/agents/`
   - Add tools in `py/cartrita_core/tools/`
   - Update requirements if needed

2. **Frontend (React/TypeScript)**
   - Add components in `frontend/src/components/`
   - Create pages in `frontend/src/app/`
   - Update types in `frontend/src/types/`

3. **Database Changes**
   - Add migration scripts in `db-init/`
   - Update models as needed

## Configuration

### Environment Variables (.env)
```bash
# API Keys
OPENAI_API_KEY=your-openai-api-key

# Database
POSTGRES_USER=robert
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=dat-bitch-cartrita

# Services
PORT=8002
PYTHON_PORT=8002
FRONTEND_PORT=3000

# Development
NODE_ENV=development
DEBUG=true
LOG_LEVEL=INFO
```

### Docker Configuration
All services are configured in `docker-compose.yml`:
- PostgreSQL with pgvector extension
- Redis cache
- Python FastAPI backend
- Next.js frontend

## API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `POST /api/v2/chat` - AI chat interface
- `POST /api/v2/computer-use` - Computer automation
- `GET /api/v2/agents/status` - Agent status

### MCP Integration
- `POST /api/mcp/copilot/start-session` - Start delegation
- `POST /api/mcp/copilot/analyze-project` - Project analysis
- `GET /api/mcp/copilot/status` - MCP status

## Testing

### Python Tests
```bash
# Run all Python tests
cd py && python -m pytest

# Run with coverage
cd py && python -m pytest --cov

# Run specific test
cd py && python -m pytest test_specific.py
```

### Integration Tests
```bash
# Full test suite
make test

# Or using build system
python3 build.py test
```

## Deployment

### Development
```bash
make dev
```

### Production
```bash
make prod
```

### Docker Only
```bash
make docker
```

## Monitoring and Logging

### Health Checks
```bash
# Check all services
make health

# Manual health checks
curl http://localhost:8002/health      # Python backend
curl http://localhost:3000/            # Frontend
```

### Logs
```bash
# View all logs
docker-compose logs -f

# Python backend only
docker-compose logs -f python-backend

# Database logs
docker-compose logs -f postgres
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Stop conflicting services
   sudo lsof -i :8002  # Python backend
   sudo lsof -i :3000  # Frontend
   sudo lsof -i :5432  # PostgreSQL
   ```

2. **Database Connection**
   ```bash
   # Check database status
   make db-status
   
   # Restart database
   docker-compose restart postgres
   ```

3. **Python Dependencies**
   ```bash
   # Clean install
   cd py && pip install --force-reinstall -r requirements.txt
   ```

4. **Docker Issues**
   ```bash
   # Clean rebuild
   make clean
   docker-compose up --build --force-recreate
   ```

### Getting Help

1. **Check logs**: `docker-compose logs -f`
2. **Run health checks**: `make health`
3. **Clean and rebuild**: `make clean && make dev`
4. **Check documentation**: Files in `docs/` directory
5. **Build system help**: `python3 build.py --help`

## Contributing

1. **Code Style**
   - Python: Follow PEP 8, use Black formatting
   - TypeScript: Use Prettier, follow React best practices
   - Commits: Use conventional commit messages

2. **Testing**
   - Write tests for new features
   - Ensure all tests pass before submitting
   - Test in both development and production modes

3. **Documentation**
   - Update README and docs for significant changes
   - Include API documentation for new endpoints
   - Add comments for complex logic

## Roadmap

### Current Features ✅
- Python-only backend with FastAPI
- Modern Next.js frontend
- Docker containerization
- Comprehensive build system
- AI agent integration
- MCP support

### Planned Features 🚧
- Advanced monitoring and metrics
- Auto-scaling capabilities
- CI/CD pipeline integration
- Advanced security features
- Performance optimizations
- Extended AI capabilities

---

**Cartrita V2** - Where AI meets production-ready Python architecture 🚀