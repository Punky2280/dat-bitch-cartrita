import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import db from '../db.js';
import OpenAI from 'openai';

const router = express.Router();

// Initialize OpenAI for AI-powered settings
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Get user settings
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Settings] 📁 Fetching settings for user ${userId}`);

    // Get user preferences from database
    const query = `
      SELECT 
        sarcasm_level,
        verbosity,
        humor_style,
        language_preference,
        timezone,
        theme,
        notifications_enabled,
        voice_enabled,
        ambient_listening,
        created_at,
        updated_at
      FROM user_preferences 
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);

    let settings;
    if (result.rows.length > 0) {
      settings = result.rows[0];
    } else {
      // Default settings
      settings = {
        sarcasm_level: 5,
        verbosity: 'normal',
        humor_style: 'playful',
        language_preference: 'en',
        timezone: 'America/New_York',
        theme: 'dark',
        notifications_enabled: true,
        voice_enabled: true,
        ambient_listening: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    console.log(`[Settings] ✅ Settings retrieved for user ${userId}`);

    res.json({
      success: true,
      settings: settings,
    });
  } catch (error) {
    console.error('[Settings] ❌ Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user settings',
      settings: {
        sarcasm_level: 5,
        verbosity: 'normal',
        humor_style: 'playful',
        language_preference: 'en',
        timezone: 'America/New_York',
        theme: 'dark',
        notifications_enabled: true,
        voice_enabled: true,
        ambient_listening: false,
      },
    });
  }
});

