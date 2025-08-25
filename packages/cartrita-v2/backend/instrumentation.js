/*
 * Enhanced OpenTelemetry Instrumentation Setup for Cartrita Advanced 2025 MCP
 *
 * This file integrates upstream OpenTelemetry JS components with Cartrita's
 * enhanced observability system. It must be loaded BEFORE your application code.
 *
 * Usage:
 * - Development: node --require ./instrumentation.js index.js
 * - Production: Use with environment variables for external observability
 */

// Require upstream OpenTelemetry dependencies
const { NodeSDK } = require('@opentelemetry/sdk-node');
const {
  ConsoleSpanExporter,
  BatchSpanProcessor,
} = require('@opentelemetry/sdk-trace-node');
const {
  getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');
const {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const {
  SemanticResourceAttributes,
} = require('@opentelemetry/semantic-conventions');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

// Optional: OTLP HTTP exporter for sending to external observability systems
let OTLPTraceExporter, OTLPMetricExporter;
try {
  OTLPTraceExporter =
    require('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter;
  OTLPMetricExporter =
    require('@opentelemetry/exporter-metrics-otlp-http').OTLPMetricExporter;
} catch (e) {
  console.warn(
    '[OpenTelemetry] OTLP exporters not available. Install @opentelemetry/exporter-trace-otlp-http and @opentelemetry/exporter-metrics-otlp-http for external observability backends.'
  );
}

// Enable diagnostic logging for troubleshooting
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Configure exporters based on environment
const getTraceExporter = () => {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (OTLPTraceExporter && otlpEndpoint) {
    console.log('[OpenTelemetry] Using OTLP trace exporter:', otlpEndpoint);
    return new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });
  }

  console.log('[OpenTelemetry] Using console trace exporter');
  return new ConsoleSpanExporter();
};

const getMetricReader = () => {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (OTLPMetricExporter && otlpEndpoint) {
    console.log('[OpenTelemetry] Using OTLP metric exporter:', otlpEndpoint);
    return new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${otlpEndpoint}/v1/metrics`,
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
          ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
          : {},
      }),
      exportIntervalMillis:
        parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 30000,
    });
  }

  console.log('[OpenTelemetry] Using console metric exporter');
  return new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
    exportIntervalMillis: 30000,
  });
};

// Enhanced resource configuration for Cartrita
const enhancedResource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]:
    process.env.OTEL_SERVICE_NAME || 'cartrita-advanced-2025-mcp',
  [SemanticResourceAttributes.SERVICE_VERSION]:
    process.env.OTEL_SERVICE_VERSION || '2025.1.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
    process.env.NODE_ENV || 'development',
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'cartrita',
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]:
    process.env.SERVICE_INSTANCE_ID || 'cartrita-001',
  // Cartrita-specific resource attributes
  'cartrita.system.type': 'advanced-agi-orchestrator',
  'cartrita.agents.enabled': 'true',
  'cartrita.mcp.version': '2025-mcp',
  'cartrita.multi_modal.enabled': 'true',
  'cartrita.instrumentation.upstream': 'true',
});

// Initialize the enhanced SDK with upstream OpenTelemetry components
const sdk = new NodeSDK({
  resource: enhancedResource,
  traceExporter: getTraceExporter(),
  metricReader: getMetricReader(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable instrumentation that may cause issues or noise
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      // Enable key instrumentations for Cartrita
      '@opentelemetry/instrumentation-redis-4': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        requestHook: (span, request) => {
          // Add Cartrita-specific request attributes
          span.setAttributes({
            'cartrita.request.path': request.url,
            'cartrita.request.method': request.method,
            'cartrita.request.user_agent':
              request.headers['user-agent'] || 'unknown',
            'cartrita.instrumentation.type': 'automatic',
          });
        },
        responseHook: (span, response) => {
          // Add Cartrita-specific response attributes
          span.setAttributes({
            'cartrita.response.status_code': response.statusCode,
            'cartrita.response.content_length':
              response.headers['content-length'] || 0,
            'cartrita.instrumentation.enhanced': true,
          });
        },
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          span.setAttributes({
            'cartrita.http.method': request.method,
            'cartrita.http.url': request.url,
            'cartrita.upstream.instrumentation': true,
          });
        },
      },
      // Additional instrumentations for comprehensive coverage
      '@opentelemetry/instrumentation-net': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: true,
      },
    }),
  ],
});

// Start the enhanced SDK with upstream integration
sdk
  .start()
  .then(() => {
    console.log(
      '[OpenTelemetry] 🚀 Enhanced instrumentation with upstream OpenTelemetry initialized successfully'
    );
    console.log(
      '  🔍 Service:',
      process.env.OTEL_SERVICE_NAME || 'cartrita-advanced-2025-mcp'
    );
    console.log(
      '  📦 Version:',
      process.env.OTEL_SERVICE_VERSION || '2025.1.0'
    );
    console.log('  🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log(
      '  🔗 OTLP Endpoint:',
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Console output'
    );
    console.log('  🤖 Cartrita System: Advanced AGI Orchestrator');
    console.log('  📡 MCP Protocol: 2025-mcp');
    console.log('  🎭 Multi-Modal: Enabled');
    console.log('  ⚡ Upstream Integration: Active');
  })
  .catch(error => {
    console.error('[OpenTelemetry] ❌ Enhanced initialization failed:', error);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OpenTelemetry] 🔽 Shutdown successful'))
    .catch(error => console.error('[OpenTelemetry] ❌ Shutdown failed:', error))
    .finally(() => process.exit(0));
});
