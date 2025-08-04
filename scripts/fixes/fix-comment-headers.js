#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to recursively find all JS files
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

// Function to fix comment headers in a file
function fixCommentHeaders(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Fix invalid comment patterns
      if (line.match(/^\/\s+packages\//) || line.match(/^\/\s+[a-zA-Z]/)) {
        lines[i] = line.replace(/^\/\s+/, '// ');
        modified = true;
        console.log(`Fixed comment in ${filePath}:${i + 1}`);
      }
      
      // Fix duplicate MessageBus declarations
      if (line.includes('MessageBus') && i > 0) {
        const prevLines = lines.slice(0, i);
        if (prevLines.some(prevLine => prevLine.includes('MessageBus') && prevLine.includes('require'))) {
          // This is a duplicate, comment it out
          if (!line.trim().startsWith('//')) {
            lines[i] = '// ' + line + ' // Duplicate - commented out';
            modified = true;
            console.log(`Commented duplicate MessageBus in ${filePath}:${i + 1}`);
          }
        }
      }
      
      // Fix missing semicolons at end of statements
      if (line.trim().match(/^(const|let|var).*=.*[^;]$/) && !line.includes('//')) {
        lines[i] = line + ';';
        modified = true;
        console.log(`Added semicolon in ${filePath}:${i + 1}`);
      }
      
      // Fix case statements without break (basic pattern)
      if (line.trim().startsWith('case ') && i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.includes('break') && !nextLine.includes('return') && 
            (lines[i + 2] && (lines[i + 2].trim().startsWith('case ') || lines[i + 2].trim().startsWith('default')))) {
          lines.splice(i + 1, 0, '        break;');
          modified = true;
          console.log(`Added break statement in ${filePath}:${i + 1}`);
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing comment headers and common syntax issues...\n');

const jsFiles = findJSFiles('./packages/backend/src');
let fixedCount = 0;

for (const file of jsFiles) {
  if (fixCommentHeaders(file)) {
    fixedCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files checked: ${jsFiles.length}`);
console.log(`   Files fixed: ${fixedCount}`);

// Now run eslint --fix to auto-fix what we can
console.log('\n🔧 Running ESLint --fix...');
try {
  execSync('npx eslint packages/backend/src --ext .js --fix', { stdio: 'inherit' });
  console.log('✅ ESLint --fix completed');
} catch (error) {
  console.log('⚠️ ESLint --fix completed with some remaining issues');
}