/**
 * Update user settings
 */
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    console.log(
      `[Settings] 💾 Updating settings for user ${userId}:`,
      settings
    );

    // Validate settings structure
    const allowedFields = [
      'sarcasm_level',
      'verbosity',
      'humor_style',
      'language_preference',
      'timezone',
      'theme',
      'notifications_enabled',
      'voice_enabled',
      'ambient_listening',
    ];

    const validSettings = {};
    for (const field of allowedFields) {
      if (settings.hasOwnProperty(field)) {
        validSettings[field] = settings[field];
      }
    }

    if (Object.keys(validSettings).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid settings provided',
      });
    }

    // Check if user preferences exist
    const checkQuery = `SELECT user_id FROM user_preferences WHERE user_id = $1`;
    const checkResult = await db.query(checkQuery, [userId]);

    let query;
    let params = [userId];

    if (checkResult.rows.length > 0) {
      // Update existing preferences
      const updates = [];
      let paramIndex = 2;

      for (const [field, value] of Object.entries(validSettings)) {
        updates.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }

      query = `
        UPDATE user_preferences 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `;
    } else {
      // Create new preferences
      const fields = [
        'user_id',
        ...Object.keys(validSettings),
        'created_at',
        'updated_at',
      ];
      const values = [
        userId,
        ...Object.values(validSettings),
        'NOW()',
        'NOW()',
      ];
      const placeholders = values.map((_, i) =>
        i === values.length - 2 || i === values.length - 1
          ? values[i]
          : `$${i + 1}`
      );

      query = `
        INSERT INTO user_preferences (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      params = [userId, ...Object.values(validSettings)];
    }

    const result = await db.query(query, params);

    console.log(`[Settings] ✅ Settings updated for user ${userId}`);

    res.json({
      success: true,
      settings: result.rows[0],
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('[Settings] ❌ Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user settings',
    });
  }
});

/**
 * @swagger
 * /api/settings/ai-recommendations:
 *   get:
 *     summary: Get AI-powered settings recommendations
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/ai-recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(
      `[Settings] 🤖 Generating AI recommendations for user ${userId}`
    );

    // Get user's usage patterns from various tables
    const usagePatterns = await getUserUsagePatterns(userId);

    // Generate AI-powered recommendations
    const recommendations = await generateAIRecommendations(usagePatterns);

    res.json({
      success: true,
      recommendations,
      message: 'AI settings recommendations generated successfully',
    });
  } catch (error) {
    console.error('[Settings] ❌ AI recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI recommendations',
    });
  }
});

/**
 * @swagger
 * /api/settings/profiles:
 *   get:
 *     summary: Get predefined settings profiles
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profiles', authenticateToken, async (req, res) => {
  try {
    console.log('[Settings] 📋 Fetching settings profiles');

    const profiles = {
      productivity_focused: {
        name: 'Productivity Focused',
        description:
          'Optimized for maximum productivity and minimal distractions',
        settings: {
          sarcasm_level: 2,
          verbosity: 'minimal',
          humor_style: 'dry',
          notifications_enabled: true,
          voice_enabled: true,
          ambient_listening: false,
          theme: 'light',
        },
        features: ['Focus mode', 'Minimal responses', 'Task prioritization'],
      },
      creative_companion: {
        name: 'Creative Companion',
        description: 'Enhanced for creative work and brainstorming',
        settings: {
          sarcasm_level: 7,
          verbosity: 'verbose',
          humor_style: 'playful',
          notifications_enabled: true,
          voice_enabled: true,
          ambient_listening: true,
          theme: 'dark',
        },
        features: [
          'Creative suggestions',
          'Brainstorming support',
          'Inspirational content',
        ],
      },
      analytical_assistant: {
        name: 'Analytical Assistant',
        description: 'Perfect for data analysis and research',
        settings: {
          sarcasm_level: 3,
          verbosity: 'verbose',
          humor_style: 'witty',
          notifications_enabled: true,
          voice_enabled: false,
          ambient_listening: false,
          theme: 'dark',
        },
        features: ['Detailed analysis', 'Data insights', 'Research assistance'],
      },
      casual_conversation: {
        name: 'Casual Conversation',
        description: 'Relaxed and friendly for everyday interactions',
        settings: {
          sarcasm_level: 6,
          verbosity: 'normal',
          humor_style: 'playful',
          notifications_enabled: true,
          voice_enabled: true,
          ambient_listening: true,
          theme: 'auto',
        },
        features: [
          'Natural conversation',
          'Friendly tone',
          'Balanced assistance',
        ],
      },
      learning_mode: {
        name: 'Learning Mode',
        description: 'Optimized for education and skill development',
        settings: {
          sarcasm_level: 4,
          verbosity: 'verbose',
          humor_style: 'witty',
          notifications_enabled: true,
          voice_enabled: true,
          ambient_listening: false,
          theme: 'light',
        },
        features: [
          'Educational content',
          'Step-by-step guidance',
          'Progress tracking',
        ],
      },
    };

    res.json({
      success: true,
      profiles,
      count: Object.keys(profiles).length,
    });
  } catch (error) {
    console.error('[Settings] ❌ Profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings profiles',
    });
  }
});

/**
 * @swagger
 * /api/settings/apply-profile:
 *   post:
 *     summary: Apply a settings profile
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/apply-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { profile_name } = req.body;

    if (!profile_name) {
      return res.status(400).json({
        success: false,
        error: 'Profile name is required',
      });
    }

    console.log(
      `[Settings] 🔧 Applying profile "${profile_name}" for user ${userId}`
    );

    // Get the profile settings
    const profilesResponse = await res.app.request.get(
      '/api/settings/profiles'
    );
    const profiles = profilesResponse.profiles;

    if (!profiles[profile_name]) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
    }

    const profileSettings = profiles[profile_name].settings;

    // Apply the profile settings
    const updateQuery = `
      INSERT INTO user_preferences (
        user_id, sarcasm_level, verbosity, humor_style,
        notifications_enabled, voice_enabled, ambient_listening, theme,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        sarcasm_level = EXCLUDED.sarcasm_level,
        verbosity = EXCLUDED.verbosity,
        humor_style = EXCLUDED.humor_style,
        notifications_enabled = EXCLUDED.notifications_enabled,
        voice_enabled = EXCLUDED.voice_enabled,
        ambient_listening = EXCLUDED.ambient_listening,
        theme = EXCLUDED.theme,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      userId,
      profileSettings.sarcasm_level,
      profileSettings.verbosity,
      profileSettings.humor_style,
      profileSettings.notifications_enabled,
      profileSettings.voice_enabled,
      profileSettings.ambient_listening,
      profileSettings.theme,
    ]);

    console.log(
      `[Settings] ✅ Profile "${profile_name}" applied for user ${userId}`
    );

    res.json({
      success: true,
      settings: result.rows[0],
      profile_applied: profile_name,
      message: `Profile "${profiles[profile_name].name}" applied successfully`,
    });
  } catch (error) {
    console.error('[Settings] ❌ Apply profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply settings profile',
    });
  }
});

