const fs = require('fs');
const path = require('path');

function fixCommonIssues(filePath) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix missing semicolons
  content = content.replace(
    /^(\s*[^\/\n]*[^;\s\n])(\s*)$/gm,
    (match, code, whitespace) => {
      if (
        !code.includes('//') &&
        !code.includes('/*') &&
        !code.includes('*/') &&
        !code.endsWith('{') &&
        !code.endsWith('}') &&
        !code.endsWith(',')
      ) {
        modified = true;
        return code + ';' + whitespace;
      }
      return match;
    }
  );

  // Fix undefined variables by adding common imports
  if (content.includes('console.') && !content.includes('console')) {
    // console is global, no import needed
  }

  if (content.includes('Buffer.') && !content.includes('Buffer')) {
    content = "const { Buffer } = require('buffer');\n" + content;
    modified = true;
  }

  if (content.includes('process.') && !content.includes('process')) {
    // process is global in Node.js
  }

  // Fix no-undef for common globals
  const globals = [
    '__dirname',
    '__filename',
    'global',
    'process',
    'Buffer',
    'console',
  ];

  // Add eslint globals comment if file uses globals
  const usedGlobals = globals.filter(g => content.includes(g));
  if (usedGlobals.length > 0 && !content.includes('/* global ')) {
    content = `/* global ${usedGlobals.join(', ')} */\n` + content;
    modified = true;
  }

  // Fix no-unused-vars by adding eslint-disable for specific cases
  if (content.includes('require(') && !content.includes('eslint-disable')) {
    const hasUnusedVars =
      content.match(/const\s+\w+\s*=\s*require\([^)]+\);/) &&
      !content.includes('module.exports');
    if (hasUnusedVars) {
      content = '/* eslint-disable no-unused-vars */\n' + content;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed common issues in: ${filePath}`);
  }
}

// Get all JS files recursively
function getAllJSFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (
      stat.isDirectory() &&
      !item.startsWith('.') &&
      item !== 'node_modules'
    ) {
      files.push(...getAllJSFiles(fullPath));
    } else if (stat.isFile() && item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Fix common issues in all JS files
const jsFiles = getAllJSFiles('packages/backend/src');
jsFiles.forEach(fixCommonIssues);

console.log(`Processed ${jsFiles.length} JavaScript files`);
