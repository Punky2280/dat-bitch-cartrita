const EventEmitter = require('events');

class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.initialized = true;
    console.log('✅ MessageBus ready');
  }

  getStatus() {
    return {
      service: 'MessageBus',
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
      listenerCount: this.listenerCount(),
    };
  }

  // Helper method to safely emit events
  safeEmit(event, data) {
    try {
      this.emit(event, data);
    } catch (error) {
      console.error(`[MessageBus] Error emitting ${event}:`, error);
    }
  }
}

module.exports = new MessageBus();
