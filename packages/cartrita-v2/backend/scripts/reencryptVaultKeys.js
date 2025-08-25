#!/usr/bin/env node
/*
 * Vault Re-encryption Utility
 * Usage:
 *   OLD_ENCRYPTION_MASTER_KEY=oldpass NEW_ENCRYPTION_MASTER_KEY=newpass node packages/backend/scripts/reencryptVaultKeys.js
 *
 * Safeguards:
 * - Creates JSON backup of user_api_keys before modification (./vault-backup-<timestamp>.json)
 * - Runs in a single transaction; rollback on any failure
 * - Verifies decrypt+reencrypt integrity via checksum comparison
 */
import fs from 'fs';
import crypto from 'crypto';
import pool from '../src/db.js';

const SALT = 'cartrita-vault-salt-2025';
const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits
const ALGO = 'aes-256-gcm';

function deriveKey(passphrase) {
  return crypto.pbkdf2Sync(passphrase, SALT, ITERATIONS, KEY_LEN, 'sha256');
}

function decryptBlob(masterKey, blob) {
  const parts = blob.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const [ivHex, tagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, masterKey, iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptBlob(masterKey, plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, masterKey, iv, {
    authTagLength: 16,
  });
  let enc = cipher.update(plaintext, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;
}

function checksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function main() {
  const oldPass = process.env.OLD_ENCRYPTION_MASTER_KEY;
  const newPass = process.env.NEW_ENCRYPTION_MASTER_KEY;
  if (!oldPass || !newPass) {
    console.error(
      '❌ Set OLD_ENCRYPTION_MASTER_KEY and NEW_ENCRYPTION_MASTER_KEY'
    );
    process.exit(1);
  }
  if (oldPass === newPass) {
    console.error('❌ Old and new master keys are identical');
    process.exit(1);
  }
  const oldKey = deriveKey(oldPass);
  const newKey = deriveKey(newPass);

  const client = await pool.connect();
  try {
    console.log('🔐 Fetching vault entries...');
    const { rows } = await client.query(
      'SELECT id, key_data, checksum FROM user_api_keys WHERE key_data IS NOT NULL'
    );
    console.log(`ℹ️  ${rows.length} encrypted entries found`);
    const backupName = `vault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(backupName, JSON.stringify(rows, null, 2));
    console.log(`💾 Backup written: ${backupName}`);

    await client.query('BEGIN');
    for (const row of rows) {
      let plaintext;
      try {
        plaintext = decryptBlob(oldKey, row.key_data);
      } catch (e) {
        console.error(`Row ${row.id} decrypt failed; aborting.`, e.message);
        throw e;
      }
      const newEncrypted = encryptBlob(newKey, plaintext);
      // Optional integrity check: decrypt again with new key and compare checksum
      const verifyPlain = decryptBlob(newKey, newEncrypted);
      if (verifyPlain !== plaintext) {
        throw new Error(`Integrity mismatch for row ${row.id}`);
      }
      const newChecksum = checksum(plaintext);
      if (newChecksum !== row.checksum) {
        console.warn(
          `Checksum mismatch for row ${row.id} (original stored ${row.checksum} vs recomputed ${newChecksum}) - updating to recomputed.`
        );
      }
      await client.query(
        'UPDATE user_api_keys SET key_data=$1, checksum=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3',
        [newEncrypted, newChecksum, row.id]
      );
    }
    await client.query('COMMIT');
    console.log('✅ Re-encryption completed successfully.');
    console.log(
      '⚠️  Update environment: set ENCRYPTION_MASTER_KEY to NEW value and restart services.'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Re-encryption failed; transaction rolled back.', err);
    console.error('Restore from backup file if needed.');
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
