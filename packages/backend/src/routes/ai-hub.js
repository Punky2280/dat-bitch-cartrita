import express from 'express';

const router = express.Router();

// AI Hub health endpoint
router.get('/health', (req, res) => {
  console.log('[AI-Hub] Health endpoint accessed');
  res.json({ 
    success: true, 
    status: 'operational', 
    service: 'ai-hub',
    timestamp: new Date().toISOString()
  });
});

// AI Hub status endpoint
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'AI Hub service is operational',
    features: ['model-routing', 'inference', 'analytics'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify routing works
router.get('/test', (req, res) => {
  console.log('[AI-Hub] Test endpoint accessed');
  res.json({ 
    success: true, 
    message: 'AI Hub test endpoint working',
    timestamp: new Date().toISOString()
  });
});

export default router;