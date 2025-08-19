/**
 * HuggingFace Inference API Routes
 * Comprehensive endpoints for all HF inference tasks through specialized agents
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import AgentOrchestrator from '../AgentOrchestrator.js';
import authenticateToken from '../../../packages/backend/src/middleware/authenticateToken.js';

const router = express.Router();

// Configure multer for file uploads (images, audio, documents)
const upload = multer({
  dest: '/tmp/hf-uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg',
      'application/pdf', 'text/plain', 'application/json'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

// Initialize agent orchestrator
const orchestrator = new AgentOrchestrator();
let orchestratorReady = false;

// Initialize orchestrator on startup
(async () => {
  try {
    orchestratorReady = await orchestrator.initialize();
    console.log('[HF Routes] 🎭 Agent orchestrator initialization:', orchestratorReady ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.error('[HF Routes] ❌ Failed to initialize agent orchestrator:', error);
  }
})();

// Middleware to check orchestrator status
const requireOrchestrator = (req, res, next) => {
  if (!orchestratorReady) {
    return res.status(503).json({
      success: false,
      error: 'HuggingFace services are not available',
      message: 'Agent orchestrator is not initialized'
    });
  }
  next();
};

/**
 * GET /api/huggingface/capabilities
 * Get available tasks and agent capabilities
 */
