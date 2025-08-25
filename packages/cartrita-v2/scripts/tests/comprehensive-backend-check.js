#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findJSFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && entry !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && entry.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files.sort();
}

function checkSyntax(filePath) {
  try {
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.stderr ? error.stderr.toString() : error.message,
    };
  }
}

function main() {
  console.log('🔍 Comprehensive Backend JavaScript Syntax Check\n');

  const backendDir = path.join(__dirname, 'packages/backend/src');
  const jsFiles = findJSFiles(backendDir);

  console.log(`Found ${jsFiles.length} JavaScript files to check:\n`);

  let totalFiles = 0;
  let validFiles = 0;
  let errorFiles = 0;
  const errors = [];

  for (const file of jsFiles) {
    totalFiles++;
    const relativePath = path.relative(__dirname, file);
    process.stdout.write(`Checking ${relativePath}... `);

    const result = checkSyntax(file);

    if (result.valid) {
      console.log('✅ OK');
      validFiles++;
    } else {
      console.log('❌ SYNTAX ERROR');
      errorFiles++;
      errors.push({
        file: relativePath,
        error: result.error,
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 SUMMARY:`);
  console.log(`Total files checked: ${totalFiles}`);
  console.log(`Valid files: ${validFiles}`);
  console.log(`Files with errors: ${errorFiles}`);

  if (errors.length > 0) {
    console.log('\n❌ FILES WITH SYNTAX ERRORS:');
    errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}`);
      console.log(`   Error: ${error.error.trim()}`);
    });
  } else {
    console.log('\n🎉 ALL FILES PASS SYNTAX CHECK!');
  }

  // Also check main backend files
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

  console.log('\n🔍 Checking root backend files:');
  let rootValid = 0;
  let rootErrors = 0;

  for (const file of rootFiles) {
    if (fs.existsSync(file)) {
      process.stdout.write(`Checking ${file}... `);
      const result = checkSyntax(file);

      if (result.valid) {
        console.log('✅ OK');
        rootValid++;
      } else {
        console.log('❌ SYNTAX ERROR');
        console.log(`   Error: ${result.error.trim()}`);
        rootErrors++;
      }
    }
  }

  console.log(`\nRoot files: ${rootValid} valid, ${rootErrors} errors`);
  console.log('\n' + '='.repeat(80));

  if (errorFiles === 0 && rootErrors === 0) {
    console.log('🎉 ALL BACKEND FILES PASS SYNTAX VALIDATION!');
    process.exit(0);
  } else {
    console.log('❌ SYNTAX ERRORS FOUND - BACKEND NEEDS FIXES');
    process.exit(1);
  }
}

main();
