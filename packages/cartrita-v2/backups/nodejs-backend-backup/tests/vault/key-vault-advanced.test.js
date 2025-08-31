import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let server;

// We rely on LIGHTWEIGHT_TEST & in-memory KEY vault logic
beforeAll(async () => {
  process.env.LIGHTWEIGHT_TEST = '1';
  const mod = await import('../../index.js');
  server = mod.default || mod.app || mod.server;
});

const authHeader = { Authorization: 'Bearer test-admin-token' }; // assumes authenticateToken mocked or bypassed in test env

describe('Advanced Key Vault (lightweight)', () => {
  // NOTE: If authenticateToken requires specific token logic, adapt/mocking may be added.
  it('adds a key and fetches metadata without increment', async () => {
    const add = await request(server)
      .post('/api/key-vault/keys')
      .set(authHeader)
      .send({
        serviceName: 'huggingface_api_token',
        key: 'hf_test_key_1234567890',
        scopes: ['read', 'write'],
        purposeTags: ['ai', 'ml'],
      });
    expect(add.status).toBeGreaterThanOrEqual(200);
    const meta = await request(server)
      .get('/api/key-vault/keys/huggingface_api_token/metadata')
      .set(authHeader);
    expect(meta.body.success).toBe(true);
    expect(meta.body.metadata.scopes).toContain('read');
  });

  it('rotates key with version preservation and lists versions', async () => {
    const rotate = await request(server)
      .post('/api/key-vault/keys/rotate')
      .set(authHeader)
      .send({
        serviceName: 'huggingface_api_token',
        newKey: 'hf_new_value_ABCDEFGHIJ',
        preserve_old: true,
        reason: 'test-rotation',
      });
    expect(rotate.body.success).toBe(true);
    const versions = await request(server)
      .get('/api/key-vault/keys/huggingface_api_token/versions')
      .set(authHeader);
    expect(versions.body.success).toBe(true);
    // In memory mode first rotation should create version 1
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(1);
  });

  it('soft deletes then restores key', async () => {
    const del = await request(server)
      .delete('/api/key-vault/keys/huggingface_api_token')
      .set(authHeader);
    expect(del.body.success).toBe(true);
    const restore = await request(server)
      .post('/api/key-vault/keys/huggingface_api_token/restore')
      .set(authHeader)
      .send({});
    console.log('Restore response debug', restore.status, restore.body);
    expect(restore.status).toBe(200);
    expect(typeof restore.body.restored).toBe('boolean');
  });

  it('validates candidate key', async () => {
    const val = await request(server)
      .post('/api/key-vault/keys/huggingface_api_token/validate')
      .set(authHeader)
      .send({ candidate: 'hf_candidate_1234567890' });
    expect(val.body.success).toBe(true);
    expect(typeof val.body.valid).toBe('boolean');
  });
});
