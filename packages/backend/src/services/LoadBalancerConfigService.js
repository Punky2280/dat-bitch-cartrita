/**
 * Load Balancer Configuration Service
 * Manages load balancing configuration and backend health monitoring for Cartrita
 * August 16, 2025
 */

import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Load balancing algorithms
 */
export const LoadBalancingAlgorithms = {
    ROUND_ROBIN: 'round_robin',
    LEAST_CONNECTIONS: 'least_connections',
    WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
    IP_HASH: 'ip_hash',
    LEAST_RESPONSE_TIME: 'least_response_time'
};

/**
 * Backend health states
 */
export const HealthStates = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    MAINTENANCE: 'maintenance'
};

/**
 * Load Balancer Configuration Service
 * Handles backend management, health monitoring, and load distribution
 */
export default class LoadBalancerConfigService extends EventEmitter {
    constructor() {
        super();
        
        this.backends = new Map();
        this.currentBackendIndex = 0;
        this.healthMonitor = null;
        this.isInitialized = false;
        
        this.configuration = {
            algorithm: LoadBalancingAlgorithms.ROUND_ROBIN,
            healthCheckInterval: 30000,
            healthCheckTimeout: 5000,
            maxRetries: 3,
            retryInterval: 1000,
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 60000,
            sessionStickiness: false,
            enableMetrics: true
        };
        
        this.metrics = {
            totalBackends: 0,
            healthyBackends: 0,
            degradedBackends: 0,
            unhealthyBackends: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            requestsPerSecond: 0
        };
        
        this.requestHistory = [];
        
        this.init();
    }
    
    /**
     * Initialize load balancer service
     */
    async init() {
        try {
            console.log('⚖️  Initializing Load Balancer Configuration Service...');
            
            // Load default backend configuration
            await this.loadDefaultBackends();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Start metrics collection
            this.startMetricsCollection();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('✅ Load Balancer Configuration Service initialized');
            
        } catch (error) {
            console.error('❌ Load Balancer Service initialization failed:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Load default backend servers
     */
    async loadDefaultBackends() {
        const defaultBackends = [
            {
                id: 'backend-1',
                host: process.env.BACKEND_HOST_1 || 'localhost',
                port: process.env.BACKEND_PORT_1 || 3001,
                weight: 1,
                maxConnections: 1000
            },
            {
                id: 'backend-2',
                host: process.env.BACKEND_HOST_2 || 'localhost',
                port: process.env.BACKEND_PORT_2 || 3002,
                weight: 1,
                maxConnections: 1000
            }
        ];
        
        for (const backendConfig of defaultBackends) {
            await this.addBackend(backendConfig, false);
        }
        
        this.updateMetrics();
    }
    
    /**
     * Add a new backend server
     */
    async addBackend(backendConfig, updateDistribution = true) {
        const backendId = backendConfig.id;
        
        if (this.backends.has(backendId)) {
            throw new Error(`Backend ${backendId} already exists`);
        }
        
        const backend = {
            id: backendId,
            host: backendConfig.host,
            port: backendConfig.port,
            weight: backendConfig.weight || 1,
            maxConnections: backendConfig.maxConnections || 1000,
            currentConnections: 0,
            health: HealthStates.HEALTHY,
            lastHealthCheck: Date.now(),
            healthCheckFailures: 0,
            circuitBreakerOpen: false,
            circuitBreakerOpenTime: 0,
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                responseTimes: [],
                lastRequestTime: 0,
                uptime: Date.now()
            },
            metadata: backendConfig.metadata || {}
        };
        
        this.backends.set(backendId, backend);
        
        if (updateDistribution) {
            this.updateLoadDistribution();
            this.updateMetrics();
            this.emit('backendAdded', backendId);
            
            console.log(`✅ Added backend: ${backendId} (${backend.host}:${backend.port})`);
        }
        
        return backendId;
    }
    
    /**
     * Remove a backend server
     */
    async removeBackend(backendId) {
        const backend = this.backends.get(backendId);
        if (!backend) {
            throw new Error(`Backend ${backendId} not found`);
        }
        
        this.backends.delete(backendId);
        
        this.updateLoadDistribution();
        this.updateMetrics();
        
        this.emit('backendRemoved', backendId);
        console.log(`✅ Removed backend: ${backendId}`);
    }
    
    /**
     * Update backend configuration
     */
    async updateBackend(backendId, updates) {
        const backend = this.backends.get(backendId);
        if (!backend) {
            throw new Error(`Backend ${backendId} not found`);
        }
        
        // Update allowed properties
        const allowedUpdates = ['weight', 'maxConnections', 'metadata'];
        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                backend[key] = value;
            }
        }
        
        this.updateLoadDistribution();
        this.emit('backendUpdated', backendId, updates);
        
        console.log(`✅ Updated backend: ${backendId}`);
    }
    
