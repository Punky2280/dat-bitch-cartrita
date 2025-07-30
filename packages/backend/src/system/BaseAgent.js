// packages/backend/src/system/BaseAgent.js

/**
 * Base Agent Class for Multi-Agent Communication Protocol (MCP)
 * 
 * All agents in the Cartrita AGI system should extend this base class
 * to ensure consistent MCP integration, health monitoring, and 
 * standardized communication patterns.
 */

const MCPMessage = require('./protocols/MCPMessage');
const MessageBus = require('./EnhancedMessageBus');
const OpenAI = require('openai');

class BaseAgent {
  constructor(agentType, instanceId = 'main', capabilities = []) {
    this.agentType = agentType;
    this.instanceId = instanceId;
    this.agentId = `${agentType}.${instanceId}`;
    this.capabilities = capabilities;
    this.status = 'initializing';
    
    // OpenAI client (shared across agents)
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Agent metadata
    this.metadata = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      capabilities: this.capabilities,
      tasks_completed: 0,
      tasks_failed: 0,
      last_activity: new Date().toISOString()
    };
    
    // Message handling
    this.messageHandlers = new Map();
    this.taskHandlers = new Map();
    this.heartbeatInterval = null;
    
    // Performance metrics
    this.metrics = {
      messages_received: 0,
      messages_sent: 0,
      tasks_processed: 0,
      average_response_time: 0,
      errors: 0
    };
    
