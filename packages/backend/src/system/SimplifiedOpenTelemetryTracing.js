// Simplified OpenTelemetry Tracing for ES Modules - Task 18
// Handles ES module compatibility issues with OpenTelemetry packages

class SimplifiedOpenTelemetryTracing {
  constructor() {
    this.initialized = false;
    this.isTest = process.env.NODE_ENV === 'test';
    console.log('[OpenTelemetry] Using simplified tracing for ES module compatibility');
  }

  static async initialize() {
    if (this.instance && this.instance.initialized) {
      return this.instance;
    }

    this.instance = new SimplifiedOpenTelemetryTracing();
    this.instance.initialized = true;
    console.log('[OpenTelemetry] Simplified tracing initialized');
    return this.instance;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new SimplifiedOpenTelemetryTracing();
      this.instance.initialized = true;
    }
    return this.instance;
  }

  static get initialized() {
    return this.instance && this.instance.initialized;
  }

  static startSpan(name, options = {}) {
    // Return a simplified span object for compatibility
    return {
      setStatus: (status) => { /* noop */ },
      addEvent: (name, attributes) => { 
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Trace] ${name}:`, attributes);
        }
      },
      recordException: (error) => { 
        if (process.env.NODE_ENV === 'development') {
          console.error('[Trace] Exception:', error.message);
        }
      },
      end: () => { /* noop */ }
    };
  }

  static createCounter(name, description = '') {
    // Return a simplified counter for compatibility
    return {
      add: (value = 1, attributes = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Metric] ${name}: +${value}`, attributes);
        }
      }
    };
  }

  static createHistogram(name, description = '') {
    // Return a simplified histogram for compatibility
    return {
      record: (value, attributes = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Metric] ${name}: ${value}`, attributes);
        }
      }
    };
  }

  static createGauge(name, description = '') {
    // Return a simplified gauge for compatibility
    return {
      record: (value, attributes = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Metric] ${name}: ${value}`, attributes);
        }
      }
    };
  }

  // Helper methods for tracing
  static traceOperation(name, operation, attributes = {}) {
    const span = this.startSpan(name, { attributes });
    
    try {
      const result = operation();
      
      if (result && typeof result.then === 'function') {
        // Handle async operations
        return result
          .then(value => {
            span.setStatus({ code: 1 }); // Success
            span.end();
            return value;
          })
          .catch(error => {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message }); // Error
            span.end();
            throw error;
          });
      } else {
        // Handle sync operations
        span.setStatus({ code: 1 }); // Success
        span.end();
        return result;
      }
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // Error
      span.end();
      throw error;
    }
  }

  static traceAgentOperation(agentName, operation, context = {}) {
    return this.traceOperation(`agent.${agentName}.operation`, operation, {
      'agent.name': agentName,
      ...context
    });
  }

  static traceToolExecution(toolName, operation, context = {}) {
    return this.traceOperation(`tool.${toolName}.execute`, operation, {
      'tool.name': toolName,
      ...context
    });
  }

  // Cleanup method
  static async cleanup() {
    if (this.instance) {
      console.log('[OpenTelemetry] Simplified tracing cleanup');
      this.instance.initialized = false;
    }
  }

  // Health check
  static getHealthStatus() {
    return {
      status: 'healthy',
      initialized: this.initialized,
      mode: 'simplified'
    };
  }
}

// Initialize global counters object for compatibility
if (!global.otelCounters) {
  global.otelCounters = {};
  
  // Create common counters
  const commonCounters = [
    'http_requests_total',
    'agent_operations_total', 
    'tool_executions_total',
    'security_events_total',
    'auth_attempts_total',
    'hf_requests_total',
    'hf_token_misuse_total'
  ];
  
  for (const counterName of commonCounters) {
    global.otelCounters[counterName] = SimplifiedOpenTelemetryTracing.createCounter(counterName);
  }
}

export default SimplifiedOpenTelemetryTracing;
