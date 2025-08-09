# Cartrita Telemetry User Manual

## 🔍 **What is OpenTelemetry in Cartrita?**

Cartrita has fully integrated the complete OpenTelemetry ecosystem - both the core JavaScript libraries and all contrib instrumentations - directly into the backend system. This means you have enterprise-grade observability without any external dependencies.

## 🤖 **AI-Powered Telemetry Agent**

The **TelemetryAgent** understands natural language commands and can perform complex observability operations on your behalf.

### Quick Start Commands

```bash
# System Status
"Check telemetry status"
"Show system health"
"What's the current performance?"

# Create Traces
"Create a trace for user login"
"Trace the email sending process"
"Demo a complex workflow trace"

# Metrics Operations
"Create a counter for user actions"
"Create a histogram for response times"
"Record metric user_satisfaction with value 9"
"Show all current metrics"

# Analysis & Insights
"Analyze traces from the last hour"
"Generate telemetry report"
"Show performance trends"
"What errors occurred recently?"
```

## 📊 **Understanding Cartrita's Telemetry**

### What Gets Automatically Traced

1. **HTTP Requests**: Every API call to your Cartrita backend
2. **Database Operations**: All PostgreSQL queries and transactions
3. **Cache Operations**: Redis read/write operations
4. **WebSocket Communications**: Real-time chat and voice interactions
5. **Agent Operations**: Multi-agent conversations and tool usage
6. **Voice Interactions**: Speech-to-text and text-to-speech operations
7. **AI Model Calls**: OpenAI GPT-4, Vision, DALL-E, and TTS usage

### Custom Cartrita Traces

- **MCP Messages**: Inter-agent communication tracking
- **Multi-Modal Processing**: Cross-sensory data fusion
- **Workflow Executions**: Tool orchestration and automation
- **Knowledge Hub Operations**: Vector search and embeddings

## 🛠️ **Using the Telemetry Agent**

### In the Chat Interface

Simply ask Cartrita to perform telemetry operations:

```
You: "Can you check the telemetry status and create a trace for the current conversation?"

Cartrita: *Checking telemetry status...*
✅ OpenTelemetry Integration: Fully Operational
✅ Tracing: Active with 1,247 spans today  
✅ Metrics: 23 active counters, 15 histograms
✅ Agent Health: 98% performance score

*Creating conversation trace...*
🔍 Trace "user-conversation-2025" created successfully
📊 Trace ID: abc123...
⚡ Duration: 2.3ms with 4 child spans
```

### Via API Endpoints

```javascript
// Direct telemetry command
POST /api/telemetry/command
{
  "command": "Create a trace for payment processing",
  "context": {
    "userId": "user123",
    "sessionId": "session456"
  }
}

// Get telemetry status
GET /api/telemetry/status

// Access interactive manual
GET /api/telemetry/manual
```

## 📈 **Telemetry Operations Reference**

### Tracing Operations

| Command Pattern | Example | Purpose |
|----------------|---------|---------|
| `Create a trace for [operation]` | `Create a trace for user authentication` | Generate custom traces for specific workflows |
| `Analyze traces from [timeframe]` | `Analyze traces from the last 2 hours` | Review trace performance and patterns |
| `Demo a [scenario] trace` | `Demo a multi-agent workflow trace` | Create example traces for learning |

### Metrics Operations

| Command Pattern | Example | Purpose |
|----------------|---------|---------|
| `Create a counter named [name]` | `Create a counter named api_calls_total` | Track cumulative values |
| `Create a histogram named [name]` | `Create a histogram named response_time_ms` | Measure distributions |
| `Record metric [name] with value [number]` | `Record metric user_rating with value 4.5` | Add data points |
| `Show [filter] metrics` | `Show performance metrics` | Display current values |

### Analysis & Monitoring

| Command Pattern | Example | Purpose |
|----------------|---------|---------|
| `Check [component] status` | `Check telemetry status` | System health verification |
| `Analyze [data type]` | `Analyze system performance` | Generate insights and recommendations |
| `Show [report type]` | `Show error analysis report` | Detailed breakdowns |

