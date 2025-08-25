#!/usr/bin/env node
/**
 * Scan repository for hardcoded hex colors (excluding theme token files) to aid migration
 * to design tokens. Outputs a report with file, line, and color.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = process.cwd();
const exts = ['.tsx', '.ts', '.jsx', '.js', '.css'];
const colorRegex = /#[0-9a-fA-F]{3,8}\b/g;
const ignorePaths = ['node_modules', 'dist', 'build', 'coverage', 'packages/frontend/src/theme'];

function walk(dir, out=[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignorePaths.some(p=> dir.includes(p))) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (exts.some(e=> entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const results = [];
for (const file of walk(repoRoot)) {
  const rel = file.replace(repoRoot + '/', '');
  if (ignorePaths.some(p => rel.startsWith(p))) continue;
  const content = readFileSync(file, 'utf8');
  let m;
  const lines = content.split(/\n/);
  lines.forEach((line, idx) => {
    while ((m = colorRegex.exec(line)) !== null) {
      const color = m[0];
      // Skip if appears to be a CSS variable reference or part of a URL/hash (#/path)
      if (color.length < 4) continue;
      results.push({ file: rel, line: idx + 1, color });
    }
  });
}

const grouped = results.reduce((acc, r) => { (acc[r.color] = acc[r.color] || []).push(r); return acc; }, {});
const summary = Object.entries(grouped).sort((a,b)=> b[1].length - a[1].length);

console.log('Hardcoded Color Scan Report');
console.log('============================');
console.log(`Total occurrences: ${results.length}`);
console.log('Unique colors:', summary.length); 
console.log();
for (const [color, occ] of summary) {
  console.log(color, '->', occ.length, 'uses');
  occ.slice(0,10).forEach(o => console.log('  ', o.file + ':' + o.line));
  if (occ.length > 10) console.log('   ...');
}

if (results.length === 0) {
  console.log('✅ No hardcoded colors found.');
} else {
  console.log('\nSuggestion: Replace with design tokens from src/theme/tokens.ts');
}
