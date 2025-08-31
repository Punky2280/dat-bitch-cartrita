import crypto from 'crypto';
import db from '../../db.js';

// Lightweight in-memory fallback for test mode
const MEMORY_MODE = process.env.LIGHTWEIGHT_TEST === '1';
const mem = MEMORY_MODE
  ? {
      providers: new Map(), // name -> {id,name}
      keys: new Map(), // composite userId|providerId -> record
      versions: new Map(), // keyId -> [versions]
      seq: 1,
      providerSeq: 1,
    }
  : null;

const ALGO = 'aes-256-gcm';
const MASTER_KEY = process.env.MASTER_KEY;
if (!MASTER_KEY || MASTER_KEY.length < 32) {
  console.warn(
    '[KeyVault] MASTER_KEY missing or too short; encryption weakened for dev.'
  );
}

function deriveKey() {
  return crypto
    .createHash('sha256')
    .update(MASTER_KEY || 'DEV_MASTER_KEY')
    .digest();
}

function encrypt(raw) {
  const iv = crypto.randomBytes(12);
  const key = deriveKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(ciphertext, ivB64, tagB64) {
  const key = deriveKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

async function logEvent(event_type, actor_user_id, metadata) {
  if (MEMORY_MODE) return; // keep silent in memory mode to reduce noise
  try {
    await db.query(
      'INSERT INTO event_log (event_type, actor_user_id, metadata) VALUES ($1,$2,$3)',
      [
        event_type,
        actor_user_id || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (e) {
    console.error('[KeyVault] Failed to log event', e.message);
  }
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

class KeyVaultService {
  // Create or upsert key
  async add({
    userId,
    serviceName,
    rawKey,
    scopes = [],
    purposeTags = [],
    description = null,
    expiresAt = null,
  }) {
    if (!rawKey) throw new Error('rawKey required');
    const provider = await this._ensureProvider(serviceName);
    const { ciphertext, iv, tag } = encrypt(rawKey);
    const keyHash = hashKey(rawKey);
    const checksum = keyHash.substring(0, 32);
    if (MEMORY_MODE) {
      const composite = `${userId}|${provider.id}`;
      const existing = mem.keys.get(composite);
      const id = existing?.id || mem.seq++;
      const now = new Date();
      const rec = {
        id,
        user_id: userId,
        provider_id: provider.id,
        encrypted_key: JSON.stringify({ c: ciphertext, t: tag }),
        iv,
        key_hash: keyHash,
        checksum,
        usage_count: existing ? existing.usage_count : 0,
        scopes,
        purpose_tags: purposeTags,
        is_active: true,
        created_at: existing?.created_at || now,
        updated_at: now,
        last_accessed_at: null,
        description,
        expires_at: expiresAt,
        soft_deleted_at: null,
      };
      mem.keys.set(composite, rec);
      return { id, serviceName, scopes, purposeTags };
    }
    const result = await db.query(
      `INSERT INTO user_api_keys (user_id, provider_id, encrypted_key, iv, key_hash, usage_count, scopes, purpose_tags, checksum, updated_at, description, expires_at)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,NOW(),$9,$10)
       ON CONFLICT (user_id, provider_id) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key, iv=EXCLUDED.iv, key_hash=EXCLUDED.key_hash, scopes=EXCLUDED.scopes, purpose_tags=EXCLUDED.purpose_tags, checksum=EXCLUDED.checksum, description=EXCLUDED.description, expires_at=EXCLUDED.expires_at, updated_at=NOW()
       RETURNING id`,
      [
        userId,
        provider.id,
        JSON.stringify({ c: ciphertext, t: tag }),
        iv,
        keyHash,
        scopes,
        purposeTags,
        checksum,
        description,
        expiresAt,
      ]
    );
    await logEvent('key.added', userId, {
      serviceName,
      keyId: result.rows[0].id,
    });
    return { id: result.rows[0].id, serviceName, scopes, purposeTags };
  }

  // Retrieve decrypted key (increments usage)
  async get(serviceName, userId) {
    const provider = await this._getProvider(serviceName);
    if (!provider) return null;
    if (MEMORY_MODE) {
      const rec = mem.keys.get(`${userId}|${provider.id}`);
      if (!rec || !rec.is_active || rec.soft_deleted_at) return null;
      rec.usage_count += 1;
      rec.last_accessed_at = new Date();
      const payload = JSON.parse(rec.encrypted_key);
      return decrypt(payload.c, rec.iv, payload.t);
    }
    const { rows } = await db.query(
      'SELECT id, encrypted_key, iv FROM user_api_keys WHERE user_id=$1 AND provider_id=$2 AND is_active IS NOT FALSE AND soft_deleted_at IS NULL LIMIT 1',
      [userId, provider.id]
    );
    if (!rows.length) return null;
    const rec = rows[0];
    const payload = JSON.parse(rec.encrypted_key);
    const raw = decrypt(payload.c, rec.iv, payload.t);
    await db.query(
      'UPDATE user_api_keys SET usage_count=usage_count+1, last_accessed_at=NOW() WHERE id=$1',
      [rec.id]
    );
    return raw;
  }

  // Metadata only (no raw key, no usage increment)
  async getMetadata(serviceName, userId) {
    const provider = await this._getProvider(serviceName);
    if (!provider) return null;
    if (MEMORY_MODE) {
      const rec = mem.keys.get(`${userId}|${provider.id}`);
      if (!rec) return null;
      const { encrypted_key, iv, key_hash, ...meta } = rec; // omit sensitive parts
      return meta;
    }
    const { rows } = await db.query(
      'SELECT id, usage_count, last_accessed_at, scopes, purpose_tags, is_active, created_at, updated_at, description, expires_at, soft_deleted_at FROM user_api_keys WHERE user_id=$1 AND provider_id=$2 LIMIT 1',
      [userId, provider.id]
    );
    return rows[0] || null;
  }

  async list(userId) {
    if (MEMORY_MODE) {
      const out = [];
      for (const rec of mem.keys.values()) {
        if (rec.user_id === userId)
          out.push({
            id: rec.id,
            service: [...mem.providers.values()].find(
              p => p.id === rec.provider_id
            )?.name,
            usage_count: rec.usage_count,
            last_accessed_at: rec.last_accessed_at,
            scopes: rec.scopes,
            purpose_tags: rec.purpose_tags,
            is_active: rec.is_active,
            created_at: rec.created_at,
            updated_at: rec.updated_at,
            masked: true,
          });
      }
      return out;
    }
    const { rows } = await db.query(
      `SELECT k.id, p.name as service, k.usage_count, k.last_accessed_at, k.scopes, k.purpose_tags, k.is_active, k.created_at, k.updated_at
                                     FROM user_api_keys k JOIN api_providers p ON k.provider_id=p.id WHERE k.user_id=$1`,
      [userId]
    );
    return rows.map(r => ({ ...r, masked: true }));
  }

  async rotate({
    userId,
    serviceName,
    newRawKey,
    reason = null,
    preserve_old = true,
  }) {
    const provider = await this._ensureProvider(serviceName);
    const { ciphertext, iv, tag } = encrypt(newRawKey);
    const keyHash = hashKey(newRawKey);
    const checksum = keyHash.substring(0, 32);
    if (MEMORY_MODE) {
      const composite = `${userId}|${provider.id}`;
      const existing = mem.keys.get(composite);
      if (!existing) throw new Error('Key not found');
      if (preserve_old) {
        const arr = mem.versions.get(existing.id) || [];
        arr.push({
          version: arr.length + 1,
          encrypted_key: existing.encrypted_key,
          iv: existing.iv,
          key_hash: existing.key_hash,
          checksum: existing.checksum,
          created_at: new Date(),
        });
        mem.versions.set(existing.id, arr);
      }
      existing.encrypted_key = JSON.stringify({ c: ciphertext, t: tag });
      existing.iv = iv;
      existing.key_hash = keyHash;
      existing.checksum = checksum;
      existing.usage_count = 0;
      existing.updated_at = new Date();
      existing.last_accessed_at = null;
      return { rotated: true };
    }
    // Archive old version
    if (preserve_old) {
      await db.query(
        `INSERT INTO user_api_key_versions (user_api_key_id, version_number, encrypted_key, iv, key_hash, checksum, created_at)
                      SELECT id, (SELECT COALESCE(MAX(version_number),0)+1 FROM user_api_key_versions v WHERE v.user_api_key_id = k.id), encrypted_key, iv, key_hash, checksum, NOW()
                      FROM user_api_keys k WHERE user_id=$1 AND provider_id=$2`,
        [userId, provider.id]
      );
    }
    const { rows } = await db.query(
      'UPDATE user_api_keys SET encrypted_key=$1, iv=$2, key_hash=$3, checksum=$4, usage_count=0, updated_at=NOW(), last_accessed_at=NULL WHERE user_id=$5 AND provider_id=$6 RETURNING id',
      [
        JSON.stringify({ c: ciphertext, t: tag }),
        iv,
        keyHash,
        checksum,
        userId,
        provider.id,
      ]
    );
    await logEvent('key.rotated', userId, {
      serviceName,
      keyId: rows[0]?.id,
      reason,
    });
    return { rotated: !!rows.length };
  }

  async listVersions(serviceName, userId) {
    const provider = await this._getProvider(serviceName);
    if (!provider) return [];
    if (MEMORY_MODE) {
      const rec = mem.keys.get(`${userId}|${provider.id}`);
      if (!rec) return [];
      return (mem.versions.get(rec.id) || []).map(v => ({
        version: v.version,
        created_at: v.created_at,
      }));
    }
    const { rows } = await db.query(
      `SELECT version_number as version, created_at FROM user_api_key_versions v JOIN user_api_keys k ON v.user_api_key_id=k.id WHERE k.user_id=$1 AND k.provider_id=$2 ORDER BY version_number DESC LIMIT 20`,
      [userId, provider.id]
    );
    return rows;
  }

  async remove({ userId, serviceName }) {
    // soft delete
    const provider = await this._getProvider(serviceName);
    if (!provider) return { removed: false };
    if (MEMORY_MODE) {
      const rec = mem.keys.get(`${userId}|${provider.id}`);
      if (!rec) return { removed: false };
      rec.soft_deleted_at = new Date();
      rec.is_active = false;
      return { removed: true };
    }
    const { rows } = await db.query(
      'UPDATE user_api_keys SET is_active=FALSE, soft_deleted_at=NOW() WHERE user_id=$1 AND provider_id=$2 AND soft_deleted_at IS NULL RETURNING id',
      [userId, provider.id]
    );
    if (rows.length)
      await logEvent('key.deleted', userId, { serviceName, keyId: rows[0].id });
    return { removed: !!rows.length };
  }

  async restore({ userId, serviceName }) {
    const provider = await this._getProvider(serviceName);
    if (!provider) return { restored: false };
    if (MEMORY_MODE) {
      const rec = mem.keys.get(`${userId}|${provider.id}`);
      if (!rec || !rec.soft_deleted_at) return { restored: false };
      rec.soft_deleted_at = null;
      rec.is_active = true;
      return { restored: true };
    }
    const { rows } = await db.query(
      'UPDATE user_api_keys SET is_active=TRUE, soft_deleted_at=NULL WHERE user_id=$1 AND provider_id=$2 AND soft_deleted_at IS NOT NULL RETURNING id',
      [userId, provider.id]
    );
    return { restored: !!rows.length };
  }

  async validateCandidate({ userId, serviceName, candidate }) {
    if (!candidate) throw new Error('candidate required');
    // Placeholder: basic length check; can plug provider-specific validation later
    const valid = candidate.length > 10;
    await logEvent('key.validated', userId, { serviceName, valid });
    return { valid, hashPreview: hashKey(candidate).slice(0, 8) };
  }

  async usageAnalytics(userId) {
    if (MEMORY_MODE) {
      const out = [];
      for (const rec of mem.keys.values()) {
        if (rec.user_id === userId)
          out.push({
            service: [...mem.providers.values()].find(
              p => p.id === rec.provider_id
            )?.name,
            usage_count: rec.usage_count,
            last_accessed_at: rec.last_accessed_at,
          });
      }
      return out;
    }
    const { rows } = await db.query(
      'SELECT p.name as service, usage_count, last_accessed_at FROM user_api_keys k JOIN api_providers p ON k.provider_id=p.id WHERE user_id=$1',
      [userId]
    );
    return rows;
  }

  async _ensureProvider(name) {
    const existing = await this._getProvider(name);
    if (existing) return existing;
    if (MEMORY_MODE) {
      const rec = { id: mem.providerSeq++, name };
      mem.providers.set(name, rec);
      return rec;
    }
    const { rows } = await db.query(
      'INSERT INTO api_providers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id,name',
      [name]
    );
    return rows[0];
  }

  async _getProvider(name) {
    if (MEMORY_MODE) return mem.providers.get(name);
    const { rows } = await db.query(
      'SELECT id,name FROM api_providers WHERE name=$1',
      [name]
    );
    return rows[0];
  }
}

export default new KeyVaultService();
