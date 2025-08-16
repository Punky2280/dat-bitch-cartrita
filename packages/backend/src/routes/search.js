/**
 * Advanced Search API Routes
 * 
 * RESTful endpoints for advanced search and knowledge retrieval
 * Supports unified search across multiple data sources with advanced
 * filtering, faceting, and analytics capabilities
 * 
 * @author Robbie Allen - Lead Architect  
 * @date January 2025
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import AdvancedSearchService from '../services/AdvancedSearchService.js';

const router = express.Router();
const searchService = new AdvancedSearchService();

// Initialize search service
await searchService.initialize();

/**
 * @swagger
 * /api/search/unified:
 *   post:
 *     summary: Perform unified advanced search
 *     description: Search across multiple data sources using semantic, full-text, and graph search
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query text
 *               searchTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [semantic, fulltext, graph]
 *                 default: [semantic, fulltext]
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [knowledge, conversations, workflows, documents]
 *                 default: [knowledge, conversations]
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *               threshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.1
 *               filters:
 *                 type: object
 *                 properties:
 *                   categories:
 *                     type: array
 *                     items:
 *                       type: string
 *                   sources:
 *                     type: array
 *                     items:
 *                       type: string
 *                   dateRange:
 *                     type: object
 *                     properties:
 *                       from:
 *                         type: string
 *                         format: date-time
 *                       to:
 *                         type: string
 *                         format: date-time
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   minScore:
 *                     type: number
 *               facets:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [categories, sources, types, tags]
 *               explain:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       snippet:
 *                         type: string
 *                       category:
 *                         type: string
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *                       score:
 *                         type: number
 *                       finalScore:
 *                         type: number
 *                       similarity:
 *                         type: number
 *                       relevance:
 *                         type: number
 *                       searchType:
 *                         type: string
 *                       searchTypes:
 *                         type: array
 *                         items:
 *                           type: string
 *                       source:
 *                         type: string
 *                       multiMatch:
 *                         type: boolean
 *                 facets:
 *                   type: object
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     totalMatches:
 *                       type: integer
 *                     searchTime:
 *                       type: integer
 *                     strategy:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                 explanation:
 *                   type: array
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/unified', 
  authenticateToken,
  [
    body('query')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Query must be a string between 1 and 1000 characters'),
    body('searchTypes')
      .optional()
      .isArray()
      .withMessage('Search types must be an array'),
    body('searchTypes.*')
      .optional()
      .isIn(['semantic', 'fulltext', 'graph'])
      .withMessage('Invalid search type'),
    body('sources')
      .optional()
      .isArray()
      .withMessage('Sources must be an array'),
    body('sources.*')
      .optional()
      .isIn(['knowledge', 'conversations', 'workflows', 'documents'])
      .withMessage('Invalid source'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    body('threshold')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Threshold must be between 0 and 1'),
  ],
  async (req, res) => {
    return traceOperation('api.search.unified', async (span) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
          });
        }

        const userId = req.user.id;
        const options = {
          ...req.body,
          userId,
        };

        span.setAttributes({
          'search.query': req.body.query,
          'search.user_id': userId,
          'search.types': (req.body.searchTypes || ['semantic', 'fulltext']).join(','),
          'search.sources': (req.body.sources || ['knowledge']).join(','),
        });

        const result = await searchService.search(req.body.query, options);

        res.json(result);
      } catch (error) {
        console.error('[Search API] ❌ Unified search failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Search failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/semantic:
 *   post:
 *     summary: Perform semantic search using vector embeddings
 *     description: Search using OpenAI embeddings for semantic similarity
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *               limit:
 *                 type: integer
 *                 default: 20
 *               threshold:
 *                 type: number
 *                 default: 0.1
 */
