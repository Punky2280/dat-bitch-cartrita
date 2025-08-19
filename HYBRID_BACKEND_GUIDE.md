# Hybrid Backend Integration Guide

This guide covers the complete setup and usage of the hybrid Fastify + FastAPI backend architecture with the enhanced React chat interface.

## 🏗️ Architecture Overview

### Hybrid Backend Stack
- **Fastify (Node.js)** - Port 8001
  - WebSocket/Socket.IO real-time communication
  - Authentication and session management
  - Frontend-compatible API endpoints
  - Inter-service communication coordination

- **FastAPI (Python)** - Port 8002  
  - AI/ML processing and inference
  - OpenAI integration
  - RAG (Retrieval Augmented Generation) pipeline
  - Vector operations and embeddings
  - Advanced agent processing

- **Frontend (React)** - Port 3000
  - Modern chat interface with hybrid backend awareness
  - Real-time WebSocket communication
  - Enhanced UI with backend service indicators
  - Automatic routing between Fastify/FastAPI based on task type

### Service Communication
```
Frontend (React) <-> Fastify (Node.js) <-> FastAPI (Python)
     |                    |                      |
     |                    |                      |
  Port 3000           Port 8001              Port 8002
```

## 🚀 Quick Start

### 1. Start the Hybrid Backend
```bash
# Start both Fastify and FastAPI services
./start-hybrid.sh
```

### 2. Start the Frontend
```bash
# In a new terminal
cd packages/frontend
npm run dev
```

### 3. Access the Enhanced Chat Interface
- **Standard Chat**: http://localhost:3000/chat
- **Enhanced Hybrid Chat**: http://localhost:3000/chat-enhanced

### 4. Test the Integration
```bash
# Run comprehensive integration tests
./test-hybrid-integration.sh
```

## 📋 Features

### Enhanced Chat Interface Features
- **Hybrid Backend Toggle**: Switch between standard Fastify and hybrid AI processing
- **Backend Status Indicators**: Real-time service status and model information
- **Smart Task Routing**: Automatically routes complex AI tasks to FastAPI backend
- **Suggested Prompts**: Context-aware prompts with backend preferences
- **Performance Metrics**: Processing time and token usage tracking
- **Fallback Handling**: Graceful fallback to standard backend if FastAPI is unavailable

### API Endpoints

#### Fastify Backend (Port 8001)
```
GET  /health                    - Health check
GET  /api/v2/system/status      - System status
POST /api/v2/chat/send          - Send chat message
GET  /api/v2/chat/sessions      - Get chat sessions

# AI Proxy Endpoints (forwards to FastAPI)
POST /api/v2/ai/generate        - AI text generation
POST /api/v2/ai/rag/search      - RAG knowledge search  
POST /api/v2/ai/agents/:id/process - Agent processing
GET  /api/v2/ai/health          - FastAPI health via proxy
```

#### FastAPI Backend (Port 8002)
```
GET  /health                    - Health check
POST /generate                  - AI text generation
POST /rag/search                - Vector search
POST /agents/{agent_id}/process - Agent processing
```

## 🛠️ Development

### Environment Variables
Create `.env.v2` in the project root:
```bash
# Fastify Configuration
FASTIFY_PORT=8001
FASTIFY_HOST=localhost

# FastAPI Configuration  
FASTAPI_PORT=8002
FASTAPI_URL=http://localhost:8002

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/cartrita
REDIS_URL=redis://localhost:6379

# Development Settings
NODE_ENV=development
LOG_LEVEL=info
```

### Running Services Individually

#### Fastify Backend
```bash
cd apps/backend-v2
npm run dev
```

#### FastAPI Backend
```bash
cd apps/fastapi-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

#### Frontend
```bash
cd packages/frontend
npm run dev
```

### Docker Development
```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.hybrid.yml up --build
```

## 🧪 Testing

### Run All Tests
```bash
./test-hybrid.sh
```

### Test Individual Components
```bash
# Test Fastify backend
curl http://localhost:8001/health

# Test FastAPI backend  
curl http://localhost:8002/health

# Test AI generation
curl -X POST http://localhost:8001/api/v2/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello AI!", "model": "gpt-3.5-turbo"}'