    // Initialize agent
    this.initialize();
  }

  /**
   * Initialize the agent with MCP registration and event handling
   */
  async initialize() {
    try {
      // Register with MessageBus
      const registered = MessageBus.registerAgent(this.agentId, {
        capabilities: this.capabilities,
        version: this.metadata.version,
        type: this.agentType,
        instance: this.instanceId
      });
      
      if (!registered) {
        throw new Error(`Failed to register agent ${this.agentId}`);
      }
      
      // Set up message listeners
      this.setupMessageHandlers();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Call agent-specific initialization
      await this.onInitialize();
      
      this.status = 'active';
      console.log(`[${this.agentId}] Agent initialized and ready`);
      
    } catch (error) {
      console.error(`[${this.agentId}] Initialization failed:`, error.message);
      this.status = 'failed';
      throw error;
    }
  }

  /**
   * Set up MCP message handlers
   */
  setupMessageHandlers() {
    // Listen for messages directed to this agent
    MessageBus.on(`mcp:message:${this.agentId}`, (message) => {
      this.handleMessage(message);
    });
    
    // Listen for broadcast messages
    MessageBus.on('mcp:broadcast', (message) => {
      if (message.sender !== this.agentId) {
        this.handleBroadcast(message);
      }
    });
    
    // Set up default message handlers
    this.registerMessageHandler('TASK_REQUEST', this.handleTaskRequest.bind(this));
    this.registerMessageHandler('DIRECT_MESSAGE', this.handleDirectMessage.bind(this));
    this.registerMessageHandler('QUERY', this.handleQuery.bind(this));
    this.registerMessageHandler('AGENT_REGISTER', this.handleAgentRegister.bind(this));
    this.registerMessageHandler('AGENT_UNREGISTER', this.handleAgentUnregister.bind(this));
    this.registerMessageHandler('SYSTEM_SHUTDOWN', this.handleSystemShutdown.bind(this));
  }

  /**
   * Register a handler for a specific message type
   */
  registerMessageHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Register a handler for a specific task type
   */
  registerTaskHandler(taskType, handler) {
    this.taskHandlers.set(taskType, handler);
  }

  /**
   * Handle incoming MCP messages
   */
  async handleMessage(message) {
    this.metrics.messages_received++;
    this.updateLastActivity();
    
    const startTime = Date.now();
    
    try {
      console.log(`[${this.agentId}] Received ${message.type} message from ${message.sender}`);
      
      // Acknowledge message receipt
      message.acknowledge();
      
      // Route to appropriate handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        await handler(message);
      } else {
        console.warn(`[${this.agentId}] No handler for message type: ${message.type}`);
        this.sendResponse(message, { error: `No handler for message type: ${message.type}` });
      }
      
      // Update response time metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      
    } catch (error) {
      console.error(`[${this.agentId}] Error handling message:`, error.message);
      this.metrics.errors++;
      
      // Send error response
      this.sendResponse(message, { error: error.message }, 'TASK_FAIL');
    }
  }

  /**
   * Handle broadcast messages
   */
  async handleBroadcast(message) {
    // Default: only log broadcast messages
    console.log(`[${this.agentId}] Received broadcast: ${message.type} from ${message.sender}`);
  }

  /**
   * Handle task requests
   */
  async handleTaskRequest(message) {
    const { task_type, prompt, language = 'en', userId } = message.payload;
    
    console.log(`[${this.agentId}] Processing task: ${task_type}`);
    
    // Check if we can handle this task type
    const taskHandler = this.taskHandlers.get(task_type);
    if (!taskHandler) {
      throw new Error(`Task type ${task_type} not supported by ${this.agentId}`);
    }
    
    try {
      // Execute the task
      const result = await taskHandler(prompt, language, userId, message.payload);
      
      // Send completion response
      this.sendResponse(message, { text: result }, 'TASK_COMPLETE');
      
      this.metadata.tasks_completed++;
      this.metrics.tasks_processed++;
      
    } catch (error) {
      console.error(`[${this.agentId}] Task execution failed:`, error.message);
      this.metadata.tasks_failed++;
      this.sendResponse(message, { error: error.message }, 'TASK_FAIL');
    }
  }

  /**
   * Handle direct messages
   */
  async handleDirectMessage(message) {
    // Default implementation - override in subclasses
    console.log(`[${this.agentId}] Received direct message:`, message.payload);
  }

  /**
   * Handle query messages
   */
  async handleQuery(message) {
    const { query_type } = message.payload;
    
    switch (query_type) {
      case 'status':
        this.sendResponse(message, this.getStatus());
        break;
      case 'capabilities':
        this.sendResponse(message, { capabilities: this.capabilities });
        break;
      case 'metrics':
        this.sendResponse(message, this.metrics);
        break;
      default:
        this.sendResponse(message, { error: `Unknown query type: ${query_type}` });
    }
  }

  /**
   * Handle agent registration notifications
   */
  async handleAgentRegister(message) {
    const { agent } = message.payload;
    console.log(`[${this.agentId}] New agent registered: ${agent.id}`);
  }

  /**
   * Handle agent unregistration notifications
   */
  async handleAgentUnregister(message) {
    const { agentId } = message.payload;
    console.log(`[${this.agentId}] Agent unregistered: ${agentId}`);
  }

  /**
   * Handle system shutdown
   */
  async handleSystemShutdown(message) {
    console.log(`[${this.agentId}] Received shutdown signal`);
    await this.shutdown();
  }

  /**
   * Send a response message
   */
  sendResponse(originalMessage, payload, type = 'RESPONSE') {
    const response = originalMessage.createResponse(this.agentId, payload, type);
    MessageBus.sendMessage(response);
    this.metrics.messages_sent++;
  }

  /**
   * Send a message to another agent
   */
  sendMessage(recipient, payload, type = 'DIRECT_MESSAGE', priority = 'normal') {
    const message = new MCPMessage({
      type,
      sender: this.agentId,
      recipient,
      payload,
      priority
    });
    
    MessageBus.sendMessage(message);
    this.metrics.messages_sent++;
    return message;
  }

  /**
   * Broadcast a message to all agents
   */
  broadcast(payload, type = 'BROADCAST', priority = 'normal') {
    const message = new MCPMessage({
      type,
      sender: this.agentId,
      payload,
      priority
    });
    
    MessageBus.sendMessage(message);
    this.metrics.messages_sent++;
    return message;
  }

  /**
   * Start sending heartbeat signals
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      MessageBus.heartbeat(this.agentId);
    }, 15000); // Every 15 seconds
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity() {
    this.metadata.last_activity = new Date().toISOString();
  }

  /**
   * Update response time metrics
   */
  updateResponseTimeMetrics(responseTime) {
    if (this.metrics.average_response_time === 0) {
      this.metrics.average_response_time = responseTime;
    } else {
      this.metrics.average_response_time = 
        (this.metrics.average_response_time + responseTime) / 2;
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      type: this.agentType,
      instance: this.instanceId,
      status: this.status,
      capabilities: this.capabilities,
      metadata: this.metadata,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * OpenAI helper method for completions
   */
  async createCompletion(messages, options = {}) {
    if (!this.openai.apiKey) {
      throw new Error('OpenAI API key not available');
    }
    
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      ...options
    });
    
    return response.choices[0].message.content.trim();
  }

  /**
   * Agent-specific initialization override point
   */
  async onInitialize() {
    // Override in subclasses
  }

  /**
   * Agent-specific shutdown override point
   */
  async onShutdown() {
    // Override in subclasses
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    console.log(`[${this.agentId}] Shutting down...`);
    
    this.status = 'shutting_down';
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Call agent-specific shutdown
    await this.onShutdown();
    
    // Unregister from MessageBus
    MessageBus.unregisterAgent(this.agentId);
    
    this.status = 'shutdown';
    console.log(`[${this.agentId}] Shutdown complete`);
  }
}

module.exports = BaseAgent;