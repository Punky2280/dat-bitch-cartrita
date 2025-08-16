import { Pool } from 'pg';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Advanced Database Connection Pool Manager
 * Provides intelligent connection pooling, monitoring, and optimization
 */
class ConnectionPoolManager {
  constructor() {
    this.pools = new Map(); // Named connection pools
    this.defaultPool = null;
    this.isInitialized = false;
    this.monitoringInterval = null;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      queries: 0,
      errors: 0,
      slowQueries: 0,
      lastHealthCheck: null,
      poolStats: new Map()
    };
    this.slowQueryThreshold = 1000; // ms
    this.healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Initialize connection pool manager
   */
  async initialize(config = {}) {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.initialize');
    
    try {
      console.log('🔗 Initializing Advanced Connection Pool Manager...');
      
      // Default configuration
      const defaultConfig = {
        // Primary database pool
        primary: {
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT) || 5432,
          database: process.env.DATABASE_NAME || 'cartrita',
          user: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD,
          
          // Pool settings
          min: parseInt(process.env.DB_POOL_MIN) || 2,
          max: parseInt(process.env.DB_POOL_MAX) || 20,
          acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
          createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 10000,
          destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,
          idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 300000, // 5 minutes
          createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL) || 1000,
          
          // Connection settings
          connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
          query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
          statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
          idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT) || 60000,
          
          // SSL configuration
          ssl: process.env.DATABASE_SSL === 'true' ? {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            ca: process.env.DATABASE_SSL_CA,
            cert: process.env.DATABASE_SSL_CERT,
            key: process.env.DATABASE_SSL_KEY
          } : false,
          
          // Advanced options
          application_name: 'cartrita-backend',
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000
        },
        
        // Read replica pools (if configured)
        readReplicas: process.env.READ_REPLICA_HOSTS ? 
          process.env.READ_REPLICA_HOSTS.split(',').map((host, index) => ({
            name: `read_replica_${index + 1}`,
            host: host.trim(),
            port: parseInt(process.env.READ_REPLICA_PORT) || 5432,
            database: process.env.DATABASE_NAME || 'cartrita',
            user: process.env.READ_REPLICA_USER || process.env.DATABASE_USER || 'postgres',
            password: process.env.READ_REPLICA_PASSWORD || process.env.DATABASE_PASSWORD,
            min: 1,
            max: 10,
            acquireTimeoutMillis: 20000,
            idleTimeoutMillis: 300000,
            ssl: process.env.READ_REPLICA_SSL === 'true',
            application_name: `cartrita-read-replica-${index + 1}`
          })) : [],
        
