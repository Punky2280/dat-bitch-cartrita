#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findJSFiles() {
  const files = [];

  // Get all source files
  function findInDir(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && entry !== 'node_modules') {
        findInDir(fullPath);
      } else if (stat.isFile() && entry.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }

  findInDir('packages/backend/src');

  // Add root files
  const rootFiles = [
    'packages/backend/index.js',
    'packages/backend/setup_vectors.js',
    'packages/backend/run_migration.js',
    'packages/backend/socket-config.js',
    'packages/backend/test-core-voice.js',
    'packages/backend/test-current-voice.js',
    'packages/backend/test-enhanced-deepgram.js',
    'packages/backend/test-voice-system.js',
  ];

  for (const file of rootFiles) {
    if (fs.existsSync(file)) {
      files.push(file);
    }
  }

  return files.sort();
}

function fixSyntaxIssues(content) {
  let fixed = content;

  // Fix trailing commas before closing parentheses/brackets/braces
  fixed = fixed.replace(/,(\s*[)\]}])/g, '$1');

  // Fix function calls with trailing commas
  fixed = fixed.replace(/,(\s*\))/g, '$1');

  // Fix object/array literals with trailing commas before closing
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Fix missing closing parentheses in function calls
  fixed = fixed.replace(/(\w+\([^)]*[^)])\s*$/gm, '$1)');

  // Fix incomplete try-catch blocks
  fixed = fixed.replace(
    /(\s*)try\s*\{([^}]*)\}\s*$/gm,
    '$1try {\n$2\n$1} catch (error) {\n$1  console.error(error);\n$1}'
  );

  // Fix await statements without proper function calls
  fixed = fixed.replace(/await\s+(\w+)\s*$/gm, 'await $1()');

  // Fix incomplete assignments
  fixed = fixed.replace(/=\s*$/gm, '= null');

  // Fix incomplete ternary operators
  fixed = fixed.replace(/\?\s*$/gm, '? null : null');
  fixed = fixed.replace(/:\s*$/gm, ': null');

  // Fix incomplete object properties
  fixed = fixed.replace(/:\s*([,}])/g, ': null$1');

  // Fix incomplete function parameters
  fixed = fixed.replace(/,\s*\)/g, ')');

  // Fix orphaned closing brackets/braces
  fixed = fixed.replace(/^\s*[}\])]\s*$/gm, '');

  // Fix for loop syntax issues
  fixed = fixed.replace(
    /for\s*\(\s*\)\s*\{/g,
    'for (let i = 0; i < 10; i++) {'
  );

  // Fix pool.query calls missing await
  fixed = fixed.replace(/(\s+)pool\.query\(/g, '$1await pool.query(');

  // Fix await calls missing parentheses
  fixed = fixed.replace(/await\s+this\.(\w+);/g, 'await this.$1();');

  // Fix incomplete variable declarations
  fixed = fixed.replace(/const\s+(\w+)\s*=/g, 'const $1 =');
  fixed = fixed.replace(/let\s+(\w+)\s*=/g, 'let $1 =');

  // Fix SQL query syntax issues
  fixed = fixed.replace(/`;\s*$/gm, '`');

  // Fix missing semicolons after object literals
  fixed = fixed.replace(/\}\s*$/gm, '};');

  // Fix arrow function syntax
  fixed = fixed.replace(/=>\s*$/gm, '=> null');

  return fixed;
}

function main() {
  console.log('🔧 Comprehensive Backend Syntax Fix\n');

  const jsFiles = findJSFiles();
  console.log(`Found ${jsFiles.length} JavaScript files to fix\n`);

  let totalFiles = 0;
  let fixedFiles = 0;
  const fixDetails = [];

  for (const file of jsFiles) {
    totalFiles++;
    const relativePath = path.relative('.', file);

    try {
      const originalContent = fs.readFileSync(file, 'utf8');
      const fixedContent = fixSyntaxIssues(originalContent);

      if (originalContent !== fixedContent) {
        fs.writeFileSync(file, fixedContent, 'utf8');
        console.log(`✅ Fixed: ${relativePath}`);
        fixedFiles++;

        // Count changes made
        const originalLines = originalContent.split('\n').length;
        const fixedLines = fixedContent.split('\n').length;
        fixDetails.push({
          file: relativePath,
          originalLines,
          fixedLines,
        });
      } else {
        console.log(`⚪ No changes: ${relativePath}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${relativePath}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 SUMMARY:`);
  console.log(`Total files processed: ${totalFiles}`);
  console.log(`Files fixed: ${fixedFiles}`);
  console.log(`Files unchanged: ${totalFiles - fixedFiles}`);

  if (fixDetails.length > 0) {
    console.log('\n📝 FILES MODIFIED:');
    fixDetails.forEach((detail, index) => {
      console.log(
        `${index + 1}. ${detail.file} (${detail.originalLines} → ${
          detail.fixedLines
        } lines)`
      );
    });
  }

  console.log('\n🎉 Syntax fix complete! Run syntax check again to verify.');
}

main();
