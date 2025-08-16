/**
 * Comprehensive Workflow Designer Service
 * Handles visual workflow creation, validation, and node management
 * Part of Task 25: Enterprise Workflow Automation System - Component 1
 */

import { v4 as uuidv4 } from 'uuid';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import DatabaseService from './DatabaseService.js';

export class WorkflowDesignerService {
    constructor() {
        this.nodeTypes = this.initializeNodeTypes();
        this.connectionRules = this.initializeConnectionRules();
        this.validationRules = this.initializeValidationRules();
    }

    /**
     * Initialize available node types for workflow designer
     */
    initializeNodeTypes() {
        return {
            // Control Flow Nodes
            START: {
                id: 'start',
                name: 'Start',
                category: 'control',
                icon: 'play-circle',
                color: '#28a745',
                inputs: 0,
                outputs: 1,
                config: {},
                description: 'Starting point of workflow execution'
            },
            END: {
                id: 'end',
                name: 'End',
                category: 'control',
                icon: 'stop-circle',
                color: '#dc3545',
                inputs: 1,
                outputs: 0,
                config: {},
                description: 'Terminal point of workflow execution'
            },
            DECISION: {
                id: 'decision',
                name: 'Decision',
                category: 'control',
                icon: 'git-branch',
                color: '#ffc107',
                inputs: 1,
                outputs: 2,
                config: {
                    condition: { type: 'expression', required: true },
                    trueLabel: { type: 'string', default: 'True' },
                    falseLabel: { type: 'string', default: 'False' }
                },
                description: 'Conditional branching based on expression evaluation'
            },
            PARALLEL: {
                id: 'parallel',
                name: 'Parallel',
                category: 'control',
                icon: 'share-alt',
                color: '#17a2b8',
                inputs: 1,
                outputs: -1, // Variable outputs
                config: {
                    branches: { type: 'number', min: 2, max: 10, default: 2 },
                    waitForAll: { type: 'boolean', default: true }
                },
                description: 'Execute multiple branches in parallel'
            },
            MERGE: {
                id: 'merge',
                name: 'Merge',
                category: 'control',
                icon: 'code-merge',
                color: '#6f42c1',
                inputs: -1, // Variable inputs
                outputs: 1,
                config: {
                    strategy: { type: 'select', options: ['waitAll', 'waitAny', 'first'], default: 'waitAll' }
                },
                description: 'Merge multiple parallel execution paths'
            },

            // Data Processing Nodes
            TRANSFORM: {
                id: 'transform',
                name: 'Transform Data',
                category: 'data',
                icon: 'exchange-alt',
                color: '#fd7e14',
                inputs: 1,
                outputs: 1,
                config: {
                    transformation: { type: 'code', language: 'javascript', required: true },
                    timeout: { type: 'number', default: 30000, min: 1000, max: 300000 }
                },
                description: 'Transform data using custom JavaScript code'
            },
            FILTER: {
                id: 'filter',
                name: 'Filter Data',
                category: 'data',
                icon: 'filter',
                color: '#20c997',
                inputs: 1,
                outputs: 2,
                config: {
                    condition: { type: 'expression', required: true },
                    passLabel: { type: 'string', default: 'Pass' },
                    failLabel: { type: 'string', default: 'Fail' }
                },
                description: 'Filter data based on specified conditions'
            },
            AGGREGATE: {
                id: 'aggregate',
                name: 'Aggregate',
                category: 'data',
                icon: 'layer-group',
                color: '#6610f2',
                inputs: 1,
                outputs: 1,
                config: {
                    operation: { type: 'select', options: ['sum', 'avg', 'count', 'min', 'max', 'group'], required: true },
                    field: { type: 'string', required: true },
                    groupBy: { type: 'array' }
                },
                description: 'Aggregate data using mathematical operations'
            },

            // Action Nodes
            HTTP_REQUEST: {
                id: 'http_request',
                name: 'HTTP Request',
                category: 'action',
                icon: 'globe',
                color: '#007bff',
                inputs: 1,
                outputs: 2,
                config: {
                    method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
                    url: { type: 'string', required: true },
                    headers: { type: 'object' },
                    body: { type: 'object' },
                    timeout: { type: 'number', default: 30000 },
                    retryCount: { type: 'number', default: 3, min: 0, max: 10 }
                },
                description: 'Make HTTP requests to external APIs'
            },
            DATABASE_QUERY: {
                id: 'database_query',
                name: 'Database Query',
                category: 'action',
                icon: 'database',
                color: '#28a745',
                inputs: 1,
                outputs: 2,
                config: {
                    query: { type: 'sql', required: true },
                    parameters: { type: 'object' },
                    timeout: { type: 'number', default: 30000 }
                },
                description: 'Execute database queries'
            },
            SEND_EMAIL: {
                id: 'send_email',
                name: 'Send Email',
                category: 'action',
                icon: 'envelope',
                color: '#dc3545',
                inputs: 1,
                outputs: 2,
                config: {
                    to: { type: 'array', required: true },
                    subject: { type: 'string', required: true },
                    body: { type: 'text', required: true },
                    cc: { type: 'array' },
                    bcc: { type: 'array' },
                    attachments: { type: 'array' }
                },
                description: 'Send email notifications'
            },
            WEBHOOK: {
                id: 'webhook',
                name: 'Webhook',
                category: 'action',
                icon: 'broadcast-tower',
                color: '#17a2b8',
                inputs: 1,
                outputs: 2,
                config: {
                    url: { type: 'string', required: true },
                    method: { type: 'select', options: ['POST', 'PUT'], default: 'POST' },
                    payload: { type: 'object' },
                    headers: { type: 'object' },
                    timeout: { type: 'number', default: 30000 }
                },
                description: 'Send webhook notifications'
            },

            // AI/ML Nodes
            AI_AGENT_CALL: {
                id: 'ai_agent_call',
                name: 'AI Agent',
                category: 'ai',
                icon: 'robot',
                color: '#e83e8c',
                inputs: 1,
                outputs: 2,
                config: {
                    agent: { type: 'select', options: [], required: true }, // Populated dynamically
                    prompt: { type: 'text', required: true },
                    parameters: { type: 'object' },
                    timeout: { type: 'number', default: 60000 }
                },
                description: 'Call AI agents for processing'
            },
            ANALYZE_SENTIMENT: {
                id: 'analyze_sentiment',
                name: 'Sentiment Analysis',
                category: 'ai',
                icon: 'heart',
                color: '#fd7e14',
                inputs: 1,
                outputs: 1,
                config: {
                    textField: { type: 'string', required: true },
                    language: { type: 'select', options: ['auto', 'en', 'es', 'fr', 'de'], default: 'auto' }
                },
                description: 'Analyze sentiment of text data'
            },

            // Utility Nodes
            DELAY: {
                id: 'delay',
                name: 'Delay',
                category: 'utility',
                icon: 'clock',
                color: '#6c757d',
                inputs: 1,
                outputs: 1,
                config: {
                    duration: { type: 'number', required: true, min: 1000, max: 86400000 },
                    unit: { type: 'select', options: ['milliseconds', 'seconds', 'minutes', 'hours'], default: 'seconds' }
                },
                description: 'Add delay to workflow execution'
            },
            LOG: {
                id: 'log',
                name: 'Log',
                category: 'utility',
                icon: 'file-text',
                color: '#495057',
                inputs: 1,
                outputs: 1,
                config: {
                    level: { type: 'select', options: ['debug', 'info', 'warn', 'error'], default: 'info' },
                    message: { type: 'string', required: true },
                    data: { type: 'object' }
                },
                description: 'Log messages and data during execution'
            },
            VARIABLE: {
                id: 'variable',
                name: 'Set Variable',
                category: 'utility',
                icon: 'tag',
                color: '#20c997',
                inputs: 1,
                outputs: 1,
                config: {
                    name: { type: 'string', required: true },
                    value: { type: 'expression', required: true },
                    scope: { type: 'select', options: ['local', 'global'], default: 'local' }
                },
                description: 'Set variables for use in workflow'
            }
        };
    }

