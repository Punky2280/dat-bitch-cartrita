import express from 'express';
import SecurityMaskingService from '../services/SecurityMaskingService.js';
import flexibleAuth from '../middleware/flexibleAuth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(flexibleAuth);

/**
 * GET /api/security-masking/preferences
 * Get user's masking preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences =
      await SecurityMaskingService.getMaskingPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error getting preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve masking preferences',
    });
  }
});

/**
 * PUT /api/security-masking/preferences
 * Update user's masking preferences
 */
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    // Validate preferences
    const validVisibility = ['visible', 'masked', 'hidden'];
    if (
      preferences.default_visibility &&
      !validVisibility.includes(preferences.default_visibility)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid default_visibility value',
      });
    }

    if (
      preferences.reveal_timeout &&
      (preferences.reveal_timeout < 10 || preferences.reveal_timeout > 300)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Reveal timeout must be between 10 and 300 seconds',
      });
    }

    const updatedPreferences =
      await SecurityMaskingService.updateMaskingPreferences(
        userId,
        preferences
      );

    res.json({
      success: true,
      data: updatedPreferences,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update masking preferences',
    });
  }
});

/**
 * POST /api/security-masking/reveal-token
 * Create a reveal token for sensitive data access
 */
router.post('/reveal-token', async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_id, resource_type } = req.body;

    if (!resource_id || !resource_type) {
      return res.status(400).json({
        success: false,
        error: 'resource_id and resource_type are required',
      });
    }

    const tokenData = await SecurityMaskingService.createRevealToken(
      userId,
      resource_id,
      resource_type
    );

    res.json({
      success: true,
      data: tokenData,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error creating reveal token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reveal token',
    });
  }
});

/**
 * POST /api/security-masking/reveal
 * Use a reveal token to access sensitive data
 */
router.post('/reveal', async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reveal token is required',
      });
    }

    const revealData = await SecurityMaskingService.useRevealToken(
      token,
      userId
    );

    res.json({
      success: true,
      data: revealData,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error using reveal token:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid or expired reveal token',
    });
  }
});

/**
 * POST /api/security-masking/mask
 * Get masked version of sensitive data
 */
router.post('/mask', async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, data_type = 'api_key' } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data to mask is required',
      });
    }

    const maskedData = await SecurityMaskingService.maskSensitiveData(
      userId,
      data,
      data_type
    );

    res.json({
      success: true,
      data: {
        masked: maskedData,
        original_length: data.length,
      },
    });
  } catch (error) {
    console.error('[SecurityMasking] Error masking data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mask data',
    });
  }
});

/**
 * GET /api/security-masking/events
 * Get security events audit log
 */
router.get('/events', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100 events',
      });
    }

    const events = await SecurityMaskingService.getSecurityEvents(
      userId,
      limit
    );

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error getting security events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security events',
    });
  }
});

/**
 * GET /api/security-masking/analytics
 * Get masking and security analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const analytics = await SecurityMaskingService.getMaskingAnalytics(userId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve masking analytics',
    });
  }
});

/**
 * DELETE /api/security-masking/cleanup
 * Clean up expired reveal tokens
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SecurityMaskingService.cleanupExpiredTokens(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[SecurityMasking] Error cleaning up tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup expired tokens',
    });
  }
});

export default router;
