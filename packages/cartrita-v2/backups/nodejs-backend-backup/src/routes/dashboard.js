import express from 'express';

const router = express.Router();

// Dashboard health endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    service: 'dashboard',
    timestamp: new Date().toISOString(),
  });
});

// Dashboard status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard service is operational',
    features: ['metrics', 'analytics', 'monitoring'],
    timestamp: new Date().toISOString(),
  });
});

export default router;
