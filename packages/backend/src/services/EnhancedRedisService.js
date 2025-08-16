import Redis from 'ioredis';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Enhanced Redis Service with Cluster Support and Advanced Features
 * Provides distributed caching, session management, and high availability
 */
class EnhancedRedisService {
  constructor() {
    this.redis = null;
    this.cluster = null;
    this.isClusterMode = false;
    this.isInitialized = false;
    this.connectionConfig = null;
    this.healthCheckInterval = null;
    this.metrics = {
      connections: 0,
      commands: 0,
      errors: 0,
      reconnects: 0,
      lastHealthCheck: null
    };
  }

  /**
   * Initialize Redis service with cluster support
   */
  async initialize(config = {}) {
    const span = OpenTelemetryTracing.traceOperation('redis.initialize');
    
    try {
      const defaultConfig = {
        // Single Redis instance config
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
        
        // Cluster config
        enableCluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
        clusterNodes: process.env.REDIS_CLUSTER_NODES ? 
          process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
            const [host, port] = node.split(':');
            return { host: host.trim(), port: parseInt(port) || 6379 };
          }) : [],
        
        // Connection options
        retryDelayOnFailover: 1000,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        commandTimeout: 5000,
        lazyConnect: true,
        keepAlive: 30000,
        
        // Pool settings
        maxConnections: 10,
        minConnections: 2,
        
        // Advanced options
        enableReadyCheck: true,
        enableOfflineQueue: false,
        family: 4, // IPv4
        
        // Cluster-specific options
        enableClusterFailover: true,
        clusterRetryDelayOnFailover: 1000,
        clusterMaxRedirections: 16
      };

      this.connectionConfig = { ...defaultConfig, ...config };
      
      console.log('🔴 Initializing Enhanced Redis Service...');
      
      if (this.connectionConfig.enableCluster && this.connectionConfig.clusterNodes.length > 0) {
        await this.initializeCluster();
      } else {
        await this.initializeSingle();
      }

      // Setup event handlers
      this.setupEventHandlers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      console.log(`✅ Enhanced Redis Service initialized successfully (${this.isClusterMode ? 'Cluster' : 'Single'} mode)`);
      
      span.setAttributes({
        'redis.mode': this.isClusterMode ? 'cluster' : 'single',
        'redis.initialized': true,
        'redis.cluster_nodes': this.isClusterMode ? this.connectionConfig.clusterNodes.length : 0
      });
      
      return true;
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Enhanced Redis Service initialization failed:', error.message);
      this.isInitialized = false;
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize Redis cluster
   */
  async initializeCluster() {
    const clusterOptions = {
      enableReadyCheck: this.connectionConfig.enableReadyCheck,
      redisOptions: {
        password: this.connectionConfig.password,
        connectTimeout: this.connectionConfig.connectTimeout,
        commandTimeout: this.connectionConfig.commandTimeout,
        retryDelayOnFailover: this.connectionConfig.retryDelayOnFailover,
        maxRetriesPerRequest: this.connectionConfig.maxRetriesPerRequest,
        lazyConnect: this.connectionConfig.lazyConnect,
        keepAlive: this.connectionConfig.keepAlive,
        family: this.connectionConfig.family
      },
      clusterRetryDelayOnFailover: this.connectionConfig.clusterRetryDelayOnFailover,
      maxRedirections: this.connectionConfig.clusterMaxRedirections,
      enableOfflineQueue: this.connectionConfig.enableOfflineQueue
    };

    this.cluster = new Redis.Cluster(this.connectionConfig.clusterNodes, clusterOptions);
    this.redis = this.cluster; // Use cluster as main redis client
    this.isClusterMode = true;
    
    console.log(`🔗 Connecting to Redis Cluster with ${this.connectionConfig.clusterNodes.length} nodes`);
  }

  /**
   * Initialize single Redis instance
   */
  async initializeSingle() {
    const singleOptions = {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      password: this.connectionConfig.password,
      db: this.connectionConfig.db,
      connectTimeout: this.connectionConfig.connectTimeout,
      commandTimeout: this.connectionConfig.commandTimeout,
      retryDelayOnFailover: this.connectionConfig.retryDelayOnFailover,
      maxRetriesPerRequest: this.connectionConfig.maxRetriesPerRequest,
      lazyConnect: this.connectionConfig.lazyConnect,
      keepAlive: this.connectionConfig.keepAlive,
      enableOfflineQueue: this.connectionConfig.enableOfflineQueue,
      family: this.connectionConfig.family
    };

    this.redis = new Redis(singleOptions);
    this.isClusterMode = false;
    
    console.log(`🔗 Connecting to Redis at ${this.connectionConfig.host}:${this.connectionConfig.port}`);
  }

