/**
 * Phase A Workflow Runner
 * 
 * Enhanced workflow execution engine that integrates all Phase A components:
 * - PhaseANodeExecutor for node execution
 * - WorkflowGraphValidator for validation
 * - WorkflowExecutionStreamer for real-time updates
 * - Expression engine for safe variable interpolation
 */

import pool from '../db.js';
import PhaseANodeExecutor from './PhaseANodeExecutor.js';
import WorkflowGraphValidator from './WorkflowGraphValidator.js';
import workflowStreamer from './WorkflowExecutionStreamer.js';
import { v4 as uuidv4 } from 'uuid';

class PhaseAWorkflowRunner {
  constructor() {
    this.nodeExecutor = new PhaseANodeExecutor();
    this.validator = new WorkflowGraphValidator();
    this.activeExecutions = new Map();
  }

  /**
   * Execute a workflow with full Phase A capabilities
   */
  async executeWorkflow(workflowId, userId, inputData = {}, triggerType = 'manual') {
    const executionId = uuidv4();
    
    try {
      // Create execution record
      const executionResult = await pool.query(
        `INSERT INTO workflow_executions (id, workflow_id, user_id, status, started_at, input_data)
         VALUES ($1, $2, $3, 'running', NOW(), $4) RETURNING *`,
        [executionId, workflowId, userId, JSON.stringify(inputData)]
      );

      // Get workflow data
      const workflowResult = await pool.query(
        'SELECT workflow_data FROM workflows WHERE id = $1 AND user_id = $2',
        [workflowId, userId]
      );

      if (workflowResult.rows.length === 0) {
        throw new Error('Workflow not found or access denied');
      }

      const workflowData = workflowResult.rows[0].workflow_data;
      
      // Start execution
      workflowStreamer.sendWorkflowUpdate(executionId, 'started', {
        workflowId,
        triggerType,
        inputData
      });

      // Execute workflow in background
      this.executeWorkflowAsync(executionId, workflowData, inputData)
        .catch(error => {
          console.error(`Workflow execution ${executionId} failed:`, error);
          this.handleExecutionError(executionId, error);
        });

      return {
        success: true,
        executionId,
        message: 'Workflow execution started',
        streamUrl: `/api/workflows/stream/${executionId}`
      };

    } catch (error) {
      console.error('Failed to start workflow execution:', error);
      return {
        success: false,
        error: error.message,
        executionId
      };
    }
  }

