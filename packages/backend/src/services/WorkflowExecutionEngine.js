/**
 * Advanced Workflow Execution Engine
 * Real-time processing with state management, conditional logic, parallel execution
 * Part of Task 25: Enterprise Workflow Automation System - Component 2
 */

import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import { Worker } from 'worker_threads';
import { traceOperation, traceAgentOperation } from '../system/OpenTelemetryTracing.js';
import DatabaseService from './DatabaseService.js';
import WorkflowDesignerService from './WorkflowDesignerService.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';

/**
 * Workflow execution states
 */
export const ExecutionStates = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
};

/**
 * Node execution states
 */
export const NodeStates = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    RETRYING: 'retrying'
};

/**
 * Workflow Execution Context
 */
class WorkflowExecutionContext {
    constructor(workflowId, executionId, userId, inputData = {}) {
        this.workflowId = workflowId;
        this.executionId = executionId;
        this.userId = userId;
        this.inputData = inputData;
        this.variables = new Map();
        this.nodeStates = new Map();
        this.nodeResults = new Map();
        this.executionStart = new Date();
        this.lastActivity = new Date();
        this.logs = [];
        this.metrics = {
            nodesExecuted: 0,
            nodesFailed: 0,
            totalDuration: 0,
            parallelBranches: 0,
            retriesPerformed: 0
        };
    }

    setVariable(name, value, scope = 'local') {
        const key = scope === 'global' ? `global:${name}` : name;
        this.variables.set(key, {
            value,
            scope,
            timestamp: new Date()
        });
    }

    getVariable(name, scope = 'local') {
        const key = scope === 'global' ? `global:${name}` : name;
        const variable = this.variables.get(key);
        return variable ? variable.value : undefined;
    }

    setNodeState(nodeId, state, result = null, error = null) {
        this.nodeStates.set(nodeId, {
            state,
            result,
            error,
            timestamp: new Date()
        });
        
        if (result !== null) {
            this.nodeResults.set(nodeId, result);
        }
        
        this.lastActivity = new Date();
        
        // Update metrics
        if (state === NodeStates.COMPLETED) {
            this.metrics.nodesExecuted++;
        } else if (state === NodeStates.FAILED) {
            this.metrics.nodesFailed++;
        } else if (state === NodeStates.RETRYING) {
            this.metrics.retriesPerformed++;
        }
    }

    getNodeState(nodeId) {
        return this.nodeStates.get(nodeId);
    }

    getNodeResult(nodeId) {
        return this.nodeResults.get(nodeId);
    }

    addLog(level, message, nodeId = null, data = null) {
        const logEntry = {
            id: uuidv4(),
            level,
            message,
            nodeId,
            data,
            timestamp: new Date()
        };
        
        this.logs.push(logEntry);
        this.lastActivity = new Date();
        
        // Trim logs to prevent memory issues (keep last 1000)
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
        
        return logEntry;
    }

    getDuration() {
        return new Date() - this.executionStart;
    }

    toJSON() {
        return {
            workflowId: this.workflowId,
            executionId: this.executionId,
            userId: this.userId,
            inputData: this.inputData,
            variables: Object.fromEntries(this.variables),
            nodeStates: Object.fromEntries(this.nodeStates),
            nodeResults: Object.fromEntries(this.nodeResults),
            executionStart: this.executionStart,
            lastActivity: this.lastActivity,
            logs: this.logs.slice(-100), // Only include recent logs
            metrics: this.metrics,
            duration: this.getDuration()
        };
    }
}

/**
 * Node Executor - Handles execution of individual workflow nodes
 */
class NodeExecutor {
    constructor(engine) {
        this.engine = engine;
        this.executors = this.initializeExecutors();
    }

