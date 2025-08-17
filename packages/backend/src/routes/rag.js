/**
 * RAG API Routes
 * Enhanced RAG system endpoints following Phase C specifications
 * Provides document management, vector search, and RAG-enhanced responses
 */

import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authenticateToken.js';
import EnhancedRAGService from '../services/EnhancedRAGService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Initialize Enhanced RAG Service
const ragService = new EnhancedRAGService();
ragService.initialize().then(success => {
  if (success) {
    console.log('[RAG Routes] ✅ Enhanced RAG service initialized');
  } else {
    console.warn('[RAG Routes] ⚠️ RAG service initialization failed or disabled');
  }
});

// Configure multer for file uploads with size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow supported document types
    const allowedTypes = [
      'text/plain',
      'text/markdown', 
      'text/html',
      'text/csv',
      'application/json',
      'application/pdf' // Note: PDF parsing may need additional implementation
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/rag/documents:
 *   post:
 *     summary: Ingest documents into RAG system
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *                 description: Document title
 *               metadata:
 *                 type: string
 *                 description: JSON metadata object
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               mimeType:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Document ingested successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/documents', upload.single('file'), async (req, res) => {
  return OpenTelemetryTracing.traceOperation('rag.api.ingest_document', {}, async () => {
    try {
      if (!ragService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'RAG service not available'
        });
      }

      const userId = req.user.id;
      let documentData;
      let fileBuffer = null;

      if (req.file) {
        // File upload case
        documentData = {
          title: req.body.title || req.file.originalname,
          mimeType: req.file.mimetype,
          metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
          source: 'file_upload'
        };
        fileBuffer = req.file.buffer;
      } else if (req.body.content) {
        // JSON content case
        documentData = {
          title: req.body.title,
          content: req.body.content,
          mimeType: req.body.mimeType || 'text/plain',
          metadata: req.body.metadata || {},
          source: 'api_upload'
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either file or content is required'
        });
      }

      if (!documentData.title) {
        return res.status(400).json({
          success: false,
          error: 'Document title is required'
        });
      }

      const result = await ragService.ingestDocument(userId, documentData, fileBuffer);
      
      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('[RAG API] Document ingestion error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * @swagger
 * /api/rag/documents:
 *   get:
 *     summary: List/search documents in RAG system
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         type: integer
 *         default: 50
 *       - name: offset
 *         in: query
 *         type: integer
 *         default: 0
 *       - name: search
 *         in: query
 *         type: string
 *         description: Search term for document titles/content
 *       - name: sortBy
 *         in: query
 *         type: string
 *         enum: [created_at, updated_at, title, file_size]
 *         default: created_at
 *       - name: sortOrder
 *         in: query
 *         type: string
 *         enum: [ASC, DESC]
 *         default: DESC
 *     responses:
 *       200:
 *         description: Document list retrieved successfully
 */
router.get('/documents', async (req, res) => {
  return OpenTelemetryTracing.traceOperation('rag.api.list_documents', {}, async () => {
    try {
      if (!ragService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'RAG service not available'
        });
      }

      const userId = req.user.id;
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        search: req.query.search || null,
        sortBy: req.query.sortBy || 'created_at',
        sortOrder: req.query.sortOrder || 'DESC'
      };

      const result = await ragService.getDocuments(userId, options);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.documents,
          pagination: result.pagination
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('[RAG API] Document list error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * @swagger
 * /api/rag/documents/{id}:
 *   delete:
 *     summary: Delete a document from RAG system
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.delete('/documents/:id', async (req, res) => {
  return OpenTelemetryTracing.traceOperation('rag.api.delete_document', {}, async () => {
    try {
      if (!ragService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'RAG service not available'
        });
      }

      const userId = req.user.id;
      const documentId = req.params.id;

      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
      }

      const result = await ragService.deleteDocument(userId, documentId);
      
      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('[RAG API] Document deletion error:', error.message);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  });
});

/**
 * @swagger
 * /api/rag/search:
 *   post:
 *     summary: Vector similarity search in RAG system
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               limit:
 *                 type: integer
 *                 default: 5
 *                 description: Maximum results to return
 *               threshold:
 *                 type: number
 *                 default: 0.7
 *                 description: Minimum similarity threshold (0-1)
 *               documentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional document IDs to search within
 *               includeChunks:
 *                 type: boolean
 *                 default: true
 *                 description: Include chunk text in results
 *               generateResponse:
 *                 type: boolean
 *                 default: false
 *                 description: Generate RAG-enhanced response
 *     responses:
 *       200:
 *         description: Search completed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/search', async (req, res) => {
  return OpenTelemetryTracing.traceOperation('rag.api.vector_search', {}, async () => {
    try {
      if (!ragService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'RAG service not available'
        });
      }

      const userId = req.user.id;
      const {
        query,
        limit = 5,
        threshold = 0.7,
        documentIds,
        includeChunks = true,
        generateResponse = false
      } = req.body;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const searchOptions = {
        limit: Math.min(Math.max(1, parseInt(limit)), 50), // Clamp between 1-50
        threshold: Math.min(Math.max(0, parseFloat(threshold)), 1), // Clamp between 0-1
        documentIds: documentIds && Array.isArray(documentIds) ? documentIds : null,
        includeChunks,
        includeDocuments: false
      };

      const result = await ragService.searchSimilar(userId, query, searchOptions);
      
      if (result.success) {
        let responseData = {
          success: true,
          data: {
            query: result.query,
            results: result.results,
            resultCount: result.resultCount,
            threshold: result.threshold,
            searchTime: result.searchTime
          }
        };

        // Generate RAG response if requested and we have results
        if (generateResponse && result.results.length > 0) {
          try {
            // This could integrate with existing RAG response generation
            // For now, provide a simple context preparation
            const context = result.results
              .map((r, idx) => `[${idx + 1}] ${r.chunkText}`)
              .join('\n\n');
            
            responseData.data.generatedResponse = {
              context: context,
              contextLength: context.length,
              sourcesUsed: result.results.length,
              note: "Full RAG response generation requires integration with language model"
            };
          } catch (ragError) {
            console.warn('[RAG API] RAG response generation failed:', ragError.message);
            responseData.data.generatedResponse = {
              error: 'RAG response generation failed',
              context: null
            };
          }
        }

        res.json(responseData);
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('[RAG API] Search error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * @swagger
 * /api/rag/stats:
 *   get:
 *     summary: Get RAG knowledge base statistics
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
  return OpenTelemetryTracing.traceOperation('rag.api.get_stats', {}, async () => {
    try {
      if (!ragService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'RAG service not available'
        });
      }

      const userId = req.user.id;
      const result = await ragService.getStats(userId);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.stats
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('[RAG API] Stats error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * @swagger
 * /api/rag/status:
 *   get:
 *     summary: Get RAG service status and configuration
 *     tags: [RAG]
 *     responses:
 *       200:
 *         description: Service status retrieved successfully
 */
router.get('/status', (req, res) => {
  try {
    const status = ragService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[RAG API] Status error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${error.message}`
    });
  }
  
  console.error('[RAG API] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export default router;