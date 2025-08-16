/**
 * Service Mesh Controller
 * 
 * Comprehensive microservices communication infrastructure with service discovery,
 * load balancing, traffic management, security policies, and observability.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ServiceMeshController extends EventEmitter {
    constructor(db, config = {}) {
        super();
        this.db = db;
        this.config = {
            meshName: config.meshName || 'cartrita-mesh',
            serviceName: config.serviceName || 'cartrita-service',
            meshVersion: config.meshVersion || '1.0.0',
            
            // Service Discovery
            discoveryEnabled: config.discoveryEnabled !== false,
            discoveryInterval: config.discoveryInterval || 30000, // 30 seconds
            healthCheckInterval: config.healthCheckInterval || 10000, // 10 seconds
            serviceTimeout: config.serviceTimeout || 5000, // 5 seconds
            
            // Load Balancing
            loadBalancingStrategy: config.loadBalancingStrategy || 'round_robin', // round_robin, weighted, least_connections
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            
            // Traffic Management
            trafficSplitting: config.trafficSplitting !== false,
            rateLimiting: config.rateLimiting !== false,
            rateLimit: config.rateLimit || 1000, // requests per minute
            circuitBreakerEnabled: config.circuitBreakerEnabled !== false,
            
            // Security
            mtlsEnabled: config.mtlsEnabled !== false,
            authenticationRequired: config.authenticationRequired !== false,
            authorizationEnabled: config.authorizationEnabled !== false,
            
            // Observability
            tracingEnabled: config.tracingEnabled !== false,
            metricsEnabled: config.metricsEnabled !== false,
            loggingEnabled: config.loggingEnabled !== false,
            
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('service-mesh-controller');
        this.initialized = false;
        this.isRunning = false;

        // Service Registry
        this.serviceRegistry = new Map();
        this.serviceHealthStatus = new Map();
        this.loadBalancingState = new Map();
        
        // Traffic Management
        this.trafficSplits = new Map();
        this.rateLimitCounters = new Map();
        this.circuitBreakerStates = new Map();
        
        // Metrics and Monitoring
        this.metrics = {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            service_discoveries: 0,
            load_balance_operations: 0,
            traffic_splits: 0,
            circuit_breaker_trips: 0,
            rate_limit_hits: 0,
            avg_response_time: 0
        };

        // Internal state
        this.discoveryIntervalId = null;
        this.healthCheckIntervalId = null;
        this.requestHistory = [];
        this.connectionPools = new Map();
    }

    /**
     * Initialize Service Mesh Controller
     */
    async initialize() {
        const span = this.tracer.startSpan('service-mesh-controller.initialize');
        
        try {
            console.log('[ServiceMeshController] Initializing service mesh controller...');

            // Initialize database tables if needed
            await this.initializeTables();

            // Load existing services from database
            await this.loadServicesFromDatabase();

            // Start service discovery if enabled
            if (this.config.discoveryEnabled) {
                await this.startServiceDiscovery();
            }

            // Start health checking if enabled
            await this.startHealthChecking();

            // Initialize security components
            await this.initializeSecurity();

            // Initialize observability
            await this.initializeObservability();

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'mesh.name': this.config.meshName,
                'mesh.version': this.config.meshVersion,
                'services.count': this.serviceRegistry.size,
                'discovery.enabled': this.config.discoveryEnabled,
                'security.mtls': this.config.mtlsEnabled
            });

            console.log('[ServiceMeshController] Service mesh controller initialized successfully');

            this.emit('initialized');
            return { success: true, meshId: this.config.meshName };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error('[ServiceMeshController] Failed to initialize:', error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Register a service in the mesh
     */
    async registerService(serviceInfo) {
        const span = this.tracer.startSpan('service-mesh-controller.register-service');
        
        try {
            // Validate service information
            this.validateServiceInfo(serviceInfo);

            const serviceId = serviceInfo.id || uuidv4();
            const registrationData = {
                id: serviceId,
                name: serviceInfo.name,
                version: serviceInfo.version || '1.0.0',
                endpoints: serviceInfo.endpoints || [],
                metadata: serviceInfo.metadata || {},
                tags: serviceInfo.tags || [],
                healthCheck: serviceInfo.healthCheck || { enabled: false },
                createdAt: new Date(),
                lastSeen: new Date(),
                status: 'healthy'
            };

            // Add to service registry
            this.serviceRegistry.set(serviceId, registrationData);

            // Initialize health status
            this.serviceHealthStatus.set(serviceId, {
                status: 'unknown',
                lastCheck: null,
                consecutiveFailures: 0,
                uptime: 0,
                responseTime: 0
            });

            // Initialize load balancing state
            this.loadBalancingState.set(serviceId, {
                connections: 0,
                weight: serviceInfo.weight || 1,
                lastUsed: 0,
                totalRequests: 0,
                failureRate: 0
            });

            // Save to database
            await this.saveServiceToDatabase(registrationData);

            // Start health monitoring for this service
            if (registrationData.healthCheck.enabled) {
                await this.performHealthCheck(serviceId);
            }

            this.metrics.service_discoveries++;

            span.setAttributes({
                'service.id': serviceId,
                'service.name': registrationData.name,
                'service.version': registrationData.version,
                'service.endpoints': registrationData.endpoints.length
            });

            console.log(`[ServiceMeshController] Service registered: ${registrationData.name} (${serviceId})`);

            this.emit('serviceRegistered', registrationData);
            return { success: true, serviceId, registrationData };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Discover and route request to appropriate service
     */
    async routeRequest(requestInfo) {
        const span = this.tracer.startSpan('service-mesh-controller.route-request');
        const startTime = Date.now();
        
        try {
            this.metrics.total_requests++;

            // Validate request
            this.validateRequestInfo(requestInfo);

            // Apply rate limiting
            if (this.config.rateLimiting) {
                const rateLimitResult = await this.applyRateLimit(requestInfo);
                if (!rateLimitResult.allowed) {
                    this.metrics.rate_limit_hits++;
                    throw new Error('Rate limit exceeded');
                }
            }

            // Discover available services
            const availableServices = await this.discoverServices(requestInfo.serviceName);
            if (availableServices.length === 0) {
                throw new Error(`No healthy instances found for service: ${requestInfo.serviceName}`);
            }

            // Apply traffic splitting if configured
            const targetServices = await this.applyTrafficSplitting(requestInfo, availableServices);

            // Select service using load balancing
            const selectedService = await this.selectServiceWithLoadBalancing(targetServices);

            // Check circuit breaker
            const circuitBreakerResult = await this.checkCircuitBreaker(selectedService.id);
            if (!circuitBreakerResult.allowed) {
                this.metrics.circuit_breaker_trips++;
                throw new Error(`Circuit breaker open for service: ${selectedService.name}`);
            }

            // Execute request with retry logic
            const response = await this.executeRequestWithRetries(selectedService, requestInfo);

            // Update metrics and monitoring
            await this.updateServiceMetrics(selectedService.id, true, Date.now() - startTime);
            
            this.metrics.successful_requests++;
            const responseTime = Date.now() - startTime;
            this.metrics.avg_response_time = (this.metrics.avg_response_time + responseTime) / 2;

            span.setAttributes({
                'request.service': requestInfo.serviceName,
                'request.method': requestInfo.method,
                'selected.service.id': selectedService.id,
                'response.time': responseTime,
                'response.success': true
            });

            console.log(`[ServiceMeshController] Request routed successfully to ${selectedService.name}`);

            return {
                success: true,
                response: response,
                selectedService: selectedService.id,
                responseTime: responseTime,
                routingMetadata: {
                    availableServices: availableServices.length,
                    loadBalancingStrategy: this.config.loadBalancingStrategy,
                    trafficSplit: targetServices.length !== availableServices.length
                }
            };

        } catch (error) {
            this.metrics.failed_requests++;
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error('[ServiceMeshController] Request routing failed:', error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Apply traffic splitting based on configuration
     */
    async applyTrafficSplitting(requestInfo, availableServices) {
        if (!this.config.trafficSplitting || availableServices.length <= 1) {
            return availableServices;
        }

        const serviceName = requestInfo.serviceName;
        const trafficSplit = this.trafficSplits.get(serviceName);
        
        if (!trafficSplit) {
            return availableServices;
        }

        const rand = Math.random() * 100;
        let cumulativeWeight = 0;

        for (const split of trafficSplit.splits) {
            cumulativeWeight += split.weight;
            if (rand <= cumulativeWeight) {
                const targetServices = availableServices.filter(service => 
                    split.version ? service.version === split.version : true
                );
                
                if (targetServices.length > 0) {
                    this.metrics.traffic_splits++;
                    return targetServices;
                }
            }
        }

        return availableServices;
    }

    /**
     * Select service using load balancing strategy
     */
    async selectServiceWithLoadBalancing(services) {
        if (services.length === 1) {
            return services[0];
        }

        this.metrics.load_balance_operations++;

        switch (this.config.loadBalancingStrategy) {
            case 'round_robin':
                return this.selectRoundRobin(services);
            case 'weighted':
                return this.selectWeighted(services);
            case 'least_connections':
                return this.selectLeastConnections(services);
            default:
                return services[Math.floor(Math.random() * services.length)];
        }
    }

    /**
     * Round robin load balancing
     */
    selectRoundRobin(services) {
        const now = Date.now();
        let selectedService = services[0];
        let earliestLastUsed = Infinity;

        for (const service of services) {
            const state = this.loadBalancingState.get(service.id);
            if (state && state.lastUsed < earliestLastUsed) {
                earliestLastUsed = state.lastUsed;
                selectedService = service;
            }
        }

        // Update last used time
        const state = this.loadBalancingState.get(selectedService.id);
        if (state) {
            state.lastUsed = now;
        }

        return selectedService;
    }

    /**
     * Weighted load balancing
     */
    selectWeighted(services) {
        const totalWeight = services.reduce((sum, service) => {
            const state = this.loadBalancingState.get(service.id);
            return sum + (state ? state.weight : 1);
        }, 0);

        const rand = Math.random() * totalWeight;
        let cumulativeWeight = 0;

        for (const service of services) {
            const state = this.loadBalancingState.get(service.id);
            const weight = state ? state.weight : 1;
            cumulativeWeight += weight;

            if (rand <= cumulativeWeight) {
                return service;
            }
        }

        return services[services.length - 1];
    }

    /**
     * Least connections load balancing
     */
    selectLeastConnections(services) {
        let selectedService = services[0];
        let minConnections = Infinity;

        for (const service of services) {
            const state = this.loadBalancingState.get(service.id);
            const connections = state ? state.connections : 0;

            if (connections < minConnections) {
                minConnections = connections;
                selectedService = service;
            }
        }

        // Update connection count
        const state = this.loadBalancingState.get(selectedService.id);
        if (state) {
            state.connections++;
        }

        return selectedService;
    }

    /**
     * Execute request with retry logic
     */
    async executeRequestWithRetries(service, requestInfo) {
        let lastError;
        let attempt = 0;

        while (attempt < this.config.maxRetries) {
            try {
                // Increment connection count
                const state = this.loadBalancingState.get(service.id);
                if (state) {
                    state.connections++;
                    state.totalRequests++;
                }

                // Execute the actual request (mock implementation)
                const response = await this.executeRequest(service, requestInfo);

                // Decrement connection count on success
                if (state) {
                    state.connections = Math.max(0, state.connections - 1);
                }

                return response;

            } catch (error) {
                lastError = error;
                attempt++;

                // Decrement connection count on error
                const state = this.loadBalancingState.get(service.id);
                if (state) {
                    state.connections = Math.max(0, state.connections - 1);
                    state.failureRate = (state.failureRate + 1) / 2; // Simple moving average
                }

                if (attempt < this.config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
                }
            }
        }

        throw lastError;
    }

    /**
     * Execute actual request to service (mock implementation)
     */
    async executeRequest(service, requestInfo) {
        // This would normally make an actual HTTP/gRPC request
        // For now, we'll simulate the request
        const delay = 50 + Math.random() * 100; // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, delay));

        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
            throw new Error('Service temporarily unavailable');
        }

        return {
            success: true,
            data: `Response from ${service.name}`,
            timestamp: new Date().toISOString(),
            serviceId: service.id,
            responseTime: delay
        };
    }

    /**
     * Apply rate limiting
     */
    async applyRateLimit(requestInfo) {
        const key = requestInfo.clientId || requestInfo.source || 'default';
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window

        let counter = this.rateLimitCounters.get(key);
        if (!counter) {
            counter = { requests: [], totalRequests: 0 };
            this.rateLimitCounters.set(key, counter);
        }

        // Remove old requests outside the window
        counter.requests = counter.requests.filter(timestamp => timestamp > windowStart);

        // Check if rate limit exceeded
        if (counter.requests.length >= this.config.rateLimit) {
            return { allowed: false, remaining: 0, resetTime: windowStart + 60000 };
        }

        // Add current request
        counter.requests.push(now);
        counter.totalRequests++;

        return {
            allowed: true,
            remaining: this.config.rateLimit - counter.requests.length,
            resetTime: windowStart + 60000,
            totalRequests: counter.totalRequests
        };
    }

    /**
     * Check circuit breaker status
     */
    async checkCircuitBreaker(serviceId) {
        const state = this.circuitBreakerStates.get(serviceId);
        if (!state) {
            // Initialize circuit breaker state
            this.circuitBreakerStates.set(serviceId, {
                state: 'closed', // closed, open, half-open
                failures: 0,
                lastFailureTime: null,
                successCount: 0,
                requestCount: 0
            });
            return { allowed: true, state: 'closed' };
        }

        const now = Date.now();

        switch (state.state) {
            case 'closed':
                return { allowed: true, state: 'closed' };

            case 'open':
                // Check if enough time has passed to try half-open
                if (now - state.lastFailureTime > 30000) { // 30 seconds
                    state.state = 'half-open';
                    state.requestCount = 0;
                    return { allowed: true, state: 'half-open' };
                }
                return { allowed: false, state: 'open' };

            case 'half-open':
                // Allow limited requests in half-open state
                return { allowed: state.requestCount < 3, state: 'half-open' };

            default:
                return { allowed: true, state: 'closed' };
        }
    }

    /**
     * Update service metrics after request
     */
    async updateServiceMetrics(serviceId, success, responseTime) {
        const healthStatus = this.serviceHealthStatus.get(serviceId);
        if (healthStatus) {
            healthStatus.lastCheck = new Date();
            healthStatus.responseTime = (healthStatus.responseTime + responseTime) / 2;

            if (success) {
                healthStatus.consecutiveFailures = 0;
                if (healthStatus.status !== 'healthy') {
                    healthStatus.status = 'healthy';
                    console.log(`[ServiceMeshController] Service ${serviceId} marked as healthy`);
                }
            } else {
                healthStatus.consecutiveFailures++;
                if (healthStatus.consecutiveFailures >= 3 && healthStatus.status !== 'unhealthy') {
                    healthStatus.status = 'unhealthy';
                    console.log(`[ServiceMeshController] Service ${serviceId} marked as unhealthy`);
                }
            }
        }

        // Update circuit breaker state
        const circuitState = this.circuitBreakerStates.get(serviceId);
        if (circuitState) {
            circuitState.requestCount++;

            if (success) {
                circuitState.successCount++;
                circuitState.failures = Math.max(0, circuitState.failures - 1);

                // Reset circuit breaker if enough successful requests
                if (circuitState.state === 'half-open' && circuitState.successCount >= 3) {
                    circuitState.state = 'closed';
                    circuitState.failures = 0;
                    console.log(`[ServiceMeshController] Circuit breaker closed for service ${serviceId}`);
                }
            } else {
                circuitState.failures++;
                circuitState.lastFailureTime = Date.now();

                // Trip circuit breaker on too many failures
                if (circuitState.state === 'closed' && circuitState.failures >= 5) {
                    circuitState.state = 'open';
                    console.log(`[ServiceMeshController] Circuit breaker opened for service ${serviceId}`);
                } else if (circuitState.state === 'half-open') {
                    circuitState.state = 'open';
                    console.log(`[ServiceMeshController] Circuit breaker reopened for service ${serviceId}`);
                }
            }
        }
    }

    /**
     * Configure traffic splitting
     */
    async configureTrafficSplit(serviceName, splits) {
        // Validate splits
        const totalWeight = splits.reduce((sum, split) => sum + split.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
            throw new Error('Traffic split weights must sum to 100');
        }

        this.trafficSplits.set(serviceName, {
            serviceName,
            splits,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`[ServiceMeshController] Traffic split configured for ${serviceName}`);
        return { success: true };
    }

    /**
     * Get service mesh status
     */
    getStatus() {
        const healthyServices = Array.from(this.serviceHealthStatus.values())
            .filter(status => status.status === 'healthy').length;

        return {
            service: 'ServiceMeshController',
            initialized: this.initialized,
            running: this.isRunning,
            mesh: {
                name: this.config.meshName,
                version: this.config.meshVersion,
                services: {
                    total: this.serviceRegistry.size,
                    healthy: healthyServices,
                    unhealthy: this.serviceRegistry.size - healthyServices
                },
                features: {
                    service_discovery: this.config.discoveryEnabled,
                    load_balancing: true,
                    traffic_splitting: this.config.trafficSplitting,
                    rate_limiting: this.config.rateLimiting,
                    circuit_breaker: this.config.circuitBreakerEnabled,
                    security: this.config.mtlsEnabled
                }
            },
            metrics: this.metrics,
            traffic_splits: this.trafficSplits.size,
            circuit_breakers: this.circuitBreakerStates.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate service information
     */
    validateServiceInfo(serviceInfo) {
        if (!serviceInfo || typeof serviceInfo !== 'object') {
            throw new Error('Service information is required');
        }

        if (!serviceInfo.name || typeof serviceInfo.name !== 'string') {
            throw new Error('Service name is required and must be a string');
        }

        if (serviceInfo.endpoints && !Array.isArray(serviceInfo.endpoints)) {
            throw new Error('Service endpoints must be an array');
        }
    }

    /**
     * Validate request information
     */
    validateRequestInfo(requestInfo) {
        if (!requestInfo || typeof requestInfo !== 'object') {
            throw new Error('Request information is required');
        }

        if (!requestInfo.serviceName || typeof requestInfo.serviceName !== 'string') {
            throw new Error('Service name is required for routing');
        }

        if (!requestInfo.method || typeof requestInfo.method !== 'string') {
            throw new Error('Request method is required');
        }
    }

    /**
     * Initialize database tables
     */
    async initializeTables() {
        // This would normally create the necessary database tables
        // For now, we'll just log that tables are initialized
        console.log('[ServiceMeshController] Database tables initialized (mocked)');
    }

    /**
     * Load services from database
     */
    async loadServicesFromDatabase() {
        // This would normally load existing services from the database
        console.log('[ServiceMeshController] Services loaded from database (mocked)');
    }

    /**
     * Save service to database
     */
    async saveServiceToDatabase(serviceData) {
        // This would normally save the service data to the database
        console.log(`[ServiceMeshController] Service saved to database: ${serviceData.name} (mocked)`);
    }

    /**
     * Start service discovery process
     */
    async startServiceDiscovery() {
        if (this.discoveryIntervalId) {
            clearInterval(this.discoveryIntervalId);
        }

        this.discoveryIntervalId = setInterval(async () => {
            try {
                await this.performServiceDiscovery();
            } catch (error) {
                console.error('[ServiceMeshController] Service discovery error:', error);
            }
        }, this.config.discoveryInterval);

        console.log('[ServiceMeshController] Service discovery started');
    }

    /**
     * Start health checking process
     */
    async startHealthChecking() {
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
        }

        this.healthCheckIntervalId = setInterval(async () => {
            try {
                for (const serviceId of this.serviceRegistry.keys()) {
                    await this.performHealthCheck(serviceId);
                }
            } catch (error) {
                console.error('[ServiceMeshController] Health check error:', error);
            }
        }, this.config.healthCheckInterval);

        console.log('[ServiceMeshController] Health checking started');
    }

    /**
     * Perform service discovery
     */
    async performServiceDiscovery() {
        // This would normally discover services from external sources
        // For now, we'll just update the last seen timestamp for existing services
        for (const [serviceId, service] of this.serviceRegistry) {
            service.lastSeen = new Date();
        }
    }

    /**
     * Perform health check for a service
     */
    async performHealthCheck(serviceId) {
        const service = this.serviceRegistry.get(serviceId);
        if (!service || !service.healthCheck.enabled) {
            return;
        }

        const startTime = Date.now();
        let isHealthy = true;

        try {
            // Simulate health check (would normally make HTTP request to health endpoint)
            await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));
            
            // Simulate occasional health check failures
            if (Math.random() < 0.02) { // 2% failure rate
                throw new Error('Health check failed');
            }

        } catch (error) {
            isHealthy = false;
        }

        const responseTime = Date.now() - startTime;
        
        // Update health status
        const healthStatus = this.serviceHealthStatus.get(serviceId);
        if (healthStatus) {
            healthStatus.lastCheck = new Date();
            healthStatus.responseTime = responseTime;

            if (isHealthy) {
                healthStatus.consecutiveFailures = 0;
                if (healthStatus.status !== 'healthy') {
                    healthStatus.status = 'healthy';
                    console.log(`[ServiceMeshController] Service ${service.name} is now healthy`);
                    this.emit('serviceHealthy', { serviceId, service });
                }
            } else {
                healthStatus.consecutiveFailures++;
                if (healthStatus.consecutiveFailures >= 2 && healthStatus.status !== 'unhealthy') {
                    healthStatus.status = 'unhealthy';
                    console.log(`[ServiceMeshController] Service ${service.name} is now unhealthy`);
                    this.emit('serviceUnhealthy', { serviceId, service });
                }
            }
        }
    }

    /**
     * Discover available services by name
     */
    async discoverServices(serviceName) {
        const services = [];
        
        for (const [serviceId, service] of this.serviceRegistry) {
            if (service.name === serviceName) {
                const healthStatus = this.serviceHealthStatus.get(serviceId);
                if (healthStatus && healthStatus.status === 'healthy') {
                    services.push({ ...service, id: serviceId });
                }
            }
        }

        return services;
    }

    /**
     * Initialize security components
     */
    async initializeSecurity() {
        if (this.config.mtlsEnabled) {
            console.log('[ServiceMeshController] mTLS security initialized (mocked)');
        }
        
        if (this.config.authenticationRequired) {
            console.log('[ServiceMeshController] Authentication security initialized (mocked)');
        }

        if (this.config.authorizationEnabled) {
            console.log('[ServiceMeshController] Authorization security initialized (mocked)');
        }
    }

    /**
     * Initialize observability components
     */
    async initializeObservability() {
        if (this.config.tracingEnabled) {
            console.log('[ServiceMeshController] Distributed tracing initialized');
        }
        
        if (this.config.metricsEnabled) {
            console.log('[ServiceMeshController] Metrics collection initialized');
        }

        if (this.config.loggingEnabled) {
            console.log('[ServiceMeshController] Structured logging initialized');
        }
    }

    /**
     * Shutdown service mesh controller
     */
    async shutdown() {
        console.log('[ServiceMeshController] Shutting down service mesh controller...');

        if (this.discoveryIntervalId) {
            clearInterval(this.discoveryIntervalId);
            this.discoveryIntervalId = null;
        }

        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = null;
        }

        // Clear all state
        this.serviceRegistry.clear();
        this.serviceHealthStatus.clear();
        this.loadBalancingState.clear();
        this.trafficSplits.clear();
        this.rateLimitCounters.clear();
        this.circuitBreakerStates.clear();

        this.isRunning = false;
        console.log('[ServiceMeshController] Service mesh controller shutdown complete');
    }
}

export default ServiceMeshController;
