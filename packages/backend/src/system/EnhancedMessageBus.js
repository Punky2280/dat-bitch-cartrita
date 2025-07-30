// packages/backend/src/system/EnhancedMessageBus.js

/**
 * Enhanced MessageBus with Multi-Agent Communication Protocol (MCP)
 * 
 * This replaces the basic MessageBus with a sophisticated communication system
 * that supports agent registration, message routing, health monitoring, and
 * protocol validation.
 */

const EventEmitter = require('events');
const MCPMessage = require('./protocols/MCPMessage');

class EnhancedMessageBus extends EventEmitter {
  constructor() {
    super();
    
    // Agent registry
    this.agents = new Map(); // agentId -> agent metadata
    this.messageQueue = new Map(); // messageId -> message
    this.messageHistory = []; // Recent messages for debugging
    this.maxHistorySize = 1000;
    
    // Performance metrics
    this.metrics = {
      messages_sent: 0,
      messages_delivered: 0,
      messages_failed: 0,
      agents_registered: 0,
      agents_active: 0,
      uptime_start: Date.now()
    };
    
    // Health monitoring
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    
    this.initialized = true;
    console.log('✅ Enhanced MessageBus with MCP initialized');
    
    // Register the MessageBus system agent
    this.registerAgent('MessageBus.system', {
      capabilities: ['system_management', 'message_routing', 'health_monitoring'],
      version: '1.0.0',
      type: 'system'
    });
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Register an agent with the message bus
   */
  registerAgent(agentId, metadata = {}) {
    try {
      // Check if agent is already registered
      if (this.agents.has(agentId)) {
        console.log(`[MCP] Agent ${agentId} already registered, updating metadata`);
        const existingAgent = this.agents.get(agentId);
        existingAgent.metadata = { ...existingAgent.metadata, ...metadata };
        existingAgent.last_heartbeat = new Date().toISOString();
        existingAgent.status = 'active';
        return true;
      }
      
      // Validate agent ID format
      new MCPMessage({ type: 'AGENT_REGISTER', sender: agentId });
      
      const agentInfo = {
        id: agentId,
        registered_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        status: 'active',
        capabilities: metadata.capabilities || [],
        version: metadata.version || '1.0.0',
        metadata: metadata
      };
      
      this.agents.set(agentId, agentInfo);
      this.metrics.agents_registered++;
      this.metrics.agents_active++;
      
      console.log(`[MCP] Agent registered: ${agentId}`);
      
      // Broadcast agent registration (but don't recurse)
      if (agentId !== 'MessageBus.system') {
        this.broadcast(new MCPMessage({
          type: 'AGENT_REGISTER',
          sender: 'MessageBus.system',
          payload: { agent: agentInfo }
        }));
      }
      
      return true;
    } catch (error) {
      console.error(`[MCP] Agent registration failed for ${agentId}:`, error.message);
      return false;
    }
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    if (this.agents.has(agentId)) {
      this.agents.delete(agentId);
      this.metrics.agents_active--;
      
      console.log(`[MCP] Agent unregistered: ${agentId}`);
      
      // Broadcast agent unregistration
      this.broadcast(new MCPMessage({
        type: 'AGENT_UNREGISTER',
        sender: 'MessageBus.system',
        payload: { agentId }
      }));
      
      return true;
    }
    return false;
  }

  /**
   * Update agent heartbeat
   */
  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.last_heartbeat = new Date().toISOString();
      agent.status = 'active';
      return true;
    }
    return false;
  }

  /**
   * Send a message using MCP protocol
   */
  sendMessage(message) {
    if (!(message instanceof MCPMessage)) {
      throw new Error('Message must be an instance of MCPMessage');
    }

    // Validate sender is registered (except system messages)
    if (!message.sender.includes('system') && !this.agents.has(message.sender)) {
      throw new Error(`Sender ${message.sender} is not registered`);
    }

    // Check if message has expired
    if (message.isExpired()) {
      console.warn(`[MCP] Message ${message.id} expired before sending`);
      this.metrics.messages_failed++;
      return false;
    }

    // Add to message queue for tracking
    this.messageQueue.set(message.id, message);
    
    // Add to history
    this.addToHistory(message);
    
    // Route message
    try {
      if (message.recipient) {
        // Direct message
        this.routeDirectMessage(message);
      } else {
        // Broadcast message
        this.routeBroadcastMessage(message);
      }
      
      this.metrics.messages_sent++;
      return true;
    } catch (error) {
      console.error(`[MCP] Failed to send message ${message.id}:`, error.message);
      message.fail(error.message);
      this.metrics.messages_failed++;
      return false;
    }
  }

  /**
   * Route a direct message to specific recipient
   */
  routeDirectMessage(message) {
    const recipient = this.agents.get(message.recipient);
    
    if (!recipient) {
      throw new Error(`Recipient ${message.recipient} not found`);
    }
    
    if (recipient.status !== 'active') {
      throw new Error(`Recipient ${message.recipient} is not active`);
    }
    
    // Emit message to specific agent
    this.emit(`mcp:message:${message.recipient}`, message);
    this.emit('mcp:message', message);
    
    console.log(`[MCP] Routed message ${message.id.slice(0, 8)} to ${message.recipient}`);
    this.metrics.messages_delivered++;
  }

  /**
   * Route a broadcast message to all agents
   */
  routeBroadcastMessage(message) {
    let delivered = 0;
    
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'active' && agentId !== message.sender) {
        this.emit(`mcp:message:${agentId}`, message);
        delivered++;
      }
    }
    
    // Also emit general broadcast event
    this.emit('mcp:broadcast', message);
    
    console.log(`[MCP] Broadcast message ${message.id.slice(0, 8)} to ${delivered} agents`);
    this.metrics.messages_delivered += delivered;
  }

  /**
   * Broadcast a message to all agents
   */
  broadcast(message) {
    if (!(message instanceof MCPMessage)) {
      message = new MCPMessage({
        type: 'BROADCAST',
        sender: 'MessageBus.system',
        payload: message
      });
    }
    
    return this.sendMessage(message);
  }

  /**
   * Send a task request with MCP protocol
   */
  sendTaskRequest(type, payload, sender, priority = 'normal') {
    const message = new MCPMessage({
      type: 'TASK_REQUEST',
      sender,
      payload: {
        task_type: type,
        ...payload
      },
      priority
    });
    
    return this.sendMessage(message);
  }

  /**
   * Add message to history for debugging
   */
  addToHistory(message) {
    this.messageHistory.push({
      ...message.getSummary(),
      timestamp: message.timestamp,
      payload_size: JSON.stringify(message.payload).length
    });
    
    // Keep history size manageable
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  /**
   * Start health monitoring for registered agents
   */
  startHealthMonitoring() {
    this.heartbeatTimer = setInterval(() => {
      this.checkAgentHealth();
    }, this.heartbeatInterval);
  }

  /**
   * Check health of all registered agents
   */
  checkAgentHealth() {
    const now = Date.now();
    const staleThreshold = this.heartbeatInterval * 2; // 60 seconds
    
    for (const [agentId, agent] of this.agents) {
      const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
      const age = now - lastHeartbeat;
      
      if (age > staleThreshold && agent.status === 'active') {
        console.warn(`[MCP] Agent ${agentId} appears stale (last heartbeat: ${Math.round(age/1000)}s ago)`);
        agent.status = 'stale';
        
        // Emit health alert
        this.broadcast(new MCPMessage({
          type: 'SYSTEM_ALERT',
          sender: 'MessageBus.system',
          payload: {
            alert_type: 'agent_stale',
            agentId,
            last_heartbeat: agent.last_heartbeat,
            age_seconds: Math.round(age / 1000)
          }
        }));
      }
    }
  }

  /**
   * Get system status and metrics
   */
  getStatus() {
    const now = Date.now();
    const uptime = now - this.metrics.uptime_start;
    
    return {
      service: 'EnhancedMessageBus',
      protocol_version: '1.0.0',
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
      uptime_ms: uptime,
      uptime_human: this.formatUptime(uptime),
      agents: {
        registered: this.agents.size,
        active: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
        stale: Array.from(this.agents.values()).filter(a => a.status === 'stale').length
      },
      metrics: {
        ...this.metrics,
        messages_per_minute: this.metrics.messages_sent / (uptime / 60000),
        message_queue_size: this.messageQueue.size,
        history_size: this.messageHistory.length
      },
      listeners: this.listenerCount()
    };
  }

  /**
   * Get list of registered agents
   */
  getAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Get recent message history
   */
  getMessageHistory(limit = 50) {
    return this.messageHistory.slice(-limit);
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Clean up expired messages and stale data
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // Remove expired messages from queue
    for (const [messageId, message] of this.messageQueue) {
      if (message.isExpired()) {
        this.messageQueue.delete(messageId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[MCP] Cleaned up ${cleaned} expired messages`);
    }
  }

  /**
   * Shutdown the message bus
   */
  shutdown() {
    console.log('[MCP] Shutting down Enhanced MessageBus...');
    
    // Notify all agents
    this.broadcast(new MCPMessage({
      type: 'SYSTEM_SHUTDOWN',
      sender: 'MessageBus.system',
      payload: { reason: 'System shutdown initiated' }
    }));
    
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Clear data
    this.agents.clear();
    this.messageQueue.clear();
    this.messageHistory = [];
    
    this.initialized = false;
    console.log('[MCP] Enhanced MessageBus shutdown complete');
  }

  /**
   * Legacy compatibility - emit events the old way
   */
  legacyEmit(event, data) {
    console.warn(`[MCP] Legacy emit used: ${event}. Consider upgrading to MCP protocol.`);
    this.emit(event, data);
  }
}

module.exports = new EnhancedMessageBus();