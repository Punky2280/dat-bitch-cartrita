/**
 * @fileoverview Structured Logging Utility for MCP
 * Uses Pino for high-performance structured logging with OpenTelemetry integration
 */
import pino from 'pino';
import { trace } from '@opentelemetry/api';
/**
 * Structured logger wrapper with OpenTelemetry integration
 */
export class Logger {
  pino;
  enableTracing;
  constructor(options = {}) {
    this.enableTracing = options.enableTracing ?? true;
    this.pino = pino({
      name: options.name || 'mcp-core',
      level: options.level || process.env.LOG_LEVEL || 'info',
      redact: options.redact || ['password', 'token', 'key', 'secret'],
      formatters: {
        level: label => ({ level: label.toUpperCase() }),
        bindings: bindings => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
          name: bindings.name,
        }),
        ...options.formatters,
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      messageKey: 'message',
      errorKey: 'error',
    });
  }
  /**
   * Create a new logger instance
   */
  static create(name, options = {}) {
    return new Logger({ ...options, name });
  }
  /**
   * Create a child logger with additional context
   */
  child(context) {
    const childLogger = new Logger();
    childLogger['pino'] = this.pino.child(context);
    childLogger['enableTracing'] = this.enableTracing;
    return childLogger;
  }
  /**
   * Log debug message
   */
  debug(message, context = {}) {
    this.log('debug', message, null, context);
  }
  /**
   * Log info message
   */
  info(message, context = {}) {
    this.log('info', message, null, context);
  }
  /**
   * Log warning message
   */
  warn(message, context = {}) {
    this.log('warn', message, null, context);
  }
  /**
   * Log error message
   */
  error(message, error, context = {}) {
    this.log('error', message, error, context);
  }
  /**
   * Log fatal message
   */
  fatal(message, error, context = {}) {
    this.log('fatal', message, error, context);
  }
  /**
   * Log trace message
   */
  trace(message, context = {}) {
    this.log('trace', message, null, context);
  }
  /**
   * Internal logging method with OpenTelemetry integration
   */
  log(level, message, error = null, context = {}) {
    const enrichedContext = { ...context };
    // Add OpenTelemetry context if enabled
    if (this.enableTracing) {
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        enrichedContext.traceId = spanContext.traceId;
        enrichedContext.spanId = spanContext.spanId;
        // Add baggage from context
        const baggage = context.active().getValue('baggage');
        if (baggage) {
          enrichedContext.baggage = baggage;
        }
      }
    }
    // Add timestamp
    enrichedContext.timestamp = new Date().toISOString();
    // Log with appropriate level
    if (error) {
      this.pino[level](enrichedContext, error, message);
    } else {
      this.pino[level](enrichedContext, message);
    }
  }
  /**
   * Set log level
   */
  setLevel(level) {
    this.pino.level = level;
  }
  /**
   * Get current log level
   */
  getLevel() {
    return this.pino.level;
  }
  /**
   * Check if level is enabled
   */
  isLevelEnabled(level) {
    return this.pino.isLevelEnabled(level);
  }
  /**
   * Create a timer for performance logging
   */
  createTimer(name, context = {}) {
    const startTime = Date.now();
    const startHrTime = process.hrtime.bigint();
    return {
      end: (additionalContext = {}) => {
        const endTime = Date.now();
        const endHrTime = process.hrtime.bigint();
        const durationMs = endTime - startTime;
        const durationNs = Number(endHrTime - startHrTime);
        this.info(`Timer '${name}' completed`, {
          ...context,
          ...additionalContext,
          timer: {
            name,
            durationMs,
            durationNs,
            startTime,
            endTime,
          },
        });
        return { durationMs, durationNs };
      },
    };
  }
  /**
   * Log method execution with timing
   */
  async logExecution(name, fn, context = {}) {
    const timer = this.createTimer(name, context);
    try {
      this.debug(`Starting execution: ${name}`, context);
      const result = await fn();
      timer.end({ success: true });
      return result;
    } catch (error) {
      timer.end({ success: false, error: error.message });
      this.error(`Execution failed: ${name}`, error, context);
      throw error;
    }
  }
  /**
   * Create a correlation ID for request tracking
   */
  withCorrelationId(correlationId) {
    return this.child({ correlationId });
  }
  /**
   * Log structured event
   */
  event(eventName, eventData = {}) {
    this.info(`Event: ${eventName}`, {
      event: {
        name: eventName,
        data: eventData,
        timestamp: new Date().toISOString(),
      },
    });
  }
  /**
   * Log metric data point
   */
  metric(metricName, value, labels = {}) {
    this.debug(`Metric: ${metricName}`, {
      metric: {
        name: metricName,
        value,
        labels,
        timestamp: new Date().toISOString(),
      },
    });
  }
  /**
   * Log audit event
   */
  audit(action, resource, actor, context = {}) {
    this.info(`Audit: ${action}`, {
      audit: {
        action,
        resource,
        actor,
        timestamp: new Date().toISOString(),
        ...context,
      },
    });
  }
}
// Default logger instance
export const defaultLogger = Logger.create('mcp-default');
// Convenience functions using default logger
export const log = {
  debug: (message, context) => defaultLogger.debug(message, context),
  info: (message, context) => defaultLogger.info(message, context),
  warn: (message, context) => defaultLogger.warn(message, context),
  error: (message, error, context) =>
    defaultLogger.error(message, error, context),
  fatal: (message, error, context) =>
    defaultLogger.fatal(message, error, context),
  trace: (message, context) => defaultLogger.trace(message, context),
  event: (eventName, eventData) => defaultLogger.event(eventName, eventData),
  metric: (metricName, value, labels) =>
    defaultLogger.metric(metricName, value, labels),
  audit: (action, resource, actor, context) =>
    defaultLogger.audit(action, resource, actor, context),
};
export default Logger;
