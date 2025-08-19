import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
/**
 * Camera Vision Testing Routes
 * 
 * API endpoints for comprehensive camera testing, diagnostics, and multi-frame analysis
 * Task 17: Camera Vision Testing Overhaul
 */
import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { OpenTelemetryTracing } from '../system/OpenTelemetryTracing.js';
import CameraVisionTestingService from '../services/CameraVisionTestingService.js';

const router = express.Router();

// Initialize service
let cameraTestingService = null;
async function initializeService() {
  if (!cameraTestingService) {
    cameraTestingService = new CameraVisionTestingService();
    await cameraTestingService.initialize();
  }
  return cameraTestingService;
}

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files for multi-frame analysis
  },
  fileFilter: (req, file, cb) => {
    const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    if (supportedFormats.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported format: ${file.mimetype}`), false);
    }
  }
});

/**
 * @route   GET /api/camera-testing/status
 * @desc    Get camera vision testing service status
 * @access  Private
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    console.log('[CameraTestingAPI] Status check requested');
    
    const service = await initializeService();
    const status = service.getStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[CameraTestingAPI] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/camera-testing/session
 * @desc    Create a new camera testing session
 * @access  Private
 */
router.post('/session', authenticateToken, async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.create_session',
    { attributes: { endpoint: 'POST /api/camera-testing/session' } },
    async (span) => {
      try {
        const service = await initializeService();
        const userId = req.user?.id || 'anonymous';
        const sessionConfig = req.body || {};

        console.log('[CameraTestingAPI] Creating testing session for user:', userId);

        const result = await service.createTestingSession(userId, sessionConfig);

        span.setAttributes({
          'session.id': result.sessionId,
          'session.user_id': userId,
          'session.created': true
        });

        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        console.error('[CameraTestingAPI] Session creation error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Failed to create testing session',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   GET /api/camera-testing/session/:sessionId
 * @desc    Get session details
 * @access  Private
 */
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const service = await initializeService();
    const { sessionId } = req.params;

    console.log('[CameraTestingAPI] Getting session details:', sessionId);

    const session = service.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Don't send full capture data, just summaries
    const sessionSummary = {
      ...session,
      captures: session.captures.map(capture => ({
        id: capture.id,
        timestamp: capture.timestamp,
        metadata: capture.metadata,
        analysis: capture.analysis,
        // Exclude raw image data
      }))
    };

    res.json({
      success: true,
      session: sessionSummary
    });
  } catch (error) {
    console.error('[CameraTestingAPI] Session get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session',
      details: error.message
    });
  }
});

/**
 * @route   DELETE /api/camera-testing/session/:sessionId
 * @desc    Delete a testing session
 * @access  Private
 */
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const service = await initializeService();
    const { sessionId } = req.params;

    console.log('[CameraTestingAPI] Deleting session:', sessionId);

    const deleted = service.deleteSession(sessionId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('[CameraTestingAPI] Session delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/camera-testing/analyze-frame
 * @desc    Analyze a single frame for black screen/blob detection
 * @access  Private
 * @body    multipart/form-data with 'image' field and sessionId
 */
router.post('/analyze-frame', authenticateToken, upload.single('image'), async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.analyze_frame',
    { attributes: { endpoint: 'POST /api/camera-testing/analyze-frame' } },
    async (span) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'Image file is required'
          });
        }

        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'sessionId is required'
          });
        }

        const service = await initializeService();
        
        console.log('[CameraTestingAPI] Analyzing frame for session:', sessionId, {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        });

        // Extract frame metadata from request
        const frameMetadata = {
          filename: req.file.originalname,
          uploaded_at: new Date().toISOString(),
          mime_type: req.file.mimetype,
          client_info: req.body.client_info ? JSON.parse(req.body.client_info) : {}
        };

        const result = await service.analyzeFrame(sessionId, req.file.buffer, frameMetadata);

        span.setAttributes({
          'frame.session_id': sessionId,
          'frame.size_bytes': req.file.size,
          'frame.mime_type': req.file.mimetype,
          'analysis.success': result.success,
          'analysis.is_black_frame': result.success ? result.analysis?.isBlackFrame : false
        });

        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json(result);
        }
      } catch (error) {
        console.error('[CameraTestingAPI] Frame analysis error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Frame analysis failed',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   POST /api/camera-testing/multi-frame-analysis
 * @desc    Perform multi-frame analysis and comparison
 * @access  Private
 */
router.post('/multi-frame-analysis', authenticateToken, async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.multi_frame_analysis',
    { attributes: { endpoint: 'POST /api/camera-testing/multi-frame-analysis' } },
    async (span) => {
      try {
        const { sessionId, frameCount = 5 } = req.body;

        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'sessionId is required'
          });
        }

        const service = await initializeService();

        console.log('[CameraTestingAPI] Performing multi-frame analysis:', { sessionId, frameCount });

        const result = await service.performMultiFrameAnalysis(sessionId, frameCount);

        span.setAttributes({
          'analysis.session_id': sessionId,
          'analysis.frame_count': frameCount,
          'analysis.success': result.success
        });

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        console.error('[CameraTestingAPI] Multi-frame analysis error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Multi-frame analysis failed',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   POST /api/camera-testing/resize-frame
 * @desc    Resize and optimize camera frame
 * @access  Private
 * @body    multipart/form-data with 'image' field and resize options
 */
router.post('/resize-frame', authenticateToken, upload.single('image'), async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.resize_frame',
    { attributes: { endpoint: 'POST /api/camera-testing/resize-frame' } },
    async (span) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'Image file is required'
          });
        }

        const service = await initializeService();

        // Parse resize options from request body
        const options = {
          width: parseInt(req.body.width) || 640,
          height: parseInt(req.body.height) || 480,
          quality: parseInt(req.body.quality) || 80,
          format: req.body.format || 'jpeg',
          fit: req.body.fit || 'cover'
        };

        console.log('[CameraTestingAPI] Resizing frame:', {
          originalName: req.file.originalname,
          originalSize: req.file.size,
          options
        });

        const result = await service.resizeFrame(req.file.buffer, options);

        span.setAttributes({
          'resize.original_size': req.file.size,
          'resize.target_width': options.width,
          'resize.target_height': options.height,
          'resize.success': result.success
        });

        if (result.success) {
          // Set appropriate content type
          const contentType = `image/${options.format}`;
          res.set('Content-Type', contentType);
          res.set('Content-Disposition', `inline; filename="resized.${options.format}"`);
          res.set('X-Resize-Metadata', JSON.stringify(result.metadata));
          
          res.send(result.data);
        } else {
          res.status(500).json(result);
        }
      } catch (error) {
        console.error('[CameraTestingAPI] Frame resize error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Frame resize failed',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   GET /api/camera-testing/diagnostic-report/:sessionId
 * @desc    Generate comprehensive diagnostic report for a session
 * @access  Private
 */
router.get('/diagnostic-report/:sessionId', authenticateToken, async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.diagnostic_report',
    { attributes: { endpoint: 'GET /api/camera-testing/diagnostic-report' } },
    async (span) => {
      try {
        const { sessionId } = req.params;
        const service = await initializeService();

        console.log('[CameraTestingAPI] Generating diagnostic report for session:', sessionId);

        const result = await service.generateDiagnosticReport(sessionId);

        span.setAttributes({
          'report.session_id': sessionId,
          'report.success': result.success
        });

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        console.error('[CameraTestingAPI] Diagnostic report error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate diagnostic report',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   POST /api/camera-testing/batch-analyze
 * @desc    Analyze multiple frames at once
 * @access  Private
 * @body    multipart/form-data with multiple 'images' and sessionId
 */
router.post('/batch-analyze', authenticateToken, upload.array('images', 10), async (req, res) => {
  return await OpenTelemetryTracing.traceOperation(
    'camera_testing_api.batch_analyze',
    { attributes: { endpoint: 'POST /api/camera-testing/batch-analyze' } },
    async (span) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'At least one image file is required'
          });
        }

        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'sessionId is required'
          });
        }

        const service = await initializeService();

        console.log('[CameraTestingAPI] Batch analyzing frames:', {
          sessionId,
          fileCount: req.files.length
        });

        const results = [];
        const errors = [];

        // Process each file
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          try {
            const frameMetadata = {
              batch_index: i,
              filename: file.originalname,
              uploaded_at: new Date().toISOString(),
              mime_type: file.mimetype
            };

            const result = await service.analyzeFrame(sessionId, file.buffer, frameMetadata);
            
            if (result.success) {
              results.push({
                index: i,
                filename: file.originalname,
                ...result
              });
            } else {
              errors.push({
                index: i,
                filename: file.originalname,
                error: result.error
              });
            }
          } catch (error) {
            errors.push({
              index: i,
              filename: file.originalname,
              error: error.message
            });
          }
        }

        // Perform multi-frame analysis if we have enough successful results
        let multiFrameAnalysis = null;
        if (results.length >= 2) {
          try {
            const multiResult = await service.performMultiFrameAnalysis(sessionId, results.length);
            if (multiResult.success) {
              multiFrameAnalysis = multiResult.analysis;
            }
          } catch (error) {
            console.warn('[CameraTestingAPI] Multi-frame analysis failed:', error.message);
          }
        }

        span.setAttributes({
          'batch.session_id': sessionId,
          'batch.total_files': req.files.length,
          'batch.successful': results.length,
          'batch.errors': errors.length,
          'batch.multi_frame_analysis': multiFrameAnalysis ? true : false
        });

        res.json({
          success: true,
          batch_results: {
            total_processed: req.files.length,
            successful: results.length,
            error_count: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined,
            multi_frame_analysis: multiFrameAnalysis
          }
        });

      } catch (error) {
        console.error('[CameraTestingAPI] Batch analyze error:', error);
        span.recordException(error);
        res.status(500).json({
          success: false,
          error: 'Batch analysis failed',
          details: error.message
        });
      }
    }
  );
});

/**
 * @route   POST /api/camera-testing/cleanup-sessions
 * @desc    Clean up expired testing sessions (admin only)
 * @access  Private
 */
router.post('/cleanup-sessions', authenticateToken, async (req, res) => {
  try {
    // In a production app, you'd check for admin role here
    const service = await initializeService();
    
    console.log('[CameraTestingAPI] Cleaning up expired sessions');
    
    service.cleanupSessions();
    
    res.json({
      success: true,
      message: 'Session cleanup completed'
    });
  } catch (error) {
    console.error('[CameraTestingAPI] Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    });
  }
});

export default router;