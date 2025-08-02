// packages/backend/src/system/BaseAgent.js

const MCPMessage = require('./protocols/MCPMessage');
const MessageBus = require('./EnhancedMessageBus');
const OpenAI = require('openai');

// --- Constants and Enums ---

/**
 * Defines the possible operational states of an agent.
 * @enum {string}
 */
const AGENT_STATES = {
  INITIALIZING: 'initializing',
  IDLE: 'idle',
  BUSY: 'busy',
  PROCESSING_LLM: 'processing_llm',
  ERROR: 'error',
  SHUTDOWN: 'shutdown',
};

/**
 * Estimated cost per 1 million tokens for gpt-4o (as of mid-2024).
 * Used for financial analytics of agent operations.
 */
const GPT4O_COST_PER_MILLION_TOKENS = {
  INPUT: 5.00,
  OUTPUT: 15.00,
};

// --- Custom Error Classes for Richer Error Handling ---

/**
 * Thrown when an agent receives a task it is not configured to handle.
 */
class TaskNotSupportedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TaskNotSupportedError';
  }
}

/**
 * Thrown when a task fails during execution for reasons other than non-support.
 */
class TaskExecutionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TaskExecutionError';
    this.originalError = originalError;
  }
}


/**
 * A structured logger for consistent, machine-parseable logs.
 */
class StructuredLogger {
  constructor(agentId) {
    this.agentId = agentId;
  }

  _log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      agent: this.agentId,
      message,
      ...context,
    };
    console.log(JSON.stringify(logEntry));
  }

  info(message, context) {
    this._log('info', message, context);
  }

  warn(message, context) {
    this._log('warn', message, context);
  }

  error(message, error, context) {
    const errorContext = {
      ...context,
      error_message: error.message,
      error_stack: error.stack,
    };
    this._log('error', message, errorContext);
  }

  debug(message, context) {
    if (process.env.NODE_ENV === 'development') {
      this._log('debug', message, context);
    }
  }
}


/**
 * Base Agent Class v2.0 - The foundational SDK for all agents in the system.
 */
class BaseAgent {
  constructor(agentType, instanceId = 'main', capabilities = [], config = {}) {
    this.agentType = agentType;
    this.instanceId = instanceId;
    this.agentId = `${agentType}.${instanceId}`;
    this.capabilities = new Set(capabilities);
    this.state = AGENT_STATES.INITIALIZING;
    this.logger = new StructuredLogger(this.agentId);
    
    this.config = {
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
      defaultMaxTokens: 4096,
      heartbeatIntervalMs: 30000,
      taskProcessingTimeoutMs: 120000,
      ...config,
    };

    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    this.metadata = { version: '2.2.0', created_at: new Date().toISOString(), tasks_completed: 0, tasks_failed: 0, last_activity: null };
    this.messageHandlers = new Map();
    this.taskHandlers = new Map();
    this.taskMiddleware = [];
    this.heartbeatInterval = null;
    this.metrics = { messages_received: 0, messages_sent: 0, tasks_processed: 0, average_response_time_ms: 0, errors: 0, total_tokens_used: { input: 0, output: 0, total: 0 }, estimated_cost_usd: 0 };
    
    this.initialize();
  }

