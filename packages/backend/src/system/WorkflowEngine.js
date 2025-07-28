// packages/backend/src/system/WorkflowEngine.js
const { Pool } = require('pg');
const MessageBus = require('./MessageBus');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * The WorkflowEngine is responsible for executing multi-step workflows.
 * It fetches a workflow definition from the database and dispatches
 * each step as a task onto the MessageBus, waiting for completion
 * before proceeding to the next step.
 */
class WorkflowEngine {
  constructor() {}

  /**
   * Executes a specific workflow.
   * @param {number} workflowId - The ID of the workflow to run.
   * @param {number} userId - The ID of the user initiating the run.
   * @returns {Promise<string>} A final, synthesized response after all steps are complete.
   */
  async run(workflowId, userId) {
    console.log(`[WorkflowEngine] Starting run for workflow ID: ${workflowId}`);
    
    // 1. Fetch the workflow from the database
    const workflowResult = await pool.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (workflowResult.rows.length === 0) {
      throw new Error('Workflow not found or access denied.');
    }

    const workflow = workflowResult.rows[0];
    const steps = workflow.definition;
    const results = [];
    let previousStepResult = null; // To chain context between steps

    // 2. Execute each step sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[WorkflowEngine] Executing step ${i + 1}: Agent=${step.agent}, Task=${step.task}`);

      const taskId = uuidv4();
      
      const taskPromise = new Promise((resolve, reject) => {
        MessageBus.once(`task:complete:${taskId}`, (result) => {
          results.push({ step: i + 1, agent: step.agent, result: result.text });
          previousStepResult = result.text; // Store result for the next step
          resolve();
        });
        MessageBus.once(`task:fail:${taskId}`, (error) => reject(new Error(error.error)));
        setTimeout(() => reject(new Error(`Task '${step.task}' timed out.`)), 60000); // 60-second timeout
      });

      // Construct a prompt that includes context from the previous step
      const promptWithContext = previousStepResult 
        ? `Based on the previous result:\n<previous_result>\n${previousStepResult}\n</previous_result>\n\nNow, please perform the following task: ${step.task}`
        : step.task;

      MessageBus.emit('task:request', {
        id: taskId,
        type: step.agent.toLowerCase().replace('agent', ''), // e.g., 'CodeWriterAgent' -> 'codewriter'
        payload: { prompt: promptWithContext }
      });

      await taskPromise;
    }

    console.log('[WorkflowEngine] All steps completed. Final result:', results[results.length - 1].result);
    // For now, we return the result of the very last step.
    // A future enhancement would be to synthesize all results.
    return results[results.length - 1].result;
  }
}

module.exports = new WorkflowEngine();
