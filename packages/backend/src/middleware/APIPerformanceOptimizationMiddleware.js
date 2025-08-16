/**
 * API Performance Optimization Middleware
 * Intelligent performance enhancements for API endpoints
 * Task 26: System Performance Optimization - Component 3: API Optimization
 */

import { performance } from 'perf_hooks';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import AdvancedCachingService, { CacheCategory } from '../services/AdvancedCachingService.js';
import SystemPerformanceOptimizationService from '../services/SystemPerformanceOptimizationService.js';

/**
 * Response Optimization Strategies
 */
export const OptimizationStrategy = {
    COMPRESSION: 'compression',
    CACHING: 'caching',  
    PAGINATION: 'pagination',
    FIELD_SELECTION: 'field_selection',
    EAGER_LOADING: 'eager_loading',
    RESPONSE_STREAMING: 'response_streaming',
    CONDITIONAL_REQUESTS: 'conditional_requests',
    BATCH_PROCESSING: 'batch_processing'
};

/**
 * API Optimization Configuration
 */
export const ApiOptimizationConfig = {
    // Response compression
    compression: {
        enabled: true,
        level: 6,                    // zlib compression level
        threshold: 1024,             // Only compress responses > 1KB
        filter: (req, res) => {
            // Don't compress already compressed content
            return !req.headers['x-no-compression'];
        }
    },
    
    // Intelligent caching  
    caching: {
        enabled: true,
        defaultTTL: 300,             // 5 minutes
        skipOnError: true,
        varyByUser: true,
        categories: {
            '/api/workflows': { ttl: 600, category: CacheCategory.WORKFLOW_TEMPLATES },
            '/api/users': { ttl: 1800, category: CacheCategory.USER_SESSIONS },
            '/api/templates': { ttl: 3600, category: CacheCategory.WORKFLOW_TEMPLATES },
            '/api/monitoring': { ttl: 60, category: CacheCategory.API_RESPONSES }
        }
    },
    
    // Rate limiting
    rateLimiting: {
        enabled: true,
        windowMs: 15 * 60 * 1000,    // 15 minutes
        max: 1000,                   // Limit each IP to 1000 requests per windowMs
        standardHeaders: true,        // Return rate limit info in headers
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for internal services
            return req.ip === '127.0.0.1' || req.headers['x-internal-service'];
        }
    },
    
    // Response optimization
    responseOptimization: {
        enabled: true,
        maxResponseSize: 10 * 1024 * 1024,  // 10MB max response
        streamingThreshold: 1024 * 1024,     // Stream responses > 1MB
        fieldSelection: true,                 // Support field selection via query params
        pagination: {
            defaultLimit: 50,
            maxLimit: 1000,
            offsetBased: true
        }
    }
};

/**
 * API Performance Optimization Middleware Factory
 */
class APIPerformanceOptimizationMiddleware {
    constructor() {
        this.optimizationStats = new Map();
        this.endpointConfigs = new Map();
        
        // Initialize optimization strategies
        this.initializeOptimizations();
    }

    /**
     * Initialize optimization middleware components
     */
    initializeOptimizations() {
        // Set up compression middleware
        this.compressionMiddleware = compression({
            level: ApiOptimizationConfig.compression.level,
            threshold: ApiOptimizationConfig.compression.threshold,
            filter: ApiOptimizationConfig.compression.filter
        });

        // Set up rate limiting
        this.rateLimitMiddleware = rateLimit({
            windowMs: ApiOptimizationConfig.rateLimiting.windowMs,
            max: ApiOptimizationConfig.rateLimiting.max,
            standardHeaders: ApiOptimizationConfig.rateLimiting.standardHeaders,
            legacyHeaders: ApiOptimizationConfig.rateLimiting.legacyHeaders,
            skip: ApiOptimizationConfig.rateLimiting.skip,
            handler: (req, res) => {
                res.status(429).json({
                    success: false,
                    error: 'Too many requests, please try again later',
                    retryAfter: Math.ceil(ApiOptimizationConfig.rateLimiting.windowMs / 1000)
                });
            }
        });

        console.log('✅ API Performance Optimization Middleware initialized');
    }

