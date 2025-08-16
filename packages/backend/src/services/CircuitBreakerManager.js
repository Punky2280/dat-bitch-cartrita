/**
 * Circuit Breaker Manager
 * 
 * Comprehensive circuit breaker system with failure detection, fallback mechanisms,
 * adaptive thresholds, bulkhead patterns, health monitoring, and recovery strategies.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

// Circuit Breaker States
const CIRCUIT_STATES = {
    CLOSED: 'CLOSED',           // Normal operation
    OPEN: 'OPEN',              // Circuit is open, requests fail fast
    HALF_OPEN: 'HALF_OPEN'     // Testing recovery, limited requests allowed
};

// Failure Types
const FAILURE_TYPES = {
    TIMEOUT: 'TIMEOUT',
    ERROR: 'ERROR',
    REJECTION: 'REJECTION',
    OVERLOAD: 'OVERLOAD',
    UNHEALTHY: 'UNHEALTHY'
};

class CircuitBreakerManager extends EventEmitter {
    constructor(db, config = {}) {
        super();
        this.db = db;
        this.config = {
            // Global Circuit Breaker Settings
            enabled: config.enabled !== false,
            defaultTimeout: config.defaultTimeout || 30000,
            defaultFailureThreshold: config.defaultFailureThreshold || 5,
            defaultSuccessThreshold: config.defaultSuccessThreshold || 3,
            defaultRecoveryTimeout: config.defaultRecoveryTimeout || 60000,
            
            // Adaptive Thresholds
            adaptiveThresholds: config.adaptiveThresholds !== false,
            thresholdAdjustmentFactor: config.thresholdAdjustmentFactor || 0.1,
            windowSizeMinutes: config.windowSizeMinutes || 10,
            
            // Bulkhead Configuration
            bulkheadEnabled: config.bulkheadEnabled !== false,
            maxConcurrentCalls: config.maxConcurrentCalls || 100,
            queueSize: config.queueSize || 200,
            
            // Health Monitoring
            healthCheckEnabled: config.healthCheckEnabled !== false,
            healthCheckInterval: config.healthCheckInterval || 30000,
            healthCheckTimeout: config.healthCheckTimeout || 5000,
            
            // Fallback Configuration
            fallbackEnabled: config.fallbackEnabled !== false,
            fallbackTimeout: config.fallbackTimeout || 10000,
            fallbackCacheEnabled: config.fallbackCacheEnabled !== false,
            fallbackCacheTTL: config.fallbackCacheTTL || 300000, // 5 minutes
            
            // Monitoring and Metrics
            metricsEnabled: config.metricsEnabled !== false,
            detailedMetrics: config.detailedMetrics !== false,
            alerting: config.alerting !== false,
            
            // Recovery Strategies
            exponentialBackoff: config.exponentialBackoff !== false,
            jitterEnabled: config.jitterEnabled !== false,
            maxBackoffTime: config.maxBackoffTime || 300000, // 5 minutes
            
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('circuit-breaker-manager');
        this.initialized = false;
        this.isRunning = false;

        // Circuit Breaker Registry
        this.circuitBreakers = new Map(); // name -> circuit breaker instance
        this.circuitConfigs = new Map(); // name -> configuration
        this.circuitStats = new Map(); // name -> statistics
        this.circuitHistory = new Map(); // name -> history entries

        // Bulkhead Isolation
        this.bulkheads = new Map(); // service -> bulkhead instance
        this.activeCalls = new Map(); // service -> active call count
        this.callQueues = new Map(); // service -> queued calls

        // Health Monitoring
        this.healthChecks = new Map(); // service -> health check function
        this.healthStatus = new Map(); // service -> health status
        this.healthCheckIntervals = new Map(); // service -> interval ID

        // Fallback Management
        this.fallbacks = new Map(); // service -> fallback function
        this.fallbackCache = new Map(); // key -> cached response
        this.fallbackCacheMetadata = new Map(); // key -> cache metadata

        // Adaptive Learning
        this.performanceWindow = new Map(); // service -> performance data window
        this.patternDetection = new Map(); // service -> detected patterns
        this.adaptiveAdjustments = new Map(); // service -> adjustment history

        // Global Metrics
        this.metrics = {
            total_circuits: 0,
            open_circuits: 0,
            half_open_circuits: 0,
            closed_circuits: 0,
            total_calls: 0,
            successful_calls: 0,
            failed_calls: 0,
            rejected_calls: 0,
            fallback_calls: 0,
            timeout_calls: 0,
            avg_response_time: 0,
            failure_rate: 0,
            recovery_rate: 0
        };

        // Internal timers and intervals
        this.cleanupInterval = null;
        this.metricsInterval = null;
        this.adaptiveInterval = null;
    }

    /**
     * Initialize Circuit Breaker Manager
     */
    async initialize() {
        const span = this.tracer.startSpan('circuit-breaker-manager.initialize');
        
        try {
            console.log('[CircuitBreakerManager] Initializing circuit breaker manager...');

            if (this.config.enabled) {
                // Initialize bulkhead system
                if (this.config.bulkheadEnabled) {
                    await this.initializeBulkheads();
                }

                // Initialize health monitoring
                if (this.config.healthCheckEnabled) {
                    await this.initializeHealthMonitoring();
                }

                // Initialize fallback system
                if (this.config.fallbackEnabled) {
                    await this.initializeFallbacks();
                }

                // Initialize adaptive learning
                if (this.config.adaptiveThresholds) {
                    await this.initializeAdaptiveLearning();
                }

                // Initialize metrics collection
                if (this.config.metricsEnabled) {
                    await this.initializeMetrics();
                }

                // Register default circuit breakers
                await this.registerDefaultCircuitBreakers();

                // Start background tasks
                await this.startBackgroundTasks();
            }

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'circuit_breaker.enabled': this.config.enabled,
                'circuit_breaker.bulkhead_enabled': this.config.bulkheadEnabled,
                'circuit_breaker.health_check_enabled': this.config.healthCheckEnabled,
                'circuit_breaker.fallback_enabled': this.config.fallbackEnabled,
                'circuit_breaker.adaptive_thresholds': this.config.adaptiveThresholds
            });

            console.log('[CircuitBreakerManager] Circuit breaker manager initialized successfully');

            this.emit('initialized');
            return { success: true };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error('[CircuitBreakerManager] Failed to initialize:', error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Create circuit breaker for service
     */
    async createCircuitBreaker(name, config = {}) {
        const span = this.tracer.startSpan('circuit-breaker-manager.create-circuit');
        
        try {
            if (this.circuitBreakers.has(name)) {
                throw new Error(`Circuit breaker already exists: ${name}`);
            }

            const circuitConfig = {
                name,
                timeout: config.timeout || this.config.defaultTimeout,
                failureThreshold: config.failureThreshold || this.config.defaultFailureThreshold,
                successThreshold: config.successThreshold || this.config.defaultSuccessThreshold,
                recoveryTimeout: config.recoveryTimeout || this.config.defaultRecoveryTimeout,
                enabled: config.enabled !== false,
                bulkheadEnabled: config.bulkheadEnabled !== false,
                healthCheckEnabled: config.healthCheckEnabled !== false,
                fallbackEnabled: config.fallbackEnabled !== false,
                maxConcurrentCalls: config.maxConcurrentCalls || this.config.maxConcurrentCalls,
                ...config
            };

            const circuitBreaker = new CircuitBreaker(name, circuitConfig, this);
            
            this.circuitBreakers.set(name, circuitBreaker);
            this.circuitConfigs.set(name, circuitConfig);
            this.circuitStats.set(name, circuitBreaker.getStats());
            this.circuitHistory.set(name, []);

            // Initialize bulkhead if enabled
            if (circuitConfig.bulkheadEnabled) {
                this.createBulkhead(name, circuitConfig.maxConcurrentCalls);
            }

            // Initialize health check if enabled
            if (circuitConfig.healthCheckEnabled && config.healthCheck) {
                this.registerHealthCheck(name, config.healthCheck);
            }

            // Initialize fallback if provided
            if (circuitConfig.fallbackEnabled && config.fallback) {
                this.registerFallback(name, config.fallback);
            }

            this.metrics.total_circuits++;
            this.metrics.closed_circuits++; // New circuits start closed

            span.setAttributes({
                'circuit.name': name,
                'circuit.failure_threshold': circuitConfig.failureThreshold,
                'circuit.recovery_timeout': circuitConfig.recoveryTimeout,
                'circuit.bulkhead_enabled': circuitConfig.bulkheadEnabled,
                'circuit.health_check_enabled': circuitConfig.healthCheckEnabled
            });

            console.log(`[CircuitBreakerManager] Circuit breaker created: ${name}`);

            this.emit('circuitCreated', { name, config: circuitConfig });
            return { success: true, name, circuit: circuitBreaker };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Execute call through circuit breaker
     */
    async executeCall(circuitName, operation, context = {}) {
        const span = this.tracer.startSpan('circuit-breaker-manager.execute-call');
        const startTime = Date.now();
        
        try {
            const circuit = this.circuitBreakers.get(circuitName);
            if (!circuit) {
                throw new Error(`Circuit breaker not found: ${circuitName}`);
            }

            // Check if circuit allows the call
            if (!circuit.canExecute()) {
                this.metrics.rejected_calls++;
                
                // Try fallback if available
                if (this.config.fallbackEnabled && this.fallbacks.has(circuitName)) {
                    return await this.executeFallback(circuitName, context);
                }
                
                const error = new Error(`Circuit breaker is OPEN: ${circuitName}`);
                error.code = 'CIRCUIT_OPEN';
                throw error;
            }

            // Check bulkhead limits
            if (this.config.bulkheadEnabled && !this.acquireBulkheadPermit(circuitName)) {
                this.metrics.rejected_calls++;
                
                // Try fallback for overload
                if (this.config.fallbackEnabled && this.fallbacks.has(circuitName)) {
                    return await this.executeFallback(circuitName, context, FAILURE_TYPES.OVERLOAD);
                }
                
                const error = new Error(`Bulkhead limit exceeded: ${circuitName}`);
                error.code = 'BULKHEAD_FULL';
                throw error;
            }

            try {
                // Execute the operation with timeout
                const result = await this.executeWithTimeout(operation, circuit.config.timeout);
                
                // Record success
                circuit.recordSuccess();
                this.updateCallMetrics(circuitName, true, Date.now() - startTime);
                
                // Release bulkhead permit
                if (this.config.bulkheadEnabled) {
                    this.releaseBulkheadPermit(circuitName);
                }

                span.setAttributes({
                    'circuit.name': circuitName,
                    'call.success': true,
                    'call.duration': Date.now() - startTime,
                    'circuit.state': circuit.getState()
                });

                return result;

            } catch (error) {
                // Record failure
                const failureType = this.classifyFailure(error);
                circuit.recordFailure(failureType);
                this.updateCallMetrics(circuitName, false, Date.now() - startTime);
                
                // Release bulkhead permit
                if (this.config.bulkheadEnabled) {
                    this.releaseBulkheadPermit(circuitName);
                }

                // Try fallback if available and circuit is now open
                if (this.config.fallbackEnabled && 
                    this.fallbacks.has(circuitName) && 
                    circuit.getState() === CIRCUIT_STATES.OPEN) {
                    
                    return await this.executeFallback(circuitName, context, failureType);
                }

                throw error;
            }

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get circuit breaker status
     */
    getCircuitStatus(name) {
        const circuit = this.circuitBreakers.get(name);
        if (!circuit) {
            return null;
        }

        const stats = circuit.getStats();
        const health = this.healthStatus.get(name);
        const bulkhead = this.getBulkheadStatus(name);

        return {
            name,
            state: circuit.getState(),
            stats,
            health,
            bulkhead,
            config: this.circuitConfigs.get(name),
            lastStateChange: circuit.getLastStateChange(),
            nextRetryTime: circuit.getNextRetryTime(),
            adaptiveAdjustments: this.adaptiveAdjustments.get(name) || []
        };
    }

    /**
     * Get all circuits status
     */
    getAllCircuitsStatus() {
        const circuits = [];
        
        for (const [name, circuit] of this.circuitBreakers) {
            circuits.push(this.getCircuitStatus(name));
        }

        return {
            circuits,
            summary: {
                total: this.metrics.total_circuits,
                open: this.metrics.open_circuits,
                half_open: this.metrics.half_open_circuits,
                closed: this.metrics.closed_circuits
            },
            metrics: this.metrics
        };
    }

    /**
     * Reset circuit breaker
     */
    async resetCircuit(name) {
        const span = this.tracer.startSpan('circuit-breaker-manager.reset-circuit');
        
        try {
            const circuit = this.circuitBreakers.get(name);
            if (!circuit) {
                throw new Error(`Circuit breaker not found: ${name}`);
            }

            const previousState = circuit.getState();
            circuit.reset();

            // Clear performance window for adaptive learning
            if (this.performanceWindow.has(name)) {
                this.performanceWindow.get(name).clear();
            }

            // Clear fallback cache
            this.clearFallbackCache(name);

            span.setAttributes({
                'circuit.name': name,
                'circuit.previous_state': previousState,
                'circuit.new_state': circuit.getState()
            });

            console.log(`[CircuitBreakerManager] Circuit breaker reset: ${name}`);

            this.emit('circuitReset', { name, previousState });
            return { success: true, previousState, newState: circuit.getState() };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Update circuit breaker configuration
     */
    async updateCircuitConfig(name, updates) {
        const span = this.tracer.startSpan('circuit-breaker-manager.update-config');
        
        try {
            const circuit = this.circuitBreakers.get(name);
            if (!circuit) {
                throw new Error(`Circuit breaker not found: ${name}`);
            }

            const currentConfig = this.circuitConfigs.get(name);
            const newConfig = { ...currentConfig, ...updates };

            // Update circuit configuration
            circuit.updateConfig(newConfig);
            this.circuitConfigs.set(name, newConfig);

            span.setAttributes({
                'circuit.name': name,
                'config.updated_fields': Object.keys(updates).length
            });

            console.log(`[CircuitBreakerManager] Circuit configuration updated: ${name}`);

            this.emit('circuitConfigUpdated', { name, updates, newConfig });
            return { success: true, config: newConfig };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Register health check for circuit
     */
    registerHealthCheck(circuitName, healthCheckFn) {
        this.healthChecks.set(circuitName, healthCheckFn);
        this.healthStatus.set(circuitName, { healthy: true, lastCheck: null, error: null });
        
        if (this.config.healthCheckEnabled) {
            this.startHealthCheck(circuitName);
        }

        console.log(`[CircuitBreakerManager] Health check registered for: ${circuitName}`);
    }

    /**
     * Register fallback for circuit
     */
    registerFallback(circuitName, fallbackFn) {
        this.fallbacks.set(circuitName, fallbackFn);
        console.log(`[CircuitBreakerManager] Fallback registered for: ${circuitName}`);
    }

    /**
     * Get platform status
     */
    getStatus() {
        const activeHealthChecks = Array.from(this.healthCheckIntervals.keys()).length;
        const healthyCircuits = Array.from(this.healthStatus.values()).filter(h => h.healthy).length;

        return {
            service: 'CircuitBreakerManager',
            initialized: this.initialized,
            running: this.isRunning,
            enabled: this.config.enabled,
            features: {
                bulkhead_isolation: this.config.bulkheadEnabled,
                health_monitoring: this.config.healthCheckEnabled,
                fallback_support: this.config.fallbackEnabled,
                adaptive_thresholds: this.config.adaptiveThresholds,
                metrics_collection: this.config.metricsEnabled
            },
            circuits: {
                total: this.metrics.total_circuits,
                open: this.metrics.open_circuits,
                half_open: this.metrics.half_open_circuits,
                closed: this.metrics.closed_circuits
            },
            health: {
                checks_active: activeHealthChecks,
                healthy_circuits: healthyCircuits,
                unhealthy_circuits: this.healthStatus.size - healthyCircuits
            },
            bulkheads: {
                total: this.bulkheads.size,
                active_calls: Array.from(this.activeCalls.values()).reduce((sum, count) => sum + count, 0),
                queued_calls: Array.from(this.callQueues.values()).reduce((sum, queue) => sum + queue.length, 0)
            },
            fallbacks: {
                registered: this.fallbacks.size,
                cache_entries: this.fallbackCache.size
            },
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };
    }

    // Helper Methods

    /**
     * Execute operation with timeout
     */
    async executeWithTimeout(operation, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Operation timeout after ${timeout}ms`));
            }, timeout);

            Promise.resolve(operation())
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * Classify failure type
     */
    classifyFailure(error) {
        if (error.message.includes('timeout')) {
            return FAILURE_TYPES.TIMEOUT;
        }
        if (error.message.includes('overload') || error.message.includes('limit exceeded')) {
            return FAILURE_TYPES.OVERLOAD;
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return FAILURE_TYPES.UNHEALTHY;
        }
        return FAILURE_TYPES.ERROR;
    }

    /**
     * Execute fallback
     */
    async executeFallback(circuitName, context, failureType = null) {
        const fallbackFn = this.fallbacks.get(circuitName);
        if (!fallbackFn) {
            throw new Error(`No fallback available for circuit: ${circuitName}`);
        }

        try {
            // Check fallback cache first
            if (this.config.fallbackCacheEnabled) {
                const cached = this.getFallbackCacheEntry(circuitName, context);
                if (cached) {
                    this.metrics.fallback_calls++;
                    return cached;
                }
            }

            // Execute fallback
            const result = await this.executeWithTimeout(fallbackFn, this.config.fallbackTimeout);
            
            // Cache the result
            if (this.config.fallbackCacheEnabled) {
                this.setFallbackCacheEntry(circuitName, context, result);
            }

            this.metrics.fallback_calls++;
            
            console.log(`[CircuitBreakerManager] Fallback executed for: ${circuitName}`);
            this.emit('fallbackExecuted', { circuitName, failureType, context });
            
            return result;

        } catch (error) {
            console.error(`[CircuitBreakerManager] Fallback failed for ${circuitName}:`, error);
            throw error;
        }
    }

    /**
     * Acquire bulkhead permit
     */
    acquireBulkheadPermit(serviceName) {
        const bulkhead = this.bulkheads.get(serviceName);
        if (!bulkhead) return true; // No bulkhead configured

        const activeCalls = this.activeCalls.get(serviceName) || 0;
        if (activeCalls >= bulkhead.maxConcurrentCalls) {
            // Try to queue the call
            const queue = this.callQueues.get(serviceName) || [];
            if (queue.length >= bulkhead.queueSize) {
                return false; // Queue is full
            }
            
            // Add to queue (simplified - in practice would handle async queuing)
            return false; // For now, reject if at limit
        }

        this.activeCalls.set(serviceName, activeCalls + 1);
        return true;
    }

    /**
     * Release bulkhead permit
     */
    releaseBulkheadPermit(serviceName) {
        const activeCalls = this.activeCalls.get(serviceName) || 0;
        if (activeCalls > 0) {
            this.activeCalls.set(serviceName, activeCalls - 1);
        }
    }

    /**
     * Create bulkhead for service
     */
    createBulkhead(serviceName, maxConcurrentCalls) {
        const bulkhead = {
            serviceName,
            maxConcurrentCalls,
            queueSize: this.config.queueSize,
            createdAt: new Date()
        };

        this.bulkheads.set(serviceName, bulkhead);
        this.activeCalls.set(serviceName, 0);
        this.callQueues.set(serviceName, []);

        console.log(`[CircuitBreakerManager] Bulkhead created for ${serviceName}: max ${maxConcurrentCalls} calls`);
    }

    /**
     * Get bulkhead status
     */
    getBulkheadStatus(serviceName) {
        const bulkhead = this.bulkheads.get(serviceName);
        if (!bulkhead) return null;

        return {
            maxConcurrentCalls: bulkhead.maxConcurrentCalls,
            activeCalls: this.activeCalls.get(serviceName) || 0,
            queuedCalls: (this.callQueues.get(serviceName) || []).length,
            queueSize: bulkhead.queueSize
        };
    }

    /**
     * Start health check for circuit
     */
    startHealthCheck(circuitName) {
        const healthCheckFn = this.healthChecks.get(circuitName);
        if (!healthCheckFn) return;

        const intervalId = setInterval(async () => {
            try {
                const isHealthy = await this.executeWithTimeout(
                    () => healthCheckFn(),
                    this.config.healthCheckTimeout
                );

                this.healthStatus.set(circuitName, {
                    healthy: isHealthy,
                    lastCheck: new Date(),
                    error: null
                });

            } catch (error) {
                this.healthStatus.set(circuitName, {
                    healthy: false,
                    lastCheck: new Date(),
                    error: error.message
                });

                // Potentially open circuit based on health check failure
                const circuit = this.circuitBreakers.get(circuitName);
                if (circuit && circuit.getState() !== CIRCUIT_STATES.OPEN) {
                    circuit.recordFailure(FAILURE_TYPES.UNHEALTHY);
                }
            }
        }, this.config.healthCheckInterval);

        this.healthCheckIntervals.set(circuitName, intervalId);
    }

    /**
     * Update call metrics
     */
    updateCallMetrics(circuitName, success, duration) {
        this.metrics.total_calls++;
        
        if (success) {
            this.metrics.successful_calls++;
        } else {
            this.metrics.failed_calls++;
        }

        // Update average response time
        this.metrics.avg_response_time = (this.metrics.avg_response_time + duration) / 2;

        // Update failure rate
        this.metrics.failure_rate = (this.metrics.failed_calls / this.metrics.total_calls) * 100;

        // Update performance window for adaptive learning
        if (this.config.adaptiveThresholds) {
            this.updatePerformanceWindow(circuitName, success, duration);
        }
    }

    /**
     * Update performance window for adaptive learning
     */
    updatePerformanceWindow(circuitName, success, duration) {
        let window = this.performanceWindow.get(circuitName);
        if (!window) {
            window = [];
            this.performanceWindow.set(circuitName, window);
        }

        const entry = {
            timestamp: new Date(),
            success,
            duration,
            failure_type: success ? null : FAILURE_TYPES.ERROR
        };

        window.push(entry);

        // Keep only recent entries
        const windowMs = this.config.windowSizeMinutes * 60 * 1000;
        const cutoff = new Date(Date.now() - windowMs);
        
        while (window.length > 0 && window[0].timestamp < cutoff) {
            window.shift();
        }
    }

    /**
     * Get fallback cache entry
     */
    getFallbackCacheEntry(circuitName, context) {
        const key = this.generateCacheKey(circuitName, context);
        const cached = this.fallbackCache.get(key);
        
        if (!cached) return null;

        const metadata = this.fallbackCacheMetadata.get(key);
        if (!metadata || Date.now() > metadata.expiresAt) {
            this.fallbackCache.delete(key);
            this.fallbackCacheMetadata.delete(key);
            return null;
        }

        return cached;
    }

    /**
     * Set fallback cache entry
     */
    setFallbackCacheEntry(circuitName, context, result) {
        const key = this.generateCacheKey(circuitName, context);
        const expiresAt = Date.now() + this.config.fallbackCacheTTL;

        this.fallbackCache.set(key, result);
        this.fallbackCacheMetadata.set(key, {
            circuitName,
            context,
            cachedAt: new Date(),
            expiresAt
        });
    }

    /**
     * Generate cache key
     */
    generateCacheKey(circuitName, context) {
        const contextStr = JSON.stringify(context || {});
        return `${circuitName}:${Buffer.from(contextStr).toString('base64')}`;
    }

    /**
     * Clear fallback cache for circuit
     */
    clearFallbackCache(circuitName) {
        const keysToDelete = [];
        
        for (const [key, metadata] of this.fallbackCacheMetadata) {
            if (metadata.circuitName === circuitName) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.fallbackCache.delete(key);
            this.fallbackCacheMetadata.delete(key);
        }
    }

    /**
     * Initialize subsystems
     */
    async initializeBulkheads() {
        console.log('[CircuitBreakerManager] Bulkhead system initialized');
    }

    async initializeHealthMonitoring() {
        console.log('[CircuitBreakerManager] Health monitoring initialized');
    }

    async initializeFallbacks() {
        console.log('[CircuitBreakerManager] Fallback system initialized');
    }

    async initializeAdaptiveLearning() {
        console.log('[CircuitBreakerManager] Adaptive learning initialized');
    }

    async initializeMetrics() {
        if (this.config.metricsEnabled) {
            this.metricsInterval = setInterval(() => {
                this.updateGlobalMetrics();
            }, 60000); // Update every minute
        }
        console.log('[CircuitBreakerManager] Metrics collection initialized');
    }

    /**
     * Update global metrics
     */
    updateGlobalMetrics() {
        let openCount = 0;
        let halfOpenCount = 0;
        let closedCount = 0;

        for (const circuit of this.circuitBreakers.values()) {
            switch (circuit.getState()) {
                case CIRCUIT_STATES.OPEN:
                    openCount++;
                    break;
                case CIRCUIT_STATES.HALF_OPEN:
                    halfOpenCount++;
                    break;
                case CIRCUIT_STATES.CLOSED:
                    closedCount++;
                    break;
            }
        }

        this.metrics.open_circuits = openCount;
        this.metrics.half_open_circuits = halfOpenCount;
        this.metrics.closed_circuits = closedCount;

        // Calculate recovery rate
        const totalNonClosed = openCount + halfOpenCount;
        this.metrics.recovery_rate = totalNonClosed > 0 ? 
            (halfOpenCount / totalNonClosed) * 100 : 100;
    }

    /**
     * Register default circuit breakers
     */
    async registerDefaultCircuitBreakers() {
        // Register circuit breakers for common services
        const defaultCircuits = [
            {
                name: 'database',
                timeout: 5000,
                failureThreshold: 3,
                recoveryTimeout: 30000
            },
            {
                name: 'external-api',
                timeout: 10000,
                failureThreshold: 5,
                recoveryTimeout: 60000
            },
            {
                name: 'message-queue',
                timeout: 3000,
                failureThreshold: 2,
                recoveryTimeout: 15000
            }
        ];

        for (const config of defaultCircuits) {
            try {
                await this.createCircuitBreaker(config.name, config);
            } catch (error) {
                console.warn(`[CircuitBreakerManager] Failed to create default circuit ${config.name}:`, error.message);
            }
        }

        console.log('[CircuitBreakerManager] Default circuit breakers registered');
    }

    /**
     * Start background tasks
     */
    async startBackgroundTasks() {
        // Cleanup expired cache entries
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCacheEntries();
        }, 300000); // Every 5 minutes

        // Adaptive threshold adjustments
        if (this.config.adaptiveThresholds) {
            this.adaptiveInterval = setInterval(() => {
                this.performAdaptiveAdjustments();
            }, 600000); // Every 10 minutes
        }
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCacheEntries() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, metadata] of this.fallbackCacheMetadata) {
            if (now > metadata.expiresAt) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.fallbackCache.delete(key);
            this.fallbackCacheMetadata.delete(key);
        }

        if (expiredKeys.length > 0) {
            console.log(`[CircuitBreakerManager] Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    /**
     * Perform adaptive threshold adjustments
     */
    performAdaptiveAdjustments() {
        for (const [circuitName, window] of this.performanceWindow) {
            if (window.length < 10) continue; // Need minimum data points

            const circuit = this.circuitBreakers.get(circuitName);
            if (!circuit) continue;

            // Analyze performance patterns
            const failureRate = window.filter(entry => !entry.success).length / window.length;
            const avgDuration = window.reduce((sum, entry) => sum + entry.duration, 0) / window.length;

            // Adjust thresholds based on patterns
            const config = this.circuitConfigs.get(circuitName);
            let adjustments = [];

            if (failureRate > 0.5 && config.failureThreshold > 2) {
                // High failure rate - be more sensitive
                const newThreshold = Math.max(2, config.failureThreshold - 1);
                adjustments.push({ field: 'failureThreshold', from: config.failureThreshold, to: newThreshold });
                config.failureThreshold = newThreshold;
            } else if (failureRate < 0.1 && config.failureThreshold < 10) {
                // Low failure rate - be less sensitive
                const newThreshold = Math.min(10, config.failureThreshold + 1);
                adjustments.push({ field: 'failureThreshold', from: config.failureThreshold, to: newThreshold });
                config.failureThreshold = newThreshold;
            }

            if (adjustments.length > 0) {
                circuit.updateConfig(config);
                
                let history = this.adaptiveAdjustments.get(circuitName) || [];
                history.push({
                    timestamp: new Date(),
                    adjustments,
                    triggerData: { failureRate, avgDuration, windowSize: window.length }
                });
                
                // Keep only recent adjustments
                if (history.length > 10) {
                    history = history.slice(-10);
                }
                
                this.adaptiveAdjustments.set(circuitName, history);
                
                console.log(`[CircuitBreakerManager] Adaptive adjustments made for ${circuitName}:`, adjustments);
            }
        }
    }

    /**
     * Shutdown circuit breaker manager
     */
    async shutdown() {
        console.log('[CircuitBreakerManager] Shutting down circuit breaker manager...');

        // Clear intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        if (this.adaptiveInterval) {
            clearInterval(this.adaptiveInterval);
        }

        // Clear health check intervals
        for (const intervalId of this.healthCheckIntervals.values()) {
            clearInterval(intervalId);
        }

        // Clear all state
        this.circuitBreakers.clear();
        this.circuitConfigs.clear();
        this.circuitStats.clear();
        this.circuitHistory.clear();
        this.bulkheads.clear();
        this.activeCalls.clear();
        this.callQueues.clear();
        this.healthChecks.clear();
        this.healthStatus.clear();
        this.healthCheckIntervals.clear();
        this.fallbacks.clear();
        this.fallbackCache.clear();
        this.fallbackCacheMetadata.clear();

        this.isRunning = false;
        console.log('[CircuitBreakerManager] Circuit breaker manager shutdown complete');
    }
}

/**
 * Individual Circuit Breaker Implementation
 */
class CircuitBreaker {
    constructor(name, config, manager) {
        this.name = name;
        this.config = config;
        this.manager = manager;
        this.state = CIRCUIT_STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastStateChange = new Date();
        this.nextRetryTime = null;
        this.stats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            rejectedCalls: 0,
            timeoutCalls: 0,
            lastCallTime: null,
            avgResponseTime: 0
        };
    }

    canExecute() {
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED:
                return true;
                
            case CIRCUIT_STATES.OPEN:
                if (Date.now() >= this.nextRetryTime) {
                    this.transitionToHalfOpen();
                    return true;
                }
                return false;
                
            case CIRCUIT_STATES.HALF_OPEN:
                return true;
                
            default:
                return false;
        }
    }

    recordSuccess() {
        this.stats.totalCalls++;
        this.stats.successfulCalls++;
        this.stats.lastCallTime = new Date();
        
        this.successCount++;
        this.failureCount = 0; // Reset failure count on success

        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            if (this.successCount >= this.config.successThreshold) {
                this.transitionToClosed();
            }
        }
    }

    recordFailure(failureType = FAILURE_TYPES.ERROR) {
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        this.stats.lastCallTime = new Date();
        
        if (failureType === FAILURE_TYPES.TIMEOUT) {
            this.stats.timeoutCalls++;
        }

        this.failureCount++;
        this.successCount = 0; // Reset success count on failure
        this.lastFailureTime = new Date();

        if (this.state === CIRCUIT_STATES.CLOSED || this.state === CIRCUIT_STATES.HALF_OPEN) {
            if (this.failureCount >= this.config.failureThreshold) {
                this.transitionToOpen();
            }
        }
    }

    transitionToOpen() {
        this.state = CIRCUIT_STATES.OPEN;
        this.lastStateChange = new Date();
        this.nextRetryTime = Date.now() + this.config.recoveryTimeout;
        
        console.log(`[CircuitBreaker] ${this.name} transitioned to OPEN state`);
        this.manager.emit('circuitOpened', { name: this.name, circuit: this });
    }

    transitionToHalfOpen() {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.lastStateChange = new Date();
        this.successCount = 0;
        
        console.log(`[CircuitBreaker] ${this.name} transitioned to HALF_OPEN state`);
        this.manager.emit('circuitHalfOpened', { name: this.name, circuit: this });
    }

    transitionToClosed() {
        this.state = CIRCUIT_STATES.CLOSED;
        this.lastStateChange = new Date();
        this.failureCount = 0;
        this.nextRetryTime = null;
        
        console.log(`[CircuitBreaker] ${this.name} transitioned to CLOSED state`);
        this.manager.emit('circuitClosed', { name: this.name, circuit: this });
    }

    getState() {
        return this.state;
    }

    getStats() {
        return {
            ...this.stats,
            failureCount: this.failureCount,
            successCount: this.successCount,
            state: this.state,
            failureRate: this.stats.totalCalls > 0 ? 
                (this.stats.failedCalls / this.stats.totalCalls) * 100 : 0
        };
    }

    getLastStateChange() {
        return this.lastStateChange;
    }

    getNextRetryTime() {
        return this.nextRetryTime;
    }

    reset() {
        this.state = CIRCUIT_STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastStateChange = new Date();
        this.nextRetryTime = null;
        
        // Reset stats
        this.stats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            rejectedCalls: 0,
            timeoutCalls: 0,
            lastCallTime: null,
            avgResponseTime: 0
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

export { CircuitBreakerManager, CircuitBreaker, CIRCUIT_STATES, FAILURE_TYPES };
