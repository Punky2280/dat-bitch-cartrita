# Cartrita Hierarchical Multi-Agent System

**The World's Most Advanced Personal AI Operating System**

**DBC**: Data-driven AI Tool that Applies Behavioral Intelligence Tools while Connecting Humanity.  
**Cartrita**: Cognitive AI Reasoning Tool for Real-time Information and Task Automation.

---

## 📋 **Table of Contents**

1. [Project Overview](#-project-overview)
2. [Iteration History](#-iteration-history)
   - [Iteration 18: Secure API Vault](#iteration-18-secure-api-vault)
   - [Iteration 19: Personal Life OS](#iteration-19-personal-life-os)
   - [Iteration 20: Enhanced Multi-Agent Framework](#iteration-20-enhanced-multi-agent-framework)
   - [Iteration 21: Multi-Modal Intelligence](#iteration-21-multi-modal-intelligence)
   - [Iteration 22: Advanced AI Integration](#iteration-22-advanced-ai-integration)
3. [Quick Start Guide](#-quick-start-guide)
4. [Architecture & Technology Stack](#-architecture--technology-stack)
5. [Installation & Setup](#-installation--setup)
6. [API Documentation](#-api-documentation)
7. [Development Status](#-development-status)
8. [Troubleshooting](#-troubleshooting)
9. [License](#license)

---

## 🚀 **Project Overview**

Cartrita has evolved from a simple chatbot into a **revolutionary hierarchical multi-agent AI system** that orchestrates 11+ specialized agents using LangChain StateGraph architecture. This isn't just another AI assistant - it's a complete **Personal AI Operating System** with real tools, supervisor overrides, and advanced multi-modal capabilities.

### 🌟 **What Makes Cartrita Revolutionary**

**🧠 Hierarchical Multi-Agent Architecture**

- **11+ Specialized Agents** - Each with distinct capabilities and real tool access
- **Master Supervisor Agent** - Can override any agent and access ALL 40+ tools
- **LangChain StateGraph** - Advanced agent coordination with explicit handoffs
- **MCP (Model Context Protocol)** - Standardized inter-agent communication

**🛠️ Real Tool Ecosystem (NO MOCKS)**

- **40+ Functional Tools** - Web scraping, AI analysis, database queries, API integrations
- **OpenAI Integration** - GPT-4, Vision, DALL-E 3, TTS all connected and working
- **Live Database Operations** - PostgreSQL with semantic search and real-time updates
- **External API Access** - Google Calendar, GitHub, arXiv, Wikipedia, and more

**🎯 Sassy Urban Personality**

- **Street-Smart AI** - Maintains Cartrita's signature rebellious, direct personality
- **Context-Aware Responses** - Understands your vibe and adapts accordingly
- **Multi-Modal Interface** - Text, voice, and visual interaction with personality intact

---

## 📈 **Iteration History**

### Latest: Comprehensive Workflow Tools & Knowledge Management System

_Focus: 1000+ workflow automation tools with vector search and AI-powered manual system_

#### 🛠️ Revolutionary Features Implemented

- **1000+ Workflow Tools**: Complete automation toolkit with OpenAI-only implementations
- **Vector Database**: Semantic search across all tools and documentation using pgvector
- **AI-Powered Manual**: Searchable knowledge base with automatic content generation
- **Complete OpenTelemetry Integration**: Full upstream OpenTelemetry JS & Contrib merged into backend
- **Smart Telemetry Agent**: Natural language interface for telemetry operations
- **Smart Categorization**: Intelligent tool categorization by complexity and use case

#### 🔍 Advanced Search & Discovery

- **Semantic Search**: Natural language queries to find perfect tools
- **Category Filtering**: Browse by Development, Security, DevOps, Data Analysis, etc.
- **Complexity Levels**: Beginner-friendly to expert-level tools
- **Usage Analytics**: Track tool popularity and execution success rates

#### 🗄️ Database Tables Added

- `workflow_categories` - Hierarchical tool categorization system
- `workflow_tools` - Complete tool database with embeddings for semantic search
- `user_manual_sections` - AI-powered documentation with vector search
- `workflow_tool_dependencies` - Tool relationships and prerequisites
- `workflow_execution_logs` - Comprehensive execution tracking and analytics
- `user_workflow_favorites` - Personalized tool and manual bookmarks
- `user_tool_ratings` - Community-driven tool quality ratings

#### 🔧 Services Created

- `WorkflowToolsService` - Complete workflow management with OpenTelemetry tracing
- `OpenTelemetryIntegrationService` - Complete upstream OpenTelemetry JS integration
- `TelemetryAgent` - AI-powered natural language telemetry interface
- Enhanced OpenTelemetry with production-ready observability patterns
- Vector embedding generation for semantic search capabilities

#### 📋 API Endpoints Added

- `GET /api/workflow-tools/search` - Semantic search across all tools
- `GET /api/workflow-tools/categories` - Browse tool categories
- `GET /api/workflow-tools/trending` - Popular and trending tools
- `GET /api/workflow-tools/:id` - Detailed tool information and usage
- `POST /api/workflow-tools` - Add custom workflow tools
- `GET /api/workflow-tools/manual/search` - Search documentation and guides
- `POST /api/workflow-tools/bulk-import` - Mass import workflow tools
- `POST /api/telemetry/command` - Natural language telemetry operations
- `GET /api/telemetry/status` - Complete observability status
- `GET /api/telemetry/manual` - Interactive telemetry documentation

#### 🎯 Tool Categories Include

- **Development**: Code analysis, testing, documentation, refactoring
- **Security (White-Hat)**: Vulnerability scanning, compliance, audit trails
- **DevOps**: CI/CD optimization, infrastructure management, deployment
- **Data Analysis**: Quality assessment, visualization, processing
- **Cloud & Infrastructure**: IaC validation, monitoring, optimization
- **Productivity**: Meeting management, email enhancement, project planning
- **Custom Tools**: User-created automation and specialized workflows
- **Observability**: OpenTelemetry tracing, metrics collection, performance monitoring
- **AI Operations**: Natural language telemetry commands, intelligent analysis

---

### Iteration 18: Secure API Vault

_Focus: Secure API key management and encrypted storage_

#### 🔐 Features Implemented

- **Secure API Key Storage**: AES-256-GCM authenticated encryption
- **Provider Management**: Support for 20+ API providers (OpenAI, Google, AWS, etc.)
- **Key Rotation**: Automatic key rotation with configurable intervals
- **Security Audit Logging**: Comprehensive security event tracking
- **Usage Analytics**: API usage tracking and cost management

#### 🗄️ Database Tables Added

- `api_providers` - Provider configurations and metadata
- `user_api_keys` - Encrypted API key storage with rotation tracking
- `api_security_events` - Security audit logs and event tracking
- `api_key_rotation_history` - Key rotation history and compliance
- `api_key_usage_analytics` - Usage metrics and cost tracking

#### 🔧 Services Created

- `SecureEncryptionService` - AES-256-GCM encryption/decryption
- Enhanced vault routes with key validation and testing

#### 📋 API Endpoints

- `GET /api/vault/providers` - List supported API providers
- `GET /api/vault/keys` - User's API keys (masked for security)
- `POST /api/vault/keys` - Add/update API keys with encryption
- `DELETE /api/vault/keys/:keyId` - Delete API keys securely
- `POST /api/vault/keys/:keyId/test` - Test API key functionality
- `GET /api/vault/security-events` - Security audit logs

---

### Iteration 19: Personal Life OS

_Focus: Calendar, Email, and Contact management with AI assistance_

#### 📅 Features Implemented

- **Calendar Integration**: Google Calendar and Outlook synchronization
- **Email Management**: Gmail and Outlook with AI-powered categorization
- **Contact Management**: Cross-platform contact synchronization
- **AI-Powered Assistance**: Email summarization and task extraction
- **Real-time Sync**: Background synchronization with conflict resolution

#### 🗄️ Database Tables Added

- `user_calendar_events` - Calendar events with sync status
- `user_calendar_sync` - Calendar synchronization configuration
- `user_email_messages` - Email messages with AI analysis
- `user_email_sync` - Email synchronization settings
- `user_contacts` - Contact management with interaction history
- `user_contact_interactions` - Contact interaction tracking
- `user_contact_sync` - Contact synchronization status
- `user_assistant_tasks` - AI-generated tasks from emails/calendar
- `user_assistant_notifications` - Smart notifications and reminders

#### 🔧 Services Enhanced/Created

- `EmailService` - Complete rewrite with OAuth2 and AI integration
- `CalendarService` - Cross-platform calendar management
- `ContactService` - Unified contact management
- Enhanced authentication for Google and Microsoft APIs

#### 📋 API Endpoints

- `GET /api/calendar/events` - Calendar events with filtering
- `POST /api/calendar/sync` - Manual calendar synchronization
- `GET /api/email/messages` - Email messages with AI analysis
- `POST /api/email/send` - Send emails through multiple providers
- `GET /api/contacts/list` - Contacts with search and filtering
- `POST /api/contacts/sync` - Contact synchronization
- `GET /api/tasks/assistant` - AI-generated tasks
- `GET /api/notifications/smart` - Intelligent notifications

---

### Iteration 20: Enhanced Multi-Agent Framework

_Focus: LangChain StateGraph integration and agent orchestration_

#### 🤖 Features Implemented

- **LangChain StateGraph**: Advanced agent workflow management
- **Hierarchical Agent System**: Master supervisor with specialized agents
- **Tool Registry**: Dynamic tool registration and access control
- **Message Bus**: Inter-agent communication system
- **Agent Health Monitoring**: Real-time agent status and performance

#### 🧠 Agents Implemented

- `EnhancedLangChainCoreAgent` - Master supervisor agent
- `ResearcherAgent` - Web research and information gathering
- `CodeWriterAgent` - Code generation and analysis
- `ArtistAgent` - Image generation and visual content
- `SchedulerAgent` - Calendar and task scheduling
- `WriterAgent` - Content creation and editing
- `ComedianAgent` - Humor and entertainment
- `EmotionalIntelligenceAgent` - Emotional analysis and support
- `TaskManagementAgent` - Task coordination and workflow
- `AnalyticsAgent` - Data analysis and insights
- `DesignAgent` - UI/UX design and prototyping

#### 🔧 System Components

- `MessageBus` - Event-driven communication system
- `BaseAgent` - Common agent functionality and protocols
- `AgentToolRegistry` - Dynamic tool management
- `SupervisorRegistry` - Agent hierarchy management

#### 📋 API Endpoints

- `GET /api/mcp/agent-hierarchy` - Agent system status
- `POST /api/mcp/supervisor/override` - Master supervisor override
- `GET /api/mcp/tool-registry` - Available tools and capabilities

---

### Iteration 21: Multi-Modal Intelligence

_Focus: Voice, vision, and ambient intelligence capabilities_

#### 🎤 Features Implemented

- **Voice Interaction**: Real-time voice chat with "Cartrita!" wake word
- **Speech-to-Text**: Deepgram integration with ambient detection
- **Text-to-Speech**: OpenAI TTS with personality-matched voice
- **Visual Analysis**: OpenAI Vision API for scene understanding
- **Ambient Listening**: Environmental sound classification
- **Multi-Modal Fusion**: Cross-sensory data integration

#### 🔧 Services Created

- `VoiceInteractionService` - Real-time voice processing
- `AmbientListeningService` - Background audio analysis
- `VisualAnalysisService` - Image and video processing
- `TextToSpeechService` - Natural voice synthesis
- `MultiModalFusionAgent` - Cross-modal data integration
- `SensoryProcessingService` - Unified sensory input handling

#### 📋 API Endpoints

- `POST /api/voice-chat/process` - Real-time voice interaction
- `POST /api/voice-to-text/transcribe` - Speech transcription
- `POST /api/vision/analyze` - Visual content analysis
- `GET /api/voice-chat/status` - Voice system status
- `POST /api/ambient/listen` - Ambient sound analysis

#### 🗄️ System Integration

- Real-time WebSocket connections for voice/video
- Streaming audio processing with wake word detection
- Multi-modal memory system for context retention
- Personality-consistent voice responses

---

### Iteration 22: Advanced AI Integration

_Focus: Multi-modal processing, intelligent orchestration, and adaptive learning_

#### 🧠 Features Implemented

- **Multi-Modal AI Pipeline**: Advanced cross-modal understanding and fusion
- **Intelligent Tool Orchestration**: AI-powered tool selection and optimization
- **Adaptive Agent Intelligence**: Learning from interactions and performance
- **Real-Time Intelligence Hub**: Streaming analytics and predictive insights
- **Enhanced MCP Protocol**: Advanced inter-agent communication

#### 🔄 Multi-Modal Processing

- **Vision-Language Integration**: Combined image/text understanding
- **Audio-Visual Fusion**: Real-time multi-sensory analysis
- **Cross-Modal Learning**: AI models understanding data relationships
- **Contextual Memory**: Multi-modal memory storage and retrieval

#### 🎯 Intelligent Orchestration

- **Dynamic Tool Selection**: Performance-based tool routing
- **Execution Optimization**: Automatic workflow optimization
- **Failure Recovery**: Intelligent error handling and fallbacks
- **Performance Learning**: Continuous improvement from usage patterns

#### 🧮 Adaptive Learning

- **Behavioral Adaptation**: Agents learn from user preferences
- **Collaborative Intelligence**: Agents share knowledge and experiences
- **Skill Transfer**: Cross-domain knowledge application
- **Meta-Learning**: Learning how to learn more efficiently

#### 🗄️ Database Tables Added

- `multimodal_data` - Multi-modal data storage with embeddings
- `multimodal_relationships` - Cross-modal relationship mapping
- `ai_learning_models` - AI model configurations and training states
- `tool_performance_history` - Tool usage analytics and optimization
- `agent_adaptation_rules` - Adaptive behavior rule engine
- `orchestration_logs` - Intelligent orchestration decision tracking
- `intelligence_streams` - Real-time data stream configuration
- `predictive_insights` - AI-generated predictions and recommendations
- `cross_modal_learning_sessions` - Multi-modal training sessions
- `mcp_message_analytics` - Enhanced MCP communication analytics

#### 🔧 Services Enhanced/Created

- `MultiModalProcessingService` - Advanced multi-modal data processing
- `EnhancedMCPCoordinator` - Intelligent agent coordination
- Enhanced MCP message types for advanced communication
- Adaptive learning framework for continuous improvement

#### 📋 API Endpoints

- `POST /api/iteration22/multimodal/process` - Multi-modal data processing
- `POST /api/iteration22/orchestration/optimize` - Orchestration optimization
- `POST /api/iteration22/learning/adapt` - Adaptive learning configuration
- `GET /api/iteration22/analytics/performance` - Performance analytics
- `POST /api/iteration22/intelligence/predict` - Predictive insights
- `GET /api/iteration22/status` - Comprehensive system status

#### 🧪 Testing & Validation

- Comprehensive test suite for all Iteration 22 features
- Multi-modal processing validation
- Performance benchmarking and optimization
- Learning system effectiveness measurement

---

## 🚀 **Quick Start Guide**

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with pgvector extension
- Docker and Docker Compose (recommended)

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/dat-bitch-cartrita.git
cd dat-bitch-cartrita
npm install
```

### 2. Environment Configuration

```bash
# Copy and configure environment variables
cp .env.example .env
cp packages/backend/.env.example packages/backend/.env

# Required API keys
OPENAI_API_KEY=your_openai_key
DEEPGRAM_API_KEY=your_deepgram_key
DATABASE_URL=postgresql://user:pass@localhost:5432/cartrita
```

### 3. Database Setup

```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run migrations in order
psql -d $DATABASE_URL -f db-init/00_setup_pgvector.sql
psql -d $DATABASE_URL -f db-init/01_create_vault_tables_fixed.sql
psql -d $DATABASE_URL -f db-init/02_create_iteration_19_tables.sql
psql -d $DATABASE_URL -f db-init/03_create_iteration_22_tables.sql
```

### 4. Start Services

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 5. Test Installation

```bash
# Run comprehensive test suite
node packages/backend/scripts/test-iteration-22.js

# Test specific iterations
node packages/backend/scripts/test-vault-system.js
node packages/backend/scripts/test-personal-life-os.js
```

---

## 🏗️ **Architecture & Technology Stack**

### Core Technologies

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL 14+ with pgvector for embeddings
- **AI Framework**: LangChain with StateGraph orchestration
- **Frontend**: React 18 with TypeScript
- **Real-time**: Socket.IO for live communication
- **Authentication**: JWT with bcrypt encryption

### AI & ML Integration

- **OpenAI APIs**: GPT-4, Vision, DALL-E 3, TTS, Embeddings
- **Deepgram**: Speech-to-text with wake word detection
- **LangChain**: Agent orchestration and tool management
- **Vector Search**: pgvector for semantic similarity
- **Multi-Modal**: Cross-modal AI processing and fusion

### Observability & Monitoring

- **OpenTelemetry**: Complete upstream JS & Contrib integration
- **Distributed Tracing**: Full-stack request tracing with context propagation
- **Metrics Collection**: Custom business and system metrics
- **AI-Powered Telemetry**: Natural language observability commands
- **Performance Monitoring**: Real-time system health and optimization

### Security & Storage

- **Encryption**: AES-256-GCM for sensitive data
- **API Security**: Secure key vault with rotation
- **Data Protection**: End-to-end encryption for personal data
- **Audit Logging**: Comprehensive security event tracking

### Communication Protocols

- **MCP (Model Context Protocol)**: Standardized agent communication
- **WebSocket**: Real-time voice/video streaming
- **REST APIs**: Standard HTTP endpoints for all services
- **Message Bus**: Event-driven inter-service communication

---

## 💾 **Installation & Setup**

### Development Environment

1. **System Requirements**

   - Node.js 18+ with npm/yarn
   - PostgreSQL 14+ with pgvector extension
   - Redis (optional, for caching)
   - 8GB+ RAM recommended for AI processing

2. **API Keys Required**

   ```env
   OPENAI_API_KEY=sk-...        # GPT-4, Vision, DALL-E, TTS
   DEEPGRAM_API_KEY=...         # Speech-to-text
   GOOGLE_CLIENT_ID=...         # Calendar/Gmail integration
   GOOGLE_CLIENT_SECRET=...
   MICROSOFT_CLIENT_ID=...      # Outlook integration
   MICROSOFT_CLIENT_SECRET=...
   ```

3. **Database Extensions**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS btree_gin;
   ```

### Production Deployment

1. **Docker Deployment**

   ```bash
   docker-compose up -d
   ```

2. **Manual Deployment**

   ```bash
   npm run build
   npm run migrate
   pm2 start ecosystem.config.js
   ```

3. **Environment Variables**
   - All API keys properly configured
   - Database connection strings
   - Redis connection (if used)
   - SSL certificates for HTTPS

---

## 📊 **OpenTelemetry Integration**

### Complete Upstream Integration

Cartrita features a **complete integration** of both OpenTelemetry JS repositories directly into the backend:

- **OpenTelemetry JS**: Full core API and SDK functionality
- **OpenTelemetry JS Contrib**: All instrumentation libraries and tools
- **Zero External Dependencies**: Everything integrated directly into Cartrita

### AI-Powered Telemetry Agent

The integrated **TelemetryAgent** provides natural language telemetry operations:

```javascript
// Natural language commands
"Check telemetry status"
"Create a trace for user login process"
"Analyze traces from the last hour"
"Create a counter named user_actions_total"
"Show system performance metrics"
```

### Automatic Instrumentation

- **Express.js**: Automatic HTTP request/response tracing
- **PostgreSQL**: Database query instrumentation
- **Redis**: Cache operation monitoring
- **WebSocket**: Real-time communication tracing
- **Agent Operations**: Multi-agent workflow instrumentation

### Custom Cartrita Features

- **MCP Communication Tracing**: Inter-agent message tracking
- **Multi-Modal Processing**: Cross-sensory operation monitoring
- **Voice Interaction Tracing**: Speech-to-text and TTS instrumentation
- **AI Model Usage**: OpenAI API call tracking and optimization

### Telemetry Manual & Documentation

Complete interactive documentation accessible via:
- Natural language: `"Show telemetry manual"`
- API endpoint: `GET /api/telemetry/manual`
- Agent commands: Over 50 example operations and best practices

---

## 📚 **API Documentation**

### Iteration 18: Vault APIs

```typescript
// Secure API Key Management
GET    /api/vault/providers           // List supported providers
GET    /api/vault/keys               // User's API keys (masked)
POST   /api/vault/keys               // Add/update API keys
DELETE /api/vault/keys/:keyId        // Delete API key
POST   /api/vault/keys/:keyId/test   // Test API key
GET    /api/vault/security-events    // Security audit logs
```

### Iteration 19: Personal Life OS APIs

```typescript
// Calendar Management
GET    /api/calendar/events          // Calendar events
POST   /api/calendar/sync            // Manual sync
POST   /api/calendar/events          // Create event

// Email Management
GET    /api/email/messages           // Email messages
POST   /api/email/send              // Send email
POST   /api/email/sync              // Manual sync

// Contact Management
GET    /api/contacts/list           // Contact list
POST   /api/contacts/sync           // Contact sync
GET    /api/contacts/:id            // Contact details
```

### Iteration 21: Multi-Modal APIs

```typescript
// Voice & Audio
POST / api / voice - chat / process; // Voice interaction
POST / api / voice - to - text / transcribe; // Speech transcription
GET / api / voice - chat / status; // Voice system status

// Visual Analysis
POST / api / vision / analyze; // Image/video analysis
POST / api / vision / describe; // Image description
POST / api / vision / ocr; // Text extraction
```

### Iteration 22: Advanced AI APIs

```typescript
// Multi-Modal Processing
POST / api / iteration22 / multimodal / process; // Multi-modal fusion
POST / api / iteration22 / orchestration / optimize; // Orchestration optimization
POST / api / iteration22 / learning / adapt; // Adaptive learning
GET / api / iteration22 / analytics / performance; // Performance analytics
POST / api / iteration22 / intelligence / predict; // Predictive insights
GET / api / iteration22 / status; // System status
```

### Agent Communication APIs

```typescript
// MCP System
GET / api / mcp / agent - hierarchy; // Agent system status
POST / api / mcp / supervisor / override; // Master override
GET / api / mcp / tool - registry; // Available tools
```

---

## 🚦 **Development Status**

### ✅ Completed Features

- **Iteration 18**: Secure API Vault with AES-256-GCM encryption
- **Iteration 19**: Personal Life OS with calendar/email/contact sync
- **Iteration 20**: Multi-agent framework with LangChain StateGraph
- **Iteration 21**: Voice, vision, and multi-modal capabilities
- **Iteration 22**: Advanced AI integration with adaptive learning

### 🔄 Current Development

- Performance optimization and caching
- Advanced learning model fine-tuning
- Real-time collaboration features
- Mobile app development

### 🚧 Planned Features (Iteration 23+)

- **Federated Learning**: Multi-instance knowledge sharing
- **Quantum-Classical Hybrid**: Advanced computation capabilities
- **Advanced Reasoning**: Sophisticated planning and decision-making
- **Ecosystem Integration**: Third-party AI service integration

### 📊 System Metrics

- **Database Tables**: 33 tables with comprehensive coverage
- **API Endpoints**: 40+ endpoints across all iterations
- **Agent Types**: 11+ specialized agents with unique capabilities
- **Tool Registry**: 40+ functional tools (no mocks)
- **Test Coverage**: Comprehensive test suites for all iterations

---

## 🛠️ **Troubleshooting**

### Common Issues

1. **Database Connection Errors**

   - Verify PostgreSQL is running and accessible
   - Check DATABASE_URL environment variable
   - Ensure pgvector extension is installed

2. **API Key Issues**

   - Verify all required API keys are configured
   - Check API key permissions and quotas
   - Test individual API key functionality via vault

3. **Voice/Audio Problems**

   - Ensure Deepgram API key is valid
   - Check microphone permissions
   - Verify audio format compatibility

4. **Agent Communication Issues**
   - Check MCP coordinator status
   - Verify agent initialization logs
   - Test individual agent health endpoints

### Performance Optimization

- Enable Redis caching for improved response times
- Optimize database queries with proper indexing
- Configure connection pooling for high load
- Monitor system resources and scale accordingly

### Support Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive API documentation
- **Test Suites**: Automated testing for all components
- **Monitoring**: Built-in health checks and metrics

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b iteration-XX-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -am 'Add iteration XX feature'`)
5. Push to branch (`git push origin iteration-XX-feature`)
6. Create Pull Request

---

**Built with ❤️ by the Cartrita Team**  
_"The sassy AI that gets shit done"_ 🔥
