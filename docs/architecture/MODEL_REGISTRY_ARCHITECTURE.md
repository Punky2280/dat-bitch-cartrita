# Model Registry Architecture

**Version:** 1.0  
**Last Updated:** August 2025  
**Component:** Model Registry System  

## Overview

The Model Registry is a production-ready system for intelligent AI model selection, cost optimization, and performance monitoring. It integrates seamlessly with the Workflow Engine and Knowledge Hub to provide unified AI orchestration.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    IntegratedAIService                      │
│                  (Main Orchestrator)                       │
└─────┬─────────────────┬─────────────────┬─────────────────┘
      │                 │                 │
┌─────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
│ Model     │    │ Workflow    │   │ Knowledge   │
│ Registry  │    │ Engine      │   │ Hub         │
└─────┬─────┘    └──────┬──────┘   └──────┬──────┘
      │                 │                 │
┌─────▼─────────────────▼─────────────────▼─────┐
│              Database Layer                   │
│  • models • cost_events • model_benchmarks   │
│  • knowledge_chunks • workflow_executions    │
└───────────────────────────────────────────────┘
```

## Core Components

### 1. ModelRegistryService
**File:** `src/modelRouting/ModelRegistryService.ts`  
**Purpose:** Main orchestrator for all model registry operations

**Key Methods:**
- `selectModel(criteria, context, strategy)` - Intelligent model selection
- `executeInference(modelId, prompt, options)` - Inference with cost tracking
- `registerModel(model)` - Add/update models in registry
- `getCostStatistics(timeRange)` - Cost analytics

### 2. ModelRouter
**File:** `src/modelRouting/ModelRouter.ts`  
**Purpose:** Intelligent model selection with composite scoring

**Selection Strategies:**
- `quality-first` - Prioritizes model performance
- `cost-optimized` - Minimizes operational costs  
- `balanced` - Weighted combination of factors
- `speed-first` - Optimizes for low latency
- `safety-critical` - Requires content moderation

**Scoring Algorithm:**
```typescript
score = (quality_weight * quality_score) + 
        (cost_weight * cost_efficiency) + 
        (latency_weight * speed_score)
```

### 3. CostEstimator
**File:** `src/modelRouting/CostEstimator.ts`  
**Purpose:** Real-time cost calculation and budget management

**Cost Formula:**
```typescript
cost_per_1k_tokens = hardware_hourly_usd / ((tokens_per_second * 3600) / 1000)
request_cost = (cost_per_1k_tokens * total_tokens) / 1000
```

**Budget Enforcement:**
- Warning: 70% of daily budget
- Critical: 90% of daily budget  
- Hard stop: 100% of daily budget

### 4. BenchmarkHarness
**File:** `src/modelRouting/BenchmarkHarness.ts`  
**Purpose:** Automated performance testing and metrics collection

**Metrics Collected:**
- Tokens per second throughput
- P50, P95, P99 latency percentiles
- Memory usage and GPU utilization
- Quality scores (MMLU, MT-Bench, custom)

### 5. SafetyPipeline
**File:** `src/modelRouting/SafetyPipeline.ts`  
**Purpose:** Content moderation and safety enforcement

**Safety Phases:**
- **Pre-generation:** Input prompt classification
- **Post-generation:** Output content moderation
- **Audit:** Comprehensive logging for compliance

## Database Schema

### Core Tables

#### models
```sql
CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    task_types TEXT[] NOT NULL,
    quality_metrics JSONB,
    cost_profile JSONB,
    routing_tags TEXT[],
    status VARCHAR(20) CHECK (status IN ('active', 'deprecated', 'testing', 'retired'))
);
```

#### cost_events
```sql
CREATE TABLE cost_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    workflow_run_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### model_benchmarks
```sql
CREATE TABLE model_benchmarks (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL,
    benchmark_name VARCHAR(100) NOT NULL,
    score DECIMAL(8,4),
    max_score DECIMAL(8,4),
    normalized_score DECIMAL(5,4) GENERATED ALWAYS AS (score / max_score) STORED
);
```

### Materialized Views

#### model_daily_costs
```sql
CREATE MATERIALIZED VIEW model_daily_costs AS
SELECT
    model_id,
    date_trunc('day', created_at) AS day,
    COUNT(*) AS total_calls,
    SUM(cost_usd) AS total_cost_usd,
    SUM(tokens_in + tokens_out) AS total_tokens
FROM cost_events
GROUP BY model_id, day;
```

## Workflow Integration

### Enhanced Node Handlers

