// Mock for OpenTelemetryTracing to avoid ES6 import issues in tests
class MockOpenTelemetryTracing {
  static traceOperation(spanName, operation) {
    // Simply execute the operation without tracing in tests
    return operation();
  }

  static traceAgentOperation(agentName, operation) {
    return operation();
  }

  static traceToolExecution(toolName, operation) {
    return operation();
  }

  static createCounter(name, description) {
    return {
      add: () => {},
      increment: () => {}
    };
  }

  static createHistogram(name, description) {
    return {
      record: () => {}
    };
  }

  static createMeter(name) {
    return {
      createCounter: this.createCounter,
      createHistogram: this.createHistogram
    };
  }

  static createTracer(name) {
    return {
      startSpan: () => ({
        end: () => {},
        setStatus: () => {},
        setAttributes: () => {}
      })
    };
  }

  static getTracer(name) {
    return this.createTracer(name);
  }

  static getMeter(name) {
    return this.createMeter(name);
  }

  // Initialize method
  static initialize() {
    return Promise.resolve();
  }

  // Shutdown method
  static shutdown() {
    return Promise.resolve();
  }
}

export default MockOpenTelemetryTracing;
