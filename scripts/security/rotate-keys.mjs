#!/usr/bin/env node
/*
 * rotate-keys.mjs
 * Skeleton workflow helper: compares current scan (scan-api-keys.mjs) with previous snapshot
 * to identify added/removed hashed secrets. DOES NOT rotate automatically—prints guidance.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

const SNAPSHOT = 'key-inventory.json';
const PREV = 'key-inventory.prev.json';

function load(path){
  if (!fs.existsSync(path)) return null;
  try { return JSON.parse(fs.readFileSync(path,'utf8')); } catch { return null; }
}

// Run fresh scan
spawnSync('node',['scripts/security/scan-api-keys.mjs'], { stdio: 'pipe' });
// scan prints to stdout; we need the generated file, so ensure npm script or manual run captured earlier.
// If key-inventory.json not present, advise user.

if (!fs.existsSync(SNAPSHOT)) {
  console.error('No key-inventory.json found. Run: npm run scan:keys');
  process.exit(1);
}

const current = load(SNAPSHOT) || { items: [] };
const previous = load(PREV) || { items: [] };

const prevMap = new Map(previous.items.map(i => [i.hash, i]));
const currMap = new Map(current.items.map(i => [i.hash, i]));

const added = []; const removed = []; const stable = [];
for (const [hash, item] of currMap.entries()) {
  if (!prevMap.has(hash)) added.push(item); else stable.push(item);
}
for (const [hash, item] of prevMap.entries()) {
  if (!currMap.has(hash)) removed.push(item);
}

const report = {
  generated_at: new Date().toISOString(),
  added: added.map(a => ({ hash: a.hash, detectors: a.detectors })),
  removed: removed.map(r => ({ hash: r.hash, detectors: r.detectors })),
  stable: stable.length,
  guidance: 'Rotate newly added real secrets if they replaced compromised ones. Remove unused secrets from vault. Store this snapshot as key-inventory.prev.json for next diff.'
};

console.log(JSON.stringify(report,null,2));

// Offer to update baseline
if (process.env.UPDATE_KEY_SNAPSHOT === '1') {
  fs.copyFileSync(SNAPSHOT, PREV);
  console.log('Baseline updated -> key-inventory.prev.json');
}
