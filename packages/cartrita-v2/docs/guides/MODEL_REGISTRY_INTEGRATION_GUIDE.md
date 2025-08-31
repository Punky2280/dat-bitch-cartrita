# Model Registry Integration Guide

**Purpose:** Step-by-step guide for using the integrated Model Registry system  
**Audience:** Developers, DevOps Engineers  
**Prerequisites:** Cartrita backend setup, PostgreSQL, Redis (optional)

## Quick Start

### 1. Database Setup

```bash
# Run model registry schema
PGPASSWORD=your_password psql -h localhost -U username -d cartrita \
    -f db-init/14_model_registry_schema.sql
```

### 2. Service Initialization

```javascript
import IntegratedAIService from './src/services/IntegratedAIService.js';

// Initialize the integrated service
const aiService = new IntegratedAIService();
await aiService.initialize();

// Check status
const status = aiService.getStatus();
console.log('AI Service Status:', status);
```

### 3. Seed Initial Models

```bash
# Populate registry with initial models
cd packages/backend
node scripts/seed-model-registry.mjs
```

## Core Usage Patterns

### Intelligent Model Selection

```javascript
// Basic model selection
const selection = await aiService.selectModel({
    task_type: 'text-generation',
    quality_weight: 0.4,
    cost_weight: 0.4,
    latency_weight: 0.2,
    safety_required: true,
    commercial_use: true
}, {
    user_id: 123,
    workflow_run_id: 'wf-456',
    stage: 'content_generation'
});

console.log('Selected Model:', selection.selected);
console.log('Selection Reason:', selection.reason);
console.log('Estimated Cost:', selection.estimated_cost_usd);
```

### Cost-Optimized Selection

```javascript
// Prioritize cost savings
const costOptimized = await aiService.selectModel({
    task_type: 'text-generation',
    quality_weight: 0.2,
    cost_weight: 0.7,
    latency_weight: 0.1,
    max_cost_per_1k_tokens: 0.005
}, context, 'cost-optimized');
```

### Quality-First Selection

```javascript
// Prioritize model quality
const qualityFirst = await aiService.selectModel({
    task_type: 'code-generation',
    quality_weight: 0.8,
    cost_weight: 0.1,
    latency_weight: 0.1,
    min_quality_score: 0.8
}, context, 'quality-first');
```

## Workflow Integration

### Enhanced AI Nodes

#### AI-GPT4 Node with Model Registry
```json
{
  "id": "ai-node-1",
  "type": "ai-gpt4",
  "data": {
    "prompt": "Generate a summary of {{input}}",
    "temperature": 0.7,
    "useModelRegistry": true,
    "taskType": "text-generation",
    "qualityWeight": 0.5,
    "costWeight": 0.3,
    "latencyWeight": 0.2,
    "maxCostPer1kTokens": 0.01,
    "maxLatencyMs": 5000
  }
}
```

#### RAG Question-Answering Node
```json
{
  "id": "rag-qa-1",
  "type": "rag-qa",
  "data": {
    "question": "What is {{input.question}}?",
    "searchLimit": 5,
    "searchThreshold": 0.7,
    "useModelRegistry": true,
    "model": "gpt-4o",
    "maxTokens": 1000,
    "includeReferences": true
  }
}
```

#### RAG Search Node
```json
{
  "id": "rag-search-1", 
  "type": "rag-search",
  "data": {
    "query": "{{input.search_query}}",
    "limit": 10,
    "threshold": 0.75,
    "documentIds": ["doc-1", "doc-2"]
  }
}
```

### Workflow Execution

```javascript
// Execute workflow with model registry
const result = await aiService.executeWorkflow(
    'workflow-123',  // workflow ID
    456,            // user ID  
    { 
        input_text: 'Content to process',
        search_query: 'What is machine learning?'
    },
    {
        triggerType: 'manual',
        priority: 'high'
    }
);

console.log('Workflow Result:', result);
console.log('Execution Time:', result.executionTime);
console.log('AI Costs:', result.logs.filter(l => l.event === 'MODEL_SELECTED'));
```

## Knowledge Hub Integration

### Document Processing with AI

