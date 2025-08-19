import express from 'express';

const router = express.Router();

// Test health endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'operational', 
    service: 'test',
    timestamp: new Date().toISOString()
  });
});

// Test status endpoint
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test service is operational',
    features: ['endpoint-testing', 'integration-tests', 'smoke-tests'],
    timestamp: new Date().toISOString()
  });
});

export default router;