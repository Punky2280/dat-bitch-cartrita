import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Dynamic load of compiled router; if missing, attempt on-demand build then fallback to TS source (dev only)
let routerService; // will hold instance or module default
let routerInitError = null;
async function ensureRouterLoaded() {
  if (routerService) return routerService;
  const compiledPath = path.resolve(
    process.cwd(),
    'packages/backend/dist/router/HuggingFaceRouterService.js'
  );
  const jsPath = path.resolve(
    process.cwd(),
    'packages/backend/src/modelRouting/HuggingFaceRouterService.js'
  );
  const tsPath = path.resolve(
    process.cwd(),
    'packages/backend/src/modelRouting/HuggingFaceRouterService.ts'
  );
  const isDev = process.env.NODE_ENV !== 'production';
  try {
    if (fs.existsSync(compiledPath)) {
      const mod = await import(pathToFileURL(compiledPath).href);
      routerService = mod.default || mod.HuggingFaceRouterService || mod;
      return routerService;
    }
    // Try the JS version first (runtime compatible)
    if (fs.existsSync(jsPath)) {
      const mod = await import(pathToFileURL(jsPath).href);
      routerService = mod.default || mod.HuggingFaceRouterService || mod;
      return routerService;
    }
    if (isDev) {
      // attempt build:router synchronously (lightweight) then import
      try {
        const { spawnSync } = await import('child_process');
        const r = spawnSync('npm', ['run', 'build:router'], {
          cwd: path.resolve(process.cwd(), 'packages/backend'),
          stdio: 'inherit',
        });
        if (r.status === 0 && fs.existsSync(compiledPath)) {
          const mod = await import(pathToFileURL(compiledPath).href);
          routerService = mod.default || mod.HuggingFaceRouterService || mod;
          return routerService;
        }
      } catch (e) {
        // swallow and attempt TS direct import
      }
      // Fallback: directly import TS (Node ESM loader may support if ts-node/register in pipeline; else warn)
      try {
        const modTs = await import(pathToFileURL(tsPath).href);
        routerService =
          modTs.default || modTs.HuggingFaceRouterService || modTs;
        return routerService;
      } catch (e2) {
        routerInitError = e2;
      }
    }
  } catch (e) {
    routerInitError = e;
  }
  return null;
}

const router = express.Router();

/**
 * GET /api/models/status
 * Get model routing system status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const routerService = await ensureRouterLoaded();

    const status = {
      service: 'model-routing',
      status: routerService ? 'operational' : 'degraded',
      router_loaded: !!routerService,
      router_error: routerInitError?.message,
      features: {
        huggingface_routing: 'enabled',
        multi_provider: 'enabled',
        load_balancing: 'enabled',
        fallback_handling: 'enabled',
      },
      providers: {
        huggingface: 'available',
        openai: process.env.OPENAI_API_KEY ? 'available' : 'no_key',
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[ModelRouting] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model routing status',
    });
  }
});

router.get('/catalog', authenticateToken, async (req, res) => {
  const svc = await ensureRouterLoaded();
  if (!svc) {
    return res
      .status(503)
      .json({
        success: false,
        error: 'Model router unavailable',
        detail: routerInitError?.message,
      });
  }
  try {
    const data = svc.getCatalog();
    res.json({ success: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/route', authenticateToken, async (req, res) => {
  const { prompt, options } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing prompt' });
  }
  const svc = await ensureRouterLoaded();
  if (!svc) {
    return res
      .status(503)
      .json({
        success: false,
        error: 'Model router unavailable',
        detail: routerInitError?.message,
      });
  }
  try {
    const result = await svc.route(prompt, options || {});
    if (global.otelCounters?.hfRoutingLatency) {
      global.otelCounters.hfRoutingLatency.record(result.timing_ms, {
        model: result.model_id,
        task: result.task,
      });
    }
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/classify', authenticateToken, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt)
    return res.status(400).json({ success: false, error: 'Missing prompt' });
  const svc = await ensureRouterLoaded();
  if (!svc)
    return res
      .status(503)
      .json({
        success: false,
        error: 'Model router unavailable',
        detail: routerInitError?.message,
      });
  try {
    const task = svc.classify(prompt);
    const shortlist = svc
      .getCatalog()
      .filter(m => m.category === task)
      .slice(0, 6)
      .map(m => m.repo_id);
    res.json({ success: true, task, shortlist });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
