/**
 * @fileoverview Structured Logging Utility for MCP
 * Uses Pino for high-performance structured logging with OpenTelemetry integration
 */

import pino, { Logger as PinoLogger } from 'pino';
import { trace, context } from '@opentelemetry/api';

export interface LogContext {
  [key: string]: any;
}

export interface LoggerOptions {
  level?: string;
  name?: string;
  enableTracing?: boolean;
  redact?: string[];
  formatters?: pino.Formatters;
}

/**
 * Structured logger wrapper with OpenTelemetry integration
 */
export class Logger {
  private readonly pino: PinoLogger;
  private readonly enableTracing: boolean;

  private constructor(options: LoggerOptions = {}) {
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
  static create(
    name: string,
    options: Omit<LoggerOptions, 'name'> = {}
  ): Logger {
    return new Logger({ ...options, name });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger['pino'] = this.pino.child(context);
    childLogger['enableTracing'] = this.enableTracing;
    return childLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context: LogContext = {}): void {
    this.log('debug', message, null, context);
  }

  /**
   * Log info message
   */
  info(message: string, context: LogContext = {}): void {
    this.log('info', message, null, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, null, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | null, context: LogContext = {}): void {
    this.log('error', message, error, context);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error | null, context: LogContext = {}): void {
    this.log('fatal', message, error, context);
  }

  /**
   * Log trace message
   */
  trace(message: string, context: LogContext = {}): void {
    this.log('trace', message, null, context);
  }

  /**
   * Internal logging method with OpenTelemetry integration
   */
  private log(
    level: string,
    message: string,
    error: Error | null = null,
    context: LogContext = {}
  ): void {
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
      this.pino[level as keyof PinoLogger](enrichedContext, error, message);
    } else {
      this.pino[level as keyof PinoLogger](enrichedContext, message);
    }
  }

  /**
   * Set log level
   */
  setLevel(level: string): void {
    this.pino.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.pino.level;
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: string): boolean {
    return this.pino.isLevelEnabled(level);
  }

  /**
   * Create a timer for performance logging
   */
  createTimer(name: string, context: LogContext = {}) {
    const startTime = Date.now();
    const startHrTime = process.hrtime.bigint();

    return {
      end: (additionalContext: LogContext = {}) => {
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
  async logExecution<T>(
    name: string,
    fn: () => Promise<T>,
    context: LogContext = {}
  ): Promise<T> {
    const timer = this.createTimer(name, context);

    try {
      this.debug(`Starting execution: ${name}`, context);
      const result = await fn();
      timer.end({ success: true });
      return result;
    } catch (error) {
      timer.end({ success: false, error: (error as Error).message });
      this.error(`Execution failed: ${name}`, error as Error, context);
      throw error;
    }
  }

  /**
   * Create a correlation ID for request tracking
   */
  withCorrelationId(correlationId: string): Logger {
    return this.child({ correlationId });
  }

  /**
   * Log structured event
   */
  event(eventName: string, eventData: LogContext = {}): void {
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
  metric(metricName: string, value: number, labels: LogContext = {}): void {
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
  audit(
    action: string,
    resource: string,
    actor: string,
    context: LogContext = {}
  ): void {
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
  debug: (message: string, context?: LogContext) =>
    defaultLogger.debug(message, context),
  info: (message: string, context?: LogContext) =>
    defaultLogger.info(message, context),
  warn: (message: string, context?: LogContext) =>
    defaultLogger.warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) =>
    defaultLogger.error(message, error, context),
  fatal: (message: string, error?: Error, context?: LogContext) =>
    defaultLogger.fatal(message, error, context),
  trace: (message: string, context?: LogContext) =>
    defaultLogger.trace(message, context),
  event: (eventName: string, eventData?: LogContext) =>
    defaultLogger.event(eventName, eventData),
  metric: (metricName: string, value: number, labels?: LogContext) =>
    defaultLogger.metric(metricName, value, labels),
  audit: (
    action: string,
    resource: string,
    actor: string,
    context?: LogContext
  ) => defaultLogger.audit(action, resource, actor, context),
};

export default Logger;
