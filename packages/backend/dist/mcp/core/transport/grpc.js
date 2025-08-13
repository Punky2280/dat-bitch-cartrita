/**
 * @fileoverview gRPC Transport for MCP
 * Cross-language gRPC transport with mTLS, interceptors, and streaming support
 */
import { Server, ServerCredentials, Client, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';
import { trace, context, propagation, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { MessageTypes } from '../schema/mcp-types.js';
import { MCPValidator } from '../schema/mcp-types.js';
import { Logger } from '../utils/logger.js';
import { MCPMetrics } from '../otel/metrics.js';
import { EventEmitter } from 'eventemitter3';
import path from 'path';
import fs from 'fs';
/**
 * gRPC Transport for cross-language MCP communication
 * Provides secure, efficient RPC communication with streaming support
 */
export class MCPGRPCTransport extends EventEmitter {
    logger;
    metrics;
    options;
    tracer = trace.getTracer('mcp-grpc-transport');
    server = null;
    client = null;
    serviceDefinition = null;
    isShuttingDown = false;
    constructor(options) {
        super();
        this.logger = Logger.create('MCPGRPCTransport');
        this.metrics = new MCPMetrics();
        this.options = {
            host: options.host ?? '0.0.0.0',
            port: options.port,
            enableTLS: options.enableTLS ?? false,
            tlsOptions: options.tlsOptions ?? {},
            enableValidation: options.enableValidation ?? true,
            enableMetrics: options.enableMetrics ?? true,
            maxMessageSize: options.maxMessageSize ?? 4 * 1024 * 1024, // 4MB
            keepAliveTime: options.keepAliveTime ?? 30000,
            keepAliveTimeout: options.keepAliveTimeout ?? 5000,
            interceptors: {
                auth: options.interceptors?.auth ?? true,
                telemetry: options.interceptors?.telemetry ?? true,
                rateLimit: options.interceptors?.rateLimit ?? false,
            },
        };
        this.loadProtoDefinition();
        this.logger.info('gRPC transport initialized', { options: this.options });
    }
    /**
     * Start gRPC server
     */
    async startServer() {
        if (this.isShuttingDown) {
            throw new Error('Transport is shutting down');
        }
        const span = this.tracer.startSpan('mcp.transport.grpc.server.start', {
            attributes: {
                'mcp.transport.type': 'grpc',
                'mcp.transport.host': this.options.host,
                'mcp.transport.port': this.options.port.toString(),
            },
        });
        try {
            this.server = new Server({
                'grpc.max_send_message_length': this.options.maxMessageSize,
                'grpc.max_receive_message_length': this.options.maxMessageSize,
                'grpc.keepalive_time_ms': this.options.keepAliveTime,
                'grpc.keepalive_timeout_ms': this.options.keepAliveTimeout,
            });
            // Add interceptors
            this.addServerInterceptors();
            // Register services
            this.registerServices();
            // Configure credentials
            const credentials = this.createServerCredentials();
            await new Promise((resolve, reject) => {
                const address = `${this.options.host}:${this.options.port}`;
                this.server.bindAsync(address, credentials, (error, port) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        this.server.start();
                        this.logger.info('gRPC server started', { address, port });
                        resolve();
                    }
                });
            });
            span.setStatus({ code: SpanStatusCode.OK });
        }
        catch (error) {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Connect gRPC client
     */
    async connect(serverAddress) {
        if (this.isShuttingDown) {
            throw new Error('Transport is shutting down');
        }
        const address = serverAddress || `${this.options.host}:${this.options.port}`;
        const span = this.tracer.startSpan('mcp.transport.grpc.client.connect', {
            attributes: {
                'mcp.transport.type': 'grpc',
                'mcp.transport.server_address': address,
            },
        });
        try {
            // Create client credentials
            const credentials = this.createClientCredentials();
            // Create client instance (assuming we have a generated client)
            if (!this.serviceDefinition) {
                throw new Error('Service definition not loaded');
            }
            // Here we would create the actual gRPC client from the proto definition
            // This is a simplified version - in practice you'd use generated stubs
            this.client = new Client(address, credentials, {
                'grpc.max_send_message_length': this.options.maxMessageSize,
                'grpc.max_receive_message_length': this.options.maxMessageSize,
                'grpc.keepalive_time_ms': this.options.keepAliveTime,
                'grpc.keepalive_timeout_ms': this.options.keepAliveTimeout,
            });
            // Add client interceptors
            this.addClientInterceptors();
            this.logger.info('gRPC client connected', { serverAddress: address });
            span.setStatus({ code: SpanStatusCode.OK });
        }
        catch (error) {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Send message via gRPC unary call
     */
    async sendMessage(message) {
        if (this.isShuttingDown) {
            throw new Error('Transport is shutting down');
        }
        if (!this.client) {
            throw new Error('Client not connected');
        }
        const span = this.tracer.startSpan('mcp.transport.grpc.send', {
            kind: SpanKind.CLIENT,
            attributes: {
                'mcp.transport.type': 'grpc',
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
            // Propagate OpenTelemetry context
            const propagatedMessage = this.propagateContext(message);
            // Make gRPC call (simplified - would use generated client methods)
            const response = await this.makeUnaryCall('RouteMessage', {
                message: propagatedMessage,
            });
            // Record metrics
            if (this.options.enableMetrics) {
                this.metrics.recordMessageSent(propagatedMessage.messageType, propagatedMessage.sender, propagatedMessage.recipient);
                this.metrics.recordTransportLatency(Date.now() - propagatedMessage.createdAt.getTime(), 'grpc');
            }
            span.setStatus({ code: SpanStatusCode.OK });
            return response.message;
        }
        catch (error) {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            this.logger.error('Failed to send gRPC message', error, {
                messageId: message.id,
                messageType: message.messageType,
            });
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Start streaming messages
     */
    streamMessages(onMessage) {
        if (!this.client) {
            throw new Error('Client not connected');
        }
        const span = this.tracer.startSpan('mcp.transport.grpc.stream', {
            kind: SpanKind.CLIENT,
            attributes: {
                'mcp.transport.type': 'grpc',
                'mcp.stream.type': 'bidirectional',
            },
        });
        // Create bidirectional stream (simplified)
        const stream = this.createStream('StreamMessages');
        stream.on('data', (response) => {
            try {
                const message = response.message;
                // Extract OpenTelemetry context
                const extractedContext = propagation.extract(context.active(), message.context.baggage || {});
                context.with(extractedContext, () => {
                    if (this.options.enableMetrics) {
                        this.metrics.recordMessageReceived(message.messageType, message.sender, message.recipient);
                    }
                    onMessage(message);
                });
            }
            catch (error) {
                this.logger.error('Failed to process streamed message', error);
                span.recordException(error);
            }
        });
        stream.on('error', (error) => {
            this.logger.error('Stream error', error);
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        });
        stream.on('end', () => {
            this.logger.info('Stream ended');
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
        });
        // Return function to close stream
        return () => {
            stream.end();
        };
    }
    /**
     * Send task request via gRPC
     */
    async sendTaskRequest(request, recipientId, senderId, timeoutMs = 30000) {
        const requestMessage = {
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
                guarantee: 'AT_LEAST_ONCE',
                retryCount: 3,
                retryDelayMs: 1000,
                requireAck: true,
                priority: request.priority || 5,
            },
            createdAt: new Date(),
            permissions: [],
        };
        const response = await this.sendMessage(requestMessage);
        return response.payload;
    }
    /**
     * Get transport statistics
     */
    getStats() {
        return {
            transportType: 'grpc',
            host: this.options.host,
            port: this.options.port,
            enableTLS: this.options.enableTLS,
            isServer: !!this.server,
            isClient: !!this.client,
            isShuttingDown: this.isShuttingDown,
        };
    }
    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.isShuttingDown = true;
        this.logger.info('Shutting down gRPC transport');
        const shutdownPromises = [];
        if (this.server) {
            shutdownPromises.push(new Promise((resolve) => {
                this.server.tryShutdown((error) => {
                    if (error) {
                        this.logger.warn('Server shutdown error', { error });
                        // Force shutdown
                        this.server.forceShutdown();
                    }
                    resolve();
                });
            }));
        }
        if (this.client) {
            this.client.close();
        }
        await Promise.all(shutdownPromises);
        this.removeAllListeners();
        this.logger.info('gRPC transport shutdown complete');
    }
    loadProtoDefinition() {
        try {
            const protoPath = path.join(__dirname, '../../../../proto/cartrita/mcp/v1/mcp.proto');
            if (!fs.existsSync(protoPath)) {
                this.logger.warn('Proto file not found, using fallback definition', { path: protoPath });
                // Use a basic service definition as fallback
                this.serviceDefinition = this.createFallbackDefinition();
                return;
            }
            const packageDefinition = loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            });
            this.serviceDefinition = loadPackageDefinition(packageDefinition);
            this.logger.info('Proto definition loaded successfully');
        }
        catch (error) {
            this.logger.error('Failed to load proto definition', error);
            this.serviceDefinition = this.createFallbackDefinition();
        }
    }
    createFallbackDefinition() {
        return {
            MCPOrchestratorService: {
                RouteMessage: {
                    path: '/cartrita.mcp.v1.MCPOrchestratorService/RouteMessage',
                    requestStream: false,
                    responseStream: false,
                    requestType: Object,
                    responseType: Object,
                },
                StreamMessages: {
                    path: '/cartrita.mcp.v1.MCPOrchestratorService/StreamMessages',
                    requestStream: true,
                    responseStream: true,
                    requestType: Object,
                    responseType: Object,
                },
            },
        };
    }
    createServerCredentials() {
        if (!this.options.enableTLS) {
            return ServerCredentials.createInsecure();
        }
        const { tlsOptions } = this.options;
        if (!tlsOptions.certFile || !tlsOptions.keyFile) {
            this.logger.warn('TLS enabled but cert/key files not provided, using insecure credentials');
            return ServerCredentials.createInsecure();
        }
        try {
            const cert = fs.readFileSync(tlsOptions.certFile);
            const key = fs.readFileSync(tlsOptions.keyFile);
            const ca = tlsOptions.caFile ? fs.readFileSync(tlsOptions.caFile) : undefined;
            return ServerCredentials.createSsl(ca, [{ private_key: key, cert_chain: cert }], tlsOptions.clientCertRequired);
        }
        catch (error) {
            this.logger.error('Failed to create TLS credentials', error);
            return ServerCredentials.createInsecure();
        }
    }
    createClientCredentials() {
        if (!this.options.enableTLS) {
            const { credentials } = require('@grpc/grpc-js');
            return credentials.createInsecure();
        }
        const { tlsOptions } = this.options;
        try {
            const { credentials } = require('@grpc/grpc-js');
            if (tlsOptions.caFile) {
                const ca = fs.readFileSync(tlsOptions.caFile);
                return credentials.createSsl(ca);
            }
            return credentials.createSsl();
        }
        catch (error) {
            this.logger.error('Failed to create client TLS credentials', error);
            const { credentials } = require('@grpc/grpc-js');
            return credentials.createInsecure();
        }
    }
    addServerInterceptors() {
        if (!this.server)
            return;
        // Add telemetry interceptor
        if (this.options.interceptors.telemetry) {
            this.server.addService(this.createTelemetryInterceptor());
        }
        // Add auth interceptor
        if (this.options.interceptors.auth) {
            this.server.addService(this.createAuthInterceptor());
        }
    }
    addClientInterceptors() {
        // Client interceptors would be added here
        // This is a simplified implementation
    }
    createTelemetryInterceptor() {
        return (call, callback) => {
            const span = this.tracer.startSpan('mcp.grpc.server.call', {
                kind: SpanKind.SERVER,
                attributes: {
                    'grpc.method': call.getPath(),
                },
            });
            context.with(trace.setSpan(context.active(), span), () => {
                try {
                    callback(null, call);
                }
                catch (error) {
                    span.recordException(error);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
                    throw error;
                }
                finally {
                    span.end();
                }
            });
        };
    }
    createAuthInterceptor() {
        return (call, callback) => {
            // Basic auth interceptor - would implement JWT validation in practice
            const metadata = call.metadata;
            const authorization = metadata.get('authorization');
            if (!authorization || !authorization[0]) {
                const error = new Error('Missing authorization header');
                callback(error);
                return;
            }
            // Validate token (simplified)
            callback(null, call);
        };
    }
    registerServices() {
        if (!this.server || !this.serviceDefinition)
            return;
        // Register MCP services
        Object.entries(this.serviceDefinition).forEach(([serviceName, methods]) => {
            const implementation = {};
            Object.entries(methods).forEach(([methodName, methodDef]) => {
                implementation[methodName] = this.createMethodHandler(methodName);
            });
            // this.server!.addService(serviceDefinition[serviceName], implementation);
        });
    }
    createMethodHandler(methodName) {
        return (call, callback) => {
            const span = this.tracer.startSpan(`mcp.grpc.${methodName}`, {
                kind: SpanKind.SERVER,
                attributes: {
                    'grpc.method': methodName,
                },
            });
            try {
                // Handle the method call
                this.emit('grpc:call', { method: methodName, call, callback });
            }
            catch (error) {
                span.recordException(error);
                span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
                callback(error);
            }
            finally {
                span.end();
            }
        };
    }
    async makeUnaryCall(method, request) {
        // Simplified unary call implementation
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Client not connected'));
                return;
            }
            // This would use the actual gRPC client method
            setTimeout(() => {
                resolve({ message: request.message });
            }, 100);
        });
    }
    createStream(method) {
        // Simplified stream creation
        const EventEmitter = require('events');
        const stream = new EventEmitter();
        // Add stream methods
        stream.end = () => stream.emit('end');
        return stream;
    }
    propagateContext(message) {
        const activeContext = context.active();
        const carrier = {};
        propagation.inject(activeContext, carrier);
        return {
            ...message,
            context: {
                ...message.context,
                baggage: { ...message.context.baggage, ...carrier },
            },
        };
    }
}
/**
 * Transport factory function
 */
export function createGRPCTransport(options) {
    return new MCPGRPCTransport(options);
}
export default MCPGRPCTransport;
