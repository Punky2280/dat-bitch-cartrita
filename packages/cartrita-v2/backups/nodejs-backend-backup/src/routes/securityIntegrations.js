import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';

const router = express.Router();

// Router index (public) to avoid 404 on base path
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'security',
    status: 'operational',
    endpoints: [
      '/health',
      '/status',
      '/metrics',
      '/scan',
      '/events',
      '/log-event',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Security health endpoint (public)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    service: 'security',
    timestamp: new Date().toISOString(),
  });
});

// Security status endpoint (public)
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Security service is operational',
    features: [
      'authentication',
      'authorization',
      'monitoring',
      'vulnerability_scanning',
      'audit_logging',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Security metrics endpoint (authenticated)
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = SecurityAuditLogger.getSecurityMetrics();
    res.json({
      success: true,
      ...metrics,
    });
  } catch (error) {
    console.error('[Security] Metrics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Vulnerability scan endpoint (authenticated)
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { scan_type = 'basic', target_components = [] } = req.body;

    console.log('[Security] Starting vulnerability scan...');
    const scanResults = await SecurityAuditLogger.performVulnerabilityScan({
      scan_type,
      target_components,
      user_id: req.user?.id,
    });

    res.json({
      success: true,
      scan: scanResults,
    });
  } catch (error) {
    console.error('[Security] Vulnerability scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Vulnerability scan failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Security events endpoint (authenticated)
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const events = await SecurityAuditLogger.getRecentEvents(limit);

    res.json({
      success: true,
      events,
      count: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Security] Events fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security events',
      timestamp: new Date().toISOString(),
    });
  }
});

// Log security event endpoint (authenticated)
router.post('/log-event', authenticateToken, async (req, res) => {
  try {
    const { eventType, details = {} } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required',
      });
    }

    const logEntry = await SecurityAuditLogger.logSecurityEvent(eventType, {
      ...details,
      user_id: req.user?.id,
      source: 'api_endpoint',
    });

    res.json({
      success: true,
      logEntry,
    });
  } catch (error) {
    console.error('[Security] Event logging failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log security event',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
