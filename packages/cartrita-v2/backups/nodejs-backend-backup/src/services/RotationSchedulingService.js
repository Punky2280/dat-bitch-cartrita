import db from '../db.js';
import crypto from 'crypto';

/**
 * Service for managing API key rotation policies and scheduling
 */
class RotationSchedulingService {
  /**
   * Get all rotation policies for a user
   */
  async getRotationPolicies(userId) {
    try {
      const result = await db.query(
        `SELECT 
          rp.*,
          COUNT(ak.id) as affected_keys_count
         FROM rotation_policies rp
         LEFT JOIN api_keys ak ON ak.user_id = rp.user_id 
           AND (rp.provider_name IS NULL OR ak.service_name = rp.provider_name)
           AND ak.is_active = true
         WHERE rp.user_id = $1
         GROUP BY rp.id
         ORDER BY rp.provider_name NULLS FIRST, rp.policy_name`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('[RotationService] Error getting policies:', error);
      throw new Error('Failed to retrieve rotation policies');
    }
  }

  /**
   * Create or update a rotation policy
   */
  async saveRotationPolicy(userId, policy) {
    try {
      const {
        id,
        provider_name,
        policy_name,
        interval_days,
        auto_rotate,
        grace_days,
        enabled,
      } = policy;

      let result;
      if (id) {
        // Update existing policy
        result = await db.query(
          `UPDATE rotation_policies 
           SET provider_name = $2, policy_name = $3, interval_days = $4, 
               auto_rotate = $5, grace_days = $6, enabled = $7, updated_at = NOW()
           WHERE id = $1 AND user_id = $8
           RETURNING *`,
          [
            id,
            provider_name,
            policy_name,
            interval_days,
            auto_rotate,
            grace_days,
            enabled,
            userId,
          ]
        );
      } else {
        // Create new policy
        result = await db.query(
          `INSERT INTO rotation_policies 
           (user_id, provider_name, policy_name, interval_days, auto_rotate, grace_days, enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            userId,
            provider_name,
            policy_name,
            interval_days,
            auto_rotate,
            grace_days,
            enabled,
          ]
        );
      }

      if (result.rows.length === 0) {
        throw new Error('Policy not found or access denied');
      }

      // Apply policy to existing keys
      await this.applyPolicyToKeys(userId, result.rows[0]);

      return result.rows[0];
    } catch (error) {
      console.error('[RotationService] Error saving policy:', error);
      throw new Error('Failed to save rotation policy');
    }
  }

  /**
   * Apply a rotation policy to existing API keys
   */
  async applyPolicyToKeys(userId, policy) {
    try {
      const policyJson = {
        intervalDays: policy.interval_days,
        autoRotate: policy.auto_rotate,
        graceDays: policy.grace_days,
      };

      // Update keys that match this policy
      const whereClause = policy.provider_name
        ? 'user_id = $1 AND service_name = $2 AND is_active = true'
        : 'user_id = $1 AND is_active = true';

      const params = policy.provider_name
        ? [userId, policy.provider_name, JSON.stringify(policyJson)]
        : [userId, JSON.stringify(policyJson)];

      await db.query(
        `UPDATE api_keys 
         SET rotation_policy = $${params.length},
             updated_at = NOW()
         WHERE ${whereClause}`,
        params
      );

      console.log(
        `[RotationService] Applied policy ${policy.policy_name} to keys`
      );
    } catch (error) {
      console.error('[RotationService] Error applying policy:', error);
      throw error;
    }
  }

  /**
   * Get keys that need rotation for a user
   */
  async getKeysNeedingRotation(userId) {
    try {
      const result = await db.query(
        `SELECT 
          ak.*,
          CASE 
            WHEN ak.next_rotation_due <= NOW() THEN 'overdue'
            WHEN ak.next_rotation_due <= NOW() + INTERVAL '7 days' THEN 'warning'
            ELSE 'ok'
          END as rotation_status,
          EXTRACT(days FROM (ak.next_rotation_due - NOW())) as days_until_rotation
         FROM api_keys ak
         WHERE ak.user_id = $1 
           AND ak.is_active = true
           AND (ak.needs_rotation = true OR ak.next_rotation_due <= NOW() + INTERVAL '30 days')
         ORDER BY ak.next_rotation_due ASC NULLS LAST`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error(
        '[RotationService] Error getting keys needing rotation:',
        error
      );
      throw new Error('Failed to retrieve keys needing rotation');
    }
  }

  /**
   * Schedule a manual rotation for a specific key
   */
  async scheduleRotation(userId, keyId, reason = 'manual', performedBy = null) {
    try {
      // First verify the key belongs to the user
      const keyResult = await db.query(
        'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2 AND is_active = true',
        [keyId, userId]
      );

      if (keyResult.rows.length === 0) {
        throw new Error('API key not found or access denied');
      }

      const apiKey = keyResult.rows[0];

      // Create rotation event
      const eventResult = await db.query(
        `INSERT INTO rotation_events 
         (api_key_id, event_type, reason, old_key_hash, rotation_status, performed_by)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING *`,
        [
          keyId,
          'manual',
          reason,
          this.hashKey(apiKey.encrypted_key),
          performedBy || userId,
        ]
      );

      return {
        success: true,
        event_id: eventResult.rows[0].id,
        message: 'Rotation scheduled successfully',
        next_step: 'User must provide new API key to complete rotation',
      };
    } catch (error) {
      console.error('[RotationService] Error scheduling rotation:', error);
      throw error;
    }
  }

  /**
   * Complete a manual rotation with the new key
   */
  async completeRotation(userId, eventId, newKey) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Get the rotation event
      const eventResult = await client.query(
        'SELECT * FROM rotation_events WHERE id = $1 AND rotation_status = $2',
        [eventId, 'pending']
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Rotation event not found or already completed');
      }

      const event = eventResult.rows[0];

      // Get the API key
      const keyResult = await client.query(
        'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2',
        [event.api_key_id, userId]
      );

      if (keyResult.rows.length === 0) {
        throw new Error('API key not found or access denied');
      }

      const apiKey = keyResult.rows[0];
      const newKeyHash = this.hashKey(newKey);

      // Update the API key with new encrypted key
      // Note: This is simplified - in production you'd want to use the same encryption
      // service used elsewhere in the application
      await client.query(
        `UPDATE api_keys 
         SET encrypted_key = $1,
             last_rotation_at = NOW(),
             rotation_count = rotation_count + 1,
             next_rotation_due = NOW() + MAKE_INTERVAL(days => (rotation_policy->>'intervalDays')::integer),
             needs_rotation = false,
             updated_at = NOW()
         WHERE id = $2`,
        [newKey, event.api_key_id] // Simplified - should encrypt the key
      );

      // Update the rotation event
      await client.query(
        `UPDATE rotation_events 
         SET rotation_status = 'completed',
             new_key_hash = $1,
             completed_at = NOW()
         WHERE id = $2`,
        [newKeyHash, eventId]
      );

      await client.query('COMMIT');
      return { success: true, message: 'Rotation completed successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[RotationService] Error completing rotation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get rotation history for a user's keys
   */
  async getRotationHistory(userId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT 
          re.*,
          ak.service_name,
          ak.key_alias,
          u.name as performed_by_name
         FROM rotation_events re
         JOIN api_keys ak ON ak.id = re.api_key_id
         LEFT JOIN users u ON u.id = re.performed_by
         WHERE ak.user_id = $1
         ORDER BY re.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('[RotationService] Error getting rotation history:', error);
      throw new Error('Failed to retrieve rotation history');
    }
  }

  /**
   * Get rotation analytics/metrics for a user
   */
  async getRotationAnalytics(userId) {
    try {
      const [summaryResult, overdueResult, recentEventsResult] =
        await Promise.all([
          // Summary statistics
          db.query(
            `SELECT 
            COUNT(*) as total_keys,
            COUNT(*) FILTER (WHERE needs_rotation = true) as keys_needing_rotation,
            COUNT(*) FILTER (WHERE next_rotation_due <= NOW()) as overdue_keys,
            COUNT(*) FILTER (WHERE next_rotation_due <= NOW() + INTERVAL '7 days') as warning_keys,
            AVG(rotation_count) as avg_rotations_per_key,
            MAX(last_rotation_at) as last_rotation_date
           FROM api_keys 
           WHERE user_id = $1 AND is_active = true`,
            [userId]
          ),

          // Overdue by provider
          db.query(
            `SELECT 
            service_name,
            COUNT(*) as overdue_count
           FROM api_keys 
           WHERE user_id = $1 AND is_active = true AND needs_rotation = true
           GROUP BY service_name
           ORDER BY overdue_count DESC`,
            [userId]
          ),

          // Recent rotation events
          db.query(
            `SELECT 
            DATE_TRUNC('day', re.created_at) as date,
            COUNT(*) as rotations_count,
            COUNT(*) FILTER (WHERE re.rotation_status = 'completed') as successful_rotations,
            COUNT(*) FILTER (WHERE re.rotation_status = 'failed') as failed_rotations
           FROM rotation_events re
           JOIN api_keys ak ON ak.id = re.api_key_id
           WHERE ak.user_id = $1 AND re.created_at >= NOW() - INTERVAL '30 days'
           GROUP BY DATE_TRUNC('day', re.created_at)
           ORDER BY date DESC`,
            [userId]
          ),
        ]);

      return {
        summary: summaryResult.rows[0] || {},
        overdue_by_provider: overdueResult.rows,
        recent_activity: recentEventsResult.rows,
      };
    } catch (error) {
      console.error('[RotationService] Error getting analytics:', error);
      throw new Error('Failed to retrieve rotation analytics');
    }
  }

  /**
   * Delete a rotation policy
   */
  async deleteRotationPolicy(userId, policyId) {
    try {
      const result = await db.query(
        'DELETE FROM rotation_policies WHERE id = $1 AND user_id = $2 RETURNING *',
        [policyId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Policy not found or access denied');
      }

      return { success: true, message: 'Policy deleted successfully' };
    } catch (error) {
      console.error('[RotationService] Error deleting policy:', error);
      throw error;
    }
  }

  /**
   * Test rotation policy (dry run)
   */
  async testRotationPolicy(userId, policy) {
    try {
      // Simulate applying the policy to see what would happen
      const whereClause = policy.provider_name
        ? 'user_id = $1 AND service_name = $2 AND is_active = true'
        : 'user_id = $1 AND is_active = true';

      const params = policy.provider_name
        ? [userId, policy.provider_name]
        : [userId];

      const result = await db.query(
        `SELECT 
          id,
          service_name,
          key_alias,
          created_at,
          last_rotation_at,
          next_rotation_due,
          CASE 
            WHEN $${params.length + 1} THEN 
              COALESCE(last_rotation_at, created_at) + MAKE_INTERVAL(days => $${params.length + 2})
            ELSE next_rotation_due
          END as new_rotation_due
         FROM api_keys 
         WHERE ${whereClause}`,
        [...params, policy.auto_rotate, policy.interval_days]
      );

      return {
        affected_keys: result.rows.map(key => ({
          ...key,
          would_change: key.new_rotation_due !== key.next_rotation_due,
          days_until_new_rotation: Math.ceil(
            (new Date(key.new_rotation_due) - new Date()) /
              (1000 * 60 * 60 * 24)
          ),
        })),
      };
    } catch (error) {
      console.error('[RotationService] Error testing policy:', error);
      throw new Error('Failed to test rotation policy');
    }
  }

  /**
   * Helper method to hash keys for audit purposes
   */
  hashKey(key) {
    return crypto
      .createHash('sha256')
      .update(key)
      .digest('hex')
      .substring(0, 64);
  }
}

export default new RotationSchedulingService();
