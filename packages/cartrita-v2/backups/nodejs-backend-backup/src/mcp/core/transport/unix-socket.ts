/**
 * @fileoverview Unix Domain Socket Transport for MCP
 * High-performance IPC transport with MessagePack framing and backpressure control
 */

import { createServer, createConnection, Server, Socket } from 'net';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { pack, unpack } from 'msgpackr';
import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  SpanKind,
} from '@opentelemetry/api';
import {
  MCPMessage,
  TaskRequest,
  TaskResponse,
  MessageTypes,
} from '../schema/mcp-types.js';
import { MCPValidator } from '../schema/mcp-types.js';
import { Logger } from '../utils/logger.js';
import { MCPMetrics } from '../otel/metrics.js';

export interface UnixSocketTransportOptions {
  socketPath: string;
  enableValidation?: boolean;
  enableMetrics?: boolean;
  maxFrameSize?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  enableBackpressure?: boolean;
  maxQueueSize?: number;
}

export interface SocketConnection {
  id: string;
  socket: Socket;
  isAlive: boolean;
  lastPing: number;
  messageQueue: MCPMessage[];
  bytesReceived: number;
  bytesSent: number;
}

/**
 * Unix Domain Socket transport for high-performance IPC between MCP components
 * Uses length-prefixed MessagePack frames with heartbeat and backpressure control
 */
export class MCPUnixSocketTransport extends EventEmitter {
  private readonly logger: Logger;
  private readonly metrics: MCPMetrics;
  private readonly options: Required<UnixSocketTransportOptions>;
  private readonly tracer = trace.getTracer('mcp-unix-socket-transport');

  private server: Server | null = null;
  private clientSocket: Socket | null = null;
  private connections = new Map<string, SocketConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isServer = false;
  private isShuttingDown = false;

  constructor(options: UnixSocketTransportOptions) {
    super();
    this.logger = Logger.create('MCPUnixSocketTransport');
    this.metrics = new MCPMetrics();
    this.options = {
      enableValidation: options.enableValidation ?? true,
      enableMetrics: options.enableMetrics ?? true,
      maxFrameSize: options.maxFrameSize ?? 10 * 1024 * 1024, // 10MB
      heartbeatInterval: options.heartbeatInterval ?? 30000, // 30 seconds
      connectionTimeout: options.connectionTimeout ?? 10000, // 10 seconds
      enableBackpressure: options.enableBackpressure ?? true,
      maxQueueSize: options.maxQueueSize ?? 1000,
      ...options,
    };

    this.logger.info('Unix socket transport initialized', {
      socketPath: this.options.socketPath,
      options: this.options,
    });
  }

  /**
   * Start as server (listener)
   */
  async startServer(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Transport is shutting down');
    }

    const span = this.tracer.startSpan('mcp.transport.server.start', {
      attributes: {
        'mcp.transport.type': 'unix-socket',
        'mcp.transport.socket_path': this.options.socketPath,
      },
    });

    try {
      this.server = createServer();
      this.isServer = true;

      this.server.on('connection', socket => this.handleConnection(socket));
      this.server.on('error', error => this.handleServerError(error));
      this.server.on('close', () => this.logger.info('Server closed'));

      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.options.socketPath, () => {
          this.logger.info('Server listening', {
            socketPath: this.options.socketPath,
          });
          resolve();
        });

