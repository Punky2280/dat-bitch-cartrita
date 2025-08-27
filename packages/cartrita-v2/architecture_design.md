# Cartrita V2 - OpenAI Hierarchical Agent Architecture Design

## Overview

This document outlines the new hierarchical agent architecture for Cartrita V2, migrating from LangChain to pure OpenAI Responses API with dynamic multi-agent orchestration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER REQUEST                         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                ORCHESTRATOR AGENT                      │
│  - Request Classification & Intent Detection            │
│  - Task Decomposition & Planning                        │
│  - Dynamic Model Routing (gpt-5-nano/mini/5)          │
│  - Tool Gating & Permission Management                  │
│  - Safety & Moderation Gateway                         │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
┌─────────▼─────┐ ┌───▼────┐ ┌────▼──────┐
│   RETRIEVAL   │ │  CODE  │ │  DATAVIZ  │
│   SPECIALIST  │ │SPECIALIST│ │SPECIALIST │
│               │ │          │ │           │
│ - File Search │ │ - Code   │ │ - Data    │
│ - Vector DB   │ │   Interp.│ │   Analysis│
│ - Web Search  │ │ - Debug  │ │ - Charts  │
│ - Synthesis   │ │ - Refact.│ │ - Insights│
└───────────────┘ └──────────┘ └───────────┘

┌─────────────┐ ┌────────────┐ ┌─────────────┐
│   IMAGE &   │ │   UI/DSL   │ │ AUTOMATION  │
│   VISION    │ │ GENERATOR  │ │  & COMP.    │
│ SPECIALIST  │ │ SPECIALIST │ │USE SPECIAL. │
│             │ │            │ │             │
│ - Generation│ │ - Struct.  │ │ - Screen    │
│ - Analysis  │ │   Output   │ │   Control   │
│ - Iteration │ │ - UI Forms │ │ - Browser   │
│ - Style Ref │ │ - DSL/JSON │ │ - Desktop   │
└─────────────┘ └────────────┘ └─────────────┘

┌─────────────┐ ┌────────────┐ ┌─────────────┐
│ WEB RESEARCH│ │ MODERATION │ │    VOICE    │
│ SPECIALIST  │ │ & SAFETY   │ │ & REALTIME  │
│             │ │ SPECIALIST │ │ SPECIALIST  │
│ - Fresh Info│ │            │ │             │
│ - Fact Check│ │ - Content  │ │ - Speech to │
│ - Synthesis │ │   Filter   │ │   Speech    │
│ - Citations │ │ - PII Det. │ │ - Handoffs  │
└─────────────┘ └────────────┘ └─────────────┘
```

## Core Components

### 1. Orchestrator Agent
**Primary Role**: Central coordination and routing hub
- **Model**: gpt-5-mini (default) → gpt-5 (complex planning)
- **Responsibilities**:
  - Classify incoming requests into task intents
  - Decompose multi-step tasks into atomic operations
  - Route to appropriate specialist agents
  - Manage conversation state and memory
  - Apply safety and governance policies
  - Cost optimization through model selection

### 2. Specialist Agent Pool

#### Retrieval & Knowledge Specialist
- **Models**: gpt-5-mini → gpt-5 (complex synthesis)
- **Tools**: file_search, web_search_preview, vector_stores
- **Purpose**: Information gathering, fact-checking, source synthesis
- **Output**: Structured knowledge with citations

#### Code & Refactor Specialist  
- **Models**: gpt-5-mini → gpt-5 (algorithmic complexity)
- **Tools**: code_interpreter, custom_functions
- **Purpose**: Code generation, debugging, refactoring, testing
- **Output**: Code artifacts with test results

#### DataViz & Analytics Specialist
- **Models**: gpt-5-mini (standard) → gpt-5 (complex datasets)
- **Tools**: code_interpreter, file operations
- **Purpose**: Data analysis, visualization, statistical insights
- **Output**: Charts, analysis reports with file citations

#### Image & Vision Specialist
- **Models**: gpt-5-mini (generation) → gpt-5 (complex composition)
- **Tools**: image_generation, vision analysis
- **Purpose**: Image creation, analysis, iteration
- **Output**: Generated images with metadata

#### UI/DSL Generation Specialist
- **Models**: gpt-5-mini (structured output optimized)
- **Tools**: None (pure structured output)
- **Purpose**: Form generation, UI components, structured data
- **Output**: Valid JSON conforming to strict schemas

#### Automation & Computer Use Specialist
- **Models**: gpt-5-mini → gpt-5 (multi-step workflows)
- **Tools**: computer_use_preview (sandboxed)
- **Purpose**: UI automation, browser control, desktop tasks
- **Output**: Action sequences with safety confirmations

#### Web Research Specialist
- **Models**: gpt-5-mini (synthesis) → gpt-5 (complex fact-checking)
- **Tools**: web_search_preview, MCP connectors
- **Purpose**: Current events, trend analysis, fact verification
- **Output**: Synthesized findings with source validation

#### Moderation & Safety Specialist
- **Models**: gpt-5-nano (classification speed)
- **Tools**: moderation API, content filters
- **Purpose**: Content safety, PII detection, policy enforcement
- **Output**: Safety classifications with remediation suggestions

#### Voice & Realtime Specialist
- **Models**: gpt-4o-realtime-preview
- **Tools**: Realtime API, handoff functions
- **Purpose**: Conversational voice interaction, real-time responses
- **Output**: Speech synthesis with orchestrator handoffs

## Dynamic Model Routing Strategy

### Model Tier Selection
```python
# Fast/Classification: gpt-5-nano
if task.type in ['moderation', 'simple_routing', 'quick_classification']:
    model = 'gpt-5-nano'
    reasoning_effort = 'minimal'

