/**
 * @fileoverview Fixes import statements and function usage for authentication middleware in route files.
 * @description This script targets the route files that were created with a placeholder for authentication
 * and updates them to use the project's actual `authenticateToken.js` middleware.
 */

import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CWD = process.cwd(); // Current Working Directory
const ROUTES_DIR = path.join(CWD, 'packages', 'backend', 'src', 'routes');
const FILES_TO_FIX = [
  'mcp.js',
  'monitoring.js',
  'notifications.js',
  'privacy.js',
  'vision.js',
  'voiceChat.js',
];

const REPLACEMENTS = [
  {
    find: /import { protectRoute } from '..\/middleware\/authMiddleware.js';/g,
    replace:
      "import authenticateToken from '../middleware/authenticateToken.js';",
  },
  {
    find: /protectRoute/g,
    replace: 'authenticateToken',
  },
];

// --- EXECUTION ---
console.log('🔧 Starting authentication import fix...');

let filesChanged = 0;
let filesScanned = 0;

FILES_TO_FIX.forEach(fileName => {
  const filePath = path.join(ROUTES_DIR, fileName);
  filesScanned++;

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping: File not found at ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    REPLACEMENTS.forEach(rule => {
      content = content.replace(rule.find, rule.replace);
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed imports in: ${path.relative(CWD, filePath)}`);
      filesChanged++;
    } else {
      console.log(`🔍 No changes needed for: ${path.relative(CWD, filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error processing file ${fileName}:`, error);
  }
});

console.log(
  `\n🎉 Fix script complete. Scanned ${filesScanned} files, changed ${filesChanged}.`
);
