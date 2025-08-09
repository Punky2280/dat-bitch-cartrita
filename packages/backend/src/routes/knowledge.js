/* global process, console */
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import authenticateToken from '../middleware/authenticateToken.js';
import db from '../db.js';
import EnhancedKnowledgeHub from '../services/EnhancedKnowledgeHub.js';

const router = express.Router();

// Initialize enhanced knowledge hub
const knowledgeHub = new EnhancedKnowledgeHub();
knowledgeHub.initialize().then(success => {
  if (success) {
    console.log('[Knowledge] ✅ Enhanced Knowledge Hub initialized');
  } else {
    console.error(
      '[Knowledge] ❌ Enhanced Knowledge Hub initialization failed'
    );
  }
});

// Initialize OpenAI client conditionally
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    console.warn(
      '[Knowledge] OPENAI_API_KEY not provided - some features will be limited'
    );
  }
} catch (error) {
  console.warn(
    '[Knowledge] Failed to initialize OpenAI client:',
    error.message
  );
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * @swagger
 * /api/knowledge/search:
 *   get:
 *     summary: Vector search through knowledge base
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Similarity threshold (0-1)
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
// Enhanced semantic search with RAG
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const {
      q: query,
      limit = 10,
      threshold = 0.7,
      document_ids,
      generate_response = false,
    } = req.query;
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      threshold: parseFloat(threshold),
      documentIds: document_ids
        ? document_ids.split(',').map(id => parseInt(id))
        : null,
    };

    // Perform enhanced semantic search
    const searchResult = await knowledgeHub.semanticSearch(
      userId,
      query,
      searchOptions
    );

    if (!searchResult.success) {
      return res.status(500).json(searchResult);
    }

    let response = searchResult;

    // Generate RAG response if requested
    if (generate_response === 'true' && searchResult.results.length > 0) {
      const ragResponse = await knowledgeHub.generateRAGResponse(
        userId,
        query,
        searchResult.results
      );
      response.generated_response = ragResponse;
    }

    res.json(response);
  } catch (error) {
    console.error('[Knowledge] ❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform knowledge search',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/upload:
 *   post:
 *     summary: Upload documents to knowledge base
 *     tags: [Knowledge]
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
 *               category:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *       400:
 *         description: Invalid file or missing data
 *       500:
 *         description: Server error
 */
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { title, category = 'general', tags = '' } = req.body;
      const userId = req.user.id;
      const file = req.file;

      console.log(
        `[Knowledge] 📄 Enhanced upload request for user ${userId}:`,
        { title, category, filename: file?.originalname }
      );

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Document title is required',
        });
      }

      // Process document with Enhanced Knowledge Hub
      const fileInfo = {
        originalname: title,
        mimetype: file.mimetype,
        size: file.size,
      };

      const metadata = {
        category,
        tags: tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0),
        upload_source: 'api',
      };

      const result = await knowledgeHub.processDocument(
        userId,
        fileInfo,
        file.path,
        metadata
      );

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('[Knowledge] ⚠️ File cleanup warning:', cleanupError);
      }

      if (result.success) {
        console.log(
          `[Knowledge] ✅ Document processed with Enhanced RAG pipeline: ${result.documentId}`
        );

        res.json({
          success: true,
          document_id: result.documentId,
          content_hash: result.contentHash,
          processing_time: result.processingTime,
          status: result.status,
          message: 'Document uploaded and processed with enhanced RAG pipeline',
        });
      } else {
        res.status(409).json({
          success: false,
          error: result.message,
          existing_document_id: result.documentId,
        });
      }
    } catch (error) {
      console.error('[Knowledge] ❌ Enhanced upload error:', error);

      // Clean up file if it exists
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('[Knowledge] ⚠️ File cleanup error:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to upload and process document with enhanced system',
      });
    }
  }
);

