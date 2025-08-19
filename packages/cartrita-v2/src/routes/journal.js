// Journal Management Routes - Life OS
// Provides API endpoints for personal journal CRUD, sentiment analysis, and task derivation

import express from 'express';
import JournalService from '../services/JournalService.js';
import { authenticateToken } from '../middleware/auth.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();
const journalService = new JournalService();

// Initialize journal service
let isServiceInitialized = false;
journalService.initialize().then(success => {
  isServiceInitialized = success;
  if (success) {
    console.log('[JournalRoutes] ✅ Journal service ready for API requests');
  }
}).catch(error => {
  console.error('[JournalRoutes] ❌ Journal service initialization failed:', error);
});

// Middleware to check service initialization
const requireServiceInitialized = (req, res, next) => {
  if (!isServiceInitialized) {
    return res.status(503).json({
      success: false,
      error: 'Journal service is not initialized'
    });
  }
  next();
};

// GET /api/lifeos/journal - List journal entries
router.get('/', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 20,
      offset = 0,
      startDate,
      endDate,
      tags,
      mood
    } = req.query;

    // Parse tags if provided
    const parsedTags = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : null;

    const filters = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      tags: parsedTags,
      mood: mood ? parseInt(mood) : null
    };

    const result = await journalService.getEntries(userId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[JournalRoutes] Error listing entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries'
    });
  }
});

// POST /api/lifeos/journal - Create new journal entry
router.post('/', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      content,
      mood_score,
      emotions,
      tags,
      weather,
      location,
      is_private
    } = req.body;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Validate mood_score range if provided
    if (mood_score !== undefined && (mood_score < 1 || mood_score > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Mood score must be between 1 and 10'
      });
    }

    const entryData = {
      title,
      content: content.trim(),
      mood_score,
      emotions: Array.isArray(emotions) ? emotions : [],
      tags: Array.isArray(tags) ? tags : [],
      weather,
      location,
      is_private: is_private !== undefined ? is_private : true
    };

    const newEntry = await journalService.createEntry(userId, entryData);

    res.status(201).json({
      success: true,
      data: newEntry
    });
  } catch (error) {
    console.error('[JournalRoutes] Error creating entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create journal entry'
    });
  }
});

// GET /api/lifeos/journal/:id - Get single journal entry
router.get('/:id', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;

    const entry = await journalService.getEntry(entryId, userId);

    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('[JournalRoutes] Error fetching entry:', error);
    
    if (error.message === 'Journal entry not found') {
      res.status(404).json({
        success: false,
        error: 'Journal entry not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch journal entry'
      });
    }
  }
});

// PUT /api/lifeos/journal/:id - Update journal entry
router.put('/:id', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;
    const updates = req.body;

    // Validate mood_score range if provided in updates
    if (updates.mood_score !== undefined && (updates.mood_score < 1 || updates.mood_score > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Mood score must be between 1 and 10'
      });
    }

    const updatedEntry = await journalService.updateEntry(entryId, userId, updates);

    res.json({
      success: true,
      data: updatedEntry
    });
  } catch (error) {
    console.error('[JournalRoutes] Error updating entry:', error);
    
    if (error.message === 'Journal entry not found or access denied') {
      res.status(404).json({
        success: false,
        error: 'Journal entry not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update journal entry'
      });
    }
  }
});

// DELETE /api/lifeos/journal/:id - Delete journal entry
router.delete('/:id', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;

    const result = await journalService.deleteEntry(entryId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[JournalRoutes] Error deleting entry:', error);
    
    if (error.message === 'Journal entry not found or access denied') {
      res.status(404).json({
        success: false,
        error: 'Journal entry not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete journal entry'
      });
    }
  }
});

// POST /api/lifeos/journal/:id/derive-tasks - Convert journal entry to tasks
router.post('/:id/derive-tasks', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;
    const { max_tasks = 5, focus_domains = [] } = req.body;

    const constraints = {
      max_tasks: parseInt(max_tasks),
      focus_domains: Array.isArray(focus_domains) ? focus_domains : []
    };

    const derivedTasks = await journalService.deriveTasksFromEntry(entryId, userId, constraints);

    res.json({
      success: true,
      data: derivedTasks
    });
  } catch (error) {
    console.error('[JournalRoutes] Error deriving tasks:', error);
    
    if (error.message === 'Journal entry not found') {
      res.status(404).json({
        success: false,
        error: 'Journal entry not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to derive tasks from journal entry'
      });
    }
  }
});

// POST /api/lifeos/journal/batch-sentiment - Recompute sentiment for entries
router.post('/batch-sentiment', authenticateToken, requireServiceInitialized, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.body;

    // For now, return a placeholder response - actual implementation would involve
    // async processing and LLM calls for sentiment analysis
    res.json({
      success: true,
      data: {
        message: 'Batch sentiment analysis queued',
        processed_range: { startDate, endDate },
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('[JournalRoutes] Error in batch sentiment analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue batch sentiment analysis'
    });
  }
});

// GET /api/lifeos/journal/health - Journal service health check
router.get('/health', (req, res) => {
  const health = journalService.getHealthStatus();
  res.json({
    success: true,
    data: {
      service_initialized: isServiceInitialized,
      ...health
    }
  });
});

export default router;