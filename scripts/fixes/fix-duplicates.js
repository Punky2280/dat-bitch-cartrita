const fs = require('fs');

function fixDuplicateKeys(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix duplicate object keys by removing duplicates
  const lines = content.split('\n');
  const seenKeys = new Set();
  const filteredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyMatch = line.match(/^\s*['"]?(\w+)['"]?\s*:/);

    if (keyMatch) {
      const key = keyMatch[1];
      if (seenKeys.has(key)) {
        // Skip duplicate key
        modified = true;
        continue;
      }
      seenKeys.add(key);
    }

    filteredLines.push(line);
  }

  if (modified) {
    fs.writeFileSync(filePath, filteredLines.join('\n'));
    console.log(`Removed duplicate keys from: ${filePath}`);
  }
}

// Fix files with potential duplicate keys
const filesToFix = [
  'packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js',
  'packages/backend/src/services/WorkflowEngine.js',
];

filesToFix.forEach(fixDuplicateKeys);
console.log('Duplicate keys fix completed');
