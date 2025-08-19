/**
 * @fileoverview In-Process Transport for MCP
 * High-performance EventEmitter-based transport for same-process communication
 * Includes OpenTelemetry context propagation and Zod validation
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { trace, context, propagation, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { MCPMessage, MCPContext, TaskRequest, TaskResponse, MessageTypes } from '../schema/mcp-types.js';
import { MCPValidator } from '../schema/mcp-types.js';
import { Logger } from '../utils/logger.js';
import { MCPMetrics } from '../otel/metrics.js';

export interface TransportOptions {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  maxQueueSize?: number;
  enableDeduplication?: boolean;
  deduplicationWindow?: number;
}

export interface MessageHandler {
  (message: MCPMessage): Promise<void> | void;
}

/**
 * In-process transport using EventEmitter for same-process agent communication
 * Provides highest performance with full observability and validation
 */
export class MCPInProcessTransport extends EventEmitter {
  private static instance: MCPInProcessTransport | null = null;
  private readonly logger: Logger;
  private readonly metrics: MCPMetrics;
  private readonly options: Required<TransportOptions>;
  private readonly messageQueue: Map<string, MCPMessage[]> = new Map();
  private readonly messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private readonly deduplicationCache: Map<string, number> = new Map();
  private readonly tracer = trace.getTracer('mcp-in-process-transport');
  private isShuttingDown = false;

  private constructor(options: TransportOptions = {}) {
    super();
    this.logger = Logger.create('MCPInProcessTransport');
    this.metrics = new MCPMetrics();
    this.options = {
      enableValidation: options.enableValidation ?? true,
      enableMetrics: options.enableMetrics ?? true,
      maxQueueSize: options.maxQueueSize ?? 1000,
      enableDeduplication: options.enableDeduplication ?? true,
      deduplicationWindow: options.deduplicationWindow ?? 60000, // 1 minute
    };

    this.setupCleanupInterval();
    this.logger.info('In-process transport initialized', { options: this.options });
  }

  /**
   * Get singleton instance of the transport
   */
  static getInstance(options?: TransportOptions): MCPInProcessTransport {
    if (!MCPInProcessTransport.instance) {
      MCPInProcessTransport.instance = new MCPInProcessTransport(options);
    }
    return MCPInProcessTransport.instance;
  }

