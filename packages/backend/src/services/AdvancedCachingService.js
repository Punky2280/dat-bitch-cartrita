/**
 * Advanced Caching Service
 * Multi-layer caching system for optimal performance
 * Task 26: System Performance Optimization - Component 2: Advanced Caching
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import RedisService from './RedisService.js';
import DatabaseService from './DatabaseService.js';

/**
 * Cache Layers
 */
export const CacheLayer = {
    MEMORY: 'memory',        // L1: In-memory cache (fastest)
    REDIS: 'redis',          // L2: Redis cache (fast, shared)
    DATABASE: 'database',    // L3: Database cache (persistent)
    DISK: 'disk'            // L4: Disk cache (backup)
};

/**
 * Cache Strategies
 */
export const CacheStrategy = {
    READ_THROUGH: 'read_through',           // Read from cache, fallback to source
    WRITE_THROUGH: 'write_through',         // Write to cache and source simultaneously  
    WRITE_BEHIND: 'write_behind',           // Write to cache first, source later
    CACHE_ASIDE: 'cache_aside',             // Manual cache management
    REFRESH_AHEAD: 'refresh_ahead',         // Refresh cache before expiry
    TIME_BASED: 'time_based'                // TTL-based expiration
};

/**
 * Cache Categories
 */
export const CacheCategory = {
    API_RESPONSES: 'api_responses',
    DATABASE_QUERIES: 'db_queries', 
    USER_SESSIONS: 'user_sessions',
    STATIC_CONTENT: 'static_content',
    COMPUTED_RESULTS: 'computed_results',
    WORKFLOW_TEMPLATES: 'workflow_templates',
    AUTHENTICATION: 'authentication',
    RATE_LIMITING: 'rate_limiting'
};

/**
 * Advanced Multi-Layer Caching Service
 */
class AdvancedCachingService extends EventEmitter {
    constructor() {
        super();
        
        // Layer 1: Memory Cache (LRU)
        this.memoryCache = new LRUCache({
            max: 10000,                    // Maximum 10k items
            maxSize: 100 * 1024 * 1024,    // 100MB max size
            sizeCalculation: (value) => JSON.stringify(value).length,
            ttl: 1000 * 60 * 15,           // 15 minutes default TTL
            allowStale: true,              // Return stale data if available
            updateAgeOnGet: true           // Reset TTL on access
        });

        // Cache configurations per category
        this.cacheConfigs = new Map([
            [CacheCategory.API_RESPONSES, {
                layers: [CacheLayer.MEMORY, CacheLayer.REDIS],
                strategy: CacheStrategy.READ_THROUGH,
                ttl: {
                    [CacheLayer.MEMORY]: 300,     // 5 minutes
                    [CacheLayer.REDIS]: 3600      // 1 hour
                },
                maxSize: 1000
            }],
            [CacheCategory.DATABASE_QUERIES, {
                layers: [CacheLayer.MEMORY, CacheLayer.REDIS, CacheLayer.DATABASE],
                strategy: CacheStrategy.WRITE_THROUGH,
                ttl: {
                    [CacheLayer.MEMORY]: 180,     // 3 minutes
                    [CacheLayer.REDIS]: 1800,     // 30 minutes
                    [CacheLayer.DATABASE]: 7200   // 2 hours
                },
                maxSize: 5000
            }],
            [CacheCategory.USER_SESSIONS, {
                layers: [CacheLayer.REDIS],
                strategy: CacheStrategy.CACHE_ASIDE,
                ttl: {
                    [CacheLayer.REDIS]: 86400     // 24 hours
                },
                maxSize: 50000
            }],
            [CacheCategory.WORKFLOW_TEMPLATES, {
                layers: [CacheLayer.MEMORY, CacheLayer.REDIS, CacheLayer.DATABASE],
                strategy: CacheStrategy.REFRESH_AHEAD,
                ttl: {
                    [CacheLayer.MEMORY]: 1800,    // 30 minutes
                    [CacheLayer.REDIS]: 7200,     // 2 hours  
                    [CacheLayer.DATABASE]: 86400  // 24 hours
                },
                maxSize: 2000
            }]
        ]);

        // Cache statistics
        this.stats = {
            hits: new Map(),
            misses: new Map(),
            writes: new Map(),
            evictions: new Map(),
            errors: new Map(),
            totalRequests: 0,
            totalHits: 0,
            totalMisses: 0
        };

        // Background tasks
        this.cleanupInterval = null;
        this.statsInterval = null;
        
        this.initializeService();
    }

