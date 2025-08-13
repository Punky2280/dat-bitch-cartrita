/**
 * @fileoverview Model Cache - Caches model responses and embeddings
 */
import { Logger } from '../../core/index.js';
export class ModelCache {
    config;
    logger;
    cacheMap = new Map();
    constructor(config) {
        this.config = config;
        this.logger = Logger.create('ModelCache');
    }
    async initialize() {
        this.logger.info('Model Cache initialized (in-memory fallback)');
    }
    /**
     * Get cached response
     */
    async get(key) {
        const cached = this.cacheMap.get(key);
        if (cached && cached.expires > Date.now()) {
            this.logger.debug('Cache hit', { key });
            return cached.data;
        }
        if (cached) {
            this.cacheMap.delete(key); // Remove expired entry
        }
        this.logger.debug('Cache miss', { key });
        return null;
    }
    /**
     * Set cached response
     */
    async set(key, value, ttlSeconds) {
        const ttl = ttlSeconds || this.config.ttl || 3600; // 1 hour default
        const expires = Date.now() + (ttl * 1000);
        this.cacheMap.set(key, { data: value, expires });
        this.logger.debug('Cache set', { key, ttlSeconds: ttl });
    }
    /**
     * Generate cache key from request
     */
    generateKey(taskType, parameters) {
        const paramString = JSON.stringify(parameters);
        return `${taskType}:${Buffer.from(paramString).toString('base64')}`;
    }
    /**
     * Clear expired entries
     */
    async cleanup() {
        const now = Date.now();
        let clearedCount = 0;
        for (const [key, cached] of this.cacheMap.entries()) {
            if (cached.expires <= now) {
                this.cacheMap.delete(key);
                clearedCount++;
            }
        }
        if (clearedCount > 0) {
            this.logger.debug('Cache cleanup completed', { clearedCount });
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cacheMap.size,
            hitRate: 0, // Would need hit/miss counters for real stats
        };
    }
}
