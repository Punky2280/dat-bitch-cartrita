#!/usr/bin/env node
/*
 * Conditional build for HuggingFace router service.
 * Skips compilation if:
 *  - SKIP_ROUTER_BUILD=1
 *  - Existing dist/router/HuggingFaceRouterService.js is newer than source .ts
 * Otherwise runs: tsc -p tsconfig.router.json
 */
import { statSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const root = process.cwd();
const distFile = path.join(
  root,
  'dist',
  'router',
  'HuggingFaceRouterService.js'
);
const srcFile = path.join(
  root,
  'src',
  'modelRouting',
  'HuggingFaceRouterService.ts'
);

function log(msg) {
  console.log(`[buildRouter] ${msg}`);
}

if (process.env.SKIP_ROUTER_BUILD === '1') {
  log('Skipping router build due to SKIP_ROUTER_BUILD=1');
  process.exit(0);
}

if (!existsSync(srcFile)) {
  log('Source TS file missing; nothing to build.');
  process.exit(0);
}

if (existsSync(distFile)) {
  try {
    const distStat = statSync(distFile);
    const srcStat = statSync(srcFile);
    if (distStat.mtimeMs >= srcStat.mtimeMs) {
      log('Prebuilt router JS is up-to-date; skipping TypeScript compile.');
      process.exit(0);
    }
  } catch (e) {
    // fall through to build
  }
}

try {
  log('Compiling router TypeScript...');
  execSync('npx tsc -p tsconfig.router.json', { stdio: 'inherit' });
  log('Router build complete.');
} catch (e) {
  console.error('[buildRouter] Router build failed:', e.message);
  process.exit(1);
}
