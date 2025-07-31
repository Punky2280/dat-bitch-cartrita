const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/authenticateToken');
const VisualAnalysisService = require('../services/VisualAnalysisService');

const router = express.Router();

// Configure multer for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for images
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * POST /api/vision/analyze
 * Analyze image with comprehensive AI vision
 */
router.post(
  '/analyze',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
          error: 'Vision analysis service is not configured',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No image file provided',
        });
      }

      console.log(`[Vision] Analyzing image for user: ${req.user.name}`);

      // Parse options from request body
      const options = {
        analysisType: req.body.analysisType || 'comprehensive',
        focusAreas: req.body.focusAreas ? JSON.parse(req.body.focusAreas) : null,
        generateComments: req.body.generateComments !== 'false'
      };

      // Analyze the image
      const analysis = await VisualAnalysisService.analyzeImage(req.file.buffer, options);

      if (!analysis) {
        return res.status(422).json({
          error: 'Unable to analyze image',
        });
      }

      console.log(`[Vision] Analysis completed for user: ${req.user.name}`);

      res.json({
        success: true,
        analysis: analysis,
        options: options,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('[Vision] Image analysis error:', error);

      if (error.name === 'MulterError') {
        return res.status(400).json({
          error: 'Image file too large or invalid format',
        });
      }

      res.status(500).json({
        error: 'Failed to analyze image',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/vision/start-session
 * Start visual analysis session
 */
router.post('/start-session', authenticateToken, async (req, res) => {
  try {
    const { settings = {} } = req.body;
    
    console.log(`[Vision] Starting visual session for user: ${req.user.name}`);
    
    const success = await VisualAnalysisService.startVisualAnalysis(req.user.id, settings);
    
    if (success) {
      res.json({
        success: true,
        message: 'Visual analysis session started',
        settings: settings
      });
    } else {
      res.status(409).json({
        error: 'Visual analysis session already active'
      });
    }

  } catch (error) {
    console.error('[Vision] Error starting visual session:', error);
    res.status(500).json({
      error: 'Failed to start visual analysis session'
    });
  }
});

/**
 * POST /api/vision/stop-session
 * Stop visual analysis session
 */
router.post('/stop-session', authenticateToken, async (req, res) => {
  try {
    console.log(`[Vision] Stopping visual session for user: ${req.user.name}`);
    
    const success = await VisualAnalysisService.stopVisualAnalysis();
    
    if (success) {
      res.json({
        success: true,
        message: 'Visual analysis session stopped'
      });
    } else {
      res.status(409).json({
        error: 'No active visual analysis session'
      });
    }

  } catch (error) {
    console.error('[Vision] Error stopping visual session:', error);
    res.status(500).json({
      error: 'Failed to stop visual analysis session'
    });
  }
});

/**
 * GET /api/vision/status
 * Get visual analysis service status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = VisualAnalysisService.getStatus();
    
    res.json({
      success: true,
      status: status,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Vision] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get visual analysis status'
    });
  }
});

/**
 * GET /api/vision/insights
 * Get visual analysis insights
 */
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const insights = VisualAnalysisService.getAnalysisInsights();
    
    res.json({
      success: true,
      insights: insights,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Vision] Error getting insights:', error);
    res.status(500).json({
      error: 'Failed to get visual analysis insights'
    });
  }
});

/**
 * POST /api/vision/detect-changes
 * Detect changes in visual scene
 */
router.post(
  '/detect-changes',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image file provided',
        });
      }

      console.log(`[Vision] Detecting scene changes for user: ${req.user.name}`);

      // First analyze the new image
      const newAnalysis = await VisualAnalysisService.analyzeImage(req.file.buffer);
      
      // Detect changes compared to previous analysis
      const changes = await VisualAnalysisService.detectSceneChanges(newAnalysis);

      res.json({
        success: true,
        current_analysis: newAnalysis,
        changes: changes,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('[Vision] Error detecting changes:', error);
      res.status(500).json({
        error: 'Failed to detect scene changes',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/vision/generate-response
 * Generate contextual visual response
 */
router.post(
  '/generate-response',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image file provided',
        });
      }

      console.log(`[Vision] Generating visual response for user: ${req.user.name}`);

      // Analyze the image
      const analysis = await VisualAnalysisService.analyzeImage(req.file.buffer);
      
      // Detect changes if this isn't the first analysis
      const changes = await VisualAnalysisService.detectSceneChanges(analysis);
      
      // Generate contextual response
      const response = await VisualAnalysisService.generateVisualResponse(analysis, changes.hasChanged ? changes : null);

      res.json({
        success: true,
        response: response,
        analysis: analysis,
        changes: changes,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('[Vision] Error generating visual response:', error);
      res.status(500).json({
        error: 'Failed to generate visual response',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/vision/test
 * Test visual analysis service
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    console.log(`[Vision] Testing service for user: ${req.user.name}`);
    
    const testResult = await VisualAnalysisService.testService();
    
    res.json({
      success: testResult.success,
      message: testResult.message,
      result: testResult.result || null,
      error: testResult.error || null,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Vision] Test error:', error);
    res.status(500).json({
      error: 'Vision service test failed',
      details: error.message
    });
  }
});

module.exports = router;