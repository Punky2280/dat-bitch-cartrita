import express from 'express';

const router = express.Router();

router.get('/ping', (req, res) => {
  console.log('[SimpleTest] Ping endpoint accessed successfully');
  res.json({
    success: true,
    message: 'Simple test route working!',
    timestamp: new Date().toISOString(),
  });
});

// Simple chat endpoint for development/demo (no auth required)
router.post('/chat', async (req, res) => {
  console.log('[SimpleTest] Chat endpoint accessed');
  const { task = 'chat', prompt = '', options = {} } = req.body;
  
  try {
    // Simple mock response for demo purposes
    const mockResponse = {
      success: true,
      task,
      provider: 'demo',
      result: `Hello! I received your message: "${prompt}". This is a demo response from the Cartrita backend. The system is working correctly!`,
      timing_ms: Math.floor(Math.random() * 500) + 200,
      model_id: 'demo-model',
      timestamp: new Date().toISOString()
    };
    
    // Add small delay to simulate processing
    setTimeout(() => {
      res.json(mockResponse);
    }, 300);
    
  } catch (error) {
    console.error('[SimpleTest] Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      task
    });
  }
});

export default router;