```javascript
// Process document with AI-powered extraction
const docResult = await aiService.processDocument(
    userId,
    {
        originalname: 'research-paper.pdf',
        mimetype: 'application/pdf',
        size: 1024000
    },
    '/uploads/research-paper.pdf',
    {
        extract_structured: true,
        enable_ai_analysis: true
    }
);

console.log('Document ID:', docResult.documentId);
console.log('Processing Status:', docResult.status);
```

### Semantic Search

```javascript
// Intelligent semantic search
const searchResult = await aiService.semanticSearch(
    userId,
    'How does machine learning work?',
    {
        limit: 5,
        threshold: 0.8,
        includeChunks: true,
        includeDocuments: true
    }
);

console.log('Search Results:', searchResult.results);
console.log('Result Count:', searchResult.resultCount);
```

### RAG Response Generation

```javascript
// Generate AI response from knowledge base
const ragResponse = await aiService.generateRAGResponse(
    userId,
    'Explain the latest developments in AI',
    null, // Will search automatically
    {
        model: 'gpt-4o',
        maxTokens: 1500,
        includeReferences: true,
        searchLimit: 7,
        searchThreshold: 0.7
    }
);

console.log('AI Response:', ragResponse.response);
console.log('Sources:', ragResponse.references);
```

## Cost Management

### Budget Configuration

```javascript
// Set daily budget limits
const budgetConfig = {
    budget_name: 'daily_ai_budget',
    budget_type: 'daily',
    limit_usd: 50.00,
    alert_thresholds: {
        warning: 0.7,    // 70% = $35
        critical: 0.9,   // 90% = $45  
        hard_stop: 1.0   // 100% = $50
    }
};
```

### Cost Analytics

```javascript
// Get detailed cost breakdown
const costAnalytics = await aiService.getCostAnalytics(24); // Last 24 hours

console.log('Total Cost:', costAnalytics.model_costs.total_cost_usd);
console.log('Cost by Model:', costAnalytics.model_costs.cost_by_model);
console.log('Top Models:', costAnalytics.model_costs.top_models);
console.log('Workflow Stats:', costAnalytics.workflow_stats);
```

### Real-time Cost Tracking

```javascript
// Execute with cost awareness
const execution = await aiService.executeModelInference(
    'mistral-7b-instruct',
    'Summarize this text: {{content}}',
    {
        temperature: 0.7,
        user_id: userId,
        workflow_run_id: workflowId,
        safety_enabled: true
    }
);

console.log('Response:', execution.result);
console.log('Cost:', execution.cost_usd);
console.log('Latency:', execution.latency_ms);
console.log('Tokens Used:', execution.tokens_used);
```

## Safety & Moderation

### Content Safety Configuration

```javascript
// Configure safety pipeline
const safetyConfig = {
    pre_generation: {
        enabled: true,
        classifier_model: 'llama-guard-2',
        risk_threshold: 0.7,
        categories: ['hate', 'violence', 'sexual', 'harassment']
    },
    post_generation: {
        enabled: true, 
        safety_model: 'llama-guard-2',
        risk_threshold: 0.8,
        redaction_enabled: true
    },
    audit: {
        log_all_interactions: true,
        flag_high_risk: true
    }
};
```

### Safe Model Execution

```javascript
// Execute with safety checks
const safeExecution = await aiService.executeModelInference(
    'gpt-4o',
    userPrompt,
    {
        safety_enabled: true,
        user_id: userId,
        workflow_run_id: workflowId
    }
);

// Check safety results
if (safeExecution.safety_result && !safeExecution.safety_result.is_safe) {
    console.log('Content flagged:', safeExecution.safety_result.explanation);
}
```

## Performance Optimization

### Model Selection Strategies

```javascript
// Speed-optimized for real-time applications
const speedFirst = {
    task_type: 'classification',
    quality_weight: 0.2,
    cost_weight: 0.3,
    latency_weight: 0.5,
    max_latency_ms: 500
};

// Balanced for general use
const balanced = {
    task_type: 'text-generation',
    quality_weight: 0.4,
    cost_weight: 0.4,
    latency_weight: 0.2
};

// Quality-first for critical tasks
const qualityFirst = {
    task_type: 'code-generation',
    quality_weight: 0.8,
    cost_weight: 0.1,
    latency_weight: 0.1,
    min_quality_score: 0.85
};
```

