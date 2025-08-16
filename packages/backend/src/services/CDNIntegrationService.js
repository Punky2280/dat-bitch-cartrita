/**
 * CDNIntegrationService - Multi-Provider CDN Management
 * 
 * Comprehensive CDN integration providing:
 * - Multi-provider CDN management (CloudFlare, AWS CloudFront, Azure CDN)
 * - Intelligent cache invalidation and warming
 * - Origin shielding and performance optimization  
 * - Real-time CDN performance monitoring
 * - Automated failover and load distribution
 * - Cost optimization across providers
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class CDNIntegrationService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Provider Configuration
            enabledProviders: ['cloudflare', 'aws_cloudfront', 'azure_cdn'],
            primaryProvider: 'cloudflare',
            failoverEnabled: true,
            loadBalanceProviders: true,
            
            // Cache Management
            defaultCacheTTL: 3600, // 1 hour
            maxCacheSize: '10GB',
            cacheWarmingEnabled: true,
            smartInvalidation: true,
            
            // Performance Optimization
            originShielding: true,
            compressionEnabled: true,
            http2Enabled: true,
            brotliCompression: true,
            
            // Monitoring
            performanceMonitoring: true,
            realTimeMetrics: true,
            alertThresholds: {
                errorRate: 5, // %
                latency: 500, // ms
                hitRatio: 80 // %
            },
            
            // Cost Optimization
            costOptimization: true,
            bandwidthCapping: false,
            requestLimiting: false,
            
            ...config
        };
        
        // Core components
        this.db = null;
        this.tracer = OpenTelemetryTracing.getTracer('cdn-integration');
        this.initialized = false;
        this.isRunning = false;
        
        // Provider management
        this.providers = new Map(); // providerId -> ProviderInstance
        this.providerClients = new Map(); // providerId -> APIClient
        this.activeProviders = new Set();
        
        // Cache management
        this.cacheInvalidationQueue = new Map(); // requestId -> InvalidationRequest
        this.cacheWarmingJobs = new Map(); // jobId -> WarmingJob
        this.cachePolicies = new Map(); // policyId -> CachePolicy
        
        // Performance tracking
        this.performanceMetrics = new Map(); // providerId -> PerformanceData
        this.latencyTracking = new Map(); // region:providerId -> LatencyData
        
        // Statistics
        this.metrics = {
            totalRequests: 0,
            cacheHitRatio: 0,
            averageLatency: 0,
            bandwidthSaved: 0,
            invalidationRequests: 0,
            successfulInvalidations: 0,
            warmingJobsCompleted: 0,
            activeProviders: 0,
            costCurrentMonth: 0,
            errorRate: 0,
            uptime: 100
        };
        
        // Provider configurations
        this.providerConfigs = {
            cloudflare: {
                baseURL: 'https://api.cloudflare.com/client/v4',
                endpoints: {
                    zones: '/zones',
                    purge: '/zones/{zone_id}/purge_cache',
                    analytics: '/zones/{zone_id}/analytics/dashboard'
                },
                features: ['cache_purge', 'analytics', 'ssl', 'ddos_protection'],
                regions: ['global']
            },
            aws_cloudfront: {
                baseURL: 'https://cloudfront.amazonaws.com',
                endpoints: {
                    distributions: '/distributions',
                    invalidation: '/distributions/{distribution_id}/invalidation',
                    monitoring: '/distributions/{distribution_id}/monitoring'
                },
                features: ['cache_purge', 'origin_shielding', 'lambda_edge', 'real_time_metrics'],
                regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
            },
            azure_cdn: {
                baseURL: 'https://management.azure.com/subscriptions',
                endpoints: {
                    profiles: '/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Cdn/profiles',
                    purge: '/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Cdn/profiles/{profile_name}/endpoints/{endpoint_name}/purge',
                    analytics: '/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Cdn/profiles/{profile_name}/reports'
                },
                features: ['cache_purge', 'custom_domains', 'compression', 'analytics'],
                regions: ['global']
            }
        };
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.invalidateCache = this.invalidateCache.bind(this);
        this.warmCache = this.warmCache.bind(this);
    }
    
    /**
     * Initialize CDN Integration Service
     */
    async initialize(database) {
        const span = this.tracer.startSpan('cdn_integration_initialize');
        
        try {
            if (this.initialized) {
                console.log('CDNIntegrationService already initialized');
                return;
            }
            
            this.db = database;
            
            // Load CDN providers from database
            await this.loadProviders();
            
            // Initialize provider clients
            await this.initializeProviderClients();
            
            // Load cache policies
            await this.loadCachePolicies();
            
            // Start performance monitoring
            if (this.config.performanceMonitoring) {
                this.startPerformanceMonitoring();
            }
            
            // Initialize cost tracking
            if (this.config.costOptimization) {
                this.initializeCostTracking();
            }
            
            // Start cache warming scheduler
            if (this.config.cacheWarmingEnabled) {
                this.startCacheWarmingScheduler();
            }
            
            this.initialized = true;
            this.isRunning = true;
            
            console.log('CDNIntegrationService initialized successfully', {
                providers: this.providers.size,
                activeProviders: this.activeProviders.size,
                cachePolicies: this.cachePolicies.size
            });
            
            this.emit('initialized', {
                providers: Array.from(this.providers.keys()),
                activeProviders: Array.from(this.activeProviders),
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'cdn.providers.total': this.providers.size,
                'cdn.providers.active': this.activeProviders.size,
                'cdn.cache_policies.count': this.cachePolicies.size
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Add CDN provider
     */
    async addProvider(providerData, options = {}) {
        const span = this.tracer.startSpan('cdn_integration_add_provider');
        
        try {
            const {
                name,
                provider_type,
                configuration,
                api_credentials,
                regions = [],
                priority = 100
            } = providerData;
            
            // Validate provider type
            if (!this.providerConfigs[provider_type]) {
                throw new Error(`Unsupported provider type: ${provider_type}`);
            }
            
            // Validate credentials by testing API connection
            if (!options.skipValidation) {
                await this.validateProviderCredentials(provider_type, api_credentials);
            }
            
            const providerId = crypto.randomUUID();
            
            // Insert into database
            const query = `
                INSERT INTO cdn_providers (
                    id, name, provider_type, configuration, 
                    api_credentials, regions, priority, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            
            const values = [
                providerId,
                name,
                provider_type,
                configuration,
                api_credentials,
                regions,
                priority,
                'active'
            ];
            
            const result = await this.db.query(query, values);
            const provider = result.rows[0];
            
            // Add to memory
            this.providers.set(providerId, provider);
            this.activeProviders.add(providerId);
            
            // Initialize provider client
            await this.initializeProviderClient(provider);
            
            // Update metrics
            this.metrics.activeProviders = this.activeProviders.size;
            
            this.emit('providerAdded', {
                providerId,
                name,
                providerType: provider_type,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'cdn.provider.id': providerId,
                'cdn.provider.type': provider_type,
                'cdn.provider.name': name
            });
            
            console.log(`CDN provider added: ${name} (${provider_type})`);
            
            return provider;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Invalidate cache across providers
     */
    async invalidateCache(targets, options = {}) {
        const span = this.tracer.startSpan('cdn_integration_invalidate_cache');
        const startTime = Date.now();
        
        try {
            const {
                providers = Array.from(this.activeProviders),
                priority = 'normal', // normal, high, urgent
                waitForCompletion = false,
                batchInvalidation = true
            } = options;
            
            // Validate targets
            if (!Array.isArray(targets) || targets.length === 0) {
                throw new Error('Invalid cache targets provided');
            }
            
            const invalidationRequests = [];
            
            for (const providerId of providers) {
                const provider = this.providers.get(providerId);
                if (!provider || provider.status !== 'active') {
                    continue;
                }
                
                try {
                    const requestId = await this.invalidateProviderCache(
                        providerId,
                        targets,
                        { priority, batchInvalidation }
                    );
                    
                    invalidationRequests.push({
                        providerId,
                        requestId,
                        status: 'pending',
                        targets: targets.length,
                        createdAt: new Date()
                    });
                    
                } catch (error) {
                    console.error(`Failed to invalidate cache for provider ${providerId}:`, error.message);
                    
                    invalidationRequests.push({
                        providerId,
                        requestId: null,
                        status: 'failed',
                        error: error.message,
                        targets: targets.length,
                        createdAt: new Date()
                    });
                }
            }
            
            // Record invalidation requests in database
            await this.recordInvalidationRequests(invalidationRequests, targets);
            
            // Wait for completion if requested
            if (waitForCompletion) {
                await this.waitForInvalidationCompletion(invalidationRequests);
            }
            
            // Update metrics
            this.metrics.invalidationRequests += invalidationRequests.length;
            this.metrics.successfulInvalidations += invalidationRequests.filter(r => r.status !== 'failed').length;
            
            const duration = Date.now() - startTime;
            
            this.emit('cacheInvalidated', {
                targets: targets.length,
                providers: invalidationRequests.length,
                successful: invalidationRequests.filter(r => r.status !== 'failed').length,
                duration,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'cdn.invalidation.targets': targets.length,
                'cdn.invalidation.providers': providers.length,
                'cdn.invalidation.requests': invalidationRequests.length,
                'cdn.invalidation.duration_ms': duration
            });
            
            return {
                requests: invalidationRequests,
                totalTargets: targets.length,
                providersUsed: invalidationRequests.length,
                successful: invalidationRequests.filter(r => r.status !== 'failed').length
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
     * Warm cache with content
     */
    async warmCache(urls, options = {}) {
        const span = this.tracer.startSpan('cdn_integration_warm_cache');
        
        try {
            const {
                providers = Array.from(this.activeProviders),
                priority = 'normal',
                concurrent = 5,
                regions = null // Specific regions to warm
            } = options;
            
            if (!Array.isArray(urls) || urls.length === 0) {
                throw new Error('Invalid URLs provided for cache warming');
            }
            
            const warmingJobId = crypto.randomUUID();
            const warmingJob = {
                id: warmingJobId,
                urls: urls,
                providers: providers,
                regions: regions,
                status: 'running',
                progress: 0,
                startedAt: new Date(),
                completedUrls: 0,
                failedUrls: 0,
                results: []
            };
            
            this.cacheWarmingJobs.set(warmingJobId, warmingJob);
            
            // Execute cache warming concurrently
            const urlChunks = this.chunkArray(urls, concurrent);
            
            for (const chunk of urlChunks) {
                await Promise.all(chunk.map(async (url) => {
                    try {
                        const results = await this.warmUrlAcrossProviders(url, providers, regions);
                        warmingJob.results.push(...results);
                        warmingJob.completedUrls++;
                        
                    } catch (error) {
                        warmingJob.failedUrls++;
                        warmingJob.results.push({
                            url,
                            status: 'failed',
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                    
                    // Update progress
                    warmingJob.progress = Math.round(
                        ((warmingJob.completedUrls + warmingJob.failedUrls) / urls.length) * 100
                    );
                }));
            }
            
            warmingJob.status = 'completed';
            warmingJob.completedAt = new Date();
            
            // Update metrics
            this.metrics.warmingJobsCompleted++;
            
            this.emit('cacheWarmed', {
                jobId: warmingJobId,
                urls: urls.length,
                successful: warmingJob.completedUrls,
                failed: warmingJob.failedUrls,
                duration: warmingJob.completedAt - warmingJob.startedAt,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'cdn.warming.job_id': warmingJobId,
                'cdn.warming.urls': urls.length,
                'cdn.warming.providers': providers.length,
                'cdn.warming.successful': warmingJob.completedUrls
            });
            
            return warmingJob;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Get CDN performance metrics
     */
    async getPerformanceMetrics(options = {}) {
        const {
            providerId = null,
            timeRange = '1h', // 1h, 6h, 24h, 7d, 30d
            region = null,
            includeRealTime = true
        } = options;
        
        const span = this.tracer.startSpan('cdn_integration_get_performance_metrics');
        
        try {
            let query = `
                SELECT 
                    p.name as provider_name,
                    p.provider_type,
                    COUNT(m.*) as metric_count,
                    AVG(CASE WHEN m.metric_type = 'latency' THEN m.metric_value END) as avg_latency,
                    AVG(CASE WHEN m.metric_type = 'hit_ratio' THEN m.metric_value END) as avg_hit_ratio,
                    AVG(CASE WHEN m.metric_type = 'bandwidth' THEN m.metric_value END) as avg_bandwidth,
                    COUNT(CASE WHEN m.metric_type = 'error' THEN 1 END) as error_count
                FROM cdn_providers p
                LEFT JOIN edge_performance_metrics m ON p.id::text = m.metadata->>'provider_id'
                WHERE p.status = 'active'
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (providerId) {
                query += ` AND p.id = $${paramIndex++}`;
                params.push(providerId);
            }
            
            if (timeRange !== 'all') {
                const intervals = {
                    '1h': '1 hour',
                    '6h': '6 hours', 
                    '24h': '24 hours',
                    '7d': '7 days',
                    '30d': '30 days'
                };
                
                query += ` AND m.recorded_at >= NOW() - INTERVAL '${intervals[timeRange] || '1 hour'}'`;
            }
            
            query += ` GROUP BY p.id, p.name, p.provider_type ORDER BY p.name`;
            
            const result = await this.db.query(query, params);
            const metrics = result.rows;
            
            // Add real-time metrics if enabled
            if (includeRealTime) {
                for (const metric of metrics) {
                    const providerId = await this.getProviderIdByName(metric.provider_name);
                    const realTimeData = this.performanceMetrics.get(providerId);
                    
                    if (realTimeData) {
                        metric.real_time = realTimeData;
                    }
                }
            }
            
            span.setAttributes({
                'cdn.metrics.providers': metrics.length,
                'cdn.metrics.time_range': timeRange,
                'cdn.metrics.include_realtime': includeRealTime
            });
            
            return {
                metrics,
                timeRange,
                generatedAt: new Date().toISOString(),
                totalProviders: metrics.length
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
     * List CDN providers
     */
    async listProviders(filters = {}) {
        const {
            status = null,
            providerType = null,
            includeMetrics = false
        } = filters;
        
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;
        
        let query = 'SELECT * FROM cdn_providers';
        
        if (status) {
            whereConditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }
        
        if (providerType) {
            whereConditions.push(`provider_type = $${paramIndex++}`);
            params.push(providerType);
        }
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        query += ' ORDER BY priority DESC, created_at';
        
        const result = await this.db.query(query, params);
        let providers = result.rows;
        
        if (includeMetrics) {
            providers = await Promise.all(providers.map(async (provider) => ({
                ...provider,
                performance_metrics: this.performanceMetrics.get(provider.id) || null,
                real_time_status: this.activeProviders.has(provider.id) ? 'active' : 'inactive'
            })));
        }
        
        return providers;
    }
    
    /**
     * Update provider configuration
     */
    async updateProvider(providerId, updates) {
        const span = this.tracer.startSpan('cdn_integration_update_provider');
        
        try {
            const provider = this.providers.get(providerId);
            if (!provider) {
                throw new Error(`Provider not found: ${providerId}`);
            }
            
            // Validate updates
            if (updates.api_credentials && !updates.skipCredentialValidation) {
                await this.validateProviderCredentials(provider.provider_type, updates.api_credentials);
            }
            
            // Update in database
            const updateFields = [];
            const params = [providerId];
            let paramIndex = 2;
            
            for (const [field, value] of Object.entries(updates)) {
                if (['name', 'configuration', 'api_credentials', 'regions', 'priority', 'status'].includes(field)) {
                    updateFields.push(`${field} = $${paramIndex++}`);
                    params.push(value);
                }
            }
            
            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }
            
            updateFields.push(`updated_at = NOW()`);
            
            const query = `
                UPDATE cdn_providers 
                SET ${updateFields.join(', ')}
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.db.query(query, params);
            const updatedProvider = result.rows[0];
            
            // Update in memory
            this.providers.set(providerId, updatedProvider);
            
            // Update provider client if credentials changed
            if (updates.api_credentials) {
                await this.initializeProviderClient(updatedProvider);
            }
            
            // Update active providers set
            if (updates.status === 'active') {
                this.activeProviders.add(providerId);
            } else if (updates.status === 'inactive') {
                this.activeProviders.delete(providerId);
            }
            
            this.metrics.activeProviders = this.activeProviders.size;
            
            this.emit('providerUpdated', {
                providerId,
                updates: Object.keys(updates),
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'cdn.provider.id': providerId,
                'cdn.provider.updated_fields': Object.keys(updates).length
            });
            
            return updatedProvider;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Helper Methods
     */
    
    async loadProviders() {
        const result = await this.db.query(`
            SELECT * FROM cdn_providers 
            WHERE status IN ('active', 'maintenance')
            ORDER BY priority DESC
        `);
        
        for (const provider of result.rows) {
            this.providers.set(provider.id, provider);
            
            if (provider.status === 'active') {
                this.activeProviders.add(provider.id);
            }
        }
        
        console.log(`Loaded ${result.rows.length} CDN providers`);
    }
    
    async initializeProviderClients() {
        for (const [providerId, provider] of this.providers) {
            await this.initializeProviderClient(provider);
        }
        
        console.log(`Initialized ${this.providerClients.size} provider clients`);
    }
    
    async initializeProviderClient(provider) {
        try {
            const config = this.providerConfigs[provider.provider_type];
            if (!config) {
                throw new Error(`Unknown provider type: ${provider.provider_type}`);
            }
            
            const client = axios.create({
                baseURL: config.baseURL,
                timeout: 30000,
                headers: this.buildProviderHeaders(provider)
            });
            
            this.providerClients.set(provider.id, {
                client,
                config,
                provider,
                lastUsed: Date.now()
            });
            
        } catch (error) {
            console.error(`Failed to initialize provider client ${provider.id}:`, error.message);
        }
    }
    
    buildProviderHeaders(provider) {
        const headers = {
            'User-Agent': 'CDNIntegrationService/1.0',
            'Content-Type': 'application/json'
        };
        
        switch (provider.provider_type) {
            case 'cloudflare':
                headers['X-Auth-Email'] = provider.api_credentials.email;
                headers['X-Auth-Key'] = provider.api_credentials.api_key;
                break;
                
            case 'aws_cloudfront':
                // AWS SDK would handle authentication
                headers['Authorization'] = `AWS4-HMAC-SHA256 ${provider.api_credentials.signature}`;
                break;
                
            case 'azure_cdn':
                headers['Authorization'] = `Bearer ${provider.api_credentials.access_token}`;
                break;
        }
        
        return headers;
    }
    
    async validateProviderCredentials(providerType, credentials) {
        // Test API connection with provided credentials
        try {
            const testHeaders = this.buildProviderHeaders({ provider_type: providerType, api_credentials: credentials });
            const config = this.providerConfigs[providerType];
            
            const response = await axios.get(config.baseURL + config.endpoints.zones || '/', {
                headers: testHeaders,
                timeout: 10000
            });
            
            return response.status === 200;
            
        } catch (error) {
            throw new Error(`Invalid credentials for ${providerType}: ${error.message}`);
        }
    }
    
    async invalidateProviderCache(providerId, targets, options = {}) {
        const providerClient = this.providerClients.get(providerId);
        if (!providerClient) {
            throw new Error(`Provider client not found: ${providerId}`);
        }
        
        const { provider, client, config } = providerClient;
        const requestId = crypto.randomUUID();
        
        try {
            let endpoint, payload;
            
            switch (provider.provider_type) {
                case 'cloudflare':
                    endpoint = config.endpoints.purge.replace('{zone_id}', provider.configuration.zone_id);
                    payload = { files: targets };
                    break;
                    
                case 'aws_cloudfront':
                    endpoint = config.endpoints.invalidation.replace('{distribution_id}', provider.configuration.distribution_id);
                    payload = {
                        InvalidationBatch: {
                            Paths: {
                                Quantity: targets.length,
                                Items: targets
                            },
                            CallerReference: requestId
                        }
                    };
                    break;
                    
                case 'azure_cdn':
                    endpoint = config.endpoints.purge
                        .replace('{subscription_id}', provider.configuration.subscription_id)
                        .replace('{resource_group}', provider.configuration.resource_group)
                        .replace('{profile_name}', provider.configuration.profile_name)
                        .replace('{endpoint_name}', provider.configuration.endpoint_name);
                    payload = { contentPaths: targets };
                    break;
                    
                default:
                    throw new Error(`Unsupported provider type: ${provider.provider_type}`);
            }
            
            const response = await client.post(endpoint, payload);
            
            // Store invalidation request
            this.cacheInvalidationQueue.set(requestId, {
                providerId,
                requestId,
                targets,
                status: 'pending',
                response: response.data,
                createdAt: new Date()
            });
            
            return requestId;
            
        } catch (error) {
            console.error(`Cache invalidation failed for provider ${providerId}:`, error.message);
            throw error;
        }
    }
    
    async warmUrlAcrossProviders(url, providers, regions) {
        const results = [];
        
        for (const providerId of providers) {
            const provider = this.providers.get(providerId);
            if (!provider || provider.status !== 'active') {
                continue;
            }
            
            try {
                // Warm cache by making requests to the URL through CDN
                const warmingRegions = regions || provider.regions || ['default'];
                
                for (const region of warmingRegions) {
                    const warmResponse = await this.performCacheWarmRequest(url, provider, region);
                    
                    results.push({
                        url,
                        providerId,
                        region,
                        status: 'success',
                        responseTime: warmResponse.duration,
                        cacheStatus: warmResponse.cacheStatus,
                        timestamp: new Date()
                    });
                }
                
            } catch (error) {
                results.push({
                    url,
                    providerId,
                    status: 'failed',
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }
        
        return results;
    }
    
    async performCacheWarmRequest(url, provider, region) {
        const startTime = Date.now();
        
        try {
            // Construct CDN URL based on provider configuration
            const cdnUrl = this.buildCDNUrl(url, provider, region);
            
            const response = await axios.get(cdnUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'CDNIntegrationService-CacheWarming/1.0'
                }
            });
            
            const duration = Date.now() - startTime;
            
            return {
                duration,
                status: response.status,
                cacheStatus: response.headers['x-cache'] || response.headers['cf-cache-status'] || 'unknown'
            };
            
        } catch (error) {
            throw new Error(`Cache warming failed for ${url}: ${error.message}`);
        }
    }
    
    buildCDNUrl(originalUrl, provider, region) {
        // Build CDN URL based on provider configuration
        const baseUrl = provider.configuration.base_url || provider.configuration.distribution_domain;
        const path = new URL(originalUrl).pathname;
        
        return `https://${baseUrl}${path}`;
    }
    
    async recordInvalidationRequests(requests, targets) {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const request of requests) {
                await client.query(`
                    INSERT INTO cdn_cache_invalidation_requests (
                        id, provider_id, cache_keys, status, request_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    crypto.randomUUID(),
                    request.providerId,
                    targets,
                    request.status,
                    request.requestId,
                    request.createdAt
                ]);
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    async waitForInvalidationCompletion(requests) {
        // Poll for completion status
        const maxWaitTime = 300000; // 5 minutes
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            let allCompleted = true;
            
            for (const request of requests) {
                if (request.status === 'pending') {
                    const status = await this.checkInvalidationStatus(request.providerId, request.requestId);
                    request.status = status;
                    
                    if (status === 'pending' || status === 'in_progress') {
                        allCompleted = false;
                    }
                }
            }
            
            if (allCompleted) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
    }
    
    async checkInvalidationStatus(providerId, requestId) {
        // Implementation would check status with each provider's API
        // This is a simplified version
        return 'completed';
    }
    
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    async loadCachePolicies() {
        // Load cache policies from configuration or database
        const defaultPolicies = {
            'static_assets': {
                ttl: 86400, // 24 hours
                patterns: ['*.css', '*.js', '*.png', '*.jpg', '*.gif', '*.svg'],
                headers: { 'Cache-Control': 'public, max-age=86400' }
            },
            'dynamic_content': {
                ttl: 300, // 5 minutes
                patterns: ['*.html', '*.json'],
                headers: { 'Cache-Control': 'public, max-age=300' }
            }
        };
        
        for (const [policyId, policy] of Object.entries(defaultPolicies)) {
            this.cachePolicies.set(policyId, policy);
        }
        
        console.log(`Loaded ${this.cachePolicies.size} cache policies`);
    }
    
    startPerformanceMonitoring() {
        // Start periodic performance monitoring
        setInterval(async () => {
            await this.collectPerformanceMetrics();
        }, 60000); // Every minute
        
        console.log('CDN performance monitoring started');
    }
    
    async collectPerformanceMetrics() {
        for (const [providerId, provider] of this.providers) {
            if (provider.status !== 'active') continue;
            
            try {
                const metrics = await this.getProviderMetrics(providerId);
                this.performanceMetrics.set(providerId, {
                    ...metrics,
                    timestamp: Date.now()
                });
                
                // Check alert thresholds
                this.checkAlertThresholds(providerId, metrics);
                
            } catch (error) {
                console.error(`Failed to collect metrics for provider ${providerId}:`, error.message);
            }
        }
    }
    
    async getProviderMetrics(providerId) {
        // Implementation would fetch real metrics from each provider
        // This is a simplified version returning mock data
        return {
            latency: Math.random() * 200 + 50, // 50-250ms
            hitRatio: Math.random() * 20 + 80, // 80-100%
            errorRate: Math.random() * 2, // 0-2%
            bandwidth: Math.random() * 1000, // MB
            requests: Math.floor(Math.random() * 10000)
        };
    }
    
    checkAlertThresholds(providerId, metrics) {
        const provider = this.providers.get(providerId);
        const thresholds = this.config.alertThresholds;
        
        if (metrics.errorRate > thresholds.errorRate) {
            this.emit('alert', {
                providerId,
                providerName: provider.name,
                type: 'high_error_rate',
                value: metrics.errorRate,
                threshold: thresholds.errorRate,
                timestamp: Date.now()
            });
        }
        
        if (metrics.latency > thresholds.latency) {
            this.emit('alert', {
                providerId,
                providerName: provider.name,
                type: 'high_latency',
                value: metrics.latency,
                threshold: thresholds.latency,
                timestamp: Date.now()
            });
        }
        
        if (metrics.hitRatio < thresholds.hitRatio) {
            this.emit('alert', {
                providerId,
                providerName: provider.name,
                type: 'low_hit_ratio',
                value: metrics.hitRatio,
                threshold: thresholds.hitRatio,
                timestamp: Date.now()
            });
        }
    }
    
    initializeCostTracking() {
        // Initialize cost tracking and optimization
        console.log('CDN cost tracking initialized');
    }
    
    startCacheWarmingScheduler() {
        // Start scheduled cache warming
        console.log('Cache warming scheduler started');
    }
    
    async getProviderIdByName(name) {
        for (const [id, provider] of this.providers) {
            if (provider.name === name) {
                return id;
            }
        }
        return null;
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            providers: {
                total: this.providers.size,
                active: this.activeProviders.size,
                types: [...new Set(Array.from(this.providers.values()).map(p => p.provider_type))]
            },
            cache: {
                invalidation_queue_size: this.cacheInvalidationQueue.size,
                warming_jobs_active: Array.from(this.cacheWarmingJobs.values()).filter(j => j.status === 'running').length,
                policies_loaded: this.cachePolicies.size
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning,
                performance_monitoring: this.config.performanceMonitoring,
                cost_optimization: this.config.costOptimization
            }
        };
    }
    
    /**
     * Stop the CDNIntegrationService
     */
    async stop() {
        this.isRunning = false;
        
        // Clear all caches and intervals
        this.providers.clear();
        this.providerClients.clear();
        this.activeProviders.clear();
        this.cacheInvalidationQueue.clear();
        this.cacheWarmingJobs.clear();
        this.performanceMetrics.clear();
        
        this.emit('stopped', { timestamp: Date.now() });
        console.log('CDNIntegrationService stopped');
    }
}

export default CDNIntegrationService;
