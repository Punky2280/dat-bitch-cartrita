import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';

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

// Upcoming calendar events (stub)
router.get('/calendar/upcoming', authenticateToken, (req, res) => {
  res.json(ok({ events: [], count: 0 }));
});

// Email summary (stub)
router.get('/email/summary', authenticateToken, (req, res) => {
  res.json(ok({ unread: 0, recent: [] }));
});

// Contacts list (stub)
router.get('/contacts/list', authenticateToken, (req, res) => {
  res.json(ok({ contacts: [], count: 0 }));
});

// Tasks list (stub)
router.get('/tasks/list', authenticateToken, (req, res) => {
  res.json(ok({ tasks: [], count: 0 }));
});

// Simple activity / metrics snapshot (stub)
router.get('/metrics/activity', authenticateToken, (req, res) => {
  res.json(ok({
    messages_today: 0,
    calendar_events_today: 0,
    emails_received_today: 0,
    tasks_open: 0
  }));
});

// 404 within this router namespace
router.use((req, res) => {
  res.status(404).json({ success: false, error: 'Personal Life OS endpoint not found', path: req.originalUrl });
});

export default router;
