let request;
import app from '../../src/server.js';
beforeAll(async () => {
  const mod = await import('supertest');
  request = mod.default;
});
describe('Registry search endpoint (HTTP)', () => {
  test('400 without q', async () => {
    const res = await request(app).get('/api/internal/registry/search');
    expect(res.status).toBe(400);
  });
  test('returns results with query date', async () => {
    const res = await request(app).get('/api/internal/registry/search?q=date');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
