/* global console, require, module */
// packages/backend/src/agi/agentInitializer.js

/**
 * Agent Initializer v2.1 - Dynamic initialization and registration
 * Loads all AGI agents from the manifest and registers them with the MCP system
 */

import path from 'path';

// A manifest of all agents to be loaded, organized by category.
// This makes the system easier to manage and update.
const agentManifest = {
  "System & Orchestration": [
    // NOTE: EnhancedCoreAgent deprecated - now using EnhancedLangChainCoreAgent
    { name: 'MCPCoordinatorAgent', path: './system/MCPCoordinatorAgent' }
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
    { name: 'ToolAgent', path: './consciousness/ToolAgent' } // New
  ],
  "Ethics & Safety": [
    { name: 'ConstitutionalAI', path: './ethics/ConstitutionalAI' },
    { name: 'ExistentialCheckIn', path: './ethics/ExistentialCheckIn' },
    { name: 'PrivacyProtectionAgent', path: './ethics/PrivacyProtectionAgent' },
    { name: 'BiasDetectionAgent', path: './ethics/BiasDetectionAgent' },
    { name: 'SecurityAuditAgent', path: './security/SecurityAuditAgent' }
  ],
  "Memory & Learning": [
    { name: 'ConversationStore', path: './memory/ConversationStore' },
    { name: 'UserProfile', path: './memory/UserProfile' },
    { name: 'KnowledgeGraphAgent', path: './memory/KnowledgeGraphAgent' },
    { name: 'LearningAdapterAgent', path: './memory/LearningAdapterAgent' },
    { name: 'ContextMemoryAgent', path: './memory/ContextMemoryAgent' }
  ],
  "Communication & Integration": [
    { name: 'NotificationAgent', path: './communication/NotificationAgent' },
    { name: 'TranslationAgent', path: './communication/TranslationAgent' },
    { name: 'APIGatewayAgent', path: './integration/APIGatewayAgent' }
  ]
};

async function initializeAgents() {
  console.log('[Agent Initializer] 🚀 Activating Cartrita AGI System...');
  
  const loadedAgents = new Set();
  const failedAgents = [];
  let totalAgents = 0;

  // Dynamically load each agent with individual error handling
  for (const category of Object.keys(agentManifest)) {
    console.log(`[Agent Initializer] ⚡ Initializing ${category}...`);
    for (const agent of agentManifest[category]) {
      totalAgents++;
      try {
        // Requiring the file instantiates the singleton agent
        await import(agent.path);
        loadedAgents.add(agent.name);
        console.log(`[Agent Initializer] ✅ ${agent.name} loaded successfully`);
      } catch (error) {
        failedAgents.push({ name: agent.name, error: error.message });
        console.warn(`[Agent Initializer] ⚠️  ${agent.name} failed to load: ${error.message}`);
      }
    }
  }

  // Final status report
  console.log(`[Agent Initializer] 📊 Initialization Complete:`);
  console.log(`  ✅ Successfully loaded: ${loadedAgents.size}/${totalAgents} agents`);
  
  if (failedAgents.length > 0) {
    console.log(`  ❌ Failed to load: ${failedAgents.length} agents`);
    failedAgents.forEach(({ name, error }) => {
      console.log(`    - ${name}: ${error}`);
    });
  }

  return {
    loaded: Array.from(loadedAgents),
    failed: failedAgents,
    total: totalAgents,
    success_rate: Math.round((loadedAgents.size / totalAgents) * 100)
  };
}

// Main initialization function for the AGI system
async function initializeAGISystem() {
  console.log('[Agent Initializer] 🧠 Starting Advanced AGI System...');
  
  try {
    // Step 1: Initialize core agents
    const agentResults = await initializeAgents();
    
    // Step 2: System health check (simplified for now)
    const systemHealth = {
      agents_loaded: agentResults.loaded.length,
      agents_failed: agentResults.failed.length,
      system_ready: agentResults.success_rate >= 50, // At least 50% agents must load
      timestamp: new Date().toISOString()
    };

    if (systemHealth.system_ready) {
      console.log('[Agent Initializer] 🎉 AGI system is online and ready!');
    } else {
      console.warn('[Agent Initializer] ⚠️  AGI system partially loaded - some functionality may be limited');
    }

    return {
      status: systemHealth.system_ready ? 'ready' : 'partial',
      agents: agentResults,
      health: systemHealth
    };

  } catch (error) {
    console.error('[Agent Initializer] ❌ Failed to initialize AGI system:', error);
    return {
      status: 'failed',
      error: error.message,
      agents: { loaded: [], failed: [], total: 0 }
    };
  }
}

export default {
  initializeAgents,
  initializeAGISystem,
  agentManifest
};