router.get('/capabilities', requireOrchestrator, async (req, res) => {
  try {
    const capabilities = await orchestrator.getAgentCapabilities();
    const availableTasks = orchestrator.getAvailableTasks();
    
    res.json({
      success: true,
      data: {
        agents: capabilities,
        availableTasks,
        totalAgents: Object.keys(capabilities).length,
        totalTasks: availableTasks.length
      }
    });
  } catch (error) {
    console.error('[HF Routes] Error getting capabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/huggingface/health
 * Health check for HF services and agents
 */
router.get('/health', async (req, res) => {
  try {
    const health = await orchestrator.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json({
      success: health.status === 'healthy',
      health
    });
  } catch (error) {
    console.error('[HF Routes] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/inference
 * General inference endpoint - routes to appropriate agent
 */
router.post('/inference', authenticateToken, requireOrchestrator, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), async (req, res) => {
  try {
    const { taskType, text, labels, options = {} } = req.body;
    
    if (!taskType) {
      return res.status(400).json({
        success: false,
        error: 'taskType is required'
      });
    }

    // Prepare inputs based on request
    const inputs = {};
    
    // Add text input
    if (text) inputs.text = text;
    
    // Add file inputs
    if (req.files?.image?.[0]) {
      inputs.imageData = await fs.readFile(req.files.image[0].path);
    }
    if (req.files?.audio?.[0]) {
      inputs.audioData = await fs.readFile(req.files.audio[0].path);
    }
    if (req.files?.document?.[0]) {
      inputs.imageData = await fs.readFile(req.files.document[0].path); // Documents are processed as images
    }

    // Add labels for zero-shot tasks
    if (labels) {
      if (typeof labels === 'string') {
        inputs.labels = labels.split(',').map(l => l.trim());
      } else if (Array.isArray(labels)) {
        inputs.labels = labels;
      }
    }

    // Parse options if it's a string
    let parsedOptions = options;
    if (typeof options === 'string') {
      try {
        parsedOptions = JSON.parse(options);
      } catch (e) {
        parsedOptions = {};
      }
    }

    // Route task to appropriate agent
    const result = await orchestrator.routeTask(taskType, inputs, parsedOptions);

    // Clean up uploaded files
    if (req.files) {
      const cleanupPromises = [];
      Object.values(req.files).flat().forEach(file => {
        cleanupPromises.push(fs.unlink(file.path).catch(() => {}));
      });
      await Promise.allSettled(cleanupPromises);
    }

    res.json({
      success: true,
      taskType,
      agent: orchestrator.getAgentForTask(taskType),
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Inference failed:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path).catch(() => {});
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/vision
 * Vision-specific endpoint with optimized handling
 */
router.post('/vision', authenticateToken, requireOrchestrator, upload.single('image'), async (req, res) => {
  try {
    const { taskType = 'image-classification', labels, question, options = {} } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    const imageData = await fs.readFile(req.file.path);
    const inputs = { imageData };

    // Add specific inputs for different vision tasks
    if (question) inputs.question = question;
    if (labels) inputs.labels = Array.isArray(labels) ? labels : labels.split(',').map(l => l.trim());

    const result = await orchestrator.routeTask(taskType, inputs, JSON.parse(typeof options === 'string' ? options : JSON.stringify(options)));

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Vision task failed:', error);
    
    if (req.file) {
      fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/audio
 * Audio-specific endpoint with optimized handling
 */
router.post('/audio', authenticateToken, requireOrchestrator, upload.single('audio'), async (req, res) => {
  try {
    const { taskType = 'automatic-speech-recognition', options = {} } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const audioData = await fs.readFile(req.file.path);
    const inputs = { audioData };

    const result = await orchestrator.routeTask(taskType, inputs, JSON.parse(typeof options === 'string' ? options : JSON.stringify(options)));

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Audio task failed:', error);
    
    if (req.file) {
      fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/text
 * Text-specific endpoint for NLP tasks
 */
router.post('/text', authenticateToken, requireOrchestrator, async (req, res) => {
  try {
    const { 
      taskType = 'text-classification', 
      text, 
      labels, 
      context, 
      question,
      sentences,
      options = {} 
    } = req.body;
    
    if (!text && !sentences) {
      return res.status(400).json({
        success: false,
        error: 'Text input is required'
      });
    }

    const inputs = { text };
    
    // Add specific inputs for different text tasks
    if (labels) inputs.labels = Array.isArray(labels) ? labels : labels.split(',').map(l => l.trim());
    if (context) inputs.context = context;
    if (question) inputs.question = question;
    if (sentences) inputs.sentences = Array.isArray(sentences) ? sentences : [sentences];

    const result = await orchestrator.routeTask(taskType, inputs, options);

    res.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Text task failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/multimodal
 * Multimodal endpoint for complex cross-modal tasks
 */
router.post('/multimodal', authenticateToken, requireOrchestrator, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  try {
    const { taskType = 'multimodal-analysis', text, question, options = {} } = req.body;
    
    const inputs = {};
    
    // Add text input
    if (text) inputs.text = text;
    if (question) inputs.question = question;
    
    // Add file inputs
    if (req.files?.image?.[0]) {
      inputs.image = await fs.readFile(req.files.image[0].path);
    }
    if (req.files?.audio?.[0]) {
      inputs.audio = await fs.readFile(req.files.audio[0].path);
    }

    if (Object.keys(inputs).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one input (text, image, or audio) is required'
      });
    }

    const result = await orchestrator.routeTask(taskType, inputs, JSON.parse(typeof options === 'string' ? options : JSON.stringify(options)));

    // Clean up uploaded files
    if (req.files) {
      const cleanupPromises = [];
      Object.values(req.files).flat().forEach(file => {
        cleanupPromises.push(fs.unlink(file.path).catch(() => {}));
      });
      await Promise.allSettled(cleanupPromises);
    }

    res.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Multimodal task failed:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path).catch(() => {});
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/data
 * Data analysis endpoint for tabular and time series data
 */
router.post('/data', authenticateToken, requireOrchestrator, async (req, res) => {
  try {
    const { 
      taskType = 'data-analysis', 
      data, 
      analysisType,
      options = {} 
    } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required'
      });
    }

    const inputs = { data };
    if (analysisType) inputs.analysisType = analysisType;

    const result = await orchestrator.routeTask(taskType, inputs, options);

    res.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Data task failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/huggingface/batch
 * Batch processing endpoint for multiple tasks
 */
router.post('/batch', authenticateToken, requireOrchestrator, async (req, res) => {
  try {
    const { tasks } = req.body;
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tasks array is required'
      });
    }

    const results = await orchestrator.batchProcess(tasks);

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.json({
      success: true,
      totalTasks: totalCount,
      successfulTasks: successCount,
      failedTasks: totalCount - successCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HF Routes] Batch processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/huggingface/tasks
 * Get available task types and their descriptions
 */
router.get('/tasks', requireOrchestrator, async (req, res) => {
  try {
    const availableTasks = orchestrator.getAvailableTasks();
    
    const taskCategories = {
      vision: availableTasks.filter(t => t.includes('image') || t.includes('visual') || t.includes('depth') || t.includes('object')),
      audio: availableTasks.filter(t => t.includes('audio') || t.includes('speech') || t.includes('voice')),
      text: availableTasks.filter(t => t.includes('text') && !t.includes('image') && !t.includes('audio')),
      multimodal: availableTasks.filter(t => t.includes('visual-question') || t.includes('document-question') || t.includes('multimodal')),
      data: availableTasks.filter(t => t.includes('tabular') || t.includes('time-series') || t.includes('data'))
    };

    res.json({
      success: true,
      data: {
        availableTasks,
        categories: taskCategories,
        totalTasks: availableTasks.length
      }
    });
  } catch (error) {
    console.error('[HF Routes] Error getting tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/huggingface/stats
 * Provide basic orchestrator stats (duplicate route file parity)
 */
router.get('/stats', requireOrchestrator, async (req, res) => {
  try {
    if (typeof orchestrator.getStats === 'function') {
      const stats = orchestrator.getStats();
      return res.json({ success: true, stats, timestamp: new Date().toISOString() });
    }
    // Fallback minimal stats
    res.json({ success: true, stats: { initialized: true }, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;