    /**
     * Main optimization middleware
     */
    optimizeAPI() {
        return async (req, res, next) => {
            const startTime = performance.now();
            const originalSend = res.send;
            const originalJson = res.json;
            
            // Add optimization metadata to request
            req.optimization = {
                startTime,
                strategies: [],
                cacheKey: null,
                skipCache: false
            };

            // Apply compression if enabled
            if (ApiOptimizationConfig.compression.enabled) {
                await this.applyCompression(req, res);
            }

            // Apply rate limiting if enabled
            if (ApiOptimizationConfig.rateLimiting.enabled) {
                await new Promise((resolve, reject) => {
                    this.rateLimitMiddleware(req, res, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Try cache first if caching is enabled
            if (ApiOptimizationConfig.caching.enabled && req.method === 'GET') {
                const cachedResponse = await this.tryGetFromCache(req, res);
                if (cachedResponse) {
                    return; // Response was served from cache
                }
            }

            // Override response methods to apply optimizations
            res.send = (data) => {
                return this.optimizedSend.call(this, req, res, originalSend, data);
            };

            res.json = (data) => {
                return this.optimizedJson.call(this, req, res, originalJson, data);
            };

            // Add performance timing headers
            res.set('X-Response-Time-Start', startTime.toString());
            
            next();
        };
    }

    /**
     * Apply compression optimization
     */
    async applyCompression(req, res) {
        return new Promise((resolve) => {
            this.compressionMiddleware(req, res, resolve);
        });
    }

    /**
     * Try to get response from cache
     */
    async tryGetFromCache(req, res) {
        return traceOperation('api-cache-check', async () => {
            try {
                const cacheConfig = this.getCacheConfig(req.path);
                if (!cacheConfig) return null;

                const cacheKey = this.buildCacheKey(req, cacheConfig);
                const cachedResponse = await AdvancedCachingService.get(
                    cacheKey, 
                    cacheConfig.category,
                    { includeHeaders: true }
                );

                if (cachedResponse) {
                    // Serve from cache
                    if (cachedResponse.headers) {
                        res.set(cachedResponse.headers);
                    }
                    res.set('X-Cache', 'HIT');
                    res.set('X-Cache-Key', cacheKey);
                    
                    // Record cache hit for optimization stats
                    this.recordOptimizationStat(req.path, OptimizationStrategy.CACHING, 'hit');
                    
                    const responseTime = performance.now() - req.optimization.startTime;
                    res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
                    
                    res.status(cachedResponse.status || 200).send(cachedResponse.data);
                    return true;
                }

                // Cache miss - set up for caching the response
                req.optimization.cacheKey = cacheKey;
                req.optimization.cacheConfig = cacheConfig;
                res.set('X-Cache', 'MISS');
                
                this.recordOptimizationStat(req.path, OptimizationStrategy.CACHING, 'miss');
                return null;

            } catch (error) {
                console.error('Cache check error:', error);
                return null;
            }
        });
    }

    /**
     * Optimized send method
     */
    async optimizedSend(req, res, originalSend, data) {
        return traceOperation('api-response-optimization', async () => {
            let optimizedData = data;
            const responseTime = performance.now() - req.optimization.startTime;

            // Apply response optimizations
            optimizedData = await this.applyResponseOptimizations(req, res, optimizedData);

            // Cache the response if applicable
            await this.cacheResponse(req, res, optimizedData);

            // Add performance headers
            res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
            res.set('X-Optimizations', req.optimization.strategies.join(','));

            // Record performance metric
            await SystemPerformanceOptimizationService.recordMetric(
                'API_RESPONSE_TIME',
                req.path,
                responseTime,
                'ms',
                { method: req.method, statusCode: res.statusCode }
            );

            // Call original send
            return originalSend.call(res, optimizedData);
        });
    }

    /**
     * Optimized json method
     */
    async optimizedJson(req, res, originalJson, data) {
        return traceOperation('api-json-optimization', async () => {
            let optimizedData = data;
            const responseTime = performance.now() - req.optimization.startTime;

            // Apply JSON-specific optimizations
            optimizedData = await this.applyJsonOptimizations(req, res, optimizedData);

            // Cache the JSON response if applicable
            await this.cacheResponse(req, res, optimizedData);

            // Add performance headers
            res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
            res.set('X-Optimizations', req.optimization.strategies.join(','));

            // Record performance metric
            await SystemPerformanceOptimizationService.recordMetric(
                'API_RESPONSE_TIME',
                req.path,
                responseTime,
                'ms',
                { method: req.method, statusCode: res.statusCode }
            );

            // Call original json
            return originalJson.call(res, optimizedData);
        });
    }

    /**
     * Apply response optimizations
     */
    async applyResponseOptimizations(req, res, data) {
        let optimizedData = data;

        // Field selection optimization
        if (ApiOptimizationConfig.responseOptimization.fieldSelection) {
            optimizedData = this.applyFieldSelection(req, optimizedData);
        }

        // Pagination optimization
        if (req.query.limit || req.query.offset) {
            optimizedData = this.applyPagination(req, optimizedData);
        }

        // Response size optimization
        optimizedData = this.optimizeResponseSize(req, res, optimizedData);

        return optimizedData;
    }

    /**
     * Apply JSON-specific optimizations
     */
    async applyJsonOptimizations(req, res, data) {
        let optimizedData = data;

        // Remove null/undefined values if requested
        if (req.query.compact === 'true') {
            optimizedData = this.removeNullValues(optimizedData);
            req.optimization.strategies.push('compact_json');
        }

        // Apply field selection
        if (req.query.fields) {
            optimizedData = this.selectFields(optimizedData, req.query.fields.split(','));
            req.optimization.strategies.push('field_selection');
        }

        // Format numbers for better JSON compression
        optimizedData = this.optimizeNumbers(optimizedData);

        return optimizedData;
    }

    /**
     * Cache response if applicable
     */
    async cacheResponse(req, res, data) {
        if (!req.optimization.cacheKey || req.optimization.skipCache) {
            return;
        }

        try {
            const cacheConfig = req.optimization.cacheConfig;
            const responseToCache = {
                data,
                status: res.statusCode,
                headers: this.getCacheableHeaders(res),
                cachedAt: new Date().toISOString()
            };

            await AdvancedCachingService.set(
                req.optimization.cacheKey,
                responseToCache,
                cacheConfig.category,
                { ttl: cacheConfig.ttl }
            );

            res.set('X-Cache-Stored', 'true');
            this.recordOptimizationStat(req.path, OptimizationStrategy.CACHING, 'stored');

        } catch (error) {
            console.error('Error caching response:', error);
        }
    }

    /**
     * Apply field selection
     */
    applyFieldSelection(req, data) {
        if (!req.query.fields || !data) return data;

        const fields = req.query.fields.split(',');
        return this.selectFields(data, fields);
    }

    /**
     * Apply pagination
     */
    applyPagination(req, data) {
        if (!Array.isArray(data)) return data;

        const limit = Math.min(
            parseInt(req.query.limit) || ApiOptimizationConfig.responseOptimization.pagination.defaultLimit,
            ApiOptimizationConfig.responseOptimization.pagination.maxLimit
        );
        
        const offset = parseInt(req.query.offset) || 0;
        
        const paginatedData = data.slice(offset, offset + limit);
        req.optimization.strategies.push(`pagination_${limit}_${offset}`);
        
        return {
            data: paginatedData,
            pagination: {
                offset,
                limit,
                total: data.length,
                hasMore: offset + limit < data.length
            }
        };
    }

    /**
     * Optimize response size
     */
    optimizeResponseSize(req, res, data) {
        const dataSize = JSON.stringify(data).length;
        
        if (dataSize > ApiOptimizationConfig.responseOptimization.maxResponseSize) {
            console.warn(`Response size ${dataSize} exceeds maximum ${ApiOptimizationConfig.responseOptimization.maxResponseSize}`);
            res.set('X-Response-Truncated', 'true');
            req.optimization.strategies.push('size_truncated');
            
            // Truncate response - in production, this should be more sophisticated
            return { 
                error: 'Response too large', 
                message: 'Response was truncated due to size limits',
                originalSize: dataSize,
                maxSize: ApiOptimizationConfig.responseOptimization.maxResponseSize
            };
        }

        if (dataSize > ApiOptimizationConfig.responseOptimization.streamingThreshold) {
            res.set('X-Response-Streaming', 'available');
            req.optimization.strategies.push('streaming_available');
        }

        return data;
    }

    // Utility methods
    getCacheConfig(path) {
        for (const [pattern, config] of Object.entries(ApiOptimizationConfig.caching.categories)) {
            if (path.startsWith(pattern)) {
                return config;
            }
        }
        return null;
    }

    buildCacheKey(req, cacheConfig) {
        const keyParts = [
            req.path,
            req.method,
            JSON.stringify(req.query)
        ];

        if (cacheConfig.varyByUser && req.user) {
            keyParts.push(`user:${req.user.id}`);
        }

        return keyParts.join('|');
    }

    getCacheableHeaders(res) {
        const cacheableHeaders = ['content-type', 'etag', 'last-modified'];
        const headers = {};
        
        for (const header of cacheableHeaders) {
            const value = res.get(header);
            if (value) {
                headers[header] = value;
            }
        }
        
        return headers;
    }

    selectFields(data, fields) {
        if (Array.isArray(data)) {
            return data.map(item => this.selectFields(item, fields));
        }

        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const field of fields) {
                if (field in data) {
                    result[field] = data[field];
                }
            }
            return result;
        }

        return data;
    }

    removeNullValues(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeNullValues(item));
        }

        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== null && value !== undefined) {
                    result[key] = this.removeNullValues(value);
                }
            }
            return result;
        }

        return obj;
    }

    optimizeNumbers(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.optimizeNumbers(item));
        }

        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.optimizeNumbers(value);
            }
            return result;
        }

        // Round floating point numbers to reduce JSON size
        if (typeof obj === 'number' && !Number.isInteger(obj)) {
            return parseFloat(obj.toFixed(6));
        }

        return obj;
    }

    recordOptimizationStat(endpoint, strategy, result) {
        const key = `${endpoint}:${strategy}`;
        const current = this.optimizationStats.get(key) || { hits: 0, misses: 0, errors: 0 };
        
        if (result === 'hit') current.hits++;
        else if (result === 'miss') current.misses++;
        else if (result === 'error') current.errors++;
        
        this.optimizationStats.set(key, current);
    }

    /**
     * Get optimization statistics
     */
    getOptimizationStatistics() {
        const stats = {};
        
        for (const [key, values] of this.optimizationStats) {
            const [endpoint, strategy] = key.split(':');
            
            if (!stats[endpoint]) {
                stats[endpoint] = {};
            }
            
            stats[endpoint][strategy] = {
                hits: values.hits,
                misses: values.misses,
                errors: values.errors,
                hitRate: values.hits + values.misses > 0 ? 
                    ((values.hits / (values.hits + values.misses)) * 100).toFixed(2) + '%' : '0%'
            };
        }
        
        return stats;
    }

    /**
     * Configure endpoint-specific optimizations
     */
    configureEndpoint(path, config) {
        this.endpointConfigs.set(path, {
            caching: config.caching || {},
            compression: config.compression || {},
            rateLimiting: config.rateLimiting || {},
            responseOptimization: config.responseOptimization || {}
        });
    }

    /**
     * Create middleware stack with all optimizations
     */
    createOptimizationStack() {
        return [
            helmet(),                    // Security headers
            this.optimizeAPI(),          // Main optimization middleware
        ];
    }
}

// Export singleton instance
export default new APIPerformanceOptimizationMiddleware();
