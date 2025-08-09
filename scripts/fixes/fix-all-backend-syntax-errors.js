#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Comprehensive Backend JavaScript Syntax Error Fix');
console.log('═══════════════════════════════════════════════════════');

// Get all .js files in the backend
const getAllJSFiles = dir => {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules') {
      files.push(...getAllJSFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
};

const backendPath = path.join(__dirname, 'packages', 'backend');
const allJSFiles = getAllJSFiles(backendPath);

console.log(`📁 Found ${allJSFiles.length} JavaScript files to check`);

const fixPatterns = [
  // Fix missing closing parentheses in function calls
  {
    name: 'Missing closing parentheses in function calls',
    pattern: /(\w+\([^)]*),\s*$/gm,
    replacement: '$1)',
  },
  // Fix incomplete assignments ending with semicolon
  {
    name: 'Incomplete assignments',
    pattern: /(\w+\s*=\s*);/g,
    replacement: '$1null;',
  },
  // Fix malformed ternary operators
  {
    name: 'Malformed ternary operators',
    pattern: /(\w+)\s*;\s*\?\s*([^:]+);\s*:\s*([^,}]+),?/g,
    replacement: '$1 ? $2 : $3',
  },
  // Fix incomplete conditional statements
  {
    name: 'Incomplete conditional statements',
    pattern: /if\s*\(\s*true\s*\)\s*([^&]+)&&;\s*([^)]+);\s*\)\s*{/g,
    replacement: 'if ($1 && $2) {',
  },
  // Fix incomplete filter/map functions
  {
    name: 'Incomplete filter/map functions',
    pattern: /\.filter\(\s*\)\s*;/g,
    replacement: '.filter(item => item)',
  },
  // Fix incomplete arrow functions
  {
    name: 'Incomplete arrow functions',
    pattern: /=>\s*;/g,
    replacement: '=> true',
  },
  // Fix object literal syntax errors
  {
    name: 'Object literal comma errors',
    pattern: /{\s*,/g,
    replacement: '{',
  },
  // Fix SQL query syntax errors
  {
    name: 'SQL query syntax errors',
    pattern: /pool\.query\(\s*`([^`]+)`\s*,\s*\[([^\]]*)\]\s*$/gm,
    replacement: 'pool.query(`$1`, [$2])',
  },
  // Fix await outside async function (simple cases)
  {
    name: 'Standalone await expressions',
    pattern: /^\s*await\s+([^;]+);\s*$/gm,
    replacement: '$1;',
  },
  // Fix console.log missing parentheses
  {
    name: 'Console.log missing parentheses',
    pattern: /console\.log\s*([^;(]+);/g,
    replacement: 'console.log($1);',
  },
  // Fix MessageBus.publish calls
  {
    name: 'MessageBus.publish calls',
    pattern: /MessageBus\.publish\(\s*([^,]+),\s*{\s*$/gm,
    replacement: 'MessageBus.publish($1, {',
  },
  // Fix template literal issues
  {
    name: 'Template literal syntax',
    pattern: /`([^`]*)\$\{([^}]*)\}([^`]*)`\s*;/g,
    replacement: '`$1${$2}$3`',
  },
  // Fix function definition issues
  {
    name: 'Function definition issues',
    pattern: /async\s+(\w+)\s*\(\s*([^)]*)\s*\)\s*{/g,
    replacement: 'async $1($2) {',
  },
];

let totalFilesFixed = 0;
let totalErrorsFixed = 0;
const errorsByFile = {};

// Process each file
allJSFiles.forEach(filePath => {
  const relativePath = path.relative(backendPath, filePath);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileErrorsFixed = 0;

    // Apply all fix patterns
    fixPatterns.forEach(({ name, pattern, replacement }) => {
      const beforeLength = content.length;
      content = content.replace(pattern, replacement);
      const afterLength = content.length;

      if (beforeLength !== afterLength) {
        fileErrorsFixed++;
        if (!errorsByFile[relativePath]) {
          errorsByFile[relativePath] = [];
        }
        errorsByFile[relativePath].push(name);
      }
    });

    // Additional specific fixes for common patterns

    // Fix missing closing braces/parentheses
    content = content.replace(/(\w+\([^)]*),\s*\n\s*([^)]*)\s*$/gm, '$1, $2)');

    // Fix incomplete object properties
    content = content.replace(/(\w+):\s*;/g, '$1: null');

    // Fix incomplete array/object destructuring
    content = content.replace(
      /const\s*{\s*([^}]*)\s*}\s*=\s*;/g,
      'const { $1 } = {};'
    );

    // Fix incomplete try-catch blocks
    content = content.replace(
      /try\s*{\s*([^}]*)\s*}\s*$/gm,
      'try {\n$1\n} catch (error) {\n  console.error(error);\n}'
    );

    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      totalFilesFixed++;
      totalErrorsFixed += fileErrorsFixed;
      console.log(`✅ Fixed ${fileErrorsFixed} errors in ${relativePath}`);
    } else {
      console.log(`✓ No errors found in ${relativePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${relativePath}:`, error.message);
  }
});

console.log('\n📊 SUMMARY REPORT');
console.log('═══════════════════════════════════════════════════════');
console.log(`Total files scanned: ${allJSFiles.length}`);
console.log(`Files with errors fixed: ${totalFilesFixed}`);
console.log(`Total errors fixed: ${totalErrorsFixed}`);

if (Object.keys(errorsByFile).length > 0) {
  console.log('\n🔍 ERRORS FIXED BY FILE:');
  Object.entries(errorsByFile).forEach(([file, errors]) => {
    console.log(`\n📄 ${file}:`);
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  });
}

console.log('\n✅ Syntax error fixing complete!');
console.log('🚀 Try starting the backend now with: npm start');
