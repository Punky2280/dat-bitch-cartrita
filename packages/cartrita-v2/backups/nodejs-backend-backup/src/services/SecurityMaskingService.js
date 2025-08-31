import db from '../db.js';

/**
 * Service for managing security masking and access controls for sensitive data
 */
class SecurityMaskingService {
  /**
   * Get masking preferences for a user
   */
  async getMaskingPreferences(userId) {
    try {
      const result = await db.query(
        `SELECT 
          sp.*,
          COUNT(uak.id) as total_keys
         FROM security_preferences sp
         LEFT JOIN api_keys uak ON uak.user_id = sp.user_id AND uak.is_active = true
         WHERE sp.user_id = $1
         GROUP BY sp.id`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Return default preferences if none exist
        return {
          user_id: userId,
          default_visibility: 'masked',
          reveal_timeout: 30,
          require_confirmation: true,
          audit_access: true,
          mask_pattern: '****',
          show_last_chars: 4,
          total_keys: 0,
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error getting preferences:',
        error
      );
      throw new Error('Failed to retrieve masking preferences');
    }
  }

  /**
   * Update masking preferences for a user
   */
  async updateMaskingPreferences(userId, preferences) {
    try {
      const {
        default_visibility,
        reveal_timeout,
        require_confirmation,
        audit_access,
        mask_pattern,
        show_last_chars,
      } = preferences;

      const result = await db.query(
        `INSERT INTO security_preferences 
         (user_id, default_visibility, reveal_timeout, require_confirmation, audit_access, mask_pattern, show_last_chars, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           default_visibility = EXCLUDED.default_visibility,
           reveal_timeout = EXCLUDED.reveal_timeout,
           require_confirmation = EXCLUDED.require_confirmation,
           audit_access = EXCLUDED.audit_access,
           mask_pattern = EXCLUDED.mask_pattern,
           show_last_chars = EXCLUDED.show_last_chars,
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          default_visibility,
          reveal_timeout,
          require_confirmation,
          audit_access,
          mask_pattern,
          show_last_chars,
        ]
      );

      await this.logSecurityEvent(userId, 'preferences_updated', {
        changes: preferences,
      });

      return result.rows[0];
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error updating preferences:',
        error
      );
      throw error;
    }
  }

  /**
   * Get masked version of sensitive data
   */
  async maskSensitiveData(userId, data, dataType = 'api_key') {
    try {
      const preferences = await this.getMaskingPreferences(userId);

      if (preferences.default_visibility === 'visible') {
        return data; // No masking needed
      }

      const maskPattern = preferences.mask_pattern || '****';
      const showLastChars = preferences.show_last_chars || 4;

      if (data.length <= showLastChars) {
        return maskPattern;
      }

      if (dataType === 'api_key' && data.startsWith('cartrita_')) {
        // Special handling for API keys
        const prefix = data.substring(0, 9); // 'cartrita_'
        const suffix = data.slice(-showLastChars);
        const maskLength = Math.max(8, data.length - 9 - showLastChars);
        const mask = maskPattern
          .repeat(Math.ceil(maskLength / maskPattern.length))
          .substring(0, maskLength);
        return `${prefix}${mask}${suffix}`;
      }

      // General masking
      const suffix = data.slice(-showLastChars);
      const maskLength = Math.max(4, data.length - showLastChars);
      const mask = maskPattern
        .repeat(Math.ceil(maskLength / maskPattern.length))
        .substring(0, maskLength);
      return `${mask}${suffix}`;
    } catch (error) {
      console.error('[SecurityMaskingService] Error masking data:', error);
      return '****'; // Fallback masking
    }
  }

  /**
   * Create a reveal token for temporary access to sensitive data
   */
  async createRevealToken(userId, resourceId, resourceType) {
    try {
      const preferences = await this.getMaskingPreferences(userId);
      const expiresAt = new Date(
        Date.now() + preferences.reveal_timeout * 1000
      );

      const token = this.generateSecureToken();

      const result = await db.query(
        `INSERT INTO reveal_tokens 
         (token, user_id, resource_id, resource_type, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id, token, expires_at`,
        [token, userId, resourceId, resourceType, expiresAt]
      );

      await this.logSecurityEvent(userId, 'reveal_token_created', {
        resource_id: resourceId,
        resource_type: resourceType,
        expires_at: expiresAt,
      });

      return {
        token: result.rows[0].token,
        expires_at: result.rows[0].expires_at,
        expires_in: preferences.reveal_timeout,
      };
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error creating reveal token:',
        error
      );
      throw error;
    }
  }

  /**
   * Validate and use a reveal token
   */
  async useRevealToken(token, userId) {
    try {
      // Find and validate the token
      const result = await db.query(
        `SELECT rt.*, ak.encrypted_key, ak.service_name
         FROM reveal_tokens rt
         LEFT JOIN api_keys ak ON ak.id = rt.resource_id::integer
         WHERE rt.token = $1 
           AND rt.user_id = $2 
           AND rt.expires_at > NOW() 
           AND rt.used_at IS NULL`,
        [token, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid or expired reveal token');
      }

      const tokenData = result.rows[0];

      // Mark token as used
      await db.query('UPDATE reveal_tokens SET used_at = NOW() WHERE id = $1', [
        tokenData.id,
      ]);

      await this.logSecurityEvent(userId, 'reveal_token_used', {
        resource_id: tokenData.resource_id,
        resource_type: tokenData.resource_type,
        token_id: tokenData.id,
      });

      return {
        success: true,
        resource_id: tokenData.resource_id,
        resource_type: tokenData.resource_type,
        data: tokenData.encrypted_key || 'Data revealed',
        service_name: tokenData.service_name,
      };
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error using reveal token:',
        error
      );
      throw error;
    }
  }

  /**
   * Get security events for audit log
   */
  async getSecurityEvents(userId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT 
          se.*,
          CASE 
            WHEN se.event_type = 'reveal_token_created' THEN '🔓 Reveal Token Created'
            WHEN se.event_type = 'reveal_token_used' THEN '👁️ Data Revealed'
            WHEN se.event_type = 'preferences_updated' THEN '⚙️ Settings Updated'
            WHEN se.event_type = 'unauthorized_access' THEN '🚨 Unauthorized Access'
            ELSE '📋 ' || se.event_type
          END as display_name
         FROM security_events se
         WHERE se.user_id = $1
         ORDER BY se.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error getting security events:',
        error
      );
      throw new Error('Failed to retrieve security events');
    }
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(userId, eventType, metadata = {}) {
    try {
      await db.query(
        `INSERT INTO security_events 
         (user_id, event_type, metadata, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          eventType,
          JSON.stringify(metadata),
          metadata.ip_address || 'unknown',
          metadata.user_agent || 'unknown',
        ]
      );
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error logging security event:',
        error
      );
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Get masking analytics for user
   */
  async getMaskingAnalytics(userId) {
    try {
      const [eventsResult, tokensResult, prefsResult] = await Promise.all([
        // Security events summary
        db.query(
          `SELECT 
            event_type,
            COUNT(*) as count,
            MAX(created_at) as last_event
           FROM security_events
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY event_type
           ORDER BY count DESC`,
          [userId]
        ),

        // Reveal tokens summary
        db.query(
          `SELECT 
            COUNT(*) as total_tokens,
            COUNT(*) FILTER (WHERE used_at IS NOT NULL) as used_tokens,
            COUNT(*) FILTER (WHERE expires_at < NOW() AND used_at IS NULL) as expired_tokens
           FROM reveal_tokens
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
          [userId]
        ),

        // Current preferences
        this.getMaskingPreferences(userId),
      ]);

      return {
        security_events: eventsResult.rows,
        reveal_tokens: tokensResult.rows[0] || {
          total_tokens: 0,
          used_tokens: 0,
          expired_tokens: 0,
        },
        current_preferences: prefsResult,
      };
    } catch (error) {
      console.error('[SecurityMaskingService] Error getting analytics:', error);
      throw new Error('Failed to retrieve masking analytics');
    }
  }

  /**
   * Clean up expired reveal tokens
   */
  async cleanupExpiredTokens(userId) {
    try {
      const result = await db.query(
        `DELETE FROM reveal_tokens 
         WHERE user_id = $1 AND expires_at < NOW() - INTERVAL '1 hour'
         RETURNING COUNT(*)`,
        [userId]
      );

      return { cleaned_tokens: result.rowCount || 0 };
    } catch (error) {
      console.error(
        '[SecurityMaskingService] Error cleaning up tokens:',
        error
      );
      throw error;
    }
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length = 32) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }
}

export default new SecurityMaskingService();
