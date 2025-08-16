/**
 * Connection Pool Manager Service
 * Manages database and service connection pools with auto-scaling for Cartrita
 * August 16, 2025
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Connection pool types
 */
export const PoolTypes = {
    DATABASE: 'database',
    REDIS: 'redis',
    HTTP: 'http',
    WEBSOCKET: 'websocket'
};

/**
 * Connection Pool Manager Service
 * Handles creation, scaling, and monitoring of connection pools
 */
export default class ConnectionPoolManagerService extends EventEmitter {
    constructor() {
        super();
        
        this.pools = new Map();
        this.poolConfigurations = new Map();
        this.monitorInterval = null;
        this.isInitialized = false;
        
        this.globalConfiguration = {
            monitoringInterval: 15000,
            defaultPoolSize: 10,
            maxPoolSize: 50,
            minPoolSize: 2,
            utilizationThreshold: 0.8,
            idleTimeout: 30000,
            connectionTimeout: 5000,
            healthCheckInterval: 60000
        };
        
        this.metrics = {
            totalPools: 0,
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            averageUtilization: 0,
            poolErrors: 0
        };
        
        this.init();
    }
    
    /**
     * Initialize connection pool manager
     */
    async init() {
        try {
            console.log('🔗 Initializing Connection Pool Manager Service...');
            
            // Create default database pool
            await this.createDefaultPools();
            
            // Start monitoring
            this.startPoolMonitoring();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('✅ Connection Pool Manager Service initialized');
            
        } catch (error) {
            console.error('❌ Connection Pool Manager initialization failed:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Create default connection pools
     */
    async createDefaultPools() {
        // Database connection pool
        if (process.env.DATABASE_URL) {
            await this.createPool('primary_db', {
                type: PoolTypes.DATABASE,
                connectionString: process.env.DATABASE_URL,
                poolSize: 15,
                maxPoolSize: 30,
                minPoolSize: 5
            });
        }
        
        // Redis connection pool (if configured)
        if (process.env.REDIS_HOST) {
            await this.createPool('primary_redis', {
                type: PoolTypes.REDIS,
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT || 6379,
                poolSize: 10,
                maxPoolSize: 25,
                minPoolSize: 3
            });
        }
        
        // HTTP connection pool for external APIs
        await this.createPool('http_client', {
            type: PoolTypes.HTTP,
            poolSize: 20,
            maxPoolSize: 50,
            minPoolSize: 5,
            keepAliveTimeout: 30000
        });
    }
    
    /**
     * Create a new connection pool
     */
    async createPool(poolId, configuration) {
        if (this.pools.has(poolId)) {
            throw new Error(`Pool ${poolId} already exists`);
        }
        
        const config = {
            ...this.globalConfiguration,
            ...configuration,
            id: poolId,
            createdAt: Date.now(),
            lastScaled: Date.now()
        };
        
        try {
            let pool;
            
            switch (config.type) {
                case PoolTypes.DATABASE:
                    pool = await this.createDatabasePool(config);
                    break;
                case PoolTypes.REDIS:
                    pool = await this.createRedisPool(config);
                    break;
                case PoolTypes.HTTP:
                    pool = await this.createHttpPool(config);
                    break;
                case PoolTypes.WEBSOCKET:
                    pool = await this.createWebSocketPool(config);
                    break;
                default:
                    throw new Error(`Unknown pool type: ${config.type}`);
            }
            
            const poolInfo = {
                id: poolId,
                type: config.type,
                pool: pool,
                configuration: config,
                metrics: {
                    totalConnections: 0,
                    activeConnections: 0,
                    idleConnections: 0,
                    waitingClients: 0,
                    errors: 0,
                    utilization: 0,
                    averageResponseTime: 0
                },
                lastHealthCheck: Date.now(),
                status: 'healthy'
            };
            
            this.pools.set(poolId, poolInfo);
            this.poolConfigurations.set(poolId, config);
            
            this.updateGlobalMetrics();
            this.emit('poolCreated', poolId);
            
            console.log(`✅ Created ${config.type} pool: ${poolId} (size: ${config.poolSize})`);
            
            return poolId;
            
        } catch (error) {
            console.error(`❌ Failed to create pool ${poolId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create PostgreSQL database pool
     */
    async createDatabasePool(config) {
        const pool = new Pool({
            connectionString: config.connectionString,
            max: config.poolSize,
            min: config.minPoolSize,
            idleTimeoutMillis: config.idleTimeout,
            connectionTimeoutMillis: config.connectionTimeout,
            allowExitOnIdle: false,
            application_name: 'cartrita_app'
        });
        
        // Test connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        return pool;
    }
    
    /**
     * Create Redis connection pool (mock implementation)
     */
    async createRedisPool(config) {
        // In a real implementation, this would use a Redis connection pool library
        const pool = {
            type: 'redis',
            host: config.host,
            port: config.port,
            size: config.poolSize,
            connections: [],
            acquire: async () => ({ query: () => Promise.resolve() }),
            release: () => {},
            destroy: () => {}
        };
        
        return pool;
    }
    
    /**
     * Create HTTP connection pool (mock implementation)
     */
    async createHttpPool(config) {
        // In a real implementation, this would use an HTTP agent with connection pooling
        const pool = {
            type: 'http',
            size: config.poolSize,
            keepAliveTimeout: config.keepAliveTimeout,
            connections: [],
            acquire: async () => ({ request: () => Promise.resolve() }),
            release: () => {},
            destroy: () => {}
        };
        
        return pool;
    }
    
    /**
     * Create WebSocket connection pool (mock implementation)
     */
    async createWebSocketPool(config) {
        const pool = {
            type: 'websocket',
            size: config.poolSize,
            connections: [],
            acquire: async () => ({ send: () => Promise.resolve() }),
            release: () => {},
            destroy: () => {}
        };
        
        return pool;
    }
    
    /**
     * Scale a pool up or down
     */
    async scalePool(poolId, newSize, reason = 'manual') {
        const poolInfo = this.pools.get(poolId);
        if (!poolInfo) {
            throw new Error(`Pool ${poolId} not found`);
        }
        
        const config = poolInfo.configuration;
        const currentSize = config.poolSize;
        
        if (newSize < config.minPoolSize || newSize > config.maxPoolSize) {
            throw new Error(`Pool size ${newSize} outside allowed range [${config.minPoolSize}, ${config.maxPoolSize}]`);
        }
        
        if (newSize === currentSize) {
            return; // No change needed
        }
        
        try {
            await OpenTelemetryTracing.traceOperation('pool.scale', async () => {
                if (config.type === PoolTypes.DATABASE) {
                    // For PostgreSQL pools, we need to recreate with new size
                    const oldPool = poolInfo.pool;
                    
                    const newPoolConfig = { ...config, poolSize: newSize };
                    const newPool = await this.createDatabasePool(newPoolConfig);
                    
                    // Replace the pool
                    poolInfo.pool = newPool;
                    poolInfo.configuration.poolSize = newSize;
                    poolInfo.configuration.lastScaled = Date.now();
                    
                    // Close old pool gracefully
                    setTimeout(() => oldPool.end(), 5000);
                    
                } else {
                    // For other pool types, update size directly
                    poolInfo.pool.size = newSize;
                    poolInfo.configuration.poolSize = newSize;
                    poolInfo.configuration.lastScaled = Date.now();
                }
                
                const direction = newSize > currentSize ? 'up' : 'down';
                
                this.updateGlobalMetrics();
                this.emit('poolScaled', {
                    poolId,
                    direction,
                    oldSize: currentSize,
                    newSize,
                    reason
                });
                
                console.log(`✅ Scaled ${poolId} ${direction} from ${currentSize} to ${newSize} (${reason})`);
            });
            
        } catch (error) {
            console.error(`❌ Failed to scale pool ${poolId}:`, error);
            throw error;
        }
    }
    
    /**
     * Start pool monitoring
     */
    startPoolMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        this.monitorInterval = setInterval(async () => {
            await this.monitorAllPools();
        }, this.globalConfiguration.monitoringInterval);
        
        console.log('🔍 Started connection pool monitoring');
    }
    
    /**
     * Monitor all pools for health and utilization
     */
    async monitorAllPools() {
        const monitoringTasks = Array.from(this.pools.keys()).map(poolId => 
            this.monitorPool(poolId)
        );
        
        await Promise.allSettled(monitoringTasks);
        this.updateGlobalMetrics();
        
        // Check for auto-scaling opportunities
        await this.evaluateAutoScaling();
    }
    
    /**
     * Monitor individual pool
     */
    async monitorPool(poolId) {
        const poolInfo = this.pools.get(poolId);
        if (!poolInfo) return;
        
        try {
            const startTime = Date.now();
            
            // Get pool metrics based on type
            let metrics;
            
            if (poolInfo.type === PoolTypes.DATABASE) {
                metrics = await this.getDatabasePoolMetrics(poolInfo.pool);
            } else {
                metrics = await this.getGenericPoolMetrics(poolInfo.pool);
            }
            
            const responseTime = Date.now() - startTime;
            
            // Update pool metrics
            poolInfo.metrics = {
                ...metrics,
                averageResponseTime: responseTime
            };
            
            poolInfo.lastHealthCheck = Date.now();
            poolInfo.status = 'healthy';
            
        } catch (error) {
            console.warn(`⚠️ Pool monitoring failed for ${poolId}:`, error.message);
            poolInfo.status = 'unhealthy';
            poolInfo.metrics.errors++;
            
            this.emit('poolUnhealthy', poolId, error);
        }
    }
    
    /**
     * Get database pool metrics
     */
    async getDatabasePoolMetrics(pool) {
        return {
            totalConnections: pool.totalCount || 0,
            activeConnections: pool.totalCount - pool.idleCount || 0,
            idleConnections: pool.idleCount || 0,
            waitingClients: pool.waitingCount || 0,
            utilization: pool.totalCount > 0 ? (pool.totalCount - pool.idleCount) / pool.totalCount : 0
        };
    }
    
    /**
     * Get generic pool metrics
     */
    async getGenericPoolMetrics(pool) {
        return {
            totalConnections: pool.size || 0,
            activeConnections: Math.floor((pool.size || 0) * Math.random()), // Mock data
            idleConnections: Math.floor((pool.size || 0) * Math.random()),
            waitingClients: 0,
            utilization: Math.random() * 0.8 // Mock utilization
        };
    }
    
    /**
     * Evaluate auto-scaling for all pools
     */
    async evaluateAutoScaling() {
        for (const [poolId, poolInfo] of this.pools.entries()) {
            const scalingDecision = this.evaluatePoolScaling(poolInfo);
            
            if (scalingDecision.action !== 'none') {
                try {
                    await this.scalePool(poolId, scalingDecision.newSize, scalingDecision.reason);
                } catch (error) {
                    console.warn(`⚠️ Auto-scaling failed for pool ${poolId}:`, error.message);
                }
            }
        }
    }
    
    /**
     * Evaluate scaling needs for individual pool with performance optimization
     */
    evaluatePoolScaling(poolInfo) {
        const config = poolInfo.configuration;
        const metrics = poolInfo.metrics;
        const currentSize = config.poolSize;
        
        // Performance optimization: Scale up conditions
        if (metrics.utilization > this.globalConfiguration.utilizationThreshold) {
            const newSize = Math.min(currentSize + Math.ceil(currentSize * 0.5), config.maxPoolSize);
            if (newSize > currentSize) {
                return { action: 'scale_up', newSize, reason: 'high_utilization' };
            }
        }
        
        if (metrics.waitingClients > 0) {
            const newSize = Math.min(currentSize + Math.ceil(metrics.waitingClients / 2), config.maxPoolSize);
            if (newSize > currentSize) {
                return { action: 'scale_up', newSize, reason: 'waiting_clients' };
            }
        }
        
        // Performance optimization: Scale down conditions
        if (metrics.utilization < 0.3 && currentSize > config.minPoolSize) {
            const timeSinceLastScale = Date.now() - config.lastScaled;
            if (timeSinceLastScale > 300000) { // 5 minutes cooldown
                const newSize = Math.max(currentSize - Math.ceil(currentSize * 0.25), config.minPoolSize);
                if (newSize < currentSize) {
                    return { action: 'scale_down', newSize, reason: 'low_utilization' };
                }
            }
        }
        
        return { action: 'none' };
    }
    
    /**
     * Update global metrics
     */
    updateGlobalMetrics() {
        const pools = Array.from(this.pools.values());
        
        this.metrics.totalPools = pools.length;
        this.metrics.totalConnections = pools.reduce((sum, p) => sum + p.metrics.totalConnections, 0);
        this.metrics.activeConnections = pools.reduce((sum, p) => sum + p.metrics.activeConnections, 0);
        this.metrics.idleConnections = pools.reduce((sum, p) => sum + p.metrics.idleConnections, 0);
        this.metrics.poolErrors = pools.reduce((sum, p) => sum + p.metrics.errors, 0);
        
        if (pools.length > 0) {
            this.metrics.averageUtilization = pools.reduce((sum, p) => sum + p.metrics.utilization, 0) / pools.length;
        }
    }
    
    /**
     * Get pool metrics
     */
    getPoolMetrics(poolId = null) {
        if (poolId) {
            const poolInfo = this.pools.get(poolId);
            return poolInfo ? {
                id: poolId,
                type: poolInfo.type,
                status: poolInfo.status,
                configuration: poolInfo.configuration,
                metrics: poolInfo.metrics,
                lastHealthCheck: poolInfo.lastHealthCheck
            } : null;
        }
        
        return {
            global: this.metrics,
            pools: Array.from(this.pools.values()).map(p => ({
                id: p.id,
                type: p.type,
                status: p.status,
                metrics: p.metrics,
                configuration: {
                    poolSize: p.configuration.poolSize,
                    minPoolSize: p.configuration.minPoolSize,
                    maxPoolSize: p.configuration.maxPoolSize
                }
            }))
        };
    }
    
    /**
     * Remove a pool
     */
    async removePool(poolId) {
        const poolInfo = this.pools.get(poolId);
        if (!poolInfo) {
            throw new Error(`Pool ${poolId} not found`);
        }
        
        try {
            // Gracefully close pool connections
            if (poolInfo.type === PoolTypes.DATABASE) {
                await poolInfo.pool.end();
            } else if (poolInfo.pool.destroy) {
                await poolInfo.pool.destroy();
            }
            
            this.pools.delete(poolId);
            this.poolConfigurations.delete(poolId);
            
            this.updateGlobalMetrics();
            this.emit('poolRemoved', poolId);
            
            console.log(`✅ Removed pool: ${poolId}`);
            
        } catch (error) {
            console.error(`❌ Failed to remove pool ${poolId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get pool status
     */
    getPoolStatus() {
        return {
            isInitialized: this.isInitialized,
            totalPools: this.metrics.totalPools,
            globalMetrics: this.metrics,
            healthyPools: Array.from(this.pools.values()).filter(p => p.status === 'healthy').length,
            unhealthyPools: Array.from(this.pools.values()).filter(p => p.status === 'unhealthy').length
        };
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🔗 Shutting down Connection Pool Manager Service...');
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        // Close all pools
        const shutdownPromises = Array.from(this.pools.keys()).map(poolId => 
            this.removePool(poolId)
        );
        
        await Promise.allSettled(shutdownPromises);
        
        this.isInitialized = false;
        
        console.log('✅ Connection Pool Manager Service shutdown complete');
    }
}
