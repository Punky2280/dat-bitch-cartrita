import express from 'express';
import bcrypt from 'bcrypt';
import authenticateToken from '../middleware/authenticateToken.js';
import db from '../db.js';
const router = express.Router();

/**
 * USER MANAGEMENT ROUTES
 *
 * These routes handle user profile management, settings, and preferences
 * within the hierarchical multi-agent system.
 *
 * ENDPOINTS:
 * - GET /api/user/me - Get current user profile
 * - PUT /api/user/me - Update user profile
 * - GET /api/user/settings - Get user settings and preferences
 * - PUT /api/user/settings - Update user settings
 * - GET /api/user/activity - Get user activity history
 * - DELETE /api/user/me - Delete user account
 */

// Test route to verify user routes are loading
router.get('/test', (req, res) => {
  console.log('[UserRoute] 🧪 Test route hit');
  res.json({
    message: 'User routes are working',
    timestamp: new Date().toISOString(),
    version: '2.1.0-hierarchical',
  });
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🚀 GET /me endpoint hit');
    console.log('[UserRoute] 🔍 req.user exists:', !!req.user);

    if (!req.user || !req.user.id) {
      console.log('[UserRoute] ❌ No user object or user ID in request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = req.user.id;
    console.log('[UserRoute] 🔍 Looking up user with ID:', userId);

    // Test database connection first
    try {
      await db.query('SELECT 1');
      console.log('[UserRoute] ✅ Database connection test passed');
    } catch (dbError) {
      console.error('[UserRoute] ❌ Database connection test failed:', dbError);
      return res.status(500).json({ message: 'Database connection error' });
    }

    const result = await db.query(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    console.log(
      '[UserRoute] 🔍 Database query result:',
      result.rows.length,
      'rows'
    );

    if (result.rows.length === 0) {
      console.log('[UserRoute] ❌ No user found with ID:', userId);
      return res.status(404).json({
        message: 'User not found',
        user_id: userId,
      });
    }

    const user = result.rows[0];
    console.log('[UserRoute] ✅ User found:', user.name);

    // Get user preferences and settings
    const settingsResult = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    const settings = settingsResult.rows[0] || {
      sarcasm_level: 5,
      verbosity: 'normal',
      humor_style: 'playful',
      language_preference: 'en',
      theme: 'dark',
    };

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      settings: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserRoute] ❌ Error in GET /me:', error);
    res.status(500).json({
      message: 'Failed to fetch user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🔄 PUT /me endpoint hit');

    const userId = req.user.id;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: 'Name and email are required',
      });
    }

    // Check if email is already taken by another user
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        message: 'Email already taken by another user',
      });
    }

    // Update user profile
    const result = await db.query(
      'UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, name, email, updated_at',
      [name, email, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('[UserRoute] ✅ User profile updated successfully');
    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserRoute] ❌ Error updating profile:', error);
    res.status(500).json({
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update user password
router.put('/me/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const existing = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const valid = await bcrypt.compare(currentPassword, existing.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('[UserRoute] ❌ Error updating password:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// Get user settings and preferences
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🚀 GET /settings endpoint hit');

    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    let settings;
    if (result.rows.length === 0) {
      // Create default settings
      const defaultSettings = {
        user_id: userId,
        sarcasm_level: 5,
        verbosity: 'normal',
        humor_style: 'playful',
        language_preference: 'en',
        theme: 'dark',
        notifications_enabled: true,
        voice_enabled: true,
        ambient_listening: false,
      };

      const insertResult = await db.query(
        `INSERT INTO user_preferences 
         (user_id, sarcasm_level, verbosity, humor_style, language_preference, theme, notifications_enabled, voice_enabled, ambient_listening) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          userId,
          defaultSettings.sarcasm_level,
          defaultSettings.verbosity,
          defaultSettings.humor_style,
          defaultSettings.language_preference,
          defaultSettings.theme,
          defaultSettings.notifications_enabled,
          defaultSettings.voice_enabled,
          defaultSettings.ambient_listening,
        ]
      );

      settings = insertResult.rows[0];
      console.log('[UserRoute] ✅ Created default settings for user');
    } else {
      settings = result.rows[0];
      console.log('[UserRoute] ✅ Retrieved existing settings');
    }

    res.json({
      settings: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserRoute] ❌ Error fetching settings:', error);
    res.status(500).json({
      message: 'Failed to fetch user settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update user settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🔄 PUT /settings endpoint hit');

    const userId = req.user.id;
    const {
      sarcasm,
      verbosity,
      humor,
      language,
      theme,
      notifications,
      sound_effects,
      auto_save,
    } = req.body;

    // Validate sarcasm level
    if (sarcasm !== undefined && (sarcasm < 0 || sarcasm > 10)) {
      return res.status(400).json({
        message: 'Sarcasm level must be between 0 and 10',
      });
    }

    // Validate verbosity
    if (verbosity && !['concise', 'normal', 'detailed'].includes(verbosity)) {
      return res.status(400).json({
        message: 'Verbosity must be one of: concise, normal, detailed',
      });
    }

    // Update settings
    const result = await db.query(
      `UPDATE user_preferences 
       SET sarcasm_level = COALESCE($2, sarcasm_level),
           verbosity = COALESCE($3, verbosity),
           humor_style = COALESCE($4, humor_style),
           language_preference = COALESCE($5, language_preference),
           theme = COALESCE($6, theme),
           notifications_enabled = COALESCE($7, notifications_enabled),
           voice_enabled = COALESCE($8, voice_enabled),
           ambient_listening = COALESCE($9, ambient_listening),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 
       RETURNING *`,
      [
        userId,
        sarcasm,
        verbosity,
        humor,
        language,
        theme,
        notifications,
        sound_effects,
        auto_save,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User settings not found' });
    }

    console.log('[UserRoute] ✅ User settings updated successfully');
    res.json({
      message: 'Settings updated successfully',
      settings: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserRoute] ❌ Error updating settings:', error);
    res.status(500).json({
      message: 'Failed to update settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ---------------------------------------------------------------------------
// Preferences Endpoints (Frontend expects /api/user/preferences)
// These mirror settings but use field names actually sent by the React app
// (sarcasm_level, verbosity [minimal|normal|verbose], humor_style, language_preference,
//  theme, notifications_enabled, voice_enabled, ambient_listening plus optional
//  voice_responses, sound_effects, camera_enabled, timezone)
// NOTE: DB currently lacks some optional columns (voice_responses, sound_effects,
// camera_enabled, timezone). We return them with defaults but only persist the
// columns that exist in user_preferences. A follow-up migration can add them.
// ---------------------------------------------------------------------------

// Get user preferences (alias separate from /settings for backwards compatibility)
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    let prefs = result.rows[0];
    if (!prefs) {
      // Create a default row (reuse logic from /settings)
      const insert = await db.query(
        `INSERT INTO user_preferences (user_id, sarcasm_level, verbosity, humor_style, language_preference, theme, notifications_enabled, voice_enabled, ambient_listening)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [userId, 5, 'normal', 'playful', 'en', 'dark', true, true, false]
      );
      prefs = insert.rows[0];
    }

    // Augment with virtual fields not yet persisted
    const responsePrefs = {
      sarcasm_level: prefs.sarcasm_level ?? 5,
      verbosity: prefs.verbosity || 'normal',
      humor_style: prefs.humor_style || 'playful',
      language_preference: prefs.language_preference || 'en',
      theme: prefs.theme || 'dark',
      notifications_enabled: prefs.notifications_enabled ?? true,
      voice_enabled: prefs.voice_enabled ?? true,
      ambient_listening: prefs.ambient_listening ?? false,
      // Virtual / default (not persisted yet):
      voice_responses: false,
      sound_effects: true,
      camera_enabled: false,
      timezone: 'America/New_York',
    };

    res.json(responsePrefs);
  } catch (error) {
    console.error('[UserRoute] ❌ Error fetching /preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences (maps verbosity synonyms & ignores unknown keys)
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sarcasm_level,
      verbosity,
      humor_style,
      language_preference,
      theme,
      notifications_enabled,
      voice_enabled,
      ambient_listening,
      // Optional / virtual fields (not persisted yet)
      voice_responses,
      sound_effects,
      camera_enabled,
      timezone,
    } = req.body || {};

    // Validation
    if (sarcasm_level !== undefined && (sarcasm_level < 0 || sarcasm_level > 10)) {
      return res.status(400).json({ error: 'sarcasm_level must be 0-10' });
    }
    if (verbosity && !['minimal', 'normal', 'verbose'].includes(verbosity)) {
      return res.status(400).json({ error: 'verbosity must be minimal|normal|verbose' });
    }

    // Map frontend verbosity to stored values (concise|normal|detailed)
    const verbosityMap = { minimal: 'concise', normal: 'normal', verbose: 'detailed' };
    const storedVerbosity = verbosity ? verbosityMap[verbosity] : undefined;

    // Ensure row exists
    const existing = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO user_preferences (user_id, sarcasm_level, verbosity, humor_style, language_preference, theme, notifications_enabled, voice_enabled, ambient_listening)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [userId, sarcasm_level ?? 5, storedVerbosity || 'normal', humor_style || 'playful', language_preference || 'en', theme || 'dark', notifications_enabled ?? true, voice_enabled ?? true, ambient_listening ?? false]
      );
    } else {
      // Build dynamic update set only for provided fields
      const fields = [];
      const values = [userId];
      let idx = 2;
      const pushField = (col, val) => { if (val !== undefined) { fields.push(`${col} = $${idx++}`); values.push(val); } };
      pushField('sarcasm_level', sarcasm_level);
      pushField('verbosity', storedVerbosity);
      pushField('humor_style', humor_style);
      pushField('language_preference', language_preference);
      pushField('theme', theme);
      pushField('notifications_enabled', notifications_enabled);
      pushField('voice_enabled', voice_enabled);
      pushField('ambient_listening', ambient_listening);

      if (fields.length > 0) {
        const sql = `UPDATE user_preferences SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`;
        await db.query(sql, values);
      }
    }

    // Re-fetch row to return consistent state
    const updated = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    const row = updated.rows[0];
    const responsePrefs = {
      sarcasm_level: row.sarcasm_level,
      // Convert stored (concise|normal|detailed) back to minimal|normal|verbose
      verbosity: row.verbosity === 'concise' ? 'minimal' : row.verbosity === 'detailed' ? 'verbose' : 'normal',
      humor_style: row.humor_style,
      language_preference: row.language_preference,
      theme: row.theme,
      notifications_enabled: row.notifications_enabled,
      voice_enabled: row.voice_enabled,
      ambient_listening: row.ambient_listening,
      // Echo virtual fields (not persisted yet) with defaults/fallbacks
      voice_responses: voice_responses ?? false,
      sound_effects: sound_effects ?? true,
      camera_enabled: camera_enabled ?? false,
      timezone: timezone || 'America/New_York',
    };

    res.json({ message: 'Preferences updated', preferences: responsePrefs });
  } catch (error) {
    console.error('[UserRoute] ❌ Error updating /preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user activity history
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🚀 GET /activity endpoint hit');

    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Get conversation history
    const conversationsResult = await db.query(
      `SELECT COUNT(*) as total_conversations,
              COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_conversations,
              MAX(created_at) as last_conversation
       FROM conversations WHERE user_id = $1`,
      [userId]
    );

    // Get recent agent interactions
    const agentResult = await db.query(
      `SELECT speaker, COUNT(*) as interactions, MAX(created_at) as last_interaction
       FROM conversations 
       WHERE user_id = $1 AND speaker != 'user'
       GROUP BY speaker 
       ORDER BY last_interaction DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const stats = conversationsResult.rows[0];
    const agentInteractions = agentResult.rows;

    res.json({
      activity: {
        conversation_stats: {
          total_conversations: parseInt(stats.total_conversations),
          recent_conversations: parseInt(stats.recent_conversations),
          last_conversation: stats.last_conversation,
        },
        agent_interactions: agentInteractions,
        generated_at: new Date().toISOString(),
      },
      pagination: {
        limit: limit,
        offset: offset,
        total: agentInteractions.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserRoute] ❌ Error fetching activity:', error);
    res.status(500).json({
      message: 'Failed to fetch user activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Delete user account
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🗑️ DELETE /me endpoint hit');

    const userId = req.user.id;
    const { confirm_password } = req.body;

    if (!confirm_password) {
      return res.status(400).json({
        message: 'Password confirmation required for account deletion',
      });
    }

    // Get user's password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      confirm_password,
      userResult.rows[0].password_hash
    );
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Begin transaction for account deletion
    await db.query('BEGIN');

    try {
      // Delete related data
      await db.query('DELETE FROM user_preferences WHERE user_id = $1', [
        userId,
      ]);
      await db.query('DELETE FROM conversations WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_api_keys WHERE user_id = $1', [userId]);

      // Delete user account
      await db.query('DELETE FROM users WHERE id = $1', [userId]);

      await db.query('COMMIT');

      console.log('[UserRoute] ✅ User account deleted successfully');
      res.json({
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (deleteError) {
      await db.query('ROLLBACK');
      throw deleteError;
    }
  } catch (error) {
    console.error('[UserRoute] ❌ Error deleting account:', error);
    res.status(500).json({
      message: 'Failed to delete account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
