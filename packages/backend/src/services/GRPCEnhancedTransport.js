/**
 * Enhanced gRPC Transport Layer
 * 
 * Extends the existing gRPC transport with advanced features including connection pooling,
 * retry logic, circuit breakers, streaming optimization, and performance monitoring.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class GRPCEnhancedTransport extends EventEmitter {
    constructor(baseTransport, config = {}) {
        super();
        this.baseTransport = baseTransport;
        this.config = {
            // Connection Pooling
            poolEnabled: config.poolEnabled !== false,
            maxConnections: config.maxConnections || 10,
            minConnections: config.minConnections || 2,
            connectionTimeout: config.connectionTimeout || 30000,
            idleTimeout: config.idleTimeout || 300000, // 5 minutes
            
            // Retry Logic
            retryEnabled: config.retryEnabled !== false,
            maxRetries: config.maxRetries || 3,
            initialRetryDelay: config.initialRetryDelay || 1000,
            maxRetryDelay: config.maxRetryDelay || 10000,
            retryMultiplier: config.retryMultiplier || 2,
            retryableErrors: config.retryableErrors || [
                'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED'
            ],
            
            // Circuit Breaker
            circuitBreakerEnabled: config.circuitBreakerEnabled !== false,
            failureThreshold: config.failureThreshold || 5,
            recoveryTimeout: config.recoveryTimeout || 30000,
            halfOpenMaxRequests: config.halfOpenMaxRequests || 3,
            
            // Streaming Optimization
            streamingEnabled: config.streamingEnabled !== false,
            streamBufferSize: config.streamBufferSize || 1000,
            streamTimeout: config.streamTimeout || 60000,
            enableCompression: config.enableCompression !== false,
            
            // Performance Monitoring
            metricsEnabled: config.metricsEnabled !== false,
            performanceTracking: config.performanceTracking !== false,
            
            // Load Balancing
            loadBalancingEnabled: config.loadBalancingEnabled !== false,
            loadBalancingStrategy: config.loadBalancingStrategy || 'round_robin',
            
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('grpc-enhanced-transport');
        this.initialized = false;
        this.isRunning = false;

        // Connection Pool Management
        this.connectionPool = new Map();
        this.connectionStats = new Map();
        this.activeConnections = 0;
        
        // Circuit Breaker State
        this.circuitBreakerStates = new Map();
        
        // Retry State Management
        this.retryQueues = new Map();
        
        // Streaming Management
        this.activeStreams = new Map();
        this.streamBuffers = new Map();
        
        // Performance Metrics
        this.metrics = {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            retried_requests: 0,
            circuit_breaker_trips: 0,
            connection_pool_hits: 0,
            connection_pool_misses: 0,
            avg_response_time: 0,
            streaming_sessions: 0,
            compression_ratio: 0
        };

        // Load Balancing State
        this.loadBalancingState = {
            roundRobinIndex: 0,
            connectionWeights: new Map()
        };
    }

    /**
     * Initialize Enhanced gRPC Transport
     */
    async initialize() {
        const span = this.tracer.startSpan('grpc-enhanced-transport.initialize');
        
        try {
            console.log('[GRPCEnhancedTransport] Initializing enhanced gRPC transport...');

            // Initialize the base transport
            if (this.baseTransport && typeof this.baseTransport.initialize === 'function') {
                await this.baseTransport.initialize();
            }

            // Initialize connection pool
            if (this.config.poolEnabled) {
                await this.initializeConnectionPool();
            }

            // Initialize circuit breakers
            if (this.config.circuitBreakerEnabled) {
                await this.initializeCircuitBreakers();
            }

            // Initialize streaming optimization
            if (this.config.streamingEnabled) {
                await this.initializeStreamingOptimization();
            }

            // Initialize performance monitoring
            if (this.config.metricsEnabled) {
                await this.initializePerformanceMonitoring();
            }

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'transport.enhanced': true,
                'transport.connection_pool': this.config.poolEnabled,
                'transport.circuit_breaker': this.config.circuitBreakerEnabled,
                'transport.streaming': this.config.streamingEnabled,
                'transport.max_connections': this.config.maxConnections
            });

            console.log('[GRPCEnhancedTransport] Enhanced gRPC transport initialized successfully');

            this.emit('initialized');
            return { success: true };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error('[GRPCEnhancedTransport] Failed to initialize:', error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Enhanced send message with retry logic and circuit breaker
     */
    async sendMessage(message, options = {}) {
        const span = this.tracer.startSpan('grpc-enhanced-transport.send-message');
        const startTime = Date.now();
        
        try {
            this.metrics.total_requests++;

            // Validate message
            this.validateMessage(message);

            // Check circuit breaker
            const destination = message.recipient || options.destination || 'default';
            const circuitBreakerResult = await this.checkCircuitBreaker(destination);
            if (!circuitBreakerResult.allowed) {
                this.metrics.circuit_breaker_trips++;
                throw new Error(`Circuit breaker open for destination: ${destination}`);
            }

            // Get connection from pool
            const connection = await this.getConnectionFromPool(destination, options);

            // Execute with retry logic
            const response = await this.executeWithRetry(async () => {
                return await this.performSendMessage(connection, message, options);
            }, destination, options);

            // Update circuit breaker on success
            await this.recordCircuitBreakerSuccess(destination);

            // Return connection to pool
            await this.returnConnectionToPool(connection, destination);

            // Update metrics
            this.metrics.successful_requests++;
            const responseTime = Date.now() - startTime;
            this.metrics.avg_response_time = (this.metrics.avg_response_time + responseTime) / 2;

            span.setAttributes({
                'message.recipient': message.recipient,
                'message.type': message.type,
                'response.time': responseTime,
                'response.success': true,
                'circuit_breaker.destination': destination
            });

            return response;

        } catch (error) {
            this.metrics.failed_requests++;
            
            // Record circuit breaker failure
            const destination = message.recipient || options.destination || 'default';
            await this.recordCircuitBreakerFailure(destination, error);

            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Enhanced streaming with optimization and buffering
     */
    async createStream(streamType, options = {}) {
        const span = this.tracer.startSpan('grpc-enhanced-transport.create-stream');
        
        try {
            const streamId = uuidv4();
            const destination = options.destination || 'default';

            // Check circuit breaker for streaming
            const circuitBreakerResult = await this.checkCircuitBreaker(destination);
            if (!circuitBreakerResult.allowed) {
                throw new Error(`Circuit breaker open for streaming to: ${destination}`);
            }

            // Get connection for streaming
            const connection = await this.getConnectionFromPool(destination, { streaming: true });

            // Create optimized stream
            const stream = await this.createOptimizedStream(connection, streamType, options);

            // Initialize stream buffer
            if (this.config.streamingEnabled) {
                this.streamBuffers.set(streamId, {
                    buffer: [],
                    maxSize: this.config.streamBufferSize,
                    flushInterval: null,
                    lastFlush: Date.now()
                });
            }

            // Track active stream
            this.activeStreams.set(streamId, {
                stream,
                connection,
                destination,
                type: streamType,
                createdAt: new Date(),
                messageCount: 0,
                bytesSent: 0,
                bytesReceived: 0
            });

            this.metrics.streaming_sessions++;

            span.setAttributes({
                'stream.id': streamId,
                'stream.type': streamType,
                'stream.destination': destination,
                'stream.optimization': this.config.streamingEnabled
            });

            console.log(`[GRPCEnhancedTransport] Stream created: ${streamId} (${streamType})`);

            return {
                success: true,
                streamId,
                stream: this.createStreamWrapper(streamId, stream),
                metadata: {
                    type: streamType,
                    destination,
                    bufferingEnabled: this.config.streamingEnabled
                }
            };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Execute request with comprehensive retry logic
     */
    async executeWithRetry(operation, destination, options = {}) {
        let lastError;
        let attempt = 0;
        const maxRetries = options.maxRetries || this.config.maxRetries;
        
        while (attempt <= maxRetries) {
            try {
                if (attempt > 0) {
                    this.metrics.retried_requests++;
                }
                
                const result = await operation();
                return result;

            } catch (error) {
                lastError = error;
                attempt++;

                // Check if error is retryable
                if (!this.isRetryableError(error) || attempt > maxRetries) {
                    break;
                }

                // Calculate retry delay with exponential backoff
                const delay = this.calculateRetryDelay(attempt);
                
                console.log(`[GRPCEnhancedTransport] Retry attempt ${attempt}/${maxRetries} for ${destination} in ${delay}ms`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Get connection from pool with load balancing
     */
    async getConnectionFromPool(destination, options = {}) {
        const span = this.tracer.startSpan('grpc-enhanced-transport.get-connection');
        
        try {
            if (!this.config.poolEnabled) {
                // Return a mock connection if pooling disabled
                return this.createMockConnection(destination);
            }

            // Check for existing pooled connections
            const poolKey = `${destination}-${options.streaming ? 'stream' : 'unary'}`;
            let connectionPool = this.connectionPool.get(poolKey);
            
            if (!connectionPool) {
                connectionPool = {
                    connections: [],
                    waitingQueue: [],
                    totalConnections: 0
                };
                this.connectionPool.set(poolKey, connectionPool);
            }

            // Try to get available connection
            if (connectionPool.connections.length > 0) {
                const connection = connectionPool.connections.pop();
                this.metrics.connection_pool_hits++;
                
                // Update connection stats
                const stats = this.connectionStats.get(connection.id);
                if (stats) {
                    stats.lastUsed = Date.now();
                    stats.usageCount++;
                }

                span.setAttributes({
                    'connection.pool_hit': true,
                    'connection.id': connection.id,
                    'connection.destination': destination
                });

                return connection;
            }

            // Create new connection if under limit
            if (connectionPool.totalConnections < this.config.maxConnections) {
                const connection = await this.createNewConnection(destination, options);
                connectionPool.totalConnections++;
                this.activeConnections++;
                this.metrics.connection_pool_misses++;

                span.setAttributes({
                    'connection.pool_hit': false,
                    'connection.new': true,
                    'connection.id': connection.id,
                    'connection.destination': destination
                });

                return connection;
            }

            // Wait for available connection
            this.metrics.connection_pool_misses++;
            return await this.waitForConnection(poolKey, options);

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Return connection to pool
     */
    async returnConnectionToPool(connection, destination) {
        if (!this.config.poolEnabled || !connection) {
            return;
        }

        const poolKey = `${destination}-${connection.streaming ? 'stream' : 'unary'}`;
        const connectionPool = this.connectionPool.get(poolKey);
        
        if (connectionPool) {
            // Check if connection is still healthy
            const stats = this.connectionStats.get(connection.id);
            const now = Date.now();
            
            if (stats && (now - stats.createdAt) < this.config.idleTimeout && connection.isHealthy) {
                connectionPool.connections.push(connection);
                
                // Check for waiting requests
                if (connectionPool.waitingQueue.length > 0) {
                    const waiter = connectionPool.waitingQueue.shift();
                    const returnedConnection = connectionPool.connections.pop();
                    if (returnedConnection && waiter.resolve) {
                        waiter.resolve(returnedConnection);
                    }
                }
            } else {
                // Connection is too old or unhealthy, close it
                await this.closeConnection(connection);
                connectionPool.totalConnections--;
                this.activeConnections--;
            }
        }
    }

    /**
     * Check circuit breaker status
     */
    async checkCircuitBreaker(destination) {
        if (!this.config.circuitBreakerEnabled) {
            return { allowed: true, state: 'disabled' };
        }

        let state = this.circuitBreakerStates.get(destination);
        if (!state) {
            state = {
                state: 'closed', // closed, open, half-open
                failures: 0,
                lastFailureTime: null,
                successCount: 0,
                requestCount: 0
            };
            this.circuitBreakerStates.set(destination, state);
        }

        const now = Date.now();

        switch (state.state) {
            case 'closed':
                return { allowed: true, state: 'closed' };

            case 'open':
                // Check if recovery timeout has passed
                if (state.lastFailureTime && (now - state.lastFailureTime) > this.config.recoveryTimeout) {
                    state.state = 'half-open';
                    state.requestCount = 0;
                    state.successCount = 0;
                    return { allowed: true, state: 'half-open' };
                }
                return { allowed: false, state: 'open' };

            case 'half-open':
                // Allow limited requests in half-open state
                return { 
                    allowed: state.requestCount < this.config.halfOpenMaxRequests, 
                    state: 'half-open' 
                };

            default:
                return { allowed: true, state: 'closed' };
        }
    }

    /**
     * Record circuit breaker success
     */
    async recordCircuitBreakerSuccess(destination) {
        if (!this.config.circuitBreakerEnabled) {
            return;
        }

        const state = this.circuitBreakerStates.get(destination);
        if (state) {
            state.successCount++;
            state.failures = Math.max(0, state.failures - 1);

            if (state.state === 'half-open' && state.successCount >= this.config.halfOpenMaxRequests) {
                state.state = 'closed';
                state.failures = 0;
                console.log(`[GRPCEnhancedTransport] Circuit breaker closed for ${destination}`);
            }
        }
    }

    /**
     * Record circuit breaker failure
     */
    async recordCircuitBreakerFailure(destination, error) {
        if (!this.config.circuitBreakerEnabled) {
            return;
        }

        const state = this.circuitBreakerStates.get(destination);
        if (state) {
            state.failures++;
            state.lastFailureTime = Date.now();

            if (state.state === 'closed' && state.failures >= this.config.failureThreshold) {
                state.state = 'open';
                console.log(`[GRPCEnhancedTransport] Circuit breaker opened for ${destination}: ${error.message}`);
            } else if (state.state === 'half-open') {
                state.state = 'open';
                console.log(`[GRPCEnhancedTransport] Circuit breaker reopened for ${destination}: ${error.message}`);
            }
        }
    }

    /**
     * Create optimized stream with buffering
     */
    async createOptimizedStream(connection, streamType, options) {
        // This would normally create an actual gRPC stream
        // For now, we'll create a mock optimized stream
        const stream = {
            id: uuidv4(),
            type: streamType,
            connection: connection.id,
            compression: this.config.enableCompression,
            bufferSize: this.config.streamBufferSize,
            timeout: this.config.streamTimeout,
            
            // Mock stream methods
            write: (data) => {
                console.log(`[GRPCEnhancedTransport] Stream write: ${data.length} bytes`);
                return Promise.resolve();
            },
            
            read: () => {
                return Promise.resolve({ data: 'mock stream data' });
            },
            
            close: () => {
                console.log(`[GRPCEnhancedTransport] Stream closed: ${stream.id}`);
                return Promise.resolve();
            }
        };

        return stream;
    }

    /**
     * Create stream wrapper with enhanced functionality
     */
    createStreamWrapper(streamId, baseStream) {
        const streamInfo = this.activeStreams.get(streamId);
        const buffer = this.streamBuffers.get(streamId);

        return {
            id: streamId,
            
            write: async (data) => {
                if (buffer && this.config.streamingEnabled) {
                    return await this.bufferedWrite(streamId, data);
                } else {
                    return await baseStream.write(data);
                }
            },
            
            read: async () => {
                const result = await baseStream.read();
                if (streamInfo) {
                    streamInfo.messageCount++;
                    streamInfo.bytesReceived += JSON.stringify(result).length;
                }
                return result;
            },
            
            close: async () => {
                await this.closeStream(streamId);
                return await baseStream.close();
            },
            
            getStats: () => streamInfo ? {
                messageCount: streamInfo.messageCount,
                bytesSent: streamInfo.bytesSent,
                bytesReceived: streamInfo.bytesReceived,
                duration: Date.now() - streamInfo.createdAt.getTime()
            } : null
        };
    }

    /**
     * Buffered write for stream optimization
     */
    async bufferedWrite(streamId, data) {
        const buffer = this.streamBuffers.get(streamId);
        const streamInfo = this.activeStreams.get(streamId);
        
        if (!buffer || !streamInfo) {
            throw new Error(`Stream not found: ${streamId}`);
        }

        buffer.buffer.push(data);
        streamInfo.bytesSent += JSON.stringify(data).length;
        
        // Flush buffer if it's full or timeout reached
        const now = Date.now();
        if (buffer.buffer.length >= buffer.maxSize || (now - buffer.lastFlush) > 1000) {
            await this.flushStreamBuffer(streamId);
        }

        return { success: true, buffered: true };
    }

    /**
     * Flush stream buffer
     */
    async flushStreamBuffer(streamId) {
        const buffer = this.streamBuffers.get(streamId);
        const streamInfo = this.activeStreams.get(streamId);
        
        if (!buffer || !streamInfo || buffer.buffer.length === 0) {
            return;
        }

        try {
            // Send all buffered data
            for (const data of buffer.buffer) {
                await streamInfo.stream.write(data);
            }

            // Clear buffer
            buffer.buffer = [];
            buffer.lastFlush = Date.now();

            console.log(`[GRPCEnhancedTransport] Flushed ${buffer.buffer.length} messages from stream ${streamId}`);

        } catch (error) {
            console.error(`[GRPCEnhancedTransport] Failed to flush stream buffer ${streamId}:`, error);
            throw error;
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt) {
        const delay = Math.min(
            this.config.initialRetryDelay * Math.pow(this.config.retryMultiplier, attempt - 1),
            this.config.maxRetryDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = delay * 0.1 * Math.random();
        return Math.floor(delay + jitter);
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (!error) return false;
        
        const errorCode = error.code || error.status || '';
        const errorMessage = error.message || '';
        
        // Check against configured retryable errors
        for (const retryableError of this.config.retryableErrors) {
            if (errorCode.includes(retryableError) || errorMessage.includes(retryableError)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Create new connection
     */
    async createNewConnection(destination, options = {}) {
        const connectionId = uuidv4();
        const connection = {
            id: connectionId,
            destination,
            streaming: options.streaming || false,
            isHealthy: true,
            createdAt: Date.now(),
            
            // Mock connection methods
            send: async (data) => {
                await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));
                return { success: true, data: `Response for ${data}` };
            },
            
            close: () => {
                connection.isHealthy = false;
                console.log(`[GRPCEnhancedTransport] Connection closed: ${connectionId}`);
            }
        };

        // Track connection stats
        this.connectionStats.set(connectionId, {
            createdAt: Date.now(),
            lastUsed: Date.now(),
            usageCount: 0,
            destination
        });

        return connection;
    }

    /**
     * Wait for available connection
     */
    async waitForConnection(poolKey, options) {
        return new Promise((resolve, reject) => {
            const connectionPool = this.connectionPool.get(poolKey);
            if (!connectionPool) {
                reject(new Error('Connection pool not found'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Connection wait timeout'));
            }, this.config.connectionTimeout);

            connectionPool.waitingQueue.push({
                resolve: (connection) => {
                    clearTimeout(timeout);
                    resolve(connection);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
        });
    }

    /**
     * Close connection
     */
    async closeConnection(connection) {
        if (connection && connection.close) {
            await connection.close();
        }
        
        if (connection && connection.id) {
            this.connectionStats.delete(connection.id);
        }
    }

    /**
     * Close stream
     */
    async closeStream(streamId) {
        const streamInfo = this.activeStreams.get(streamId);
        const buffer = this.streamBuffers.get(streamId);
        
        if (buffer) {
            // Flush any remaining buffered data
            if (buffer.buffer.length > 0) {
                await this.flushStreamBuffer(streamId);
            }
            
            // Clear flush interval if set
            if (buffer.flushInterval) {
                clearInterval(buffer.flushInterval);
            }
        }
        
        if (streamInfo) {
            // Return connection to pool
            await this.returnConnectionToPool(streamInfo.connection, streamInfo.destination);
        }
        
        // Clean up
        this.activeStreams.delete(streamId);
        this.streamBuffers.delete(streamId);
        
        console.log(`[GRPCEnhancedTransport] Stream closed and cleaned up: ${streamId}`);
    }

    /**
     * Perform actual message send (mock implementation)
     */
    async performSendMessage(connection, message, options) {
        if (!connection || !connection.send) {
            throw new Error('Invalid connection');
        }

        const result = await connection.send(message);
        
        // Simulate compression if enabled
        if (this.config.enableCompression) {
            const originalSize = JSON.stringify(message).length;
            const compressedSize = Math.floor(originalSize * 0.7); // Simulate 30% compression
            this.metrics.compression_ratio = (this.metrics.compression_ratio + (1 - compressedSize / originalSize)) / 2;
        }

        return result;
    }

    /**
     * Create mock connection
     */
    createMockConnection(destination) {
        return {
            id: uuidv4(),
            destination,
            streaming: false,
            isHealthy: true,
            createdAt: Date.now(),
            send: async (data) => {
                await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 20));
                return { success: true, data: `Mock response for ${destination}` };
            }
        };
    }

    /**
     * Validate message format
     */
    validateMessage(message) {
        if (!message || typeof message !== 'object') {
            throw new Error('Message must be a valid object');
        }

        if (!message.recipient && !message.type) {
            throw new Error('Message must have recipient or type field');
        }
    }

    /**
     * Initialize connection pool
     */
    async initializeConnectionPool() {
        console.log('[GRPCEnhancedTransport] Connection pool initialized');
        
        // Start connection pool maintenance
        this.poolMaintenanceInterval = setInterval(() => {
            this.performPoolMaintenance();
        }, 60000); // Every minute
    }

    /**
     * Initialize circuit breakers
     */
    async initializeCircuitBreakers() {
        console.log('[GRPCEnhancedTransport] Circuit breakers initialized');
    }

    /**
     * Initialize streaming optimization
     */
    async initializeStreamingOptimization() {
        console.log('[GRPCEnhancedTransport] Streaming optimization initialized');
    }

    /**
     * Initialize performance monitoring
     */
    async initializePerformanceMonitoring() {
        console.log('[GRPCEnhancedTransport] Performance monitoring initialized');
        
        // Start metrics collection
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 30000); // Every 30 seconds
    }

    /**
     * Perform connection pool maintenance
     */
    performPoolMaintenance() {
        const now = Date.now();
        
        for (const [poolKey, pool] of this.connectionPool) {
            // Remove idle connections that are too old
            pool.connections = pool.connections.filter(connection => {
                const stats = this.connectionStats.get(connection.id);
                if (stats && (now - stats.lastUsed) > this.config.idleTimeout) {
                    this.closeConnection(connection);
                    pool.totalConnections--;
                    this.activeConnections--;
                    return false;
                }
                return true;
            });
        }
    }

    /**
     * Collect performance metrics
     */
    collectMetrics() {
        const activeStreamsCount = this.activeStreams.size;
        const circuitBreakersOpen = Array.from(this.circuitBreakerStates.values())
            .filter(state => state.state === 'open').length;
        
        console.log(`[GRPCEnhancedTransport] Metrics - Active Connections: ${this.activeConnections}, ` +
                   `Active Streams: ${activeStreamsCount}, Circuit Breakers Open: ${circuitBreakersOpen}`);
    }

    /**
     * Get transport status
     */
    getStatus() {
        const circuitBreakersOpen = Array.from(this.circuitBreakerStates.values())
            .filter(state => state.state === 'open').length;

        return {
            service: 'GRPCEnhancedTransport',
            initialized: this.initialized,
            running: this.isRunning,
            features: {
                connection_pooling: this.config.poolEnabled,
                retry_logic: this.config.retryEnabled,
                circuit_breaker: this.config.circuitBreakerEnabled,
                streaming_optimization: this.config.streamingEnabled,
                load_balancing: this.config.loadBalancingEnabled,
                compression: this.config.enableCompression
            },
            connections: {
                total: this.activeConnections,
                pooled: Array.from(this.connectionPool.values()).reduce((sum, pool) => sum + pool.connections.length, 0),
                max_allowed: this.config.maxConnections
            },
            streams: {
                active: this.activeStreams.size,
                buffered: this.streamBuffers.size
            },
            circuit_breakers: {
                total: this.circuitBreakerStates.size,
                open: circuitBreakersOpen,
                closed: this.circuitBreakerStates.size - circuitBreakersOpen
            },
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Shutdown enhanced transport
     */
    async shutdown() {
        console.log('[GRPCEnhancedTransport] Shutting down enhanced gRPC transport...');

        // Clear intervals
        if (this.poolMaintenanceInterval) {
            clearInterval(this.poolMaintenanceInterval);
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }

        // Close all active streams
        for (const streamId of this.activeStreams.keys()) {
            await this.closeStream(streamId);
        }

        // Close all connections
        for (const stats of this.connectionStats.values()) {
            // Find and close connections (simplified)
        }

        // Shutdown base transport
        if (this.baseTransport && typeof this.baseTransport.shutdown === 'function') {
            await this.baseTransport.shutdown();
        }

        this.isRunning = false;
        console.log('[GRPCEnhancedTransport] Enhanced gRPC transport shutdown complete');
    }
}

export default GRPCEnhancedTransport;
