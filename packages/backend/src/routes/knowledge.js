/* global process, console */
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import authenticateToken from '../middleware/authenticateToken.js';
import db from '../db.js';

const router = express.Router();

// Initialize OpenAI client conditionally
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  } else {
    console.warn('[Knowledge] OPENAI_API_KEY not provided - some features will be limited');
  }
} catch (error) {
  console.warn('[Knowledge] Failed to initialize OpenAI client:', error.message);
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
      'text/markdown'
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
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
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q: query, limit = 10, threshold = 0.7 } = req.query;
    const userId = req.user.id;

    console.log(`[Knowledge] 🔍 Vector search for user ${userId}:`, query);

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Perform vector similarity search
    const searchQuery = `
      SELECT 
        ke.id,
        ke.title,
        ke.content,
        ke.content_type,
        ke.source_type,
        ke.tags,
        ke.category,
        ke.importance_score,
        ke.created_at,
        ke.updated_at,
        (1 - (ke.embedding <=> $1::vector)) as similarity_score
      FROM knowledge_entries ke
      WHERE ke.user_id = $2 
        AND (1 - (ke.embedding <=> $1::vector)) > $3
      ORDER BY similarity_score DESC
      LIMIT $4
    `;

    const result = await db.query(searchQuery, [
      `[${queryEmbedding.join(',')}]`,
      userId,
      threshold,
      limit
    ]);

    console.log(`[Knowledge] ✅ Found ${result.rows.length} results`);

    res.json({
      success: true,
      results: result.rows,
      query: query,
      total: result.rows.length
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform knowledge search'
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
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, category = 'general', tags = '' } = req.body;
    const userId = req.user.id;
    const file = req.file;

    console.log(`[Knowledge] 📄 Upload request for user ${userId}:`, { title, category, filename: file?.originalname });

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Document title is required'
      });
    }

    // Read file content (simplified - in production, use proper file parsers)
    let content;
    
    try {
      content = fs.readFileSync(file.path, 'utf8');
    } catch (readError) {
      console.error('[Knowledge] ❌ File read error:', readError);
      return res.status(400).json({
        success: false,
        error: 'Unable to read uploaded file'
      });
    }

    // Generate embedding for the content
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: `${title} ${content}`
    });
    
    const embedding = embeddingResponse.data[0].embedding;

    // Process tags
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    // Insert into database
    const insertQuery = `
      INSERT INTO knowledge_entries 
      (user_id, title, content, content_type, source_type, source_reference, 
       embedding, tags, category, importance_score, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id, title, content_type, category, tags, created_at
    `;

    const result = await db.query(insertQuery, [
      userId,
      title,
      content,
      file.mimetype,
      'upload',
      file.originalname,
      `[${embedding.join(',')}]`,
      tagArray,
      category,
      0.5 // Default importance score
    ]);

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    console.log(`[Knowledge] ✅ Document uploaded with ID: ${result.rows[0].id}`);

    res.json({
      success: true,
      document: result.rows[0],
      message: 'Document uploaded and indexed successfully'
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Upload error:', error);
    
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
      error: 'Failed to upload and process document'
    });
  }
});

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
        last_updated: row.last_updated
      }))
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge collections'
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

    console.log(`[Knowledge] 📋 Fetching documents for user ${userId}:`, { category, limit, offset });

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

    console.log(`[Knowledge] ✅ Found ${result.rows.length} documents (${total} total)`);

    res.json({
      success: true,
      documents: result.rows.map(doc => ({
        ...doc,
        content_length: parseInt(doc.content_length)
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Documents list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
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

    console.log(`[Knowledge] 🗑️ Deleting document ${documentId} for user ${userId}`);

    // First check if document exists and belongs to user
    const checkQuery = `
      SELECT id, title FROM knowledge_entries 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await db.query(checkQuery, [documentId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
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
        error: 'Document not found'
      });
    }

    console.log(`[Knowledge] ✅ Deleted document "${documentTitle}" (ID: ${documentId})`);

    res.json({
      success: true,
      message: 'Document deleted successfully',
      deleted_document: {
        id: parseInt(documentId),
        title: documentTitle
      }
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
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

    console.log(`[Knowledge] 📄 Fetching document ${documentId} for user ${userId}`);

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
        error: 'Document not found or access denied'
      });
    }

    console.log(`[Knowledge] ✅ Found document "${result.rows[0].title}"`);

    res.json({
      success: true,
      document: result.rows[0]
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Get document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document'
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

    console.log(`[Knowledge] ✅ Stats: ${stats.total_documents} documents in ${stats.total_categories} categories`);

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
          count: parseInt(row.count)
        }))
      }
    });

  } catch (error) {
    console.error('[Knowledge] ❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge base statistics'
    });
  }
});

export default router;