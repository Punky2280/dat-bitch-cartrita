import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class MFAService {
  constructor() {
    this.appName = 'Cartrita MultiAgent OS';
    this.backupCodeLength = 8;
    this.backupCodeCount = 10;
  }

  /**
   * Generate TOTP secret for user
   * @param {number} userId - User ID
   * @param {string} userEmail - User email for QR code label
   * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
   */
  async generateTOTPSecret(userId, userEmail) {
    const span = OpenTelemetryTracing.traceOperation('mfa.generate_totp_secret');
    
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${userEmail})`,
        issuer: this.appName,
        length: 32
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );

      // Store in database (not enabled until user confirms)
      await db.query(`
        INSERT INTO user_mfa (user_id, secret, backup_codes, is_enabled, created_at)
        VALUES ($1, $2, $3, false, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          secret = $2,
          backup_codes = $3,
          is_enabled = false,
          created_at = NOW()
      `, [userId, secret.base32, JSON.stringify(hashedBackupCodes)]);

      // Generate QR code URL for authenticator apps
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      span.setAttributes({
        'mfa.user_id': userId,
        'mfa.backup_codes_generated': backupCodes.length
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes // Return unhashed codes to user (only time they see them)
      };

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Verify TOTP token and enable MFA
   * @param {number} userId - User ID
   * @param {string} token - 6-digit TOTP token
   * @returns {Promise<boolean>}
   */
  async verifyAndEnableTOTP(userId, token) {
    const span = OpenTelemetryTracing.traceOperation('mfa.verify_enable_totp');
    
    try {
      // Get user's MFA data
      const result = await db.query(`
        SELECT secret FROM user_mfa 
        WHERE user_id = $1 AND is_enabled = false
      `, [userId]);

      if (result.rows.length === 0) {
        span.setAttributes({ 'mfa.error': 'no_pending_setup' });
        return false;
      }

      const secret = result.rows[0].secret;

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1 // Allow 1 step tolerance for clock drift
      });

      if (verified) {
        // Enable MFA
        await db.query(`
          UPDATE user_mfa 
          SET is_enabled = true, enabled_at = NOW()
          WHERE user_id = $1
        `, [userId]);

        // Update user security preferences
        await db.query(`
          INSERT INTO user_security_preferences (user_id, mfa_enabled, updated_at)
          VALUES ($1, true, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            mfa_enabled = true,
            updated_at = NOW()
        `, [userId]);

        span.setAttributes({
          'mfa.user_id': userId,
          'mfa.enabled': true
        });
      }

      return verified;

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Verify TOTP token for authentication
   * @param {number} userId - User ID
   * @param {string} token - 6-digit TOTP token
   * @returns {Promise<boolean>}
   */
  async verifyTOTP(userId, token) {
    const span = OpenTelemetryTracing.traceOperation('mfa.verify_totp');
    
    try {
      // Get user's MFA data
      const result = await db.query(`
        SELECT secret FROM user_mfa 
        WHERE user_id = $1 AND is_enabled = true
      `, [userId]);

      if (result.rows.length === 0) {
        span.setAttributes({ 'mfa.error': 'not_enabled' });
        return false;
      }

      const secret = result.rows[0].secret;

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });

      span.setAttributes({
        'mfa.user_id': userId,
        'mfa.verified': verified
      });

      return verified;

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Verify backup code
   * @param {number} userId - User ID
   * @param {string} code - Backup code
   * @returns {Promise<boolean>}
   */
  async verifyBackupCode(userId, code) {
    const span = OpenTelemetryTracing.traceOperation('mfa.verify_backup_code');
    
    try {
      // Get user's backup codes
      const result = await db.query(`
        SELECT backup_codes, used_backup_codes 
        FROM user_mfa 
        WHERE user_id = $1 AND is_enabled = true
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const backupCodes = JSON.parse(result.rows[0].backup_codes || '[]');
      const usedCodes = JSON.parse(result.rows[0].used_backup_codes || '[]');
      
      // Hash the provided code
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

      // Check if code is valid and not used
      const isValid = backupCodes.includes(hashedCode) && !usedCodes.includes(hashedCode);

      if (isValid) {
        // Mark code as used
        usedCodes.push(hashedCode);
        await db.query(`
          UPDATE user_mfa 
          SET used_backup_codes = $1
          WHERE user_id = $2
        `, [JSON.stringify(usedCodes), userId]);

        span.setAttributes({
          'mfa.user_id': userId,
          'mfa.backup_code_used': true,
          'mfa.remaining_codes': backupCodes.length - usedCodes.length
        });
      }

      return isValid;

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Disable MFA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>}
   */
  async disableMFA(userId) {
    const span = OpenTelemetryTracing.traceOperation('mfa.disable');
    
    try {
      // Disable MFA
      const result = await db.query(`
        UPDATE user_mfa 
        SET is_enabled = false, disabled_at = NOW()
        WHERE user_id = $1 AND is_enabled = true
        RETURNING id
      `, [userId]);

      if (result.rows.length > 0) {
        // Update user security preferences
        await db.query(`
          UPDATE user_security_preferences 
          SET mfa_enabled = false, updated_at = NOW()
          WHERE user_id = $1
        `, [userId]);

        span.setAttributes({
          'mfa.user_id': userId,
          'mfa.disabled': true
        });

        return true;
      }

      return false;

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generate new backup codes
   * @param {number} userId - User ID
   * @returns {Promise<string[]>}
   */
  async generateNewBackupCodes(userId) {
    const span = OpenTelemetryTracing.traceOperation('mfa.regenerate_backup_codes');
    
    try {
      // Generate new backup codes
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );

      // Update database
      await db.query(`
        UPDATE user_mfa 
        SET backup_codes = $1, used_backup_codes = '[]'
        WHERE user_id = $2 AND is_enabled = true
      `, [JSON.stringify(hashedBackupCodes), userId]);

      span.setAttributes({
        'mfa.user_id': userId,
        'mfa.backup_codes_regenerated': backupCodes.length
      });

      return backupCodes; // Return unhashed codes to user

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get MFA status for user
   * @param {number} userId - User ID
   * @returns {Promise<{enabled: boolean, hasBackupCodes: boolean, unusedBackupCodes: number}>}
   */
  async getMFAStatus(userId) {
    const span = OpenTelemetryTracing.traceOperation('mfa.get_status');
    
    try {
      const result = await db.query(`
        SELECT is_enabled, backup_codes, used_backup_codes, enabled_at
        FROM user_mfa 
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return {
          enabled: false,
          hasBackupCodes: false,
          unusedBackupCodes: 0,
          enabledAt: null
        };
      }

      const row = result.rows[0];
      const backupCodes = JSON.parse(row.backup_codes || '[]');
      const usedCodes = JSON.parse(row.used_backup_codes || '[]');

      return {
        enabled: row.is_enabled,
        hasBackupCodes: backupCodes.length > 0,
        unusedBackupCodes: backupCodes.length - usedCodes.length,
        enabledAt: row.enabled_at
      };

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generate backup codes
   * @returns {string[]}
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  /**
   * Generate a single backup code
   * @returns {string}
   */
  generateBackupCode() {
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < this.backupCodeLength; i++) {
      code += characters.charAt(crypto.randomInt(0, characters.length));
    }
    return code;
  }

  /**
   * Check if user has MFA enabled
   * @param {number} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isEnabled(userId) {
    try {
      const result = await db.query(`
        SELECT is_enabled FROM user_mfa 
        WHERE user_id = $1
      `, [userId]);

      return result.rows.length > 0 && result.rows[0].is_enabled;
    } catch (error) {
      console.error('MFA status check error:', error);
      return false;
    }
  }

  /**
   * Validate MFA requirement for user
   * @param {number} userId - User ID
   * @param {Object} securityPreferences - User security preferences
   * @returns {Promise<boolean>}
   */
  async requiresMFA(userId, securityPreferences = null) {
    try {
      // If we don't have preferences, fetch them
      if (!securityPreferences) {
        const result = await db.query(`
          SELECT mfa_enabled FROM user_security_preferences 
          WHERE user_id = $1
        `, [userId]);
        
        securityPreferences = result.rows[0] || { mfa_enabled: false };
      }

      // Check if MFA is enabled for this user
      if (securityPreferences.mfa_enabled) {
        return await this.isEnabled(userId);
      }

      return false;
    } catch (error) {
      console.error('MFA requirement check error:', error);
      return false;
    }
  }
}

export default new MFAService();
