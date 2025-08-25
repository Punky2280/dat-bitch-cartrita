/**
 * Enhanced OpenTelemetry Service for Cartrita Advanced 2025 MCP System
 *
 * This service merges the upstream OpenTelemetry JS components with our existing
 * Cartrita infrastructure, providing advanced observability with:
 * - Comprehensive agent tracing
 * - Multi-modal processing monitoring
 * - Advanced metrics collection
 * - Integration with LangChain and MCP orchestrators
 * - Upstream OpenTelemetry JS components integration
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as OTLPTraceExporterHTTP } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGRPC } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHTTP } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import resourcesPkg from '@opentelemetry/resources';
import semanticConventionsPkg from '@opentelemetry/semantic-conventions';
const { resourceFromAttributes, defaultResource } = resourcesPkg;
const { SemanticResourceAttributes } = semanticConventionsPkg;
import otelApiPkg from '@opentelemetry/api';
const { trace, metrics, context, SpanKind, SpanStatusCode } = otelApiPkg;
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import OpenTelemetryTracing from './OpenTelemetryTracing.js';
import pg from 'pg';

class EnhancedOpenTelemetryService {
  constructor() {
    this.sdk = null;
    this.tracer = null;
    this.meter = null;
    this.logger = null;
    this.isInitialized = false;
    this.dbPool = null;
    this.prometheusExporter = null;

    // Base OpenTelemetry tracing service integration
    this.baseTracing = OpenTelemetryTracing;

    // Custom metrics for Cartrita-specific operations
    this.metrics = {
      httpRequests: null,
      dbQueries: null,
      agentInteractions: null,
      workflowExecutions: null,
      errorCounts: null,
      responseTime: null,
      systemHealth: null,
      // Enhanced Cartrita metrics
      mcpCommunications: null,
      multiModalProcessing: null,
      userInteractions: null,
      agentOperations: null,
    };
  }

  async initialize(options = {}) {
    if (this.isInitialized) return;

    try {
      console.log(
        '[EnhancedOpenTelemetryService] 🚀 Initializing Enhanced OpenTelemetry Service with upstream integration...'
      );

      // Initialize base OpenTelemetry tracing first
      await this.baseTracing.initialize(options);

      // Database connection for storing traces
      await this.initializeDatabase();

      // Enhanced resource with Cartrita-specific attributes
      const enhancedResource = resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME || 'cartrita-advanced-2025-mcp',
        [SemanticResourceAttributes.SERVICE_VERSION]:
          process.env.SERVICE_VERSION || '2025.1.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          process.env.NODE_ENV || 'development',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'cartrita',
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]:
          process.env.SERVICE_INSTANCE_ID || 'cartrita-001',
        'cartrita.system.type': 'advanced-agi-orchestrator',
        'cartrita.agents.enabled': 'true',
        'cartrita.mcp.version': '2025-mcp',
        'cartrita.multi_modal.enabled': 'true',
      });

      // Configure the enhanced SDK
      const traceExporter = (() => {
        if (process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL === 'grpc')
          return new OTLPTraceExporterGRPC();
        if (
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
          process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
        )
          return new OTLPTraceExporterHTTP();
        return new ConsoleSpanExporter();
      })();
      const metricExporter = (() => {
        if (
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
          process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
        )
          return new OTLPMetricExporterHTTP();
        return new ConsoleMetricExporter();
      })();
      this.sdk = new NodeSDK({
        resource: enhancedResource,
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 5000,
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable to reduce noise
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span, request) => {
                span.setAttributes({
                  'cartrita.request.path': request.url,
                  'cartrita.request.method': request.method,
                  'cartrita.request.user_agent':
                    request.headers['user-agent'] || 'unknown',
                  'cartrita.enhanced.tracing': true,
                });
              },
              responseHook: (span, response) => {
                span.setAttributes({
                  'cartrita.response.status_code': response.statusCode,
                  'cartrita.response.content_length':
                    response.headers['content-length'] || 0,
                  'cartrita.enhanced.response': true,
                });
              },
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-postgresql': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
              enabled: true,
            },
          }),
        ],
      });

      // Initialize Prometheus exporter for production metrics
      if (
        process.env.NODE_ENV === 'production' ||
        process.env.ENABLE_PROMETHEUS === 'true'
      ) {
        this.prometheusExporter = new PrometheusExporter({
          port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
        });
      }

      // Start the enhanced SDK
      await this.sdk.start();

      // Initialize tracers and meters with enhanced naming
      this.tracer = trace.getTracer('cartrita-enhanced-backend', '2025.1.0');
      this.meter = metrics.getMeter('cartrita-enhanced-backend', '2025.1.0');

      // Initialize enhanced custom metrics
      this.initializeEnhancedCustomMetrics();

      this.isInitialized = true;
      console.log(
        '[EnhancedOpenTelemetryService] ✅ Enhanced OpenTelemetry Service initialized successfully'
      );
      console.log('   🔍 Base tracing integration: Active');
      console.log('   📊 Enhanced metrics: Active');
      console.log('   🤖 Agent operation monitoring: Active');
      console.log('   🔗 MCP communication tracing: Active');
      console.log('   🎭 Multi-modal processing tracking: Active');

      // Start periodic health checks
      this.startHealthChecks();
    } catch (error) {
      console.error(
        '[EnhancedOpenTelemetryService] ❌ Failed to initialize:',
        error
      );
      throw error;
    }
  }

  async initializeDatabase() {
    try {
      this.dbPool = new pg.Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        user: process.env.POSTGRES_USER || 'robert',
        password: process.env.POSTGRES_PASSWORD || 'punky1',
        database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
        max: 5,
      });

      // Test connection
      const client = await this.dbPool.connect();
      client.release();
      console.log(
        '[OpenTelemetry] ✅ Database connection for telemetry initialized'
      );
    } catch (error) {
      console.error(
        '[OpenTelemetry] ❌ Failed to initialize database connection:',
        error
      );
    }
  }

  initializeEnhancedCustomMetrics() {
    // Original metrics
    this.metrics.httpRequests = this.meter.createCounter(
      'cartrita_http_requests_total',
      {
        description: 'Total number of HTTP requests',
      }
    );

    this.metrics.dbQueries = this.meter.createCounter(
      'cartrita_db_queries_total',
      {
        description: 'Total number of database queries',
      }
    );

    this.metrics.agentInteractions = this.meter.createCounter(
      'cartrita_agent_interactions_total',
      {
        description: 'Total number of agent interactions',
      }
    );

    this.metrics.workflowExecutions = this.meter.createCounter(
      'cartrita_workflow_executions_total',
      {
        description: 'Total number of workflow executions',
      }
    );

    this.metrics.errorCounts = this.meter.createCounter(
      'cartrita_errors_total',
      {
        description: 'Total number of errors',
      }
    );

    this.metrics.responseTime = this.meter.createHistogram(
      'cartrita_response_time_seconds',
      {
        description: 'Response time in seconds',
        boundaries: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
      }
    );

    this.metrics.systemHealth = this.meter.createObservableGauge(
      'cartrita_system_health_score',
      {
        description: 'System health score (0-100)',
      }
    );

    // Enhanced Cartrita-specific metrics
    this.metrics.agentOperations = {
      counter: this.meter.createCounter('cartrita_agent_operations_total', {
        description: 'Total number of agent operations',
      }),
      duration: this.meter.createHistogram(
        'cartrita_agent_operations_duration_ms',
        {
          description: 'Agent operation duration in milliseconds',
          boundaries: [10, 50, 100, 500, 1000, 5000, 10000],
        }
      ),
      errors: this.meter.createCounter(
        'cartrita_agent_operations_errors_total',
        {
          description: 'Number of agent operation errors',
        }
      ),
    };

    this.metrics.mcpCommunications = {
      messages: this.meter.createCounter('cartrita_mcp_messages_total', {
        description: 'Total MCP messages processed',
      }),
      latency: this.meter.createHistogram('cartrita_mcp_message_latency_ms', {
        description: 'MCP message processing latency in milliseconds',
        boundaries: [1, 5, 10, 50, 100, 500, 1000],
      }),
      protocolErrors: this.meter.createCounter(
        'cartrita_mcp_protocol_errors_total',
        {
          description: 'MCP protocol errors',
        }
      ),
    };

    this.metrics.multiModalProcessing = {
      requests: this.meter.createCounter('cartrita_multimodal_requests_total', {
        description: 'Total multi-modal processing requests',
      }),
      processingTime: this.meter.createHistogram(
        'cartrita_multimodal_processing_duration_ms',
        {
          description: 'Multi-modal processing duration in milliseconds',
          boundaries: [100, 500, 1000, 5000, 10000, 30000],
        }
      ),
      modalityTypes: this.meter.createCounter(
        'cartrita_multimodal_modality_types_total',
        {
          description: 'Multi-modal requests by modality type',
        }
      ),
    };

    this.metrics.userInteractions = {
      sessions: this.meter.createCounter('cartrita_user_sessions_total', {
        description: 'Total user sessions',
      }),
      responseTime: this.meter.createHistogram(
        'cartrita_user_response_duration_ms',
        {
          description: 'User response time distribution in milliseconds',
          boundaries: [100, 500, 1000, 2000, 5000, 10000],
        }
      ),
      satisfaction: this.meter.createHistogram(
        'cartrita_user_satisfaction_score',
        {
          description: 'User satisfaction scores (1-10)',
          boundaries: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        }
      ),
    };

    // Register system health callback
    this.metrics.systemHealth.addCallback(async result => {
      const healthScore = await this.calculateSystemHealth();
      result.observe(healthScore);
    });

    console.log(
      '[EnhancedOpenTelemetryService] ✅ Enhanced custom metrics initialized'
    );
    console.log('   📊 Agent operations metrics: Active');
    console.log('   🔗 MCP communications metrics: Active');
    console.log('   🎭 Multi-modal processing metrics: Active');
    console.log('   👤 User interaction metrics: Active');
  }

  async calculateSystemHealth() {
    try {
      let healthScore = 100;

      // Check database connectivity
      if (this.dbPool) {
        try {
          const client = await this.dbPool.connect();
          client.release();
        } catch (error) {
          healthScore -= 20;
        }
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
        healthScore -= 10;
      }

      // Check uptime (penalize frequent restarts)
      if (process.uptime() < 300) {
        // Less than 5 minutes
        healthScore -= 5;
      }

      return Math.max(0, healthScore);
    } catch (error) {
      console.error('[OpenTelemetry] Error calculating system health:', error);
      return 0;
    }
  }

  // Trace HTTP requests
  traceHttpRequest(req, res, next) {
    const span = this.tracer.startSpan(`HTTP ${req.method} ${req.path}`);

    span.setAttributes({
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.user_agent': req.get('User-Agent') || 'unknown',
      'cartrita.user.id': req.user?.id || 'anonymous',
    });

    // Record HTTP request metric
    this.metrics.httpRequests.add(1, {
      method: req.method,
      endpoint: req.path,
      status_code: res.statusCode,
    });

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;

      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_size': res.get('Content-Length') || 0,
      });

      // Record response time
      this.metrics.responseTime.record(duration, {
        method: req.method,
        endpoint: req.path,
        status_code: res.statusCode,
      });

      span.setStatus({ code: res.statusCode >= 400 ? 2 : 1 });
      span.end();
    });

    next();
  }

  // Trace agent interactions
  traceAgentInteraction(agentType, userId, action, inputData) {
    const span = this.tracer.startSpan(`Agent ${agentType} - ${action}`);

    span.setAttributes({
      'cartrita.agent.type': agentType,
      'cartrita.user.id': userId || 'system',
      'cartrita.agent.action': action,
      'cartrita.input.size': JSON.stringify(inputData || {}).length,
    });

    // Record agent interaction metric
    this.metrics.agentInteractions.add(1, {
      agent_type: agentType,
      action: action,
    });

    return span;
  }

  // Trace database queries
  traceDbQuery(query, params = []) {
    const span = this.tracer.startSpan('Database Query');

    span.setAttributes({
      'db.operation': this.extractDbOperation(query),
      'db.statement': query.substring(0, 100), // First 100 chars
      'db.params.count': params.length,
    });

    // Record database query metric
    this.metrics.dbQueries.add(1, {
      operation: this.extractDbOperation(query),
    });

    return span;
  }

  extractDbOperation(query) {
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.startsWith('select')) return 'SELECT';
    if (trimmedQuery.startsWith('insert')) return 'INSERT';
    if (trimmedQuery.startsWith('update')) return 'UPDATE';
    if (trimmedQuery.startsWith('delete')) return 'DELETE';
    if (trimmedQuery.startsWith('create')) return 'CREATE';
    if (trimmedQuery.startsWith('drop')) return 'DROP';
    return 'OTHER';
  }

  // Trace workflow executions
  traceWorkflowExecution(workflowId, workflowName, userId) {
    const span = this.tracer.startSpan(`Workflow: ${workflowName}`);

    span.setAttributes({
      'cartrita.workflow.id': workflowId,
      'cartrita.workflow.name': workflowName,
      'cartrita.user.id': userId || 'system',
    });

    // Record workflow execution metric
    this.metrics.workflowExecutions.add(1, {
      workflow_name: workflowName,
    });

    return span;
  }

  // Log errors with telemetry
  recordError(error, context = {}) {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
    }

    // Record error metric
    this.metrics.errorCounts.add(1, {
      error_type: error.constructor.name,
      component: context.component || 'unknown',
    });

    console.error('[OpenTelemetry] Error recorded:', error);
  }

  // Store trace in database for historical analysis
  async storeTrace(traceData) {
    if (!this.dbPool) return;

    try {
      const query = `
                INSERT INTO telemetry_traces (trace_id, span_id, parent_span_id, operation_name, start_time, end_time, duration_ms, status, tags, logs)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;

      await this.dbPool.query(query, [
        traceData.traceId,
        traceData.spanId,
        traceData.parentSpanId || null,
        traceData.operationName,
        traceData.startTime,
        traceData.endTime,
        traceData.duration,
        traceData.status,
        JSON.stringify(traceData.tags || {}),
        JSON.stringify(traceData.logs || []),
      ]);
    } catch (error) {
      console.error('[OpenTelemetry] Failed to store trace:', error);
    }
  }

  startHealthChecks() {
    // Periodic system health updates
    setInterval(async () => {
      try {
        const healthScore = await this.calculateSystemHealth();

        if (this.dbPool) {
          await this.dbPool.query(
            'INSERT INTO system_health (component, status, message, metrics) VALUES ($1, $2, $3, $4)',
            [
              'opentelemetry',
              healthScore > 80
                ? 'healthy'
                : healthScore > 50
                  ? 'warning'
                  : 'error',
              `Health score: ${healthScore}`,
              JSON.stringify({
                health_score: healthScore,
                memory_usage: process.memoryUsage(),
                uptime: process.uptime(),
              }),
            ]
          );
        }
      } catch (error) {
        console.error('[OpenTelemetry] Health check error:', error);
      }
    }, 60000); // Every minute
  }

  // Get telemetry dashboard data
  async getDashboardData() {
    if (!this.dbPool) return null;

    try {
      const [traces, health] = await Promise.all([
        this.dbPool.query(`
                    SELECT operation_name, COUNT(*) as count, AVG(duration_ms) as avg_duration
                    FROM telemetry_traces
                    WHERE start_time > NOW() - INTERVAL '1 hour'
                    GROUP BY operation_name
                    ORDER BY count DESC
                    LIMIT 10
                `),
        this.dbPool.query(`
                    SELECT component, status, metrics
                    FROM system_health
                    WHERE checked_at > NOW() - INTERVAL '5 minutes'
                    ORDER BY checked_at DESC
                    LIMIT 10
                `),
      ]);

      return {
        topOperations: traces.rows,
        systemHealth: health.rows,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[OpenTelemetry] Failed to get dashboard data:', error);
      return null;
    }
  }

  // Enhanced tracing methods that integrate with base tracing
  async traceEnhancedAgentOperation(
    agentName,
    operation,
    attributes = {},
    handler
  ) {
    const startTime = Date.now();

    const enhancedAttributes = {
      'agent.enhanced': true,
      'cartrita.version': '2025.1.0',
      'cartrita.system': 'advanced-mcp',
      ...attributes,
    };

    try {
      // Use base tracing for the operation
      const result = await this.baseTracing.traceAgentOperation(
        agentName,
        operation,
        enhancedAttributes,
        handler
      );

      // Record enhanced metrics
      this.recordEnhancedAgentMetrics(
        agentName,
        operation,
        Date.now() - startTime,
        true
      );

      return result;
    } catch (error) {
      // Record error metrics
      this.recordEnhancedAgentMetrics(
        agentName,
        operation,
        Date.now() - startTime,
        false,
        error
      );
      throw error;
    }
  }

  async traceMCPCommunication(
    messageType,
    direction,
    attributes = {},
    handler
  ) {
    const startTime = Date.now();
    const spanName = `mcp.${direction}.${messageType}`;

    const enhancedAttributes = {
      'mcp.message.type': messageType,
      'mcp.direction': direction,
      'mcp.protocol.version': '2025-mcp',
      'cartrita.enhanced.tracing': true,
      ...attributes,
    };

    try {
      const result = await this.baseTracing.traceOperation(
        spanName,
        {
          attributes: enhancedAttributes,
        },
        handler
      );

      // Record MCP metrics
      if (this.metrics.mcpCommunications?.messages) {
        this.metrics.mcpCommunications.messages.add(1, {
          'message.type': messageType,
          direction: direction,
        });
      }

      if (this.metrics.mcpCommunications?.latency) {
        this.metrics.mcpCommunications.latency.record(Date.now() - startTime, {
          'message.type': messageType,
          direction: direction,
        });
      }

      return result;
    } catch (error) {
      if (this.metrics.mcpCommunications?.protocolErrors) {
        this.metrics.mcpCommunications.protocolErrors.add(1, {
          'message.type': messageType,
          direction: direction,
          'error.type': error?.name || 'unknown',
        });
      }
      throw error;
    }
  }

  async traceMultiModalProcessing(
    modalityType,
    processingType,
    attributes = {},
    handler
  ) {
    const startTime = Date.now();
    const spanName = `multimodal.${modalityType}.${processingType}`;

    const enhancedAttributes = {
      'multimodal.type': modalityType,
      'multimodal.processing': processingType,
      'cartrita.multimodal.enhanced': true,
      ...attributes,
    };

    try {
      const result = await this.baseTracing.traceOperation(
        spanName,
        {
          attributes: enhancedAttributes,
        },
        handler
      );

      // Record multi-modal metrics
      if (this.metrics.multiModalProcessing?.requests) {
        this.metrics.multiModalProcessing.requests.add(1, {
          modality: modalityType,
          processing_type: processingType,
        });
      }

      if (this.metrics.multiModalProcessing?.processingTime) {
        this.metrics.multiModalProcessing.processingTime.record(
          Date.now() - startTime,
          {
            modality: modalityType,
            processing_type: processingType,
          }
        );
      }

      if (this.metrics.multiModalProcessing?.modalityTypes) {
        this.metrics.multiModalProcessing.modalityTypes.add(1, {
          modality: modalityType,
        });
      }

      return result;
    } catch (error) {
      console.error(
        `[EnhancedOpenTelemetryService] Multi-modal processing error:`,
        error
      );
      throw error;
    }
  }

  recordEnhancedAgentMetrics(
    agentName,
    operation,
    duration,
    success,
    error = null
  ) {
    try {
      const labels = { agent: agentName, operation: operation };

      if (this.metrics.agentOperations?.counter) {
        this.metrics.agentOperations.counter.add(1, labels);
      }

      if (this.metrics.agentOperations?.duration) {
        this.metrics.agentOperations.duration.record(duration, labels);
      }

      if (!success && this.metrics.agentOperations?.errors) {
        this.metrics.agentOperations.errors.add(1, {
          ...labels,
          'error.type': error?.name || 'unknown',
          'error.message': error?.message || 'unknown',
        });
      }
    } catch (metricsError) {
      console.warn(
        '[EnhancedOpenTelemetryService] Failed to record enhanced agent metrics:',
        metricsError
      );
    }
  }

  getEnhancedStatus() {
    const baseStatus = this.baseTracing.getStatus();

    return {
      ...baseStatus,
      enhanced: {
        service_version: '2025.1.0',
        initialized: this.isInitialized,
        custom_metrics: {
          agent_operations: !!this.metrics.agentOperations,
          mcp_communications: !!this.metrics.mcpCommunications,
          multimodal_processing: !!this.metrics.multiModalProcessing,
          user_interactions: !!this.metrics.userInteractions,
        },
        upstream_integration: {
          opentelemetry_js: 'active',
          base_tracing: this.baseTracing.initialized,
          node_sdk: !!this.sdk,
          auto_instrumentations: 'enabled',
        },
        database_integration: !!this.dbPool,
        prometheus_enabled: !!this.prometheusExporter,
      },
    };
  }

  // Enhanced graceful shutdown
  async shutdown() {
    try {
      console.log(
        '[EnhancedOpenTelemetryService] 🔽 Shutting down enhanced observability...'
      );

      // Shutdown base tracing first
      if (this.baseTracing) {
        await this.baseTracing.shutdown();
      }

      // Shutdown enhanced SDK
      if (this.sdk) {
        await this.sdk.shutdown();
        console.log(
          '[EnhancedOpenTelemetryService] ✅ Enhanced SDK shutdown completed'
        );
      }

      // Close Prometheus exporter
      if (this.prometheusExporter) {
        await this.prometheusExporter.shutdown();
        console.log(
          '[EnhancedOpenTelemetryService] ✅ Prometheus exporter shutdown completed'
        );
      }

      // Close database pool
      if (this.dbPool) {
        await this.dbPool.end();
        console.log('[EnhancedOpenTelemetryService] ✅ Database pool closed');
      }

      this.isInitialized = false;
      console.log(
        '[EnhancedOpenTelemetryService] ✅ Enhanced observability shutdown complete'
      );
    } catch (error) {
      console.error('[EnhancedOpenTelemetryService] ❌ Shutdown error:', error);
    }
  }
}

export default EnhancedOpenTelemetryService;
