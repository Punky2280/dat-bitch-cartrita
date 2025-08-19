/**
 * Cartrita V2 - OpenTelemetry Setup
 * Comprehensive observability with traces, metrics, and logs
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { logger } from '../utils/logger.js';

const SERVICE_NAME = 'cartrita-backend-v2';
const SERVICE_VERSION = '2.0.0';

export function setupTelemetry() {
  try {
    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'cartrita',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `${SERVICE_NAME}-${Date.now()}`,
    });

    // Configure trace exporters
    const traceExporters = [];
    
    // OTLP HTTP exporter (primary)
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      traceExporters.push(new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
          Object.fromEntries(
            process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map(h => h.split('='))
          ) : {}
      }));
    }

    // Jaeger exporter (fallback)
    if (process.env.JAEGER_ENDPOINT || process.env.NODE_ENV === 'development') {
      traceExporters.push(new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      }));
    }

    // Configure metric exporters
    const metricReaders = [];
    
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      metricReaders.push(new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
            Object.fromEntries(
              process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map(h => h.split('='))
            ) : {}
        }),
        exportIntervalMillis: 30000, // 30 seconds
      }));
    }

    // Auto-instrumentations configuration
    const instrumentations = getNodeAutoInstrumentations({
      // Disable some instrumentations if needed
      '@opentelemetry/instrumentation-fs': {
        enabled: false // Can be noisy in development
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          // Add custom attributes to HTTP spans
          span.setAttributes({
            'http.client.ip': request.socket?.remoteAddress,
            'http.user_agent': request.headers?.['user-agent']
          });
        }
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true
      }
    });

    // Initialize Node SDK
    const sdk = new NodeSDK({
      resource,
      traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      instrumentations: [instrumentations]
    });

    // Start the SDK
    sdk.start();

    logger.info('✅ OpenTelemetry initialized successfully', {
      serviceName: SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      environment: process.env.NODE_ENV,
      traceExporters: traceExporters.length,
      metricReaders: metricReaders.length,
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      jaegerEndpoint: process.env.JAEGER_ENDPOINT
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => logger.info('OpenTelemetry terminated'))
        .catch((error) => logger.error('Error terminating OpenTelemetry', error))
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (error) {
    logger.error('❌ Failed to initialize OpenTelemetry', {
      error: error.message,
      stack: error.stack
    });
    // Don't fail startup due to telemetry issues
    return null;
  }
}