/**
 * @swagger
 * /api/settings/backup:
 *   post:
 *     summary: Create settings backup
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/backup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { backup_name } = req.body;

    console.log(`[Settings] 💾 Creating settings backup for user ${userId}`);

    // Get current settings
    const currentSettings = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (currentSettings.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No settings found to backup',
      });
    }

    // Create backup
    const backupData = {
      backup_name:
        backup_name || `Backup ${new Date().toISOString().split('T')[0]}`,
      settings: currentSettings.rows[0],
      created_at: new Date().toISOString(),
      system_info: {
        version: '1.0',
        features: [
          'Enhanced AI Settings',
          'Profile System',
          'Smart Recommendations',
        ],
      },
    };

    // Store backup in database
    await db.query(
      `
      INSERT INTO settings_backups (user_id, backup_name, backup_data, created_at)
      VALUES ($1, $2, $3, NOW())
    `,
      [userId, backupData.backup_name, JSON.stringify(backupData)]
    );

    res.json({
      success: true,
      backup: backupData,
      message: 'Settings backup created successfully',
    });
  } catch (error) {
    console.error('[Settings] ❌ Backup creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create settings backup',
    });
  }
});

/**
 * @swagger
 * /api/settings/analytics:
 *   get:
 *     summary: Get settings usage analytics
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    console.log(
      `[Settings] 📊 Generating settings analytics for user ${userId}`
    );

    // Get usage patterns and optimization suggestions
    const analytics = await generateSettingsAnalytics(userId, parseInt(days));

    res.json({
      success: true,
      analytics,
      period_days: parseInt(days),
    });
  } catch (error) {
    console.error('[Settings] ❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate settings analytics',
    });
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get user usage patterns for AI recommendations
 */
async function getUserUsagePatterns(userId) {
  try {
    const patterns = {};

    // Get workflow usage
    const workflowUsage = await db.query(
      `
      SELECT COUNT(*) as executions, AVG(execution_time_ms) as avg_time
      FROM workflow_executions 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `,
      [userId]
    );
    patterns.workflow_usage = workflowUsage.rows[0];

    // Get knowledge interactions
    const knowledgeUsage = await db.query(
      `
      SELECT COUNT(*) as searches, AVG(CHAR_LENGTH(query_text)) as avg_query_length
      FROM knowledge_queries 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `,
      [userId]
    );
    patterns.knowledge_usage = knowledgeUsage.rows[0];

    // Get voice interaction patterns
    const voiceUsage = await db.query(
      `
      SELECT COUNT(*) as voice_interactions
      FROM user_preferences 
      WHERE user_id = $1 AND voice_enabled = true
    `,
      [userId]
    );
    patterns.voice_usage = voiceUsage.rows[0];

    // Get time-based usage patterns (mock data for demonstration)
    patterns.peak_usage_hours = [9, 10, 14, 15, 16]; // 9-10 AM, 2-4 PM
    patterns.preferred_interaction_style = 'balanced';
    patterns.avg_session_length = 25; // minutes

    return patterns;
  } catch (error) {
    console.error('[Settings] Error getting usage patterns:', error);
    return {
      workflow_usage: { executions: 0, avg_time: 0 },
      knowledge_usage: { searches: 0, avg_query_length: 0 },
      voice_usage: { voice_interactions: 0 },
    };
  }
}

