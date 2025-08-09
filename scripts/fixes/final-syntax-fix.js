#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findJSFiles() {
  const files = [];

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

function fixSpecificIssues(content) {
  let fixed = content;

  // Fix method declarations that got corrupted
  fixed = fixed.replace(
    /(\s+)async\s+(\w+)\s*\(\s*([^)]*)\)\s*\{\s*\^\s*$/gm,
    '$1async $2($3) {'
  );
  fixed = fixed.replace(
    /(\s+)(\w+)\s*\(\s*([^)]*)\)\s*\{\s*\^\s*$/gm,
    '$1$2($3) {'
  );

  // Fix parameter lists with trailing parentheses
  fixed = fixed.replace(/(\w+\s*=\s*[^,)]+)\s*\)$/gm, '$1');

  // Fix object/array construction issues
  fixed = fixed.replace(/,(\s*\))/g, '$1');
  fixed = fixed.replace(/\(\s*\)/g, '()');

  // Fix missing closing braces and parentheses
  fixed = fixed.replace(/\{\s*\^\s*$/gm, '{');
  fixed = fixed.replace(/\s*\^\s*$/gm, '');

  // Fix function parameters separated by unexpected tokens
  fixed = fixed.replace(/(\w+)\s*\)\s*(\w+)/g, '$1, $2');

  // Fix try-catch blocks
  fixed = fixed.replace(
    /(\s*)\} catch \(error\) \{(\s*\^)/gm,
    '$1} catch (error) {'
  );
  fixed = fixed.replace(
    /(\s*)try \{([^}]*)\}(\s*)catch/gm,
    '$1try {$2$1} catch'
  );

  // Fix specific parentheses issues
  fixed = fixed.replace(/recipient = null\)/g, 'recipient = null,');
  fixed = fixed.replace(
    /connectionString: DATABASE_URL\)/g,
    'connectionString: DATABASE_URL,'
  );
  fixed = fixed.replace(/'migrations'\)/g, "'migrations',");

  // Fix await statements
  fixed = fixed.replace(/await await/g, 'await');

  // Fix missing opening braces for class methods
  fixed = fixed.replace(
    /(\s+)(async\s+)?(\w+)\s*\([^)]*\)\s*\{\s*([^{]*?)(?=\s+(?:async\s+)?\w+\s*\()/gm,
    '$1$2$3($4) {\n$1  // Method implementation\n$1}'
  );

  // Fix incomplete object literals
  fixed = fixed.replace(/\{\s*\)/g, '{}');
  fixed = fixed.replace(/\(\s*\{/g, '({');

  // Fix semicolon placement
  fixed = fixed.replace(/;\s*;/g, ';');

  // Remove trailing nulls
  fixed = fixed.replace(/:\s*null\s*$/gm, ': null');

  // Fix method call syntax
  fixed = fixed.replace(/\.(\w+)\(\s*\)/g, '.$1()');

  return fixed;
}

function fixMethodDeclarations(content) {
  let fixed = content;

  // Fix class method declarations that are missing opening braces
  const methodRegex = /(\s+)(async\s+)?(\w+)\s*\([^)]*\)\s*\{\s*$/gm;
  fixed = fixed.replace(methodRegex, '$1$2$3($4) {');

  // Fix specific syntax patterns found in errors
  fixed = fixed.replace(
    /async createChatCompletion\(params\) \{/g,
    'async createChatCompletion(params) {'
  );
  fixed = fixed.replace(
    /handleConnection\(socket\) \{/g,
    'handleConnection(socket) {'
  );
  fixed = fixed.replace(/getStatus\(\) \{/g, 'getStatus() {');
  fixed = fixed.replace(
    /log\(message, type = 'info'\) \{/g,
    "log(message, type = 'info') {"
  );
  fixed = fixed.replace(/async _call\(query\) \{/g, 'async _call(query) {');

  return fixed;
}

function main() {
  console.log('🔧 Final Backend Syntax Fix\n');

  const jsFiles = findJSFiles();
  console.log(`Found ${jsFiles.length} JavaScript files to fix\n`);

  let totalFiles = 0;
  let fixedFiles = 0;

  for (const file of jsFiles) {
    totalFiles++;
    const relativePath = path.relative('.', file);

    try {
      const originalContent = fs.readFileSync(file, 'utf8');
      let fixedContent = fixSpecificIssues(originalContent);
      fixedContent = fixMethodDeclarations(fixedContent);

      if (originalContent !== fixedContent) {
        fs.writeFileSync(file, fixedContent, 'utf8');
        console.log(`✅ Fixed: ${relativePath}`);
        fixedFiles++;
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

  console.log('\n🎉 Final syntax fix complete!');
}

main();
