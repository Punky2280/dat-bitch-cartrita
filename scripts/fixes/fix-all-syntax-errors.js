#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive syntax error fixes...');

// Define all the files that need fixing and their specific fixes
const fileFixes = [
  // EnhancedMessageBus.js
  {
    file: 'packages/backend/src/system/EnhancedMessageBus.js',
    fixes: [
      {
        search:
          /console\.log\(\);\s*\n\s*`\[MCP\] Agent \${agentId} already registered, updating metadata`;\s*\n\s*\);/g,
        replace: `console.log(\`[MCP] Agent \${agentId} already registered, updating metadata\`);`,
      },
    ],
  },

  // Fix console.log statements with broken syntax
  {
    file: 'packages/backend/src/agi/agentInitializer.js',
    fixes: [
      {
        search:
          /console\.log\(\);\s*\n\s*'│\s+🎯 AGENT STATUS SUMMARY\s+│';\s*\n\s*\);/g,
        replace: `console.log('│                    🎯 AGENT STATUS SUMMARY                  │');`,
      },
    ],
  },

  // Fix all broken console.log patterns across files
  {
    file: 'packages/backend/src/agi/consciousness/ArtistAgent.js',
    fixes: [
      {
        search:
          /console\.log\(\);\s*\n\s*`\[ArtistAgent\] Generating image with enhanced prompt: "\${enhancedPrompt}"`;\s*\n\s*\);/g,
        replace: `console.log(\`[ArtistAgent] Generating image with enhanced prompt: "\${enhancedPrompt}"\`);`,
      },
    ],
  },
];

// Generic function to fix common syntax patterns
function fixCommonPatterns(content) {
  // Fix broken console.log statements
  content = content.replace(
    /console\.log\(\);\s*\n\s*([^;]+);\s*\n\s*\);/g,
    'console.log($1);'
  );
  content = content.replace(
    /console\.warn\(\);\s*\n\s*([^;]+);\s*\n\s*\);/g,
    'console.warn($1);'
  );
  content = content.replace(
    /console\.error\(\);\s*\n\s*([^;]+);\s*\n\s*\);/g,
    'console.error($1);'
  );

  // Fix broken function calls with semicolon instead of comma
  content = content.replace(
    /this\.scheduleNotification\.bind\(this\);\s*\n\s*\);/g,
    'this.scheduleNotification.bind(this));'
  );

  // Fix broken ternary operators
  content = content.replace(
    /return sorted\.length % 2;\s*\n\s*\? sorted\[mid\];\s*\n\s*: \(sorted\[mid - 1\] \+ sorted\[mid\]\) \/ 2;/g,
    'return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;'
  );

  // Fix broken object destructuring
  content = content.replace(
    /const \{ ([^}]+) \} =;\s*\n\s*([^;]+);/g,
    'const { $1 } = $2;'
  );

  // Fix broken string concatenation
  content = content.replace(
    /const sourceLanguage =;\s*\n\s*fromLanguage \|\| \(await this\.detectTextLanguage\(text\)\);/g,
    'const sourceLanguage = fromLanguage || (await this.detectTextLanguage(text));'
  );

  // Fix broken if statements
  content = content.replace(/if \(\);/g, 'if (true)');

  // Fix broken return statements
  content = content.replace(
    /return res\s*\n\s*\.status\((\d+)\);\s*\n\s*\.json\(([^)]+)\);/g,
    'return res.status($1).json($2);'
  );

  // Fix broken array access
  content = content.replace(
    /\[userId, filters;\s*\n\s*\);/g,
    '[userId, filters]);'
  );

  // Fix broken object properties
  content = content.replace(/message:;\s*\n\s*([^,}]+)/g, 'message: $1');

  // Fix broken tool descriptions
  content = content.replace(
    /description:\s*"[^"]*";\s*\n\s*'([^']+)',/g,
    "description: '$1',"
  );

  // Fix broken regex patterns
  content = content.replace(
    /\['xss_attack', \/(<script\[^>\]\*>.*?<\/script>|javascript:|on\\w\+\\s\*=)\/i\],/g,
    "['xss_attack', /<script[^>]*>.*?<\\/script>|javascript:|on\\w+\\s*=/i],"
  );

  return content;
}

// Process each file
function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Apply generic fixes
    content = fixCommonPatterns(content);

    // Apply file-specific fixes
    const fileConfig = fileFixes.find(f => f.file === filePath);
    if (fileConfig) {
      fileConfig.fixes.forEach(fix => {
        content = content.replace(fix.search, fix.replace);
      });
    }

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Get all JavaScript files in the backend
function getAllJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllJSFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main execution
async function main() {
  const backendDir = 'packages/backend/src';

  if (!fs.existsSync(backendDir)) {
    console.error('❌ Backend directory not found!');
    process.exit(1);
  }

  const jsFiles = getAllJSFiles(backendDir);
  console.log(`📁 Found ${jsFiles.length} JavaScript files to process`);

  let fixedCount = 0;

  for (const file of jsFiles) {
    if (processFile(file)) {
      fixedCount++;
    }
  }

  console.log(
    `\n🎉 Processing complete! Fixed ${fixedCount} files out of ${jsFiles.length}`
  );

  // Test the main orchestrator file
  console.log('\n🧪 Testing EnhancedLangChainOrchestrator...');
  try {
    require('./packages/backend/src/agi/orchestration/EnhancedLangChainOrchestrator.js');
    console.log('✅ EnhancedLangChainOrchestrator syntax is now valid!');
  } catch (error) {
    console.error(
      '❌ EnhancedLangChainOrchestrator still has issues:',
      error.message
    );
  }
}

main().catch(console.error);
