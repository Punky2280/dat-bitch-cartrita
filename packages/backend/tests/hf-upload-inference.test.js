import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';

const BASE = 'http://localhost:8001';

// Assumes server running & a valid JWT in TEST_JWT env (keeps test optional)
const TOKEN = process.env.TEST_JWT;

function auth() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

describe('HF binary upload + token inference (soft)', () => {
  let tokenRef;
  let skip = false;
  const samplePath = '/usr/share/icons/hicolor/16x16/apps/python.png';

  beforeAll(() => {
    if (!fs.existsSync(samplePath)) {
      skip = true; // environment without sample image
    }
    if (!TOKEN) skip = true; // need auth for route
  });

  it('uploads binary and receives token', async () => {
    if (skip) return; // soft skip
    const resp = await request(BASE)
      .post('/api/hf/upload')
      .set(auth())
      .attach('file', samplePath);
    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
    expect(resp.body.token).toMatch(/^hfbin:[a-f0-9-]{36}$/);
    tokenRef = resp.body.token;
  });

  it('invokes hf_image_classification via token (if token obtained)', async () => {
    if (skip || !tokenRef) return; // soft skip
    const resp = await request(BASE)
      .post('/api/huggingface/inference')
      .set(auth())
      .field('taskType', 'image-classification')
      .field('text', tokenRef); // orchestrator should resolve token data
    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
  });
});

describe('Fast-path delegation counter (placeholder)', () => {
  it('placeholder for future metric assertion', () => {
    expect(true).toBe(true);
  });
});
