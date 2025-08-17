// PHASE_A_WORKFLOW_IMPLEMENTATION: Core Workflow Runner Service
// Unified workflow automation platform - n8n/Zapier parity
// Minimal viable implementation with SSE streaming support

import { Pool } from 'pg';
import EventEmitter from 'events';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import crypto from 'crypto';

/**
 * Core workflow execution engine
 * Handles workflow execution with real-time SSE streaming
 */
class WorkflowRunnerService extends EventEmitter {
  constructor() {
    super();
    this.db = null;
    this.activeExecutions = new Map(); // executionId -> execution context
    this.isInitialized = false;
  }

  async initialize(dbPool) {
    return traceOperation('workflow.runner.initialize', async () => {
      try {
        this.db = dbPool;
        this.isInitialized = true;
        console.log('[WORKFLOW_RUNNER] Service initialized successfully');
        return { success: true };
      } catch (error) {
        console.error('[WORKFLOW_RUNNER] Initialization failed:', error);
        throw error;
      }
    });
  }

  /**
   * Execute workflow with real-time streaming
   * @param {string} workflowId - Workflow definition ID
   * @param {object} triggerData - Initial trigger data
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result with streaming capabilities
   */
  async executeWorkflow(workflowId, triggerData = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('WorkflowRunnerService not initialized');
    }