  /**
   * Send a message to a specific agent or service
   */
  async sendMessage(message: MCPMessage): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Transport is shutting down');
    }

    const span = this.tracer.startSpan('mcp.transport.send', {
      kind: SpanKind.CLIENT,
      attributes: {
        'mcp.transport.type': 'in-process',
        'mcp.message.id': message.id,
        'mcp.message.type': message.messageType,
        'mcp.message.sender': message.sender,
        'mcp.message.recipient': message.recipient,
      },
    });

    try {
      // Validate message if enabled
      if (this.options.enableValidation) {
        const validation = MCPValidator.safeValidate(MCPValidator.validateMessage, message);
        if (!validation.success) {
          throw new Error(`Message validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Check for duplicates if enabled
      if (this.options.enableDeduplication && this.isDuplicate(message)) {
        this.logger.warn('Duplicate message detected, skipping', { messageId: message.id });
        this.metrics.recordMessageDropped('duplicate');
        return;
      }

      // Propagate OpenTelemetry context
      const propagatedMessage = this.propagateContext(message);

      // Queue management
      await this.enqueueMessage(propagatedMessage);

      // Emit to handlers
      await this.deliverMessage(propagatedMessage);

      // Record metrics
      if (this.options.enableMetrics) {
        this.metrics.recordMessageSent(
          propagatedMessage.messageType,
          propagatedMessage.sender,
          propagatedMessage.recipient
        );
      }

      span.setStatus({ code: SpanStatusCode.OK });
      this.logger.debug('Message sent successfully', {
        messageId: message.id,
        messageType: message.messageType,
        recipient: message.recipient,
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      this.logger.error('Failed to send message', error as Error, {
        messageId: message.id,
        messageType: message.messageType,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Register a message handler for a specific agent or message type
   */
  registerHandler(agentId: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, new Set());
    }
    this.messageHandlers.get(agentId)!.add(handler);
    this.logger.debug('Message handler registered', { agentId });
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(agentId: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(agentId);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(agentId);
      }
    }
    this.logger.debug('Message handler unregistered', { agentId });
  }

  /**
   * Send a task request and wait for response
   */
  async sendTaskRequest(
    request: TaskRequest,
    recipientId: string,
    senderId: string,
    timeoutMs = 30000
  ): Promise<TaskResponse> {
    const requestMessage: MCPMessage = {
      id: uuidv4(),
      correlationId: request.taskId,
      traceId: trace.getActiveSpan()?.spanContext().traceId || uuidv4(),
      spanId: trace.getActiveSpan()?.spanContext().spanId || uuidv4(),
      sender: senderId,
      recipient: recipientId,
      messageType: MessageTypes.TASK_REQUEST,
      payload: request,
      tags: [],
      context: this.createContext(request.taskId, timeoutMs),
      delivery: {
        guarantee: 'AT_LEAST_ONCE' as const,
        retryCount: 3,
        retryDelayMs: 1000,
        requireAck: true,
        priority: request.priority || 5,
      },
      createdAt: new Date(),
      permissions: [],
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.unregisterHandler(senderId, responseHandler);
        reject(new Error(`Task request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const responseHandler = (message: MCPMessage) => {
        if (
          message.messageType === MessageTypes.TASK_RESPONSE &&
          message.correlationId === request.taskId
        ) {
          clearTimeout(timeoutHandle);
          this.unregisterHandler(senderId, responseHandler);
          resolve(message.payload as TaskResponse);
        }
      };

      this.registerHandler(senderId, responseHandler);
      this.sendMessage(requestMessage).catch(reject);
    });
  }

  /**
   * Get queue depth for monitoring
   */
  getQueueDepth(agentId?: string): number {
    if (agentId) {
      return this.messageQueue.get(agentId)?.length || 0;
    }
    return Array.from(this.messageQueue.values()).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Get transport statistics
   */
  getStats() {
    return {
      totalHandlers: Array.from(this.messageHandlers.values()).reduce((total, handlers) => total + handlers.size, 0),
      totalQueues: this.messageQueue.size,
      totalQueueDepth: this.getQueueDepth(),
      deduplicationCacheSize: this.deduplicationCache.size,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info('Shutting down in-process transport');

    // Process remaining messages
    const pendingMessages = this.getQueueDepth();
    if (pendingMessages > 0) {
      this.logger.info(`Processing ${pendingMessages} remaining messages`);
      await this.drainQueues();
    }

    // Clear all handlers and queues
    this.messageHandlers.clear();
    this.messageQueue.clear();
    this.deduplicationCache.clear();
    this.removeAllListeners();

    this.logger.info('In-process transport shutdown complete');
  }

  private propagateContext(message: MCPMessage): MCPMessage {
    const activeContext = context.active();
    const carrier: Record<string, string> = {};
    propagation.inject(activeContext, carrier);

    return {
      ...message,
      context: {
        ...message.context,
        baggage: { ...message.context.baggage, ...carrier },
      },
    };
  }

  private createContext(requestId: string, timeoutMs: number): MCPContext {
    const span = trace.getActiveSpan();
    return {
      traceId: span?.spanContext().traceId || uuidv4(),
      spanId: span?.spanContext().spanId || uuidv4(),
      baggage: {},
      requestId,
      timeoutMs,
      metadata: {},
    };
  }

  private async enqueueMessage(message: MCPMessage): Promise<void> {
    const queue = this.messageQueue.get(message.recipient) || [];
    
    // Check queue size limit
    if (queue.length >= this.options.maxQueueSize) {
      this.metrics.recordMessageDropped('queue_full');
      throw new Error(`Queue full for recipient: ${message.recipient}`);
    }

    queue.push(message);
    this.messageQueue.set(message.recipient, queue);
  }

  private async deliverMessage(message: MCPMessage): Promise<void> {
    const handlers = this.messageHandlers.get(message.recipient);
    if (!handlers || handlers.size === 0) {
      this.logger.warn('No handlers registered for recipient', { recipient: message.recipient });
      this.metrics.recordMessageDropped('no_handler');
      return;
    }

    // Extract OpenTelemetry context from message
    const extractedContext = propagation.extract(context.active(), message.context.baggage || {});

    await context.with(extractedContext, async () => {
      const deliveryPromises = Array.from(handlers).map(async handler => {
        try {
          await handler(message);
        } catch (error) {
          this.logger.error('Message handler failed', error as Error, {
            messageId: message.id,
            recipient: message.recipient,
          });
          this.metrics.recordMessageError(message.messageType, (error as Error).message);
        }
      });

      await Promise.allSettled(deliveryPromises);
    });

    // Remove message from queue after delivery
    const queue = this.messageQueue.get(message.recipient);
    if (queue) {
      const index = queue.findIndex(m => m.id === message.id);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    }
  }

  private isDuplicate(message: MCPMessage): boolean {
    const now = Date.now();
    const lastSeen = this.deduplicationCache.get(message.id);
    
    if (lastSeen && now - lastSeen < this.options.deduplicationWindow) {
      return true;
    }
    
    this.deduplicationCache.set(message.id, now);
    return false;
  }

  private setupCleanupInterval(): void {
    // Clean up old deduplication entries every minute
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, timestamp] of this.deduplicationCache.entries()) {
        if (now - timestamp > this.options.deduplicationWindow) {
          expiredKeys.push(key);
        }
      }
      
      for (const key of expiredKeys) {
        this.deduplicationCache.delete(key);
      }
      
      if (expiredKeys.length > 0) {
        this.logger.debug('Cleaned up expired deduplication entries', { count: expiredKeys.length });
      }
    }, 60000);
  }

  private async drainQueues(): Promise<void> {
    const allMessages: MCPMessage[] = [];
    for (const queue of this.messageQueue.values()) {
      allMessages.push(...queue);
    }

    await Promise.allSettled(
      allMessages.map(message => this.deliverMessage(message))
    );
  }
}

/**
 * Transport factory function for easy instantiation
 */
export function createInProcessTransport(options?: TransportOptions): MCPInProcessTransport {
  return MCPInProcessTransport.getInstance(options);
}

export default MCPInProcessTransport;