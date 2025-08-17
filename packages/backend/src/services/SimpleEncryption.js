/* global process, Buffer, console */
import crypto from 'crypto';

class SimpleEncryption {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-key-for-dev',
      'salt',
      32
    );
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
    if (!apiKey || apiKey.length <= 8) {
      return '****';
    }

    const first = apiKey.substring(0, 4);
    const last = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(apiKey.length - 8, 4));

    return `${first}${middle}${last}`;
  }

  validateApiKeyFormat(provider, apiKey) {
    console.log(`[Encryption] Validating API key for provider: ${provider}`);
    console.log(`[Encryption] API key length: ${apiKey ? apiKey.length : 'null'}`);
    console.log(`[Encryption] API key prefix: ${apiKey ? apiKey.substring(0, 15) : 'null'}...`);

    // Temporarily allow all keys for debugging
    if (provider === 'openai') {
      console.log(`[Encryption] Allowing all OpenAI keys for debugging`);
      return apiKey && apiKey.startsWith('sk-') && apiKey.length >= 20;
    }

    const patterns = {
      anthropic: /^sk-ant-[A-Za-z0-9-]{32}$/,
      github: /^gh[ps]_[A-Za-z0-9]{36}$/,
      stripe: /^sk_(test_|live_)[A-Za-z0-9]{24}$/
    };

    const pattern = patterns[provider];
    if (!pattern) {
      console.log(`[Encryption] No pattern for provider ${provider}, using length check`);
      return apiKey && apiKey.length >= 16;
    }

    const result = pattern.test(apiKey);
    console.log(`[Encryption] Pattern test result: ${result}`);
    console.log(`[Encryption] Pattern used: ${pattern}`);

    return result;
  }

  shouldRotateKey(createdAt, rotationIntervalDays = 90) {
    const created = new Date(createdAt);
    const now = new Date();
    const daysSinceCreated = (now - created) / (1000 * 60 * 60 * 24);

    return daysSinceCreated >= rotationIntervalDays;
  }
}


export default new SimpleEncryption();