  /**
   * Execute workflow asynchronously
   */
  async executeWorkflowAsync(executionId, workflowData, inputData) {
    const execution = {
      id: executionId,
      status: 'running',
      startedAt: new Date(),
      context: {
        input: inputData,
        variables: {},
        nodeResults: new Map(),
        globalVariables: new Map()
      }
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Validate workflow
      const validation = this.validator.validateWorkflow(workflowData);
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      workflowStreamer.sendLogMessage(executionId, 'info', 'Workflow validation passed');

      // Get execution order
      const executionOrder = this.validator.getTopologicalOrder(
        workflowData.nodes,
        workflowData.edges
      );

      if (!executionOrder) {
        throw new Error('Cannot determine execution order - cycles detected');
      }

      workflowStreamer.sendLogMessage(executionId, 'info', 
        `Execution order determined: ${executionOrder.join(' -> ')}`);

      // Execute nodes in order
      const totalNodes = executionOrder.length;
      let completedNodes = 0;

      for (const nodeId of executionOrder) {
        const node = workflowData.nodes.find(n => n.id === nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found in workflow`);
        }

        // Update progress
        workflowStreamer.sendProgressUpdate(executionId, {
          current: completedNodes,
          total: totalNodes,
          currentNode: nodeId,
          completedNodes: executionOrder.slice(0, completedNodes)
        });

        // Execute node
        await this.executeNode(executionId, node, execution.context);
        
        completedNodes++;
      }

      // Complete execution
      await this.completeExecution(executionId, execution.context);

    } catch (error) {
      await this.failExecution(executionId, error);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(executionId, node, context) {
    const { id: nodeId, type } = node;

    try {
      workflowStreamer.sendNodeUpdate(executionId, nodeId, 'started');
      workflowStreamer.sendLogMessage(executionId, 'info', 
        `Executing node ${nodeId} (${type})`);

      // Execute the node
      const result = await this.nodeExecutor.executeNode(node, context);

      // Handle variable assignments
      if (result.setVariable) {
        const { name, value, scope } = result.setVariable;
        if (scope === 'global') {
          context.globalVariables.set(name, value);
        } else {
          context.variables[name] = value;
        }
        
        workflowStreamer.sendVariableUpdate(executionId, {
          [name]: value
        });
      }

      // Store node result
      context.nodeResults.set(nodeId, result);

      workflowStreamer.sendNodeUpdate(executionId, nodeId, 'completed', result);
      workflowStreamer.sendLogMessage(executionId, 'success', 
        `Node ${nodeId} completed successfully`);

      return result;

    } catch (error) {
      workflowStreamer.sendNodeUpdate(executionId, nodeId, 'failed', {
        error: error.message
      });
      workflowStreamer.sendError(executionId, error, nodeId);
      
      throw new Error(`Node ${nodeId} failed: ${error.message}`);
    }
  }

  /**
   * Complete workflow execution
   */
  async completeExecution(executionId, context) {
    try {
      // Prepare output data
      const outputData = {
        variables: context.variables,
        globalVariables: Object.fromEntries(context.globalVariables),
        nodeResults: Object.fromEntries(context.nodeResults)
      };

      // Update database
      await pool.query(
        `UPDATE workflow_executions 
         SET status = 'completed', completed_at = NOW(), output_data = $2, 
             execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $1`,
        [executionId, JSON.stringify(outputData)]
      );

      workflowStreamer.sendWorkflowUpdate(executionId, 'completed', outputData);
      workflowStreamer.sendLogMessage(executionId, 'success', 'Workflow completed successfully');

      // Send final progress
      workflowStreamer.sendProgressUpdate(executionId, {
        current: 100,
        total: 100,
        percentage: 100,
        message: 'Workflow completed'
      });

    } catch (error) {
      console.error(`Failed to complete execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Fail workflow execution
   */
  async failExecution(executionId, error) {
    try {
      await pool.query(
        `UPDATE workflow_executions 
         SET status = 'failed', completed_at = NOW(), error = $2,
             execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $1`,
        [executionId, error.message]
      );

      workflowStreamer.sendWorkflowUpdate(executionId, 'failed', {
        error: error.message
      });
      workflowStreamer.sendError(executionId, error);

    } catch (dbError) {
      console.error(`Failed to update execution ${executionId} as failed:`, dbError);
    }
  }

  /**
   * Handle execution error
   */
  async handleExecutionError(executionId, error) {
    await this.failExecution(executionId, error);
    this.activeExecutions.delete(executionId);
  }

  /**
   * Cancel workflow execution
   */
  async cancelExecution(executionId, userId) {
    try {
      // Check if execution exists and user has access
      const result = await pool.query(
        `UPDATE workflow_executions 
         SET status = 'cancelled', completed_at = NOW(),
             execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $1 AND user_id = $2 AND status = 'running'
         RETURNING id`,
        [executionId, userId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Execution not found, not running, or access denied'
        };
      }

      // Remove from active executions
      this.activeExecutions.delete(executionId);

      workflowStreamer.sendWorkflowUpdate(executionId, 'cancelled');
      workflowStreamer.sendLogMessage(executionId, 'info', 'Workflow execution cancelled by user');

      return {
        success: true,
        message: 'Workflow execution cancelled'
      };

    } catch (error) {
      console.error(`Failed to cancel execution ${executionId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId, userId) {
    try {
      const result = await pool.query(
        `SELECT we.*, w.name as workflow_name
         FROM workflow_executions we
         JOIN workflows w ON we.workflow_id = w.id
         WHERE we.id = $1 AND we.user_id = $2`,
        [executionId, userId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Execution not found or access denied'
        };
      }

      const execution = result.rows[0];
      
      // Get streaming state if available
      const streamState = workflowStreamer.getExecutionState(executionId);

      return {
        success: true,
        execution: {
          ...execution,
          streamState
        }
      };

    } catch (error) {
      console.error(`Failed to get execution status ${executionId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values()).map(exec => ({
      id: exec.id,
      status: exec.status,
      startedAt: exec.startedAt,
      nodeCount: exec.context.nodeResults.size
    }));
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const active = this.activeExecutions.size;
    const streaming = workflowStreamer.getStats();

    return {
      activeExecutions: active,
      streamingStats: streaming,
      supportedNodeTypes: [
        'transform',
        'http-request', 
        'delay',
        'set-variable'
      ],
      capabilities: [
        'real-time-streaming',
        'graph-validation',
        'cycle-detection',
        'expression-engine',
        'variable-management',
        'error-handling',
        'progress-tracking'
      ]
    };
  }

  /**
   * Validate workflow without executing
   */
  validateWorkflow(workflowData) {
    return this.validator.validateWorkflow(workflowData);
  }

  /**
   * Test node execution
   */
  async testNode(nodeConfig, testContext = {}) {
    try {
      const result = await this.nodeExecutor.executeNode(nodeConfig, testContext);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default PhaseAWorkflowRunner;