// packages/backend/src/agi/agentInitializer.js

/**
 * Cartrita AGI System - Dynamic Agent Initializer
 *
 * This module dynamically loads, initializes, and reports on the status of all agents.
 * It's designed to be robust, preventing a single faulty agent from crashing the system.
 */
const MessageBus = require('../system/EnhancedMessageBus');

// A manifest of all agents to be loaded, organized by category.
// This makes the system easier to manage and update.
const agentManifest = {
  "System & Orchestration": [
    // NOTE: EnhancedCoreAgent deprecated - now using EnhancedLangChainCoreAgent
    { name: 'MCPCoordinatorAgent', path: './system/MCPCoordinatorAgent' },
  ],
  "Consciousness Agents": [
    { name: 'CodeWriterAgent', path: './consciousness/CodeWriterAgent' },
    { name: 'SchedulerAgent', path: './consciousness/SchedulerAgent' },
    { name: 'ArtistAgent', path: './consciousness/ArtistAgent' },
    { name: 'WriterAgent', path: './consciousness/WriterAgent' },
    { name: 'ResearcherAgent', path: './consciousness/ResearcherAgent' },
    { name: 'ComedianAgent', path: './consciousness/ComedianAgent' },
    { name: 'EmotionalIntelligenceAgent', path: './consciousness/EmotionalIntelligenceAgent' },
    { name: 'TaskManagementAgent', path: './consciousness/TaskManagementAgent' },
    { name: 'AnalyticsAgent', path: './consciousness/AnalyticsAgent' },
    { name: 'DesignAgent', path: './consciousness/DesignAgent' },
    { name: 'PersonalizationAgent', path: './consciousness/PersonalizationAgent' },
    { name: 'GitHubSearchAgent', path: './consciousness/GitHubSearchAgent' }, // New
    { name: 'ToolAgent', path: './consciousness/ToolAgent' }, // New
  ],
  "Ethics & Safety": [
    { name: 'ConstitutionalAI', path: './ethics/ConstitutionalAI' },
    { name: 'ExistentialCheckIn', path: './ethics/ExistentialCheckIn' },
    { name: 'PrivacyProtectionAgent', path: './ethics/PrivacyProtectionAgent' },
    { name: 'BiasDetectionAgent', path: './ethics/BiasDetectionAgent' },
    { name: 'SecurityAuditAgent', path: './security/SecurityAuditAgent' },
  ],
  "Memory & Learning": [
    { name: 'ConversationStore', path: './memory/ConversationStore' },
    { name: 'UserProfile', path: './memory/UserProfile' },
    { name: 'KnowledgeGraphAgent', path: './memory/KnowledgeGraphAgent' },
    { name: 'LearningAdapterAgent', path: './memory/LearningAdapterAgent' },
    { name: 'ContextMemoryAgent', path: './memory/ContextMemoryAgent' },
  ],
  "Communication & Integration": [
    { name: 'NotificationAgent', path: './communication/NotificationAgent' },
    { name: 'TranslationAgent', path: './communication/TranslationAgent' },
    { name: 'APIGatewayAgent', path: './integration/APIGatewayAgent' },
  ],
};

function initializeAgents() {
  console.log('[Agent Initializer] 🚀 Activating Cartrita AGI System...');
  
  const loadedAgents = new Set();
  const failedAgents = [];
  let totalAgents = 0;

  // Dynamically load each agent with individual error handling
  for (const category of Object.keys(agentManifest)) {
    console.log(`[Agent Initializer]  initializing ${category}...`);
    for (const agent of agentManifest[category]) {
      totalAgents++;
      try {
        // Requiring the file instantiates the singleton agent
        require(agent.path);
        loadedAgents.add(agent.name);
        console.log(`[Agent Initializer]  ✅ ${agent.name}`);
      } catch (error) {
        failedAgents.push(agent.name);
        console.error(`[Agent Initializer]  ❌ FAILED to load ${agent.name}: ${error.message}`);
      }
    }
  }

  // Generate a dynamic and accurate summary table
  console.log('\n[Agent Initializer] ✨ Cartrita System Activation Report ✨');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    🎯 AGENT STATUS SUMMARY                  │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  
  for (const category of Object.keys(agentManifest)) {
    const agentsInCategory = agentManifest[category];
    const loadedCount = agentsInCategory.filter(a => loadedAgents.has(a.name)).length;
    const statusIcon = loadedCount === agentsInCategory.length ? '✅' : '⚠️';
    const statusText = `${category}: ${loadedCount}/${agentsInCategory.length}`.padEnd(58, ' ');
    console.log(`│ ${statusIcon} ${statusText} │`);
  }
  
  console.log('├─────────────────────────────────────────────────────────────┤');
  const totalLoaded = loadedAgents.size;
  const summaryText = `🚀 TOTAL AGENTS: ${totalLoaded}/${totalAgents} ACTIVE`.padEnd(58, ' ');
  console.log(`│ ${summaryText} │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  
  if (failedAgents.length > 0) {
    console.warn(`\n[Agent Initializer] ⚠️ Warning: The following agents failed to load: ${failedAgents.join(', ')}`);
    console.warn('[Agent Initializer] System will run with reduced functionality.');
  } else {
    console.log('\n[Agent Initializer] 🎉 All agents connected to MessageBus and MCP Protocol.');
    console.log('[Agent Initializer] 📡 System Status: FULLY OPERATIONAL');
  }
}

module.exports = initializeAgents;