/**
 * Sourcery Code Quality API Routes
 * Provides automated code analysis, quality metrics, and refactoring suggestions
 * Created: January 27, 2025
 */

import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { join } from 'path';
import SourceryService from '../services/SourceryService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();
let sourceryService = null;

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/sourcery/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10,
  },
});

// Initialize service
const initializeService = async () => {
  if (!sourceryService) {
    sourceryService = new SourceryService();
    await sourceryService.initialize();
  }
};

/**
 * Analyze code quality for uploaded file or directory
 * POST /api/v2/sourcery/analyze
 */
router.post('/analyze', upload.single('code'), async (req, res) => {
  try {
    await initializeService();

    let targetPath;
    const { path: urlPath, language, config } = req.body;

    if (req.file) {
      // Use uploaded file
      targetPath = req.file.path;
    } else if (urlPath) {
      // Use provided path
      targetPath = urlPath;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either file upload or path parameter is required',
      });
    }

    const options = {
      output: 'json',
      language: language || 'auto',
      config: config || null,
    };

    const result = await sourceryService.analyzeCodeQuality(
      targetPath,
      options
    );

    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn(
          '[SourceryRoutes] Failed to cleanup uploaded file:',
          cleanupError
        );
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[SourceryRoutes] Analysis failed:', error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn(
          '[SourceryRoutes] Failed to cleanup uploaded file after error:',
          cleanupError
        );
      }
    }

    res.status(500).json({
      success: false,
      error: 'Code analysis failed',
      details: error.message,
    });
  }
});

/**
 * Apply automatic refactoring
 * POST /api/v2/sourcery/refactor
 */
router.post('/refactor', upload.single('code'), async (req, res) => {
  try {
    await initializeService();

    let targetPath;
    const { path: urlPath, dryRun = true, rules, exclude } = req.body;

    if (req.file) {
      targetPath = req.file.path;
    } else if (urlPath) {
      targetPath = urlPath;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either file upload or path parameter is required',
      });
    }

    const options = {
      dryRun: dryRun === true || dryRun === 'true',
      rules: rules ? rules.split(',') : null,
      exclude: exclude ? exclude.split(',') : null,
    };

    const result = await sourceryService.applyAutoRefactoring(
      targetPath,
      options
    );

    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn(
          '[SourceryRoutes] Failed to cleanup uploaded file:',
          cleanupError
        );
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[SourceryRoutes] Refactoring failed:', error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn(
          '[SourceryRoutes] Failed to cleanup uploaded file after error:',
          cleanupError
        );
      }
    }

    res.status(500).json({
      success: false,
      error: 'Refactoring failed',
      details: error.message,
    });
  }
});

/**
 * Generate comprehensive quality report
 * POST /api/v2/sourcery/report
 */
router.post('/report', async (req, res) => {
  try {
    await initializeService();

    const {
      projectPath,
      includeMetrics = true,
      includeRecommendations = true,
    } = req.body;

    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Project path is required',
      });
    }

    const options = {
      includeMetrics,
      includeRecommendations,
    };

    const report = await sourceryService.generateQualityReport(
      projectPath,
      options
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[SourceryRoutes] Report generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Report generation failed',
      details: error.message,
    });
  }
});

/**
 * Analyze specific project directory
 * GET /api/v2/sourcery/project/:projectId
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    await initializeService();

    const { projectId } = req.params;

    // This would typically map to a stored project path
    // For now, we'll use a simple mapping
    const projectPath = `/home/robbie/development/${projectId}`;

    const result = await sourceryService.analyzeCodeQuality(projectPath, {
      output: 'json',
    });

    res.json({
      success: true,
      data: {
        projectId,
        analysis: result,
      },
    });
  } catch (error) {
    console.error('[SourceryRoutes] Project analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Project analysis failed',
      details: error.message,
    });
  }
});

/**
 * Get Sourcery service metrics
 * GET /api/v2/sourcery/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    await initializeService();

    const metrics = sourceryService.getMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[SourceryRoutes] Metrics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics retrieval failed',
      details: error.message,
    });
  }
});

/**
 * Reset service metrics (for testing/admin use)
 * POST /api/v2/sourcery/metrics/reset
 */
router.post('/metrics/reset', async (req, res) => {
  try {
    await initializeService();

    sourceryService.resetMetrics();

    res.json({
      success: true,
      data: {
        message: 'Metrics reset successfully',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[SourceryRoutes] Metrics reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics reset failed',
      details: error.message,
    });
  }
});

/**
 * Batch analyze multiple files
 * POST /api/v2/sourcery/batch
 */
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    await initializeService();

    const files = req.files;
    const { language, config } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one file is required',
      });
    }

    const results = [];
    const options = {
      output: 'json',
      language: language || 'auto',
      config: config || null,
    };

    // Process files in parallel
    const analysisPromises = files.map(async file => {
      try {
        const result = await sourceryService.analyzeCodeQuality(
          file.path,
          options
        );
        return {
          filename: file.originalname,
          success: true,
          analysis: result,
        };
      } catch (error) {
        return {
          filename: file.originalname,
          success: false,
          error: error.message,
        };
      } finally {
        // Clean up file
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.warn('[SourceryRoutes] Failed to cleanup file:', file.path);
        }
      }
    });

    const analysisResults = await Promise.all(analysisPromises);

    const successful = analysisResults.filter(r => r.success).length;
    const failed = analysisResults.filter(r => !r.success).length;

    res.json({
      success: true,
      data: {
        results: analysisResults,
        summary: {
          totalFiles: files.length,
          successful,
          failed,
        },
      },
    });
  } catch (error) {
    console.error('[SourceryRoutes] Batch analysis failed:', error);

    // Clean up any remaining files
    if (req.files) {
      req.files.forEach(async file => {
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.warn(
            '[SourceryRoutes] Failed to cleanup file after batch error:',
            file.path
          );
        }
      });
    }

    res.status(500).json({
      success: false,
      error: 'Batch analysis failed',
      details: error.message,
    });
  }
});

/**
 * Health check endpoint
 * GET /api/v2/sourcery/health
 */
router.get('/health', async (req, res) => {
  try {
    await initializeService();

    const metrics = sourceryService.getMetrics();
    const isHealthy = sourceryService.initialized;

    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        initialized: sourceryService.initialized,
        totalAnalyses: metrics.totalAnalyses,
        issuesFound: metrics.issuesFound,
        fixesApplied: metrics.fixesApplied,
        filesAnalyzed: metrics.filesAnalyzed,
        technicalDebtMinutes: metrics.technicalDebtMinutes,
      },
    });
  } catch (error) {
    console.error('[SourceryRoutes] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message,
    });
  }
});

/**
 * Get supported languages and file types
 * GET /api/v2/sourcery/supported
 */
router.get('/supported', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        languages: [
          'javascript',
          'typescript',
          'python',
          'java',
          'go',
          'rust',
          'cpp',
          'csharp',
        ],
        fileExtensions: [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.py',
          '.pyx',
          '.java',
          '.go',
          '.rs',
          '.cpp',
          '.cc',
          '.cxx',
          '.cs',
        ],
        maxFileSize: '50MB',
        maxFiles: 10,
      },
    });
  } catch (error) {
    console.error('[SourceryRoutes] Supported info retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Supported info retrieval failed',
      details: error.message,
    });
  }
});

export default router;
