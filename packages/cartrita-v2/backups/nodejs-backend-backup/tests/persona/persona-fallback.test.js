import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Force lightweight & test conditions
process.env.LIGHTWEIGHT_TEST = '1';
process.env.NODE_ENV = 'test';

let app;

// We will mock db.query to throw to simulate DB inaccessible
vi.mock('../../src/db.js', () => {
  return {
    default: {
      query: () => {
        throw new Error('DB offline');
      },
    },
  };
});

describe('Persona API fallback (DB offline)', () => {
  beforeAll(async () => {
    const mod = await import('../../index.js');
    app = mod.app || mod.default;
  });

  it('returns default persona when DB throws (GET)', async () => {
    const res = await request(app)
      .get('/api/persona')
      .set({ Authorization: 'Bearer test-admin-token' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.persona).toBeDefined();
    expect(res.body.persona.tone).toBe(5); // default
    // At least one interaction mode true (witty or empathetic by default)
    expect(
      Object.values(res.body.persona.interaction_modes).some(Boolean)
    ).toBe(true);
  });

  it('normalizes & returns persona on PUT even if DB offline', async () => {
    const res = await request(app)
      .put('/api/persona')
      .set({ Authorization: 'Bearer test-admin-token' })
      .send({ tone: 20, creativity: -3, interaction_modes: { direct: true } });
    expect(res.status).toBe(200);
    expect(res.body.persona.tone).toBeLessThanOrEqual(10);
    expect(res.body.persona.creativity).toBeGreaterThanOrEqual(0);
    expect(
      Object.values(res.body.persona.interaction_modes).some(Boolean)
    ).toBe(true);
    expect(res.body.persona.interaction_modes.direct).toBe(true);
  });
});
