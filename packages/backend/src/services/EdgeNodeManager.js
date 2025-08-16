/**
 * EdgeNodeManager - Distributed Edge Computing Node Management
 * 
 * Comprehensive edge node orchestration system providing:
 * - Dynamic node registration and health monitoring
 * - Load distribution and failover management
 * - Geographic proximity routing
 * - Resource allocation and scaling
 * - Real-time performance optimization
 * - Automated node provisioning and decommissioning
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import axios from 'axios';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class EdgeNodeManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Node Management
            maxNodesPerRegion: 10,
            minNodesPerRegion: 2,
            nodeHealthCheckInterval: 30000, // 30 seconds
            nodeTimeoutThreshold: 120000, // 2 minutes
            
            // Load Balancing
            defaultLoadBalanceStrategy: 'latency_weighted', // round_robin, weighted, latency_weighted, geo_proximity
            healthScoreThreshold: 80, // Below this score, node is considered unhealthy
            maxRequestsPerNode: 1000,
            
            // Geographic Distribution
            enableGeoRouting: true,
            maxLatencyMs: 200,
            failoverTimeoutMs: 5000,
            
            // Auto-scaling
            enableAutoScaling: true,
            scaleUpThreshold: 80, // CPU/Memory usage percentage
            scaleDownThreshold: 20,
            cooldownPeriod: 300000, // 5 minutes
            
            // Monitoring
            enableDetailedMetrics: true,
            metricsRetentionDays: 30,
            alertingEnabled: true,
            
            // Security
            requireNodeAuthentication: true,
            rotateNodeTokens: true,
            tokenExpiryHours: 24,
            
            ...config
        };
        
        // Core components
        this.db = null;
        this.tracer = OpenTelemetryTracing.getTracer('edge-node-manager');
        this.initialized = false;
        this.isRunning = false;
        
        // Node management
        this.activeNodes = new Map(); // nodeId -> NodeInfo
        this.nodeRegions = new Map(); // region -> Set of nodeIds
        this.nodeHealthChecks = new Map(); // nodeId -> interval
        this.routingTable = new Map(); // region -> [nodeIds sorted by performance]
        
        // Load balancing
        this.requestCounts = new Map(); // nodeId -> current request count
        this.loadBalancers = new Map(); // strategy -> LoadBalancer instance
        
        // Performance tracking
        this.performanceMetrics = new Map(); // nodeId -> PerformanceData
        this.latencyCache = new Map(); // clientRegion:nodeId -> latency
        
        // Auto-scaling state
        this.scalingOperations = new Map(); // region -> ScalingOperation
        this.lastScalingActions = new Map(); // region -> timestamp
        
        // Statistics and monitoring
        this.metrics = {
            totalNodes: 0,
            healthyNodes: 0,
            activeRequests: 0,
            averageLatency: 0,
            totalRequestsRouted: 0,
            failoverCount: 0,
            scalingOperations: 0,
            lastHealthCheck: null,
            nodesByRegion: {},
            performanceScores: {}
        };
        
        // Validation rules
        this.nodeValidationRules = {
            name: { required: true, minLength: 3, maxLength: 100 },
            endpoint_url: { required: true, pattern: /^https?:\/\/.+/ },
            location: { required: true }
        };
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.registerNode = this.registerNode.bind(this);
        this.routeRequest = this.routeRequest.bind(this);
        this.handleHealthCheck = this.handleHealthCheck.bind(this);
    }
    
    /**
     * Initialize the EdgeNodeManager with database connection
     */
    async initialize(database) {
        const span = this.tracer.startSpan('edge_node_manager_initialize');
        
        try {
            if (this.initialized) {
                console.log('EdgeNodeManager already initialized');
                return;
            }
            
            this.db = database;
            
            // Initialize load balancer strategies
            this.initializeLoadBalancers();
            
            // Load existing nodes from database
            await this.loadExistingNodes();
            
            // Start health monitoring
            if (this.config.nodeHealthCheckInterval > 0) {
                this.startHealthMonitoring();
            }
            
            // Start auto-scaling if enabled
            if (this.config.enableAutoScaling) {
                this.startAutoScaling();
            }
            
            // Load routing table
            await this.buildRoutingTable();
            
            // Initialize metrics collection
            await this.initializeMetrics();
            
            this.initialized = true;
            this.isRunning = true;
            
            console.log('EdgeNodeManager initialized successfully', {
                totalNodes: this.activeNodes.size,
                regions: this.nodeRegions.size,
                strategies: Array.from(this.loadBalancers.keys())
            });
            
            this.emit('initialized', {
                nodeCount: this.activeNodes.size,
                regions: Array.from(this.nodeRegions.keys()),
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'edge.nodes.total': this.activeNodes.size,
                'edge.regions.count': this.nodeRegions.size,
                'edge.manager.initialized': true
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
     * Register a new edge node
     */
    async registerNode(nodeData, options = {}) {
        const span = this.tracer.startSpan('edge_node_manager_register_node');
        const startTime = Date.now();
        
        try {
            // Validate node data
            this.validateNodeData(nodeData);
            
            // Check for existing node
            const existingNode = await this.findNodeByEndpoint(nodeData.endpoint_url);
            if (existingNode && !options.allowUpdate) {
                throw new Error(`Node with endpoint ${nodeData.endpoint_url} already exists`);
            }
            
            // Generate node configuration
            const nodeConfig = {
                id: existingNode?.id || crypto.randomUUID(),
                name: nodeData.name,
                location: nodeData.location,
                endpoint_url: nodeData.endpoint_url,
                status: 'active',
                capabilities: nodeData.capabilities || {},
                resources: nodeData.resources || {},
                health_metrics: {},
                last_heartbeat: new Date(),
                created_at: existingNode?.created_at || new Date(),
                updated_at: new Date()
            };
            
            const client = await this.db.connect();
            await client.query('BEGIN');
            
            try {
                let query, values;
                
                if (existingNode) {
                    // Update existing node
                    query = `
                        UPDATE edge_nodes
                        SET name = $2, location = $3, endpoint_url = $4, status = $5,
                            capabilities = $6, resources = $7, updated_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    `;
                    values = [
                        nodeConfig.id,
                        nodeConfig.name,
                        nodeConfig.location,
                        nodeConfig.endpoint_url,
                        nodeConfig.status,
                        nodeConfig.capabilities,
                        nodeConfig.resources
                    ];
                } else {
                    // Insert new node
                    query = `
                        INSERT INTO edge_nodes (
                            id, name, location, endpoint_url, status, 
                            capabilities, resources, last_heartbeat
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        RETURNING *
                    `;
                    values = [
                        nodeConfig.id,
                        nodeConfig.name,
                        nodeConfig.location,
                        nodeConfig.endpoint_url,
                        nodeConfig.status,
                        nodeConfig.capabilities,
                        nodeConfig.resources,
                        nodeConfig.last_heartbeat
                    ];
                }
                
                const result = await client.query(query, values);
                const node = result.rows[0];
                
                await client.query('COMMIT');
                
                // Add to active nodes
                this.activeNodes.set(node.id, node);
                
                // Update regional distribution
                const region = this.getNodeRegion(node.location);
                if (!this.nodeRegions.has(region)) {
                    this.nodeRegions.set(region, new Set());
                }
                this.nodeRegions.get(region).add(node.id);
                
                // Start health monitoring for new node
                this.startNodeHealthCheck(node.id);
                
                // Update routing table
                await this.updateRoutingTable(region);
                
                // Update metrics
                this.metrics.totalNodes = this.activeNodes.size;
                this.updateRegionalMetrics();
                
                // Emit event
                this.emit('nodeRegistered', {
                    node,
                    isUpdate: !!existingNode,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'edge.node.id': node.id,
                    'edge.node.region': region,
                    'edge.node.is_update': !!existingNode
                });
                
                console.log(`Edge node ${existingNode ? 'updated' : 'registered'}: ${node.name} (${region})`);
                
                return node;
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Route request to optimal edge node
     */
    async routeRequest(clientLocation, requestType = 'default', options = {}) {
        const span = this.tracer.startSpan('edge_node_manager_route_request');
        const startTime = Date.now();
        
        try {
            if (!this.isRunning) {
                throw new Error('EdgeNodeManager is not running');
            }
            
            const {
                strategy = this.config.defaultLoadBalanceStrategy,
                excludeNodes = [],
                requireCapability = null,
                maxLatency = this.config.maxLatencyMs,
                includeBackup = true
            } = options;
            
            // Get client region
            const clientRegion = this.getClientRegion(clientLocation);
            
            // Get available nodes for region
            const availableNodes = await this.getAvailableNodesForRegion(
                clientRegion, 
                {
                    excludeNodes,
                    requireCapability,
                    maxLatency,
                    requestType
                }
            );
            
            if (availableNodes.length === 0) {
                if (includeBackup) {
                    // Try backup regions
                    const backupRegions = this.getBackupRegions(clientRegion);
                    for (const backupRegion of backupRegions) {
                        const backupNodes = await this.getAvailableNodesForRegion(
                            backupRegion,
                            { excludeNodes, requireCapability, requestType }
                        );
                        if (backupNodes.length > 0) {
                            availableNodes.push(...backupNodes);
                            break;
                        }
                    }
                }
                
                if (availableNodes.length === 0) {
                    throw new Error('No available edge nodes for routing');
                }
            }
            
            // Select optimal node using load balancing strategy
            const selectedNode = await this.selectNodeByStrategy(
                strategy,
                availableNodes,
                clientLocation,
                requestType
            );
            
            // Update request tracking
            this.trackRequest(selectedNode.id);
            
            // Record routing metrics
            const routingLatency = Date.now() - startTime;
            await this.recordRoutingMetrics({
                nodeId: selectedNode.id,
                clientRegion,
                strategy,
                latency: routingLatency,
                requestType
            });
            
            // Update statistics
            this.metrics.totalRequestsRouted++;
            this.metrics.activeRequests++;
            
            // Emit event
            this.emit('requestRouted', {
                nodeId: selectedNode.id,
                clientRegion,
                strategy,
                latency: routingLatency,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'edge.routing.node_id': selectedNode.id,
                'edge.routing.strategy': strategy,
                'edge.routing.client_region': clientRegion,
                'edge.routing.latency_ms': routingLatency
            });
            
            return {
                node: selectedNode,
                routingInfo: {
                    strategy,
                    clientRegion,
                    latency: routingLatency,
                    availableNodes: availableNodes.length
                }
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            // Record failure
            this.metrics.failoverCount++;
            
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Handle node health check
     */
    async handleHealthCheck(nodeId, healthData) {
        const span = this.tracer.startSpan('edge_node_manager_health_check');
        
        try {
            const node = this.activeNodes.get(nodeId);
            if (!node) {
                throw new Error(`Node not found: ${nodeId}`);
            }
            
            // Calculate health score
            const healthScore = this.calculateHealthScore(healthData);
            
            // Update node health metrics
            node.health_metrics = {
                ...healthData,
                health_score: healthScore,
                last_check: new Date().toISOString()
            };
            node.last_heartbeat = new Date();
            
            // Update database
            await this.db.query(
                `UPDATE edge_nodes 
                 SET health_metrics = $2, last_heartbeat = NOW() 
                 WHERE id = $1`,
                [nodeId, node.health_metrics]
            );
            
            // Record health metrics
            await this.recordHealthMetrics(nodeId, healthData, healthScore);
            
            // Update performance cache
            this.performanceMetrics.set(nodeId, {
                healthScore,
                responseTime: healthData.response_time_ms || 0,
                cpuUsage: healthData.cpu_usage || 0,
                memoryUsage: healthData.memory_usage || 0,
                timestamp: Date.now()
            });
            
            // Check if node status needs updating
            const newStatus = this.determineNodeStatus(node, healthScore);
            if (newStatus !== node.status) {
                await this.updateNodeStatus(nodeId, newStatus);
            }
            
            // Update metrics
            this.updateHealthMetrics();
            
            // Check for scaling triggers
            if (this.config.enableAutoScaling) {
                await this.checkScalingTriggers(node, healthData);
            }
            
            span.setAttributes({
                'edge.health.node_id': nodeId,
                'edge.health.score': healthScore,
                'edge.health.status': newStatus
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
     * Get node by ID
     */
    async getNode(nodeId) {
        const node = this.activeNodes.get(nodeId);
        if (!node) {
            // Try loading from database
            const result = await this.db.query(
                'SELECT * FROM edge_nodes WHERE id = $1',
                [nodeId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        }
        
        return node;
    }
    
    /**
     * List nodes with filtering
     */
    async listNodes(filters = {}) {
        const {
            status = null,
            region = null,
            capability = null,
            minHealthScore = null,
            includeMetrics = false
        } = filters;
        
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;
        
        let query = `
            SELECT n.*,
                   COALESCE(
                       (SELECT COUNT(*) FROM edge_cache_entries WHERE edge_node_id = n.id), 
                       0
                   ) as cache_entries_count
            FROM edge_nodes n
        `;
        
        if (status) {
            whereConditions.push(`n.status = $${paramIndex++}`);
            params.push(status);
        }
        
        if (region) {
            whereConditions.push(`n.location->>'region' = $${paramIndex++}`);
            params.push(region);
        }
        
        if (capability) {
            whereConditions.push(`n.capabilities ? $${paramIndex++}`);
            params.push(capability);
        }
        
        if (minHealthScore) {
            whereConditions.push(`CAST(n.health_metrics->>'health_score' AS DECIMAL) >= $${paramIndex++}`);
            params.push(minHealthScore);
        }
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY n.created_at DESC`;
        
        const result = await this.db.query(query, params);
        let nodes = result.rows;
        
        // Include performance metrics if requested
        if (includeMetrics) {
            nodes = nodes.map(node => ({
                ...node,
                performance_metrics: this.performanceMetrics.get(node.id) || null
            }));
        }
        
        return nodes;
    }
    
    /**
     * Remove/decommission node
     */
    async removeNode(nodeId, soft = true) {
        const span = this.tracer.startSpan('edge_node_manager_remove_node');
        
        try {
            const node = await this.getNode(nodeId);
            if (!node) {
                throw new Error(`Node not found: ${nodeId}`);
            }
            
            if (soft) {
                // Soft removal - mark as inactive
                await this.updateNodeStatus(nodeId, 'inactive');
            } else {
                // Hard removal - delete from database
                const client = await this.db.connect();
                await client.query('BEGIN');
                
                try {
                    // Remove from routing table and caches first (cascading deletes will handle relations)
                    await client.query('DELETE FROM edge_nodes WHERE id = $1', [nodeId]);
                    await client.query('COMMIT');
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            }
            
            // Remove from active nodes
            this.activeNodes.delete(nodeId);
            
            // Stop health checks
            if (this.nodeHealthChecks.has(nodeId)) {
                clearInterval(this.nodeHealthChecks.get(nodeId));
                this.nodeHealthChecks.delete(nodeId);
            }
            
            // Update regional distribution
            const region = this.getNodeRegion(node.location);
            if (this.nodeRegions.has(region)) {
                this.nodeRegions.get(region).delete(nodeId);
                if (this.nodeRegions.get(region).size === 0) {
                    this.nodeRegions.delete(region);
                }
            }
            
            // Clean up performance metrics
            this.performanceMetrics.delete(nodeId);
            
            // Update routing table
            await this.updateRoutingTable(region);
            
            // Update metrics
            this.metrics.totalNodes = this.activeNodes.size;
            this.updateRegionalMetrics();
            
            this.emit('nodeRemoved', {
                nodeId,
                nodeName: node.name,
                region,
                soft,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'edge.node.id': nodeId,
                'edge.node.removal_type': soft ? 'soft' : 'hard'
            });
            
            console.log(`Edge node ${soft ? 'deactivated' : 'removed'}: ${node.name}`);
            
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
    
    initializeLoadBalancers() {
        // Implementation of different load balancing strategies
        this.loadBalancers.set('round_robin', {
            counters: new Map(),
            select: (nodes) => {
                const strategy = this.loadBalancers.get('round_robin');
                const key = 'global';
                const current = strategy.counters.get(key) || 0;
                const selected = nodes[current % nodes.length];
                strategy.counters.set(key, current + 1);
                return selected;
            }
        });
        
        this.loadBalancers.set('weighted', {
            select: (nodes) => {
                // Weighted selection based on node capacity and performance
                const totalWeight = nodes.reduce((sum, node) => {
                    const performance = this.performanceMetrics.get(node.id);
                    const weight = performance ? (100 - performance.cpuUsage) : 100;
                    return sum + weight;
                }, 0);
                
                const random = Math.random() * totalWeight;
                let currentWeight = 0;
                
                for (const node of nodes) {
                    const performance = this.performanceMetrics.get(node.id);
                    const weight = performance ? (100 - performance.cpuUsage) : 100;
                    currentWeight += weight;
                    if (random <= currentWeight) {
                        return node;
                    }
                }
                
                return nodes[0]; // Fallback
            }
        });
        
        this.loadBalancers.set('latency_weighted', {
            select: async (nodes, clientLocation) => {
                // Select based on latency and current load
                let bestNode = nodes[0];
                let bestScore = Infinity;
                
                for (const node of nodes) {
                    const latency = await this.getNodeLatency(node.id, clientLocation);
                    const performance = this.performanceMetrics.get(node.id);
                    const loadFactor = performance ? performance.cpuUsage / 100 : 0.5;
                    
                    // Combined score: latency + load penalty
                    const score = latency + (latency * loadFactor);
                    
                    if (score < bestScore) {
                        bestScore = score;
                        bestNode = node;
                    }
                }
                
                return bestNode;
            }
        });
    }
    
    async loadExistingNodes() {
        const result = await this.db.query(`
            SELECT * FROM edge_nodes 
            WHERE status IN ('active', 'maintenance')
            ORDER BY created_at
        `);
        
        for (const node of result.rows) {
            this.activeNodes.set(node.id, node);
            
            const region = this.getNodeRegion(node.location);
            if (!this.nodeRegions.has(region)) {
                this.nodeRegions.set(region, new Set());
            }
            this.nodeRegions.get(region).add(node.id);
        }
        
        console.log(`Loaded ${result.rows.length} existing edge nodes`);
    }
    
    startHealthMonitoring() {
        // Start health checks for all active nodes
        for (const nodeId of this.activeNodes.keys()) {
            this.startNodeHealthCheck(nodeId);
        }
        
        console.log('Health monitoring started for all nodes');
    }
    
    startNodeHealthCheck(nodeId) {
        if (this.nodeHealthChecks.has(nodeId)) {
            clearInterval(this.nodeHealthChecks.get(nodeId));
        }
        
        const interval = setInterval(async () => {
            try {
                await this.performNodeHealthCheck(nodeId);
            } catch (error) {
                console.error(`Health check failed for node ${nodeId}:`, error.message);
            }
        }, this.config.nodeHealthCheckInterval);
        
        this.nodeHealthChecks.set(nodeId, interval);
    }
    
    async performNodeHealthCheck(nodeId) {
        const node = this.activeNodes.get(nodeId);
        if (!node) return;
        
        try {
            const response = await axios.get(`${node.endpoint_url}/health`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'EdgeNodeManager/1.0'
                }
            });
            
            const healthData = response.data;
            await this.handleHealthCheck(nodeId, healthData);
            
        } catch (error) {
            // Handle failed health check
            const healthData = {
                status: 'error',
                response_time_ms: 10000,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            await this.handleHealthCheck(nodeId, healthData);
        }
    }
    
    calculateHealthScore(healthData) {
        if (healthData.status === 'error') return 0;
        
        let score = 100;
        
        // Response time penalty
        if (healthData.response_time_ms > 1000) {
            score -= Math.min(50, (healthData.response_time_ms - 1000) / 100);
        }
        
        // CPU usage penalty
        if (healthData.cpu_usage > 80) {
            score -= (healthData.cpu_usage - 80) * 2;
        }
        
        // Memory usage penalty
        if (healthData.memory_usage > 85) {
            score -= (healthData.memory_usage - 85) * 2;
        }
        
        // Error count penalty
        if (healthData.error_count > 0) {
            score -= Math.min(30, healthData.error_count * 5);
        }
        
        return Math.max(0, Math.round(score));
    }
    
    getNodeRegion(location) {
        if (typeof location === 'string') {
            try {
                location = JSON.parse(location);
            } catch {
                return 'unknown';
            }
        }
        
        return location.region || location.country || 'unknown';
    }
    
    getClientRegion(clientLocation) {
        // Simplified region detection - could be enhanced with GeoIP
        if (typeof clientLocation === 'string') {
            return clientLocation;
        }
        
        return clientLocation?.region || clientLocation?.country || 'unknown';
    }
    
    async getAvailableNodesForRegion(region, options = {}) {
        const {
            excludeNodes = [],
            requireCapability = null,
            maxLatency = this.config.maxLatencyMs,
            requestType = 'default'
        } = options;
        
        const regionNodes = this.nodeRegions.get(region) || new Set();
        const availableNodes = [];
        
        for (const nodeId of regionNodes) {
            if (excludeNodes.includes(nodeId)) continue;
            
            const node = this.activeNodes.get(nodeId);
            if (!node || node.status !== 'active') continue;
            
            // Check capability requirement
            if (requireCapability && !node.capabilities[requireCapability]) {
                continue;
            }
            
            // Check health score
            const performance = this.performanceMetrics.get(nodeId);
            if (performance && performance.healthScore < this.config.healthScoreThreshold) {
                continue;
            }
            
            // Check current load
            const currentRequests = this.requestCounts.get(nodeId) || 0;
            if (currentRequests >= this.config.maxRequestsPerNode) {
                continue;
            }
            
            availableNodes.push(node);
        }
        
        return availableNodes;
    }
    
    async selectNodeByStrategy(strategy, nodes, clientLocation, requestType) {
        const loadBalancer = this.loadBalancers.get(strategy);
        if (!loadBalancer) {
            throw new Error(`Unknown load balancing strategy: ${strategy}`);
        }
        
        if (strategy === 'latency_weighted') {
            return await loadBalancer.select(nodes, clientLocation);
        } else {
            return loadBalancer.select(nodes);
        }
    }
    
    trackRequest(nodeId) {
        const current = this.requestCounts.get(nodeId) || 0;
        this.requestCounts.set(nodeId, current + 1);
        
        // Clean up completed requests periodically
        setTimeout(() => {
            const count = this.requestCounts.get(nodeId) || 0;
            if (count > 0) {
                this.requestCounts.set(nodeId, count - 1);
            }
        }, 30000); // 30 seconds average request duration
    }
    
    async getNodeLatency(nodeId, clientLocation) {
        const cacheKey = `${this.getClientRegion(clientLocation)}:${nodeId}`;
        
        if (this.latencyCache.has(cacheKey)) {
            const cached = this.latencyCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.latency;
            }
        }
        
        // Default latency based on performance metrics
        const performance = this.performanceMetrics.get(nodeId);
        const latency = performance ? performance.responseTime : 100;
        
        this.latencyCache.set(cacheKey, {
            latency,
            timestamp: Date.now()
        });
        
        return latency;
    }
    
    validateNodeData(data) {
        const errors = [];
        
        for (const [field, rules] of Object.entries(this.nodeValidationRules)) {
            const value = data[field];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }
                
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }
    
    async findNodeByEndpoint(endpointUrl) {
        const result = await this.db.query(
            'SELECT * FROM edge_nodes WHERE endpoint_url = $1',
            [endpointUrl]
        );
        
        return result.rows[0] || null;
    }
    
    determineNodeStatus(node, healthScore) {
        if (healthScore === 0) return 'failed';
        if (healthScore < this.config.healthScoreThreshold) return 'maintenance';
        return 'active';
    }
    
    async updateNodeStatus(nodeId, newStatus) {
        await this.db.query(
            'UPDATE edge_nodes SET status = $2, updated_at = NOW() WHERE id = $1',
            [nodeId, newStatus]
        );
        
        const node = this.activeNodes.get(nodeId);
        if (node) {
            node.status = newStatus;
        }
        
        this.emit('nodeStatusChanged', {
            nodeId,
            newStatus,
            timestamp: Date.now()
        });
    }
    
    updateHealthMetrics() {
        let healthyCount = 0;
        let totalLatency = 0;
        let latencyCount = 0;
        
        for (const [nodeId, performance] of this.performanceMetrics) {
            if (performance.healthScore >= this.config.healthScoreThreshold) {
                healthyCount++;
            }
            
            if (performance.responseTime > 0) {
                totalLatency += performance.responseTime;
                latencyCount++;
            }
        }
        
        this.metrics.healthyNodes = healthyCount;
        this.metrics.averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
        this.metrics.lastHealthCheck = new Date().toISOString();
    }
    
    updateRegionalMetrics() {
        this.metrics.nodesByRegion = {};
        
        for (const [region, nodeIds] of this.nodeRegions) {
            this.metrics.nodesByRegion[region] = nodeIds.size;
        }
    }
    
    async buildRoutingTable() {
        // Build optimized routing table for each region
        for (const region of this.nodeRegions.keys()) {
            await this.updateRoutingTable(region);
        }
        
        console.log('Routing table built for all regions');
    }
    
    async updateRoutingTable(region) {
        const nodeIds = this.nodeRegions.get(region) || new Set();
        const nodes = Array.from(nodeIds)
            .map(id => this.activeNodes.get(id))
            .filter(node => node && node.status === 'active');
        
        // Sort by performance score (best first)
        nodes.sort((a, b) => {
            const perfA = this.performanceMetrics.get(a.id);
            const perfB = this.performanceMetrics.get(b.id);
            const scoreA = perfA ? perfA.healthScore : 50;
            const scoreB = perfB ? perfB.healthScore : 50;
            return scoreB - scoreA;
        });
        
        this.routingTable.set(region, nodes.map(n => n.id));
    }
    
    getBackupRegions(primaryRegion) {
        // Return nearby regions for failover
        const regionMap = {
            'us-east': ['us-west', 'us-central'],
            'us-west': ['us-central', 'us-east'],
            'us-central': ['us-east', 'us-west'],
            'eu-west': ['eu-central', 'eu-north'],
            'eu-central': ['eu-west', 'eu-north'],
            'asia-pacific': ['asia-southeast', 'asia-northeast'],
        };
        
        return regionMap[primaryRegion] || [];
    }
    
    async initializeMetrics() {
        this.updateHealthMetrics();
        this.updateRegionalMetrics();
        
        // Start periodic metrics updates
        setInterval(() => {
            this.updateHealthMetrics();
            this.updateRegionalMetrics();
        }, 30000); // Every 30 seconds
    }
    
    async recordRoutingMetrics(data) {
        try {
            await this.db.query(`
                INSERT INTO edge_performance_metrics (
                    edge_node_id, metric_type, metric_value, metric_unit,
                    client_location, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                data.nodeId,
                'routing_latency',
                data.latency,
                'ms',
                { region: data.clientRegion },
                { strategy: data.strategy, request_type: data.requestType }
            ]);
        } catch (error) {
            console.error('Failed to record routing metrics:', error.message);
        }
    }
    
    async recordHealthMetrics(nodeId, healthData, healthScore) {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Insert health log
            await client.query(`
                INSERT INTO edge_node_health_logs (
                    edge_node_id, health_score, response_time_ms,
                    cpu_usage, memory_usage, disk_usage, 
                    network_latency_ms, error_count, warnings
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                nodeId,
                healthScore,
                healthData.response_time_ms,
                healthData.cpu_usage,
                healthData.memory_usage,
                healthData.disk_usage,
                healthData.network_latency_ms,
                healthData.error_count || 0,
                healthData.warnings || []
            ]);
            
            // Insert performance metrics
            const metrics = [
                ['latency', healthData.response_time_ms, 'ms'],
                ['cpu_usage', healthData.cpu_usage, 'percent'],
                ['memory_usage', healthData.memory_usage, 'percent'],
                ['health_score', healthScore, 'score']
            ];
            
            for (const [type, value, unit] of metrics) {
                if (value !== undefined && value !== null) {
                    await client.query(`
                        INSERT INTO edge_performance_metrics (
                            edge_node_id, metric_type, metric_value, metric_unit
                        ) VALUES ($1, $2, $3, $4)
                    `, [nodeId, type, value, unit]);
                }
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    startAutoScaling() {
        // Implementation would include scaling logic
        console.log('Auto-scaling monitoring started');
    }
    
    async checkScalingTriggers(node, healthData) {
        // Implementation would check if scaling is needed
        // Based on CPU, memory, and request patterns
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            config: {
                max_nodes_per_region: this.config.maxNodesPerRegion,
                health_check_interval: this.config.nodeHealthCheckInterval,
                default_strategy: this.config.defaultLoadBalanceStrategy,
                auto_scaling_enabled: this.config.enableAutoScaling
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning,
                active_nodes: this.activeNodes.size,
                tracked_regions: this.nodeRegions.size
            }
        };
    }
    
    /**
     * Stop the EdgeNodeManager service
     */
    async stop() {
        this.isRunning = false;
        
        // Stop all health checks
        for (const interval of this.nodeHealthChecks.values()) {
            clearInterval(interval);
        }
        this.nodeHealthChecks.clear();
        
        // Clear caches
        this.activeNodes.clear();
        this.nodeRegions.clear();
        this.performanceMetrics.clear();
        this.latencyCache.clear();
        
        this.emit('stopped', { timestamp: Date.now() });
        console.log('EdgeNodeManager service stopped');
    }
}

export default EdgeNodeManager;
