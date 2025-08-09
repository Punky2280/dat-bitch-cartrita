# OpenTelemetry Implementation Guide

## Overview

Cartrita now includes comprehensive observability with OpenTelemetry, providing:

- **Distributed Tracing**: Track requests across all agents and services
- **Custom Metrics**: Business metrics for user requests, response times, etc.
- **Automatic Instrumentation**: HTTP, Express, PostgreSQL, Redis automatically traced
- **Span Events**: Detailed operation tracking with structured events
- **Child Spans**: Sub-operation tracing for complex workflows

## Quick Start

### 1. Using the Class Directly (Current Implementation)

```javascript
import OpenTelemetryTracing from './src/system/OpenTelemetryTracing.js';

// Initialize (done automatically in index.js)
await OpenTelemetryTracing.initialize();

// Trace an agent operation
const result = await OpenTelemetryTracing.traceAgentOperation(
  'researcher',
  'search-operation',
  { 'user.id': userId, query: query },
  async span => {
    // Your operation code here
    span.setAttributes({ 'operation.success': true });
    return { data: 'result' };
  }
);
```

### 2. Using External Instrumentation (Recommended for Production)

```bash
# Run with automatic instrumentation
node --require ./instrumentation.js index.js
```

## Features Demonstrated

### ✅ Agent Operation Tracing

- Supervisor agent responses with full context
- Sub-agent delegations
- Tool executions
- User interactions

### ✅ Custom Business Metrics

```javascript
const userRequestCounter = OpenTelemetryTracing.createCounter(
  'cartrita.user.requests',
  'Total number of user requests'
);

const responseTimeHistogram = OpenTelemetryTracing.createHistogram(
  'cartrita.response.duration',
  'Response time distribution',
  'ms'
);
```

### ✅ Span Events & Child Spans

```javascript
// Add events to spans
OpenTelemetryTracing.addEvent('research_started', {
  'research.phase': 'initialization',
});

// Create child spans for sub-operations
const searchSpan = OpenTelemetryTracing.startChildSpan('web_search', {
  attributes: { 'search.engine': 'duckduckgo' },
});
```

### ✅ Rich Context & Attributes

Every trace includes:

- User ID and context
- Operation type and parameters
- Response times and success rates
- Tool usage and results
- Error context when failures occur

## Configuration

### Environment Variables

```bash
# Service identification
OTEL_SERVICE_NAME=cartrita-advanced-2025-mcp
OTEL_SERVICE_VERSION=2025-06-18

# OTLP Endpoint for external backends (Jaeger, Zipkin, etc.)
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:14268
OTEL_EXPORTER_OTLP_HEADERS='{"Authorization": "Bearer token"}'

# Logging level
OTEL_LOG_LEVEL=INFO

# Metric export interval (milliseconds)
OTEL_METRIC_EXPORT_INTERVAL=30000
```

### Supported Exporters

#### Console (Default)

- Traces: Printed to console in structured format
- Metrics: Periodic console output

#### OTLP HTTP (Production)

- Traces: Sent to `{ENDPOINT}/v1/traces`
- Metrics: Sent to `{ENDPOINT}/v1/metrics`
- Compatible with Jaeger, Zipkin, Prometheus, etc.

## Example Trace Output

```json
{
  "name": "agent.researcher.comprehensive-research",
  "traceId": "ffa63b73ce7517ea071f6e6dc490f01b",
  "attributes": {
    "agent.name": "researcher",
    "agent.operation": "comprehensive-research",
    "agent.type": "knowledge",
    "user.id": "test-user-456",
    "research.topic": "machine learning",
    "response.time_ms": 228
  },
  "events": [
    {
      "name": "research_started",
      "attributes": {
        "research.phase": "initialization",
        "research.sources_count": 5
      }
    }
  ],
  "childSpans": [
    {
      "name": "web_search",
      "attributes": {
        "search.engine": "duckduckgo",
        "search.results_count": 25
      }
    }
  ]
}
```

## Key Benefits

### 🔍 **Observability**

- Full request tracing from user input to agent response
- Performance monitoring across all components
- Error tracking with complete context

### 📊 **Business Intelligence**

- User interaction patterns
- Agent performance metrics
- Tool usage statistics
- Response time distributions

### 🛠️ **Debugging & Optimization**

- Identify bottlenecks in agent workflows
- Track tool execution performance
- Monitor resource usage
- Trace complex multi-agent interactions

### 🚀 **Production Ready**

- Zero-impact when disabled
- Configurable sampling rates
- Multiple export backends
- Automatic instrumentation of popular libraries

## Advanced Usage

### Custom Metrics

```javascript
// Counter for business events
const counter = OpenTelemetryTracing.createCounter(
  'cartrita.custom.events',
  'Description of events'
);
counter.add(1, { 'event.type': 'user_signup' });

// Histogram for measurements
const histogram = OpenTelemetryTracing.createHistogram(
  'cartrita.processing.time',
  'Processing time distribution',
  'ms'
);
histogram.record(150, { operation: 'vector_search' });
```

### Complex Workflows

```javascript
await OpenTelemetryTracing.traceAgentOperation(
  'workflow-engine',
  'execute-workflow',
  { 'workflow.id': workflowId },
  async span => {
    // Step 1: Input validation
    OpenTelemetryTracing.addEvent('input_validation', {
      'validation.rules_count': 5,
    });

    // Step 2: Process with child span
    const processSpan = OpenTelemetryTracing.startChildSpan('data_processing');
    await processData();
    processSpan.end();

    // Step 3: Final result
    span.setAttributes({
      'workflow.success': true,
      'workflow.steps_completed': 3,
    });
  }
);
```

## Integration Points

The OpenTelemetry system is integrated at these key points in Cartrita:

1. **index.js**: Initialization during server startup
2. **EnhancedLangChainCoreAgent**: Supervisor agent response tracing
3. **Socket.IO handlers**: User interaction tracing
4. **Tool executions**: Automatic tool performance monitoring
5. **Agent operations**: All agent activities are traced

## Troubleshooting

### Enable Debug Logging

```javascript
await OpenTelemetryTracing.initialize({
  logLevel: DiagLogLevel.DEBUG,
});
```

### Check Status

```javascript
const status = OpenTelemetryTracing.getStatus();
console.log(status);
```

### Common Issues

- **Missing traces**: Check if `initialize()` was called
- **No metrics**: Verify meter creation and metric calls
- **OTLP errors**: Validate endpoint URL and headers
- **High overhead**: Adjust sampling rates or disable in development

## Next Steps

1. **Production Deployment**: Set up external OTLP endpoint (Jaeger/Zipkin)
2. **Alerting**: Create alerts based on error rates and response times
3. **Dashboards**: Build observability dashboards for key metrics
4. **Sampling**: Implement intelligent sampling for high-volume scenarios
5. **Custom Metrics**: Add more business-specific counters and histograms

This implementation provides a solid foundation for observability that can scale with your system's growth.
