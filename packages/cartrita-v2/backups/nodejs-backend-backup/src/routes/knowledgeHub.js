/**
 * Knowledge Hub API Routes
 * Advanced RAG system with vector embeddings, clustering, and graph relationships
 */

import express from 'express';
import { z } from 'zod';
import KnowledgeHubService from '../services/KnowledgeHubService.js';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

// Validation schemas
const CreateEntrySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  content_type: z
    .enum(['text', 'markdown', 'code', 'url', 'file'])
    .default('text'),
  category: z.string().max(100).default('general'),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  importance_score: z.number().min(0).max(1).default(0.5),
  source_type: z
    .enum(['user_created', 'imported', 'ai_generated', 'web_scraped'])
    .default('user_created'),
  source_url: z.string().url().optional(),
});

const UpdateEntrySchema = CreateEntrySchema.partial();

const SearchSchema = z.object({
  query: z.string().min(1),
  search_type: z.enum(['semantic', 'fulltext', 'hybrid']).default('semantic'),
  limit: z.number().min(1).max(100).default(20),
  threshold: z.number().min(0).max(1).default(0.7),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const CreateClusterSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  cluster_type: z
    .enum(['semantic', 'topical', 'hierarchical'])
    .default('semantic'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#6366f1'),
  auto_update: z.boolean().default(true),
  parent_cluster_id: z.number().optional(),
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/knowledge/entries
 * Get knowledge entries with filtering and pagination
 */
router.get('/entries', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      content_type,
      tags,
      sort_by = 'created_at',
      sort_order = 'desc',
      search,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      content_type,
      tags: tags ? tags.split(',') : undefined,
      sort_by,
      sort_order,
      search,
    };

    const result = await KnowledgeHubService.getEntries(req.user.id, options);
    res.json(result);
  } catch (error) {
    console.error('[KnowledgeHub API] Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge entries' });
  }
});

/**
 * GET /api/knowledge/entries/:id
 * Get a specific knowledge entry by ID
 */
router.get('/entries/:id', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }

    const entry = await KnowledgeHubService.getEntryById(entryId, req.user.id);
    if (!entry) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('[KnowledgeHub API] Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge entry' });
  }
});

/**
 * POST /api/knowledge/entries
 * Create a new knowledge entry
 */
router.post('/entries', async (req, res) => {
  try {
    const validatedData = CreateEntrySchema.parse(req.body);
    const entry = await KnowledgeHubService.createEntry(
      validatedData,
      req.user.id
    );

    res.status(201).json({
      message: 'Knowledge entry created successfully',
      entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    console.error('[KnowledgeHub API] Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create knowledge entry' });
  }
});

/**
 * PUT /api/knowledge/entries/:id
 * Update a knowledge entry
 */
router.put('/entries/:id', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }

    const validatedData = UpdateEntrySchema.parse(req.body);
    const entry = await KnowledgeHubService.updateEntry(
      entryId,
      validatedData,
      req.user.id
    );

    if (!entry) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    res.json({
      message: 'Knowledge entry updated successfully',
      entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    console.error('[KnowledgeHub API] Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update knowledge entry' });
  }
});

/**
 * DELETE /api/knowledge/entries/:id
 * Delete a knowledge entry
 */
router.delete('/entries/:id', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }

    const deleted = await KnowledgeHubService.deleteEntry(entryId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    res.json({ message: 'Knowledge entry deleted successfully' });
  } catch (error) {
    console.error('[KnowledgeHub API] Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete knowledge entry' });
  }
});

/**
 * POST /api/knowledge/search
 * Semantic search across knowledge entries
 */
router.post('/search', async (req, res) => {
  try {
    const validatedData = SearchSchema.parse(req.body);
    const sessionId = req.headers['x-session-id'] || `session-${Date.now()}`;

    const results = await KnowledgeHubService.searchEntries(
      validatedData,
      req.user.id,
      sessionId
    );

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    console.error('[KnowledgeHub API] Error searching entries:', error);
    res.status(500).json({ error: 'Failed to search knowledge entries' });
  }
});

