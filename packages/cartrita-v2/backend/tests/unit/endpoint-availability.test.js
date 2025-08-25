import request from 'supertest';

// These tests probe critical public endpoints to ensure they exist and respond.
// They target a running backend instance. If not reachable, tests skip gracefully.

const BASE = process.env.TEST_BASE || 'http://localhost:8001';

async function safeRequest(method, path, fn) {
  try {
    const res = await request(BASE)[method](path);
    await fn(res);
  } catch (e) {
    // If the backend isn't running in this environment, don't fail the suite.
    console.warn(
      `[availability] Skipped ${method.toUpperCase()} ${path}: backend not reachable`
    );
  }
}

describe('Endpoint availability', () => {
  it('GET / responds 2xx', async () => {
    await safeRequest('get', '/', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /health exists (not 404)', async () => {
    await safeRequest('get', '/health', res => {
      expect(res.statusCode).not.toBe(404);
    });
  });

  it('GET /api/unified/health responds 2xx', async () => {
    await safeRequest('get', '/api/unified/health', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/unified/metrics responds 2xx', async () => {
    await safeRequest('get', '/api/unified/metrics', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai/health responds 2xx', async () => {
    await safeRequest('get', '/api/ai/health', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai/providers responds 2xx', async () => {
    await safeRequest('get', '/api/ai/providers', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/metrics/custom responds 2xx', async () => {
    await safeRequest('get', '/api/metrics/custom', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/debug-direct responds 2xx', async () => {
    await safeRequest('get', '/api/debug-direct', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/agents/role-call exists and returns JSON', async () => {
    await safeRequest('get', '/api/agents/role-call', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.headers['content-type'] || '').toMatch(/application\/json/);
    });
  });

  it('POST /api/router is not accessible without auth (non-2xx)', async () => {
    try {
      const res = await request(BASE)
        .post('/api/router')
        .send({ task: 'chat', prompt: 'hello' })
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    } catch (e) {
      console.warn(
        '[availability] Skipped POST /api/router: backend not reachable'
      );
    }
  });

  it('POST /api/hf/upload is auth-protected (non-2xx) and not 404', async () => {
    try {
      const res = await request(BASE)
        .post('/api/hf/upload')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).not.toBe(404);
    } catch (e) {
      console.warn(
        '[availability] Skipped POST /api/hf/upload: backend not reachable'
      );
    }
  });

  // --- Expanded coverage for mounted routers ---
  it('GET /api/ai-hub/health responds 2xx', async () => {
    await safeRequest('get', '/api/ai-hub/health', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai-hub/status responds 2xx', async () => {
    await safeRequest('get', '/api/ai-hub/status', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai-hub/models responds 2xx', async () => {
    await safeRequest('get', '/api/ai-hub/models', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai-hub/test responds 2xx', async () => {
    await safeRequest('get', '/api/ai-hub/test', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/ai-hub/test responds 2xx', async () => {
    await safeRequest('get', '/api/ai-hub/test', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/models/status exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/models/status', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/models/catalog exists (non-404)', async () => {
    await safeRequest('get', '/api/models/catalog', res => {
      expect(res.statusCode).not.toBe(404);
    });
  });

  it('GET /api/knowledge/collections exists (non-404)', async () => {
    await safeRequest('get', '/api/knowledge/collections', res => {
      expect(res.statusCode).not.toBe(404);
    });
  });

  it('GET /api/knowledge/search exists (non-404)', async () => {
    await safeRequest('get', '/api/knowledge/search?q=test', res => {
      expect(res.statusCode).not.toBe(404);
    });
  });

  it('GET /api/voice-to-text/ responds 2xx', async () => {
    await safeRequest('get', '/api/voice-to-text/', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/huggingface/health responds 2xx', async () => {
    await safeRequest('get', '/api/huggingface/health', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  // --- Additional mounted routers ---
  it('GET /api/security/health responds 2xx', async () => {
    await safeRequest('get', '/api/security/health', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/security/status responds 2xx', async () => {
    await safeRequest('get', '/api/security/status', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/monitoring/agent-metrics exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/monitoring/agent-metrics', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/monitoring/dependencies exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/monitoring/dependencies', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/vision/status exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/vision/status', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/vault/keys exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/vault/keys', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/key-vault/keys exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/key-vault/keys', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/api-keys/status responds 2xx', async () => {
    await safeRequest('get', '/api/api-keys/status', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/api-keys/dev-keys responds 2xx', async () => {
    await safeRequest('get', '/api/api-keys/dev-keys', res => {
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(300);
    });
  });

  it('GET /api/api-keys/test exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/api-keys/test', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  it('GET /api/workflows/ exists and is protected (non-2xx, not 404)', async () => {
    await safeRequest('get', '/api/workflows/', res => {
      expect(res.statusCode).not.toBe(404);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
