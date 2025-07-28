// packages/backend/src/system/EncryptionService.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// The ENCRYPTION_KEY must be 32 bytes (256 bits) for aes-256-cbc
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('Invalid ENCRYPTION_KEY length. It must be a 64-character hex string (32 bytes).');
}

class EncryptionService {
  encrypt(text) {
    const iv = crypto.randomBytes(16); // Initialization Vector
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Store the IV with the encrypted data, separated by a colon
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = new EncryptionService();
