#!/usr/bin/env node

/**
 * Fix ES6 imports missing .js extensions
 * This script automatically adds .js extensions to all relative local imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, 'packages/backend/src');

function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  const fixedLines = lines.map(line => {
    // Match import statements with relative paths that don't have .js extension
    const importMatch = line.match(
      /^(\s*import\s+.*from\s+['"`])(\.\.?\/[^'"`]*?)(['"`];?\s*)$/
    );

    if (importMatch) {
      const [, prefix, importPath, suffix] = importMatch;

      // Check if the import path doesn't already have .js extension
      if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
        // Verify that adding .js would create a valid file path
        const absolutePath = path.resolve(
          path.dirname(filePath),
          importPath + '.js'
        );

        if (fs.existsSync(absolutePath)) {
          modified = true;
          return `${prefix}${importPath}.js${suffix}`;
        }
      }
    }

    return line;
  });

  if (modified) {
    fs.writeFileSync(filePath, fixedLines.join('\n'));
    console.log(
      `✅ Fixed imports in: ${path.relative(process.cwd(), filePath)}`
    );
    return true;
  }

  return false;
}

function walkDirectory(dir) {
  let totalFixed = 0;

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and other unwanted directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          walk(fullPath);
        }
      } else if (item.endsWith('.js')) {
        if (fixImportsInFile(fullPath)) {
          totalFixed++;
        }
      }
    }
  }

  walk(dir);
  return totalFixed;
}

console.log('🔧 Fixing ES6 imports missing .js extensions...');
console.log(`📁 Scanning directory: ${BACKEND_DIR}`);

try {
  const fixed = walkDirectory(BACKEND_DIR);
  console.log(`\n✨ Done! Fixed imports in ${fixed} files.`);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
