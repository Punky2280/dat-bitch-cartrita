/**
 * Sourcery Code Quality Routes for Cartrita V2 (Fastify)
 * Provides automated code analysis, quality metrics, and refactoring suggestions
 * Created: January 27, 2025
 */

import SourceryService from '../../../../packages/backend/src/services/SourceryService.js';
import { promises as fs } from 'fs';

let sourceryService = null;

// Initialize service
const initializeService = async () => {
  if (!sourceryService) {
    sourceryService = new SourceryService();
    await sourceryService.initialize();
  }
};

export async function sourceryRouter(fastify, options) {
  // Sourcery Code Quality Routes Plugin for Fastify

  /**
   * Analyze code quality for uploaded file or directory
   * POST /api/v2/sourcery/analyze
   */
  fastify.post('/analyze', {
    schema: {
      description: 'Analyze code quality for uploaded file or path',
      tags: ['Sourcery'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          language: { type: 'string' },
          config: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      // Handle multipart form data
      const data = await request.file();
      let targetPath;
      let cleanup = null;

      if (data) {
        // Save uploaded file temporarily
        const uploadPath = `/tmp/${Date.now()}-${data.filename}`;
        await data.file.pipe(require('fs').createWriteStream(uploadPath));
        targetPath = uploadPath;
        cleanup = () => fs.unlink(uploadPath).catch(() => {});
      } else {
        // Use path from body
        const { path, language, config } = request.body;
        if (!path) {
          reply.status(400);
          return {
            success: false,
            error: 'Either file upload or path parameter is required'
          };
        }
        targetPath = path;
      }

      const options = {
        output: 'json',
        language: request.body?.language || 'auto',
        config: request.body?.config || null
      };

      const result = await sourceryService.analyzeCodeQuality(targetPath, options);
      
      // Clean up uploaded file if it exists
      if (cleanup) await cleanup();

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('Sourcery analysis failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Code analysis failed',
        details: error.message
      };
    }
  });

  /**
   * Apply automatic refactoring
   * POST /api/v2/sourcery/refactor
   */
  fastify.post('/refactor', {
    schema: {
      description: 'Apply automatic refactoring to code',
      tags: ['Sourcery'],
      body: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          dryRun: { type: 'boolean', default: true },
          rules: { type: 'string' },
          exclude: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { path, dryRun = true, rules, exclude } = request.body;

      if (!path) {
        reply.status(400);
        return {
          success: false,
          error: 'Path parameter is required'
        };
      }

      const options = {
        dryRun: dryRun === true || dryRun === 'true',
        rules: rules ? rules.split(',') : null,
        exclude: exclude ? exclude.split(',') : null
      };

      const result = await sourceryService.applyAutoRefactoring(path, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('Sourcery refactoring failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Refactoring failed',
        details: error.message
      };
    }
  });

  /**
   * Generate comprehensive quality report
   * POST /api/v2/sourcery/report
   */
  fastify.post('/report', {
    schema: {
      description: 'Generate comprehensive quality report',
      tags: ['Sourcery'],
      body: {
        type: 'object',
        required: ['projectPath'],
        properties: {
          projectPath: { type: 'string' },
          includeMetrics: { type: 'boolean', default: true },
          includeRecommendations: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { projectPath, includeMetrics = true, includeRecommendations = true } = request.body;

      const options = {
        includeMetrics,
        includeRecommendations
      };

      const report = await sourceryService.generateQualityReport(projectPath, options);

      return {
        success: true,
        data: report
      };

    } catch (error) {
      request.log.error('Sourcery report generation failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Report generation failed',
        details: error.message
      };
    }
  });

  /**
   * Analyze specific project directory
   * GET /api/v2/sourcery/project/:projectId
   */
  fastify.get('/project/:projectId', {
    schema: {
      description: 'Analyze specific project directory',
      tags: ['Sourcery'],
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { projectId } = request.params;
      
      // Map project ID to path (would typically be in database)
      const projectPath = `/home/robbie/development/${projectId}`;
      
      const result = await sourceryService.analyzeCodeQuality(projectPath, {
        output: 'json'
      });

      return {
        success: true,
        data: {
          projectId,
          analysis: result
        }
      };

    } catch (error) {
      request.log.error('Sourcery project analysis failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Project analysis failed',
        details: error.message
      };
    }
  });

  /**
   * Get Sourcery service metrics
   * GET /api/v2/sourcery/metrics
   */
  fastify.get('/metrics', {
    schema: {
      description: 'Get Sourcery service metrics',
      tags: ['Sourcery']
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const metrics = sourceryService.getMetrics();

      return {
        success: true,
        data: metrics
      };

    } catch (error) {
      request.log.error('Sourcery metrics retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Metrics retrieval failed',
        details: error.message
      };
    }
  });

  /**
   * Reset service metrics (for testing/admin use)
   * POST /api/v2/sourcery/metrics/reset
   */
  fastify.post('/metrics/reset', {
    schema: {
      description: 'Reset Sourcery service metrics',
      tags: ['Sourcery']
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      sourceryService.resetMetrics();

      return {
        success: true,
        data: {
          message: 'Metrics reset successfully',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      request.log.error('Sourcery metrics reset failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Metrics reset failed',
        details: error.message
      };
    }
  });

  /**
   * Health check endpoint
   * GET /api/v2/sourcery/health
   */
  fastify.get('/health', {
    schema: {
      description: 'Sourcery service health check',
      tags: ['Sourcery']
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const metrics = sourceryService.getMetrics();
      const isHealthy = sourceryService.initialized;

      return {
        success: true,
        data: {
          healthy: isHealthy,
          initialized: sourceryService.initialized,
          totalAnalyses: metrics.totalAnalyses,
          issuesFound: metrics.issuesFound,
          fixesApplied: metrics.fixesApplied,
          filesAnalyzed: metrics.filesAnalyzed,
          technicalDebtMinutes: metrics.technicalDebtMinutes
        }
      };

    } catch (error) {
      request.log.error('Sourcery health check failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Health check failed',
        details: error.message
      };
    }
  });

  /**
   * Get supported languages and file types
   * GET /api/v2/sourcery/supported
   */
  fastify.get('/supported', {
    schema: {
      description: 'Get supported languages and file types',
      tags: ['Sourcery']
    }
  }, async (request, reply) => {
    try {
      return {
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
            'csharp'
          ],
          fileExtensions: [
            '.js', '.jsx', '.ts', '.tsx',
            '.py', '.pyx',
            '.java',
            '.go',
            '.rs',
            '.cpp', '.cc', '.cxx',
            '.cs'
          ],
          maxFileSize: '50MB',
          maxFiles: 10,
          features: [
            'Code quality analysis',
            'Automated refactoring',
            'Security vulnerability detection',
            'Performance optimization suggestions',
            'Technical debt calculation',
            'Maintainability scoring'
          ]
        }
      };

    } catch (error) {
      request.log.error('Sourcery supported info retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Supported info retrieval failed',
        details: error.message
      };
    }
  });

  console.log('✅ Sourcery code quality routes configured');
}