    initializeExecutors() {
        return {
            // Control Flow Executors
            start: this.executeStart.bind(this),
            end: this.executeEnd.bind(this),
            decision: this.executeDecision.bind(this),
            parallel: this.executeParallel.bind(this),
            merge: this.executeMerge.bind(this),

            // Data Processing Executors
            transform: this.executeTransform.bind(this),
            filter: this.executeFilter.bind(this),
            aggregate: this.executeAggregate.bind(this),

            // Action Executors
            http_request: this.executeHttpRequest.bind(this),
            database_query: this.executeDatabaseQuery.bind(this),
            send_email: this.executeSendEmail.bind(this),
            webhook: this.executeWebhook.bind(this),

            // AI/ML Executors
            ai_agent_call: this.executeAIAgentCall.bind(this),
            analyze_sentiment: this.executeAnalyzeSentiment.bind(this),

            // Utility Executors
            delay: this.executeDelay.bind(this),
            log: this.executeLog.bind(this),
            variable: this.executeVariable.bind(this)
        };
    }

    async executeNode(node, context, inputData) {
        return traceOperation(`workflow.node.${node.type}`, async () => {
            const executor = this.executors[node.type];
            if (!executor) {
                throw new Error(`Unknown node type: ${node.type}`);
            }

            context.addLog('debug', `Executing node: ${node.name || node.id}`, node.id, {
                nodeType: node.type,
                inputData
            });

            try {
                const result = await executor(node, context, inputData);
                
                context.addLog('info', `Node executed successfully: ${node.name || node.id}`, node.id, {
                    result
                });

                return result;
            } catch (error) {
                context.addLog('error', `Node execution failed: ${error.message}`, node.id, {
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
        });
    }

    // Control Flow Executors
    async executeStart(node, context, inputData) {
        return {
            success: true,
            data: inputData || context.inputData,
            nextNodes: ['output']
        };
    }

    async executeEnd(node, context, inputData) {
        return {
            success: true,
            data: inputData,
            nextNodes: []
        };
    }

    async executeDecision(node, context, inputData) {
        const { condition, trueLabel = 'True', falseLabel = 'False' } = node.config;
        
        // Evaluate condition - simple expression evaluator
        const result = this.evaluateExpression(condition, inputData, context);
        const isTrue = Boolean(result);
        
        return {
            success: true,
            data: inputData,
            decision: isTrue,
            nextNodes: isTrue ? ['output-0'] : ['output-1'],
            metadata: {
                condition,
                result: isTrue,
                label: isTrue ? trueLabel : falseLabel
            }
        };
    }

    async executeParallel(node, context, inputData) {
        const { branches = 2 } = node.config;
        context.metrics.parallelBranches += branches;
        
        return {
            success: true,
            data: inputData,
            nextNodes: Array.from({ length: branches }, (_, i) => `output-${i}`)
        };
    }

    async executeMerge(node, context, inputData) {
        const { strategy = 'waitAll' } = node.config;
        
        // In a real implementation, this would handle different merge strategies
        return {
            success: true,
            data: Array.isArray(inputData) ? inputData : [inputData],
            nextNodes: ['output'],
            metadata: {
                strategy,
                inputCount: Array.isArray(inputData) ? inputData.length : 1
            }
        };
    }

    // Data Processing Executors
    async executeTransform(node, context, inputData) {
        const { transformation, timeout = 30000 } = node.config;
        
        if (!transformation) {
            throw new Error('Transformation code is required');
        }

        // Execute transformation in isolated context
        try {
            const transformFunction = new Function('data', 'context', 'require', transformation);
            const result = await Promise.race([
                Promise.resolve(transformFunction(inputData, {
                    getVariable: (name) => context.getVariable(name),
                    setVariable: (name, value) => context.setVariable(name, value),
                    log: (message, data) => context.addLog('info', message, node.id, data)
                })),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transformation timeout')), timeout)
                )
            ]);

            return {
                success: true,
                data: result,
                nextNodes: ['output']
            };
        } catch (error) {
            throw new Error(`Transformation failed: ${error.message}`);
        }
    }

    async executeFilter(node, context, inputData) {
        const { condition, passLabel = 'Pass', failLabel = 'Fail' } = node.config;
        
        const result = this.evaluateExpression(condition, inputData, context);
        const passes = Boolean(result);
        
        return {
            success: true,
            data: inputData,
            passes,
            nextNodes: passes ? ['output-0'] : ['output-1'],
            metadata: {
                condition,
                result: passes,
                label: passes ? passLabel : failLabel
            }
        };
    }

    async executeAggregate(node, context, inputData) {
        const { operation, field, groupBy } = node.config;
        
        if (!Array.isArray(inputData)) {
            throw new Error('Aggregate requires array input');
        }

        let result;
        switch (operation) {
            case 'sum':
                result = inputData.reduce((sum, item) => sum + (item[field] || 0), 0);
                break;
            case 'avg':
                const sum = inputData.reduce((sum, item) => sum + (item[field] || 0), 0);
                result = inputData.length > 0 ? sum / inputData.length : 0;
                break;
            case 'count':
                result = inputData.length;
                break;
            case 'min':
                result = Math.min(...inputData.map(item => item[field] || 0));
                break;
            case 'max':
                result = Math.max(...inputData.map(item => item[field] || 0));
                break;
            case 'group':
                if (!groupBy || !Array.isArray(groupBy)) {
                    throw new Error('Group operation requires groupBy fields');
                }
                result = this.groupBy(inputData, groupBy);
                break;
            default:
                throw new Error(`Unknown aggregation operation: ${operation}`);
        }

        return {
            success: true,
            data: result,
            nextNodes: ['output'],
            metadata: {
                operation,
                field,
                inputCount: inputData.length
            }
        };
    }

    // Action Executors
    async executeHttpRequest(node, context, inputData) {
        const { 
            method = 'GET', 
            url, 
            headers = {}, 
            body, 
            timeout = 30000,
            retryCount = 3 
        } = node.config;

        if (!url) {
            throw new Error('URL is required for HTTP request');
        }

        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            ...(body && { body: JSON.stringify(body) })
        };

        let lastError;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const responseData = await response.json().catch(() => response.text());

                if (response.ok) {
                    return {
                        success: true,
                        data: responseData,
                        nextNodes: ['output-0'],
                        metadata: {
                            status: response.status,
                            headers: Object.fromEntries(response.headers.entries()),
                            attempt: attempt + 1
                        }
                    };
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                lastError = error;
                if (attempt < retryCount) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay));
                    context.addLog('warn', `HTTP request failed, retrying in ${delay}ms`, node.id, {
                        attempt: attempt + 1,
                        error: error.message
                    });
                }
            }
        }

        return {
            success: false,
            error: lastError.message,
            nextNodes: ['output-1'],
            metadata: {
                attempts: retryCount + 1,
                finalError: lastError.message
            }
        };
    }

    async executeDatabaseQuery(node, context, inputData) {
        const { query, parameters = {}, timeout = 30000 } = node.config;

        if (!query) {
            throw new Error('SQL query is required');
        }

        try {
            // Replace parameters in query
            let processedQuery = query;
            const paramArray = [];
            let paramIndex = 1;

            // Simple parameter replacement
            for (const [key, value] of Object.entries(parameters)) {
                const placeholder = `$${paramIndex}`;
                processedQuery = processedQuery.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), placeholder);
                paramArray.push(value);
                paramIndex++;
            }

            const result = await Promise.race([
                DatabaseService.query(processedQuery, paramArray),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database query timeout')), timeout)
                )
            ]);

            return {
                success: true,
                data: result.rows,
                nextNodes: ['output-0'],
                metadata: {
                    rowCount: result.rows.length,
                    fields: result.fields?.map(f => f.name) || []
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                nextNodes: ['output-1'],
                metadata: {
                    query: query,
                    parameters
                }
            };
        }
    }

    async executeSendEmail(node, context, inputData) {
        const { to, subject, body, cc = [], bcc = [], attachments = [] } = node.config;

        if (!to || !Array.isArray(to) || to.length === 0) {
            throw new Error('Email recipients are required');
        }

        if (!subject || !body) {
            throw new Error('Email subject and body are required');
        }

        try {
            // This would integrate with your email service
            const emailResult = await this.sendEmailViaService({
                to,
                cc,
                bcc,
                subject,
                body,
                attachments
            });

            return {
                success: true,
                data: emailResult,
                nextNodes: ['output-0'],
                metadata: {
                    recipients: to.length,
                    messageId: emailResult.messageId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                nextNodes: ['output-1'],
                metadata: {
                    recipients: to
                }
            };
        }
    }

    async executeWebhook(node, context, inputData) {
        const { url, method = 'POST', payload = {}, headers = {}, timeout = 30000 } = node.config;

        if (!url) {
            throw new Error('Webhook URL is required');
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseData = await response.text();

            return {
                success: response.ok,
                data: responseData,
                nextNodes: response.ok ? ['output-0'] : ['output-1'],
                metadata: {
                    status: response.status,
                    url
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                nextNodes: ['output-1'],
                metadata: { url }
            };
        }
    }

    // AI/ML Executors
    async executeAIAgentCall(node, context, inputData) {
        const { agent, prompt, parameters = {}, timeout = 60000 } = node.config;

        if (!agent || !prompt) {
            throw new Error('Agent and prompt are required');
        }

        try {
            return await traceAgentOperation(`workflow.ai.${agent}`, async () => {
                // This would integrate with your AI agent system
                const agentInstance = EnhancedLangChainCoreAgent.getInstance();
                
                const result = await Promise.race([
                    agentInstance.processMessage(prompt, {
                        ...parameters,
                        context: inputData,
                        userId: context.userId
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AI agent timeout')), timeout)
                    )
                ]);

                return {
                    success: true,
                    data: result,
                    nextNodes: ['output-0'],
                    metadata: {
                        agent,
                        promptLength: prompt.length
                    }
                };
            });
        } catch (error) {
            return {
                success: false,
                error: error.message,
                nextNodes: ['output-1'],
                metadata: { agent }
            };
        }
    }

    async executeAnalyzeSentiment(node, context, inputData) {
        const { textField, language = 'auto' } = node.config;

        if (!textField) {
            throw new Error('Text field is required for sentiment analysis');
        }

        const text = inputData[textField];
        if (!text) {
            throw new Error(`Text field '${textField}' not found in input data`);
        }

        try {
            // Simple sentiment analysis implementation
            const sentiment = this.analyzeSentimentSimple(text);

            return {
                success: true,
                data: {
                    ...inputData,
                    sentiment: sentiment.sentiment,
                    confidence: sentiment.confidence,
                    scores: sentiment.scores
                },
                nextNodes: ['output'],
                metadata: {
                    textLength: text.length,
                    language
                }
            };
        } catch (error) {
            throw new Error(`Sentiment analysis failed: ${error.message}`);
        }
    }

    // Utility Executors
    async executeDelay(node, context, inputData) {
        const { duration, unit = 'seconds' } = node.config;

        if (!duration || duration <= 0) {
            throw new Error('Valid duration is required for delay');
        }

        let milliseconds;
        switch (unit) {
            case 'milliseconds': milliseconds = duration; break;
            case 'seconds': milliseconds = duration * 1000; break;
            case 'minutes': milliseconds = duration * 60 * 1000; break;
            case 'hours': milliseconds = duration * 60 * 60 * 1000; break;
            default: throw new Error(`Unknown time unit: ${unit}`);
        }

        await new Promise(resolve => setTimeout(resolve, milliseconds));

        return {
            success: true,
            data: inputData,
            nextNodes: ['output'],
            metadata: {
                delayMs: milliseconds
            }
        };
    }

    async executeLog(node, context, inputData) {
        const { level = 'info', message, data } = node.config;

        const logMessage = this.interpolateString(message, inputData, context);
        const logData = data ? this.interpolateObject(data, inputData, context) : inputData;

        context.addLog(level, logMessage, node.id, logData);

        return {
            success: true,
            data: inputData,
            nextNodes: ['output'],
            metadata: {
                level,
                message: logMessage
            }
        };
    }

    async executeVariable(node, context, inputData) {
        const { name, value, scope = 'local' } = node.config;

        if (!name) {
            throw new Error('Variable name is required');
        }

        const evaluatedValue = this.evaluateExpression(value, inputData, context);
        context.setVariable(name, evaluatedValue, scope);

        return {
            success: true,
            data: inputData,
            nextNodes: ['output'],
            metadata: {
                variableName: name,
                variableValue: evaluatedValue,
                scope
            }
        };
    }

    // Helper methods
    evaluateExpression(expression, data, context) {
        if (typeof expression !== 'string') {
            return expression;
        }

        try {
            // Simple expression evaluator - in production, use a proper expression parser
            const func = new Function('data', 'context', `
                const get = (path) => {
                    return path.split('.').reduce((obj, key) => obj?.[key], data);
                };
                const getVar = (name, scope = 'local') => context.getVariable(name, scope);
                return ${expression};
            `);
            
            return func(data, context);
        } catch (error) {
            throw new Error(`Expression evaluation failed: ${error.message}`);
        }
    }

    interpolateString(template, data, context) {
        if (typeof template !== 'string') {
            return template;
        }

        return template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
            try {
                return this.evaluateExpression(expression, data, context);
            } catch (error) {
                return match; // Return original if evaluation fails
            }
        });
    }

    interpolateObject(obj, data, context) {
        if (typeof obj === 'string') {
            return this.interpolateString(obj, data, context);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.interpolateObject(item, data, context));
        }
        
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.interpolateObject(value, data, context);
            }
            return result;
        }
        
        return obj;
    }

    groupBy(array, fields) {
        return array.reduce((groups, item) => {
            const key = fields.map(field => item[field]).join('|');
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    analyzeSentimentSimple(text) {
        // Very simple sentiment analysis - in production, use a proper NLP service
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting'];
        
        const words = text.toLowerCase().split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });
        
        const totalSentimentWords = positiveCount + negativeCount;
        let sentiment = 'neutral';
        let confidence = 0.5;
        
        if (totalSentimentWords > 0) {
            if (positiveCount > negativeCount) {
                sentiment = 'positive';
                confidence = Math.min(0.9, 0.5 + (positiveCount - negativeCount) / totalSentimentWords * 0.4);
            } else if (negativeCount > positiveCount) {
                sentiment = 'negative';
                confidence = Math.min(0.9, 0.5 + (negativeCount - positiveCount) / totalSentimentWords * 0.4);
            }
        }
        
        return {
            sentiment,
            confidence,
            scores: {
                positive: positiveCount / words.length,
                negative: negativeCount / words.length,
                neutral: 1 - (positiveCount + negativeCount) / words.length
            }
        };
    }

    async sendEmailViaService(emailData) {
        // Placeholder - integrate with actual email service
        return {
            messageId: uuidv4(),
            status: 'sent',
            timestamp: new Date()
        };
    }
}

