import express from 'express';
import multer from 'multer';
import AudioPipelineOrchestrator from '../services/audio/AudioPipelineOrchestrator.js';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

function validateId(req, res, next) {
  const { id } = req.params;
  if (!/^\d+$/.test(id))
    return res.status(400).json({ success: false, error: 'Invalid id' });
  next();
}

// Simple mime whitelist for audio; extend as needed
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
]);
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: 'Missing file' });
    if (!ALLOWED_MIME.has(req.file.mimetype))
      return res
        .status(415)
        .json({ success: false, error: 'Unsupported media type' });
    if (req.file.size === 0)
      return res.status(400).json({ success: false, error: 'Empty file' });
    const checksum = crypto
      .createHash('sha256')
      .update(req.file.buffer)
      .digest('hex');
    const r = await AudioPipelineOrchestrator.ingest(req.user?.id, {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mime: req.file.mimetype,
      checksum,
    });
    return res.json({ ...r, checksum });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/transcribe', validateId, async (req, res) => {
  try {
    // Basic options validation
    const body = req.body || {};
    if (body.language && typeof body.language !== 'string')
      return res
        .status(400)
        .json({ success: false, error: 'language must be string' });
    if (body.force && typeof body.force !== 'boolean')
      return res
        .status(400)
        .json({ success: false, error: 'force must be boolean' });
    const r = await AudioPipelineOrchestrator.transcribe(
      req.user?.id,
      req.params.id,
      body
    );
    const statusCode = r.success ? 200 : 500;
    return res.status(statusCode).json(r);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/preprocess', validateId, async (req, res) => {
  try {
    const body = req.body || {};
    if (body.duration_ms && typeof body.duration_ms !== 'number')
      return res
        .status(400)
        .json({ success: false, error: 'duration_ms must be number' });
    const r = await AudioPipelineOrchestrator.preprocess(
      req.user?.id,
      req.params.id,
      body
    );
    const statusCode = r.success ? 200 : 500;
    return res.status(statusCode).json(r);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/voice-swap', validateId, async (req, res) => {
  try {
    const body = req.body || {};
    const { targetVoice } = body;
    if (!targetVoice || typeof targetVoice !== 'string')
      return res
        .status(400)
        .json({ success: false, error: 'targetVoice required string' });
    if (
      body.strength &&
      (typeof body.strength !== 'number' ||
        body.strength < 0 ||
        body.strength > 1)
    )
      return res
        .status(400)
        .json({ success: false, error: 'strength must be number 0..1' });
    const r = await AudioPipelineOrchestrator.voiceSwap(
      req.user?.id,
      req.params.id,
      targetVoice,
      body
    );
    const statusCode = r.success ? 200 : 500;
    return res.status(statusCode).json(r);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/tts', validateId, async (req, res) => {
  try {
    const body = req.body || {};
    const { text } = body;
    if (!text || typeof text !== 'string')
      return res
        .status(400)
        .json({ success: false, error: 'text required string' });
    if (text.length > 5000)
      return res.status(400).json({ success: false, error: 'text too long' });
    if (body.model && typeof body.model !== 'string')
      return res
        .status(400)
        .json({ success: false, error: 'model must be string' });
    const r = await AudioPipelineOrchestrator.tts(
      req.user?.id,
      req.params.id,
      text,
      body
    );
    const statusCode = r.success ? 200 : 500;
    return res.status(statusCode).json(r);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, original_filename, status, created_at FROM audio_assets ORDER BY id DESC LIMIT 50'
    );
    return res.json({ success: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', validateId, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM audio_assets WHERE id=$1', [
      req.params.id,
    ]);
    if (!r.rows.length)
      return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
