#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all JS files recursively
function findJSFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findJSFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Fix basic syntax errors that prevent startup
function fixBasicSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let fixed = content;
    let hasChanges = false;
    
    // Fix {; pattern - object literal with semicolon
    if (fixed.includes('{;')) {
      fixed = fixed.replace(/\{\s*;/g, '{');
      hasChanges = true;
      console.log(`Fixed {; pattern in ${filePath}`);
    }
    
    // Fix ( ; pattern - function call with semicolon
    if (fixed.includes('(;')) {
      fixed = fixed.replace(/\(\s*;/g, '(');
      hasChanges = true;
      console.log(`Fixed (; pattern in ${filePath}`);
    }
    
    // Fix [ ; pattern - array with semicolon
    if (fixed.includes('[;')) {
      fixed = fixed.replace(/\[\s*;/g, '[');
      hasChanges = true;
      console.log(`Fixed [; pattern in ${filePath}`);
    }
    
    // Fix hanging dots (broken chain)
    const hangingDotPattern = /;\s*\n\s*\./g;
    if (hangingDotPattern.test(fixed)) {
      fixed = fixed.replace(hangingDotPattern, '\n      .');
      hasChanges = true;
      console.log(`Fixed hanging dots in ${filePath}`);
    }
    
    if (hasChanges) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing basic syntax errors that prevent startup...\n');

const jsFiles = findJSFiles('./packages/backend/src');
let fixedCount = 0;

for (const file of jsFiles) {
  if (fixBasicSyntax(file)) {
    fixedCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files checked: ${jsFiles.length}`);
console.log(`   Files fixed: ${fixedCount}`);
console.log('\n🎯 Basic syntax fixes complete. Testing startup...');