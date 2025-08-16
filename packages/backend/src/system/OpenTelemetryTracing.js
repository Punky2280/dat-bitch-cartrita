/**
 * OpenTelemetry Tracing Implementation for Advanced 2025 MCP System
 *
 * Provides comprehensive observability with:
 * - Distributed tracing across all agents
 * - Performance monitoring for tools and operations
 * - Custom spans for business logic
 * - Integration with Advanced 2025 MCP Orchestrator
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as OTLPTraceExporterHTTP } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGRPC } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHTTP } from '@opentelemetry/exporter-metrics-otlp-http';
// sdk-metrics still provides reader + console exporter; API unchanged for v2
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { buildBaseResourceAttributes } from './otelSemantic.js';

class OpenTelemetryTracing {
  constructor() {
    this.sdk = null;
    this.tracer = null;
    this.meter = null;
    this.initialized = false;
    this.serviceName = 'cartrita-advanced-2025-mcp';
    this.serviceVersion = '2025-06-18';
  }

  /**
   * Initialize OpenTelemetry with advanced configuration
   */
  async initialize(options = {}) {
    if (this.initialized) {
      console.log(
        '[OpenTelemetryTracing] ⚠️ Observability already initialized.'
      );
      return true;
    }
    try {
      console.log(
        '[OpenTelemetryTracing] 🔍 Initializing advanced observability...'
      );

      // Enable diagnostic logging for troubleshooting
      diag.setLogger(
        new DiagConsoleLogger(),
        options.logLevel || DiagLogLevel.INFO
      );

      // Follow official Node.js SDK pattern with exporters and metric readers
      const baseAttrs = buildBaseResourceAttributes(process.env);
      // Create resource with the base attributes
      const combinedResource = resourceFromAttributes(baseAttrs);
      // Decide exporters (OTLP HTTP/GRPC) based on env, else console
      const traceExporter = (() => {
        if (process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL === 'grpc') {
          return new OTLPTraceExporterGRPC();
        }
        if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
          return new OTLPTraceExporterHTTP();
        }
        return options.traceExporter || new ConsoleSpanExporter();
      })();
      const metricExporter = (() => {
        if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT) {
          return new OTLPMetricExporterHTTP();
        }
        return new ConsoleMetricExporter();
      })();
      this.sdk = new NodeSDK({
        serviceName: this.serviceName,
        serviceVersion: this.serviceVersion,
        traceExporter,
        metricReader:
          options.metricReader ||
          new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 30000, // Export metrics every 30 seconds
          }),
        instrumentations: [getNodeAutoInstrumentations()],
        resource: combinedResource,
      });

      await this.sdk.start();

  this.tracer = trace.getTracer(this.serviceName, this.serviceVersion);

      // Get the meter for custom metrics
  const { metrics } = await import('@opentelemetry/api');
  this.meter = metrics.getMeter(this.serviceName, this.serviceVersion);

      // Initialize common counters/histograms if not already defined
      if (!global.otelCounters) global.otelCounters = {};
      const safeCreateCounter = (key, name, desc) => {
        if (!global.otelCounters[key]) {
          try { global.otelCounters[key] = this.createCounter(name, desc); } catch(_) {}
        }
      };
      const safeCreateHistogram = (key, name, desc) => {
        if (!global.otelCounters[key]) {
          try { global.otelCounters[key] = this.createHistogram(name, desc); } catch(_) {}
        }
      };
      safeCreateCounter('hfRoutingSuccess','hf_routing_success_total','Successful routed HF inferences');
      safeCreateCounter('hfRoutingErrors','hf_routing_errors_total','Errored routed HF inferences');
      safeCreateCounter('hfRoutingFallbacks','hf_routing_fallbacks_total','Fallback occurrences during routing');
      safeCreateHistogram('hfRoutingLatency','hf_routing_latency_ms','End-to-end routing latency ms');

      this.initialized = true;

      console.log(
        '[OpenTelemetryTracing] ✅ Advanced observability initialized'
      );
      console.log('   - Service: cartrita-advanced-2025-mcp');
      console.log('   - Version: 2025-06-18');
      console.log(
        '   - Features: Swarm Intelligence, Self-Improving Agents, MAESTRO Security'
      );
      console.log('   - Exporters: Console (traces & metrics)');

      return true;
    } catch (error) {
      console.error('[OpenTelemetryTracing] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * A generic wrapper to trace an operation. This is the new, idiomatic pattern.
   * @param {string} spanName - The name of the span (e.g., 'agent.researcher.search').
   * @param {object} options - OpenTelemetry span options (e.g., kind, attributes).
   * @param {Function} handler - The async function to execute within the trace.
   */
  async traceOperation(spanName, options, handler) {
    // Handle different parameter patterns
    if (typeof options === 'function') {
      handler = options;
      options = {};
    }
    
    if (!handler || typeof handler !== 'function') {
      throw new Error('traceOperation requires a handler function');
    }
    
    if (!this.initialized || !this.tracer) {
      // If not initialized, provide a mock span object
      const mockSpan = {
        setAttributes: () => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {},
        setAttribute: () => {}
      };
      return handler(mockSpan);
    }
    // `startActiveSpan` automatically handles context and ensures the span is ended.
    return this.tracer.startActiveSpan(spanName, options, async span => {
      try {
        const result = await handler(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error); // The correct way to record errors.
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // --- NEW WRAPPER METHODS ---
  // These replace the manual start/end methods with a much safer and cleaner pattern.

  async traceAgentOperation(agentName, operation, attributes, handler) {
    const spanName = `agent.${agentName}.${operation}`;
  const options = {
      kind: SpanKind.INTERNAL,
      attributes: {
        'agent.name': agentName,
        'agent.operation': operation,
        'agent.type': this.getAgentType(agentName),
    'code.namespace': `agent.${agentName}`,
    'code.function': operation,
        ...attributes,
      },
    };
    return this.traceOperation(spanName, options, handler);
  }

  async traceToolExecution(toolName, agentName, parameters, handler) {
    const spanName = `tool.${toolName}`;
  const options = {
      kind: SpanKind.INTERNAL,
      attributes: {
        'tool.name': toolName,
        'tool.agent': agentName,
        'tool.parameters': JSON.stringify(parameters),
        'tool.category': this.getToolCategory(toolName),
    'code.namespace': `tool.${toolName}`,
      },
    };
    return this.traceOperation(spanName, options, handler);
  }

  async traceUserInteraction(userId, message, handler) {
    const spanName = 'user.interaction';
    const options = {
      kind: SpanKind.SERVER,
      attributes: {
        'user.id': userId,
        'user.message_length': message ? message.length : 0,
        'interaction.type': 'chat',
      },
    };
    // The handler receives the active span, so it can add attributes or events to it.
    // Example: handler(span) => span.setAttribute('key', 'value');
    return this.traceOperation(spanName, options, handler);
  }

  /**
   * Get the current active span from the context.
   */
  getCurrentSpan() {
    return trace.getSpan(context.active());
  }

  /**
   * Get a tracer instance for a given name
   */
  getTracer(name, version = this.serviceVersion) {
    if (!this.initialized) {
      // Return a no-op tracer if not initialized
      return {
        startSpan: () => ({
          setAttributes: () => {},
          setStatus: () => {},
          recordException: () => {},
          end: () => {},
          setAttribute: () => {}
        })
      };
    }
    return trace.getTracer(name, version);
  }

  /**
   * Add attributes to the currently active span.
   */
  addAttributesToCurrentSpan(attributes) {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan) {
      currentSpan.setAttributes(attributes);
    }
  }

  getAgentType(agentName) {
    const agentTypes = {
      supervisor: 'orchestration',
      researcher: 'knowledge',
      analyst: 'computation',
      writer: 'content',
      artist: 'creative',
      codewriter: 'development',
      scheduler: 'planning',
      comedian: 'entertainment',
    };
    return agentTypes[agentName.toLowerCase()] || 'general';
  }

  getToolCategory(toolName) {
    const toolCategories = {
      calculator: 'computation',
      wikipedia: 'knowledge',
      duckduckgo_search: 'search',
      wolfram_alpha: 'computation',
      dalleImageGeneration: 'ai_creative',
      githubIntegration: 'development',
      getCurrentDateTime: 'system',
    };
    return toolCategories[toolName] || 'general';
  }

  /**
   * Create a custom metric counter for business metrics
   */
  createCounter(name, description, unit = '1') {
    if (!this.initialized || !this.meter) return null;

    try {
      return this.meter.createCounter(name, {
        description,
        unit,
      });
    } catch (error) {
      console.warn(
        '[OpenTelemetryTracing] Failed to create counter:',
        error.message
      );
      return null;
    }
  }

  /**
   * Create a custom metric histogram for measurements
   */
  createHistogram(name, description, unit = '1') {
    if (!this.initialized || !this.meter) return null;

    try {
      return this.meter.createHistogram(name, {
        description,
        unit,
      });
    } catch (error) {
      console.warn(
        '[OpenTelemetryTracing] Failed to create histogram:',
        error.message
      );
      return null;
    }
  }

  /**
   * Add an event to the current span with structured data
   */
  addEvent(eventName, attributes = {}) {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan) {
      currentSpan.addEvent(eventName, {
        ...attributes,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Create a child span from the current context
   */
  startChildSpan(name, options = {}) {
    if (!this.initialized || !this.tracer) return null;

    return this.tracer.startSpan(name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes || {},
      parent: this.getCurrentSpan()?.spanContext(),
    });
  }

  getStatus() {
    // Enhanced status with more observability information
    return {
      initialized: this.initialized,
      service_name: this.serviceName,
      service_version: this.serviceVersion,
      sdk_status: this.sdk ? 'active' : 'inactive',
      features: [
        'automatic_instrumentations',
        'agent_tracing',
        'tool_execution_monitoring',
        'user_interaction_tracing',
        'custom_metrics',
        'span_events',
        'child_spans',
      ],
      environment: {
        otlp_endpoint:
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'not_configured',
        service_name_env: process.env.OTEL_SERVICE_NAME || 'using_default',
        log_level: process.env.OTEL_LOG_LEVEL || 'INFO',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async shutdown() {
    try {
      if (!this.initialized) return;
      console.log('[OpenTelemetryTracing] 🔽 Shutting down observability...');
      if (this.sdk) {
        await this.sdk.shutdown();
      }
      this.initialized = false;
      console.log('[OpenTelemetryTracing] ✅ Observability shutdown complete');
    } catch (error) {
      console.error('[OpenTelemetryTracing] ❌ Shutdown error:', error);
    }
  }
}

const openTelemetryTracing = new OpenTelemetryTracing();

// Override traceOperation in test environment for synchronous behavior
if (process.env.NODE_ENV === 'test') {
  const originalTraceOperation = openTelemetryTracing.traceOperation.bind(openTelemetryTracing);
  
  openTelemetryTracing.traceOperation = function(spanName, options, handler) {
    // Handle different parameter patterns
    if (typeof options === 'function') {
      handler = options;
      options = {};
    }
    
    if (!handler || typeof handler !== 'function') {
      throw new Error('traceOperation requires a handler function');
    }
    
    // In test mode, execute directly without tracing
    const mockSpan = {
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
      setAttribute: () => {}
    };
    return handler(mockSpan);
  };
}

// Export the traceOperation function for direct use
export const traceOperation = (...args) => openTelemetryTracing.traceOperation(...args);
export const traceAgentOperation = (...args) => openTelemetryTracing.traceAgentOperation(...args);
export const getTracer = (...args) => openTelemetryTracing.getTracer(...args);

export default openTelemetryTracing;