/**
 * @swagger
 * /api/knowledge/collections:
 *   get:
 *     summary: List knowledge collections (categories)
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of collections with counts
 *       500:
 *         description: Server error
 */
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Knowledge] 📚 Fetching collections for user ${userId}`);

    const query = `
      SELECT 
        category,
        COUNT(*) as document_count,
        MIN(created_at) as first_created,
        MAX(updated_at) as last_updated
      FROM knowledge_entries 
      WHERE user_id = $1 
      GROUP BY category
      ORDER BY document_count DESC, category ASC
    `;

    const result = await db.query(query, [userId]);

    console.log(`[Knowledge] ✅ Found ${result.rows.length} collections`);

    res.json({
      success: true,
      collections: result.rows.map(row => ({
        name: row.category,
        document_count: parseInt(row.document_count),
        first_created: row.first_created,
        last_updated: row.last_updated,
      })),
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge collections',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/documents:
 *   get:
 *     summary: List documents with metadata
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of documents
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of documents to skip
 *     responses:
 *       200:
 *         description: List of documents
 *       500:
 *         description: Server error
 */
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    console.log(`[Knowledge] 📋 Fetching documents for user ${userId}:`, {
      category,
      limit,
      offset,
    });

    let query = `
      SELECT 
        id,
        title,
        content_type,
        source_type,
        source_reference,
        tags,
        category,
        importance_score,
        created_at,
        updated_at,
        LENGTH(content) as content_length
      FROM knowledge_entries 
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += `
      ORDER BY importance_score DESC, updated_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM knowledge_entries 
      WHERE user_id = $1
    `;
    const countParams = [userId];

    if (category) {
      countQuery += ` AND category = $2`;
      countParams.push(category);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    console.log(
      `[Knowledge] ✅ Found ${result.rows.length} documents (${total} total)`
    );

    res.json({
      success: true,
      documents: result.rows.map(doc => ({
        ...doc,
        content_length: parseInt(doc.content_length),
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + parseInt(limit) < total,
      },
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Documents list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.delete('/documents/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    console.log(
      `[Knowledge] 🗑️ Deleting document ${documentId} for user ${userId}`
    );

    // First check if document exists and belongs to user
    const checkQuery = `
      SELECT id, title FROM knowledge_entries 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await db.query(checkQuery, [documentId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied',
      });
    }

    const documentTitle = checkResult.rows[0].title;

    // Delete the document
    const deleteQuery = `
      DELETE FROM knowledge_entries 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const deleteResult = await db.query(deleteQuery, [documentId, userId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    console.log(
      `[Knowledge] ✅ Deleted document "${documentTitle}" (ID: ${documentId})`
    );

    res.json({
      success: true,
      message: 'Document deleted successfully',
      deleted_document: {
        id: parseInt(documentId),
        title: documentTitle,
      },
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/documents/{id}:
 *   get:
 *     summary: Get a specific document
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/documents/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    console.log(
      `[Knowledge] 📄 Fetching document ${documentId} for user ${userId}`
    );

    const query = `
      SELECT 
        id,
        title,
        content,
        content_type,
        source_type,
        source_reference,
        tags,
        category,
        importance_score,
        created_at,
        updated_at
      FROM knowledge_entries 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [documentId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied',
      });
    }

    console.log(`[Knowledge] ✅ Found document "${result.rows[0].title}"`);

    res.json({
      success: true,
      document: result.rows[0],
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Get document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/entries:
 *   get:
 *     summary: Get knowledge entries (alias for documents)
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of entries
 *     responses:
 *       200:
 *         description: List of knowledge entries
 *       500:
 *         description: Server error
 */
router.get('/entries', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    console.log(`[Knowledge] 📋 Fetching entries for user ${userId}:`, {
      category,
      limit,
    });

    let query = `
      SELECT 
        id,
        title,
        content,
        content_type,
        source_type,
        tags,
        category,
        importance_score,
        created_at,
        updated_at
      FROM knowledge_entries 
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += `
      ORDER BY updated_at DESC
      LIMIT $${paramCount + 1}
    `;
    params.push(limit);

    const result = await db.query(query, params);

    console.log(`[Knowledge] ✅ Found ${result.rows.length} entries`);

    res.json({
      success: true,
      entries: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Entries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge entries',
      entries: [],
    });
  }
});

/**
 * @swagger
 * /api/knowledge/clusters:
 *   get:
 *     summary: Get knowledge clusters (topic groupings)
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of knowledge clusters
 *       500:
 *         description: Server error
 */
router.get('/clusters', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Knowledge] 🔗 Fetching clusters for user ${userId}`);

    // Simple clustering based on categories and tags
    const query = `
      SELECT 
        category,
        COUNT(*) as document_count,
        array_agg(DISTINCT unnest(tags)) as cluster_tags,
        array_agg(DISTINCT title) as sample_titles
      FROM knowledge_entries 
      WHERE user_id = $1 
      GROUP BY category
      ORDER BY document_count DESC
    `;

    const result = await db.query(query, [userId]);

    const clusters = result.rows.map((row, index) => ({
      id: index + 1,
      name: row.category,
      document_count: parseInt(row.document_count),
      tags: row.cluster_tags?.filter(tag => tag) || [],
      sample_titles: row.sample_titles?.slice(0, 3) || [],
      cluster_type: 'category',
    }));

    console.log(`[Knowledge] ✅ Found ${clusters.length} clusters`);

    res.json({
      success: true,
      clusters: clusters,
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Clusters error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge clusters',
      clusters: [],
    });
  }
});

/**
 * @swagger
 * /api/knowledge/graph:
 *   get:
 *     summary: Get knowledge graph data
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Knowledge graph nodes and connections
 *       500:
 *         description: Server error
 */
router.get('/graph', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Knowledge] 🕸️ Fetching knowledge graph for user ${userId}`);

    // Get documents with their categories and tags to build graph
    const query = `
      SELECT 
        id,
        title,
        category,
        tags,
        importance_score,
        created_at
      FROM knowledge_entries 
      WHERE user_id = $1
      ORDER BY importance_score DESC, created_at DESC
      LIMIT 100
    `;

    const result = await db.query(query, [userId]);

    // Build nodes and edges for graph visualization
    const nodes = [];
    const edges = [];
    const categoryNodes = new Map();

    // Create category nodes
    result.rows.forEach(doc => {
      if (!categoryNodes.has(doc.category)) {
        categoryNodes.set(doc.category, {
          id: `cat_${doc.category}`,
          label: doc.category,
          type: 'category',
          size: 20,
          color: '#4F46E5',
        });
      }
    });

    // Add category nodes
    nodes.push(...Array.from(categoryNodes.values()));

    // Create document nodes and edges
    result.rows.forEach(doc => {
      // Document node
      nodes.push({
        id: `doc_${doc.id}`,
        label: doc.title,
        type: 'document',
        size: Math.max(10, doc.importance_score * 20),
        color: '#10B981',
        metadata: {
          category: doc.category,
          tags: doc.tags,
          created_at: doc.created_at,
        },
      });

      // Edge to category
      edges.push({
        id: `edge_${doc.id}_${doc.category}`,
        source: `doc_${doc.id}`,
        target: `cat_${doc.category}`,
        type: 'belongs_to',
      });
    });

    console.log(
      `[Knowledge] ✅ Built graph with ${nodes.length} nodes and ${edges.length} edges`
    );

    res.json({
      success: true,
      graph: {
        nodes: nodes,
        edges: edges,
        stats: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          categories: categoryNodes.size,
          documents: result.rows.length,
        },
      },
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Graph error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate knowledge graph',
      graph: { nodes: [], edges: [], stats: {} },
    });
  }
});

/**
 * @swagger
 * /api/knowledge/analytics:
 *   get:
 *     summary: Get comprehensive knowledge analytics
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comprehensive knowledge analytics
 *       500:
 *         description: Server error
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(
      `[Knowledge] 📊 Generating comprehensive analytics for user ${userId}`
    );

    const analytics = await knowledgeHub.getKnowledgeAnalytics(userId);

    if (analytics.success) {
      res.json(analytics);
    } else {
      res.status(500).json({
        success: false,
        error: analytics.error,
      });
    }
  } catch (error) {
    console.error('[Knowledge] ❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate knowledge analytics',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/processing-status:
 *   get:
 *     summary: Get knowledge hub processing status
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Processing status and statistics
 *       500:
 *         description: Server error
 */
router.get('/processing-status', authenticateToken, async (req, res) => {
  try {
    const status = knowledgeHub.getStatus();

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get processing status',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/relationships:
 *   get:
 *     summary: Get document relationships
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: document_id
 *         schema:
 *           type: integer
 *         description: Document ID to find relationships for
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Relationship type filter
 *     responses:
 *       200:
 *         description: Document relationships
 *       500:
 *         description: Server error
 */
router.get('/relationships', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_id, type } = req.query;

    console.log(`[Knowledge] 🔗 Fetching relationships for user ${userId}`);

    let query = `
      SELECT 
        kr.*,
        kd1.title as source_title,
        kd2.title as target_title
      FROM knowledge_relationships kr
      JOIN knowledge_documents kd1 ON kr.source_document_id = kd1.id
      JOIN knowledge_documents kd2 ON kr.target_document_id = kd2.id
      WHERE kr.user_id = $1
    `;
    const params = [userId];

    if (document_id) {
      query +=
        ' AND (kr.source_document_id = $2 OR kr.target_document_id = $2)';
      params.push(document_id);
    }

    if (type) {
      query += ` AND kr.relationship_type = $${params.length + 1}`;
      params.push(type);
    }

    query += ' ORDER BY kr.similarity_score DESC';

    const result = await db.query(query, params);

    console.log(`[Knowledge] ✅ Found ${result.rows.length} relationships`);

    res.json({
      success: true,
      relationships: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Relationships error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document relationships',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/extractions:
 *   get:
 *     summary: Get knowledge extractions
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: document_id
 *         schema:
 *           type: integer
 *         description: Document ID to get extractions for
 *       - in: query
 *         name: extraction_type
 *         schema:
 *           type: string
 *         description: Type of extraction to filter by
 *     responses:
 *       200:
 *         description: Knowledge extractions
 *       500:
 *         description: Server error
 */
router.get('/extractions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_id, extraction_type } = req.query;

    console.log(`[Knowledge] 🧠 Fetching extractions for user ${userId}`);

    let query = `
      SELECT 
        ke.*,
        kd.title as document_title
      FROM knowledge_extractions ke
      JOIN knowledge_documents kd ON ke.document_id = kd.id
      WHERE ke.user_id = $1
    `;
    const params = [userId];

    if (document_id) {
      query += ` AND ke.document_id = $${params.length + 1}`;
      params.push(document_id);
    }

    if (extraction_type) {
      query += ` AND ke.extraction_type = $${params.length + 1}`;
      params.push(extraction_type);
    }

    query += ' ORDER BY ke.created_at DESC';

    const result = await db.query(query, params);

    console.log(`[Knowledge] ✅ Found ${result.rows.length} extractions`);

    res.json({
      success: true,
      extractions: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Extractions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge extractions',
    });
  }
});

/**
 * @swagger
 * /api/knowledge/stats:
 *   get:
 *     summary: Get knowledge base statistics
 *     tags: [Knowledge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Knowledge base statistics
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Knowledge] 📊 Fetching stats for user ${userId}`);

    const statsQuery = `
      SELECT 
        COUNT(*) as total_documents,
        COUNT(DISTINCT category) as total_categories,
        AVG(importance_score) as avg_importance,
        SUM(LENGTH(content)) as total_content_size,
        MIN(created_at) as first_document,
        MAX(updated_at) as last_updated
      FROM knowledge_entries 
      WHERE user_id = $1
    `;

    const result = await db.query(statsQuery, [userId]);
    const stats = result.rows[0];

    // Get top categories
    const topCategoriesQuery = `
      SELECT category, COUNT(*) as count
      FROM knowledge_entries 
      WHERE user_id = $1
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `;

    const categoriesResult = await db.query(topCategoriesQuery, [userId]);

    console.log(
      `[Knowledge] ✅ Stats: ${stats.total_documents} documents in ${stats.total_categories} categories`
    );

    res.json({
      success: true,
      stats: {
        total_documents: parseInt(stats.total_documents),
        total_categories: parseInt(stats.total_categories),
        avg_importance_score: parseFloat(stats.avg_importance) || 0,
        total_content_size: parseInt(stats.total_content_size) || 0,
        first_document: stats.first_document,
        last_updated: stats.last_updated,
        top_categories: categoriesResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count),
        })),
      },
    });
  } catch (error) {
    console.error('[Knowledge] ❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge base statistics',
    });
  }
});

export default router;
