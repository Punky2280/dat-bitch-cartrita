# Cartrita V2 - Docker Setup

## Quick Start (One Command)

```bash
./start-cartrita.sh
```

This single command will:
- Build all Docker containers (Frontend, Node.js Backend, Python AI Backend)
- Start PostgreSQL database with pgvector extension
- Start Redis cache
- Initialize database schema
- Start all services and wait for them to be healthy
- Show service URLs and logs

## Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js React application |
| Node.js API | 8001 | Main API gateway & MCP orchestrator |
| Python AI | 8002 | AI agents, computer use, ML processing |
| PostgreSQL | 5432 | Database with vector extensions |
| Redis | 6379 | Cache and session storage |

## Prerequisites

1. **Docker & Docker Compose** installed
2. **.env file** with required environment variables:
   ```bash
   # Required
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Optional but recommended
   HUGGINGFACE_API_KEY=your_hf_token_here
   DEEPGRAM_API_KEY=your_deepgram_key_here
   GITHUB_TOKEN=your_github_token_here
   
   # Security (change in production)
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_MASTER_KEY=your_encryption_key_here
   ```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Frontend   │    │ Node.js API │    │ Python AI   │
│   (React)   │◄──►│ (Express)   │◄──►│ (FastAPI)   │
│   Port 3000 │    │   Port 8001 │    │   Port 8002 │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ PostgreSQL  │    │   Redis     │
                   │   +pgvector │    │   Cache     │
                   │   Port 5432 │    │   Port 6379 │
                   └─────────────┘    └─────────────┘
```

## Features Included

### ✅ **Complete AI Agent System**
- 6 specialized AI agents (supervisor, research, writer, vision, code, computer-use)
- OpenAI GPT-4o integration with proper API formatting
- Real-time agent orchestration and delegation

### ✅ **Computer Use Capabilities**
- **Playwright** for headless browser automation
- **Selenium** as fallback for web automation  
- **PyAutoGUI** compatibility layer (graceful headless fallback)
- Real screenshots and interactions in containerized environment

### ✅ **Frontend & Backend Integration**
- Next.js frontend with TypeScript
- Express.js API gateway with MCP integration
- FastAPI Python backend for AI processing
- WebSocket support for real-time communication

### ✅ **Database & Persistence**
- PostgreSQL with pgvector extension for embeddings
- Redis for caching and session management
- Automatic schema initialization
- Data persistence across container restarts

## Commands

### Start Everything
```bash
./start-cartrita.sh
```

### Stop Everything  
```bash
docker-compose -f docker-compose.unified.yml down
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.unified.yml logs -f

# Specific service
docker-compose -f docker-compose.unified.yml logs -f python-backend
docker-compose -f docker-compose.unified.yml logs -f node-backend
docker-compose -f docker-compose.unified.yml logs -f frontend
```

### Rebuild Services
```bash
docker-compose -f docker-compose.unified.yml up --build -d
```

### Access Service Shells
```bash
# Python backend
docker-compose -f docker-compose.unified.yml exec python-backend bash

# Node.js backend  
docker-compose -f docker-compose.unified.yml exec node-backend sh

# Database
docker-compose -f docker-compose.unified.yml exec postgres psql -U robert -d dat-bitch-cartrita
```

## Testing the Setup

### 1. Health Checks
```bash
curl http://localhost:8001/health  # Node.js backend
curl http://localhost:8002/health  # Python backend  
curl http://localhost:3000         # Frontend
```

### 2. Chat Functionality
```bash
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Cartrita", "user_id": "test"}'
```

### 3. Agent Status
```bash
curl http://localhost:8001/api/agents/status
```

## Development Mode

For development, you can mount your local code:

```yaml
volumes:
  - ./backend:/app
  - ./py:/app  
  - ./frontend:/app
```

The containers will automatically restart when you make code changes.

## Troubleshooting

### Services Won't Start
1. Check Docker is running: `docker info`
2. Check .env file exists and has required keys
3. Check ports aren't in use: `lsof -i :3000,8001,8002,5432,6379`

### Database Connection Issues
```bash
docker-compose -f docker-compose.unified.yml logs postgres
docker-compose -f docker-compose.unified.yml exec postgres pg_isready -U robert
```

### Python AI Backend Issues
```bash
docker-compose -f docker-compose.unified.yml logs python-backend
# Check if OpenAI API key is valid
```

### Frontend Build Issues
```bash
docker-compose -f docker-compose.unified.yml logs frontend
# Check Node.js version compatibility
```

## Production Deployment

For production:

1. **Change default passwords and secrets**
2. **Use proper TLS certificates**
3. **Configure proper firewall rules**
4. **Set up monitoring and log aggregation**
5. **Use Docker secrets for sensitive data**

```bash
# Example production command
docker-compose -f docker-compose.unified.yml -f docker-compose.prod.yml up -d
```

## Monitoring & Observability

The setup includes health checks for all services:
- Automatic restarts on failure
- Health check endpoints
- Structured logging
- Ready for Prometheus/Grafana integration

---

**🚀 Cartrita V2 is now containerized and ready for deployment!**