    /**
     * Initialize the caching service
     */
    async initializeService() {
        return traceOperation('cache-initialize', async () => {
            try {
                // Create database cache tables
                await this.createCacheTables();
                
                // Initialize cache warming
                await this.warmupCriticalCaches();
                
                // Start background maintenance
                this.startBackgroundMaintenance();
                
                console.log('✅ Advanced Caching Service initialized');
                this.emit('cache:initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize caching service:', error);
                throw error;
            }
        });
    }

    /**
     * Create database tables for persistent cache layer
     */
    async createCacheTables() {
        const createTablesSQL = `
            -- Persistent cache table
            CREATE TABLE IF NOT EXISTS cache_entries (
                key VARCHAR(255) PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                value JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                access_count INTEGER DEFAULT 0,
                last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                size_bytes INTEGER DEFAULT 0,
                metadata JSONB DEFAULT '{}'
            );

            -- Cache statistics table
            CREATE TABLE IF NOT EXISTS cache_statistics (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                layer VARCHAR(20) NOT NULL,
                operation VARCHAR(20) NOT NULL,
                count INTEGER DEFAULT 1,
                response_time_ms DECIMAL(8,3),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_cache_entries_category ON cache_entries(category);
            CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);
            CREATE INDEX IF NOT EXISTS idx_cache_entries_accessed ON cache_entries(last_accessed);
            CREATE INDEX IF NOT EXISTS idx_cache_stats_category_time ON cache_statistics(category, timestamp);
        `;

        await DatabaseService.query(createTablesSQL);
    }

    /**
     * Multi-layer cache get operation
     */
    async get(key, category = CacheCategory.API_RESPONSES, options = {}) {
        return traceOperation(`cache-get-${category}`, async () => {
            const startTime = performance.now();
            const fullKey = this.buildCacheKey(key, category);
            const config = this.cacheConfigs.get(category) || this.getDefaultConfig();
            
            try {
                // Try each configured layer in order
                for (const layer of config.layers) {
                    const value = await this.getFromLayer(fullKey, layer, category);
                    
                    if (value !== null) {
                        // Cache hit - record stats and backfill higher layers
                        await this.recordHit(category, layer, performance.now() - startTime);
                        await this.backfillLayers(fullKey, value, layer, config);
                        
                        return this.deserializeValue(value);
                    }
                }

                // Cache miss across all layers
                await this.recordMiss(category, performance.now() - startTime);
                return null;

            } catch (error) {
                await this.recordError(category, 'get', error);
                console.error('Cache get error:', error);
                return null;
            }
        });
    }

    /**
     * Multi-layer cache set operation
     */
    async set(key, value, category = CacheCategory.API_RESPONSES, options = {}) {
        return traceOperation(`cache-set-${category}`, async () => {
            const startTime = performance.now();
            const fullKey = this.buildCacheKey(key, category);
            const config = this.cacheConfigs.get(category) || this.getDefaultConfig();
            const serializedValue = this.serializeValue(value);
            
            try {
                const promises = [];
                
                // Write to all configured layers based on strategy
                for (const layer of config.layers) {
                    const ttl = config.ttl[layer] || 3600;
                    
                    if (config.strategy === CacheStrategy.WRITE_THROUGH) {
                        // Synchronous write to all layers
                        await this.setInLayer(fullKey, serializedValue, layer, category, ttl, options);
                    } else {
                        // Asynchronous write for better performance
                        promises.push(
                            this.setInLayer(fullKey, serializedValue, layer, category, ttl, options)
                        );
                    }
                }

                if (promises.length > 0) {
                    await Promise.allSettled(promises);
                }

                await this.recordWrite(category, performance.now() - startTime);
                return true;

            } catch (error) {
                await this.recordError(category, 'set', error);
                console.error('Cache set error:', error);
                return false;
            }
        });
    }

