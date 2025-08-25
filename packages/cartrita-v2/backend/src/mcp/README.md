# Cartrita Hierarchical MCP (Master Control Program) System

## Architecture Overview

The Cartrita MCP system implements a three-tier hierarchical architecture that wraps and coordinates the existing agent infrastructure:

```
┌─────────────────────────────────────────┐
│              Tier 0: Orchestrator       │
│         (Task Routing & Coordination)    │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────────────────┐ ┌───▼──────────────────┐
│ Tier 1: Intelligence │ │ Tier 1: MultiModal    │
│     Supervisor      │ │     Supervisor       │
│                    │ │                      │
│ • Research Tasks   │ │ • Vision Analysis    │
│ • Writing Tasks    │ │ • Audio Processing   │
│ • Code Generation  │ │ • Sensor Fusion      │
│ • Analytics        │ │ • Media Processing   │
└─────┬──────────────┘ └──────┬───────────────┘
      │                       │
┌─────▼──────────────────────▼─────┐
│         Tier 2: Agent Wrappers    │
│                                  │
│ • WriterAgent                    │
│ • CodeWriterAgent                │
│ • AnalyticsAgent                 │
│ • ResearchAgent                  │
│ • LangChainExecutor              │
│ • HuggingFaceLanguageAgent       │
│ • DeepgramAgent                  │
└──────────────────────────────────┘
```

## Components

### Core Components (`src/mcp/core/`)

- **Transport Layer**: In-process, Unix sockets, gRPC communication
- **Schema Definitions**: TypeScript/Zod and Python/Pydantic schemas
- **Message Types**: Request/response format definitions
- **Logging & Metrics**: Centralized logging and performance tracking

### Tier 0: Orchestrator (`src/mcp/orchestrator/`)

- **Main Router**: Routes tasks to appropriate supervisors
- **Security Manager**: Authentication and authorization
- **Database Connection**: Persistent storage integration
- **Legacy Bridge**: Compatibility with existing v2 API

### Tier 1: Supervisors (`src/mcp/supervisors/`)

#### Intelligence Supervisor (`intelligence/`)

Handles language processing, research, and analytical tasks:

- **Agent Registry**: Manages and routes to specific agents
- **Cost Manager**: Tracks API costs and enforces budgets
- **Quality Gate**: Validates requests and responses
- **Model Cache**: Caches responses to reduce API calls
- **Task Router**: Routes tasks to appropriate agents

#### MultiModal Supervisor (`multimodal/`)

Handles vision, audio, and sensor fusion tasks:

- **Stream Manager**: Manages real-time data streams
- **Sensor Fusion**: Combines multiple sensor inputs
- **Media Processor**: Handles media file processing
- **Agent Pool**: Manages multimodal agents

### Tier 2: Agent Wrappers (`supervisors/*/agents/`)

Individual agent implementations that wrap existing backend agents:

- **WriterAgent**: Content creation and editing
- **CodeWriterAgent**: Code generation and refactoring
- **AnalyticsAgent**: Data analysis and reporting
- **ResearchAgent**: Web search and information gathering
- **LangChainExecutor**: LangChain-based task execution
- **HuggingFaceLanguageAgent**: HuggingFace model integration
- **DeepgramAgent**: Speech-to-text and audio processing

## Integration with Existing Backend

The MCP system integrates seamlessly with the existing Cartrita backend:

### Startup Integration

- Initializes after existing services in `index.js`
- Wraps existing agents from `src/agi/consciousness/`
- Maintains backward compatibility with existing routes

### API Integration

- New MCP routes available at `/api/mcp/*`
- Existing routes continue to work unchanged
- Can process tasks through MCP or legacy system

### Task Types Supported

**Intelligence Tasks:**

- `research.web.search` - Web search and information gathering
- `research.github.search` - GitHub repository search
- `writer.content.create` - Content creation and writing
- `writer.blog.post` - Blog post generation
- `codewriter.generate.function` - Code function generation
- `codewriter.refactor.code` - Code refactoring
- `analytics.data.query` - Data querying and analysis
- `analytics.report.generate` - Report generation
- `langchain.agent.execute` - LangChain task execution

**MultiModal Tasks:**

- `multimodal.vision.analyze` - Image and video analysis
- `multimodal.audio.transcribe` - Audio transcription
- `multimodal.fuse` - Sensor data fusion
- `deepgram.audio.transcribe.live` - Real-time audio transcription
- `artist.generate_image` - Image generation

## Usage

### Via REST API

```javascript
// Process a task
POST /api/mcp/task
{
  "taskType": "writer.content.create",
  "parameters": {
    "prompt": "Write a blog post about AI",
    "tone": "professional",
    "length": "medium"
  }
}

// Get system status
GET /api/mcp/status

// Get agent hierarchy
GET /api/mcp/agent-hierarchy
```

### Supervisor Override

```javascript
POST /api/mcp/supervisor/override
{
  "task_description": "Complex multi-step research task",
  "task_type": "research.comprehensive",
  "parameters": {
    "topic": "AI trends 2024",
    "sources": ["web", "academic", "github"]
  },
  "priority": "high"
}
```

### Health Check

```javascript
GET / api / mcp / health;
```

## Configuration

The MCP system uses environment variables for configuration:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_key
OPENAI_ORGANIZATION=your_org

# HuggingFace Configuration
HUGGINGFACE_API_KEY=your_hf_key

# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_key

# Search Engine Configuration
TAVILY_API_KEY=your_tavily_key
SERPAPI_API_KEY=your_serp_key

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_user
DB_PASSWORD=your_password
DB_NAME=your_database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## Development

### Adding New Agents

1. Create agent wrapper in appropriate supervisor directory
2. Implement required methods: `initialize()`, `execute()`, `shutdown()`
3. Register in agent registry or pool
4. Add supported task types to routing configuration

### Adding New Task Types

1. Define task type in core schemas
2. Add routing rules in supervisor
3. Implement task handling in appropriate agent
4. Update documentation

## Monitoring & Observability

The MCP system includes comprehensive monitoring:

- **OpenTelemetry Integration**: Distributed tracing and metrics
- **Cost Tracking**: API usage and cost monitoring
- **Performance Metrics**: Task execution times and success rates
- **Health Checks**: System health and component status
- **Quality Gates**: Request/response validation

## Migration from Legacy System

The MCP system is designed for gradual migration:

1. **Phase 1**: MCP runs alongside existing system
2. **Phase 2**: Route selected tasks through MCP
3. **Phase 3**: Migrate all tasks to MCP
4. **Phase 4**: Deprecate legacy routing

Existing agents and functionality remain unchanged - MCP provides a coordination layer on top.
