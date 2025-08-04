const fs = require('fs');
const path = require('path');

function fixCaseDeclarations(filePath) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix case declarations without blocks
  content = content.replace(
    /case\s+[^:]+:\s*(?!{)([^c\n]+)(?=case|default|$)/g,
    (match, statement) => {
      if (!statement.trim().startsWith('{')) {
        modified = true;
        return match.replace(
          statement,
          `{\n      ${statement.trim()}\n      break;\n    }`
        );
      }
      return match;
    }
  );

  // Fix missing break statements
  content = content.replace(/case\s+[^:]+:[^}]*?(?=case|default|$)/g, match => {
    if (
      !match.includes('break;') &&
      !match.includes('return') &&
      !match.includes('throw')
    ) {
      modified = true;
      return match.trim() + '\n      break;';
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed case declarations in: ${filePath}`);
  }
}

// Files that likely have switch statement issues
const filesToFix = [
  'packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js',
  'packages/backend/src/services/WorkflowEngine.js',
  'packages/backend/src/services/VoiceInteractionService.js',
];

filesToFix.forEach(fixCaseDeclarations);
console.log('Case declarations fix completed');