    /**
     * Get value from specific cache layer
     */
    async getFromLayer(key, layer, category) {
        switch (layer) {
            case CacheLayer.MEMORY:
                return this.memoryCache.get(key) || null;

            case CacheLayer.REDIS:
                if (RedisService && RedisService.isConnected()) {
                    const value = await RedisService.get(key);
                    return value ? JSON.parse(value) : null;
                }
                return null;

            case CacheLayer.DATABASE:
                const query = `
                    SELECT value FROM cache_entries 
                    WHERE key = $1 AND expires_at > NOW()
                `;
                const result = await DatabaseService.query(query, [key]);
                
                if (result.rows.length > 0) {
                    // Update access statistics
                    await this.updateCacheAccess(key);
                    return result.rows[0].value;
                }
                return null;

            default:
                return null;
        }
    }

    /**
     * Set value in specific cache layer
     */
    async setInLayer(key, value, layer, category, ttl, options) {
        switch (layer) {
            case CacheLayer.MEMORY:
                this.memoryCache.set(key, value, { ttl: ttl * 1000 });
                break;

            case CacheLayer.REDIS:
                if (RedisService && RedisService.isConnected()) {
                    await RedisService.setex(key, ttl, JSON.stringify(value));
                }
                break;

            case CacheLayer.DATABASE:
                const expiresAt = new Date(Date.now() + (ttl * 1000));
                const valueSize = JSON.stringify(value).length;
                
                const query = `
                    INSERT INTO cache_entries (key, category, value, expires_at, size_bytes, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (key) DO UPDATE SET
                        value = $3,
                        expires_at = $4,
                        size_bytes = $5,
                        metadata = $6,
                        last_accessed = CURRENT_TIMESTAMP
                `;
                
                await DatabaseService.query(query, [
                    key, category, value, expiresAt, valueSize, 
                    JSON.stringify(options.metadata || {})
                ]);
                break;
        }
    }

    /**
     * Backfill higher-priority cache layers with found value
     */
    async backfillLayers(key, value, foundLayer, config) {
        const layerPriority = {
            [CacheLayer.MEMORY]: 0,
            [CacheLayer.REDIS]: 1,
            [CacheLayer.DATABASE]: 2,
            [CacheLayer.DISK]: 3
        };

        const foundPriority = layerPriority[foundLayer];
        
        // Backfill all higher-priority layers
        for (const layer of config.layers) {
            if (layerPriority[layer] < foundPriority) {
                const ttl = config.ttl[layer] || 3600;
                await this.setInLayer(key, value, layer, 'backfill', ttl, {});
            }
        }
    }

    /**
     * Delete from all cache layers
     */
    async delete(key, category = CacheCategory.API_RESPONSES) {
        return traceOperation(`cache-delete-${category}`, async () => {
            const fullKey = this.buildCacheKey(key, category);
            const config = this.cacheConfigs.get(category) || this.getDefaultConfig();
            
            const promises = [];
            
            for (const layer of config.layers) {
                switch (layer) {
                    case CacheLayer.MEMORY:
                        this.memoryCache.delete(fullKey);
                        break;

                    case CacheLayer.REDIS:
                        if (RedisService && RedisService.isConnected()) {
                            promises.push(RedisService.del(fullKey));
                        }
                        break;

                    case CacheLayer.DATABASE:
                        promises.push(
                            DatabaseService.query('DELETE FROM cache_entries WHERE key = $1', [fullKey])
                        );
                        break;
                }
            }

            await Promise.allSettled(promises);
            return true;
        });
    }

