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

// Fix remaining syntax issues that prevent startup
function fixRemainingSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let fixed = content;
    let hasChanges = false;
    
    // Fix standalone closing parenthesis at beginning of line (most common error)
    const standaloneParenPattern = /^\s*\);\s*$/gm;
    if (standaloneParenPattern.test(fixed)) {
      fixed = fixed.replace(standaloneParenPattern, '');
      hasChanges = true;
      console.log(`Fixed standalone ) in ${filePath}`);
    }
    
    // Fix query( followed by string literal on next line
    const brokenQueryPattern = /pool\.query\(\s*\n\s*['"`]/g;
    if (brokenQueryPattern.test(fixed)) {
      fixed = fixed.replace(/pool\.query\(\s*\n\s*(['"`])/g, 'pool.query(\n        $1');
      hasChanges = true;
      console.log(`Fixed broken query pattern in ${filePath}`);
    }
    
    // Fix broken string concatenation patterns
    const brokenConcatPattern = /;\s*\n\s*\.\w+/g;
    if (brokenConcatPattern.test(fixed)) {
      fixed = fixed.replace(/;\s*\n\s*(\.\w+)/g, '\n        $1');
      hasChanges = true;
      console.log(`Fixed broken concatenation in ${filePath}`);
    }
    
    // Fix reduce(; patterns
    const brokenReducePattern = /\.reduce\(\s*;/g;
    if (brokenReducePattern.test(fixed)) {
      fixed = fixed.replace(/\.reduce\(\s*;/g, '.reduce(');
      hasChanges = true;
      console.log(`Fixed broken reduce in ${filePath}`);
    }
    
    // Fix Math.round(; patterns  
    const brokenMathPattern = /Math\.round\(\s*;/g;
    if (brokenMathPattern.test(fixed)) {
      fixed = fixed.replace(/Math\.round\(\s*;/g, 'Math.round(');
      hasChanges = true;
      console.log(`Fixed broken Math.round in ${filePath}`);
    }
    
    // Fix broken route patterns like router.get('/mi, ...
    const brokenRoutePattern = /router\.(get|post|put|delete)\('\/\w+,/g;
    if (brokenRoutePattern.test(fixed)) {
      fixed = fixed.replace(/router\.(get|post|put|delete)\('(\/\w+),/g, 'router.$1(\'$2\',');
      hasChanges = true;
      console.log(`Fixed broken route pattern in ${filePath}`);
    }
    
    // Fix require paths with missing quotes
    const brokenRequirePattern = /require\(['"`][^'"`]*\w[^'"`]*[,]/g;
    if (brokenRequirePattern.test(fixed)) {
      fixed = fixed.replace(/require\((['"`][^'"`]*\w[^'"`]*),/g, 'require($1)');
      hasChanges = true;
      console.log(`Fixed broken require in ${filePath}`);
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
console.log('🔧 Final syntax cleanup to fix remaining startup blockers...\n');

const jsFiles = findJSFiles('./packages/backend/src');
let fixedCount = 0;

for (const file of jsFiles) {
  if (fixRemainingSyntax(file)) {
    fixedCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files checked: ${jsFiles.length}`);
console.log(`   Files fixed: ${fixedCount}`);
console.log('\n🎯 Final cleanup complete. Testing backend startup...');