/**
 * GET /api/knowledge/clusters
 * Get all knowledge clusters
 */
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await KnowledgeHubService.getClusters(req.user.id);
    res.json(clusters);
  } catch (error) {
    console.error('[KnowledgeHub API] Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge clusters' });
  }
});

/**
 * POST /api/knowledge/clusters
 * Create a new knowledge cluster
 */
router.post('/clusters', async (req, res) => {
  try {
    const validatedData = CreateClusterSchema.parse(req.body);
    const cluster = await KnowledgeHubService.createCluster(
      validatedData,
      req.user.id
    );

    res.status(201).json({
      message: 'Knowledge cluster created successfully',
      cluster,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    console.error('[KnowledgeHub API] Error creating cluster:', error);
    res.status(500).json({ error: 'Failed to create knowledge cluster' });
  }
});

/**
 * POST /api/knowledge/cluster-entries
 * Auto-cluster knowledge entries using ML algorithms
 */
router.post('/cluster-entries', async (req, res) => {
  try {
    const {
      algorithm = 'kmeans',
      num_clusters = 5,
      min_similarity = 0.7,
    } = req.body;

    const result = await KnowledgeHubService.autoClusterEntries({
      algorithm,
      num_clusters: parseInt(num_clusters),
      min_similarity: parseFloat(min_similarity),
    });

    res.json({
      message: 'Auto-clustering completed successfully',
      ...result,
    });
  } catch (error) {
    console.error('[KnowledgeHub API] Error clustering entries:', error);
    res.status(500).json({ error: 'Failed to cluster knowledge entries' });
  }
});

/**
 * GET /api/knowledge/graph
 * Get knowledge graph data for visualization
 */
router.get('/graph', async (req, res) => {
  try {
    const {
      include_relationships = true,
      include_clusters = true,
      min_strength = 0.5,
    } = req.query;

    const graphData = await KnowledgeHubService.getGraphData({
      include_relationships: include_relationships === 'true',
      include_clusters: include_clusters === 'true',
      min_strength: parseFloat(min_strength) || 0.5,
    });

    res.json(graphData);
  } catch (error) {
    console.error('[KnowledgeHub API] Error fetching graph data:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge graph data' });
  }
});

/**
 * POST /api/knowledge/relationships
 * Create relationships between knowledge entries
 */
router.post('/relationships', async (req, res) => {
  try {
    const { source_entry_id, target_entry_id, relationship_type, strength } =
      req.body;

    if (!source_entry_id || !target_entry_id || !relationship_type) {
      return res.status(400).json({
        error:
          'source_entry_id, target_entry_id, and relationship_type are required',
      });
    }

    const relationship = await KnowledgeHubService.createRelationship({
      source_entry_id: parseInt(source_entry_id),
      target_entry_id: parseInt(target_entry_id),
      relationship_type,
      strength: parseFloat(strength) || 0.5,
      discovered_by: 'manual',
    });

    res.status(201).json({
      message: 'Knowledge relationship created successfully',
      relationship,
    });
  } catch (error) {
    console.error('[KnowledgeHub API] Error creating relationship:', error);
    res.status(500).json({ error: 'Failed to create knowledge relationship' });
  }
});

/**
 * GET /api/knowledge/analytics
 * Get knowledge hub analytics and metrics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'daily' } = req.query;

    const analytics = await KnowledgeHubService.getAnalytics(req.user.id, {
      start_date,
      end_date,
      granularity,
    });

    res.json(analytics);
  } catch (error) {
    console.error('[KnowledgeHub API] Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge analytics' });
  }
});

/**
 * GET /api/knowledge/health
 * Health check for knowledge hub service
 */
router.get('/health', async (req, res) => {
  try {
    const health = await KnowledgeHubService.getHealthStatus();
    res.json(health);
  } catch (error) {
    console.error('[KnowledgeHub API] Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Knowledge hub service unavailable',
    });
  }
});

export default router;
