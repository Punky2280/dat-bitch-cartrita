/* global process, Buffer, console */
import crypto from 'crypto';

/**
 * SecureEncryptionService - Enhanced encryption service for Iteration 18 Vault
 * Features:
 * - AES-256-GCM encryption with authentication
 * - Secure key derivation using PBKDF2
 * - API key masking and validation
 * - Key rotation detection
 * - Audit logging integration
 */
class SecureEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits
    this.iterations = 100000; // PBKDF2 iterations

    // Derive encryption key from environment or use secure default
    this.masterKey = this.deriveKey(
      process.env.ENCRYPTION_MASTER_KEY || 'cartrita-vault-master-key-2025',
      'cartrita-vault-salt-2025'
    );

    this.initialized = true;
    console.log('🔐 SecureEncryptionService initialized with AES-256-GCM');
  }

  /**
   * Derive encryption key using PBKDF2
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.iterations,
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt sensitive data with authenticated encryption
   */
  encrypt(plaintext) {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Invalid plaintext provided for encryption');
      }

      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipherGCM(this.algorithm, this.masterKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data with authentication verification
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data provided for decryption');
      }

      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipherGCM(
        this.algorithm,
        this.masterKey,
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Create secure hash of data
   */
  createHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Mask API key for display purposes
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return '****';
    }

    const first = apiKey.substring(0, 4);
    const last = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(apiKey.length - 8, 4));

    return `${first}${middle}${last}`;
  }

  /**
   * Validate API key format based on provider
   */
  validateApiKeyFormat(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const API_KEY_PATTERNS = {
      openai: /^sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}$/,
      huggingface: /^hf_[A-Za-z0-9]{37}$/,
      deepgram: /^[a-f0-9]{40}$/,
    };    const pattern = patterns[provider.toLowerCase()];
    if (!pattern) {
      // Generic validation for unknown providers
      return apiKey.length >= 16 && apiKey.length <= 128;
    }

    return pattern.test(apiKey);
  }

  /**
   * Check if API key should be rotated
   */
  shouldRotateKey(createdAt, rotationIntervalDays) {
    if (!createdAt || !rotationIntervalDays) {
      return false;
    }

    const created = new Date(createdAt);
    const now = new Date();
    const daysSinceCreated = (now - created) / (1000 * 60 * 60 * 24);

    return daysSinceCreated >= rotationIntervalDays;
  }

  /**
   * Generate secure random string for key rotation
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify encrypted data integrity
   */
  verifyIntegrity(encryptedData) {
    try {
      // Attempt to decrypt - if it succeeds, integrity is verified
      const decrypted = this.decrypt(encryptedData);
      return decrypted !== null && decrypted !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'SecureEncryptionService',
      algorithm: this.algorithm,
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new SecureEncryptionService();