        // Analytics/reporting pool (separate for heavy queries)
        analytics: process.env.ANALYTICS_DATABASE_HOST ? {
          host: process.env.ANALYTICS_DATABASE_HOST,
          port: parseInt(process.env.ANALYTICS_DATABASE_PORT) || 5432,
          database: process.env.ANALYTICS_DATABASE_NAME || process.env.DATABASE_NAME || 'cartrita',
          user: process.env.ANALYTICS_DATABASE_USER || process.env.DATABASE_USER || 'postgres',
          password: process.env.ANALYTICS_DATABASE_PASSWORD || process.env.DATABASE_PASSWORD,
          min: 1,
          max: 5,
          acquireTimeoutMillis: 60000,
          idleTimeoutMillis: 600000, // 10 minutes
          query_timeout: 300000, // 5 minutes for analytics queries
          ssl: process.env.ANALYTICS_DATABASE_SSL === 'true',
          application_name: 'cartrita-analytics'
        } : null
      };
      
      const poolConfig = { ...defaultConfig, ...config };
      
      // Initialize primary pool
      await this.createPool('primary', poolConfig.primary);
      this.defaultPool = this.pools.get('primary');
      
      // Initialize read replica pools
      for (const replicaConfig of poolConfig.readReplicas) {
        await this.createPool(replicaConfig.name, replicaConfig);
      }
      
      // Initialize analytics pool if configured
      if (poolConfig.analytics) {
        await this.createPool('analytics', poolConfig.analytics);
      }
      
      // Test all connections
      await this.testAllConnections();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log(`✅ Advanced Connection Pool Manager initialized with ${this.pools.size} pool(s)`);
      
      span.setAttributes({
        'pool.count': this.pools.size,
        'pool.initialized': true,
        'pool.has_replicas': poolConfig.readReplicas.length > 0,
        'pool.has_analytics': !!poolConfig.analytics
      });
      
      return true;
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Connection Pool Manager initialization failed:', error.message);
      this.isInitialized = false;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a named connection pool
   */
  async createPool(name, config) {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.create_pool');
    
    try {
      console.log(`🏊‍♂️ Creating connection pool: ${name}`);
      
      const pool = new Pool(config);
      
      // Setup event handlers
      pool.on('connect', (client) => {
        console.log(`✅ New client connected to pool: ${name}`);
        this.updateMetrics();
      });

      pool.on('acquire', (client) => {
        this.updateMetrics();
      });

      pool.on('remove', (client) => {
        console.log(`🔌 Client removed from pool: ${name}`);
        this.updateMetrics();
      });

      pool.on('error', (err, client) => {
        console.error(`❌ Pool error in ${name}:`, err.message);
        this.metrics.errors++;
      });

      // Test the pool
      const testClient = await pool.connect();
      await testClient.query('SELECT NOW()');
      testClient.release();
      
      this.pools.set(name, pool);
      this.metrics.poolStats.set(name, {
        created: Date.now(),
        totalConnections: config.max,
        minConnections: config.min,
        queries: 0,
        errors: 0,
        avgResponseTime: 0
      });
      
      console.log(`✅ Pool ${name} created successfully (min: ${config.min}, max: ${config.max})`);
      
      span.setAttributes({
        'pool.name': name,
        'pool.min_connections': config.min,
        'pool.max_connections': config.max,
        'pool.created': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to create pool ${name}:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get a connection from specified pool
   */
  async getConnection(poolName = 'primary') {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.get_connection');
    
    try {
      const pool = this.pools.get(poolName);
      if (!pool) {
        throw new Error(`Pool '${poolName}' not found`);
      }
      
      const client = await pool.connect();
      
      // Add query tracking to client
      const originalQuery = client.query;
      client.query = (...args) => {
        const start = Date.now();
        const result = originalQuery.apply(client, args);
        
        if (result && typeof result.then === 'function') {
          return result.then(res => {
            this.trackQuery(poolName, Date.now() - start, args[0]);
            return res;
          }).catch(error => {
            this.trackQueryError(poolName, error, args[0]);
            throw error;
          });
        }
        
        return result;
      };
      
      span.setAttributes({
        'pool.name': poolName,
        'connection.acquired': true
      });
      
      return client;
      
    } catch (error) {
      span.recordException(error);
      this.metrics.errors++;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute query with intelligent pool selection
   */
  async query(sql, params = [], options = {}) {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.query');
    
    try {
      const {
        poolName = this.selectOptimalPool(sql, options),
        timeout = 30000,
        retries = 1
      } = options;
      
      let attempt = 0;
      let lastError;
      
      while (attempt <= retries) {
        try {
          const client = await this.getConnection(poolName);
          
          try {
            const start = Date.now();
            const result = await client.query(sql, params);
            const duration = Date.now() - start;
            
            this.trackQuery(poolName, duration, sql);
            
            span.setAttributes({
              'query.pool': poolName,
              'query.duration': duration,
              'query.rows': result.rowCount || 0,
              'query.attempt': attempt + 1
            });
            
            client.release();
            return result;
            
          } catch (error) {
            client.release();
            throw error;
          }
          
        } catch (error) {
          lastError = error;
          attempt++;
          
          if (attempt <= retries) {
            console.warn(`⚠️ Query attempt ${attempt} failed, retrying...`);
            await this.delay(1000 * attempt); // Exponential backoff
          }
        }
      }
      
      throw lastError;
      
    } catch (error) {
      span.recordException(error);
      this.trackQueryError('unknown', error, sql);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Select optimal pool based on query type and load balancing
   */
  selectOptimalPool(sql, options = {}) {
    // If specific pool requested, use it
    if (options.poolName) {
      return options.poolName;
    }
    
    const normalizedSql = sql.trim().toLowerCase();
    
    // Analytics queries go to analytics pool if available
    if (this.pools.has('analytics') && this.isAnalyticsQuery(normalizedSql)) {
      return 'analytics';
    }
    
    // Read queries can use read replicas
    if (this.isReadQuery(normalizedSql)) {
      const readReplicas = Array.from(this.pools.keys()).filter(name => 
        name.startsWith('read_replica_')
      );
      
      if (readReplicas.length > 0) {
        // Simple round-robin load balancing
        const index = this.metrics.queries % readReplicas.length;
        return readReplicas[index];
      }
    }
    
    // Default to primary pool
    return 'primary';
  }

  /**
   * Check if query is read-only
   */
  isReadQuery(sql) {
    const readPatterns = [
      /^\s*select\s/i,
      /^\s*with\s.*select\s/i,
      /^\s*explain\s/i,
      /^\s*show\s/i
    ];
    
    return readPatterns.some(pattern => pattern.test(sql));
  }

  /**
   * Check if query is for analytics
   */
  isAnalyticsQuery(sql) {
    const analyticsPatterns = [
      /group\s+by/i,
      /order\s+by.*limit\s+\d{3,}/i, // Large limits
      /count\s*\(/i,
      /sum\s*\(/i,
      /avg\s*\(/i,
      /aggregate/i,
      /report/i,
      /analytics/i
    ];
    
    return analyticsPatterns.some(pattern => pattern.test(sql));
  }

  /**
   * Track query performance
   */
  trackQuery(poolName, duration, sql) {
    this.metrics.queries++;
    
    const poolStats = this.metrics.poolStats.get(poolName);
    if (poolStats) {
      poolStats.queries++;
      poolStats.avgResponseTime = 
        (poolStats.avgResponseTime * (poolStats.queries - 1) + duration) / poolStats.queries;
    }
    
    if (duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      console.warn(`🐌 Slow query detected (${duration}ms) in pool ${poolName}: ${sql.substring(0, 100)}...`);
    }
  }

  /**
   * Track query errors
   */
  trackQueryError(poolName, error, sql) {
    this.metrics.errors++;
    
    const poolStats = this.metrics.poolStats.get(poolName);
    if (poolStats) {
      poolStats.errors++;
    }
    
    console.error(`❌ Query error in pool ${poolName}:`, error.message);
  }

  /**
   * Test all pool connections
   */
  async testAllConnections() {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.test_all');
    
    try {
      console.log('🧪 Testing all pool connections...');
      
      const testPromises = Array.from(this.pools.entries()).map(async ([name, pool]) => {
        try {
          const client = await pool.connect();
          const result = await client.query('SELECT $1::text as test', ['connection_test']);
          client.release();
          
          if (result.rows[0].test === 'connection_test') {
            console.log(`✅ Pool ${name} connection test passed`);
            return { name, status: 'healthy' };
          } else {
            throw new Error('Unexpected test result');
          }
        } catch (error) {
          console.error(`❌ Pool ${name} connection test failed:`, error.message);
          return { name, status: 'unhealthy', error: error.message };
        }
      });
      
      const results = await Promise.all(testPromises);
      const healthyPools = results.filter(r => r.status === 'healthy').length;
      
      console.log(`✅ Connection tests completed: ${healthyPools}/${results.length} pools healthy`);
      
      span.setAttributes({
        'pool.total_tested': results.length,
        'pool.healthy_count': healthyPools,
        'pool.test_passed': healthyPools === results.length
      });
      
      return results;
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Connection testing failed:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateMetrics();
        await this.performHealthChecks();
      } catch (error) {
        console.error('❌ Pool monitoring error:', error.message);
      }
    }, this.healthCheckInterval);
    
    console.log('📊 Connection pool monitoring started');
  }

  /**
   * Update pool metrics
   */
  async updateMetrics() {
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    
    for (const [name, pool] of this.pools) {
      totalConnections += pool.totalCount;
      activeConnections += pool.totalCount - pool.idleCount;
      idleConnections += pool.idleCount;
    }
    
    this.metrics.totalConnections = totalConnections;
    this.metrics.activeConnections = activeConnections;
    this.metrics.idleConnections = idleConnections;
    this.metrics.lastHealthCheck = new Date();
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.health_check');
    
    try {
      for (const [name, pool] of this.pools) {
        try {
          const client = await pool.connect();
          const start = Date.now();
          await client.query('SELECT 1');
          const latency = Date.now() - start;
          client.release();
          
          const poolStats = this.metrics.poolStats.get(name);
          if (poolStats) {
            poolStats.lastHealthCheck = {
              timestamp: new Date(),
              latency,
              status: 'healthy'
            };
          }
          
          if (latency > 500) {
            console.warn(`⚠️ High latency detected in pool ${name}: ${latency}ms`);
          }
          
        } catch (error) {
          console.error(`❌ Health check failed for pool ${name}:`, error.message);
          
          const poolStats = this.metrics.poolStats.get(name);
          if (poolStats) {
            poolStats.lastHealthCheck = {
              timestamp: new Date(),
              status: 'unhealthy',
              error: error.message
            };
          }
        }
      }
      
      span.setAttributes({
        'health_check.completed': true,
        'health_check.pools_checked': this.pools.size
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Health check process failed:', error.message);
    } finally {
      span.end();
    }
  }

  /**
   * Get detailed pool status
   */
  getPoolStatus() {
    const status = {
      isInitialized: this.isInitialized,
      poolCount: this.pools.size,
      metrics: { ...this.metrics },
      pools: {}
    };
    
    for (const [name, pool] of this.pools) {
      status.pools[name] = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        config: {
          min: pool.options.min,
          max: pool.options.max,
          acquireTimeoutMillis: pool.options.acquireTimeoutMillis,
          idleTimeoutMillis: pool.options.idleTimeoutMillis
        },
        stats: this.metrics.poolStats.get(name) || {}
      };
    }
    
    return status;
  }

  /**
   * Graceful shutdown
   */
  async cleanup() {
    const span = OpenTelemetryTracing.traceOperation('connection_pool.cleanup');
    
    try {
      console.log('🔄 Cleaning up Connection Pool Manager...');
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      const closePromises = Array.from(this.pools.entries()).map(async ([name, pool]) => {
        try {
          await pool.end();
          console.log(`✅ Pool ${name} closed successfully`);
        } catch (error) {
          console.error(`❌ Error closing pool ${name}:`, error.message);
        }
      });
      
      await Promise.all(closePromises);
      
      this.pools.clear();
      this.defaultPool = null;
      this.isInitialized = false;
      
      console.log('✅ Connection Pool Manager cleanup completed');
      
      span.setAttributes({
        'cleanup.completed': true,
        'pools.closed': closePromises.length
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Connection Pool Manager cleanup failed:', error.message);
    } finally {
      span.end();
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Backward compatibility methods
  async connect() {
    return await this.getConnection('primary');
  }

  async end() {
    await this.cleanup();
  }
}

export default new ConnectionPoolManager();
