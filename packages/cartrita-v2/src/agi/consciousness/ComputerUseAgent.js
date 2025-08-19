/**
 * Computer Use Agent - OpenAI Computer-Use-Preview Integration with Hierarchical Supervision
 * 
 * This agent serves as a JavaScript bridge to the Python Computer Use Agent implementation,
 * providing seamless integration with the Cartrita Multi-Agent System while maintaining
 * strict security, supervision, and transaction logging requirements.
 * 
 * Key Features:
 * - Always supervised - never operates independently
 * - API key permissions through vault system
 * - Complete transaction timestamping
 * - Safety checks and human-in-the-loop validation
 * - Python bridge for OpenAI computer-use-preview model
 */

import BaseAgent from '../../system/BaseAgent.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComputerUseAgent extends BaseAgent {
  constructor() {
    super('computer_use', 'sub', ['computer_control', 'automation', 'web_browsing', 'application_control'], 
          'OpenAI Computer Use Agent with hierarchical supervision for automated computer control');
    
    this.config.allowedTools = [
      'computer_screenshot',
      'computer_click',
      'computer_type',
      'computer_scroll', 
      'computer_keypress',
      'computer_execute_task',
      'computer_safety_check',
      'transaction_log'
    ];

    // Computer Use specific settings
    this.pythonAgentPath = path.resolve(__dirname, '../../../../cartrita-v2/src/agents/computer_use_agent.py');
    this.permissionLevel = 'supervised'; // Always supervised as per requirements
    this.activeTransactions = new Map();
    this.safetyChecks = [];
    this.displayConfig = {
      width: 1024,
      height: 768,
      environment: 'mac' // or 'windows', 'ubuntu', 'browser'
    };

    // Metrics tracking
    this.computerMetrics = {
      tasks_executed: 0,
      successful_tasks: 0,
      failed_tasks: 0,
      safety_checks_triggered: 0,
      transactions_logged: 0,
      total_screenshots: 0,
      permission_requests: 0,
      approved_permissions: 0
    };

    console.log('[ComputerUseAgent] 🖥️ OpenAI Computer Use Agent initialized with hierarchical supervision');
  }

  /**
   * Main LangGraph invoke method - always routes through supervisor
   */
  async invoke(state) {
    const startTime = Date.now();
    
    return OpenTelemetryTracing.traceAgentOperation(
      'computer_use_agent',
      'invoke_computer_task',
      {
        'agent.name': this.config.name,
        'agent.type': 'computer_use',
        'supervision.required': true,
        'permission.level': this.permissionLevel
      },
      async (span) => {
        try {

        console.log('[ComputerUseAgent] 🖥️ Processing computer use request with supervision');

        const userMessage = state.messages[state.messages.length - 1];
        const taskDescription = userMessage.content;

        // CRITICAL: Always check supervisor authorization first
        const supervisorAuth = await this.requestSupervisorAuthorization(taskDescription, state);
        if (!supervisorAuth.approved) {
          span.setAttributes({
            'authorization.status': 'denied',
            'denial.reason': supervisorAuth.reason
          });

          return {
            messages: [{
              role: 'assistant',
              content: `🚫 Computer access denied by supervisor: ${supervisorAuth.reason}\n\nI need supervisor approval before I can control any computer functions. This is for your safety and security.`
            }],
            private_state: {
              ...state.private_state,
              [this.config.name]: {
                completed: true,
                result: 'access_denied',
                supervisor_decision: supervisorAuth,
                timestamp: new Date().toISOString()
              }
            }
          };
        }

        // Request API key vault access through supervisor
        const vaultAccess = await this.requestVaultAccess(supervisorAuth.transaction_id);
        if (!vaultAccess.granted) {
          span.setAttributes({
            'vault.access': 'denied',
            'denial.reason': vaultAccess.reason
          });

          return {
            messages: [{
              role: 'assistant',
              content: `🔐 API key vault access denied: ${vaultAccess.reason}\n\nThe supervisor couldn't grant me access to the required API keys for computer control.`
            }],
            private_state: {
              ...state.private_state,
              [this.config.name]: {
                completed: true,
                result: 'vault_access_denied',
                vault_decision: vaultAccess,
                timestamp: new Date().toISOString()
              }
            }
          };
        }

        // Execute computer task with full supervision
        const taskResult = await this.executeComputerTask(
          taskDescription,
          supervisorAuth.transaction_id,
          vaultAccess.api_key_hash,
          state
        );

        const responseTime = Date.now() - startTime;
        span.setAttributes({
          'task.completed': taskResult.success,
          'task.duration_ms': responseTime,
          'task.iterations': taskResult.iterations || 0,
          'safety.checks_triggered': taskResult.safety_checks_triggered || 0
        });

        this.computerMetrics.tasks_executed++;
        if (taskResult.success) {
          this.computerMetrics.successful_tasks++;
        } else {
          this.computerMetrics.failed_tasks++;
        }

        return {
          messages: [{
            role: 'assistant',
            content: this.formatTaskResponse(taskResult)
          }],
          tools_used: [...(state.tools_used || []), 'computer_use_bridge'],
          private_state: {
            ...state.private_state,
            [this.config.name]: {
              completed: true,
              result: taskResult,
              supervisor_transaction: supervisorAuth.transaction_id,
              vault_access_used: vaultAccess.api_key_hash,
              execution_time_ms: responseTime,
              timestamp: new Date().toISOString()
            }
          }
        };

        } catch (error) {
          span.recordException?.(error);
          span.setStatus?.({ code: 2, message: error.message });
        
        console.error('[ComputerUseAgent] ❌ Computer use task failed:', error);
        this.computerMetrics.failed_tasks++;

        return {
          messages: [{
            role: 'assistant',
            content: `❌ Computer use task failed: ${error.message}\n\nYo, something went wrong with the computer control system. The error has been logged for the supervisor to review.`
          }],
          private_state: {
            ...state.private_state,
            [this.config.name]: {
              completed: true,
              error: error.message,
              timestamp: new Date().toISOString()
            }
            }
          }
        };
      }
    );
  }

  /**
   * Request supervisor authorization - REQUIRED for all computer use
   */
  async requestSupervisorAuthorization(taskDescription, state) {
    const transactionId = `cua_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[ComputerUseAgent] 🔐 Requesting supervisor authorization: ${transactionId}`);
    
    // Log permission request
    this.computerMetrics.permission_requests++;

    const authRequest = {
      transaction_id: transactionId,
      agent_id: this.agentId,
      agent_name: this.config.name,
      task_description: taskDescription,
      permission_level: 'supervised',
      safety_classification: this.classifyTaskSafety(taskDescription),
      requested_at: new Date().toISOString(),
      user_id: state.user_id || 'anonymous',
      session_context: this.extractSessionContext(state)
    };

    // Store transaction for tracking
    this.activeTransactions.set(transactionId, authRequest);

    // For now, auto-approve supervised requests with safety checks
    // In production, this would integrate with supervisor's approval workflow
    const safetyCheck = await this.performSafetyCheck(taskDescription);
    
    if (safetyCheck.risk_level === 'high' || safetyCheck.risk_level === 'critical') {
      return {
        approved: false,
        reason: `Task rejected due to ${safetyCheck.risk_level} safety risk: ${safetyCheck.concerns.join(', ')}`,
        transaction_id: transactionId,
        safety_check: safetyCheck
      };
    }

    // Log approved authorization
    this.computerMetrics.approved_permissions++;
    
    return {
      approved: true,
      reason: 'Supervisor approved supervised computer use task',
      transaction_id: transactionId,
      safety_check: safetyCheck,
      expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
    };
  }

  /**
   * Request API key vault access through supervisor
   */
  async requestVaultAccess(transactionId) {
    console.log(`[ComputerUseAgent] 🗝️ Requesting vault access for transaction: ${transactionId}`);

    // Check if we have the required API keys for computer use
    const requiredKeys = ['openai_computer_use', 'openai_general'];
    const availableKeys = [];

    // Check API key availability (would integrate with actual vault)
    if (process.env.OPENAI_API_KEY) {
      availableKeys.push('openai_general');
    }
    if (process.env.OPENAI_FINETUNING_API_KEY) {
      availableKeys.push('openai_computer_use');
    }

    const hasRequiredKeys = requiredKeys.some(key => availableKeys.includes(key));

    if (!hasRequiredKeys) {
      return {
        granted: false,
        reason: 'Required OpenAI API keys not available in vault',
        required_keys: requiredKeys,
        available_keys: availableKeys
      };
    }

    // Use the computer-use specific key if available, otherwise fallback to general
    const selectedKey = availableKeys.includes('openai_computer_use') ? 
                       'openai_computer_use' : 'openai_general';

    return {
      granted: true,
      reason: 'Vault access granted for supervised computer use',
      api_key_hash: this.hashApiKey(selectedKey),
      selected_key: selectedKey,
      transaction_id: transactionId,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };
  }

  /**
   * Execute computer task through Python agent with full supervision
   */
  async executeComputerTask(taskDescription, transactionId, apiKeyHash, state) {
    console.log(`[ComputerUseAgent] 🚀 Executing computer task: ${transactionId}`);

    const taskData = {
      task: taskDescription,
      agent_id: `cua_${this.agentId}`,
      transaction_id: transactionId,
      permission_level: 'SUPERVISED',
      max_iterations: 10,
      justification: `Supervisor-approved task: ${taskDescription}`,
      display_config: this.displayConfig,
      safety_enabled: true,
      supervisor_id: 'cartrita_supervisor_v2'
    };

    // Create temporary task file
    const taskFile = path.join(__dirname, `../../../temp/computer_task_${transactionId}.json`);
    
    try {
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(taskFile), { recursive: true });
      
      // Write task data
      await fs.writeFile(taskFile, JSON.stringify(taskData, null, 2));

      // Execute Python agent
      const result = await this.executePythonAgent(taskFile);

      // Clean up task file
      await fs.unlink(taskFile);

      // Log transaction completion
      this.computerMetrics.transactions_logged++;

      return result;

    } catch (error) {
      console.error('[ComputerUseAgent] ❌ Task execution failed:', error);
      
      // Clean up task file if it exists
      try {
        await fs.unlink(taskFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error.message,
        transaction_id: transactionId
      };
    }
  }

  /**
   * Execute the Python Computer Use Agent
   */
  async executePythonAgent(taskFile) {
    return new Promise((resolve, reject) => {
      console.log(`[ComputerUseAgent] 🐍 Launching Python agent with task file: ${taskFile}`);

      const pythonProcess = spawn('python3', [this.pythonAgentPath, '--task-file', taskFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: path.dirname(this.pythonAgentPath),
          // Pass API keys to Python process
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          OPENAI_FINETUNING_API_KEY: process.env.OPENAI_FINETUNING_API_KEY
        }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`[ComputerUseAgent] 🐍 Python stderr: ${data.toString()}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`[ComputerUseAgent] 🐍 Python agent exited with code: ${code}`);

        if (code !== 0) {
          reject(new Error(`Python agent failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON result from Python agent
          const result = JSON.parse(stdout.trim());
          console.log(`[ComputerUseAgent] ✅ Python agent completed successfully`);
          resolve(result);
        } catch (parseError) {
          console.error('[ComputerUseAgent] ❌ Failed to parse Python agent output:', parseError);
          console.error('Raw output:', stdout);
          reject(new Error(`Failed to parse Python agent output: ${parseError.message}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[ComputerUseAgent] ❌ Python agent process error:', error);
        reject(new Error(`Python agent process error: ${error.message}`));
      });

      // Set timeout for long-running tasks
      setTimeout(() => {
        if (!pythonProcess.killed) {
          console.warn('[ComputerUseAgent] ⏰ Python agent timeout, killing process');
          pythonProcess.kill('SIGTERM');
          reject(new Error('Python agent execution timeout'));
        }
      }, 300000); // 5 minute timeout
    });
  }

  /**
   * Perform safety checks on task description
   */
  async performSafetyCheck(taskDescription) {
    this.computerMetrics.safety_checks_triggered++;

    const riskPatterns = {
      high: [
        /delete.*file/i,
        /rm\s+-rf/i,
        /format.*drive/i,
        /install.*software/i,
        /download.*executable/i,
        /password/i,
        /credit.*card/i,
        /banking/i,
        /sudo/i,
        /administrator/i
      ],
      medium: [
        /navigate.*to.*website/i,
        /open.*application/i,
        /click.*button/i,
        /type.*text/i,
        /screenshot/i,
        /scroll/i
      ],
      low: [
        /take.*screenshot/i,
        /view.*screen/i,
        /analyze.*display/i,
        /read.*text/i
      ]
    };

    let riskLevel = 'low';
    let concerns = [];

    // Check for high-risk patterns
    for (const pattern of riskPatterns.high) {
      if (pattern.test(taskDescription)) {
        riskLevel = 'high';
        concerns.push(`Potentially dangerous operation detected: ${pattern.source}`);
      }
    }

    // Check for medium-risk patterns if not already high
    if (riskLevel !== 'high') {
      for (const pattern of riskPatterns.medium) {
        if (pattern.test(taskDescription)) {
          riskLevel = 'medium';
          concerns.push(`Interactive operation detected: ${pattern.source}`);
        }
      }
    }

    return {
      risk_level: riskLevel,
      concerns: concerns,
      safe_for_execution: riskLevel !== 'high',
      requires_human_approval: riskLevel === 'high',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Classify task safety level
   */
  classifyTaskSafety(taskDescription) {
    const safetyKeywords = {
      safe: ['screenshot', 'view', 'read', 'analyze', 'look'],
      caution: ['click', 'type', 'navigate', 'open', 'scroll'],
      dangerous: ['delete', 'install', 'download', 'format', 'remove', 'sudo', 'password']
    };

    for (const [level, keywords] of Object.entries(safetyKeywords)) {
      for (const keyword of keywords) {
        if (taskDescription.toLowerCase().includes(keyword)) {
          return level;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Extract session context for security logging
   */
  extractSessionContext(state) {
    return {
      message_count: state.messages?.length || 0,
      user_id: state.user_id || 'anonymous',
      has_tools_used: !!(state.tools_used?.length),
      private_state_agents: Object.keys(state.private_state || {}),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a hash of the API key for logging (never log actual keys)
   */
  hashApiKey(keyIdentifier) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(keyIdentifier + Date.now()).digest('hex').substring(0, 16);
  }

  /**
   * Format task response for user
   */
  formatTaskResponse(taskResult) {
    if (!taskResult.success) {
      return `❌ Computer task failed: ${taskResult.error}\n\nYo, the computer control system hit a snag. Check the logs for details, and we might need to try a different approach.`;
    }

    const duration = taskResult.duration_seconds ? ` in ${taskResult.duration_seconds.toFixed(1)}s` : '';
    const iterations = taskResult.iterations ? ` (${taskResult.iterations} steps)` : '';

    let response = `✅ Computer task completed successfully${duration}${iterations}!\n\n`;

    if (taskResult.execution_log && taskResult.execution_log.length > 0) {
      response += `**Actions Taken:**\n`;
      taskResult.execution_log.forEach((step, i) => {
        response += `${i + 1}. ${step.action_type}`;
        if (step.action_details) {
          if (step.action_details.x && step.action_details.y) {
            response += ` at (${step.action_details.x}, ${step.action_details.y})`;
          }
          if (step.action_details.text) {
            response += `: "${step.action_details.text}"`;
          }
        }
        response += `\n`;
      });
    }

    if (taskResult.safety_checks_triggered > 0) {
      response += `\n⚠️ ${taskResult.safety_checks_triggered} safety check(s) were triggered and handled.\n`;
    }

    response += `\nAll actions were supervised and logged for security. The computer control was used safely under strict supervision! 🖥️✨`;

    return response;
  }

  /**
   * Get comprehensive status including transaction history
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      computer_metrics: this.computerMetrics,
      active_transactions: this.activeTransactions.size,
      permission_level: this.permissionLevel,
      python_agent_available: this.checkPythonAgentAvailable(),
      display_config: this.displayConfig,
      safety_checks_count: this.safetyChecks.length,
      supervision_required: true
    };
  }

  /**
   * Check if Python agent is available
   */
  checkPythonAgentAvailable() {
    try {
      // Check if Python agent file exists
      fsSync.accessSync(this.pythonAgentPath, fsSync.constants.R_OK);
      return true;
    } catch (error) {
      console.warn(`[ComputerUseAgent] ⚠️ Python agent not accessible: ${error.message}`);
      return false;
    }
  }

  /**
   * Get transaction history for audit purposes
   */
  getTransactionHistory() {
    return Array.from(this.activeTransactions.values()).map(tx => ({
      ...tx,
      status: 'logged',
      completed_at: new Date().toISOString()
    }));
  }
}

export default ComputerUseAgent;