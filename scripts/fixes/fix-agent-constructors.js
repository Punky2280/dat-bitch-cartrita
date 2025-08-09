#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// List of agent files to fix
const agentFiles = [
  'src/agi/memory/KnowledgeGraphAgent.js',
  'src/agi/memory/LearningAdapterAgent.js',
  'src/agi/memory/ContextMemoryAgent.js',
  'src/agi/integration/APIGatewayAgent.js',
  'src/agi/consciousness/DesignAgent.js',
  'src/agi/consciousness/ArtistAgent.js',
  'src/agi/consciousness/GitHubSearchAgent.js',
  'src/agi/consciousness/TaskManagementAgent.js',
  'src/agi/consciousness/PersonalizationAgent.js',
  'src/agi/consciousness/SchedulerAgent.js',
  'src/agi/consciousness/CodeWriterAgent.js',
  'src/agi/consciousness/EmotionalIntelligenceAgent.js',
  'src/agi/consciousness/AnalyticsAgent.js',
  'src/agi/consciousness/ComedianAgent.js',
  'src/agi/consciousness/MultiModalFusionAgent.js',
  'src/agi/consciousness/ToolAgent.js',
  'src/agi/security/SecurityAuditAgent.js',
  'src/agi/communication/TranslationAgent.js',
  'src/agi/ethics/BiasDetectionAgent.js',
  'src/agi/ethics/PrivacyProtectionAgent.js',
  'src/agi/ethics/ConstitutionalAI.js',
];

function extractAgentInfo(content) {
  // Extract the config object from constructor
  const configMatch = content.match(/const config = \{[\s\S]*?\};/);
  if (!configMatch) return null;

  const configStr = configMatch[0];

  // Extract name, description, capabilities, and allowedTools
  const nameMatch = configStr.match(/name:\s*['"`]([^'"`]*)['"`]/);
  const descMatch = configStr.match(/description:\s*['"`]([^'"`]*?)['"`]/s);
  const capabilitiesMatch = configStr.match(/capabilities:\s*\[([\s\S]*?)\]/);
  const toolsMatch = configStr.match(/allowedTools:\s*\[([\s\S]*?)\]/);

  return {
    name: nameMatch ? nameMatch[1] : 'unknown',
    description: descMatch ? descMatch[1] : 'Agent description',
    capabilities: capabilitiesMatch ? capabilitiesMatch[1] : '',
    allowedTools: toolsMatch ? toolsMatch[1] : '',
  };
}

function fixConstructor(content) {
  const agentInfo = extractAgentInfo(content);
  if (!agentInfo) {
    console.log('Could not extract agent info, skipping...');
    return content;
  }

  // Create new constructor
  const newConstructor = `  constructor(llm, toolRegistry) {
    super('${agentInfo.name}', 'sub', [${agentInfo.capabilities}
    ], '${agentInfo.description}');
    
    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;
    
    // Update config with allowed tools
    this.config.allowedTools = [${agentInfo.allowedTools}
    ];
  }`;

  // Replace old constructor pattern
  const constructorRegex =
    /constructor\(llm, toolRegistry\)\s*\{[\s\S]*?super\(config, llm, toolRegistry\);\s*\}/;

  return content.replace(constructorRegex, newConstructor);
}

// Process each file
for (const filePath of agentFiles) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    continue;
  }

  console.log(`Processing: ${filePath}`);

  const content = fs.readFileSync(fullPath, 'utf8');
  const fixedContent = fixConstructor(content);

  if (content !== fixedContent) {
    fs.writeFileSync(fullPath, fixedContent);
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`⚠️  No changes needed: ${filePath}`);
  }
}

console.log('✅ All agent constructors updated!');