    /**
     * Set backend health state
     */
    setBackendHealth(backendId, healthState, reason = '') {
        const backend = this.backends.get(backendId);
        if (!backend) {
            throw new Error(`Backend ${backendId} not found`);
        }
        
        const previousState = backend.health;
        backend.health = healthState;
        backend.lastHealthCheck = Date.now();
        
        if (previousState !== healthState) {
            this.emit('backendHealthChanged', {
                backendId,
                previousState,
                newState: healthState,
                reason
            });
            
            console.log(`🏥 Backend ${backendId} health: ${previousState} → ${healthState} (${reason})`);
        }
        
        this.updateMetrics();
    }
    
    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        if (this.healthMonitor) {
            clearInterval(this.healthMonitor);
        }
        
        this.healthMonitor = setInterval(async () => {
            await this.performHealthChecks();
        }, this.configuration.healthCheckInterval);
        
        console.log('🔍 Started load balancer health monitoring');
    }
    
    /**
     * Perform health checks on all backends
     */
    async performHealthChecks() {
        const healthCheckPromises = Array.from(this.backends.values()).map(backend => 
            this.performBackendHealthCheck(backend)
        );
        
        await Promise.allSettled(healthCheckPromises);
        this.updateMetrics();
    }
    
    /**
     * Perform health check on individual backend
     */
    async performBackendHealthCheck(backend) {
        if (backend.health === HealthStates.MAINTENANCE) {
            return; // Skip maintenance backends
        }
        
        const startTime = Date.now();
        
        try {
            // Simulate health check (in real implementation, this would be an HTTP request)
            const healthCheckPromise = this.simulateHealthCheck(backend);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), this.configuration.healthCheckTimeout);
            });
            
            await Promise.race([healthCheckPromise, timeoutPromise]);
            
            const responseTime = Date.now() - startTime;
            
            // Update backend metrics
            backend.metrics.responseTimes.push(responseTime);
            if (backend.metrics.responseTimes.length > 100) {
                backend.metrics.responseTimes.shift();
            }
            
            backend.metrics.averageResponseTime = backend.metrics.responseTimes.reduce((a, b) => a + b, 0) / backend.metrics.responseTimes.length;
            
            // Reset failure count on success
            backend.healthCheckFailures = 0;
            
            // Close circuit breaker if it was open
            if (backend.circuitBreakerOpen) {
                backend.circuitBreakerOpen = false;
                backend.circuitBreakerOpenTime = 0;
                this.emit('circuitBreakerClosed', backend.id);
            }
            
            // Update health state based on performance response time
            if (responseTime > this.configuration.healthCheckTimeout * 0.8) {
                this.setBackendHealth(backend.id, HealthStates.DEGRADED, 'slow_response');
            } else if (backend.health !== HealthStates.HEALTHY) {
                this.setBackendHealth(backend.id, HealthStates.HEALTHY, 'health_check_passed');
            }
            
        } catch (error) {
            backend.healthCheckFailures++;
            
            // Open circuit breaker if failure threshold reached
            if (backend.healthCheckFailures >= this.configuration.circuitBreakerThreshold && !backend.circuitBreakerOpen) {
                backend.circuitBreakerOpen = true;
                backend.circuitBreakerOpenTime = Date.now();
                this.emit('circuitBreakerOpened', backend.id, error);
            }
            
            // Update health state based on failures
            if (backend.healthCheckFailures >= this.configuration.circuitBreakerThreshold) {
                this.setBackendHealth(backend.id, HealthStates.UNHEALTHY, error.message);
            } else {
                this.setBackendHealth(backend.id, HealthStates.DEGRADED, error.message);
            }
            
            console.warn(`⚠️ Health check failed for backend ${backend.id}:`, error.message);
        }
    }
    
    /**
     * Simulate health check (replace with actual HTTP request in production)
     */
    async simulateHealthCheck(backend) {
        // Simulate occasional failures for testing
        if (Math.random() < 0.05) { // 5% failure rate
            throw new Error('Simulated health check failure');
        }
        
        // Simulate response time
        const delay = Math.random() * 200 + 50; // 50-250ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return { status: 'ok', responseTime: delay };
    }
    
    /**
     * Select next backend using configured algorithm
     */
    selectBackend(request = null) {
        const healthyBackends = Array.from(this.backends.values())
            .filter(backend => 
                backend.health === HealthStates.HEALTHY || 
                backend.health === HealthStates.DEGRADED
            )
            .filter(backend => !backend.circuitBreakerOpen);
        
        if (healthyBackends.length === 0) {
            throw new Error('No healthy backends available');
        }
        
        let selectedBackend;
        
        switch (this.configuration.algorithm) {
            case LoadBalancingAlgorithms.ROUND_ROBIN:
                selectedBackend = this.selectRoundRobin(healthyBackends);
                break;
                
            case LoadBalancingAlgorithms.LEAST_CONNECTIONS:
                selectedBackend = this.selectLeastConnections(healthyBackends);
                break;
                
            case LoadBalancingAlgorithms.WEIGHTED_ROUND_ROBIN:
                selectedBackend = this.selectWeightedRoundRobin(healthyBackends);
                break;
                
            case LoadBalancingAlgorithms.IP_HASH:
                selectedBackend = this.selectIpHash(healthyBackends, request);
                break;
                
            case LoadBalancingAlgorithms.LEAST_RESPONSE_TIME:
                selectedBackend = this.selectLeastResponseTime(healthyBackends);
                break;
                
            default:
                selectedBackend = this.selectRoundRobin(healthyBackends);
        }
        
        return selectedBackend;
    }
    
    /**
     * Round robin selection
     */
    selectRoundRobin(backends) {
        const selectedBackend = backends[this.currentBackendIndex % backends.length];
        this.currentBackendIndex = (this.currentBackendIndex + 1) % backends.length;
        return selectedBackend;
    }
    
    /**
     * Least connections selection
     */
    selectLeastConnections(backends) {
        return backends.reduce((min, backend) => 
            backend.currentConnections < min.currentConnections ? backend : min
        );
    }
    
    /**
     * Weighted round robin selection
     */
    selectWeightedRoundRobin(backends) {
        const totalWeight = backends.reduce((sum, backend) => sum + backend.weight, 0);
        const random = Math.random() * totalWeight;
        
        let currentWeight = 0;
        for (const backend of backends) {
            currentWeight += backend.weight;
            if (random <= currentWeight) {
                return backend;
            }
        }
        
        return backends[0]; // Fallback
    }
    
    /**
     * IP hash selection
     */
    selectIpHash(backends, request) {
        if (!request || !request.ip) {
            return this.selectRoundRobin(backends);
        }
        
        // Simple hash of IP address
        const hash = request.ip.split('.').reduce((acc, octet) => acc + parseInt(octet), 0);
        return backends[hash % backends.length];
    }
    
    /**
     * Least response time selection
     */
    selectLeastResponseTime(backends) {
        return backends.reduce((min, backend) => 
            backend.metrics.averageResponseTime < min.metrics.averageResponseTime ? backend : min
        );
    }
    
    /**
     * Record request metrics
     */
    recordRequest(backendId, success, responseTime) {
        const backend = this.backends.get(backendId);
        if (!backend) return;
        
        backend.metrics.totalRequests++;
        backend.metrics.lastRequestTime = Date.now();
        
        if (success) {
            backend.metrics.successfulRequests++;
            backend.metrics.responseTimes.push(responseTime);
            
            if (backend.metrics.responseTimes.length > 100) {
                backend.metrics.responseTimes.shift();
            }
            
            backend.metrics.averageResponseTime = 
                backend.metrics.responseTimes.reduce((a, b) => a + b, 0) / backend.metrics.responseTimes.length;
        } else {
            backend.metrics.failedRequests++;
        }
        
        // Record in global history for RPS calculation
        this.requestHistory.push({
            timestamp: Date.now(),
            backendId,
            success,
            responseTime
        });
        
        // Keep only last minute of history
        const oneMinuteAgo = Date.now() - 60000;
        this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
    }
    
    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        setInterval(() => {
            this.updateMetrics();
        }, 10000); // Update every 10 seconds
    }
    
    /**
     * Update load distribution (for weighted algorithms)
     */
    updateLoadDistribution() {
        // Reset round-robin index when backends change
        this.currentBackendIndex = 0;
        
        // Emit event for external load balancer configuration updates
        this.emit('distributionUpdated', this.getBalancerConfiguration());
    }
    
    /**
     * Update global metrics
     */
    updateMetrics() {
        const backends = Array.from(this.backends.values());
        
        this.metrics.totalBackends = backends.length;
        this.metrics.healthyBackends = backends.filter(b => b.health === HealthStates.HEALTHY).length;
        this.metrics.degradedBackends = backends.filter(b => b.health === HealthStates.DEGRADED).length;
        this.metrics.unhealthyBackends = backends.filter(b => b.health === HealthStates.UNHEALTHY).length;
        
        this.metrics.totalRequests = backends.reduce((sum, b) => sum + b.metrics.totalRequests, 0);
        this.metrics.successfulRequests = backends.reduce((sum, b) => sum + b.metrics.successfulRequests, 0);
        this.metrics.failedRequests = backends.reduce((sum, b) => sum + b.metrics.failedRequests, 0);
        
        if (backends.length > 0) {
            this.metrics.averageResponseTime = backends.reduce((sum, b) => sum + b.metrics.averageResponseTime, 0) / backends.length;
        }
        
        // Calculate requests per second from history
        const now = Date.now();
        const lastMinuteRequests = this.requestHistory.filter(req => req.timestamp > now - 60000);
        this.metrics.requestsPerSecond = lastMinuteRequests.length / 60;
    }
    
    /**
     * Get balancer metrics
     */
    getBalancerMetrics() {
        return {
            global: this.metrics,
            backends: Array.from(this.backends.values()).map(backend => ({
                id: backend.id,
                host: backend.host,
                port: backend.port,
                health: backend.health,
                weight: backend.weight,
                currentConnections: backend.currentConnections,
                maxConnections: backend.maxConnections,
                metrics: backend.metrics,
                circuitBreakerOpen: backend.circuitBreakerOpen,
                lastHealthCheck: backend.lastHealthCheck
            }))
        };
    }
    
    /**
     * Get balancer configuration
     */
    getBalancerConfiguration() {
        return {
            algorithm: this.configuration.algorithm,
            backends: Array.from(this.backends.values()).map(backend => ({
                id: backend.id,
                host: backend.host,
                port: backend.port,
                weight: backend.weight,
                maxConnections: backend.maxConnections,
                health: backend.health
            })),
            configuration: this.configuration
        };
    }
    
    /**
     * Update load balancer configuration
     */
    updateConfiguration(newConfig) {
        const oldAlgorithm = this.configuration.algorithm;
        
        this.configuration = { ...this.configuration, ...newConfig };
        
        if (newConfig.algorithm && newConfig.algorithm !== oldAlgorithm) {
            this.updateLoadDistribution();
        }
        
        if (newConfig.healthCheckInterval) {
            this.startHealthMonitoring();
        }
        
        this.emit('configurationUpdated', this.configuration);
    }
    
    /**
     * Get balancer status
     */
    getBalancerStatus() {
        return {
            isInitialized: this.isInitialized,
            algorithm: this.configuration.algorithm,
            totalBackends: this.metrics.totalBackends,
            healthyBackends: this.metrics.healthyBackends,
            degradedBackends: this.metrics.degradedBackends,
            unhealthyBackends: this.metrics.unhealthyBackends,
            requestsPerSecond: this.metrics.requestsPerSecond,
            averageResponseTime: this.metrics.averageResponseTime
        };
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('⚖️  Shutting down Load Balancer Configuration Service...');
        
        if (this.healthMonitor) {
            clearInterval(this.healthMonitor);
        }
        
        this.backends.clear();
        this.requestHistory = [];
        this.isInitialized = false;
        
        console.log('✅ Load Balancer Configuration Service shutdown complete');
    }
}