    return traceOperation('workflow.runner.execute', async (span) => {
      const executionId = crypto.randomUUID();
      
      try {
        // Get workflow definition
        const workflowResult = await this.db.query(
          'SELECT * FROM workflow_automation_definitions WHERE id = $1 AND is_active = true',
          [workflowId]
        );

        if (workflowResult.rows.length === 0) {
          throw new Error(`Active workflow not found: ${workflowId}`);
        }

        const workflow = workflowResult.rows[0];
        
        // Create execution record
        await this.db.query(`
          INSERT INTO workflow_executions (id, workflow_id, trigger_data, status, execution_context)
          VALUES ($1, $2, $3, 'running', $4)
        `, [executionId, workflowId, JSON.stringify(triggerData), JSON.stringify(options)]);

        // Set up execution context
        const executionContext = {
          id: executionId,
          workflow,
          triggerData,
          options,
          startTime: Date.now(),
          steps: [],
          currentStep: null,
          variables: { ...triggerData }, // Global execution variables
          status: 'running'
        };

        this.activeExecutions.set(executionId, executionContext);

        // Emit execution started event for SSE
        this.emit('execution_started', {
          execution_id: executionId,
          workflow_id: workflowId,
          workflow_name: workflow.name,
          started_at: new Date().toISOString(),
          trigger_data: triggerData
        });

        // Add telemetry
        span.setAttributes({
          'workflow.id': workflowId,
          'workflow.name': workflow.name,
          'execution.id': executionId,
          'execution.trigger_type': workflow.trigger_type
        });

        // Start async execution (don't await - streaming execution)
        this.executeWorkflowSteps(executionContext).catch(error => {
          console.error('[WORKFLOW_RUNNER] Execution error:', error);
          this.handleExecutionError(executionContext, error);
        });

        return {
          success: true,
          execution_id: executionId,
          status: 'running',
          streaming: true,
          workflow_name: workflow.name
        };

      } catch (error) {
        console.error('[WORKFLOW_RUNNER] Failed to start execution:', error);
        
        // Update execution record with error
        await this.db.query(
          'UPDATE workflow_executions SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['failed', error.message, executionId]
        );

        throw error;
      }
    });
  }

  /**
   * Execute workflow steps sequentially
   * @private
   */
  async executeWorkflowSteps(executionContext) {
    const { id: executionId, workflow } = executionContext;
    
    try {
      const definition = workflow.definition;
      const nodes = definition.nodes || [];
      
      console.log(`[WORKFLOW_RUNNER] Executing ${nodes.length} steps for workflow ${workflow.name}`);

      let totalSteps = 0;
      let completedSteps = 0;

      for (const node of nodes) {
        totalSteps++;
        
        const stepResult = await this.executeStep(executionContext, node);
        
        if (stepResult.status === 'completed') {
          completedSteps++;
        } else if (stepResult.status === 'failed') {
          throw new Error(`Step ${node.id} failed: ${stepResult.error}`);
        }

        // Update execution progress
        await this.db.query(
          'UPDATE workflow_executions SET completed_steps = $1, total_steps = $2 WHERE id = $3',
          [completedSteps, totalSteps, executionId]
        );
      }

      // Mark execution as completed
      const executionTime = Date.now() - executionContext.startTime;
      await this.db.query(`
        UPDATE workflow_executions 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, 
            execution_time_ms = $1, completed_steps = $2, total_steps = $3
        WHERE id = $4
      `, [executionTime, completedSteps, totalSteps, executionId]);

      executionContext.status = 'completed';
      
      // Emit completion event for SSE
      this.emit('execution_completed', {
        execution_id: executionId,
        workflow_id: workflow.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        execution_time_ms: executionTime,
        total_steps: totalSteps,
        completed_steps: completedSteps
      });

      console.log(`[WORKFLOW_RUNNER] Execution ${executionId} completed successfully`);

    } catch (error) {
      await this.handleExecutionError(executionContext, error);
    } finally {
      // Clean up execution context
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute individual workflow step
   * @private
   */
  async executeStep(executionContext, node) {
    const stepId = crypto.randomUUID();
    const { id: executionId } = executionContext;

    try {
      // Create step record
      await this.db.query(`
        INSERT INTO workflow_automation_steps (id, execution_id, node_id, step_name, step_type, status, started_at)
        VALUES ($1, $2, $3, $4, $5, 'running', CURRENT_TIMESTAMP)
      `, [stepId, executionId, node.id, node.name || node.type, node.type]);

      const startTime = Date.now();
      executionContext.currentStep = { id: stepId, node };

      // Emit step started event for SSE
      this.emit('step_started', {
        execution_id: executionId,
        step_id: stepId,
        node_id: node.id,
        step_name: node.name || node.type,
        step_type: node.type,
        started_at: new Date().toISOString()
      });

      console.log(`[WORKFLOW_RUNNER] Executing step: ${node.name || node.type} (${node.id})`);

      // TODO: PHASE_A_IMPLEMENTATION - Replace with proper node execution
      let stepResult;
      switch (node.type) {
        case 'trigger':
          stepResult = await this.executeTriggerNode(node, executionContext);
          break;
        case 'action':
          stepResult = await this.executeActionNode(node, executionContext);
          break;
        case 'condition':
          stepResult = await this.executeConditionNode(node, executionContext);
          break;
        case 'transform':
          stepResult = await this.executeTransformNode(node, executionContext);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      const duration = Date.now() - startTime;

      // Update step record
      await this.db.query(`
        UPDATE workflow_automation_steps 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, 
            duration_ms = $1, output_data = $2
        WHERE id = $3
      `, [duration, JSON.stringify(stepResult.output || {}), stepId]);

      // Emit step completed event for SSE
      this.emit('step_completed', {
        execution_id: executionId,
        step_id: stepId,
        node_id: node.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        output_data: stepResult.output
      });

      return { status: 'completed', output: stepResult.output };

    } catch (error) {
      const duration = Date.now() - (executionContext.currentStep?.startTime || Date.now());
      
      // Update step record with error
      await this.db.query(`
        UPDATE workflow_automation_steps 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP, 
            duration_ms = $1, error_data = $2
        WHERE id = $3
      `, [duration, JSON.stringify({ message: error.message, stack: error.stack }), stepId]);

      // Emit step failed event for SSE
      this.emit('step_failed', {
        execution_id: executionId,
        step_id: stepId,
        node_id: node.id,
        status: 'failed',
        error_message: error.message,
        failed_at: new Date().toISOString(),
        duration_ms: duration
      });

      return { status: 'failed', error: error.message };
    }
  }

  // TODO: PHASE_A_IMPLEMENTATION - Node execution methods (minimal stubs)
  async executeTriggerNode(node, context) {
    // Trigger nodes provide initial data - already processed
    return { output: context.triggerData };
  }

  async executeActionNode(node, context) {
    // TODO: Implement based on node action type
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
    return { output: { result: 'action_completed', node_id: node.id, timestamp: new Date().toISOString() } };
  }

  async executeConditionNode(node, context) {
    // TODO: Implement expression evaluation
    return { output: { result: true, condition_met: true } };
  }

  async executeTransformNode(node, context) {
    // TODO: Implement data transformation
    return { output: context.variables };
  }

  async handleExecutionError(executionContext, error) {
    const { id: executionId } = executionContext;
    const executionTime = Date.now() - executionContext.startTime;

    try {
      // Update execution record
      await this.db.query(`
        UPDATE workflow_executions 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP, 
            execution_time_ms = $1, error_message = $2, error_stack = $3
        WHERE id = $4
      `, [executionTime, error.message, error.stack, executionId]);

      executionContext.status = 'failed';

      // Emit execution failed event for SSE
      this.emit('execution_failed', {
        execution_id: executionId,
        workflow_id: executionContext.workflow.id,
        status: 'failed',
        error_message: error.message,
        failed_at: new Date().toISOString(),
        execution_time_ms: executionTime
      });

      console.error(`[WORKFLOW_RUNNER] Execution ${executionId} failed:`, error);

    } catch (dbError) {
      console.error('[WORKFLOW_RUNNER] Failed to update execution error:', dbError);
    }
  }

  /**
   * Get execution status and progress
   */
  async getExecutionStatus(executionId) {
    if (!this.isInitialized) {
      throw new Error('WorkflowRunnerService not initialized');
    }

    const result = await this.db.query(`
      SELECT e.*, w.name as workflow_name,
             (SELECT COUNT(*) FROM workflow_automation_steps WHERE execution_id = e.id) as total_steps,
             (SELECT COUNT(*) FROM workflow_automation_steps WHERE execution_id = e.id AND status = 'completed') as completed_steps
      FROM workflow_executions e
      JOIN workflow_automation_definitions w ON e.workflow_id = w.id
      WHERE e.id = $1
    `, [executionId]);

    if (result.rows.length === 0) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    return result.rows[0];
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(executionId) {
    if (!this.isInitialized) {
      throw new Error('WorkflowRunnerService not initialized');
    }

    const executionContext = this.activeExecutions.get(executionId);
    if (executionContext) {
      executionContext.status = 'cancelled';
      
      await this.db.query(
        'UPDATE workflow_executions SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['cancelled', executionId]
      );

      this.emit('execution_cancelled', {
        execution_id: executionId,
        cancelled_at: new Date().toISOString()
      });

      this.activeExecutions.delete(executionId);
    }

    return { success: true, status: 'cancelled' };
  }
}

export default WorkflowRunnerService;