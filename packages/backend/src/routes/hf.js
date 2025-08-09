import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import authenticateToken from '../middleware/authenticateToken.js';

// In-memory binary store (initialized in index.js as well for safety)
if (!global.hfBinaryStore) {
  global.hfBinaryStore = new Map();
}

// Default TTL 30 minutes
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_IN_MEMORY_ITEMS = 200; // cap count
const MAX_TOTAL_MEMORY_BYTES = 200 * 1024 * 1024; // ~200MB cap
const TMP_DIR = process.env.HF_BINARY_TMP_DIR || '/tmp/hf-binaries';
if (!fs.existsSync(TMP_DIR)) {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch(_) {}
}

function currentMemoryUsageBytes() {
  let total = 0;
  for (const v of global.hfBinaryStore.values()) {
    total += v.size || 0;
  }
  return total;
}

// Multer config (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = express.Router();

/**
 * POST /api/hf/upload
 * Auth required. Accepts one file as 'file'. Returns token hfbin:<uuid>
 * Response: { success, token, expires_at, size, mime_type, filename }
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    if (size > 50 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'File too large (max 50MB)' });
    }
    if (global.hfBinaryStore.size >= MAX_IN_MEMORY_ITEMS) {
      return res.status(429).json({ success: false, error: 'In-memory store item limit reached' });
    }
    const projected = currentMemoryUsageBytes() + size;
    let storedBuffer = buffer;
    let persistedPath = null;
    if (projected > MAX_TOTAL_MEMORY_BYTES) {
      // Persist to disk instead of memory
      const fname = `${uuidv4()}-${originalname}`;
      const fpath = path.join(TMP_DIR, fname);
      try {
        fs.writeFileSync(fpath, buffer);
        storedBuffer = null; // do not keep in memory
        persistedPath = fpath;
      } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to persist file to disk' });
      }
    }
    const id = uuidv4();
    const expiresAt = Date.now() + DEFAULT_TTL_MS;
    global.hfBinaryStore.set(id, {
      buffer: storedBuffer, // may be null if persisted
      path: persistedPath,
      type: mimetype,
      size,
      filename: originalname,
      uploadedAt: Date.now(),
      expiresAt,
      userId: req.user?.id || req.userId || null,
      persisted: !!persistedPath
    });

    return res.json({
      success: true,
      token: `hfbin:${id}`,
      expires_at: new Date(expiresAt).toISOString(),
  size,
      mime_type: mimetype,
      filename: originalname,
  persisted: !!persistedPath,
    });
  } catch (error) {
    console.error('[HF Upload] Error handling upload:', error);
    return res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// GET /api/hf/list - list tokens for user with pagination & filtering
// Query params:
//  limit (default 50, max 200)
//  offset (default 0)
//  mime (exact mime type match filter)
//  expired = include | only | exclude (default exclude)
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const now = Date.now();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const mimeFilter = req.query.mime ? String(req.query.mime).toLowerCase() : null;
    const expiredMode = ['include', 'only', 'exclude'].includes(req.query.expired) ? req.query.expired : 'exclude';
    const all = [];
    for (const [id, entry] of global.hfBinaryStore.entries()) {
      if (!entry.userId || String(entry.userId) !== String(userId)) continue;
      const expired = !!entry.expiresAt && entry.expiresAt <= now;
      if (expiredMode === 'exclude' && expired) continue;
      if (expiredMode === 'only' && !expired) continue;
      if (mimeFilter && (entry.type || '').toLowerCase() !== mimeFilter) continue;
      all.push({
        token: `hfbin:${id}`,
        filename: entry.filename,
        mime_type: entry.type,
        size: entry.size,
        expires_at: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null,
        expired,
        persisted: entry.persisted
      });
    }
    // Sort newest first by uploadedAt
    all.sort((a, b) => {
      const aTime = global.hfBinaryStore.get(a.token.substring(6))?.uploadedAt || 0;
      const bTime = global.hfBinaryStore.get(b.token.substring(6))?.uploadedAt || 0;
      return bTime - aTime;
    });
    const total = all.length;
    const sliced = all.slice(offset, offset + limit);
    return res.json({ success: true, total, limit, offset, data: sliced });
  } catch (e) {
    console.error('[HF List] Error:', e);
    return res.status(500).json({ success: false, error: 'Failed to list tokens' });
  }
});

// DELETE /api/hf/revoke/:id - revoke a token (id without prefix or full token)
router.delete('/revoke/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    let id = req.params.id;
    if (id.startsWith('hfbin:')) id = id.substring(6);
    if (!global.hfBinaryStore.has(id)) return res.status(404).json({ success: false, error: 'Not found' });
    const entry = global.hfBinaryStore.get(id);
    if (entry.userId && String(entry.userId) !== String(userId)) {
      console.warn('[HF Revoke] Token ownership mismatch');
      if (global.otelCounters?.hfTokenMisuse) {
        try { global.otelCounters.hfTokenMisuse.add(1, { action: 'revoke' }); } catch(_) {}
      }
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    global.hfBinaryStore.delete(id);
    return res.json({ success: true, revoked: `hfbin:${id}` });
  } catch (e) {
    console.error('[HF Revoke] Error:', e);
    return res.status(500).json({ success: false, error: 'Failed to revoke token' });
  }
});

export default router;
