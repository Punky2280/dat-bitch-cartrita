import request from 'supertest';
import express from 'express';

// Mock OpenTelemetryTracing to avoid importing heavy OTEL deps during tests
jest.mock('../../src/system/OpenTelemetryTracing.js', () => ({
  __esModule: true,
  default: {
    traceOperation: async (_name, _attrs, fn) => await fn(),
  },
}));

// In-memory Express app mounting the router; no live backend required.
const app = express();
app.use(express.json());
let initialized = false;
beforeAll(async () => {
  if (!initialized) {
    const mod = await import('../../src/routes/router.js');
    app.use('/api/router', mod.default);
    initialized = true;
  }
});

const AUTH = { Authorization: 'Bearer test-user-token' };

describe('Cartrita Router - Knowledge search & RAG (LIGHTWEIGHT_TEST)', () => {
  test('search returns stubbed results with threshold and documentIds echoed', async () => {
    const resp = await request(app)
      .post('/api/router')
      .set(AUTH)
      .send({
        task: 'search',
        query: 'vector databases overview',
        options: { limit: 1, threshold: 0.66, documentIds: [101, 202] },
      });

    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
    expect(resp.body.task).toBe('search');
    expect(resp.body.provider).toBe('knowledge');
    const result = resp.body.result;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results?.length).toBeGreaterThan(0);
    const meta = result.results[0]?.document_metadata;
    expect(meta?.stub).toBe(true);
    expect(meta?.documentIds).toEqual([101, 202]);
  });

  test('rag returns stubbed response with references (LIGHTWEIGHT_TEST)', async () => {
    const resp = await request(app)
      .post('/api/router')
      .set(AUTH)
      .send({
        task: 'rag',
        query: 'How do we chunk documents? ',
        options: { includeReferences: true, model: 'test-model' },
      });

    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
    expect(resp.body.task).toBe('rag');
    expect(resp.body.provider).toBe('knowledge');
    const result = resp.body.result;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.response).toMatch(/Stub RAG answer/i);
    expect(Array.isArray(result.references)).toBe(true);
  });
});