# Standard Operations: gpt-5-mini  
elif task.complexity == 'low' and task.steps <= 3:
    model = 'gpt-5-mini'
    reasoning_effort = 'low'

# Complex Reasoning: gpt-5
elif task.complexity == 'high' or task.failures >= 2:
    model = 'gpt-5'
    reasoning_effort = 'medium' → 'high'
```

### Escalation Triggers
- **Failure Count**: 2+ failed attempts → upgrade model tier
- **Task Complexity**: Multi-domain, >4 steps → gpt-5
- **User Preference**: Explicit request for "detailed analysis"
- **Cost Threshold**: Budget allows for premium reasoning
- **Time Sensitivity**: Latency vs. quality trade-offs

## Tool Gating & Security

### Permission Matrix
```yaml
orchestrator:
  allowed_tools: []  # No direct tool execution
  
retrieval:
  default: [file_search]
  conditional: [web_search_preview]
  
code:
  default: [code_interpreter]
  conditional: [file_search]
  
automation:
  default: [computer_use_preview]
  safety_required: user_confirmation
```

### Safety Layers
1. **Pre-processing**: Input sanitization, prompt injection detection
2. **Tool Execution**: Sandboxing, permission validation
3. **Output Filtering**: PII redaction, content moderation
4. **Audit Logging**: Full request/response chain tracking

## Memory & State Management

### Conversation Persistence
- **Short-term**: `previous_response_id` chaining (OpenAI native)
- **Long-term**: Vector store embeddings for context retrieval
- **Structured Memory**: JSON objects for task state, constraints, decisions

### Context Compression
- **Token Budget**: Dynamic context window management
- **Importance Scoring**: Relevance, recency, constraint priority
- **Abstractive Summarization**: Key facts, open questions, decisions

## Structured Output Schemas

### Orchestrator Plan State
```json
{
  "overall_goal": "string",
  "intents": ["retrieval", "code", "dataviz"],
  "plan_steps": [
    {
      "id": "s1",
      "intent": "retrieval", 
      "description": "Gather product specifications",
      "success_criteria": "Find 3+ authoritative sources",
      "status": "pending"
    }
  ],
  "next_step_allowed_tools": ["file_search"],
  "recommended_model": "gpt-5-mini",
  "reasoning_effort": "low",
  "escalation_needed": false
}
```

### Specialist Output Format
Each specialist returns structured JSON with:
- Task completion status
- Generated artifacts (code, charts, images)
- Source citations and confidence levels
- Recommendations for follow-up actions
- Error handling and retry guidance

## Performance Optimization

### Cost Control
- **Model Routing**: 70% gpt-5-nano/mini, 30% gpt-5 for complex tasks
- **Prompt Caching**: System prompts and large context segments
- **Tool Gating**: Minimal necessary tool access per specialist
- **Early Return**: High-confidence answers skip escalation

### Latency Optimization  
- **Parallel Execution**: Independent specialist tasks run concurrently
- **Streaming**: Real-time response updates for long-running tasks
- **Container Reuse**: Code interpreter warm starts
- **Vector Cache**: Pre-computed embeddings for common queries

## Observability & Metrics

### Key Performance Indicators
- **Response Time**: p50, p95, p99 per use case
- **Tool Success Rate**: Function call accuracy and completion
- **Cost Efficiency**: $/task across model tiers
- **User Satisfaction**: Task completion and quality ratings
- **Error Rates**: Failed requests, retry counts, escalations

### Monitoring Dashboard
- Real-time agent status and load distribution
- Model usage patterns and cost trends
- Tool execution success/failure rates
- Conversation flow and handoff metrics
- Security events and policy violations

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- Orchestrator agent with basic routing
- Model selection and cost optimization
- Structured output validation

### Phase 2: Essential Specialists (Weeks 3-4)
- Retrieval, Code, and Moderation specialists
- Tool migration from LangChain to OpenAI functions
- Basic safety and governance layers

### Phase 3: Advanced Capabilities (Weeks 5-6)
- DataViz, Image, UI/DSL, Automation specialists  
- Voice/Realtime integration
- Advanced context compression

### Phase 4: Production Hardening (Weeks 7-8)
- Human-in-the-loop override system
- Comprehensive observability
- Performance optimization and scaling

This architecture provides a robust, scalable foundation for Cartrita V2 while maintaining backward compatibility during the migration period.