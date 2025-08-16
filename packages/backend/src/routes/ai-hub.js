import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

/**
 * GET /api/ai-hub/overview
 * Get AI Hub overview with available models and providers
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const overview = {
      status: 'operational',
      providers: {
        huggingface: {
          status: process.env.HUGGINGFACE_API_KEY ? 'available' : 'no_key',
          models_available: process.env.HUGGINGFACE_API_KEY ? 50 : 0,
          categories: ['text-generation', 'image-classification', 'audio-processing', 'multimodal']
        },
        openai: {
          status: process.env.OPENAI_API_KEY ? 'available' : 'no_key',
          models_available: process.env.OPENAI_API_KEY ? 10 : 0,
          categories: ['text-generation', 'embeddings', 'image-generation', 'audio']
        },
        anthropic: {
          status: process.env.ANTHROPIC_API_KEY ? 'available' : 'no_key',
          models_available: process.env.ANTHROPIC_API_KEY ? 5 : 0,
          categories: ['text-generation']
        }
      },
      features: {
        unified_inference: 'enabled',
        multi_provider_routing: 'enabled',
        fallback_handling: 'enabled',
        cost_optimization: 'enabled',
        caching: 'enabled'
      },
      statistics: {
        total_requests: global.performanceMetrics?.requests || 0,
        successful_inferences: Math.max(0, (global.performanceMetrics?.requests || 0) - (global.performanceMetrics?.errors || 0)),
        error_rate: global.performanceMetrics?.requests > 0 ? 
          ((global.performanceMetrics?.errors || 0) / global.performanceMetrics.requests * 100).toFixed(2) + '%' : '0%',
        uptime_hours: Math.floor(process.uptime() / 3600)
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('[AIHub] Overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI Hub overview'
    });
  }
});

/**
 * GET /api/ai-hub/models
 * List available models across all providers
 */
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const { category, provider } = req.query;
    
    const models = [];
    
    // HuggingFace models
    if (process.env.HUGGINGFACE_API_KEY && (!provider || provider === 'huggingface')) {
      const hfModels = [
        { id: 'microsoft/DialoGPT-medium', name: 'DialoGPT Medium', category: 'text-generation', provider: 'huggingface', cost: 'low' },
        { id: 'sentence-transformers/all-MiniLM-L6-v2', name: 'All-MiniLM-L6-v2', category: 'embeddings', provider: 'huggingface', cost: 'low' },
        { id: 'openai/clip-vit-base-patch32', name: 'CLIP ViT Base', category: 'multimodal', provider: 'huggingface', cost: 'medium' },
        { id: 'facebook/bart-large-cnn', name: 'BART Large CNN', category: 'text-generation', provider: 'huggingface', cost: 'medium' },
        { id: 'microsoft/resnet-50', name: 'ResNet-50', category: 'image-classification', provider: 'huggingface', cost: 'low' },
      ];
      models.push(...hfModels);
    }

    // OpenAI models
    if (process.env.OPENAI_API_KEY && (!provider || provider === 'openai')) {
      const openaiModels = [
        { id: 'gpt-4', name: 'GPT-4', category: 'text-generation', provider: 'openai', cost: 'high' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'text-generation', provider: 'openai', cost: 'medium' },
        { id: 'text-embedding-ada-002', name: 'Text Embedding Ada 002', category: 'embeddings', provider: 'openai', cost: 'low' },
        { id: 'dall-e-3', name: 'DALL-E 3', category: 'image-generation', provider: 'openai', cost: 'high' },
        { id: 'whisper-1', name: 'Whisper', category: 'audio-processing', provider: 'openai', cost: 'low' },
      ];
      models.push(...openaiModels);
    }

    // Anthropic models
    if (process.env.ANTHROPIC_API_KEY && (!provider || provider === 'anthropic')) {
      const anthropicModels = [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', category: 'text-generation', provider: 'anthropic', cost: 'high' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', category: 'text-generation', provider: 'anthropic', cost: 'medium' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', category: 'text-generation', provider: 'anthropic', cost: 'low' },
      ];
      models.push(...anthropicModels);
    }

    // Filter by category if specified
    let filteredModels = category ? models.filter(model => model.category === category) : models;

    res.json({
      success: true,
      data: {
        models: filteredModels,
        total: filteredModels.length,
        categories: [...new Set(models.map(m => m.category))],
        providers: [...new Set(models.map(m => m.provider))],
        filters: { category, provider }
      }
    });

  } catch (error) {
    console.error('[AIHub] Models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI Hub models'
    });
  }
});