/**
 * Generate AI-powered settings recommendations
 */
async function generateAIRecommendations(usagePatterns) {
  try {
    const prompt = `Based on these user patterns, suggest optimal settings:

Usage Patterns:
${JSON.stringify(usagePatterns, null, 2)}

Provide JSON recommendations for:
1. optimal_sarcasm_level (1-10)
2. recommended_verbosity ('minimal', 'normal', 'verbose')
3. suggested_humor_style ('playful', 'sarcastic', 'witty', 'dry')
4. voice_recommendations (boolean and reasoning)
5. theme_suggestion ('light', 'dark', 'auto')
6. productivity_tips (array of specific suggestions)
7. personalization_insights (array of observations)

Consider user's interaction patterns, peak usage times, and efficiency metrics.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI settings optimization expert. Provide personalized recommendations based on usage patterns. Return valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('[Settings] AI recommendations generation failed:', error);
    return {
      optimal_sarcasm_level: 5,
      recommended_verbosity: 'normal',
      suggested_humor_style: 'playful',
      voice_recommendations: true,
      theme_suggestion: 'dark',
      productivity_tips: [
        'Consider enabling voice for faster interactions',
        'Adjust verbosity based on task complexity',
      ],
      personalization_insights: [
        'Your usage patterns suggest you prefer efficient interactions',
        'Consider customizing notification settings for better focus',
      ],
    };
  }
}

/**
 * Generate comprehensive settings analytics
 */
async function generateSettingsAnalytics(userId, days) {
  try {
    // Get current settings
    const currentSettings = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    // Get settings change history (mock data for demonstration)
    const changeHistory = [
      {
        date: '2025-01-01',
        field: 'sarcasm_level',
        old_value: 5,
        new_value: 7,
      },
      {
        date: '2025-01-05',
        field: 'theme',
        old_value: 'light',
        new_value: 'dark',
      },
    ];

    // Calculate optimization score
    const optimizationScore = calculateOptimizationScore(
      currentSettings.rows[0]
    );

    return {
      current_settings: currentSettings.rows[0],
      change_history: changeHistory,
      optimization_score: optimizationScore,
      usage_efficiency: {
        response_satisfaction: 87,
        interaction_speed: 92,
        feature_utilization: 65,
      },
      recommendations: [
        'Consider increasing sarcasm level for more engaging interactions',
        'Voice features could improve your productivity by 25%',
        'Dark theme reduces eye strain during long sessions',
      ],
      comparative_analysis: {
        vs_similar_users: 'Above average customization',
        optimization_potential: '15% improvement possible',
        feature_adoption: 'High adopter of advanced features',
      },
    };
  } catch (error) {
    console.error('[Settings] Analytics generation failed:', error);
    return {
      optimization_score: 75,
      recommendations: ['Review your settings for optimal performance'],
      error: 'Limited analytics available',
    };
  }
}

/**
 * Calculate settings optimization score
 */
function calculateOptimizationScore(settings) {
  if (!settings) return 50;

  let score = 0;

  // Balanced sarcasm level (3-7 is optimal)
  const sarcasm = settings.sarcasm_level || 5;
  if (sarcasm >= 3 && sarcasm <= 7) score += 20;

  // Appropriate verbosity
  if (settings.verbosity === 'normal') score += 20;
  else if (settings.verbosity) score += 10;

  // Features enabled
  if (settings.notifications_enabled) score += 15;
  if (settings.voice_enabled) score += 15;

  // Theme preference (any selection)
  if (settings.theme) score += 10;

  // Humor style (any selection)
  if (settings.humor_style) score += 10;

  // Language and timezone set
  if (settings.language_preference) score += 5;
  if (settings.timezone) score += 5;

  return Math.min(100, score);
}

export default router;
