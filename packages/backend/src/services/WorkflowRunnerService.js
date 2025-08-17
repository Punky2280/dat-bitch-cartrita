// PHASE_A_WORKFLOW_IMPLEMENTATION: Core Workflow Execution Engine
// Handles workflow execution with real-time SSE streaming and comprehensive tracing

import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { Pool } from 'pg';

export default class WorkflowRunnerService {
  constructor(dbPool) {
    this.dbPool = dbPool || new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.activeExecutions = new Map();
    this.sseClients = new Map();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      console.log('[WorkflowRunnerService] 🚀 Initializing workflow execution engine...');
      
      // Test database connection
      await this.dbPool.query('SELECT 1');
      
      console.log('[WorkflowRunnerService] ✅ Service initialized successfully');
      return true;
    } catch (error) {
      console.error('[WorkflowRunnerService] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Execute a workflow with comprehensive tracing and SSE streaming
   */
  async executeWorkflow(workflowDefinition, inputData = {}, userId = null) {
    return await OpenTelemetryTracing.traceOperation(
      'workflow.execute',
      {
        attributes: {
          'workflow.id': workflowDefinition.id,
          'workflow.name': workflowDefinition.name,
          'workflow.steps_count': workflowDefinition.steps?.length || 0,
          'user.id': userId
        }
      },
      async (span) => {
        const executionId = this.generateExecutionId();
        
        try {
          // Create execution log entry
          const executionResult = await this.dbPool.query(`
            INSERT INTO workflow_automation_logs (
              workflow_id, user_id, status, input_data, started_at, execution_id
            ) VALUES ($1, $2, 'running', $3, NOW(), $4)
            RETURNING *
          `, [
            workflowDefinition.id,
            userId,
            JSON.stringify(inputData),
            executionId
          ]);

          const executionRecord = executionResult.rows[0];
          this.activeExecutions.set(executionId, {
            id: executionRecord.id,
            workflowId: workflowDefinition.id,
            status: 'running',
            startTime: Date.now()
          });

          // Execute workflow steps
          const result = await this.executeWorkflowSteps(
            workflowDefinition.steps || [],
            inputData,
            executionId,
            span
          );

          // Update execution log
          await this.dbPool.query(`
            UPDATE workflow_automation_logs 
            SET status = $1, output_data = $2, completed_at = NOW(),
                execution_time_ms = $3
            WHERE id = $4
          `, [
            result.success ? 'completed' : 'failed',
            JSON.stringify(result.output),
            Date.now() - this.activeExecutions.get(executionId).startTime,
            executionRecord.id
          ]);

          // Emit SSE completion event
          this.emitSSEEvent(executionId, {
            type: 'execution_completed',
            success: result.success,
            output: result.output,
            error: result.error
          });

          this.activeExecutions.delete(executionId);

          span.setAttributes({
            'execution.success': result.success,
            'execution.steps_completed': result.stepsCompleted || 0,
            'execution.duration_ms': Date.now() - this.activeExecutions.get(executionId)?.startTime || 0
          });

          return {
            id: executionRecord.id,
            execution_id: executionId,
            status: result.success ? 'completed' : 'failed',
            output: result.output,
            error: result.error,
            started_at: executionRecord.started_at
          };

        } catch (error) {
          console.error('[WorkflowRunnerService] Execution error:', error);
          
          // Update execution log with error
          if (this.activeExecutions.has(executionId)) {
            const execution = this.activeExecutions.get(executionId);
            await this.dbPool.query(`
              UPDATE workflow_automation_logs 
              SET status = 'failed', error_message = $1, completed_at = NOW(),
                  execution_time_ms = $2
              WHERE id = $3
            `, [
              error.message,
              Date.now() - execution.startTime,
              execution.id
            ]);
          }

          this.emitSSEEvent(executionId, {
            type: 'execution_failed',
            error: error.message
          });

          span.recordException(error);
          throw error;
        }
      }
    );
  }

  /**
   * Execute individual workflow steps
   */
  async executeWorkflowSteps(steps, context, executionId, parentSpan) {
    let currentContext = { ...context };
    let stepsCompleted = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        this.emitSSEEvent(executionId, {
          type: 'step_started',
          step: i + 1,
          total: steps.length,
          stepName: step.name || `Step ${i + 1}`
        });

        const stepResult = await this.executeStep(step, currentContext, parentSpan);
        
        if (stepResult.success) {
          currentContext = { ...currentContext, ...stepResult.output };
          stepsCompleted++;
          
          this.emitSSEEvent(executionId, {
            type: 'step_completed',
            step: i + 1,
            total: steps.length,
            stepName: step.name || `Step ${i + 1}`,
            output: stepResult.output
          });
        } else {
          return {
            success: false,
            error: stepResult.error,
            output: currentContext,
            stepsCompleted
          };
        }
      } catch (error) {
        console.error(`[WorkflowRunnerService] Step ${i + 1} failed:`, error);
        return {
          success: false,
          error: error.message,
          output: currentContext,
          stepsCompleted
        };
      }
    }

    return {
      success: true,
      output: currentContext,
      stepsCompleted
    };
  }

