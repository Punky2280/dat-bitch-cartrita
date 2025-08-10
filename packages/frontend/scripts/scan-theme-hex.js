#!/usr/bin/env node
/**
 * Scan for raw hex color usage outside allowed token files.
 * Fails (exit 1) if unauthorized hex codes are found.
 */
import { readFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

// Allowlist: tokens.ts and index.css (root CSS variables) may contain raw hex.
const ALLOWED_FILES = new Set([
  'src/theme/tokens.ts',
  'src/index.css',
  'src/context/ThemeContext.tsx'
]);

const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;

function main(){
  const projectRoot = process.cwd();
  const pattern = 'src/**/*.{ts,tsx,css}';
  const files = glob.sync(pattern, { cwd: projectRoot, nodir: true });
  const violations = [];
  for (const file of files){
    if (ALLOWED_FILES.has(file)) continue;
    const full = path.join(projectRoot, file);
    const text = readFileSync(full, 'utf8');
    const matches = text.match(HEX_REGEX);
    if (matches){
      // Ignore cases where imported from tokens (heuristic) - keep simple: any match triggers violation.
      violations.push({ file, matches: Array.from(new Set(matches)) });
    }
  }
  if (violations.length){
    console.error('\nTheme Scan: Unauthorized hex color usage detected:');
    for (const v of violations){
      console.error(` - ${v.file}: ${v.matches.join(', ')}`);
    }
    console.error('\nUse tokens from src/theme/tokens.ts or CSS variables.');
    process.exit(1);
  } else {
    console.log('Theme Scan: No unauthorized hex colors found.');
  }
}

main();
