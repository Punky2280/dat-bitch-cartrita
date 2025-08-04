#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files with syntax errors to fix
const fileFixes = [
  {
    file: 'packages/backend/src/services/ServiceInitializer.js',
    fixes: [
      {
        search: /message: process\.env\.DEEPGRAM_API_KEY;/g,
        replace: 'message: process.env.DEEPGRAM_API_KEY'
      },
      {
        search: /\?\s*'[^']+';/g,
        replace: (match) => match.replace(';', '')
      },
      {
        search: /:\s*;/g,
        replace: ':'
      }
    ]
  }
];

console.log('🔧 Fixing remaining syntax errors...');

fileFixes.forEach(({ file, fixes }) => {
  const filePath = path.join(process.cwd(), file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    fixes.forEach(({ search, replace }) => {
      const originalContent = content;
      content = content.replace(search, replace);
      if (content !== originalContent) {
        changed = true;
        console.log(`  ✅ Applied fix to ${file}`);
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  💾 Saved ${file}`);
    } else {
      console.log(`  ⏭️  No changes needed for ${file}`);
    }
  } else {
    console.log(`  ❌ File not found: ${file}`);
  }
});

console.log('✅ Syntax error fixes complete');