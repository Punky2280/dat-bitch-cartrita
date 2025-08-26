import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import pool from '../db.js';
import JournalService from '../services/JournalService.js';

// Personal Life OS aggregate route (enhanced with JournalService)
// Provides comprehensive endpoints with real journal functionality and stub endpoints for other services.
// Each endpoint returns a consistent { success, data, meta } envelope.

const router = express.Router();

// Initialize journal service
const journalService = new JournalService();
let isJournalServiceReady = false;

journalService
  .initialize()
  .then(success => {
    isJournalServiceReady = success;
    if (success) {
      console.log('[PersonalLifeOS] ✅ Journal service integrated and ready');
    }
  })
  .catch(error => {
    console.error(
      '[PersonalLifeOS] ❌ Journal service integration failed:',
      error
    );
  });

// Shared helper to wrap responses
function ok(data, meta = {}) {
  return {
    success: true,
    data,
    meta: { generated_at: new Date().toISOString(), ...meta },
  };
}

// Health / index
router.get('/', authenticateToken, (req, res) => {
  res.json(
    ok({
      message: 'Personal Life OS root online',
      services: {
        journal: isJournalServiceReady ? 'ready' : 'initializing',
      },
      endpoints: [
        '/google-account/profile',
        '/calendar/upcoming',
        '/email/summary',
        '/contacts/list',
        '/tasks/list',
        '/journal/list',
        '/journal/create',
        '/journal/:id',
        '/journal/:id/derive-tasks',
        '/metrics/activity',
      ],
    })
  );
});

// Google account basic profile (stub)
router.get('/google-account/profile', authenticateToken, (req, res) => {
  res.json(
    ok({
      connected: false,
      email: req.user?.email || null,
      scopes: [],
      status: 'disconnected',
    })
  );
});

// Upcoming calendar events (stub) (alias for potential differing frontend path)
router.get(
  ['/calendar/upcoming', '/calendar/upcoming-events'],
  authenticateToken,
  (req, res) => {
    res.json(ok({ events: [], count: 0 }));
  }
);

// Email summary (stub)
router.get(
  ['/email/summary', '/email/overview'],
  authenticateToken,
  (req, res) => {
    res.json(ok({ unread: 0, recent: [] }));
  }
);

// Contacts list (stub)
router.get(['/contacts/list', '/contacts'], authenticateToken, (req, res) => {
  res.json(ok({ contacts: [], count: 0 }));
});

// Tasks list (stub)
router.get(['/tasks/list', '/tasks'], authenticateToken, (req, res) => {
  res.json(ok({ tasks: [], count: 0 }));
});

// Journal entries list (enhanced with JournalService)
router.get('/journal/list', authenticateToken, async (req, res) => {
  try {
    if (!isJournalServiceReady) {
      return res
        .status(503)
        .json({ success: false, error: 'Journal service not ready' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user context' });
    }

    const {
      limit = 25,
      offset = 0,
      startDate,
      endDate,
      tags,
      mood,
    } = req.query;

    // Parse tags if provided
    const parsedTags = tags
      ? Array.isArray(tags)
        ? tags
        : tags.split(',')
      : null;

    const filters = {
      limit: Math.min(parseInt(limit, 10) || 25, 100),
      offset: parseInt(offset, 10) || 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      tags: parsedTags,
      mood: mood ? parseInt(mood, 10) : null,
    };

    const result = await journalService.getEntries(userId, filters);

    res.json(
      ok({
        entries: result.entries,
        count: result.total,
        pagination: {
          limit: result.limit,
          offset: result.offset,
          hasMore: result.entries.length === result.limit,
        },
      })
    );
  } catch (error) {
    console.error('[PersonalLifeOS] Journal list failed:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to load journal entries' });
  }
});

// Create journal entry (enhanced with JournalService)
router.post('/journal/create', authenticateToken, async (req, res) => {
  try {
    if (!isJournalServiceReady) {
      return res
        .status(503)
        .json({ success: false, error: 'Journal service not ready' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user context' });
    }

    const {
      title,
      content,
      mood_score,
      emotions,
      tags,
      weather,
      location,
      is_private,
    } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, error: 'Content required' });
    }

    // Validate mood_score range if provided
    if (mood_score !== undefined && (mood_score < 1 || mood_score > 10)) {
      return res
        .status(400)
        .json({ success: false, error: 'Mood score must be between 1 and 10' });
    }

    const entryData = {
      title,
      content: content.trim(),
      mood_score,
      emotions: Array.isArray(emotions) ? emotions : [],
      tags: Array.isArray(tags) ? tags : [],
      weather,
      location,
      is_private: is_private !== undefined ? is_private : true,
    };

    const newEntry = await journalService.createEntry(userId, entryData);

    res.json(ok({ entry: newEntry }));
  } catch (error) {
    console.error('[PersonalLifeOS] Journal create failed:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to create journal entry' });
  }
});

