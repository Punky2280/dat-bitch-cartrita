import request from 'supertest';
import express from 'express';
import { beforeAll, afterAll, describe, test, expect, vi } from 'vitest';

// In-memory store
const memory = { api_providers: [], user_api_keys: [], seq: 1, events: [] };

// Mock authenticateToken to bypass real auth
vi.mock('../src/middleware/authenticateToken.js', () => ({
  default: (req, _res, next) => {
    req.user = { id: 1 };
    next();
  },
}));

// Mock DB pool used by router
vi.mock('../src/db.js', () => ({
  default: {
    async query(sql, params) {
      sql = sql.trim();
      if (
        sql.startsWith('SELECT id, name, display_name') &&
        sql.includes('FROM api_providers')
      ) {
        return { rows: memory.api_providers.filter(p => p.is_active) };
      }
      if (sql.startsWith('SELECT validation_pattern FROM api_providers')) {
        const id = params[0];
        const p = memory.api_providers.find(p => p.id === id && p.is_active);
        return {
          rows: p ? [{ validation_pattern: p.validation_pattern }] : [],
        };
      }
      // Specific validation fetch (must precede generic user_api_keys SELECT)
      if (sql.startsWith('SELECT uak.key_data, ap.name as provider_name')) {
        const [id, user] = params;
        const k = memory.user_api_keys.find(
          r => r.id == id && r.user_id == user
        );
        if (!k) return { rows: [] };
        return { rows: [{ key_data: k.key_data, provider_name: 'openai' }] };
      }
      if (sql.startsWith('INSERT INTO user_api_keys')) {
        const id = memory.seq++;
        const [
          user_id,
          provider_id,
          key_name,
          key_data,
          ,
          rotation_interval_days,
          next_rotation_at,
          rotation_policy,
          visibility,
          category,
          checksum,
          metadata,
        ] = params;
        let existing = memory.user_api_keys.find(
          k =>
            k.user_id === user_id &&
            k.provider_id === provider_id &&
            k.key_name === key_name
        );
        if (existing) {
          Object.assign(existing, {
            key_data,
            rotation_interval_days,
            next_rotation_at,
            rotation_policy,
            visibility,
            category,
            checksum,
            metadata,
            updated_at: new Date(),
          });
          return {
            rows: [
              {
                id: existing.id,
                key_name: existing.key_name,
                created_at: existing.created_at,
                updated_at: existing.updated_at,
                checksum: existing.checksum,
              },
            ],
          };
        }
        const row = {
          id,
          user_id,
          provider_id,
          key_name,
          key_data,
          rotation_interval_days,
          next_rotation_at,
          rotation_policy,
          visibility,
          category,
          checksum,
          metadata,
          created_at: new Date(),
          updated_at: new Date(),
        };
        memory.user_api_keys.push(row);
        return {
          rows: [
            {
              id,
              key_name,
              created_at: row.created_at,
              updated_at: row.updated_at,
              checksum,
            },
          ],
        };
      }
      if (
        sql.startsWith('SELECT') &&
        sql.includes('FROM user_api_keys') &&
        sql.includes('JOIN api_providers')
      ) {
        // Provide subset of fields expected by route
        return {
          rows: memory.user_api_keys.map(k => ({
            id: k.id,
            key_name: k.key_name,
            rotation_interval_days: k.rotation_interval_days,
            checksum: k.checksum,
            updated_at: k.updated_at,
            created_at: k.created_at,
            expires_at: null,
            provider_id: k.provider_id,
            provider_name: 'openai',
            visibility: k.visibility || 'MASKED',
            category: k.category,
            metadata: k.metadata,
          })),
        };
      }
      if (sql.startsWith('INSERT INTO api_security_events')) {
        memory.events.push({ params });
        return { rows: [] };
      }
      return { rows: [] };
    },
  },
}));

// Mock encryption service
vi.mock('../src/system/SecureEncryptionService.js', () => ({
  default: {
    encrypt: v => `enc:${v}`,
    decrypt: v => v.replace(/^enc:/, ''),
    createHash: v => 'hash-' + v.slice(0, 8),
  },
}));

// Dynamic import after mocks
const vaultRouter = (await import('../src/routes/vault.js')).default;

// Patch auth middleware by monkey-patching require cache (simplest since ESM dynamic import isn't mocked here)
// We wrap router after setting a fake user via global middleware.
const app = express();
app.use(express.json());
app.use('/vault', vaultRouter);

// Encryption service fully mocked via vi.mock above; no overrides needed here.

async function seed() {
  if (!memory.api_providers.find(p => p.id === 1))
    memory.api_providers.push({
      id: 1,
      name: 'openai',
      display_name: 'OpenAI',
      validation_pattern: 'sk-[A-Za-z0-9]{10,}',
      is_active: true,
    });
}

beforeAll(async () => {
  await seed();
}, 30000);
afterAll(async () => {
  /* no real pool */
});

describe('Vault Routes', () => {
  let createdId;

  test('create key', async () => {
    const res = await request(app)
      .post('/vault/keys')
      .send({
        provider_id: 1,
        key_name: 'primary',
        key_value: 'sk-ABCDEFGHIJKL',
      });
    if (!res.body.success)
      console.error('Create key response', res.status, res.body);
    expect(res.body.success).toBe(true);
    expect(res.body.key.checksum).toMatch(/^hash-/);
    createdId = res.body.key.id;
  });

  test('list keys includes new fields', async () => {
    const res = await request(app).get('/vault/keys');
    if (!res.body.success)
      console.error('List keys response', res.status, res.body);
    expect(res.body.success).toBe(true);
    expect(res.body.keys.length).toBeGreaterThan(0);
    const key = res.body.keys[0];
    expect(key).toHaveProperty('checksum');
    expect(key).toHaveProperty('rotation_interval_days');
  });

  test('validate key (openai http_check mocked)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    // If test filtered and create step not executed, seed a key now
    if (!createdId) {
      const createRes = await request(app)
        .post('/vault/keys')
        .send({
          provider_id: 1,
          key_name: 'validation-temp',
          key_value: 'sk-VALIDATEKEYABC',
        });
      expect(createRes.body.success).toBe(true);
      createdId = createRes.body.key.id;
    }
    const res = await request(app).post(`/vault/keys/${createdId}/validate`);
    if (!res.body.success)
      console.error('Validate key response', res.status, res.body);
    expect(res.body.success).toBe(true);
    expect(res.body.validation.valid).toBe(true);
    expect(res.body.validation.method).toBe('http_check');
  });
});