  async initialize() {
    try {
      const agentData = this.getAgentRegistrationData();
      if (!MessageBus.registerAgent(this.agentId, agentData)) {
        throw new Error(`Failed to register agent ${this.agentId}`);
      }
      
      this.setupMessageHandlers();
      this.setupDefaultMiddleware();
      this.startHeartbeat();
      await this.onInitialize();
      this.setState(AGENT_STATES.IDLE);
      this.logger.info(`Agent v${this.metadata.version} initialized and ready.`);
    } catch (error) {
      this.setState(AGENT_STATES.ERROR);
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }

  setState(newState) {
    if (this.state === newState || !Object.values(AGENT_STATES).includes(newState)) return;
    this.state = newState;
    // FIX: Use the MCP broadcast method for system-wide state updates instead of legacy emit.
    MessageBus.broadcast(new MCPMessage({
        type: 'AGENT_STATE_CHANGED',
        sender: this.agentId,
        payload: { agentId: this.agentId, state: this.state }
    }));
    this.logger.debug(`State changed to: ${newState}`);
  }

  setupMessageHandlers() {
    MessageBus.on(`mcp:message:${this.agentId}`, (message) => this.handleMessage(message));
    MessageBus.on('mcp:broadcast', (message) => this.handleBroadcast(message));
    
    this.registerMessageHandler('TASK_REQUEST', this.handleTaskRequest.bind(this));
    this.registerMessageHandler('QUERY', this.handleQuery.bind(this));
    this.registerMessageHandler('AGENT_REGISTER', this.handleAgentRegister.bind(this));
    this.registerMessageHandler('SYSTEM_ALERT', this.handleSystemAlert.bind(this));
  }

  async handleBroadcast(message) {
    if (message.sender === this.agentId) return;
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else if (!['AGENT_REGISTER', 'AGENT_UNREGISTER', 'HEARTBEAT', 'AGENT_STATE_CHANGED'].includes(message.type)) {
      this.logger.warn(`No handler for broadcast message type: ${message.type}`, { messageId: message.id });
    }
  }

  async handleAgentRegister(message) {
    const { agent } = message.payload;
    this.logger.debug(`New agent registered: ${agent.id}`, { capabilities: agent.capabilities, version: agent.version });
  }

  async handleSystemAlert(message) {
    const { alert_type, severity, details } = message.payload;
    const logMessage = details?.message || 'No details provided';
    switch (severity) {
      case 'critical':
      case 'error':
        this.logger.error(`System Alert [${alert_type}]: ${logMessage}`, details); break;
      case 'warning':
        this.logger.warn(`System Alert [${alert_type}]: ${logMessage}`, details); break;
      default:
        this.logger.debug(`System Alert [${alert_type}]: ${logMessage}`, details); break;
    }
    await this.onSystemAlert(alert_type, severity, details);
  }

  setupDefaultMiddleware() {
    this.use(async (task, next) => {
      this.logger.info('Task processing started', { task_type: task.task_type, taskId: task.id });
      await next();
      this.logger.info('Task processing finished', { task_type: task.task_type, taskId: task.id });
    });
    this.use(async (task, next) => {
      this.setState(AGENT_STATES.BUSY);
      try {
        await next();
      } catch (error) {
        this.setState(AGENT_STATES.ERROR);
        throw error;
      }
    });
  }

  use(middlewareFn) { this.taskMiddleware.push(middlewareFn); }
  registerMessageHandler(messageType, handler) { this.messageHandlers.set(messageType, handler); }
  registerTaskHandler({ taskType, handler, permissions = [] }) {
    this.taskHandlers.set(taskType, { handler, permissions });
  }

  async handleMessage(message) {
    this.metrics.messages_received++;
    this.updateLastActivity();
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      this.logger.warn(`No handler for message type: ${message.type}`, { messageId: message.id });
    }
  }

  async handleTaskRequest(message) {
    const task = message.payload;
    const taskRegistration = this.taskHandlers.get(task.task_type);

    if (!taskRegistration) {
      this.sendResponse(message, { error: `Task type '${task.task_type}' not supported.` }, 'TASK_FAIL');
      // FIX: Ensure state is reset even on early exit.
      this.setState(AGENT_STATES.IDLE);
      return;
    }

    const executePipeline = (index) => {
      if (index >= this.taskMiddleware.length) {
        return taskRegistration.handler(task.prompt, task);
      }
      return this.taskMiddleware[index](task, () => executePipeline(index + 1));
    };

    try {
      await this.onTaskStart(task.task_type, task);
      const result = await executePipeline(0);
      this.sendResponse(message, { content: result }, 'TASK_COMPLETE');
      this.metadata.tasks_completed++;
      await this.onTaskSuccess(task.task_type, result);
    } catch (error) {
      this.logger.error(`Task execution failed for '${task.task_type}'`, error, { taskId: task.id });
      this.metadata.tasks_failed++;
      this.sendResponse(message, { error: error.message }, 'TASK_FAIL');
      await this.onTaskFailure(task.task_type, error);
    } finally {
      // FIX: This block ensures the agent ALWAYS returns to IDLE after a task,
      // preventing the "stuck in error state" deadlock.
      this.setState(AGENT_STATES.IDLE);
    }
  }