    /**
     * Initialize connection rules between node types
     */
    initializeConnectionRules() {
        return {
            // Nodes that can only have one input
            singleInput: ['start', 'end', 'decision', 'parallel'],
            // Nodes that can only have one output
            singleOutput: ['end', 'merge'],
            // Invalid connections
            invalid: [
                { from: 'end', to: '*' }, // End nodes cannot output
                { from: '*', to: 'start' } // Start nodes cannot have input
            ],
            // Required connections
            required: [
                { type: 'start', min: 1, max: 1 }, // Must have exactly one start node
                { type: 'end', min: 1, max: -1 } // Must have at least one end node
            ]
        };
    }

    /**
     * Initialize workflow validation rules
     */
    initializeValidationRules() {
        return {
            // Node validation
            nodes: {
                minNodes: 2, // At least start and end
                maxNodes: 1000,
                requiredTypes: ['start', 'end']
            },
            // Connection validation
            connections: {
                noOrphans: true, // All nodes must be connected
                noCircular: true, // No circular references
                validateOutputs: true // All outputs must be connected
            },
            // Configuration validation
            config: {
                validateExpressions: true,
                validateSQLQueries: true,
                validateHTTPUrls: true
            }
        };
    }

    /**
     * Create new workflow with visual designer
     */
    async createWorkflow(userId, workflowData) {
        return traceOperation('workflow.designer.create', async () => {
            const workflowId = uuidv4();
            const timestamp = new Date();

            // Validate workflow structure
            const validation = await this.validateWorkflow(workflowData);
            if (!validation.valid) {
                throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
            }

            // Create workflow definition
            const workflow = {
                id: workflowId,
                userId,
                name: workflowData.name || 'Untitled Workflow',
                description: workflowData.description || '',
                version: '1.0.0',
                status: 'draft',
                nodes: workflowData.nodes || [],
                connections: workflowData.connections || [],
                variables: workflowData.variables || {},
                settings: {
                    timeout: workflowData.settings?.timeout || 300000,
                    retryPolicy: workflowData.settings?.retryPolicy || 'exponential',
                    maxRetries: workflowData.settings?.maxRetries || 3,
                    errorHandling: workflowData.settings?.errorHandling || 'stop',
                    parallelism: workflowData.settings?.parallelism || 10
                },
                metadata: {
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: userId,
                    tags: workflowData.tags || [],
                    category: workflowData.category || 'general'
                },
                permissions: {
                    owner: userId,
                    editors: workflowData.permissions?.editors || [],
                    viewers: workflowData.permissions?.viewers || [],
                    public: workflowData.permissions?.public || false
                }
            };

            // Save workflow to database
            const query = `
                INSERT INTO workflow_definitions 
                (id, user_id, name, description, version, status, definition, settings, metadata, permissions, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const result = await DatabaseService.query(query, [
                workflowId,
                userId,
                workflow.name,
                workflow.description,
                workflow.version,
                workflow.status,
                JSON.stringify({
                    nodes: workflow.nodes,
                    connections: workflow.connections,
                    variables: workflow.variables
                }),
                JSON.stringify(workflow.settings),
                JSON.stringify(workflow.metadata),
                JSON.stringify(workflow.permissions),
                timestamp,
                timestamp
            ]);

            return {
                success: true,
                workflow: { ...workflow, ...result.rows[0] },
                validation
            };
        });
    }

    /**
     * Update workflow design
     */
    async updateWorkflow(workflowId, userId, updates) {
        return traceOperation('workflow.designer.update', async () => {
            // Check permissions
            const workflow = await this.getWorkflow(workflowId, userId);
            if (!workflow || !this.canEdit(workflow, userId)) {
                throw new Error('Workflow not found or insufficient permissions');
            }

            // Validate updates if nodes or connections changed
            if (updates.nodes || updates.connections) {
                const updatedWorkflow = {
                    ...workflow,
                    ...updates
                };
                const validation = await this.validateWorkflow(updatedWorkflow);
                if (!validation.valid) {
                    throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
                }
            }

            // Update workflow
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            if (updates.name) {
                updateFields.push(`name = $${paramIndex++}`);
                values.push(updates.name);
            }
            if (updates.description) {
                updateFields.push(`description = $${paramIndex++}`);
                values.push(updates.description);
            }
            if (updates.status) {
                updateFields.push(`status = $${paramIndex++}`);
                values.push(updates.status);
            }
            if (updates.nodes || updates.connections || updates.variables) {
                updateFields.push(`definition = $${paramIndex++}`);
                values.push(JSON.stringify({
                    nodes: updates.nodes || workflow.nodes,
                    connections: updates.connections || workflow.connections,
                    variables: updates.variables || workflow.variables
                }));
            }
            if (updates.settings) {
                updateFields.push(`settings = $${paramIndex++}`);
                values.push(JSON.stringify({ ...workflow.settings, ...updates.settings }));
            }

            updateFields.push(`updated_at = $${paramIndex++}`);
            values.push(new Date());

            values.push(workflowId);

            const query = `
                UPDATE workflow_definitions 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex} AND (user_id = $${paramIndex + 1} OR $${paramIndex + 1} = ANY(
                    SELECT jsonb_array_elements_text((permissions->'editors')::jsonb)
                ))
                RETURNING *
            `;
            values.push(userId);

            const result = await DatabaseService.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Workflow not found or insufficient permissions');
            }

            return {
                success: true,
                workflow: result.rows[0]
            };
        });
    }

    /**
     * Validate workflow structure and configuration
     */
    async validateWorkflow(workflow) {
        return traceOperation('workflow.designer.validate', async () => {
            const errors = [];
            const warnings = [];

            // Validate nodes
            const nodes = workflow.nodes || [];
            const connections = workflow.connections || [];

            // Check minimum nodes
            if (nodes.length < this.validationRules.nodes.minNodes) {
                errors.push(`Workflow must have at least ${this.validationRules.nodes.minNodes} nodes`);
            }

            // Check maximum nodes
            if (nodes.length > this.validationRules.nodes.maxNodes) {
                errors.push(`Workflow cannot have more than ${this.validationRules.nodes.maxNodes} nodes`);
            }

            // Check for required node types
            const nodeTypes = nodes.map(node => node.type);
            for (const requiredType of this.validationRules.nodes.requiredTypes) {
                if (!nodeTypes.includes(requiredType)) {
                    errors.push(`Workflow must contain at least one ${requiredType} node`);
                }
            }

            // Validate node configurations
            for (const node of nodes) {
                const nodeTypeConfig = this.nodeTypes[node.type.toUpperCase()];
                if (!nodeTypeConfig) {
                    errors.push(`Invalid node type: ${node.type}`);
                    continue;
                }

                // Validate required configuration
                for (const [configKey, configSpec] of Object.entries(nodeTypeConfig.config)) {
                    if (configSpec.required && !node.config?.[configKey]) {
                        errors.push(`Node ${node.id}: Missing required configuration '${configKey}'`);
                    }

                    // Validate configuration values
                    const value = node.config?.[configKey];
                    if (value !== undefined) {
                        const validation = this.validateConfigValue(configKey, value, configSpec);
                        if (!validation.valid) {
                            errors.push(`Node ${node.id}: ${validation.error}`);
                        }
                    }
                }
            }

            // Validate connections
            const nodeIds = new Set(nodes.map(node => node.id));
            for (const connection of connections) {
                if (!nodeIds.has(connection.from)) {
                    errors.push(`Connection references non-existent source node: ${connection.from}`);
                }
                if (!nodeIds.has(connection.to)) {
                    errors.push(`Connection references non-existent target node: ${connection.to}`);
                }
            }

            // Check for orphaned nodes
            if (this.validationRules.connections.noOrphans) {
                const connectedNodes = new Set();
                connections.forEach(conn => {
                    connectedNodes.add(conn.from);
                    connectedNodes.add(conn.to);
                });

                for (const node of nodes) {
                    if (!connectedNodes.has(node.id) && node.type !== 'start' && node.type !== 'end') {
                        warnings.push(`Node ${node.id} is not connected to any other node`);
                    }
                }
            }

            // Check for circular dependencies
            if (this.validationRules.connections.noCircular) {
                const circular = this.detectCircularDependencies(nodes, connections);
                if (circular.length > 0) {
                    errors.push(`Circular dependencies detected: ${circular.join(', ')}`);
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                nodeCount: nodes.length,
                connectionCount: connections.length
            };
        });
    }

    /**
     * Validate individual configuration value
     */
    validateConfigValue(key, value, spec) {
        try {
            switch (spec.type) {
                case 'string':
                    if (typeof value !== 'string') {
                        return { valid: false, error: `${key} must be a string` };
                    }
                    if (spec.minLength && value.length < spec.minLength) {
                        return { valid: false, error: `${key} must be at least ${spec.minLength} characters` };
                    }
                    if (spec.maxLength && value.length > spec.maxLength) {
                        return { valid: false, error: `${key} cannot exceed ${spec.maxLength} characters` };
                    }
                    break;

                case 'number':
                    if (typeof value !== 'number' || isNaN(value)) {
                        return { valid: false, error: `${key} must be a valid number` };
                    }
                    if (spec.min !== undefined && value < spec.min) {
                        return { valid: false, error: `${key} must be at least ${spec.min}` };
                    }
                    if (spec.max !== undefined && value > spec.max) {
                        return { valid: false, error: `${key} cannot exceed ${spec.max}` };
                    }
                    break;

                case 'boolean':
                    if (typeof value !== 'boolean') {
                        return { valid: false, error: `${key} must be a boolean` };
                    }
                    break;

                case 'array':
                    if (!Array.isArray(value)) {
                        return { valid: false, error: `${key} must be an array` };
                    }
                    break;

                case 'object':
                    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                        return { valid: false, error: `${key} must be an object` };
                    }
                    break;

                case 'select':
                    if (!spec.options.includes(value)) {
                        return { valid: false, error: `${key} must be one of: ${spec.options.join(', ')}` };
                    }
                    break;

                case 'expression':
                    // Basic expression validation
                    if (typeof value !== 'string') {
                        return { valid: false, error: `${key} must be a valid expression string` };
                    }
                    break;

                case 'sql':
                    // Basic SQL validation
                    if (typeof value !== 'string') {
                        return { valid: false, error: `${key} must be a valid SQL string` };
                    }
                    // Add more sophisticated SQL validation if needed
                    break;

                case 'code':
                    if (typeof value !== 'string') {
                        return { valid: false, error: `${key} must be a valid code string` };
                    }
                    break;
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Validation error for ${key}: ${error.message}` };
        }
    }

    /**
     * Detect circular dependencies in workflow
     */
    detectCircularDependencies(nodes, connections) {
        const graph = new Map();
        const nodeIds = nodes.map(node => node.id);

        // Build adjacency list
        for (const nodeId of nodeIds) {
            graph.set(nodeId, []);
        }
        for (const connection of connections) {
            graph.get(connection.from)?.push(connection.to);
        }

        // DFS to detect cycles
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];

        const dfs = (nodeId, path) => {
            if (recursionStack.has(nodeId)) {
                const cycleStart = path.indexOf(nodeId);
                cycles.push(path.slice(cycleStart).join(' -> '));
                return;
            }
            if (visited.has(nodeId)) {
                return;
            }

            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const neighbors = graph.get(nodeId) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor, [...path]);
            }

            recursionStack.delete(nodeId);
        };

        for (const nodeId of nodeIds) {
            if (!visited.has(nodeId)) {
                dfs(nodeId, []);
            }
        }

        return cycles;
    }

    /**
     * Get workflow by ID
     */
    async getWorkflow(workflowId, userId) {
        return traceOperation('workflow.designer.get', async () => {
            const query = `
                SELECT * FROM workflow_definitions 
                WHERE id = $1 AND (
                    user_id = $2 OR 
                    $2 = ANY(SELECT jsonb_array_elements_text((permissions->'editors')::jsonb)) OR
                    $2 = ANY(SELECT jsonb_array_elements_text((permissions->'viewers')::jsonb)) OR
                    (permissions->>'public')::boolean = true
                )
            `;

            const result = await DatabaseService.query(query, [workflowId, userId]);
            return result.rows[0] || null;
        });
    }

    /**
     * Check if user can edit workflow
     */
    canEdit(workflow, userId) {
        if (workflow.user_id === userId) return true;
        const permissions = typeof workflow.permissions === 'string' 
            ? JSON.parse(workflow.permissions) 
            : workflow.permissions;
        return permissions.editors?.includes(userId) || false;
    }

    /**
     * Get available node types for designer
     */
    getNodeTypes() {
        return {
            success: true,
            nodeTypes: this.nodeTypes,
            categories: this.getNodeCategories()
        };
    }

    /**
     * Get node categories for UI organization
     */
    getNodeCategories() {
        const categories = {};
        for (const [key, nodeType] of Object.entries(this.nodeTypes)) {
            if (!categories[nodeType.category]) {
                categories[nodeType.category] = {
                    name: this.getCategoryName(nodeType.category),
                    nodes: []
                };
            }
            categories[nodeType.category].nodes.push(key);
        }
        return categories;
    }

    /**
     * Get human-readable category name
     */
    getCategoryName(category) {
        const names = {
            control: 'Control Flow',
            data: 'Data Processing',
            action: 'Actions',
            ai: 'AI & ML',
            utility: 'Utilities'
        };
        return names[category] || category;
    }

    /**
     * Generate workflow preview/execution plan
     */
    async generateWorkflowPreview(workflowId, userId, sampleData = {}) {
        return traceOperation('workflow.designer.preview', async () => {
            const workflow = await this.getWorkflow(workflowId, userId);
            if (!workflow) {
                throw new Error('Workflow not found');
            }

            const definition = typeof workflow.definition === 'string' 
                ? JSON.parse(workflow.definition) 
                : workflow.definition;

            // Build execution plan
            const executionPlan = await this.buildExecutionPlan(definition.nodes, definition.connections);
            
            // Estimate execution metrics
            const metrics = this.estimateExecutionMetrics(executionPlan, sampleData);

            return {
                success: true,
                preview: {
                    executionPlan,
                    metrics,
                    estimatedDuration: metrics.estimatedDuration,
                    complexity: this.calculateComplexity(definition.nodes, definition.connections),
                    resourceUsage: metrics.resourceUsage
                }
            };
        });
    }

    /**
     * Build execution plan from workflow definition
     */
    async buildExecutionPlan(nodes, connections) {
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const graph = this.buildExecutionGraph(connections);
        const startNode = nodes.find(node => node.type === 'start');
        
        if (!startNode) {
            throw new Error('No start node found in workflow');
        }

        const executionOrder = [];
        const visited = new Set();
        
        const traverse = (nodeId, level = 0) => {
            if (visited.has(nodeId)) return;
            
            visited.add(nodeId);
            const node = nodeMap.get(nodeId);
            
            executionOrder.push({
                step: executionOrder.length + 1,
                nodeId,
                nodeType: node.type,
                nodeName: node.name || node.type,
                level,
                parallelGroup: this.getParallelGroup(nodeId, connections),
                estimatedDuration: this.estimateNodeDuration(node)
            });

            const nextNodes = graph.get(nodeId) || [];
            for (const nextNodeId of nextNodes) {
                traverse(nextNodeId, level + 1);
            }
        };

        traverse(startNode.id);
        return executionOrder;
    }

    /**
     * Build execution graph from connections
     */
    buildExecutionGraph(connections) {
        const graph = new Map();
        for (const connection of connections) {
            if (!graph.has(connection.from)) {
                graph.set(connection.from, []);
            }
            graph.get(connection.from).push(connection.to);
        }
        return graph;
    }

    /**
     * Get parallel execution group for node
     */
    getParallelGroup(nodeId, connections) {
        // Find if this node is part of a parallel execution
        for (const connection of connections) {
            if (connection.to === nodeId) {
                const sourceConnections = connections.filter(c => c.from === connection.from);
                if (sourceConnections.length > 1) {
                    return connection.from; // Group ID is the parallel node ID
                }
            }
        }
        return null;
    }

    /**
     * Estimate execution duration for a node
     */
    estimateNodeDuration(node) {
        const baseDurations = {
            start: 100,
            end: 100,
            decision: 200,
            parallel: 300,
            merge: 200,
            transform: 1000,
            filter: 500,
            aggregate: 2000,
            http_request: 5000,
            database_query: 3000,
            send_email: 2000,
            webhook: 3000,
            ai_agent_call: 10000,
            analyze_sentiment: 2000,
            delay: node.config?.duration || 1000,
            log: 100,
            variable: 100
        };

        return baseDurations[node.type] || 1000;
    }

    /**
     * Estimate execution metrics
     */
    estimateExecutionMetrics(executionPlan, sampleData) {
        const totalDuration = executionPlan.reduce((sum, step) => sum + step.estimatedDuration, 0);
        const parallelGroups = new Set(executionPlan.map(step => step.parallelGroup).filter(g => g));
        
        return {
            estimatedDuration: totalDuration,
            stepCount: executionPlan.length,
            parallelSections: parallelGroups.size,
            resourceUsage: {
                cpu: this.estimateCpuUsage(executionPlan),
                memory: this.estimateMemoryUsage(executionPlan, sampleData),
                network: this.estimateNetworkUsage(executionPlan)
            }
        };
    }

    /**
     * Calculate workflow complexity score
     */
    calculateComplexity(nodes, connections) {
        const nodeCount = nodes.length;
        const connectionCount = connections.length;
        const decisionNodes = nodes.filter(n => n.type === 'decision').length;
        const parallelNodes = nodes.filter(n => n.type === 'parallel').length;
        const aiNodes = nodes.filter(n => n.type === 'ai_agent_call').length;

        const score = nodeCount + 
                     (connectionCount * 0.5) + 
                     (decisionNodes * 2) + 
                     (parallelNodes * 3) + 
                     (aiNodes * 2);

        if (score < 10) return 'Simple';
        if (score < 25) return 'Moderate';
        if (score < 50) return 'Complex';
        return 'Very Complex';
    }

    /**
     * Estimate CPU usage
     */
    estimateCpuUsage(executionPlan) {
        const cpuIntensiveNodes = ['transform', 'aggregate', 'ai_agent_call', 'analyze_sentiment'];
        const intensiveCount = executionPlan.filter(step => 
            cpuIntensiveNodes.includes(step.nodeType)
        ).length;
        
        return Math.min(100, 10 + (intensiveCount * 15));
    }

    /**
     * Estimate memory usage
     */
    estimateMemoryUsage(executionPlan, sampleData) {
        const dataSize = JSON.stringify(sampleData).length || 1000;
        const transformNodes = executionPlan.filter(step => 
            ['transform', 'aggregate', 'filter'].includes(step.nodeType)
        ).length;
        
        return Math.max(10, (dataSize / 1000) + (transformNodes * 5));
    }

    /**
     * Estimate network usage
     */
    estimateNetworkUsage(executionPlan) {
        const networkNodes = ['http_request', 'webhook', 'send_email', 'ai_agent_call'];
        const networkCount = executionPlan.filter(step => 
            networkNodes.includes(step.nodeType)
        ).length;
        
        return networkCount * 20;
    }

    /**
     * Clone workflow
     */
    async cloneWorkflow(workflowId, userId, newName) {
        return traceOperation('workflow.designer.clone', async () => {
            const originalWorkflow = await this.getWorkflow(workflowId, userId);
            if (!originalWorkflow) {
                throw new Error('Workflow not found');
            }

            const definition = typeof originalWorkflow.definition === 'string' 
                ? JSON.parse(originalWorkflow.definition) 
                : originalWorkflow.definition;

            const clonedWorkflow = {
                name: newName || `${originalWorkflow.name} (Copy)`,
                description: originalWorkflow.description,
                nodes: definition.nodes.map(node => ({
                    ...node,
                    id: uuidv4() // Generate new IDs
                })),
                connections: [], // Will be updated with new node IDs
                variables: definition.variables,
                settings: typeof originalWorkflow.settings === 'string' 
                    ? JSON.parse(originalWorkflow.settings) 
                    : originalWorkflow.settings
            };

            // Update connections with new node IDs
            const nodeIdMap = new Map();
            definition.nodes.forEach((oldNode, index) => {
                nodeIdMap.set(oldNode.id, clonedWorkflow.nodes[index].id);
            });

            clonedWorkflow.connections = definition.connections.map(conn => ({
                ...conn,
                from: nodeIdMap.get(conn.from),
                to: nodeIdMap.get(conn.to)
            }));

            return this.createWorkflow(userId, clonedWorkflow);
        });
    }
}

export default new WorkflowDesignerService();