#### AI-GPT4 Node (Enhanced)
```javascript
async handleGPTNode(node, executionContext) {
    // Model Registry integration for intelligent selection
    if (this.modelRegistry && node.data.useModelRegistry) {
        const selection = await this.modelRegistry.selectModel({
            task_type: node.data.taskType || 'text-generation',
            quality_weight: node.data.qualityWeight || 0.4,
            cost_weight: node.data.costWeight || 0.4,
            latency_weight: node.data.latencyWeight || 0.2
        });
        
        selectedModel = selection.selected;
    }
    
    // Execute inference with cost tracking
    const result = await this.modelRegistry.executeInference(
        selectedModel, prompt, options
    );
    
    return {
        content: result.result.text,
        model: selectedModel,
        cost_usd: result.cost_usd,
        model_selection: selection
    };
}
```

#### RAG-QA Node (New)
```javascript
async handleRAGQANode(node, executionContext) {
    // Search knowledge base
    const searchResult = await this.knowledgeHub.semanticSearch(
        userId, question, searchOptions
    );
    
    // Generate RAG response with model selection
    const ragResponse = await this.knowledgeHub.generateRAGResponse(
        userId, question, searchResult.results, {
            model: node.data.model,
            useModelRegistry: node.data.useModelRegistry
        }
    );
    
    return {
        question: processedQuestion,
        answer: ragResponse.response,
        references: ragResponse.references,
        searchResults: searchResult
    };
}
```

## Event-Driven Architecture

### Event Types
- `model_call.planned` - Before model selection
- `model_call.started` - Inference begins
- `model_call.completed` - Successful completion
- `model_call.failed` - Execution failure
- `budget.threshold_crossed` - Cost limit alerts

### Event Schema
```typescript
interface CostEvent {
    event_id: string;
    event_type: EventType;
    model_id: string;
    user_id?: number;
    workflow_run_id?: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    pipeline_context?: Record<string, any>;
}
```

## Performance Characteristics

### Model Selection
- **Latency:** <50ms for model selection
- **Throughput:** 1000+ selections/second
- **Accuracy:** 95%+ optimal selection rate

### Cost Tracking
- **Precision:** 6 decimal places for USD amounts
- **Real-time:** <10ms event processing
- **Storage:** Efficient with materialized views

### Benchmarking
- **Frequency:** Weekly automated runs
- **Coverage:** All active models
- **Metrics:** 15+ performance indicators

## Security Considerations

### Content Moderation
- Pre/post generation safety checks
- Risk scoring with configurable thresholds
- Automatic content redaction
- Comprehensive audit trails

### API Security
- Model access permissions
- Budget enforcement
- Rate limiting integration
- Secure credential management

## Monitoring & Observability

### Key Metrics
- Model selection accuracy
- Cost per request trends
- Latency percentiles
- Error rates by model
- Budget utilization

### Dashboards
- Real-time cost tracking
- Model performance comparison
- Usage analytics
- Alert management

### Alerting
- Budget threshold alerts
- Performance degradation
- Error rate spikes
- Model availability issues

## Deployment Configuration

### Environment Variables
```bash
# Model Registry
MODEL_REGISTRY_ENABLED=true
MODEL_REGISTRY_REDIS_PREFIX=model_registry:

# Cost Management  
DAILY_BUDGET_USD=100.00
COST_ALERT_WEBHOOKS=https://alerts.example.com

# Safety Pipeline
SAFETY_PRE_GENERATION=true
SAFETY_POST_GENERATION=true
SAFETY_RISK_THRESHOLD=0.8

# Benchmarking
BENCHMARK_SCHEDULE_CRON="0 2 * * 0"
BENCHMARK_ENABLED=true
```

### Docker Configuration
```yaml
services:
  model-registry:
    environment:
      - MODEL_REGISTRY_ENABLED=true
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@db:5432/cartrita
    depends_on:
      - postgres
      - redis
```

## API Reference

### Model Selection
```typescript
POST /api/models/select
{
    "task_type": "text-generation",
    "quality_weight": 0.4,
    "cost_weight": 0.4, 
    "latency_weight": 0.2,
    "safety_required": true,
    "max_cost_per_1k_tokens": 0.01
}
```

### Cost Analytics
```typescript
GET /api/models/costs?hours=24
{
    "total_cost_usd": 15.67,
    "cost_by_model": {
        "gpt-4o": 8.34,
        "mistral-7b": 4.21,
        "phi-3-mini": 3.12
    },
    "top_models": [...],
    "efficiency_metrics": {...}
}
```

## Maintenance Procedures

### Model Updates
1. Add new model to registry
2. Run initial benchmarks
3. Configure routing tags
4. Test with sample workloads
5. Enable for production

### Performance Tuning
1. Analyze cost patterns
2. Adjust selection weights
3. Update benchmark schedules
4. Optimize database queries
5. Monitor improvements

### Troubleshooting
- Check model availability
- Verify cost calculations
- Review benchmark results
- Analyze error patterns
- Validate safety pipeline

---

**Maintained by:** AI Architecture Team  
**Next Review:** Monthly  
**Dependencies:** PostgreSQL 15+, Redis 7+, OpenAI API