  async checkPermissions(userId, requiredPermissions) {
    this.logger.debug('Permission check passed (mock)', { userId, requiredPermissions });
    return true;
  }

  async handleQuery(message) { this.sendResponse(message, this.getStatus()); }
  sendResponse(originalMessage, payload, type = 'RESPONSE') {
    const response = originalMessage.createResponse(this.agentId, payload, type);
    MessageBus.sendMessage(response);
    this.metrics.messages_sent++;
  }

  async request(recipientAgentId, task_type, payload) {
    this.logger.debug(`Requesting task '${task_type}' from ${recipientAgentId}`, { recipientAgentId });
    return new Promise((resolve, reject) => {
        const message = new MCPMessage({ type: 'TASK_REQUEST', sender: this.agentId, recipient: recipientAgentId, payload: { task_type, ...payload } });
        const timeoutId = setTimeout(() => {
            MessageBus.removeListener(`mcp:message:${this.agentId}`, responseHandler);
            reject(new Error(`Request to ${recipientAgentId} timed out.`));
        }, this.config.taskProcessingTimeoutMs);
        const responseHandler = (response) => {
            if (response.metadata?.response_to === message.id) {
                clearTimeout(timeoutId);
                MessageBus.removeListener(`mcp:message:${this.agentId}`, responseHandler);
                if (response.type === 'TASK_COMPLETE') {
                    resolve(response.payload.content);
                } else {
                    reject(new TaskExecutionError(response.payload.error));
                }
            }
        };
        MessageBus.on(`mcp:message:${this.agentId}`, responseHandler);
        MessageBus.sendMessage(message);
        this.metrics.messages_sent++;
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      MessageBus.heartbeat(this.agentId, this.getStatus());
    }, this.config.heartbeatIntervalMs);
  }

  updateLastActivity() { this.metadata.last_activity = new Date().toISOString(); }
  getStatus() {
    return { agentId: this.agentId, state: this.state, capabilities: [...this.capabilities], metrics: { ...this.metrics, estimated_cost_usd: parseFloat(this.metrics.estimated_cost_usd.toFixed(6)) }, timestamp: new Date().toISOString() };
  }
  getAgentRegistrationData() {
    return { id: this.agentId, type: this.agentType, instance: this.instanceId, capabilities: [...this.capabilities], version: this.metadata.version, state: this.state };
  }

  async createCompletion(messages, options = {}) {
    if (!this.openai.apiKey) throw new Error('OpenAI API key not available');
    this.setState(AGENT_STATES.PROCESSING_LLM);
    this.logger.debug('Sending request to OpenAI', { model: this.config.defaultModel, messageCount: messages.length });
    try {
      const response = await this.openai.chat.completions.create({ model: this.config.defaultModel, messages, ...options });
      if (response.usage) {
        const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
        this.metrics.total_tokens_used.input += prompt_tokens;
        this.metrics.total_tokens_used.output += completion_tokens;
        this.metrics.total_tokens_used.total += total_tokens;
        const inputCost = (prompt_tokens / 1000000) * GPT4O_COST_PER_MILLION_TOKENS.INPUT;
        const outputCost = (completion_tokens / 1000000) * GPT4O_COST_PER_MILLION_TOKENS.OUTPUT;
        this.metrics.estimated_cost_usd += inputCost + outputCost;
        this.logger.debug('OpenAI call successful', { tokensUsed: total_tokens, estimatedCost: inputCost + outputCost });
      }
      this.setState(AGENT_STATES.BUSY);
      return response.choices[0].message.content.trim();
    } catch (error) {
        this.setState(AGENT_STATES.ERROR);
        this.logger.error('OpenAI API call failed', error);
        throw error;
    }
  }

  // --- Lifecycle Hooks ---
  async onInitialize() {}
  async onShutdown() {}
  async onTaskStart(taskType, payload) {}
  async onTaskSuccess(taskType, result) {}
  async onTaskFailure(taskType, error) {}
  async onSystemAlert(alertType, severity, details) {}
}

module.exports = BaseAgent;