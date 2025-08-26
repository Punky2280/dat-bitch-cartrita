# Cartrita Model Registry System

A production-ready model registry and routing system implementing the specifications from the Cartrita Hierarchical MCP Transformation Whitepaper.

## Overview

The Model Registry System provides comprehensive model management, intelligent routing, cost optimization, performance benchmarking, and safety enforcement for AI model inference workloads.

## Architecture

```
ModelRegistryService (Main Orchestrator)
├── ModelRouter (Intelligent Selection)
├── CostEstimator (Cost Calculation & Budgeting)
├── BenchmarkHarness (Performance Measurement)
├── SafetyPipeline (Content Moderation)
└── EventEmitter (Telemetry & Monitoring)
```

## Key Features

### 🎯 Intelligent Model Routing

- **Composite Scoring**: Weighted combination of quality, cost, latency, safety, and availability
- **Multiple Strategies**: Quality-first, cost-optimized, balanced, speed-first, safety-critical
- **Load Balancing**: Automatic distribution based on current model load
- **Fallback Support**: Graceful degradation when primary models unavailable

### 💰 Cost Management

- **Multi-Pricing Models**: Hardware-based, token-based, and hybrid pricing
- **Real-time Estimation**: Live cost calculation with confidence intervals
- **Budget Enforcement**: Configurable thresholds with automatic degradation
- **Optimization Suggestions**: AI-driven recommendations for cost reduction

### 📊 Performance Benchmarking

- **Comprehensive Metrics**: Tokens/sec, P95 latency, memory footprint, GPU utilization
- **Quality Evaluation**: MMLU, MT-Bench, custom benchmark integration
- **Hardware Profiling**: Multi-GPU configuration testing
- **Automated Scheduling**: Continuous monitoring and re-evaluation

### 🛡️ Safety Pipeline

- **Pre/Post Generation**: Dual-phase content moderation
- **Multiple Models**: Llama Guard 2, Shield Gemma, custom classifiers
- **Content Redaction**: Automatic unsafe content removal
- **Audit Trail**: Comprehensive logging for compliance

### 📈 Event Tracking & Monitoring

- **Real-time Events**: model_call.planned/started/completed/failed, budget.threshold_crossed
- **Comprehensive Metrics**: Cost, latency, tokens, safety violations
- **Buffered Storage**: High-performance event batching with Redis caching
- **Alert Integration**: Configurable thresholds with notification support

## Installation

```bash
# Install dependencies
npm install ajv ajv-formats

# Run database migration
psql -d cartrita -f db-init/14_model_registry_schema.sql
```

## Quick Start

```typescript
import { ModelRegistryService } from './modelRouting';

// Initialize service
const config = {
  database: { client: postgresClient, schema: 'public' },
  redis: { client: redisClient, keyPrefix: 'model_registry:' },
  safety: {
    pre_generation: {
      enabled: true,
      classifier_model: 'llama-guard-2',
      risk_threshold: 0.7,
    },
    post_generation: {
      enabled: true,
      safety_model: 'shield-gemma',
      risk_threshold: 0.8,
    },
    audit: { log_all_interactions: true, flag_high_risk: true },
  },
  benchmarking: { enabled: true },
  monitoring: { logger: console },
};

const registry = new ModelRegistryService(config, huggingFaceService);
await registry.initialize();

// Select optimal model
const result = await registry.selectModel({
  task_type: 'text-generation',
  quality_weight: 0.4,
  cost_weight: 0.4,
  latency_weight: 0.2,
  safety_required: true,
  commercial_use: true,
});

console.log('Selected model:', result.selected);
console.log('Estimated cost:', result.estimated_cost_usd);
```

## Database Schema

The system uses PostgreSQL with vector extensions:

- **models**: Model registry with capabilities, costs, and metadata
- **model_metrics**: Historical performance data
- **cost_events**: Detailed cost tracking with full context
- **model_daily_costs**: Materialized view for fast aggregation
- **budget_tracking**: Budget management and alerting
- **model_benchmarks**: Quality and performance benchmark results

## Core Components

### ModelRegistryService

Main orchestrator providing unified API for all model registry operations.

### ModelRouter

Intelligent model selection with composite scoring and multiple routing strategies.

### CostEstimator

Real-time cost calculation supporting multiple pricing models and budget enforcement.

### BenchmarkHarness

Automated performance testing with comprehensive metrics collection.

### SafetyPipeline

Dual-phase content moderation with configurable safety models.

### EventEmitter

High-performance event tracking with buffering and persistence.

## Integration

The Model Registry integrates seamlessly with the existing Cartrita MCP architecture, providing enhanced model management capabilities while maintaining backward compatibility with existing HuggingFace routing services.

For detailed API documentation and examples, see the individual component source files.
