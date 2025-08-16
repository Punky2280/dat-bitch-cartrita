/**
 * Redis Cluster Configuration Service
 * Manages Redis cluster configuration and auto-scaling for Cartrita
 * August 16, 2025
 */

import { EventEmitter } from 'events';
import { createClient } from 'redis';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Redis cluster configuration and management service
 * Handles node management, health monitoring, and auto-scaling
 */
export default class RedisClusterConfigService extends EventEmitter {
    constructor() {
        super();
        
        this.clusterNodes = new Map();
        this.healthMonitor = null;
        this.isInitialized = false;
        this.metrics = {
            totalNodes: 0,
            activeNodes: 0,
            failedNodes: 0,
            totalConnections: 0,
            memoryUsage: 0,
            cacheHitRate: 0,
            averageResponseTime: 0
        };
        
        this.configuration = {
            minNodes: 3,
            maxNodes: 12,
            healthCheckInterval: 30000,
            connectionTimeout: 5000,
            retryAttempts: 3,
            failoverThreshold: 0.7,
            memoryThreshold: 0.85,
            responseTimeThreshold: 100
        };
        
        this.init();
    }
    
    /**
     * Initialize Redis cluster service
     */
    async init() {
        try {
            console.log('🔴 Initializing Redis Cluster Configuration Service...');
            
            // Load initial cluster configuration
            await this.loadClusterConfiguration();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('✅ Redis Cluster Service initialized');
            
        } catch (error) {
            console.error('❌ Redis Cluster Service initialization failed:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Load cluster configuration from environment or defaults
     */
    async loadClusterConfiguration() {
        const defaultNodes = [
            { host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379, slot: '0-5460' },
            { host: process.env.REDIS_HOST_2 || 'localhost', port: parseInt(process.env.REDIS_PORT_2) || 6380, slot: '5461-10922' },
            { host: process.env.REDIS_HOST_3 || 'localhost', port: parseInt(process.env.REDIS_PORT_3) || 6381, slot: '10923-16383' }
        ];
        
        for (const nodeConfig of defaultNodes) {
            await this.addNode(nodeConfig, false);
        }
        
        this.updateMetrics();
    }
    
    /**
     * Add new Redis nodes to the cluster
     */
    async addNodes(nodeConfigs) {
        const addedNodes = [];
        
        for (const nodeConfig of nodeConfigs) {
            try {
                const nodeId = await this.addNode(nodeConfig);
                addedNodes.push(nodeId);
            } catch (error) {
                console.warn(`⚠️ Failed to add node ${nodeConfig.host}:${nodeConfig.port}:`, error.message);
            }
        }
        
        if (addedNodes.length > 0) {
            await this.redistributeSlots();
            this.updateMetrics();
            this.emit('nodesAdded', addedNodes);
            
            console.log(`✅ Added ${addedNodes.length} Redis nodes to cluster`);
        }
        
        return addedNodes;
    }
    
    /**
     * Remove multiple Redis nodes from the cluster
     */
    async removeNodes(nodeIds) {
        const removedNodes = [];
        
        for (const nodeId of nodeIds) {
            try {
                await this.removeNode(nodeId);
                removedNodes.push(nodeId);
            } catch (error) {
                console.warn(`⚠️ Failed to remove node ${nodeId}:`, error.message);
            }
        }
        
        if (removedNodes.length > 0) {
            this.emit('nodesRemoved', removedNodes);
            console.log(`✅ Removed ${removedNodes.length} Redis nodes from cluster`);
        }
        
        return removedNodes;
    }
    
    /**
     * Add a new Redis node to the cluster
     */
    async addNode(nodeConfig, updateCluster = true) {
        const nodeId = `${nodeConfig.host}:${nodeConfig.port}`;
        
        try {
            const client = createClient({
                socket: {
                    host: nodeConfig.host,
                    port: nodeConfig.port,
                    connectTimeout: this.configuration.connectionTimeout
                },
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: this.configuration.retryAttempts
            });
            
            // Test connection
            await client.connect();
            
            const nodeInfo = {
                id: nodeId,
                host: nodeConfig.host,
                port: nodeConfig.port,
                slot: nodeConfig.slot,
                client: client,
                status: 'healthy',
                lastHealthCheck: Date.now(),
                metrics: {
                    connections: 0,
                    memoryUsed: 0,
                    memoryTotal: 0,
                    responseTime: 0,
                    cacheHits: 0,
                    cacheMisses: 0
                }
            };
            
            this.clusterNodes.set(nodeId, nodeInfo);
            
            if (updateCluster) {
                await this.redistributeSlots();
                this.updateMetrics();
                this.emit('nodeAdded', nodeId);
                
                console.log(`✅ Added Redis node: ${nodeId}`);
            }
            
            return nodeId;
            
        } catch (error) {
            console.error(`❌ Failed to add Redis node ${nodeId}:`, error);
            throw error;
        }
    }
    
    /**
     * Remove a Redis node from the cluster
     */
    async removeNode(nodeId) {
        const node = this.clusterNodes.get(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }
        
        try {
            // Gracefully close connection
            if (node.client && node.client.isReady) {
                await node.client.disconnect();
            }
            
            this.clusterNodes.delete(nodeId);
            
            // Redistribute slots among remaining nodes
            await this.redistributeSlots();
            this.updateMetrics();
            
            this.emit('nodeRemoved', nodeId);
            console.log(`✅ Removed Redis node: ${nodeId}`);
            
        } catch (error) {
            console.error(`❌ Failed to remove Redis node ${nodeId}:`, error);
            throw error;
        }
    }
    
    /**
     * Start health monitoring for all cluster nodes
     */
    startHealthMonitoring() {
        if (this.healthMonitor) {
            clearInterval(this.healthMonitor);
        }
        
        this.healthMonitor = setInterval(async () => {
            await this.performHealthChecks();
        }, this.configuration.healthCheckInterval);
        
        console.log('🔍 Started Redis cluster health monitoring');
    }
    
    /**
     * Perform health checks on all cluster nodes
     */
    async performHealthChecks() {
        const healthChecks = Array.from(this.clusterNodes.values()).map(node => 
            this.checkNodeHealth(node)
        );
        
        await Promise.allSettled(healthChecks);
        this.updateMetrics();
        
        // Check if scaling is needed
        const scalingDecision = this.evaluateScalingNeeds();
        if (scalingDecision.action !== 'none') {
            this.emit('scalingRequired', scalingDecision);
        }
    }
    
    /**
     * Check health of individual Redis node
     */
    async checkNodeHealth(node) {
        const startTime = Date.now();
        
        try {
            // Ping test
            const pong = await node.client.ping();
            const responseTime = Date.now() - startTime;
            
            // Get memory info
            const info = await node.client.info('memory');
            const memoryUsed = this.parseRedisMemoryInfo(info, 'used_memory');
            const memoryTotal = this.parseRedisMemoryInfo(info, 'maxmemory') || memoryUsed * 2;
            
            // Get stats
            const stats = await node.client.info('stats');
            const cacheHits = this.parseRedisStatsInfo(stats, 'keyspace_hits');
            const cacheMisses = this.parseRedisStatsInfo(stats, 'keyspace_misses');
            
            // Update node metrics
            node.metrics = {
                connections: parseInt(this.parseRedisInfo(await node.client.info('clients'), 'connected_clients')) || 0,
                memoryUsed,
                memoryTotal,
                responseTime,
                cacheHits,
                cacheMisses
            };
            
            node.status = 'healthy';
            node.lastHealthCheck = Date.now();
            
        } catch (error) {
            console.warn(`⚠️ Health check failed for node ${node.id}:`, error.message);
            node.status = 'unhealthy';
            node.lastHealthCheck = Date.now();
            
            this.emit('nodeUnhealthy', node.id, error);
        }
    }
    
    /**
     * Parse Redis info response for memory information
     */
    parseRedisMemoryInfo(info, key) {
        const match = info.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1]) : 0;
    }
    
    /**
     * Parse Redis info response for stats information
     */
    parseRedisStatsInfo(info, key) {
        const match = info.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1]) : 0;
    }
    
    /**
     * Parse general Redis info response
     */
    parseRedisInfo(info, key) {
        const match = info.match(new RegExp(`${key}:(\\d+)`));
        return match ? match[1] : '0';
    }
    
    /**
     * Evaluate if cluster scaling is needed for optimal performance
     */
    evaluateScalingNeeds() {
        const activeNodes = Array.from(this.clusterNodes.values())
            .filter(node => node.status === 'healthy');
        
        const avgMemoryUsage = activeNodes.reduce((sum, node) => {
            return sum + (node.metrics.memoryUsed / node.metrics.memoryTotal);
        }, 0) / activeNodes.length;
        
        const avgResponseTime = activeNodes.reduce((sum, node) => {
            return sum + node.metrics.responseTime;
        }, 0) / activeNodes.length;
        
        const failureRate = (this.metrics.totalNodes - this.metrics.activeNodes) / this.metrics.totalNodes;
        
        // Performance optimization: Scale up conditions
        if (avgMemoryUsage > this.configuration.memoryThreshold) {
            return { action: 'scale_up', reason: 'high_memory_usage', value: avgMemoryUsage };
        }
        
        if (avgResponseTime > this.configuration.responseTimeThreshold) {
            return { action: 'scale_up', reason: 'high_response_time', value: avgResponseTime };
        }
        
        if (failureRate > this.configuration.failoverThreshold) {
            return { action: 'scale_up', reason: 'high_failure_rate', value: failureRate };
        }
        
        // Performance optimization: Scale down conditions
        if (activeNodes.length > this.configuration.minNodes && 
            avgMemoryUsage < 0.5 && 
            avgResponseTime < 50) {
            return { action: 'scale_down', reason: 'low_utilization', value: avgMemoryUsage };
        }
        
        return { action: 'none' };
    }
    
    /**
     * Redistribute hash slots among cluster nodes
     */
    async redistributeSlots() {
        const activeNodes = Array.from(this.clusterNodes.values())
            .filter(node => node.status === 'healthy');
        
        if (activeNodes.length === 0) {
            throw new Error('No healthy nodes available for slot redistribution');
        }
        
        const slotsPerNode = Math.floor(16384 / activeNodes.length);
        let currentSlot = 0;
        
        for (let i = 0; i < activeNodes.length; i++) {
            const node = activeNodes[i];
            const startSlot = currentSlot;
            const endSlot = i === activeNodes.length - 1 ? 16383 : currentSlot + slotsPerNode - 1;
            
            node.slot = `${startSlot}-${endSlot}`;
            currentSlot = endSlot + 1;
        }
        
        console.log('✅ Redis cluster slots redistributed');
    }
    
    /**
     * Update cluster metrics
     */
    updateMetrics() {
        const nodes = Array.from(this.clusterNodes.values());
        
        this.metrics.totalNodes = nodes.length;
        this.metrics.activeNodes = nodes.filter(n => n.status === 'healthy').length;
        this.metrics.failedNodes = nodes.filter(n => n.status === 'unhealthy').length;
        
        const activeNodes = nodes.filter(n => n.status === 'healthy');
        
        if (activeNodes.length > 0) {
            this.metrics.totalConnections = activeNodes.reduce((sum, n) => sum + n.metrics.connections, 0);
            this.metrics.memoryUsage = activeNodes.reduce((sum, n) => 
                sum + (n.metrics.memoryUsed / n.metrics.memoryTotal), 0) / activeNodes.length;
            this.metrics.averageResponseTime = activeNodes.reduce((sum, n) => 
                sum + n.metrics.responseTime, 0) / activeNodes.length;
            
            const totalHits = activeNodes.reduce((sum, n) => sum + n.metrics.cacheHits, 0);
            const totalMisses = activeNodes.reduce((sum, n) => sum + n.metrics.cacheMisses, 0);
            this.metrics.cacheHitRate = totalHits / (totalHits + totalMisses) || 0;
        }
    }
    
    /**
     * Get cluster metrics
     */
    getClusterMetrics() {
        return {
            ...this.metrics,
            nodes: Array.from(this.clusterNodes.values()).map(node => ({
                id: node.id,
                host: node.host,
                port: node.port,
                status: node.status,
                slot: node.slot,
                metrics: node.metrics,
                lastHealthCheck: node.lastHealthCheck
            }))
        };
    }
    
    /**
     * Get cluster status
     */
    getClusterStatus() {
        return {
            isInitialized: this.isInitialized,
            totalNodes: this.metrics.totalNodes,
            activeNodes: this.metrics.activeNodes,
            failedNodes: this.metrics.failedNodes,
            healthStatus: this.metrics.activeNodes >= this.configuration.minNodes ? 'healthy' : 'degraded',
            configuration: this.configuration
        };
    }
    
    /**
     * Update cluster configuration
     */
    updateConfiguration(newConfig) {
        this.configuration = { ...this.configuration, ...newConfig };
        this.emit('configurationUpdated', this.configuration);
        
        // Restart health monitoring with new interval if changed
        if (newConfig.healthCheckInterval) {
            this.startHealthMonitoring();
        }
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🔴 Shutting down Redis Cluster Service...');
        
        if (this.healthMonitor) {
            clearInterval(this.healthMonitor);
        }
        
        // Close all client connections
        const shutdownPromises = Array.from(this.clusterNodes.values()).map(async (node) => {
            try {
                if (node.client && node.client.isReady) {
                    await node.client.disconnect();
                }
            } catch (error) {
                console.warn(`Warning: Error closing connection to ${node.id}:`, error.message);
            }
        });
        
        await Promise.allSettled(shutdownPromises);
        
        this.clusterNodes.clear();
        this.isInitialized = false;
        
        console.log('✅ Redis Cluster Service shutdown complete');
    }
}