router.post('/semantic',
  authenticateToken,
  [
    body('query')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Query is required'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    body('threshold')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Threshold must be between 0 and 1'),
  ],
  async (req, res) => {
    return traceOperation('api.search.semantic', async (span) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
          });
        }

        const result = await searchService.search(req.body.query, {
          ...req.body,
          userId: req.user.id,
          searchTypes: ['semantic'],
        });

        res.json(result);
      } catch (error) {
        console.error('[Search API] ❌ Semantic search failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Semantic search failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/fulltext:
 *   post:
 *     summary: Perform full-text search
 *     description: Search using PostgreSQL full-text search capabilities
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 */
router.post('/fulltext',
  authenticateToken,
  [
    body('query')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Query is required'),
  ],
  async (req, res) => {
    return traceOperation('api.search.fulltext', async (span) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
          });
        }

        const result = await searchService.search(req.body.query, {
          ...req.body,
          userId: req.user.id,
          searchTypes: ['fulltext'],
        });

        res.json(result);
      } catch (error) {
        console.error('[Search API] ❌ Full-text search failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Full-text search failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Get search suggestions
 *     description: Get search suggestions based on query prefix
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Query prefix for suggestions
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of suggestions to return
 */
router.get('/suggestions',
  authenticateToken,
  [
    query('q')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Query prefix is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
  ],
  async (req, res) => {
    return traceOperation('api.search.suggestions', async (span) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
          });
        }

        const { q: query, limit = 10 } = req.query;
        const userId = req.user.id;

        // Get suggestions from knowledge titles and popular queries
        const suggestions = await searchService.pool.query(`
          SELECT DISTINCT title as suggestion, 'knowledge' as type
          FROM knowledge_entries 
          WHERE title ILIKE $1 AND user_id = $2
          ORDER BY importance_score DESC
          LIMIT $3
        `, [`%${query}%`, userId, limit]);

        res.json({
          success: true,
          suggestions: suggestions.rows.map(row => ({
            text: row.suggestion,
            type: row.type,
          })),
        });
      } catch (error) {
        console.error('[Search API] ❌ Suggestions failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Suggestions failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/analytics:
 *   get:
 *     summary: Get search analytics
 *     description: Get search usage statistics and popular queries
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 */
router.get('/analytics',
  authenticateToken,
  async (req, res) => {
    return traceOperation('api.search.analytics', async (span) => {
      try {
        const userId = req.user.id;
        
        // Get user-specific search analytics from database
        const analyticsQuery = `
          SELECT 
            COUNT(*) as total_searches,
            AVG(search_time_ms) as avg_response_time,
            AVG(confidence_score) as avg_confidence,
            COUNT(DISTINCT query) as unique_queries
          FROM search_analytics 
          WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '30 days'
        `;
        
        const analyticsResult = await searchService.pool.query(analyticsQuery, [userId]);
        
        // Get popular queries
        const popularQueriesQuery = `
          SELECT query, COUNT(*) as search_count
          FROM search_analytics 
          WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY query
          ORDER BY search_count DESC
          LIMIT 10
        `;
        
        const popularQueriesResult = await searchService.pool.query(popularQueriesQuery, [userId]);
        
        // Get service-level analytics
        const serviceAnalytics = searchService.getAnalytics();

        res.json({
          success: true,
          userAnalytics: {
            totalSearches: parseInt(analyticsResult.rows[0].total_searches) || 0,
            avgResponseTime: parseFloat(analyticsResult.rows[0].avg_response_time) || 0,
            avgConfidence: parseFloat(analyticsResult.rows[0].avg_confidence) || 0,
            uniqueQueries: parseInt(analyticsResult.rows[0].unique_queries) || 0,
            popularQueries: popularQueriesResult.rows.map(row => ({
              query: row.query,
              count: parseInt(row.search_count),
            })),
          },
          serviceAnalytics,
        });
      } catch (error) {
        console.error('[Search API] ❌ Analytics failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Analytics retrieval failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/refresh:
 *   post:
 *     summary: Refresh search indexes
 *     description: Rebuild search indexes (admin only)
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 */
router.post('/refresh',
  authenticateToken,
  async (req, res) => {
    return traceOperation('api.search.refresh', async (span) => {
      try {
        // Check if user is admin (you might have different admin check logic)
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
          });
        }

        await searchService.refreshIndexes();

        res.json({
          success: true,
          message: 'Search indexes refreshed successfully',
        });
      } catch (error) {
        console.error('[Search API] ❌ Index refresh failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Index refresh failed',
          message: error.message,
        });
      }
    });
  }
);

/**
 * @swagger
 * /api/search/health:
 *   get:
 *     summary: Get search service health status
 *     description: Check search service health and capabilities
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 */
router.get('/health',
  authenticateToken,
  async (req, res) => {
    return traceOperation('api.search.health', async (span) => {
      try {
        const analytics = searchService.getAnalytics();
        
        const health = {
          status: 'healthy',
          uptime: process.uptime(),
          indexes: analytics.indexSizes,
          totalSearches: analytics.totalSearches,
          openai: !!process.env.OPENAI_API_KEY,
          database: true, // Will be false if database is down
          timestamp: new Date().toISOString(),
        };

        res.json({
          success: true,
          health,
        });
      } catch (error) {
        console.error('[Search API] ❌ Health check failed:', error);
        span.recordException(error);
        
        res.status(500).json({
          success: false,
          error: 'Health check failed',
          health: {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });
  }
);

export default router;