    /**
     * Clear entire cache for a category
     */
    async clearCategory(category) {
        return traceOperation(`cache-clear-${category}`, async () => {
            // Clear memory cache entries for this category
            for (const key of this.memoryCache.keys()) {
                if (key.startsWith(`${category}:`)) {
                    this.memoryCache.delete(key);
                }
            }

            // Clear Redis entries
            if (RedisService && RedisService.isConnected()) {
                const pattern = `${category}:*`;
                const keys = await RedisService.keys(pattern);
                if (keys.length > 0) {
                    await RedisService.del(...keys);
                }
            }

            // Clear database entries
            await DatabaseService.query('DELETE FROM cache_entries WHERE category = $1', [category]);

            console.log(`✅ Cleared cache category: ${category}`);
            this.emit('cache:category-cleared', { category });
        });
    }

    /**
     * Cache-aside pattern with automatic fallback
     */
    async getOrSet(key, fetchFunction, category = CacheCategory.API_RESPONSES, options = {}) {
        return traceOperation(`cache-get-or-set-${category}`, async () => {
            // Try to get from cache first
            let value = await this.get(key, category, options);
            
            if (value === null) {
                // Cache miss - fetch from source
                try {
                    value = await fetchFunction();
                    
                    if (value !== null && value !== undefined) {
                        // Store in cache
                        await this.set(key, value, category, options);
                    }
                    
                } catch (error) {
                    console.error('Error in cache fallback function:', error);
                    throw error;
                }
            }
            
            return value;
        });
    }

    /**
     * Intelligent cache warming
     */
    async warmupCriticalCaches() {
        return traceOperation('cache-warmup', async () => {
            const criticalCaches = [
                // Warm up workflow templates
                {
                    category: CacheCategory.WORKFLOW_TEMPLATES,
                    query: 'SELECT id, name, configuration FROM workflow_templates WHERE active = true LIMIT 100',
                    keyBuilder: (row) => `template:${row.id}`,
                    valueBuilder: (row) => ({ id: row.id, name: row.name, config: row.configuration })
                },
                
                // Warm up user authentication data  
                {
                    category: CacheCategory.AUTHENTICATION,
                    query: 'SELECT id, username, role FROM users WHERE active = true LIMIT 1000',
                    keyBuilder: (row) => `auth:${row.username}`,
                    valueBuilder: (row) => ({ id: row.id, username: row.username, role: row.role })
                }
            ];

            for (const cache of criticalCaches) {
                try {
                    const result = await DatabaseService.query(cache.query);
                    
                    const promises = result.rows.map(row => {
                        const key = cache.keyBuilder(row);
                        const value = cache.valueBuilder(row);
                        return this.set(key, value, cache.category, { warmup: true });
                    });
                    
                    await Promise.allSettled(promises);
                    console.log(`✅ Warmed up ${result.rows.length} entries for ${cache.category}`);
                    
                } catch (error) {
                    console.warn(`Failed to warm up cache ${cache.category}:`, error);
                }
            }
        });
    }