# Test RAG search
curl -X POST http://localhost:8001/api/v2/ai/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search", "limit": 5}'
```

## 🔧 Configuration

### Hybrid Chat Interface Configuration
The enhanced chat interface includes several configuration options:

```typescript
// Enable/disable hybrid backend processing
setUseHybridAI(true)

// Available models
const models = [
  'Cartrita-GPT',      // Standard Fastify backend
  'FastAPI-Enhanced',  // FastAPI backend
  'Hybrid-Agent'       // Multi-backend processing
]

// Task-based backend routing
const taskRouting = {
  'analyze': 'fastapi',
  'code': 'fastapi', 
  'AI': 'fastapi',
  'chat': 'fastify'
}
```

### Backend Integration Settings
```javascript
// FastAPIClient.js configuration
const client = new FastAPIClient({
  baseURL: process.env.FASTAPI_URL || 'http://localhost:8002',
  timeout: 30000,
  retries: 3
})
```

## 📊 Monitoring & Observability

### Service Status Monitoring
The enhanced chat interface provides real-time status indicators for:
- Fastify service health
- FastAPI service availability  
- Active model and processing mode
- Request/response metrics

### Performance Metrics
- Processing time per request
- Token usage tracking
- Backend routing decisions
- Error rates and fallback triggers

## 🚨 Troubleshooting

### Common Issues

#### FastAPI Service Not Starting
```bash
# Check Python dependencies
cd apps/fastapi-service
pip install -r requirements.txt

# Check port availability
lsof -i :8002
```

#### Inter-Service Communication Errors
```bash
# Verify Fastify can reach FastAPI
curl http://localhost:8001/api/v2/ai/health

# Check FastAPI directly
curl http://localhost:8002/health
```

#### Frontend Not Connecting to Backend
- Verify both backend services are running
- Check browser console for CORS errors
- Ensure API endpoints match frontend configuration

### Debug Mode
Enable debug logging:
```bash
export LOG_LEVEL=debug
./start-hybrid.sh
```

## 📁 File Structure

```
├── apps/
│   ├── backend-v2/                 # Fastify backend
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   └── FastAPIClient.js # Integration layer
│   │   │   └── routes/api/
│   │   │       └── ai.js           # AI proxy routes
│   │   └── package.json
│   └── fastapi-service/            # FastAPI backend
│       ├── main.py                 # FastAPI main app
│       ├── requirements.txt        # Python dependencies
│       └── Dockerfile
├── packages/
│   └── frontend/
│       └── src/
│           ├── pages/
│           │   ├── ModernChatNew.tsx      # Standard chat
│           │   └── ModernChatEnhanced.tsx # Hybrid chat
│           ├── context/
│           │   └── AppContext.tsx         # Enhanced context
│           └── routing/
│               └── SimpleRouter.tsx       # Updated routing
├── docker-compose.hybrid.yml       # Multi-service orchestration
├── start-hybrid.sh                 # Development startup script
├── test-hybrid.sh                  # Backend testing script
└── test-hybrid-integration.sh      # Full integration testing
```

## 🔄 Deployment

### Production Deployment
1. Build the services:
```bash
docker-compose -f docker-compose.hybrid.yml build
```

2. Deploy with environment variables:
```bash
# Set production environment variables
export NODE_ENV=production
export FASTIFY_PORT=8001
export FASTAPI_PORT=8002

# Deploy
docker-compose -f docker-compose.hybrid.yml up -d
```

3. Configure reverse proxy (Nginx):
```nginx
# config/nginx-hybrid.conf
upstream fastify_backend {
    server localhost:8001;
}

upstream fastapi_backend {  
    server localhost:8002;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /api/v2/ai/ {
        proxy_pass http://fastify_backend;
    }
    
    location /api/ {
        proxy_pass http://fastify_backend;
    }
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

## 🤝 Contributing

1. Follow the existing code patterns for both Fastify and FastAPI
2. Add tests for new features in both backends
3. Update documentation for API changes
4. Ensure frontend components gracefully handle backend failures
5. Test integration between all three services

## 📞 Support

- Check the integration test output: `./test-hybrid-integration.sh`
- Review service logs in the terminal
- Verify all environment variables are correctly set
- Ensure all required dependencies are installed

---

**Happy coding with the hybrid Fastify + FastAPI + React architecture!** 🚀