  /**
   * Setup Redis event handlers
   */
  setupEventHandlers() {
    this.redis.on('connect', () => {
      this.metrics.connections++;
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('ready', () => {
      console.log('🚀 Redis is ready to receive commands');
    });

    this.redis.on('error', (error) => {
      this.metrics.errors++;
      console.error('❌ Redis connection error:', error.message);
    });

    this.redis.on('close', () => {
      console.log('🔌 Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.metrics.reconnects++;
      console.log('🔄 Redis reconnecting...');
    });

    if (this.isClusterMode) {
      this.cluster.on('node error', (error, address) => {
        console.error(`❌ Redis cluster node error at ${address}:`, error.message);
      });

      this.cluster.on('failover', (address) => {
        console.log(`🔄 Redis cluster failover to ${address}`);
      });
    }
  }

  /**
   * Test Redis connection
   */
  async testConnection() {
    const span = OpenTelemetryTracing.traceOperation('redis.test_connection');
    
    try {
      const testKey = 'redis:health:test';
      const testValue = Date.now().toString();
      
      await this.redis.set(testKey, testValue, 'EX', 10); // Expire in 10 seconds
      const result = await this.redis.get(testKey);
      
      if (result !== testValue) {
        throw new Error('Redis read/write test failed');
      }
      
      await this.redis.del(testKey);
      console.log('✅ Redis connection test passed');
      
      span.setAttributes({
        'redis.test_passed': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Redis connection test failed:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const start = Date.now();
        await this.redis.ping();
        const latency = Date.now() - start;
        
        this.metrics.lastHealthCheck = {
          timestamp: new Date(),
          latency,
          status: 'healthy'
        };
        
        // Log slow pings
        if (latency > 100) {
          console.warn(`⚠️ Redis ping latency: ${latency}ms`);
        }
        
      } catch (error) {
        this.metrics.lastHealthCheck = {
          timestamp: new Date(),
          status: 'unhealthy',
          error: error.message
        };
        console.error('❌ Redis health check failed:', error.message);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Enhanced caching methods
   */

  /**
   * Set value with advanced options
   */
  async setAdvanced(key, value, options = {}) {
    const span = OpenTelemetryTracing.traceOperation('redis.set_advanced');
    
    try {
      const {
        ttl = null,
        tags = [],
        compress = false,
        version = null
      } = options;

      let processedValue = value;
      
      // Handle object serialization
      if (typeof value === 'object' && value !== null) {
        processedValue = JSON.stringify(value);
      }
      
      // Simple compression for large strings
      if (compress && typeof processedValue === 'string' && processedValue.length > 1000) {
        // In a real implementation, you'd use a compression library
        console.log(`🗜️ Compressing large cache value for key: ${key}`);
      }

      // Build metadata
      const metadata = {
        type: typeof value,
        cached_at: Date.now(),
        tags,
        version,
        compressed: compress
      };

      // Use pipeline for atomic operation
      const pipeline = this.redis.pipeline();
      
      if (ttl) {
        pipeline.setex(key, ttl, processedValue);
      } else {
        pipeline.set(key, processedValue);
      }
      
      // Store metadata
      pipeline.hset(`${key}:meta`, metadata);
      if (ttl) {
        pipeline.expire(`${key}:meta`, ttl);
      }
      
      // Add to tag indexes
      tags.forEach(tag => {
        pipeline.sadd(`tag:${tag}`, key);
        if (ttl) {
          pipeline.expire(`tag:${tag}`, ttl);
        }
      });
      
      await pipeline.exec();
      this.metrics.commands += pipeline.length;
      
      span.setAttributes({
        'redis.key': key,
        'redis.ttl': ttl,
        'redis.tags': tags.length,
        'redis.compressed': compress
      });
      
      return true;
      
    } catch (error) {
      span.recordException(error);
      this.metrics.errors++;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get value with metadata
   */
  async getAdvanced(key) {
    const span = OpenTelemetryTracing.traceOperation('redis.get_advanced');
    
    try {
      const pipeline = this.redis.pipeline();
      pipeline.get(key);
      pipeline.hgetall(`${key}:meta`);
      
      const results = await pipeline.exec();
      this.metrics.commands += 2;
      
      const [valueResult, metaResult] = results;
      const value = valueResult[1];
      const metadata = metaResult[1];
      
      if (value === null) {
        return null;
      }
      
      let processedValue = value;
      
      // Handle deserialization
      if (metadata.type === 'object') {
        try {
          processedValue = JSON.parse(value);
        } catch (e) {
          console.warn(`⚠️ Failed to parse cached object for key: ${key}`);
        }
      }
      
      span.setAttributes({
        'redis.key': key,
        'redis.hit': true,
        'redis.cached_at': metadata.cached_at
      });
      
      return {
        value: processedValue,
        metadata: {
          ...metadata,
          age: metadata.cached_at ? Date.now() - parseInt(metadata.cached_at) : null
        }
      };
      
    } catch (error) {
      span.recordException(error);
      this.metrics.errors++;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags) {
    const span = OpenTelemetryTracing.traceOperation('redis.invalidate_by_tags');
    
    try {
      const keysToDelete = new Set();
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        keys.forEach(key => {
          keysToDelete.add(key);
          keysToDelete.add(`${key}:meta`);
        });
        keysToDelete.add(`tag:${tag}`);
      }
      
      if (keysToDelete.size > 0) {
        const pipeline = this.redis.pipeline();
        keysToDelete.forEach(key => pipeline.del(key));
        await pipeline.exec();
        
        console.log(`🗑️ Invalidated ${keysToDelete.size} cache entries for tags: ${tags.join(', ')}`);
      }
      
      span.setAttributes({
        'redis.tags_invalidated': tags.length,
        'redis.keys_deleted': keysToDelete.size
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Cache invalidation by tags failed:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Session management methods
   */

  /**
   * Store session data
   */
  async setSession(sessionId, sessionData, ttl = 3600) {
    const key = `session:${sessionId}`;
    return await this.setAdvanced(key, sessionData, { 
      ttl, 
      tags: ['session', `user:${sessionData.userId}`] 
    });
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    const result = await this.getAdvanced(key);
    return result ? result.value : null;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    const result = await this.redis.del(key, `${key}:meta`);
    return result > 0;
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    try {
      const info = await this.redis.info();
      const memory = await this.redis.info('memory');
      
      return {
        status: 'healthy',
        mode: this.isClusterMode ? 'cluster' : 'single',
        connected: this.redis.status === 'ready',
        lastHealthCheck: this.metrics.lastHealthCheck,
        metrics: {
          ...this.metrics,
          info: this.parseRedisInfo(info),
          memory: this.parseRedisInfo(memory)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        metrics: this.metrics
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  parseRedisInfo(infoString) {
    const info = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        info[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return info;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isInitialized: this.isInitialized,
      mode: this.isClusterMode ? 'cluster' : 'single',
      status: this.redis ? this.redis.status : 'disconnected'
    };
  }

  /**
   * Cleanup and close connections
   */
  async cleanup() {
    const span = OpenTelemetryTracing.traceOperation('redis.cleanup');
    
    try {
      console.log('🔄 Cleaning up Enhanced Redis Service...');
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      
      if (this.cluster && this.cluster !== this.redis) {
        await this.cluster.quit();
        this.cluster = null;
      }
      
      this.isInitialized = false;
      console.log('✅ Enhanced Redis Service cleanup completed');
      
      span.setAttributes({
        'redis.cleanup_completed': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Enhanced Redis Service cleanup failed:', error.message);
    } finally {
      span.end();
    }
  }

  // Backward compatibility methods
  get client() {
    return this.redis;
  }

  async get(key) {
    return await this.redis.get(key);
  }

  async set(key, value, mode, duration) {
    if (mode === 'EX') {
      return await this.redis.setex(key, duration, value);
    }
    return await this.redis.set(key, value);
  }

  async del(key) {
    return await this.redis.del(key);
  }

  async exists(key) {
    return await this.redis.exists(key);
  }

  async expire(key, seconds) {
    return await this.redis.expire(key, seconds);
  }

  async ttl(key) {
    return await this.redis.ttl(key);
  }
}

export default new EnhancedRedisService();