### Caching Strategies

```javascript
// Use Redis caching for repeated queries
const cachedSearch = await aiService.semanticSearch(
    userId,
    query,
    {
        limit: 5,
        useCache: true,
        cacheTimeout: 3600 // 1 hour
    }
);
```

## Monitoring & Debugging

### Service Health Check

```javascript
// Comprehensive status check
const healthCheck = aiService.getStatus();

console.log('Service Health:', healthCheck);
console.log('Components:', healthCheck.components);
console.log('Capabilities:', healthCheck.capabilities);

// Component-specific checks
if (healthCheck.components.model_registry.available) {
    console.log('✅ Model Registry: Available');
} else {
    console.log('❌ Model Registry: Unavailable');
}
```

### Error Handling

```javascript
try {
    const result = await aiService.selectModel(criteria);
} catch (error) {
    if (error.message.includes('not initialized')) {
        console.log('Service needs initialization');
        await aiService.initialize();
    } else if (error.message.includes('budget exceeded')) {
        console.log('Daily budget limit reached');
        // Handle budget constraint
    } else {
        console.error('Unexpected error:', error);
    }
}
```

### Logging Integration

```javascript
// Enable detailed logging
process.env.WORKFLOW_DEBUG = '1';
process.env.DEBUG_LOGS = '1';

// Workflow logs will show:
// - Model selection decisions
// - Cost calculations  
// - Performance metrics
// - Safety check results
```

## Advanced Usage

### Custom Model Registration

```javascript
// Register new model
const customModel = {
    model_id: 'custom-llm-v1',
    provider: 'huggingface',
    task_types: ['text-generation'],
    quality_metrics: { custom_score: 8.5 },
    cost_profile: {
        endpoint_type: 'dedicated',
        estimated_hourly_usd: 2.5,
        estimated_tokens_per_hour: 500000
    },
    routing_tags: ['custom', 'experimental'],
    status: 'testing'
};

const registrationResult = await aiService.modelRegistry.registerModel(customModel);
```

### Batch Processing

```javascript
// Process multiple requests efficiently
const batchRequests = [
    { task_type: 'text-generation', prompt: 'Summarize A' },
    { task_type: 'text-generation', prompt: 'Summarize B' },
    { task_type: 'text-generation', prompt: 'Summarize C' }
];

const batchResults = await Promise.all(
    batchRequests.map(req => 
        aiService.executeModelInference(
            'mistral-7b-instruct', 
            req.prompt,
            { batch_id: 'batch-001' }
        )
    )
);
```

## Troubleshooting

### Common Issues

1. **Service not initialized**
   ```javascript
   Error: IntegratedAIService not initialized
   Solution: Call await aiService.initialize() first
   ```

2. **Model Registry unavailable**
   ```javascript
   Warning: Model Registry initialization failed
   Solution: Check database connection and API keys
   ```

3. **Budget exceeded** 
   ```javascript
   Error: Daily budget exceeded - escalate or degrade
   Solution: Increase budget or use cost-optimized models
   ```

4. **No suitable models found**
   ```javascript
   Error: No models match selection criteria
   Solution: Relax constraints or add more models to registry
   ```

### Performance Issues

- **Slow model selection:** Check database indexes
- **High costs:** Review model selection weights
- **Memory usage:** Monitor Knowledge Hub processing
- **API rate limits:** Implement request throttling

## Best Practices

### Model Selection
- Use appropriate weights for your use case
- Set reasonable cost and latency constraints
- Enable safety checks for user-facing content
- Monitor selection patterns and adjust

### Cost Management  
- Set conservative budgets initially
- Monitor cost trends regularly
- Use cost-optimized strategies for batch processing
- Implement alerts for budget thresholds

### Performance
- Cache frequently used search results
- Use lighter models for simple tasks
- Batch similar requests when possible
- Monitor and optimize database queries

### Security
- Always enable safety pipeline for user content
- Audit high-risk interactions
- Implement proper access controls
- Monitor for unusual usage patterns

---

**Next Steps:**
1. Set up database schema
2. Configure environment variables
3. Initialize services in your application
4. Start with basic model selection
5. Gradually add advanced features

**Support:** See architecture documentation and project manuals for detailed technical information.