## 🎯 **Real-World Usage Examples**

### Monitoring User Experience

```
"Create a trace for the complete user registration flow"
"Create a counter for successful registrations"
"Create a histogram for registration completion time"
"Analyze user experience traces from today"
```

### Performance Optimization

```
"Check system performance"
"Create traces for slow API endpoints"
"Show database performance metrics"
"Analyze response time trends"
```

### Error Investigation

```
"Create error tracking traces"
"Show recent error analysis"
"Create a counter for authentication failures"
"Trace the error handling workflow"
```

### Agent Collaboration Monitoring

```
"Trace multi-agent conversations"
"Create metrics for agent response times"
"Analyze agent collaboration patterns"
"Monitor MCP message performance"
```

## 🔧 **Advanced Features**

### Custom Attributes

Add context to your traces:
```
"Create a trace for order processing with attributes: orderId=12345, userId=user789"
```

### Time-based Analysis

Specify timeframes for analysis:
```
"Analyze traces from the last 30 minutes"
"Show metrics from today"
"Check performance trends this week"
```

### Filtered Views

Focus on specific components:
```
"Show database metrics only"
"Analyze voice interaction traces"
"Check agent performance specifically"
```

## 📊 **Understanding the Output**

### Trace Information

When you create or analyze traces, you'll see:
- **Trace ID**: Unique identifier for tracking
- **Duration**: How long the operation took
- **Child Spans**: Sub-operations within the trace
- **Attributes**: Contextual information
- **Status**: Success/error indication

### Metrics Data

Metrics will show:
- **Counter Values**: Total counts
- **Histogram Distributions**: Value ranges and percentiles
- **Labels**: Dimensional data for filtering
- **Timestamps**: When data was recorded

### Performance Reports

Analysis includes:
- **Response Times**: Average, median, 95th percentile
- **Error Rates**: Percentage and trends
- **Resource Usage**: Memory, CPU, database connections
- **Recommendations**: AI-generated optimization suggestions

## 🚨 **Troubleshooting**

### Common Issues

**"Telemetry agent not responding"**
- Check: `"Check telemetry status"`
- Solution: System restart may be needed

**"Traces not appearing"**
- Verify: Tracing is enabled in status check
- Create: Manual test trace to verify functionality

**"Metrics showing zero values"**
- Ensure: Metrics are being actively recorded
- Check: Metric names match exactly

### Getting Help

```
# Show the complete manual
"Show telemetry manual"

# Get command examples
"Show telemetry examples"

# Check system health
"Health check telemetry"

# Get troubleshooting info
"Telemetry troubleshooting help"
```

## 🎉 **Best Practices**

### Effective Tracing

1. **Use Descriptive Names**: `"user-login-flow"` vs `"operation1"`
2. **Add Relevant Attributes**: Include user IDs, session info, business context
3. **Keep Traces Focused**: One trace per logical operation
4. **Regular Analysis**: Check traces weekly for performance insights

### Smart Metrics

1. **Counter Best Practices**: Use for events that only increase (requests, errors)
2. **Histogram Usage**: Ideal for measurements (response times, payload sizes)
3. **Label Management**: Include useful dimensions, avoid high cardinality
4. **Regular Review**: Analyze metrics trends for business insights

### Performance Optimization

1. **Monitor Key Flows**: Focus on critical user journeys
2. **Set Performance Baselines**: Know your normal operating parameters
3. **Proactive Monitoring**: Use telemetry to catch issues before users do
4. **Data-Driven Decisions**: Let telemetry guide optimization efforts

---

**Remember**: The TelemetryAgent is always learning and improving. Your natural language commands help it understand what observability insights matter most to your Cartrita experience.

🔗 **Integration Status**: OpenTelemetry JS & Contrib fully merged into Cartrita backend
📈 **Coverage**: 100% of Cartrita operations automatically instrumented
🤖 **AI Interface**: Natural language telemetry commands available 24/7