// Get single journal entry
router.get('/journal/:id', authenticateToken, async (req, res) => {
  try {
    if (!isJournalServiceReady) {
      return res
        .status(503)
        .json({ success: false, error: 'Journal service not ready' });
    }

    const userId = req.user?.id;
    const entryId = req.params.id;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user context' });
    }

    const entry = await journalService.getEntry(entryId, userId);
    res.json(ok({ entry }));
  } catch (error) {
    console.error('[PersonalLifeOS] Get journal entry failed:', error);

    if (error.message === 'Journal entry not found') {
      res
        .status(404)
        .json({ success: false, error: 'Journal entry not found' });
    } else {
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch journal entry' });
    }
  }
});

// Update journal entry
router.put('/journal/:id', authenticateToken, async (req, res) => {
  try {
    if (!isJournalServiceReady) {
      return res
        .status(503)
        .json({ success: false, error: 'Journal service not ready' });
    }

    const userId = req.user?.id;
    const entryId = req.params.id;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user context' });
    }

    const updates = req.body;

    // Validate mood_score range if provided in updates
    if (
      updates.mood_score !== undefined &&
      (updates.mood_score < 1 || updates.mood_score > 10)
    ) {
      return res
        .status(400)
        .json({ success: false, error: 'Mood score must be between 1 and 10' });
    }

    const updatedEntry = await journalService.updateEntry(
      entryId,
      userId,
      updates
    );
    res.json(ok({ entry: updatedEntry }));
  } catch (error) {
    console.error('[PersonalLifeOS] Update journal entry failed:', error);

    if (error.message === 'Journal entry not found or access denied') {
      res
        .status(404)
        .json({ success: false, error: 'Journal entry not found' });
    } else {
      res
        .status(500)
        .json({ success: false, error: 'Failed to update journal entry' });
    }
  }
});

// Delete journal entry
router.delete('/journal/:id', authenticateToken, async (req, res) => {
  try {
    if (!isJournalServiceReady) {
      return res
        .status(503)
        .json({ success: false, error: 'Journal service not ready' });
    }

    const userId = req.user?.id;
    const entryId = req.params.id;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user context' });
    }

    const result = await journalService.deleteEntry(entryId, userId);
    res.json(ok(result));
  } catch (error) {
    console.error('[PersonalLifeOS] Delete journal entry failed:', error);

    if (error.message === 'Journal entry not found or access denied') {
      res
        .status(404)
        .json({ success: false, error: 'Journal entry not found' });
    } else {
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete journal entry' });
    }
  }
});

// Derive tasks from journal entry
router.post(
  '/journal/:id/derive-tasks',
  authenticateToken,
  async (req, res) => {
    try {
      if (!isJournalServiceReady) {
        return res
          .status(503)
          .json({ success: false, error: 'Journal service not ready' });
      }

      const userId = req.user?.id;
      const entryId = req.params.id;

      if (!userId) {
        return res
          .status(400)
          .json({ success: false, error: 'Missing user context' });
      }

      const { max_tasks = 5, focus_domains = [] } = req.body;

      const constraints = {
        max_tasks: parseInt(max_tasks, 10),
        focus_domains: Array.isArray(focus_domains) ? focus_domains : [],
      };

      const derivedTasks = await journalService.deriveTasksFromEntry(
        entryId,
        userId,
        constraints
      );
      res.json(ok(derivedTasks));
    } catch (error) {
      console.error('[PersonalLifeOS] Derive tasks failed:', error);

      if (error.message === 'Journal entry not found') {
        res
          .status(404)
          .json({ success: false, error: 'Journal entry not found' });
      } else {
        res
          .status(500)
          .json({
            success: false,
            error: 'Failed to derive tasks from journal entry',
          });
      }
    }
  }
);

// Simple activity / metrics snapshot (stub)
router.get(['/metrics/activity', '/metrics'], authenticateToken, (req, res) => {
  res.json(
    ok({
      messages_today: 0,
      calendar_events_today: 0,
      emails_received_today: 0,
      tasks_open: 0,
    })
  );
});

// AI suggestions (stub)
router.get(
  ['/ai/suggestions', '/ai/recommendations'],
  authenticateToken,
  (req, res) => {
    res.json(ok({ suggestions: [] }));
  }
);

// 404 within this router namespace
router.use((req, res) => {
  res
    .status(404)
    .json({
      success: false,
      error: 'Personal Life OS endpoint not found',
      path: req.originalUrl,
    });
});

export default router;
