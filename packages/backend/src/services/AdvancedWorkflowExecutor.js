/**
 * Advanced Workflow Executor - Sophisticated workflow execution engine
 * Supports visual workflow designer, conditional logic, parallel execution, and error handling
 */

import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class AdvancedWorkflowExecutor {
  constructor(cartritaRouter, agentRegistry) {
    this.router = cartritaRouter;
    this.agents = agentRegistry;
    this.activeExecutions = new Map();
    this.executionHistory = new Map();
    this.nodeTypes = new Map();
    this.maxConcurrentExecutions = 10;
    this.executionTimeout = 300000; // 5 minutes

    this.initializeNodeTypes();
  }

  initializeNodeTypes() {
    // Core workflow node types
    this.nodeTypes.set('start', {
      type: 'start',
      execute: (node, context) => ({ success: true, data: context.input })
    });

    this.nodeTypes.set('end', {
      type: 'end',
      execute: (node, context) => ({ success: true, data: context.data, final: true })
    });

    this.nodeTypes.set('ai_task', {
      type: 'ai_task',
      execute: async (node, context) => await this.executeAITask(node, context)
    });

    this.nodeTypes.set('condition', {
      type: 'condition',
      execute: (node, context) => this.evaluateCondition(node, context)
    });

    this.nodeTypes.set('transform', {
      type: 'transform',
      execute: (node, context) => this.transformData(node, context)
    });

    this.nodeTypes.set('parallel', {
      type: 'parallel',
      execute: async (node, context) => await this.executeParallel(node, context)
    });

    this.nodeTypes.set('loop', {
      type: 'loop',
      execute: async (node, context) => await this.executeLoop(node, context)
    });

    this.nodeTypes.set('delay', {
      type: 'delay',
      execute: async (node, context) => await this.executeDelay(node, context)
    });

    this.nodeTypes.set('webhook', {
      type: 'webhook',
      execute: async (node, context) => await this.executeWebhook(node, context)
    });

    this.nodeTypes.set('database', {
      type: 'database',
      execute: async (node, context) => await this.executeDatabaseOperation(node, context)
    });
  }

  async executeWorkflow(workflowDefinition, input, userId = null, options = {}) {
    const executionId = this.generateExecutionId();
    
    const execution = {
      id: executionId,
      workflowId: workflowDefinition.id,
      userId,
      status: 'running',
      startTime: Date.now(),
      input,
      output: null,
      currentNode: null,
      executionPath: [],
      variables: { ...options.variables || {} },
      context: {
        input,
        data: input,
        variables: { ...options.variables || {} },
        metadata: {
          executionId,
          userId,
          startTime: Date.now()
        }
      },
      logs: [],
      errors: []
    };

    this.activeExecutions.set(executionId, execution);

    try {
      await this.logExecution(executionId, 'started', { workflowId: workflowDefinition.id, input });

      const result = await OpenTelemetryTracing.traceOperation(
        'workflow.execute',
        { 
          attributes: { 
            'workflow.id': workflowDefinition.id,
            'workflow.execution_id': executionId 
          } 
        },
        async () => {
          return await this.executeNode(workflowDefinition.startNode, execution, workflowDefinition);
        }
      );

      execution.status = 'completed';
      execution.output = result.data;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      await this.logExecution(executionId, 'completed', { output: result.data, duration: execution.duration });

      // Store execution history
      this.executionHistory.set(executionId, { ...execution });
      
      return {
        executionId,
        status: 'completed',
        output: result.data,
        duration: execution.duration,
        executionPath: execution.executionPath,
        logs: execution.logs
      };

    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      await this.logExecution(executionId, 'failed', { error: error.message, duration: execution.duration });

      throw new Error(`Workflow execution failed: ${error.message}`);
    } finally {
      // Clean up active execution after delay
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 60000); // Keep for 1 minute for debugging
    }
  }

  async executeNode(nodeId, execution, workflowDefinition) {
    const node = workflowDefinition.nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    execution.currentNode = nodeId;
    execution.executionPath.push({
      nodeId,
      timestamp: Date.now(),
      type: node.type
    });

    this.log(execution, 'info', `Executing node: ${nodeId} (${node.type})`);

    const nodeType = this.nodeTypes.get(node.type);
    if (!nodeType) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    try {
      const result = await nodeType.execute(node, execution.context);
      
      if (result.final) {
        return result;
      }

      // Update context with result
      execution.context.data = result.data;
      if (result.variables) {
        Object.assign(execution.context.variables, result.variables);
      }

      // Determine next node
      let nextNodeId = null;
      
      if (result.nextNode) {
        nextNodeId = result.nextNode;
      } else if (node.connections && node.connections.length > 0) {
        // Use first connection by default, or condition-based selection
        if (node.type === 'condition' && result.branch) {
          const connection = node.connections.find(conn => conn.condition === result.branch);
          nextNodeId = connection ? connection.target : node.connections[0].target;
        } else {
          nextNodeId = node.connections[0].target;
        }
      }

      if (nextNodeId) {
        return await this.executeNode(nextNodeId, execution, workflowDefinition);
      } else {
        // No next node, workflow complete
        return { success: true, data: execution.context.data, final: true };
      }

    } catch (error) {
      this.log(execution, 'error', `Node execution failed: ${error.message}`);
      throw error;
    }
  }

  async executeAITask(node, context) {
    const { task, provider, model, prompt, options = {} } = node.config;
    
    try {
      const request = {
        task: task || 'chat',
        input: this.interpolateString(prompt, context),
        providerId: provider,
        userId: context.metadata.userId,
        options: {
          ...options,
          modelHint: model,
          traceId: `workflow-${context.metadata.executionId}`
        }
      };

      const result = await this.router.processRequest(request);
      
      return {
        success: true,
        data: result.response || result.result,
        metadata: {
          provider: result.provider,
          model: result.model,
          processingTime: result.processingTime
        }
      };
    } catch (error) {
      throw new Error(`AI task failed: ${error.message}`);
    }
  }

  evaluateCondition(node, context) {
    const { condition, branches } = node.config;
    const { data, variables } = context;

    try {
      // Simple condition evaluation - can be extended with a proper expression parser
      let result = false;
      const conditionStr = this.interpolateString(condition, context);
      
      // Basic condition types
      if (condition.includes('contains')) {
        const [left, right] = conditionStr.split('contains').map(s => s.trim());
        result = String(left).includes(String(right));
      } else if (condition.includes('equals')) {
        const [left, right] = conditionStr.split('equals').map(s => s.trim());
        result = String(left) === String(right);
      } else if (condition.includes('length >')) {
        const [left, right] = conditionStr.split('length >').map(s => s.trim());
        result = String(left).length > parseInt(right);
      } else {
        // Fallback to eval for complex conditions (be careful in production)
        result = Boolean(eval(conditionStr));
      }

      const branch = result ? 'true' : 'false';
      const branchConfig = branches[branch];

      return {
        success: true,
        data: context.data,
        branch,
        nextNode: branchConfig?.nextNode,
        variables: branchConfig?.setVariables || {}
      };
    } catch (error) {
      throw new Error(`Condition evaluation failed: ${error.message}`);
    }
  }

  transformData(node, context) {
    const { transformation, outputPath } = node.config;
    
    try {
      let result = context.data;
      
      switch (transformation.type) {
        case 'extract':
          result = this.extractFromData(context.data, transformation.path);
          break;
        case 'format':
          result = this.formatData(context.data, transformation.template);
          break;
        case 'aggregate':
          result = this.aggregateData(context.data, transformation.operation);
          break;
        case 'filter':
          result = this.filterData(context.data, transformation.criteria);
          break;
        default:
          throw new Error(`Unknown transformation type: ${transformation.type}`);
      }

      return {
        success: true,
        data: outputPath ? this.setNestedValue({}, outputPath, result) : result
      };
    } catch (error) {
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  async executeParallel(node, context) {
    const { branches } = node.config;
    
    try {
      const promises = branches.map(async (branch) => {
        const branchContext = { 
          ...context,
          data: branch.input ? this.interpolateValue(branch.input, context) : context.data
        };
        
        // Execute branch workflow
        const branchResult = await this.executeBranch(branch.nodes, branchContext);
        return { branchId: branch.id, result: branchResult };
      });

      const results = await Promise.all(promises);
      
      // Combine results based on merge strategy
      const mergedData = this.mergeParallelResults(results, node.config.mergeStrategy);
      
      return {
        success: true,
        data: mergedData,
        parallelResults: results
      };
    } catch (error) {
      throw new Error(`Parallel execution failed: ${error.message}`);
    }
  }

  async executeLoop(node, context) {
    const { condition, maxIterations = 10, loopBody } = node.config;
    const results = [];
    let iteration = 0;

    try {
      while (iteration < maxIterations) {
        // Check loop condition
        const shouldContinue = this.evaluateLoopCondition(condition, context, iteration);
        if (!shouldContinue) break;

        // Execute loop body
        const iterationContext = {
          ...context,
          variables: {
            ...context.variables,
            iteration,
            previousResult: results[results.length - 1]
          }
        };

        const result = await this.executeBranch(loopBody, iterationContext);
        results.push(result);
        
        // Update context with result
        context.data = result;
        iteration++;
      }

      return {
        success: true,
        data: results.length > 0 ? results[results.length - 1] : context.data,
        loopResults: results,
        iterations: iteration
      };
    } catch (error) {
      throw new Error(`Loop execution failed: ${error.message}`);
    }
  }

  async executeDelay(node, context) {
    const { duration } = node.config; // Duration in milliseconds
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return {
      success: true,
      data: context.data,
      delayed: duration
    };
  }

  async executeWebhook(node, context) {
    const { url, method = 'POST', headers = {}, body } = node.config;
    
    try {
      const requestBody = body ? this.interpolateValue(body, context) : context.data;
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: method !== 'GET' ? JSON.stringify(requestBody) : undefined
      });

      const result = await response.json();
      
      return {
        success: response.ok,
        data: result,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      throw new Error(`Webhook execution failed: ${error.message}`);
    }
  }

  async executeDatabaseOperation(node, context) {
    const { operation, query, parameters } = node.config;
    
    try {
      const interpolatedQuery = this.interpolateString(query, context);
      const interpolatedParams = parameters ? 
        parameters.map(param => this.interpolateValue(param, context)) : [];

      let result;
      switch (operation) {
        case 'select':
          result = await db.query(interpolatedQuery, interpolatedParams);
          result = result.rows;
          break;
        case 'insert':
        case 'update':
        case 'delete':
          result = await db.query(interpolatedQuery, interpolatedParams);
          result = { affectedRows: result.rowCount };
          break;
        default:
          throw new Error(`Unknown database operation: ${operation}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  // Helper methods
  interpolateString(str, context) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });
  }

  interpolateValue(value, context) {
    if (typeof value === 'string') {
      return this.interpolateString(value, context);
    } else if (Array.isArray(value)) {
      return value.map(item => this.interpolateValue(item, context));
    } else if (value && typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.interpolateValue(val, context);
      }
      return result;
    }
    return value;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && typeof current === 'object' ? current[key] : undefined, obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
    return obj;
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  log(execution, level, message, data = null) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      node: execution.currentNode,
      data
    };
    execution.logs.push(logEntry);
    
    console.log(`[Workflow:${execution.id}] ${level.toUpperCase()}: ${message}`);
  }

  async logExecution(executionId, event, data) {
    try {
      await db.query(
        'INSERT INTO workflow_execution_logs (execution_id, event, data, timestamp) VALUES ($1, $2, $3, NOW())',
        [executionId, event, JSON.stringify(data)]
      );
    } catch (error) {
      console.warn('[WorkflowExecutor] Failed to log execution:', error.message);
    }
  }

  // Status and monitoring methods
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values()).map(exec => ({
      id: exec.id,
      workflowId: exec.workflowId,
      status: exec.status,
      startTime: exec.startTime,
      currentNode: exec.currentNode,
      userId: exec.userId
    }));
  }

  getExecutionHistory(limit = 50) {
    return Array.from(this.executionHistory.values())
      .slice(-limit)
      .sort((a, b) => b.startTime - a.startTime);
  }

  async cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      execution.endTime = Date.now();
      await this.logExecution(executionId, 'cancelled', { reason: 'user_request' });
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  getNodeTypes() {
    return Array.from(this.nodeTypes.keys());
  }

  validateWorkflow(workflowDefinition) {
    const errors = [];
    
    // Check required fields
    if (!workflowDefinition.startNode) {
      errors.push('Workflow must have a startNode');
    }
    
    if (!workflowDefinition.nodes || Object.keys(workflowDefinition.nodes).length === 0) {
      errors.push('Workflow must have at least one node');
    }

    // Validate each node
    for (const [nodeId, node] of Object.entries(workflowDefinition.nodes || {})) {
      if (!this.nodeTypes.has(node.type)) {
        errors.push(`Unknown node type '${node.type}' in node '${nodeId}'`);
      }
      
      // Check connections
      if (node.connections) {
        for (const connection of node.connections) {
          if (!workflowDefinition.nodes[connection.target]) {
            errors.push(`Connection target '${connection.target}' not found in node '${nodeId}'`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default AdvancedWorkflowExecutor;