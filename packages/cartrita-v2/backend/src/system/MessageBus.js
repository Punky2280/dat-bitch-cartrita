/* global console */
// packages/backend/src/system/MessageBus.js

/**
 * Hybrid MessageBus with Multi-Agent Communication Protocol (MCP)
 * * This is a production-grade communication system for the Cartrita AGI.
 * It combines the advanced features of the EnhancedMessageBus (agent registration,
 * health monitoring, structured messaging) with a simple, backward-compatible
 * subscribe/publish API.
 */

import EventEmitter from 'events';
// NOTE: The MCPMessage protocol is assumed to exist. If not, this can be a plain object.
// import MCPMessage from './protocols/MCPMessage.js';

class HybridMessageBus extends EventEmitter {
  constructor() {
    super();

    // ✅ FIX: Increase listener limit to prevent warnings in a multi-agent system.
    this.setMaxListeners(50);

    // --- Features from EnhancedMessageBus ---
    this.agents = new Map(); // agentId -> agent metadata
    this.messageHistory = []; // Recent messages for debugging
    this.maxHistorySize = 1000;

    this.metrics = {
      messages_sent: 0,
      messages_delivered: 0,
      messages_failed: 0,
      agents_registered: 0,
      uptime_start: Date.now(),
    };

    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    this.initialized = true;

    this.startHealthMonitoring();
    console.log('✅ Hybrid MessageBus with MCP initialized');
  }

  // --- Core Methods from EnhancedMessageBus ---

  /**
   * Register an agent with the message bus.
   * @param {string} agentId - The unique identifier for the agent.
   * @param {object} metadata - Information about the agent (capabilities, version, etc.).
   */
  registerAgent(agentId, metadata = {}) {
    try {
      if (this.agents.has(agentId)) {
        console.log(
          `[MCP] Agent ${agentId} re-registering, updating metadata.`
        );
        const existingAgent = this.agents.get(agentId);
        Object.assign(existingAgent.metadata, metadata);
        existingAgent.last_heartbeat = new Date().toISOString();
        existingAgent.status = 'active';
        return true;
      }

      if (!agentId || typeof agentId !== 'string') {
        throw new Error('Invalid agent ID provided.');
      }

      const agentInfo = {
        id: agentId,
        status: 'active',
        registered_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        metadata: metadata,
      };

      this.agents.set(agentId, agentInfo);
      this.metrics.agents_registered++;
      console.log(`[MCP] Agent registered: ${agentId}`);

      // Broadcast that a new agent has joined
      this.publish('agent:register', { agent: agentInfo });

      return true;
    } catch (error) {
      console.error(
        `[MCP] Agent registration failed for ${agentId}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Send a structured message. For direct or broadcast agent communication.
   * @param {object} message - A structured message object (e.g., an MCPMessage).
   */
  sendMessage(message) {
    try {
      if (
        !message ||
        typeof message !== 'object' ||
        !message.sender ||
        !message.type
      ) {
        throw new Error(
          'Invalid message format. Must be an object with sender and type.'
        );
      }

      this.metrics.messages_sent++;
      this.addToHistory(message);

      // Route to a specific recipient or broadcast to all
      if (message.recipient && message.recipient !== 'all') {
        this.emit(`agent:message:${message.recipient}`, message);
      } else {
        this.emit('agent:broadcast', message);
      }

      this.metrics.messages_delivered++;
      return true;
    } catch (error) {
      this.metrics.messages_failed++;
      console.error('[MCP] Message delivery failed:', error.message);
      return false;
    }
  }

  // --- HYBRID FEATURE: Simplified API from the original MessageBus ---

  /**
   * Subscribe to any event on the bus.
   * Provides backward compatibility and a simple API.
   * @param {string} event - The event name to listen for.
   * @param {function} callback - The function to execute when the event is emitted.
   * @returns {function} A function to unsubscribe the listener.
   */
  subscribe(event, callback) {
    this.on(event, callback);
    // Return a function that can be called to easily unsubscribe
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Publish any event on the bus.
   * Provides backward compatibility and a simple API.
   * @param {string} event - The event name to emit.
   * @param {*} data - The data payload to send with the event.
   */
  publish(event, data) {
    this.emit(event, data);
  }

  /**
   * Unsubscribe a listener from an event.
   * @param {string} event - The event name.
   * @param {function} callback - The specific callback function to remove.
   */
  unsubscribe(event, callback) {
    this.off(event, callback);
  }

  // --- Health, History, and Status Methods from EnhancedMessageBus ---

  addToHistory(message) {
    this.messageHistory.unshift({
      ...message,
      processed_at: new Date().toISOString(),
    });
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.pop();
    }
  }

  startHealthMonitoring() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.heartbeatInterval * 3;

      for (const agent of this.agents.values()) {
        const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
        if (agent.status === 'active' && now - lastHeartbeat > timeout) {
          agent.status = 'inactive';
          console.warn(`[MCP] Agent ${agent.id} marked as inactive.`);
          this.publish('agent:inactive', { agentId: agent.id });
        }
      }
    }, this.heartbeatInterval);
  }

  heartbeat(agentId) {
    if (this.agents.has(agentId)) {
      const agent = this.agents.get(agentId);
      if (agent.status === 'inactive') {
        console.log(`[MCP] Agent ${agent.id} is active again.`);
        this.publish('agent:active', { agentId: agent.id });
      }
      agent.last_heartbeat = new Date().toISOString();
      agent.status = 'active';
    }
  }

  getStatus() {
    return {
      service: 'HybridMessageBus',
      initialized: this.initialized,
      agents_registered: this.agents.size,
      agents_active: Array.from(this.agents.values()).filter(
        a => a.status === 'active'
      ).length,
      uptime_ms: Date.now() - this.metrics.uptime_start,
      metrics: this.metrics,
      recent_messages: this.messageHistory.slice(0, 10),
    };
  }

  getAgents() {
    return Array.from(this.agents.values());
  }

  shutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.removeAllListeners();
    console.log('[MCP] Hybrid MessageBus shutdown complete.');
  }
}

// Create and export a singleton instance for the entire application
const messageBus = new HybridMessageBus();
export default messageBus;
