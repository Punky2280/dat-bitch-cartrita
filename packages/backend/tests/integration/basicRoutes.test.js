let request;import app from '../../src/server.js';beforeAll(async()=>{const mod=await import('supertest');request=mod.default;});
describe('Basic route smoke tests',()=>{test('GET /health returns ok',async()=>{const res=await request(app).get('/health');expect(res.status).toBe(200);expect(res.body.status).toBe('ok');});});
