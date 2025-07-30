const crypto = require('crypto');

class SimpleEncryption {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.key = crypto.scryptSync(process.env.VAULT_MASTER_KEY || 'default-key-for-dev', 'salt', 32);
  }

  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedText) {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  createHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return '****';
    }
    
    const first = apiKey.substring(0, 4);
    const last = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(apiKey.length - 8, 4));
    
    return `${first}${middle}${last}`;
  }

  validateApiKeyFormat(provider, apiKey) {
    const patterns = {
      openai: /^sk-[A-Za-z0-9]{32,}$/,
      anthropic: /^sk-ant-[A-Za-z0-9-]{32,}$/,
      github: /^gh[ps]_[A-Za-z0-9]{36}$/,
      stripe: /^sk_(test_|live_)[A-Za-z0-9]{24,}$/
    };

    const pattern = patterns[provider];
    if (!pattern) {
      return apiKey && apiKey.length >= 16;
    }

    return pattern.test(apiKey);
  }

  shouldRotateKey(createdAt, lastUsedAt, rotationIntervalDays, usageCount) {
    if (!rotationIntervalDays) return false;
    
    const created = new Date(createdAt);
    const now = new Date();
    const daysSinceCreated = (now - created) / (1000 * 60 * 60 * 24);
    
    return daysSinceCreated >= rotationIntervalDays;
  }
}

module.exports = new SimpleEncryption();