/**
 * Advanced Workflow Execution Engine
 */
export class WorkflowExecutionEngine extends EventEmitter {
    constructor() {
        super();
        this.activeExecutions = new Map();
        this.nodeExecutor = new NodeExecutor(this);
        this.maxConcurrentExecutions = 100;
        this.executionTimeout = 3600000; // 1 hour default
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId, userId, inputData = {}, options = {}) {
        return traceOperation('workflow.execution.start', async () => {
            // Check execution limits
            if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
                throw new Error('Maximum concurrent executions reached');
            }

            const executionId = uuidv4();
            const context = new WorkflowExecutionContext(workflowId, executionId, userId, inputData);

            try {
                // Load workflow definition
                const workflow = await WorkflowDesignerService.getWorkflow(workflowId, userId);
                if (!workflow) {
                    throw new Error('Workflow not found');
                }

                const definition = typeof workflow.definition === 'string' 
                    ? JSON.parse(workflow.definition) 
                    : workflow.definition;

                // Validate workflow before execution
                const validation = await WorkflowDesignerService.validateWorkflow(definition);
                if (!validation.valid) {
                    throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
                }

                // Add to active executions
                this.activeExecutions.set(executionId, context);

                // Create execution record
                await this.createExecutionRecord(context, workflow, options);

                // Start execution
                this.emit('execution:started', { executionId, workflowId, userId });
                context.addLog('info', 'Workflow execution started', null, { inputData });

                // Set execution timeout
                const timeout = options.timeout || this.executionTimeout;
                const timeoutHandle = setTimeout(() => {
                    this.cancelExecution(executionId, 'Execution timeout');
                }, timeout);

                try {
                    // Execute workflow
                    const result = await this.executeWorkflowInternal(definition, context);
                    
                    clearTimeout(timeoutHandle);
                    
                    // Update execution record
                    await this.completeExecutionRecord(executionId, ExecutionStates.COMPLETED, result);
                    
                    context.addLog('info', 'Workflow execution completed successfully', null, { result });
                    this.emit('execution:completed', { executionId, workflowId, userId, result });
                    
                    return {
                        success: true,
                        executionId,
                        result,
                        duration: context.getDuration(),
                        metrics: context.metrics
                    };

                } catch (error) {
                    clearTimeout(timeoutHandle);
                    
                    await this.completeExecutionRecord(executionId, ExecutionStates.FAILED, null, error.message);
                    
                    context.addLog('error', 'Workflow execution failed', null, { error: error.message });
                    this.emit('execution:failed', { executionId, workflowId, userId, error: error.message });
                    
                    throw error;
                } finally {
                    this.activeExecutions.delete(executionId);
                }

            } catch (error) {
                this.activeExecutions.delete(executionId);
                throw error;
            }
        });
    }

    /**
     * Internal workflow execution logic
     */
    async executeWorkflowInternal(definition, context) {
        const { nodes, connections } = definition;
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const graph = this.buildExecutionGraph(connections);
        
        // Find start node
        const startNode = nodes.find(node => node.type === 'start');
        if (!startNode) {
            throw new Error('No start node found in workflow');
        }

        // Execute workflow using depth-first traversal with parallel support
        const executionQueue = [{ nodeId: startNode.id, data: context.inputData }];
        const completedNodes = new Set();
        const parallelTasks = new Map();

        while (executionQueue.length > 0 || parallelTasks.size > 0) {
            // Process parallel tasks
            if (parallelTasks.size > 0) {
                const completed = [];
                for (const [taskId, task] of parallelTasks.entries()) {
                    if (task.status === 'completed' || task.status === 'failed') {
                        completed.push(taskId);
                    }
                }
                
                // Clean up completed parallel tasks
                for (const taskId of completed) {
                    const task = parallelTasks.get(taskId);
                    parallelTasks.delete(taskId);
                    
                    if (task.status === 'completed') {
                        // Add next nodes to queue
                        const nextNodes = this.getNextNodes(task.nodeId, task.result, graph);
                        for (const nextNodeId of nextNodes) {
                            executionQueue.push({ nodeId: nextNodeId, data: task.result.data });
                        }
                    }
                }
            }

            // Process next node in queue
            if (executionQueue.length > 0) {
                const { nodeId, data } = executionQueue.shift();
                
                if (completedNodes.has(nodeId)) {
                    continue; // Skip already processed nodes
                }

                const node = nodeMap.get(nodeId);
                if (!node) {
                    context.addLog('warn', `Node not found: ${nodeId}`);
                    continue;
                }

                try {
                    // Set node state to running
                    context.setNodeState(nodeId, NodeStates.RUNNING);
                    this.emit('node:started', { 
                        executionId: context.executionId, 
                        nodeId, 
                        nodeType: node.type 
                    });

                    // Execute node
                    const result = await this.executeNodeWithRetry(node, context, data);
                    
                    // Mark node as completed
                    context.setNodeState(nodeId, NodeStates.COMPLETED, result);
                    completedNodes.add(nodeId);
                    
                    this.emit('node:completed', { 
                        executionId: context.executionId, 
                        nodeId, 
                        result 
                    });

                    // Handle parallel execution
                    if (node.type === 'parallel' && result.nextNodes.length > 1) {
                        // Start parallel tasks
                        for (const outputId of result.nextNodes) {
                            const nextNodes = graph.get(nodeId) || [];
                            for (const nextNodeId of nextNodes) {
                                const taskId = `${nodeId}_${nextNodeId}_${Date.now()}`;
                                parallelTasks.set(taskId, {
                                    nodeId: nextNodeId,
                                    data: result.data,
                                    result: null,
                                    status: 'pending'
                                });
                                
                                // Execute in background
                                this.executeParallelTask(taskId, nextNodeId, result.data, context, nodeMap, graph, parallelTasks);
                            }
                        }
                    } else {
                        // Add next nodes to queue for sequential execution
                        const nextNodes = this.getNextNodes(nodeId, result, graph);
                        for (const nextNodeId of nextNodes) {
                            executionQueue.push({ nodeId: nextNodeId, data: result.data });
                        }
                    }

                    // Check if this is an end node
                    if (node.type === 'end') {
                        return result;
                    }

                } catch (error) {
                    context.setNodeState(nodeId, NodeStates.FAILED, null, error.message);
                    this.emit('node:failed', { 
                        executionId: context.executionId, 
                        nodeId, 
                        error: error.message 
                    });
                    throw error;
                }
            }

            // Small delay to prevent tight loops
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // If we reach here without hitting an end node, workflow completed
        return {
            success: true,
            data: context.nodeResults.get('end') || context.inputData,
            completedNodes: Array.from(completedNodes),
            metrics: context.metrics
        };
    }

    /**
     * Execute parallel task
     */
    async executeParallelTask(taskId, nodeId, data, context, nodeMap, graph, parallelTasks) {
        try {
            const task = parallelTasks.get(taskId);
            if (!task || task.status !== 'pending') {
                return;
            }

            task.status = 'running';
            
            const node = nodeMap.get(nodeId);
            if (!node) {
                task.status = 'failed';
                task.error = 'Node not found';
                return;
            }

            const result = await this.executeNodeWithRetry(node, context, data);
            
            task.status = 'completed';
            task.result = result;
            
        } catch (error) {
            const task = parallelTasks.get(taskId);
            if (task) {
                task.status = 'failed';
                task.error = error.message;
            }
        }
    }

    /**
     * Execute node with retry logic
     */
    async executeNodeWithRetry(node, context, data, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    context.setNodeState(node.id, NodeStates.RETRYING);
                    const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    context.addLog('info', `Retrying node execution (attempt ${attempt + 1})`, node.id);
                }

                const result = await this.nodeExecutor.executeNode(node, context, data);
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry for certain types of errors
                if (this.isNonRetryableError(error)) {
                    break;
                }
                
                context.addLog('warn', `Node execution failed: ${error.message}`, node.id, {
                    attempt: attempt + 1,
                    maxRetries
                });
            }
        }

        throw lastError;
    }

    /**
     * Check if error is non-retryable
     */
    isNonRetryableError(error) {
        const nonRetryablePatterns = [
            /validation/i,
            /configuration/i,
            /unauthorized/i,
            /forbidden/i,
            /not found/i
        ];

        return nonRetryablePatterns.some(pattern => pattern.test(error.message));
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
     * Get next nodes based on execution result
     */
    getNextNodes(nodeId, result, graph) {
        const allNextNodes = graph.get(nodeId) || [];
        
        if (!result.nextNodes) {
            return allNextNodes;
        }
        
        // Map result next nodes to actual node IDs
        // This is a simplified implementation
        return allNextNodes;
    }

    /**
     * Cancel workflow execution
     */
    async cancelExecution(executionId, reason = 'Cancelled by user') {
        const context = this.activeExecutions.get(executionId);
        if (!context) {
            throw new Error('Execution not found');
        }

        context.addLog('warn', 'Workflow execution cancelled', null, { reason });
        
        await this.completeExecutionRecord(executionId, ExecutionStates.CANCELLED, null, reason);
        
        this.activeExecutions.delete(executionId);
        this.emit('execution:cancelled', { executionId, reason });
        
        return { success: true, executionId, reason };
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId) {
        const context = this.activeExecutions.get(executionId);
        if (!context) {
            return null;
        }

        return {
            executionId,
            workflowId: context.workflowId,
            status: ExecutionStates.RUNNING,
            progress: this.calculateProgress(context),
            duration: context.getDuration(),
            metrics: context.metrics,
            currentNodes: this.getCurrentNodes(context),
            logs: context.logs.slice(-50) // Recent logs
        };
    }

    /**
     * Calculate execution progress
     */
    calculateProgress(context) {
        const totalNodes = context.nodeStates.size;
        const completedNodes = Array.from(context.nodeStates.values())
            .filter(state => state.state === NodeStates.COMPLETED).length;
        
        return totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;
    }

    /**
     * Get currently executing nodes
     */
    getCurrentNodes(context) {
        return Array.from(context.nodeStates.entries())
            .filter(([nodeId, state]) => state.state === NodeStates.RUNNING)
            .map(([nodeId, state]) => ({ nodeId, ...state }));
    }

    /**
     * Create execution record in database
     */
    async createExecutionRecord(context, workflow, options) {
        const query = `
            INSERT INTO workflow_executions 
            (id, workflow_id, user_id, status, input_data, settings, started_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await DatabaseService.query(query, [
            context.executionId,
            context.workflowId,
            context.userId,
            ExecutionStates.RUNNING,
            JSON.stringify(context.inputData),
            JSON.stringify(options),
            context.executionStart,
            new Date()
        ]);
    }

    /**
     * Complete execution record
     */
    async completeExecutionRecord(executionId, status, result, errorMessage = null) {
        const query = `
            UPDATE workflow_executions 
            SET status = $1, result_data = $2, error_message = $3, completed_at = $4, updated_at = $5
            WHERE id = $6
        `;

        await DatabaseService.query(query, [
            status,
            result ? JSON.stringify(result) : null,
            errorMessage,
            new Date(),
            new Date(),
            executionId
        ]);
    }

    /**
     * Get all active executions
     */
    getActiveExecutions() {
        const executions = [];
        for (const [executionId, context] of this.activeExecutions.entries()) {
            executions.push({
                executionId,
                workflowId: context.workflowId,
                userId: context.userId,
                status: ExecutionStates.RUNNING,
                startedAt: context.executionStart,
                duration: context.getDuration(),
                progress: this.calculateProgress(context)
            });
        }
        return executions;
    }

    /**
     * Cleanup old executions and logs
     */
    async cleanup() {
        // Remove stale executions (running for more than 2 hours)
        const staleThreshold = Date.now() - (2 * 60 * 60 * 1000);
        
        for (const [executionId, context] of this.activeExecutions.entries()) {
            if (context.executionStart.getTime() < staleThreshold) {
                await this.cancelExecution(executionId, 'Execution cleanup - stale execution');
            }
        }

        // Clean up database records
        const cleanupQuery = `
            UPDATE workflow_executions 
            SET status = $1, error_message = $2, completed_at = $3, updated_at = $4
            WHERE status = $5 AND started_at < $6
        `;

        await DatabaseService.query(cleanupQuery, [
            ExecutionStates.FAILED,
            'Execution cleanup - stale execution',
            new Date(),
            new Date(),
            ExecutionStates.RUNNING,
            new Date(staleThreshold)
        ]);
    }
}

// Export singleton instance
export default new WorkflowExecutionEngine();
