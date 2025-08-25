import express from 'express';
import AgentToolRegistry from '../agi/orchestration/AgentToolRegistry.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // Ensure registry initialized via legacy singleton / adapter
    const registry = new AgentToolRegistry();
    if (!registry.initialized) {
      process.env.USE_COMPOSITE_REGISTRY =
        process.env.USE_COMPOSITE_REGISTRY || '1';
      process.env.REGISTRY_PHASE_MAX = process.env.REGISTRY_PHASE_MAX || '0';
      await registry.initialize();
    }
    const metrics = registry.metrics || registry.composite?.metrics || {};
    res.json({ success: true, metrics, toolCount: registry.tools?.size || 0 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Basic search: keyword over tool name/description; semantic placeholder if embeddings present.
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q)
    return res
      .status(400)
      .json({ success: false, error: 'Missing q parameter' });
  try {
    const registry = new AgentToolRegistry();
    if (!registry.initialized) {
      process.env.USE_COMPOSITE_REGISTRY =
        process.env.USE_COMPOSITE_REGISTRY || '1';
      process.env.REGISTRY_PHASE_MAX = process.env.REGISTRY_PHASE_MAX || '0';
      await registry.initialize();
    }
    const tools = [...registry.tools.values()].map(t => ({
      name: t.name,
      description: t.description || '',
      category: t.category || null,
    }));
    const kw = q.toLowerCase();
    // Simple keyword scoring (frequency of substring matches + name boost)
    const scored = tools
      .map(t => {
        const hay = (
          t.name +
          ' ' +
          t.description +
          ' ' +
          (t.category || '')
        ).toLowerCase();
        let score = 0;
        if (t.name.toLowerCase().includes(kw)) score += 5;
        const occurrences = hay.split(kw).length - 1;
        score += occurrences;
        return { ...t, score };
      })
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    res.json({
      success: true,
      query: q,
      count: scored.length,
      results: scored,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
