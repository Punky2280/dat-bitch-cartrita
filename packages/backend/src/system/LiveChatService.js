/* global console */
class LiveChatService {
  constructor() {
    this.initialized = true;
    console.log('✅ LiveChatService ready');
  }

  getStatus() {
    return {
      service: 'LiveChatService',
      initialized: this.initialized,
      timestamp: new Date().toISOString()
    };
  }
}

export default new LiveChatService();
