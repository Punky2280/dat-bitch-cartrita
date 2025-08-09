/*
 * OpenTelemetry Instrumentation Setup
 *
 * This file must be loaded BEFORE your application code.
 * Run your app with: node --require ./instrumentation.js index.js
 */

// Require dependencies
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

// Initialize the SDK
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'cartrita-advanced-2025-mcp',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '2025-06-18',
  traceExporter: getTraceExporter(),
  metricReader: getMetricReader(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable instrumentation that may cause issues
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-redis-4': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
    }),
  ],
});

// Start the SDK
sdk
  .start()
  .then(() => {
    console.log('[OpenTelemetry] 🔍 Instrumentation initialized successfully');
    console.log(
      '  - Service:',
      process.env.OTEL_SERVICE_NAME || 'cartrita-advanced-2025-mcp'
    );
    console.log(
      '  - Version:',
      process.env.OTEL_SERVICE_VERSION || '2025-06-18'
    );
    console.log(
      '  - OTLP Endpoint:',
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not configured'
    );
  })
  .catch(error => {
    console.error('[OpenTelemetry] ❌ Initialization failed:', error);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OpenTelemetry] 🔽 Shutdown successful'))
    .catch(error => console.error('[OpenTelemetry] ❌ Shutdown failed:', error))
    .finally(() => process.exit(0));
});
