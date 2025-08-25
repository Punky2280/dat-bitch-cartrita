const fs = require('fs');

// Fix missing imports and other issues
const fixes = [
  {
    file: 'packages/backend/src/agi/consciousness/ComedianAgent.js',
    search: "const BaseAgent = require('../../system/BaseAgent');",
    replace:
      "const BaseAgent = require('../../system/BaseAgent');\nconst MessageBus = require('../../system/MessageBus');",
  },
  {
    file: 'packages/backend/src/agi/consciousness/GitHubSearchAgent.js',
    search:
      /const\s+(\w+)\s*=\s*require\([^)]+\);\s*\n\s*const\s+\1\s*=\s*require\([^)]+\);/g,
    replace: (match, varName) => match.split('\n')[0] + ';',
  },
  {
    file: 'packages/backend/src/services/PrivacyControlService.js',
    search:
      /const\s+(\w+)\s*=\s*require\([^)]+\);\s*\n\s*const\s+\1\s*=\s*require\([^)]+\);/g,
    replace: (match, varName) => match.split('\n')[0] + ';',
  },
];

fixes.forEach(fix => {
  if (fs.existsSync(fix.file)) {
    let content = fs.readFileSync(fix.file, 'utf8');
    if (typeof fix.search === 'string') {
      content = content.replace(fix.search, fix.replace);
    } else {
      content = content.replace(fix.search, fix.replace);
    }
    fs.writeFileSync(fix.file, content);
    console.log(`Fixed: ${fix.file}`);
  }
});

console.log('Remaining issues fix completed');
