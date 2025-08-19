import express from 'express';

const router = express.Router();

router.get('/ping', (req, res) => {
  console.log('[SimpleTest] Ping endpoint accessed successfully');
  res.json({ 
    success: true, 
    message: 'Simple test route working!',
    timestamp: new Date().toISOString()
  });
});

export default router;