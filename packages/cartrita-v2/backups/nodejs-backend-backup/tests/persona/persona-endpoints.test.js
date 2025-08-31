import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let server;

beforeAll(async () => {
  process.env.LIGHTWEIGHT_TEST = '1';
  const mod = await import('../../index.js');
  server = mod.default || mod.app || mod.server;
});

const authHeader = { Authorization: 'Bearer test-admin-token' };

describe('Persona API', () => {
  it('GET returns persona with interaction_modes', async () => {
    const res = await request(server).get('/api/persona').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.persona).toBeDefined();
    expect(res.body.persona.interaction_modes).toBeDefined();
    expect(
      Object.values(res.body.persona.interaction_modes).some(Boolean)
    ).toBe(true);
  });

  it('PUT clamps trait values and enforces interaction mode selection', async () => {
    const update = await request(server)
      .put('/api/persona')
      .set(authHeader)
      .send({
        tone: 12, // should clamp to 10
        creativity: -4, // should clamp to 0
        interaction_modes: {
          empathetic: false,
          witty: false,
          direct: true,
          analytical: false,
        },
      });
    expect(update.status).toBe(200);
    expect(update.body.success).toBe(true);
    expect(update.body.persona.tone).toBeLessThanOrEqual(10);
    expect(update.body.persona.creativity).toBeGreaterThanOrEqual(0);
    expect(
      Object.values(update.body.persona.interaction_modes).some(Boolean)
    ).toBe(true);
    expect(update.body.persona.interaction_modes.direct).toBe(true);
  });
});