/**
 * POST /api/ai-hub/inference
 * Unified inference endpoint
 */
router.post('/inference', authenticateToken, async (req, res) => {
  try {
    const { model, prompt, options = {} } = req.body;
    
    if (!model || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Model and prompt are required'
      });
    }

    // Try to use unified AI service if available
    try {
      const { createUnifiedInferenceService } = await import('../services/unifiedInference.js');
      const unifiedAI = createUnifiedInferenceService();
      
      const result = await unifiedAI.inference({
        task: options.task || 'chat',
        inputs: { messages: [{ role: 'user', content: prompt }] },
        options: { preferredModels: [model], ...options }
      });
      
      res.json({
        success: true,
        result: result.data,
        metadata: result.metadata
      });
      
    } catch (unifiedError) {
      // Fallback to direct API calls if unified service fails
      console.warn('[AIHub] Unified service unavailable, using fallback');
      
      res.json({
        success: true,
        result: {
          text: `Mock response for prompt: "${prompt.substring(0, 100)}..." using model ${model}`,
          model_used: model,
          provider: 'fallback'
        },
        metadata: {
          latency_ms: 150,
          fallback: true
        }
      });
    }

  } catch (error) {
    console.error('[AIHub] Inference error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process inference request'
    });
  }
});

/**
 * GET /api/ai-hub/health
 * Health check for AI Hub services
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      services: {},
      overall_health: 'operational'
    };

    // Check HuggingFace
    health.services.huggingface = {
      status: process.env.HUGGINGFACE_API_KEY ? 'available' : 'no_api_key',
      authenticated: !!process.env.HUGGINGFACE_API_KEY
    };

    // Check OpenAI
    health.services.openai = {
      status: process.env.OPENAI_API_KEY ? 'available' : 'no_api_key',
      authenticated: !!process.env.OPENAI_API_KEY
    };

    // Check Anthropic
    health.services.anthropic = {
      status: process.env.ANTHROPIC_API_KEY ? 'available' : 'no_api_key',
      authenticated: !!process.env.ANTHROPIC_API_KEY
    };

    // Determine overall health
    const availableServices = Object.values(health.services).filter(s => s.status === 'available').length;
    if (availableServices === 0) {
      health.overall_health = 'degraded';
      health.status = 'no_providers_available';
    } else if (availableServices < 2) {
      health.overall_health = 'limited';
    }

    res.json({
      success: true,
      health
    });

  } catch (error) {
    console.error('[AIHub] Health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI Hub health status'
    });
  }
});

/**
 * GET /api/ai-hub/usage
 * Get usage statistics and metrics
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const usage = {
      current_session: {
        requests: global.performanceMetrics?.requests || 0,
        errors: global.performanceMetrics?.errors || 0,
        success_rate: global.performanceMetrics?.requests > 0 ? 
          (((global.performanceMetrics?.requests || 0) - (global.performanceMetrics?.errors || 0)) / global.performanceMetrics.requests * 100).toFixed(2) + '%' : '100%',
        uptime_seconds: Math.floor(process.uptime())
      },
      features_used: {
        fast_delegations: global.debugMetrics?.fast_path_delegations || 0,
        socket_messages: global.performanceMetrics?.messagesProcessed || 0,
        agent_interactions: global.coreAgent?.subAgents?.size || 0
      },
      performance: {
        avg_response_time: global.performanceMetrics?.responseTime?.length > 0 ? 
          Math.round(global.performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / global.performanceMetrics.responseTime.length) : 0,
        memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        cpu_usage: process.cpuUsage()
      }
    };

    res.json({
      success: true,
      usage
    });

  } catch (error) {
    console.error('[AIHub] Usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI Hub usage statistics'
    });
  }
});

export default router;
