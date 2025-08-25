#!/usr/bin/env node
import fs from 'fs';
import glob from 'glob';

const disallowedHex = /#[0-9a-fA-F]{3,8}\b/g;
const allowlist = ['packages/frontend/src/theme/tokens.ts'];

const files = glob.sync('packages/frontend/src/**/*.{tsx,ts,css,scss}', { nodir: true });
let violations = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  if (disallowedHex.test(txt) && !allowlist.some((p) => f.endsWith(p))) {
    violations.push(f);
  }
}
if (violations.length) {
  console.error('Found hardcoded colors (outside tokens):');
  for (const v of violations) console.error(' -', v);
  process.exit(1);
}
console.log('Theme consistency check passed.');