        this.server!.on('error', reject);
      });

      this.startHeartbeat();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Connect as client
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Transport is shutting down');
    }

    const span = this.tracer.startSpan('mcp.transport.client.connect', {
      attributes: {
        'mcp.transport.type': 'unix-socket',
        'mcp.transport.socket_path': this.options.socketPath,
      },
    });

    try {
      this.clientSocket = createConnection(this.options.socketPath);
      this.isServer = false;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Connection timeout after ${this.options.connectionTimeout}ms`
            )
          );
        }, this.options.connectionTimeout);

        this.clientSocket!.on('connect', () => {
          clearTimeout(timeout);
          this.logger.info('Connected to server', {
            socketPath: this.options.socketPath,
          });
          resolve();
        });

        this.clientSocket!.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.handleConnection(this.clientSocket, 'server');
      this.startHeartbeat();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Send message to specific connection or broadcast
   */
  async sendMessage(message: MCPMessage, connectionId?: string): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Transport is shutting down');
    }

    const span = this.tracer.startSpan('mcp.transport.send', {
      kind: SpanKind.CLIENT,
      attributes: {
        'mcp.transport.type': 'unix-socket',
        'mcp.message.id': message.id,
        'mcp.message.type': message.messageType,
        'mcp.message.sender': message.sender,
        'mcp.message.recipient': message.recipient,
      },
    });

    try {
      // Validate message if enabled
      if (this.options.enableValidation) {
        const validation = MCPValidator.safeValidate(
          MCPValidator.validateMessage,
          message
        );
        if (!validation.success) {
          throw new Error(
            `Message validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      // Propagate OpenTelemetry context
      const propagatedMessage = this.propagateContext(message);

      // Serialize message
      const messageBuffer = this.serializeMessage(propagatedMessage);

      // Send to specific connection or broadcast
      if (connectionId) {
        await this.sendToConnection(connectionId, messageBuffer);
      } else {
        await this.broadcast(messageBuffer);
      }

      // Record metrics
      if (this.options.enableMetrics) {
        this.metrics.recordMessageSent(
          propagatedMessage.messageType,
          propagatedMessage.sender,
          propagatedMessage.recipient
        );
        this.metrics.recordTransportBytesTransferred(
          messageBuffer.length,
          'unix-socket',
          'sent'
        );
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
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
   * Send task request and wait for response
   */
  async sendTaskRequest(
    request: TaskRequest,
    recipientId: string,
    senderId: string,
    timeoutMs = 30000,
    connectionId?: string
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
      context: {
        traceId: trace.getActiveSpan()?.spanContext().traceId || uuidv4(),
        spanId: trace.getActiveSpan()?.spanContext().spanId || uuidv4(),
        baggage: {},
        requestId: request.taskId,
        timeoutMs,
        metadata: {},
      },
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
        this.off('message', responseHandler);
        reject(new Error(`Task request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const responseHandler = (receivedMessage: MCPMessage) => {
        if (
          receivedMessage.messageType === MessageTypes.TASK_RESPONSE &&
          receivedMessage.correlationId === request.taskId
        ) {
          clearTimeout(timeoutHandle);
          this.off('message', responseHandler);
          resolve(receivedMessage.payload as TaskResponse);
        }
      };

      this.on('message', responseHandler);
      this.sendMessage(requestMessage, connectionId).catch(reject);
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(connectionId?: string): any {
    if (connectionId) {
      const conn = this.connections.get(connectionId);
      if (!conn) return null;

      return {
        id: conn.id,
        isAlive: conn.isAlive,
        lastPing: conn.lastPing,
        queueSize: conn.messageQueue.length,
        bytesReceived: conn.bytesReceived,
        bytesSent: conn.bytesSent,
      };
    }

    return {
      totalConnections: this.connections.size,
      isServer: this.isServer,
      socketPath: this.options.socketPath,
      connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
        id,
        isAlive: conn.isAlive,
        lastPing: conn.lastPing,
        queueSize: conn.messageQueue.length,
        bytesReceived: conn.bytesReceived,
        bytesSent: conn.bytesSent,
      })),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info('Shutting down Unix socket transport');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const [id, conn] of this.connections) {
      try {
        conn.socket.end();
        conn.socket.destroy();
      } catch (error) {
        this.logger.warn('Error closing connection', {
          connectionId: id,
          error,
        });
      }
    }
    this.connections.clear();

    // Close server or client socket
    if (this.server) {
      await new Promise<void>(resolve => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    if (this.clientSocket) {
      this.clientSocket.end();
      this.clientSocket.destroy();
      this.clientSocket = null;
    }

    this.removeAllListeners();
    this.logger.info('Unix socket transport shutdown complete');
  }

  private handleConnection(socket: Socket, connectionId?: string): void {
    const connId = connectionId || uuidv4();
    const connection: SocketConnection = {
      id: connId,
      socket,
      isAlive: true,
      lastPing: Date.now(),
      messageQueue: [],
      bytesReceived: 0,
      bytesSent: 0,
    };

    this.connections.set(connId, connection);
    this.logger.info('New connection established', { connectionId: connId });

    // Set up frame parsing
    let buffer = Buffer.alloc(0);

    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      connection.bytesReceived += data.length;

      // Parse frames
      while (buffer.length >= 4) {
        const frameLength = buffer.readUInt32BE(0);

        if (frameLength > this.options.maxFrameSize) {
          this.logger.error('Frame too large', {
            frameLength,
            maxFrameSize: this.options.maxFrameSize,
          });
          socket.destroy();
          return;
        }

        if (buffer.length >= frameLength + 4) {
          const frameData = buffer.slice(4, frameLength + 4);
          buffer = buffer.slice(frameLength + 4);

          try {
            const message = this.deserializeMessage(frameData);
            this.handleReceivedMessage(message, connId);
          } catch (error) {
            this.logger.error('Failed to parse message frame', error as Error);
            this.metrics.recordTransportError('unix-socket', 'parse_error');
          }
        } else {
          break; // Wait for more data
        }
      }
    });

    socket.on('close', () => {
      this.logger.info('Connection closed', { connectionId: connId });
      this.connections.delete(connId);
      this.emit('disconnect', connId);
    });

    socket.on('error', error => {
      this.logger.error('Socket error', error, { connectionId: connId });
      this.connections.delete(connId);
      this.metrics.recordTransportError('unix-socket', 'socket_error');
    });

    this.emit('connect', connId);
  }

  private handleReceivedMessage(
    message: MCPMessage,
    connectionId: string
  ): void {
    // Extract and propagate OpenTelemetry context
    const extractedContext = propagation.extract(
      context.active(),
      message.context.baggage || {}
    );

    context.with(extractedContext, () => {
      // Record metrics
      if (this.options.enableMetrics) {
        this.metrics.recordMessageReceived(
          message.messageType,
          message.sender,
          message.recipient
        );
      }

      // Handle heartbeat messages
      if (message.messageType === MessageTypes.HEARTBEAT) {
        this.handleHeartbeat(connectionId);
        return;
      }

      // Emit message event
      this.emit('message', message, connectionId);
    });
  }

  private handleHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isAlive = true;
      connection.lastPing = Date.now();
    }
  }

  private serializeMessage(message: MCPMessage): Buffer {
    try {
      const packed = pack(message);
      const lengthPrefix = Buffer.allocUnsafe(4);
      lengthPrefix.writeUInt32BE(packed.length, 0);
      return Buffer.concat([lengthPrefix, packed]);
    } catch (error) {
      throw new Error(`Failed to serialize message: ${error}`);
    }
  }

  private deserializeMessage(data: Buffer): MCPMessage {
    try {
      const unpacked = unpack(data) as MCPMessage;

      // Validate if enabled
      if (this.options.enableValidation) {
        const validation = MCPValidator.safeValidate(
          MCPValidator.validateMessage,
          unpacked
        );
        if (!validation.success) {
          throw new Error(
            `Message validation failed: ${validation.errors.join(', ')}`
          );
        }
        return validation.data;
      }

      return unpacked;
    } catch (error) {
      throw new Error(`Failed to deserialize message: ${error}`);
    }
  }

  private async sendToConnection(
    connectionId: string,
    data: Buffer
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (!connection.socket.writable) {
      throw new Error(`Connection not writable: ${connectionId}`);
    }

    // Check backpressure
    if (
      this.options.enableBackpressure &&
      connection.messageQueue.length >= this.options.maxQueueSize
    ) {
      throw new Error(`Connection queue full: ${connectionId}`);
    }

    return new Promise((resolve, reject) => {
      connection.socket.write(data, error => {
        if (error) {
          reject(error);
        } else {
          connection.bytesSent += data.length;
          resolve();
        }
      });
    });
  }

  private async broadcast(data: Buffer): Promise<void> {
    const promises = Array.from(this.connections.entries()).map(
      ([id, conn]) => {
        if (conn.socket.writable) {
          return this.sendToConnection(id, data).catch(error => {
            this.logger.warn('Broadcast failed for connection', {
              connectionId: id,
              error,
            });
          });
        }
        return Promise.resolve();
      }
    );

    await Promise.allSettled(promises);
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

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkConnectionHealth();
    }, this.options.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    const heartbeatMessage: MCPMessage = {
      id: uuidv4(),
      traceId: uuidv4(),
      spanId: uuidv4(),
      sender: this.isServer ? 'server' : 'client',
      recipient: 'all',
      messageType: MessageTypes.HEARTBEAT,
      payload: { timestamp: Date.now() },
      tags: [],
      context: {
        traceId: uuidv4(),
        spanId: uuidv4(),
        baggage: {},
        requestId: uuidv4(),
        timeoutMs: 5000,
        metadata: {},
      },
      delivery: {
        guarantee: 'AT_MOST_ONCE' as const,
        retryCount: 0,
        retryDelayMs: 0,
        requireAck: false,
        priority: 1,
      },
      createdAt: new Date(),
      permissions: [],
    };

    const data = this.serializeMessage(heartbeatMessage);
    this.broadcast(data).catch(error => {
      this.logger.warn('Heartbeat broadcast failed', { error });
    });
  }

  private checkConnectionHealth(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [id, conn] of this.connections) {
      if (now - conn.lastPing > this.options.heartbeatInterval * 2) {
        staleConnections.push(id);
      }
    }

    for (const connId of staleConnections) {
      this.logger.warn('Removing stale connection', { connectionId: connId });
      const conn = this.connections.get(connId);
      if (conn) {
        conn.socket.destroy();
        this.connections.delete(connId);
      }
    }
  }

  private handleServerError(error: Error): void {
    this.logger.error('Server error', error);
    this.metrics.recordTransportError('unix-socket', 'server_error');
    this.emit('error', error);
  }
}

/**
 * Transport factory function
 */
export function createUnixSocketTransport(
  options: UnixSocketTransportOptions
): MCPUnixSocketTransport {
  return new MCPUnixSocketTransport(options);
}

export default MCPUnixSocketTransport;