  /**
   * Execute individual step with type-specific logic
   */
  async executeStep(step, context, parentSpan) {
    return await OpenTelemetryTracing.traceOperation(
      `workflow.step.${step.type}`,
      {
        attributes: {
          'step.type': step.type,
          'step.name': step.name || 'unnamed'
        }
      },
      async (span) => {
        try {
          switch (step.type) {
            case 'http_request':
              return await this.executeHttpRequest(step, context);
            case 'data_transform':
              return await this.executeDataTransform(step, context);
            case 'condition':
              return await this.executeCondition(step, context);
            case 'delay':
              return await this.executeDelay(step, context);
            default:
              console.warn(`[WorkflowRunnerService] Unknown step type: ${step.type}`);
              return {
                success: true,
                output: { warning: `Unknown step type: ${step.type}` }
              };
          }
        } catch (error) {
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  /**
   * Execute HTTP request step
   */
  async executeHttpRequest(step, context) {
    const { url, method = 'GET', headers = {}, body } = step.config || {};
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await response.json();
      
      return {
        success: response.ok,
        output: { http_response: data, status: response.status },
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        output: {},
        error: `HTTP request failed: ${error.message}`
      };
    }
  }

  /**
   * Execute data transformation step
   */
  async executeDataTransform(step, context) {
    const { script } = step.config || {};
    
    try {
      // Simple transformation logic (can be extended)
      const transformFunction = new Function('context', `return ${script}`);
      const result = transformFunction(context);
      
      return {
        success: true,
        output: { transformed_data: result }
      };
    } catch (error) {
      return {
        success: false,
        output: {},
        error: `Data transformation failed: ${error.message}`
      };
    }
  }

  /**
   * Execute condition step
   */
  async executeCondition(step, context) {
    const { condition } = step.config || {};
    
    try {
      const conditionFunction = new Function('context', `return ${condition}`);
      const result = Boolean(conditionFunction(context));
      
      return {
        success: true,
        output: { condition_result: result }
      };
    } catch (error) {
      return {
        success: false,
        output: {},
        error: `Condition evaluation failed: ${error.message}`
      };
    }
  }

  /**
   * Execute delay step
   */
  async executeDelay(step, context) {
    const { duration = 1000 } = step.config || {};
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return {
      success: true,
      output: { delay_completed: duration }
    };
  }

  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit SSE event to connected clients
   */
  emitSSEEvent(executionId, event) {
    const clients = this.sseClients.get(executionId) || [];
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    
    clients.forEach(client => {
      try {
        client.write(eventData);
      } catch (error) {
        console.error('[WorkflowRunnerService] SSE write error:', error);
      }
    });
  }

  /**
   * Register SSE client for execution updates
   */
  registerSSEClient(executionId, response) {
    if (!this.sseClients.has(executionId)) {
      this.sseClients.set(executionId, []);
    }
    
    this.sseClients.get(executionId).push(response);
    
    // Clean up on client disconnect
    response.on('close', () => {
      const clients = this.sseClients.get(executionId) || [];
      const index = clients.indexOf(response);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.sseClients.delete(executionId);
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      active_executions: this.activeExecutions.size,
      sse_clients: Array.from(this.sseClients.values()).reduce((sum, clients) => sum + clients.length, 0)
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.activeExecutions.clear();
    this.sseClients.clear();
    
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }
}