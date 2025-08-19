import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

let aiHubService = null;

// Initialize AI Hub Service (called from server.js)
export function initializeAIHubService(service) {
  aiHubService = service;
  console.log('[AI-Hub] ✅ AI Hub service connected to routes');
}

// AI Hub health endpoint
router.get('/health', async (req, res) => {
  try {
    console.log('[AI-Hub] Health endpoint accessed');
    
    if (aiHubService) {
      const health = await aiHubService.healthCheck();
      res.json({
        ...health,
        service: 'ai-hub'
      });
    } else {
      res.json({ 
        success: true, 
        status: 'operational', 
        service: 'ai-hub',
        warning: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[AI-Hub] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// AI Hub status endpoint
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'AI Hub service is operational',
    features: ['model-catalog', 'unified-inference', 'knowledge-integration', 'caching', 'analytics'],
    initialized: !!aiHubService,
    timestamp: new Date().toISOString()
  });
});

// Get model catalog with pagination and filtering
router.get('/models', async (req, res) => {
  try {
    if (!aiHubService) {
      return res.status(503).json({
        success: false,
        error: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const {
      page = 1,
      limit = 20,
      category = 'all',
      provider = 'all',
      tier = 'all',
      capability = 'all',
      useCache = 'true'
    } = req.query;

    const catalog = await aiHubService.getModelCatalog({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 per page
      category,
      provider,
      tier,
      capability,
      useCache: useCache === 'true'
    });

    res.json(catalog);
  } catch (error) {
    console.error('[AI-Hub] Model catalog error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve model catalog',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Execute model inference
router.post('/inference', authenticateToken, async (req, res) => {
  try {
    if (!aiHubService) {
      return res.status(503).json({
        success: false,
        error: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const { task, inputs, modelId, options = {} } = req.body;

    if (!task || !inputs) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task and inputs',
        timestamp: new Date().toISOString()
      });
    }

    const result = await aiHubService.executeInference({
      task,
      inputs,
      modelId,
      options: {
        ...options,
        userId: req.user?.id || req.userId
      }
    });

    res.json(result);
  } catch (error) {
    console.error('[AI-Hub] Inference error:', error);
    res.status(500).json({
      success: false,
      error: 'Inference execution failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search Knowledge Hub with AI enhancement
router.post('/knowledge/search', authenticateToken, async (req, res) => {
  try {
    if (!aiHubService) {
      return res.status(503).json({
        success: false,
        error: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const { query, limit = 10, enhanceWithAI = true, useInference = true } = req.body;
    const userId = req.user?.id || req.userId;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: query',
        timestamp: new Date().toISOString()
      });
    }

    const result = await aiHubService.searchKnowledgeHub(userId, query, {
      limit: Math.min(parseInt(limit), 50), // Max 50 results
      enhanceWithAI: enhanceWithAI === true,
      useInference: useInference === true
    });

    res.json(result);
  } catch (error) {
    console.error('[AI-Hub] Knowledge search error:', error);
    res.status(500).json({
      success: false,
      error: 'Knowledge search failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get AI Hub analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    if (!aiHubService) {
      return res.status(503).json({
        success: false,
        error: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const analytics = await aiHubService.getHubAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('[AI-Hub] Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear AI Hub cache
router.post('/cache/clear', authenticateToken, async (req, res) => {
  try {
    if (!aiHubService) {
      return res.status(503).json({
        success: false,
        error: 'AI Hub service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const { type = 'all' } = req.body;

    // Only allow admins to clear cache (placeholder check)
    // TODO: Implement proper role-based access control
    
    aiHubService.clearCache(type);
    
    res.json({
      success: true,
      message: `Cache cleared: ${type}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AI-Hub] Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Cache clear failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to verify routing works
router.get('/test', (req, res) => {
  console.log('[AI-Hub] Test endpoint accessed');
  res.json({ 
    success: true, 
    message: 'AI Hub test endpoint working',
    serviceInitialized: !!aiHubService,
    timestamp: new Date().toISOString()
  });
});

export default router;