import http from 'node:http';
import app from '../../src/server.js';

// Using existing registry status route for a simple HTTP smoke test

describe.skip('HTTP route smoke (temporarily skipped)', () => {
  test('GET /api/internal/registry/status returns shape', async () => {
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/internal/registry/status`;
  console.log('[test] fetching', url);
  const res = await fetch(url).catch(e => ({ status: 0, _err: e }));
  if (res._err) throw new Error('fetch failed: ' + res._err.message);
  const body = await res.json().catch(e => { throw new Error('json parse failed: '+e.message); });
    server.close();
    expect(res.status).toBe(200);
    expect(typeof body).toBe('object');
    expect(body.success).toBeDefined();
  });
});
