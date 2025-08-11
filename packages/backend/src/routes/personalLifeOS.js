import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import pool from '../db.js';

// Personal Life OS aggregate route (stub implementation)
// Provides placeholder endpoints so frontend stops 404'ing while real data services are built.
// Each endpoint returns a consistent { success, data, meta } envelope.

const router = express.Router();

// Shared helper to wrap responses
function ok(data, meta = {}) {
  return { success: true, data, meta: { generated_at: new Date().toISOString(), ...meta } };
}

// Health / index
router.get('/', authenticateToken, (req, res) => {
  res.json(ok({ message: 'Personal Life OS root online', endpoints: [
    '/google-account/profile','/calendar/upcoming','/email/summary','/contacts/list','/tasks/list','/metrics/activity'
  ] }));
});

// Google account basic profile (stub)
router.get('/google-account/profile', authenticateToken, (req, res) => {
  res.json(ok({
    connected: false,
    email: req.user?.email || null,
    scopes: [],
    status: 'disconnected'
  }));
});

// Upcoming calendar events (stub) (alias for potential differing frontend path)
router.get(['/calendar/upcoming','/calendar/upcoming-events'], authenticateToken, (req, res) => {
  res.json(ok({ events: [], count: 0 }));
});

// Email summary (stub)
router.get(['/email/summary','/email/overview'], authenticateToken, (req, res) => {
  res.json(ok({ unread: 0, recent: [] }));
});

// Contacts list (stub)
router.get(['/contacts/list','/contacts'], authenticateToken, (req, res) => {
  res.json(ok({ contacts: [], count: 0 }));
});

// Tasks list (stub)
router.get(['/tasks/list','/tasks'], authenticateToken, (req, res) => {
  res.json(ok({ tasks: [], count: 0 }));
});

// Journal entries list (DB-backed)
router.get('/journal/list', authenticateToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  const userId = req.user?.id; // expecting UUID in users table
  const mood = req.query.mood;
  try {
    if(!userId){
      return res.status(400).json({ success: false, error: 'Missing user context' });
    }
    const params = [userId, limit, offset];
    let moodClause = '';
    if (mood) { moodClause = ' AND mood = $4'; params.push(mood); }
    const query = `SELECT id, entry_date, content, mood, sentiment_score, emotions, derived_tasks, tags, is_private
                   FROM journal_entries
                   WHERE user_id = $1 ${moodClause}
                   ORDER BY entry_date DESC
                   LIMIT $2 OFFSET $3`;
    const entriesResult = await pool.query(query, params);
    const countResult = await pool.query(`SELECT COUNT(*) FROM journal_entries WHERE user_id = $1 ${mood? ' AND mood = $2':''}`, mood? [userId, mood] : [userId]);
    res.json(ok({ entries: entriesResult.rows, count: Number(countResult.rows[0].count) }, { limit, offset }));
  } catch (e) {
    console.error('[journal] list failed', e);
    res.status(500).json({ success: false, error: 'Failed to load journal entries' });
  }
});

// Create journal entry
router.post('/journal/create', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if(!userId) return res.status(400).json({ success: false, error: 'Missing user context' });
  const { content, mood, tags, is_private } = req.body || {};
  if(!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: 'Content required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO journal_entries (user_id, content, mood, tags, is_private)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, entry_date, content, mood, sentiment_score, emotions, derived_tasks, tags, is_private`,
      [userId, content.trim(), mood || null, Array.isArray(tags)? tags : null, !!is_private]
    );
    res.json(ok({ entry: result.rows[0] }));
  } catch (e){
    console.error('[journal] create failed', e);
    res.status(500).json({ success: false, error: 'Failed to create journal entry' });
  }
});

// Simple activity / metrics snapshot (stub)
router.get(['/metrics/activity','/metrics'], authenticateToken, (req, res) => {
  res.json(ok({
    messages_today: 0,
    calendar_events_today: 0,
    emails_received_today: 0,
    tasks_open: 0
  }));
});

// AI suggestions (stub)
router.get(['/ai/suggestions','/ai/recommendations'], authenticateToken, (req, res) => {
  res.json(ok({ suggestions: [] }));
});

// 404 within this router namespace
router.use((req, res) => {
  res.status(404).json({ success: false, error: 'Personal Life OS endpoint not found', path: req.originalUrl });
});

export default router;