    /**
     * Start background maintenance tasks
     */
    startBackgroundMaintenance() {
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries().catch(console.error);
        }, 5 * 60 * 1000);

        // Update statistics every minute
        this.statsInterval = setInterval(() => {
            this.updateCacheStatistics().catch(console.error);
        }, 60 * 1000);

        console.log('✅ Cache background maintenance started');
    }

    /**
     * Clean up expired cache entries
     */
    async cleanupExpiredEntries() {
        return traceOperation('cache-cleanup', async () => {
            // Database cleanup
            const result = await DatabaseService.query(
                'DELETE FROM cache_entries WHERE expires_at < NOW() RETURNING category'
            );
            
            if (result.rows.length > 0) {
                const categoriesCleared = new Set(result.rows.map(r => r.category));
                console.log(`🧹 Cleaned up ${result.rows.length} expired cache entries from categories: ${[...categoriesCleared].join(', ')}`);
            }

            // Memory cache cleanup happens automatically via LRU
            // Redis cleanup happens automatically via TTL
        });
    }

    /**
     * Update cache performance statistics
     */
    async updateCacheStatistics() {
        // Calculate hit rates and performance metrics
        const totalRequests = this.stats.totalHits + this.stats.totalMisses;
        const hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests * 100) : 0;

        // Store aggregated statistics
        for (const [category, hitCount] of this.stats.hits) {
            const missCount = this.stats.misses.get(category) || 0;
            const categoryTotal = hitCount + missCount;
            const categoryHitRate = categoryTotal > 0 ? (hitCount / categoryTotal * 100) : 0;

            await DatabaseService.query(`
                INSERT INTO cache_statistics (category, layer, operation, count, response_time_ms)
                VALUES ($1, 'aggregate', 'hit_rate', $2, $3)
            `, [category, categoryHitRate, 0]);
        }

        // Reset counters
        this.resetStatistics();
    }

    // Utility methods
    buildCacheKey(key, category) {
        const hash = createHash('md5').update(key).digest('hex').substring(0, 8);
        return `${category}:${hash}:${key}`;
    }

    serializeValue(value) {
        return {
            data: value,
            cached_at: new Date().toISOString(),
            type: typeof value
        };
    }

    deserializeValue(cached) {
        return cached?.data;
    }

    getDefaultConfig() {
        return {
            layers: [CacheLayer.MEMORY, CacheLayer.REDIS],
            strategy: CacheStrategy.READ_THROUGH,
            ttl: {
                [CacheLayer.MEMORY]: 300,
                [CacheLayer.REDIS]: 1800
            },
            maxSize: 1000
        };
    }

    async updateCacheAccess(key) {
        await DatabaseService.query(
            'UPDATE cache_entries SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE key = $1',
            [key]
        );
    }

    // Statistics recording
    async recordHit(category, layer, responseTime) {
        this.stats.totalHits++;
        this.stats.totalRequests++;
        
        const categoryHits = this.stats.hits.get(category) || 0;
        this.stats.hits.set(category, categoryHits + 1);
        
        this.emit('cache:hit', { category, layer, responseTime });
    }

    async recordMiss(category, responseTime) {
        this.stats.totalMisses++;
        this.stats.totalRequests++;
        
        const categoryMisses = this.stats.misses.get(category) || 0;
        this.stats.misses.set(category, categoryMisses + 1);
        
        this.emit('cache:miss', { category, responseTime });
    }

    async recordWrite(category, responseTime) {
        const categoryWrites = this.stats.writes.get(category) || 0;
        this.stats.writes.set(category, categoryWrites + 1);
        
        this.emit('cache:write', { category, responseTime });
    }

    async recordError(category, operation, error) {
        const categoryErrors = this.stats.errors.get(category) || 0;
        this.stats.errors.set(category, categoryErrors + 1);
        
        this.emit('cache:error', { category, operation, error: error.message });
    }

    resetStatistics() {
        this.stats.hits.clear();
        this.stats.misses.clear();
        this.stats.writes.clear();
        this.stats.errors.clear();
        this.stats.totalRequests = 0;
        this.stats.totalHits = 0;
        this.stats.totalMisses = 0;
    }

    // Public API methods
    async getCacheStatistics() {
        const totalRequests = this.stats.totalHits + this.stats.totalMisses;
        const hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests * 100) : 0;

        return {
            totalRequests,
            totalHits: this.stats.totalHits,
            totalMisses: this.stats.totalMisses,
            hitRate: parseFloat(hitRate.toFixed(2)),
            categoriesStats: {
                hits: Object.fromEntries(this.stats.hits),
                misses: Object.fromEntries(this.stats.misses),
                writes: Object.fromEntries(this.stats.writes),
                errors: Object.fromEntries(this.stats.errors)
            },
            memoryCache: {
                size: this.memoryCache.size,
                calculatedSize: this.memoryCache.calculatedSize,
                maxSize: this.memoryCache.max
            }
        };
    }

    async getTopCachedItems(category, limit = 20) {
        const query = `
            SELECT key, access_count, size_bytes, last_accessed, expires_at
            FROM cache_entries 
            WHERE category = $1 
            ORDER BY access_count DESC 
            LIMIT $2
        `;
        
        const result = await DatabaseService.query(query, [category, limit]);
        return result.rows;
    }

    async cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        this.memoryCache.clear();
        this.resetStatistics();
        
        console.log('✅ Advanced Caching Service cleaned up');
    }
}

export default new AdvancedCachingService();
