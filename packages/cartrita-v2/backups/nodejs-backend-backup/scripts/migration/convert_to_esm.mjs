import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function convertFile(filePath) {
  console.log(`Converting: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Convert require('dotenv').config() to import
  content = content.replace(
    /require\(['"`]dotenv['"`]\)\.config\(\);?/g,
    "import dotenv from 'dotenv';\ndotenv.config();"
  );

  // Convert basic require statements to imports
  content = content.replace(
    /const\s+(\w+)\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g,
    "import $1 from '$2';"
  );

  // Convert destructured require to named imports
  content = content.replace(
    /const\s+\{\s*([^}]+)\s*\}\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g,
    "import { $1 } from '$2';"
  );

  // Convert require with property access
  content = content.replace(
    /const\s+(\w+)\s+=\s+require\(['"`]([^'"`]+)['"`]\)\.(\w+);?/g,
    "import { $3 as $1 } from '$2';"
  );

  // Convert module.exports to export default
  content = content.replace(
    /module\.exports\s*=\s*([^;]+);?/g,
    'export default $1;'
  );

  // Convert module.exports.property to named exports
  content = content.replace(
    /module\.exports\.(\w+)\s*=\s*([^;]+);?/g,
    'export const $1 = $2;'
  );

  // Convert exports.property to named exports
  content = content.replace(
    /exports\.(\w+)\s*=\s*([^;]+);?/g,
    'export const $1 = $2;'
  );

  // Add .js extensions to relative imports
  content = content.replace(/from\s+['"`](\.[^'"`]*?)['"`]/g, (match, p1) => {
    if (!p1.endsWith('.js') && !p1.endsWith('.mjs') && !p1.includes('.')) {
      return `from '${p1}.js'`;
    }
    return match;
  });

  fs.writeFileSync(filePath, content);
}

// List of files to convert
const filesToConvert = [
  './index.js',
  './run_migration.js',
  './setup_vectors.js',
  './socket-config.js',
  './debug-routes.js',
  './test-voice-system.js',
  './test-enhanced-deepgram.js',
  './test-current-voice.js',
  './test-core-voice.js',
];

console.log('Starting CommonJS to ES Module conversion...');

filesToConvert.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`Converting ${file}...`);
    convertFile(file);
  } else {
    console.log(`File ${file} not found, skipping...`);
  }
});

// Convert src directory files
function walkDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && file !== 'node_modules') {
      walkDirectory(filePath);
    } else if (file.endsWith('.js')) {
      convertFile(filePath);
    }
  });
}

walkDirectory('./src');

console.log('Basic conversion complete!');
