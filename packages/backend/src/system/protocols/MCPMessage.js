// packages/backend/src/system/protocols/MCPMessage.js

/**
 * Multi-Agent Communication Protocol (MCP) Message Structure
 * This defines the standardized message format for all inter-agent communication
 * in the Cartrita AGI system. Every message must conform to this schema.
 */

import { v4 as uuidv4 } from 'uuid';

class MCPMessage {
  constructor({ type, sender, recipient = null, payload = {}, priority = 'normal', metadata = {} }) {
    // Generate unique message ID
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
    this.max_retries = metadata.max_retries || 3;
  }

  /**
   * Validate message type
   */
  validateMessageType(type) {
    const validTypes = [
      'TASK_REQUEST',
      'TASK_RESPONSE', 
      'TASK_COMPLETE',
      'TASK_FAIL',
      'QUERY',
      'RESPONSE',
      'AGENT_REGISTER',
      'AGENT_UNREGISTER',
      'HEARTBEAT',
      'SYSTEM_ALERT',
      'AGENT_STATE_CHANGED',
      'BROADCAST'
    ];

    if (!type || !validTypes.includes(type)) {
      throw new Error(`Invalid message type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    return type;
  }

  /**
   * Validate agent ID format
   */
  validateAgentId(agentId) {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('Agent ID must be a non-empty string');
    }

    // Basic format validation: should follow pattern like "AgentType.instance"
    if (!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?$/.test(agentId)) {
      throw new Error(`Invalid agent ID format: ${agentId}. Must follow pattern: AgentType.instance`);
    }

    return agentId;
  }

  /**
   * Validate priority level
   */
  validatePriority(priority) {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}. Must be one of: ${validPriorities.join(', ')}`);
    }

    return priority;
  }

  /**
   * Create a response message to this message
   */
  createResponse(sender, payload, type = 'RESPONSE') {
    return new MCPMessage({
      type: type,
      sender: sender,
      recipient: this.sender,
      payload: payload,
      priority: this.priority,
      metadata: {
        ...this.metadata,
        response_to: this.id,
        conversation_id: this.metadata.conversation_id || this.id
      }
    });
  }

  /**
   * Mark message as delivered
   */
  markDelivered() {
    this.status = 'delivered';
    this.metadata.delivered_at = new Date().toISOString();
  }

  /**
   * Mark message as failed
   */
  markFailed(error) {
    this.status = 'failed';
    this.metadata.failed_at = new Date().toISOString();
    this.metadata.error = error.message || error;
  }

  /**
   * Check if message has expired based on TTL
   */
  isExpired() {
    const now = Date.now();
    const created = new Date(this.timestamp).getTime();
    return (now - created) > this.metadata.ttl;
  }

  /**
   * Check if message can be retried
   */
  canRetry() {
    return this.retries < this.max_retries && !this.isExpired();
  }

  /**
   * Increment retry counter
   */
  incrementRetry() {
    this.retries++;
    this.metadata.last_retry = new Date().toISOString();
  }

  /**
   * Convert to JSON for transmission
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      sender: this.sender,
      recipient: this.recipient,
      payload: this.payload,
      priority: this.priority,
      protocol_version: this.protocol_version,
      metadata: this.metadata,
      status: this.status,
      retries: this.retries,
      max_retries: this.max_retries
    };
  }

  /**
   * Create MCPMessage from JSON
   */
  static fromJSON(json) {
    const message = new MCPMessage({
      type: json.type,
      sender: json.sender,
      recipient: json.recipient,
      payload: json.payload,
      priority: json.priority,
      metadata: json.metadata
    });

    // Restore additional properties
    message.id = json.id;
    message.timestamp = json.timestamp;
    message.status = json.status;
    message.retries = json.retries;
    message.max_retries = json.max_retries;

    return message;
  }

  /**
   * Get string representation for logging
   */
  toString() {
    return `MCPMessage[${this.type}](${this.sender} -> ${this.recipient || 'broadcast'})`;
  }
}

export default MCPMessage;