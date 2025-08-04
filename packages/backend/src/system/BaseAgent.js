/* global console */
import EventEmitter from 'events';
import MessageBus from './MessageBus.js';

class BaseAgent extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.id = `${name}_${Date.now()}`;
    this.config = config;
    this.initialized = false;
    this.isActive = false;
    this.capabilities = config.capabilities || [];
    this.permissions = config.permissions || [];
    this.tools = config.tools || [];
    this.memory = new Map();
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0
    };
    
    console.log(`🤖 BaseAgent ${name} created with ID: ${this.id}`);
    this.setupMessageBus();
  }

  setupMessageBus() {
    // Subscribe to global agent events
    messageBus.subscribe(`agent:${this.name}:execute`, this.handleExecution.bind(this));
    messageBus.subscribe(`agent:${this.name}:status`, this.handleStatusRequest.bind(this));
    messageBus.subscribe('agent:broadcast', this.handleBroadcast.bind(this));
  }

  async handleExecution(data) {
    const startTime = Date.now();
    this.metrics.requests++;
    
    try {
      const result = await this.execute(data);
      this.metrics.successes++;
      
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      return result;
    } catch (error) {
      this.metrics.failures++;
      console.error(`[${this.name}] ❌ Execution failed:`, error);
      throw error;
    }
  }

  async handleStatusRequest() {
    return this.getStatus();
  }

  async handleBroadcast(data) {
    // Override in subclasses to handle broadcast messages
    console.log(`[${this.name}] 📢 Received broadcast:`, data);
  }

  async execute(input) {
    // Override this method in subclasses
    throw new Error(`Agent ${this.name} must implement execute() method`);
  }

  updateAverageResponseTime(responseTime) {
    const totalRequests = this.metrics.successes + this.metrics.failures;
    this.metrics.avgResponseTime = 
      ((this.metrics.avgResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  setMemory(key, value) {
    this.memory.set(key, {
      value,
      timestamp: new Date().toISOString()
    });
  }

  getMemory(key) {
    const item = this.memory.get(key);
    return item ? item.value : null;
  }

  clearMemory() {
    this.memory.clear();
  }

  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  hasTool(tool) {
    return this.tools.includes(tool);
  }

  getStatus() {
    return {
      name: this.name,
      id: this.id,
      initialized: this.initialized,
      isActive: this.isActive,
      capabilities: this.capabilities,
      permissions: this.permissions,
      tools: this.tools,
      memorySize: this.memory.size,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  activate() {
    this.isActive = true;
    this.emit('activated');
    console.log(`[${this.name}] ✅ Agent activated`);
  }

  deactivate() {
    this.isActive = false;
    this.emit('deactivated');
    console.log(`[${this.name}] ⏸️ Agent deactivated`);
  }

  destroy() {
    this.deactivate();
    this.clearMemory();
    this.removeAllListeners();
    
    // Unsubscribe from message bus
    messageBus.unsubscribe(`agent:${this.name}:execute`);
    messageBus.unsubscribe(`agent:${this.name}:status`);
    messageBus.unsubscribe('agent:broadcast');
    
    console.log(`[${this.name}] 🗑️ Agent destroyed`);
  }
}

export default BaseAgent;