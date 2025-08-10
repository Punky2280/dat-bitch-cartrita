import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import keyVault from '../services/security/keyVaultService.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin required' });
  }
  next();
}

router.post('/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serviceName, key, scopes, purposeTags } = req.body;
    const out = await keyVault.add({ userId: req.user.id, serviceName, rawKey: key, scopes, purposeTags });
    res.status(201).json({ success: true, key: out });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/keys', authenticateToken, requireAdmin, async (req, res) => {
  const list = await keyVault.list(req.user.id);
  res.json({ success: true, keys: list });
});

router.post('/keys/rotate', authenticateToken, requireAdmin, async (req, res) => {
  const { serviceName, newKey, reason, preserve_old = true } = req.body;
  try {
    const result = await keyVault.rotate({ userId: req.user.id, serviceName, newRawKey: newKey, reason, preserve_old });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/keys/:serviceName/metadata', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const meta = await keyVault.getMetadata(req.params.serviceName, req.user.id);
    if (!meta) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, metadata: meta });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/keys/:serviceName/versions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const versions = await keyVault.listVersions(req.params.serviceName, req.user.id);
    res.json({ success: true, versions });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/keys/:serviceName/validate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { candidate } = req.body;
    const result = await keyVault.validateCandidate({ userId: req.user.id, serviceName: req.params.serviceName, candidate });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/keys/:serviceName/restore', authenticateToken, requireAdmin, async (req, res) => {
  // Always return 200; never throw — surface any unexpected errors as restored:false with error message
  try {
  console.log('[KeyVaultRoute] Restore attempt for service', req.params.serviceName, 'user', req.user?.id);
    const result = await keyVault.restore({ userId: req.user.id, serviceName: req.params.serviceName });
  console.log('[KeyVaultRoute] Restore result', result);
  res.statusCode = 200; // ensure override
  return res.json({ success: true, ...result });
  } catch (e) {
  console.log('[KeyVaultRoute] Restore error', e.message);
  res.statusCode = 200;
  return res.json({ success: false, restored: false, error: e.message });
  }
});

router.delete('/keys/:serviceName', authenticateToken, requireAdmin, async (req, res) => {
  const { serviceName } = req.params;
  const result = await keyVault.remove({ userId: req.user.id, serviceName });
  res.json({ success: true, ...result });
});

router.get('/keys/usage/analytics', authenticateToken, requireAdmin, async (req, res) => {
  const data = await keyVault.usageAnalytics(req.user.id);
  res.json({ success: true, usage: data });
});

export default router;
