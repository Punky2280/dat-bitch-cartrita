/**
 * @fileoverview Advanced Caching Engine (Task 22)
 * Multi-level caching system with intelligent strategies and performance optimization
 */

import EventEmitter from 'events';
import LRU from 'lru-cache';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import OpenTelemetryTracing from './OpenTelemetryTracing.js';

/**
 * Advanced Caching Engine
 * Comprehensive multi-level caching system with intelligent optimization
 */
export class AdvancedCachingEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Cache levels configuration
      l1: {
        maxSize: options.l1MaxSize || 1000,
        ttl: options.l1Ttl || 5 * 60 * 1000, // 5 minutes
        updateAgeOnGet: true,
        allowStale: false
      },
      
      l2: {
        ttl: options.l2Ttl || 30 * 60, // 30 minutes (Redis expects seconds)
        prefix: options.l2Prefix || 'cache:',
        compression: options.l2Compression || true
      },
      
      l3: {
        ttl: options.l3Ttl || 60 * 60, // 1 hour (database cache)
        tableName: options.l3TableName || 'cache_entries'
      },
      
      // Performance optimization settings
      optimization: {
        warmupEnabled: options.warmupEnabled !== false,
        prefetchEnabled: options.prefetchEnabled !== false,
        compressionThreshold: options.compressionThreshold || 1024, // bytes
        batchSize: options.batchSize || 50,
        maxConcurrentOperations: options.maxConcurrentOperations || 10
      },
      
      // Analytics configuration
      analytics: {
        enabled: options.analyticsEnabled !== false,
        trackingWindow: options.trackingWindow || 24 * 60 * 60 * 1000, // 24 hours
        metricsInterval: options.metricsInterval || 60 * 1000 // 1 minute
      }
    };

    // Initialize cache levels
    this.l1Cache = new LRU(this.config.l1);
    this.redisClient = null;
    this.dbClient = null;
    
    // Performance metrics
    this.metrics = {
      hits: { l1: 0, l2: 0, l3: 0, total: 0 },
      misses: { l1: 0, l2: 0, l3: 0, total: 0 },
      sets: { l1: 0, l2: 0, l3: 0, total: 0 },
      deletes: { l1: 0, l2: 0, l3: 0, total: 0 },
      errors: { l1: 0, l2: 0, l3: 0, total: 0 },
      latency: {
        l1: { total: 0, count: 0, avg: 0, max: 0, min: Infinity },
        l2: { total: 0, count: 0, avg: 0, max: 0, min: Infinity },
        l3: { total: 0, count: 0, avg: 0, max: 0, min: Infinity }
      },
      size: { l1: 0, l2: 0, l3: 0, total: 0 },
      memory: { used: 0, available: 0, percentage: 0 }
    };
    
    // Cache strategies
    this.strategies = new Map([
      ['write-through', this.writeThrough.bind(this)],
      ['write-back', this.writeBack.bind(this)],
      ['write-around', this.writeAround.bind(this)],
      ['read-through', this.readThrough.bind(this)],
      ['cache-aside', this.cacheAside.bind(this)],
      ['refresh-ahead', this.refreshAhead.bind(this)],
      ['time-based', this.timeBased.bind(this)],
      ['frequency-based', this.frequencyBased.bind(this)]
    ]);
    
    // Active operations tracking
    this.activeOperations = new Map();
    this.operationQueue = [];
    this.processingQueue = false;
    
    // Cache warming and prefetching
    this.warmupCache = new Set();
    this.prefetchPatterns = new Map();
    this.accessPatterns = new Map();
    
    // Performance monitoring
    this.performanceTracker = {
      responseTime: [],
      throughput: 0,
      errorRate: 0,
      lastUpdate: Date.now()
    };

    // Initialize OpenTelemetry tracing
    this.tracer = OpenTelemetryTracing.getTracer('advanced-caching-engine');
    this.meter = OpenTelemetryTracing.getMeter('advanced-caching-engine');
    
    // Create metrics collectors
    this.hitRateGauge = this.meter?.createGauge('cache_hit_rate', {
      description: 'Cache hit rate percentage'
    });
    
    this.latencyHistogram = this.meter?.createHistogram('cache_operation_latency', {
      description: 'Cache operation latency in milliseconds'
    });
    
    this.sizeGauge = this.meter?.createGauge('cache_size', {
      description: 'Total cache size across all levels'
    });
    
    // Start monitoring
    this.startPerformanceMonitoring();
    
    console.log('[AdvancedCachingEngine] 🚀 Advanced caching engine initialized');
  }

  /**
   * Initialize Redis and Database connections
   */
  async initialize(redisClient, dbClient) {
    try {
      this.redisClient = redisClient;
      this.dbClient = dbClient;
      
      // Test Redis connection
      if (this.redisClient) {
        try {
          await this.redisClient.ping();
          console.log('[AdvancedCachingEngine] ✅ Redis connection established');
        } catch (error) {
          console.warn('[AdvancedCachingEngine] ⚠️ Redis unavailable, L2 cache disabled');
          this.redisClient = null;
        }
      }
      
      // Test Database connection
      if (this.dbClient) {
        try {
          await this.dbClient.query('SELECT 1');
          console.log('[AdvancedCachingEngine] ✅ Database connection established');
        } catch (error) {
          console.warn('[AdvancedCachingEngine] ⚠️ Database unavailable, L3 cache disabled');
          this.dbClient = null;
        }
      }
      
      // Initialize cache warming if enabled
      if (this.config.optimization.warmupEnabled) {
        await this.initializeCacheWarming();
      }
      
      this.emit('initialized', {
        levels: {
          l1: true,
          l2: !!this.redisClient,
          l3: !!this.dbClient
        }
      });
      
      return true;
    } catch (error) {
      console.error('[AdvancedCachingEngine] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Multi-level cache GET operation
   */
  async get(key, options = {}) {
    const startTime = performance.now();
    const span = this.tracer?.startSpan('cache.get');
    
    try {
      span?.setAttributes({
        'cache.key': this.hashKey(key),
        'cache.strategy': options.strategy || 'default'
      });
      
      // L1 Cache - In-memory (fastest)
      const l1Result = await this.getFromL1(key);
      if (l1Result !== null) {
        this.recordHit('l1', performance.now() - startTime);
        span?.setAttributes({ 'cache.level': 'l1', 'cache.hit': true });
        
        // Update access patterns
        this.updateAccessPattern(key, 'l1');
        
        return l1Result;
      }
      
      // L2 Cache - Redis (fast)
      if (this.redisClient) {
        const l2Result = await this.getFromL2(key);
        if (l2Result !== null) {
          this.recordHit('l2', performance.now() - startTime);
          span?.setAttributes({ 'cache.level': 'l2', 'cache.hit': true });
          
          // Promote to L1
          await this.setToL1(key, l2Result, options.l1Ttl);
          
          // Update access patterns
          this.updateAccessPattern(key, 'l2');
          
          return l2Result;
        }
      }
      
      // L3 Cache - Database (slow but persistent)
      if (this.dbClient && options.useL3 !== false) {
        const l3Result = await this.getFromL3(key);
        if (l3Result !== null) {
          this.recordHit('l3', performance.now() - startTime);
          span?.setAttributes({ 'cache.level': 'l3', 'cache.hit': true });
          
          // Promote to L2 and L1
          if (this.redisClient) {
            await this.setToL2(key, l3Result, options.l2Ttl);
          }
          await this.setToL1(key, l3Result, options.l1Ttl);
          
          // Update access patterns
          this.updateAccessPattern(key, 'l3');
          
          return l3Result;
        }
      }
      
      // Cache miss
      this.recordMiss('total', performance.now() - startTime);
      span?.setAttributes({ 'cache.hit': false });
      
      // Trigger prefetch if pattern detected
      if (this.config.optimization.prefetchEnabled) {
        this.considerPrefetch(key);
      }
      
      return null;
      
    } catch (error) {
      this.recordError('total');
      span?.recordException(error);
      console.error('[AdvancedCachingEngine] Get error:', error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Multi-level cache SET operation
   */
  async set(key, value, options = {}) {
    const startTime = performance.now();
    const span = this.tracer?.startSpan('cache.set');
    
    try {
      const strategy = options.strategy || 'write-through';
      const ttl = {
        l1: options.l1Ttl || this.config.l1.ttl,
        l2: options.l2Ttl || this.config.l2.ttl,
        l3: options.l3Ttl || this.config.l3.ttl
      };
      
      span?.setAttributes({
        'cache.key': this.hashKey(key),
        'cache.strategy': strategy,
        'cache.value_size': JSON.stringify(value).length
      });
      
      // Apply caching strategy
      const strategyFn = this.strategies.get(strategy);
      if (strategyFn) {
        await strategyFn(key, value, ttl, options);
      } else {
        // Default: write-through strategy
        await this.writeThrough(key, value, ttl, options);
      }
      
      this.recordSet('total', performance.now() - startTime);
      
      // Update cache warming data
      if (this.config.optimization.warmupEnabled) {
        this.warmupCache.add(key);
      }
      
      // Emit cache update event
      this.emit('cacheUpdate', { key, value, strategy, timestamp: Date.now() });
      
      return true;
      
    } catch (error) {
      this.recordError('total');
      span?.recordException(error);
      console.error('[AdvancedCachingEngine] Set error:', error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Multi-level cache DELETE operation
   */
  async delete(key, options = {}) {
    const startTime = performance.now();
    const span = this.tracer?.startSpan('cache.delete');
    
    try {
      span?.setAttributes({
        'cache.key': this.hashKey(key),
        'cache.cascade': options.cascade !== false
      });
      
      const results = {
        l1: false,
        l2: false,
        l3: false
      };
      
      // Delete from all levels if cascading (default)
      if (options.cascade !== false) {
        // L1 - Memory
        results.l1 = this.l1Cache.delete(key);
        
        // L2 - Redis
        if (this.redisClient) {
          try {
            const redisKey = this.config.l2.prefix + key;
            const deleted = await this.redisClient.del(redisKey);
            results.l2 = deleted > 0;
          } catch (error) {
            console.error('[AdvancedCachingEngine] L2 delete error:', error);
          }
        }
        
        // L3 - Database
        if (this.dbClient && options.useL3 !== false) {
          try {
            const result = await this.dbClient.query(
              `DELETE FROM ${this.config.l3.tableName} WHERE cache_key = $1`,
              [key]
            );
            results.l3 = result.rowCount > 0;
          } catch (error) {
            console.error('[AdvancedCachingEngine] L3 delete error:', error);
          }
        }
      } else {
        // Delete from specific level only
        const level = options.level || 'l1';
        if (level === 'l1') {
          results.l1 = this.l1Cache.delete(key);
        } else if (level === 'l2' && this.redisClient) {
          const redisKey = this.config.l2.prefix + key;
          const deleted = await this.redisClient.del(redisKey);
          results.l2 = deleted > 0;
        } else if (level === 'l3' && this.dbClient) {
          const result = await this.dbClient.query(
            `DELETE FROM ${this.config.l3.tableName} WHERE cache_key = $1`,
            [key]
          );
          results.l3 = result.rowCount > 0;
        }
      }
      
      this.recordDelete('total', performance.now() - startTime);
      
      // Remove from warmup cache
      this.warmupCache.delete(key);
      
      // Remove from access patterns
      this.accessPatterns.delete(key);
      
      // Emit cache deletion event
      this.emit('cacheDelete', { key, results, timestamp: Date.now() });
      
      return results;
      
    } catch (error) {
      this.recordError('total');
      span?.recordException(error);
      console.error('[AdvancedCachingEngine] Delete error:', error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Cache invalidation with dependency tracking
   */
  async invalidate(pattern, options = {}) {
    const startTime = performance.now();
    const span = this.tracer?.startSpan('cache.invalidate');
    
    try {
      span?.setAttributes({
        'cache.pattern': pattern,
        'cache.cascade': options.cascade !== false
      });
      
      const invalidated = {
        l1: [],
        l2: [],
        l3: [],
        total: 0
      };
      
      // L1 - Iterate through in-memory cache
      for (const key of this.l1Cache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          this.l1Cache.delete(key);
          invalidated.l1.push(key);
        }
      }
      
      // L2 - Redis pattern matching
      if (this.redisClient && options.cascade !== false) {
        try {
          const redisPattern = this.config.l2.prefix + pattern;
          const keys = await this.redisClient.keys(redisPattern);
          
          if (keys.length > 0) {
            await this.redisClient.del(keys);
            invalidated.l2 = keys.map(key => key.replace(this.config.l2.prefix, ''));
          }
        } catch (error) {
          console.error('[AdvancedCachingEngine] L2 invalidation error:', error);
        }
      }
      
      // L3 - Database pattern matching
      if (this.dbClient && options.useL3 !== false) {
        try {
          const result = await this.dbClient.query(
            `DELETE FROM ${this.config.l3.tableName} WHERE cache_key LIKE $1`,
            [pattern.replace('*', '%')]
          );
          invalidated.l3 = result.rowCount || 0;
        } catch (error) {
          console.error('[AdvancedCachingEngine] L3 invalidation error:', error);
        }
      }
      
      invalidated.total = invalidated.l1.length + invalidated.l2.length + (invalidated.l3 || 0);
      
      console.log(`[AdvancedCachingEngine] 🗑️ Invalidated ${invalidated.total} entries matching "${pattern}"`);
      
      // Emit invalidation event
      this.emit('cacheInvalidation', { pattern, invalidated, timestamp: Date.now() });
      
      return invalidated;
      
    } catch (error) {
      span?.recordException(error);
      console.error('[AdvancedCachingEngine] Invalidation error:', error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * L1 Cache Operations (In-Memory)
   */
  async getFromL1(key) {
    try {
      const value = this.l1Cache.get(key);
      return value !== undefined ? value : null;
    } catch (error) {
      this.recordError('l1');
      return null;
    }
  }

  async setToL1(key, value, ttl) {
    try {
      const options = ttl ? { ttl } : undefined;
      this.l1Cache.set(key, value, options);
      this.recordSet('l1');
      return true;
    } catch (error) {
      this.recordError('l1');
      return false;
    }
  }

  /**
   * L2 Cache Operations (Redis)
   */
  async getFromL2(key) {
    if (!this.redisClient) return null;
    
    try {
      const redisKey = this.config.l2.prefix + key;
      const value = await this.redisClient.get(redisKey);
      
      if (value) {
        const parsed = JSON.parse(value);
        
        // Check for compression
        if (parsed._compressed) {
          return this.decompress(parsed.data);
        }
        
        return parsed;
      }
      
      return null;
    } catch (error) {
      this.recordError('l2');
      console.error('[AdvancedCachingEngine] L2 get error:', error);
      return null;
    }
  }

  async setToL2(key, value, ttl) {
    if (!this.redisClient) return false;
    
    try {
      const redisKey = this.config.l2.prefix + key;
      let serialized = JSON.stringify(value);
      
      // Apply compression if value is large enough
      if (serialized.length > this.config.optimization.compressionThreshold) {
        const compressed = this.compress(serialized);
        serialized = JSON.stringify({ _compressed: true, data: compressed });
      }
      
      const cacheTtl = ttl || this.config.l2.ttl;
      await this.redisClient.setEx(redisKey, cacheTtl, serialized);
      
      this.recordSet('l2');
      return true;
    } catch (error) {
      this.recordError('l2');
      console.error('[AdvancedCachingEngine] L2 set error:', error);
      return false;
    }
  }

  /**
   * L3 Cache Operations (Database)
   */
  async getFromL3(key) {
    if (!this.dbClient) return null;
    
    try {
      const result = await this.dbClient.query(
        `SELECT cache_value, expires_at FROM ${this.config.l3.tableName} 
         WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [key]
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].cache_value);
      }
      
      return null;
    } catch (error) {
      this.recordError('l3');
      console.error('[AdvancedCachingEngine] L3 get error:', error);
      return null;
    }
  }

  async setToL3(key, value, ttl) {
    if (!this.dbClient) return false;
    
    try {
      const serialized = JSON.stringify(value);
      const expiresAt = ttl ? new Date(Date.now() + (ttl * 1000)) : null;
      
      await this.dbClient.query(
        `INSERT INTO ${this.config.l3.tableName} (cache_key, cache_value, created_at, expires_at)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (cache_key) 
         DO UPDATE SET cache_value = $2, updated_at = NOW(), expires_at = $3`,
        [key, serialized, expiresAt]
      );
      
      this.recordSet('l3');
      return true;
    } catch (error) {
      this.recordError('l3');
      console.error('[AdvancedCachingEngine] L3 set error:', error);
      return false;
    }
  }

  /**
   * Caching Strategies Implementation
   */
  async writeThrough(key, value, ttl, options) {
    // Write to all available cache levels
    const promises = [
      this.setToL1(key, value, ttl.l1)
    ];
    
    if (this.redisClient) {
      promises.push(this.setToL2(key, value, ttl.l2));
    }
    
    if (this.dbClient && options.useL3 !== false) {
      promises.push(this.setToL3(key, value, ttl.l3));
    }
    
    await Promise.allSettled(promises);
  }

  async writeBack(key, value, ttl, options) {
    // Write to L1 immediately, defer L2/L3 writes
    await this.setToL1(key, value, ttl.l1);
    
    // Queue for background writes
    this.queueOperation('write-back', { key, value, ttl, options });
  }

  async writeAround(key, value, ttl, options) {
    // Skip L1, write directly to L2 and L3
    const promises = [];
    
    if (this.redisClient) {
      promises.push(this.setToL2(key, value, ttl.l2));
    }
    
    if (this.dbClient && options.useL3 !== false) {
      promises.push(this.setToL3(key, value, ttl.l3));
    }
    
    await Promise.allSettled(promises);
  }

  async readThrough(key, value, ttl, options) {
    // Standard read-through pattern
    await this.writeThrough(key, value, ttl, options);
  }

  async cacheAside(key, value, ttl, options) {
    // Application manages cache directly
    return this.setToL1(key, value, ttl.l1);
  }

  async refreshAhead(key, value, ttl, options) {
    // Proactively refresh before expiration
    await this.writeThrough(key, value, ttl, options);
    
    // Schedule refresh at 80% of TTL
    const refreshTime = Math.min(ttl.l1, ttl.l2, ttl.l3) * 0.8;
    setTimeout(() => {
      this.emit('refreshNeeded', { key, value, options });
    }, refreshTime);
  }

  async timeBased(key, value, ttl, options) {
    // Time-based invalidation strategy
    const timeGroup = this.getTimeGroup();
    const timedKey = `${timeGroup}:${key}`;
    
    await this.writeThrough(timedKey, value, ttl, options);
  }

  async frequencyBased(key, value, ttl, options) {
    // Frequency-based caching strategy
    const accessCount = this.getAccessCount(key);
    const frequencyTtl = {
      l1: ttl.l1 * Math.max(1, accessCount / 10),
      l2: ttl.l2 * Math.max(1, accessCount / 10),
      l3: ttl.l3 * Math.max(1, accessCount / 10)
    };
    
    await this.writeThrough(key, value, frequencyTtl, options);
  }

  /**
   * Utility Methods
   */
  hashKey(key) {
    return crypto.createHash('md5').update(key.toString()).digest('hex');
  }

  matchesPattern(str, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(str);
  }

  compress(data) {
    // Simple base64 encoding as placeholder for real compression
    return Buffer.from(data).toString('base64');
  }

  decompress(data) {
    // Simple base64 decoding as placeholder for real decompression
    return Buffer.from(data, 'base64').toString();
  }

  getTimeGroup() {
    return Math.floor(Date.now() / (1000 * 60 * 60)); // Hourly groups
  }

  getAccessCount(key) {
    const pattern = this.accessPatterns.get(key);
    return pattern ? pattern.count : 0;
  }

  updateAccessPattern(key, level) {
    const now = Date.now();
    const existing = this.accessPatterns.get(key) || {
      count: 0,
      levels: { l1: 0, l2: 0, l3: 0 },
      lastAccess: now,
      frequency: 0
    };
    
    existing.count++;
    existing.levels[level]++;
    existing.frequency = existing.count / ((now - existing.lastAccess) / 1000 || 1);
    existing.lastAccess = now;
    
    this.accessPatterns.set(key, existing);
  }

  considerPrefetch(key) {
    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.frequency > 0.1) { // More than once per 10 seconds
      this.emit('prefetchSuggestion', { key, pattern });
    }
  }

  queueOperation(type, data) {
    this.operationQueue.push({ type, data, timestamp: Date.now() });
    
    if (!this.processingQueue) {
      this.processOperationQueue();
    }
  }

  async processOperationQueue() {
    this.processingQueue = true;
    
    while (this.operationQueue.length > 0) {
      const batch = this.operationQueue.splice(0, this.config.optimization.batchSize);
      
      await Promise.allSettled(batch.map(async (op) => {
        try {
          if (op.type === 'write-back') {
            const { key, value, ttl, options } = op.data;
            
            if (this.redisClient) {
              await this.setToL2(key, value, ttl.l2);
            }
            
            if (this.dbClient && options.useL3 !== false) {
              await this.setToL3(key, value, ttl.l3);
            }
          }
        } catch (error) {
          console.error('[AdvancedCachingEngine] Queue operation error:', error);
        }
      }));
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.processingQueue = false;
  }

  /**
   * Performance Metrics Recording
   */
  recordHit(level, latency) {
    this.metrics.hits[level]++;
    this.metrics.hits.total++;
    this.recordLatency(level, latency);
    this.updateHitRateMetrics();
  }

  recordMiss(level, latency) {
    this.metrics.misses[level]++;
    this.metrics.misses.total++;
    if (level !== 'total') {
      this.recordLatency(level, latency);
    }
    this.updateHitRateMetrics();
  }

  recordSet(level, latency) {
    this.metrics.sets[level]++;
    this.metrics.sets.total++;
    if (latency) {
      this.recordLatency(level, latency);
    }
  }

  recordDelete(level, latency) {
    this.metrics.deletes[level]++;
    this.metrics.deletes.total++;
    if (latency) {
      this.recordLatency(level, latency);
    }
  }

  recordError(level) {
    this.metrics.errors[level]++;
    this.metrics.errors.total++;
  }

  recordLatency(level, latency) {
    const stats = this.metrics.latency[level];
    if (stats) {
      stats.total += latency;
      stats.count++;
      stats.avg = stats.total / stats.count;
      stats.max = Math.max(stats.max, latency);
      stats.min = Math.min(stats.min, latency);
      
      // Record OpenTelemetry metrics
      this.latencyHistogram?.record(latency, { level });
    }
  }

  updateHitRateMetrics() {
    const total = this.metrics.hits.total + this.metrics.misses.total;
    if (total > 0) {
      const hitRate = (this.metrics.hits.total / total) * 100;
      this.hitRateGauge?.record(hitRate);
    }
  }

  /**
   * Cache warming initialization
   */
  async initializeCacheWarming() {
    try {
      // Load frequently accessed keys from the database
      if (this.dbClient) {
        const result = await this.dbClient.query(`
          SELECT cache_key, cache_value 
          FROM ${this.config.l3.tableName} 
          WHERE created_at > NOW() - INTERVAL '7 days'
          ORDER BY updated_at DESC 
          LIMIT 100
        `);
        
        for (const row of result.rows) {
          try {
            const value = JSON.parse(row.cache_value);
            await this.setToL1(row.cache_key, value);
            this.warmupCache.add(row.cache_key);
          } catch (error) {
            console.warn('[AdvancedCachingEngine] Cache warming error:', error);
          }
        }
        
        console.log(`[AdvancedCachingEngine] 🔥 Warmed up ${result.rows.length} cache entries`);
      }
    } catch (error) {
      console.error('[AdvancedCachingEngine] Cache warming initialization error:', error);
    }
  }

  /**
   * Performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updateCacheSizeMetrics();
      this.updateMemoryMetrics();
      this.emitPerformanceMetrics();
    }, this.config.analytics.metricsInterval);
  }

  updateCacheSizeMetrics() {
    this.metrics.size.l1 = this.l1Cache.size;
    this.metrics.size.total = this.metrics.size.l1;
    
    this.sizeGauge?.record(this.metrics.size.total);
  }

  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      used: memUsage.heapUsed,
      available: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
  }

  emitPerformanceMetrics() {
    this.emit('performanceMetrics', {
      metrics: this.metrics,
      timestamp: Date.now(),
      config: this.config
    });
  }

  /**
   * Cache statistics and monitoring
   */
  getStats() {
    const total = this.metrics.hits.total + this.metrics.misses.total;
    const hitRate = total > 0 ? (this.metrics.hits.total / total) * 100 : 0;
    
    return {
      hitRate: {
        overall: hitRate,
        l1: this.metrics.hits.l1 / (this.metrics.hits.l1 + this.metrics.misses.l1 + this.metrics.misses.l2 + this.metrics.misses.l3) * 100 || 0,
        l2: this.metrics.hits.l2 / (this.metrics.hits.l2 + this.metrics.misses.l3) * 100 || 0,
        l3: this.metrics.hits.l3 / this.metrics.hits.l3 * 100 || 100
      },
      operations: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        sets: this.metrics.sets,
        deletes: this.metrics.deletes,
        errors: this.metrics.errors
      },
      latency: this.metrics.latency,
      size: this.metrics.size,
      memory: this.metrics.memory,
      levels: {
        l1: { enabled: true, type: 'memory' },
        l2: { enabled: !!this.redisClient, type: 'redis' },
        l3: { enabled: !!this.dbClient, type: 'database' }
      },
      accessPatterns: Object.fromEntries(
        Array.from(this.accessPatterns.entries()).slice(0, 10)
      ),
      warmupCache: Array.from(this.warmupCache).slice(0, 10)
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      levels: {
        l1: { status: 'healthy', type: 'memory' },
        l2: { status: 'unknown', type: 'redis' },
        l3: { status: 'unknown', type: 'database' }
      },
      metrics: this.getStats(),
      timestamp: Date.now()
    };
    
    // Check Redis health
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        health.levels.l2.status = 'healthy';
      } catch (error) {
        health.levels.l2.status = 'unhealthy';
        health.levels.l2.error = error.message;
        health.overall = 'degraded';
      }
    } else {
      health.levels.l2.status = 'disabled';
    }
    
    // Check Database health
    if (this.dbClient) {
      try {
        await this.dbClient.query('SELECT 1');
        health.levels.l3.status = 'healthy';
      } catch (error) {
        health.levels.l3.status = 'unhealthy';
        health.levels.l3.error = error.message;
        health.overall = 'degraded';
      }
    } else {
      health.levels.l3.status = 'disabled';
    }
    
    return health;
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    console.log('[AdvancedCachingEngine] 🧹 Cleaning up...');
    
    // Process remaining queue operations
    if (this.operationQueue.length > 0) {
      await this.processOperationQueue();
    }
    
    // Clear L1 cache
    this.l1Cache.clear();
    
    // Clean up access patterns older than tracking window
    const cutoff = Date.now() - this.config.analytics.trackingWindow;
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (pattern.lastAccess < cutoff) {
        this.accessPatterns.delete(key);
      }
    }
    
    console.log('[AdvancedCachingEngine] ✅ Cleanup completed');
  }
}

export default AdvancedCachingEngine;
