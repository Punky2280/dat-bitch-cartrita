class EncryptionService {
  constructor() {
    this.initialized = true;
    console.log('✅ EncryptionService ready');
  }

  getStatus() {
    return {
      service: 'EncryptionService',
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new EncryptionService();
