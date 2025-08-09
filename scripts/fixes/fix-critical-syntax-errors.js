#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of critical parsing error files from ESLint output
const criticalFiles = [
  'packages/backend/src/agi/agentInitializer.js',
  'packages/backend/src/agi/communication/NotificationAgent.js',
  'packages/backend/src/agi/communication/TranslationAgent.js',
  'packages/backend/src/agi/consciousness/AnalyticsAgent.js',
  'packages/backend/src/agi/consciousness/CodeWriterAgent.js',
  'packages/backend/src/agi/consciousness/ComedianAgent.js',
  'packages/backend/src/agi/consciousness/DesignAgent.js',
  'packages/backend/src/agi/consciousness/EmotionalIntelligenceAgent.js',
  'packages/backend/src/agi/consciousness/GitHubSearchAgent.js',
  'packages/backend/src/agi/consciousness/MultiModalFusionAgent.js',
  'packages/backend/src/agi/consciousness/PersonalizationAgent.js',
  'packages/backend/src/agi/consciousness/SchedulerAgent.js',
  'packages/backend/src/agi/consciousness/TaskManagementAgent.js',
  'packages/backend/src/agi/consciousness/ToolAgent.js',
  'packages/backend/src/agi/ethics/BiasDetectionAgent.js',
  'packages/backend/src/agi/ethics/ConstitutionalAI.js',
  'packages/backend/src/agi/ethics/ExistentialCheckIn.js',
  'packages/backend/src/agi/ethics/PrivacyProtectionAgent.js',
  'packages/backend/src/agi/integration/APIGatewayAgent.js',
  'packages/backend/src/agi/memory/ContextMemoryAgent.js',
  'packages/backend/src/agi/memory/ConversationStore.js',
  'packages/backend/src/agi/memory/KnowledgeGraphAgent.js',
  'packages/backend/src/agi/memory/LearningAdapterAgent.js',
  'packages/backend/src/agi/memory/UserProfile.js',
  'packages/backend/src/agi/security/SecurityAuditAgent.js',
  'packages/backend/src/agi/system/MCPCoordinatorAgent.js',
  'packages/backend/src/routes/agentMetrics.js',
  'packages/backend/src/routes/auth.js',
  'packages/backend/src/routes/calendar.js',
  'packages/backend/src/routes/chatHistory.js',
  'packages/backend/src/routes/contact.js',
];

function fixCommonSyntaxErrors(content) {
  // Fix common parsing issues
  let fixed = content;

  // Fix case statements without break
  fixed = fixed.replace(
    /case\s+(['"`][^'"`]*['"`]|\w+):\s*\{([^}]*)\}\s*(?=case|default|$)/g,
    'case $1: {\n$2\nbreak;\n}'
  );

  // Fix missing semicolons after function calls
  fixed = fixed.replace(/(\w+\([^)]*\))\s*\n/g, '$1;\n');

  // Fix duplicate declarations
  fixed = fixed.replace(
    /(const|let|var)\s+(\w+)\s*=.*?\n.*?\1\s+\2\s*=/g,
    match => {
      const lines = match.split('\n');
      return lines[0] + '\n' + lines[1].replace(/^(const|let|var)\s+/, '');
    }
  );

  // Fix invalid regex flags
  fixed = fixed.replace(/\/[^\/]*\/[a-z]*[^a-z\s]/g, match => {
    const parts = match.split('/');
    if (parts.length >= 3) {
      const flags = parts[2].replace(/[^gimuy]/g, '');
      return `/${parts[1]}/${flags}`;
    }
    return match;
  });

  // Fix missing commas in object literals
  fixed = fixed.replace(/(\w+:\s*[^,}\n]+)\s*\n\s*(\w+:)/g, '$1,\n$2');

  // Fix unclosed template literals
  fixed = fixed.replace(/`[^`]*$/gm, match => match + '`');

  return fixed;
}

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixed = fixCommonSyntaxErrors(content);

    if (content !== fixed) {
      fs.writeFileSync(fullPath, fixed, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Starting critical syntax error fixes...\n');

let fixedCount = 0;
let totalFiles = criticalFiles.length;

for (const file of criticalFiles) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${totalFiles}`);
console.log(`   Files fixed: ${fixedCount}`);
console.log(`   Files skipped: ${totalFiles - fixedCount}`);

if (fixedCount > 0) {
  console.log('\n🎉 Run "npm run lint" again to check for remaining issues.');
} else {
  console.log('\n🤔 No automatic fixes applied. Manual review needed.');
}
