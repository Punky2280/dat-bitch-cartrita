import express from 'express';

const router = express.Router();

// Simple test route without authentication
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test route working',
    timestamp: new Date().toISOString() 
  });
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    route: 'test-health'
  });
});

export default router;
