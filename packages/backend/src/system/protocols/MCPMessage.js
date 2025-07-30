// packages/backend/src/system/protocols/MCPMessage.js

/**
 * Multi-Agent Communication Protocol (MCP) Message Structure
 * 
 * This defines the standardized message format for all inter-agent communication
 * in the Cartrita AGI system. Every message must conform to this schema.
 */

const { v4: uuidv4 } = require('uuid');

class MCPMessage {
  constructor({
    type,
    sender,
    recipient = null,
    payload = {},
    priority = 'normal',
    metadata = {}
  }) {
    // Message identification
    this.id = uuidv4();
    this.timestamp = new Date().toISOString();
    
    // Message routing
    this.type = this.validateMessageType(type);
    this.sender = this.validateAgentId(sender);
    this.recipient = recipient; // null for broadcast messages
    
    // Message content
    this.payload = payload;
    this.priority = this.validatePriority(priority);
    
    // Protocol metadata
    this.protocol_version = '1.0.0';
    this.metadata = {
      ...metadata,
      created_at: this.timestamp,
      ttl: metadata.ttl || 30000, // 30 second default TTL
    };
    
    // Message status tracking
    this.status = 'pending';
    this.retries = 0;
    this.max_retries = 3;
  }

  validateMessageType(type) {
    const validTypes = [
      // Task management
      'TASK_REQUEST',
      'TASK_ACCEPT',
      'TASK_REJECT', 
      'TASK_PROGRESS',
      'TASK_COMPLETE',
      'TASK_FAIL',
      
      // Agent lifecycle
      'AGENT_REGISTER',
      'AGENT_UNREGISTER',
      'AGENT_HEARTBEAT',
      'AGENT_STATUS',
      
      // Communication
      'BROADCAST',
      'DIRECT_MESSAGE',
      'QUERY',
      'RESPONSE',
      
      // System events
      'SYSTEM_ALERT',
      'SYSTEM_SHUTDOWN',
      'PROTOCOL_ERROR'
    ];
    
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid message type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    return type;
  }

  validateAgentId(agentId) {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('Agent ID must be a non-empty string');
    }
    
    // Agent ID format: AgentType.instance (e.g., "CoreAgent.main", "CodeWriter.001")
    // Also allow system agents like "MessageBus.system", "API.test"
    const agentIdRegex = /^[A-Za-z]+[A-Za-z]*\.[a-zA-Z0-9_-]+$/;
    if (!agentIdRegex.test(agentId)) {
      throw new Error(`Invalid agent ID format: ${agentId}. Expected format: AgentType.instance`);
    }
    
    return agentId;
  }

  validatePriority(priority) {
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}. Must be one of: ${validPriorities.join(', ')}`);
    }
    return priority;
  }

  // Mark message as acknowledged
  acknowledge() {
    this.status = 'acknowledged';
    this.metadata.acknowledged_at = new Date().toISOString();
  }

  // Mark message as completed
  complete(result = null) {
    this.status = 'completed';
    this.metadata.completed_at = new Date().toISOString();
    if (result) {
      this.metadata.result = result;
    }
  }

  // Mark message as failed
  fail(error) {
    this.status = 'failed';
    this.metadata.failed_at = new Date().toISOString();
    this.metadata.error = error;
  }

  // Check if message has expired
  isExpired() {
    const now = Date.now();
    const created = new Date(this.timestamp).getTime();
    return (now - created) > this.metadata.ttl;
  }

  // Check if message can be retried
  canRetry() {
    return this.retries < this.max_retries && this.status === 'failed';
  }

  // Increment retry count
  retry() {
    if (!this.canRetry()) {
      throw new Error('Message cannot be retried');
    }
    this.retries++;
    this.status = 'pending';
    this.metadata.last_retry = new Date().toISOString();
  }

  // Serialize message for transmission
  serialize() {
    return JSON.stringify(this);
  }

  // Deserialize message from JSON
  static deserialize(json) {
    try {
      const data = JSON.parse(json);
      return Object.assign(new MCPMessage({
        type: data.type,
        sender: data.sender,
        recipient: data.recipient,
        payload: data.payload,
        priority: data.priority,
        metadata: data.metadata
      }), data);
    } catch (error) {
      throw new Error(`Failed to deserialize MCP message: ${error.message}`);
    }
  }

  // Create a response message
  createResponse(sender, payload, type = 'RESPONSE') {
    return new MCPMessage({
      type,
      sender,
      recipient: this.sender,
      payload,
      metadata: {
        ...this.metadata,
        response_to: this.id,
        original_type: this.type
      }
    });
  }

  // Get message summary for logging
  getSummary() {
    return {
      id: this.id.slice(0, 8),
      type: this.type,
      sender: this.sender,
      recipient: this.recipient || 'broadcast',
      status: this.status,
      priority: this.priority,
      age_ms: Date.now() - new Date(this.timestamp).getTime()
    };
  }
}

module.exports = MCPMessage;