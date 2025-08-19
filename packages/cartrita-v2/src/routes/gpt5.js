/**
 * GPT-5 Advanced Features API Routes
 * Provides access to verbosity control, freeform function calling, CFG support, minimal reasoning
 * Created: January 27, 2025
 */

import express from 'express';
import GPT5Service from '../services/GPT5Service.js';
import { getOptimalModelForAgent, getAllAgentAssignments } from '../config/gpt5-models.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();
let gpt5Service = null;

// Initialize service
const initializeService = async () => {
  if (!gpt5Service) {
    gpt5Service = new GPT5Service();
    await gpt5Service.initialize();
  }
};

/**
 * Generate text with GPT-5 advanced features
 * POST /api/v2/gpt5/generate
 */
router.post('/generate', async (req, res) => {
  try {
    await initializeService();
    
    const {
      prompt,
      model = 'gpt-5',
      verbosity = 'medium',
      reasoning = 'standard',
      enableFreeformCalling = false,
      cfgConstraints = null,
      temperature = 0.7,
      maxTokens = null
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const userId = req.user?.id || req.headers['user-id'];

    const result = await gpt5Service.generateWithAdvancedFeatures(prompt, {
      model,
      verbosity,
      reasoning,
      enableFreeformCalling,
      cfgConstraints,
      temperature,
      maxTokens,
      userId
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[GPT5Routes] Generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Generation failed',
      details: error.message
    });
  }
});

/**
 * Get verbosity-adjusted response
 * POST /api/v2/gpt5/verbosity
 */
router.post('/verbosity', async (req, res) => {
  try {
    await initializeService();
    
    const { prompt, verbosity = 'medium', ...options } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const result = await gpt5Service.getVerbosityAdjustedResponse(prompt, verbosity, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[GPT5Routes] Verbosity adjustment failed:', error);
    res.status(500).json({
      success: false,
      error: 'Verbosity adjustment failed',
      details: error.message
    });
  }
});

/**
 * Execute freeform function calling
 * POST /api/v2/gpt5/freeform
 */
router.post('/freeform', async (req, res) => {
  try {
    await initializeService();
    
    const { prompt, tools = [], ...options } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const result = await gpt5Service.executeFreeformFunctionCalling(prompt, {
      tools,
      ...options
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[GPT5Routes] Freeform calling failed:', error);
    res.status(500).json({
      success: false,
      error: 'Freeform calling failed',
      details: error.message
    });
  }
});

/**
 * Generate with Context-Free Grammar constraints
 * POST /api/v2/gpt5/cfg
 */
router.post('/cfg', async (req, res) => {
  try {
    await initializeService();
    
    const { prompt, grammar, ...options } = req.body;

    if (!prompt || !grammar) {
      return res.status(400).json({
        success: false,
        error: 'Both prompt and grammar are required'
      });
    }

    const result = await gpt5Service.generateWithCFGConstraints(prompt, grammar, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[GPT5Routes] CFG generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'CFG generation failed',
      details: error.message
    });
  }
});

/**
 * Get minimal reasoning response for speed
 * POST /api/v2/gpt5/minimal
 */
router.post('/minimal', async (req, res) => {
  try {
    await initializeService();
    
    const { prompt, ...options } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const result = await gpt5Service.getMinimalReasoningResponse(prompt, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[GPT5Routes] Minimal reasoning failed:', error);
    res.status(500).json({
      success: false,
      error: 'Minimal reasoning failed',
      details: error.message
    });
  }
});

/**
 * Get optimal model for agent
 * GET /api/v2/gpt5/models/:agentName
 */
router.get('/models/:agentName', (req, res) => {
  try {
    const { agentName } = req.params;
    const modelConfig = getOptimalModelForAgent(agentName);

    res.json({
      success: true,
      data: {
        agent: agentName,
        ...modelConfig
      }
    });

  } catch (error) {
    console.error('[GPT5Routes] Model retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Model retrieval failed',
      details: error.message
    });
  }
});

/**
 * Get all agent model assignments
 * GET /api/v2/gpt5/models
 */
router.get('/models', (req, res) => {
  try {
    const assignments = getAllAgentAssignments();

    res.json({
      success: true,
      data: assignments
    });

  } catch (error) {
    console.error('[GPT5Routes] Model assignments retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Model assignments retrieval failed',
      details: error.message
    });
  }
});

/**
 * Get supported features for a model
 * GET /api/v2/gpt5/features/:model
 */
router.get('/features/:model', async (req, res) => {
  try {
    await initializeService();
    
    const { model } = req.params;
    const features = gpt5Service.getSupportedFeatures(model);

    res.json({
      success: true,
      data: {
        model,
        features
      }
    });

  } catch (error) {
    console.error('[GPT5Routes] Features retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Features retrieval failed',
      details: error.message
    });
  }
});

/**
 * Get GPT-5 service metrics
 * GET /api/v2/gpt5/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    await initializeService();
    
    const metrics = gpt5Service.getMetrics();

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('[GPT5Routes] Metrics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics retrieval failed',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 * GET /api/v2/gpt5/health
 */
router.get('/health', async (req, res) => {
  try {
    await initializeService();
    
    const isHealthy = gpt5Service.initialized;
    const metrics = gpt5Service.getMetrics();

    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        initialized: gpt5Service.initialized,
        supportedModels: metrics.supportedModels,
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        averageResponseTime: metrics.averageResponseTime
      }
    });

  } catch (error) {
    console.error('[GPT5Routes] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

export default router;