#!/usr/bin/env node
import fs from 'fs';
import { spawnSync } from 'child_process';

if (process.env.SKIP_PRECOMMIT_SECURITY === '1') {
  console.log('[precommit-secret-check] Skipped via SKIP_PRECOMMIT_SECURITY=1');
  process.exit(0);
}

// Run scan script capturing output
const scan = spawnSync('node',['scripts/security/scan-api-keys.mjs'], { encoding: 'utf8' });
if (scan.error) {
  console.error('Secret scan failed to execute:', scan.error.message);
  process.exit(2);
}

// Load produced inventory
const inventoryPath = 'key-inventory.json';
if (!fs.existsSync(inventoryPath)) {
  console.error('key-inventory.json not produced by scan; aborting commit.');
  process.exit(3);
}
const data = JSON.parse(fs.readFileSync(inventoryPath,'utf8'));

// Simple heuristic: fail if any detector includes 'raw_env_inline' or if any sample contains an obvious placeholderless key pattern not previously baseline hashed.
// For now, we just cap by allowing up to 5 new unique hashes per commit unless override provided.
const limit = parseInt(process.env.SECRET_NEW_HASH_LIMIT || '5',10);
const findings = data.items || [];

// Track previously known baseline if present
let prevHashes = new Set();
if (fs.existsSync('key-inventory.prev.json')) {
  try {
    const prev = JSON.parse(fs.readFileSync('key-inventory.prev.json','utf8'));
    (prev.items||[]).forEach(i => prevHashes.add(i.hash));
  } catch {}
}

const newOnes = findings.filter(i => !prevHashes.has(i.hash));
if (newOnes.length > limit) {
  console.error(`Secret scan: ${newOnes.length} new potential secrets exceed limit (${limit}).`);
  newOnes.slice(0,10).forEach(i => console.error('  hash:', i.hash, 'detectors:', i.detectors.join(',')));
  console.error('If intentional, increase limit with SECRET_NEW_HASH_LIMIT or update baseline: UPDATE_KEY_SNAPSHOT=1 node scripts/security/rotate-keys.mjs');
  process.exit(4);
}

console.log(`[precommit-secret-check] OK: ${findings.length} findings, ${newOnes.length} new (limit ${limit}).`);
