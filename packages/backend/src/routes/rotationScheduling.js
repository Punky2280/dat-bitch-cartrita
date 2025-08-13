import express from 'express';
import flexibleAuth from '../middleware/flexibleAuth.js';
import RotationSchedulingService from '../services/RotationSchedulingService.js';

const router = express.Router();

// All rotation endpoints require authentication (JWT or API key)
router.use(flexibleAuth);

/**
 * GET /api/rotation-scheduling/policies
 * Get all rotation policies for the authenticated user
 */
router.get('/policies', async (req, res) => {
  try {
    const policies = await RotationSchedulingService.getRotationPolicies(req.user.id);
    res.json({
      success: true,
      policies
    });
  } catch (error) {
    console.error('[RotationAPI] Error getting policies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rotation-scheduling/policies
 * Create or update a rotation policy
 */
router.post('/policies', async (req, res) => {
  try {
    const policy = await RotationSchedulingService.saveRotationPolicy(req.user.id, req.body);
    res.json({
      success: true,
      policy,
      message: req.body.id ? 'Policy updated successfully' : 'Policy created successfully'
    });
  } catch (error) {
    console.error('[RotationAPI] Error saving policy:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/rotation-scheduling/policies/:id
 * Delete a rotation policy
 */
router.delete('/policies/:id', async (req, res) => {
  try {
    const result = await RotationSchedulingService.deleteRotationPolicy(req.user.id, parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('[RotationAPI] Error deleting policy:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rotation-scheduling/policies/test
 * Test a rotation policy (dry run)
 */
router.post('/policies/test', async (req, res) => {
  try {
    const result = await RotationSchedulingService.testRotationPolicy(req.user.id, req.body);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[RotationAPI] Error testing policy:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rotation-scheduling/keys/needing-rotation
 * Get keys that need rotation for the authenticated user
 */
router.get('/keys/needing-rotation', async (req, res) => {
  try {
    const keys = await RotationSchedulingService.getKeysNeedingRotation(req.user.id);
    res.json({
      success: true,
      keys,
      count: keys.length
    });
  } catch (error) {
    console.error('[RotationAPI] Error getting keys needing rotation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rotation-scheduling/schedule
 * Schedule a manual rotation for a specific key
 */
router.post('/schedule', async (req, res) => {
  try {
    const { keyId, reason } = req.body;
    const result = await RotationSchedulingService.scheduleRotation(
      req.user.id, 
      keyId, 
      reason, 
      req.user.id
    );
    res.json(result);
  } catch (error) {
    console.error('[RotationAPI] Error scheduling rotation:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rotation-scheduling/complete
 * Complete a manual rotation with the new key
 */
router.post('/complete', async (req, res) => {
  try {
    const { eventId, newKey } = req.body;
    const result = await RotationSchedulingService.completeRotation(
      req.user.id, 
      eventId, 
      newKey
    );
    res.json(result);
  } catch (error) {
    console.error('[RotationAPI] Error completing rotation:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rotation-scheduling/history
 * Get rotation history for the authenticated user
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await RotationSchedulingService.getRotationHistory(req.user.id, limit);
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('[RotationAPI] Error getting rotation history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rotation-scheduling/analytics
 * Get rotation analytics and metrics for the authenticated user
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await RotationSchedulingService.getRotationAnalytics(req.user.id);
    res.json({
      success: true,
      ...analytics
    });
  } catch (error) {
    console.error('[RotationAPI] Error getting rotation analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rotation-scheduling/status
 * Get overall rotation status and health
 */
router.get('/status', async (req, res) => {
  try {
    const [analytics, overdueKeys] = await Promise.all([
      RotationSchedulingService.getRotationAnalytics(req.user.id),
      RotationSchedulingService.getKeysNeedingRotation(req.user.id)
    ]);
    
    const overdueCount = overdueKeys.filter(k => k.rotation_status === 'overdue').length;
    const warningCount = overdueKeys.filter(k => k.rotation_status === 'warning').length;
    
    const status = overdueCount > 0 ? 'critical' : 
                  warningCount > 0 ? 'warning' : 'healthy';
    
    res.json({
      success: true,
      status,
      summary: {
        total_keys: parseInt(analytics.summary.total_keys) || 0,
        overdue_keys: overdueCount,
        warning_keys: warningCount,
        healthy_keys: (parseInt(analytics.summary.total_keys) || 0) - overdueCount - warningCount,
        last_rotation: analytics.summary.last_rotation_date
      },
      details: {
        overdue_by_provider: analytics.overdue_by_provider,
        recent_activity: analytics.recent_activity
      }
    });
  } catch (error) {
    console.error('[RotationAPI] Error getting rotation status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;