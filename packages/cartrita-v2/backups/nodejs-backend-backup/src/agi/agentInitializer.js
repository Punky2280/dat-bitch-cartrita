/* global console, require, module */
// packages/backend/src/agi/agentInitializer.js

/**
 * Agent Initializer v2.1 - Dynamic initialization and registration
 * Loads all AGI agents from the manifest and registers them with the MCP system
 */

import path from 'path';
import SupervisorRegistry from '../system/SupervisorRegistry.js';
import Advanced2025MCPInitializer from './orchestration/Advanced2025MCPInitializer.js';

// A manifest of all agents to be loaded, organized by category.
// This makes the system easier to manage and update.
const agentManifest = {
  'System & Orchestration': [
    // NOTE: EnhancedCoreAgent deprecated - now using EnhancedLangChainCoreAgent
    { name: 'MCPCoordinatorAgent', path: './system/MCPCoordinatorAgent.js' },
    {
      name: 'EnhancedMCPCoordinator',
      path: './system/EnhancedMCPCoordinator.js',
    }, // Iteration 22
    {
      name: 'Advanced2025MCPOrchestrator',
      path: './orchestration/Advanced2025MCPOrchestrator.js',
    }, // 2025 MCP Protocol
  ],
  'Consciousness Agents': [
    { name: 'CodeWriterAgent', path: './consciousness/CodeWriterAgent.js' },
    { name: 'SchedulerAgent', path: './consciousness/SchedulerAgent.js' },
    { name: 'ArtistAgent', path: './consciousness/ArtistAgent.js' },
    { name: 'WriterAgent', path: './consciousness/WriterAgent.js' },
    { name: 'ResearcherAgent', path: './consciousness/ResearcherAgent.js' },
    { name: 'ComedianAgent', path: './consciousness/ComedianAgent.js' },
    {
      name: 'EmotionalIntelligenceAgent',
      path: './consciousness/EmotionalIntelligenceAgent.js',
    },
    {
      name: 'TaskManagementAgent',
      path: './consciousness/TaskManagementAgent.js',
    },
    { name: 'AnalyticsAgent', path: './consciousness/AnalyticsAgent.js' },
    { name: 'DesignAgent', path: './consciousness/DesignAgent.js' },
    {
      name: 'PersonalizationAgent',
      path: './consciousness/PersonalizationAgent.js',
    },
    { name: 'GitHubSearchAgent', path: './consciousness/GitHubSearchAgent.js' },
    { name: 'ToolAgent', path: './consciousness/ToolAgent.js' },
    {
      name: 'MultiModalFusionAgent',
      path: './consciousness/MultiModalFusionAgent.js',
    }, // Multi-modal processing
  ],
  'Ethics & Safety': [
    { name: 'ConstitutionalAI', path: './ethics/ConstitutionalAI.js' },
    { name: 'ExistentialCheckIn', path: './ethics/ExistentialCheckIn.js' },
    {
      name: 'PrivacyProtectionAgent',
      path: './ethics/PrivacyProtectionAgent.js',
    },
    { name: 'BiasDetectionAgent', path: './ethics/BiasDetectionAgent.js' },
    { name: 'SecurityAuditAgent', path: './security/SecurityAuditAgent.js' },
  ],
  'Memory & Learning': [
    { name: 'ConversationStore', path: './memory/ConversationStore.js' },
    { name: 'UserProfile', path: './memory/UserProfile.js' },
    { name: 'KnowledgeGraphAgent', path: './memory/KnowledgeGraphAgent.js' },
    { name: 'LearningAdapterAgent', path: './memory/LearningAdapterAgent.js' },
    { name: 'ContextMemoryAgent', path: './memory/ContextMemoryAgent.js' },
  ],
  'Communication & Integration': [
    { name: 'NotificationAgent', path: './communication/NotificationAgent.js' },
    { name: 'TranslationAgent', path: './communication/TranslationAgent.js' },
    { name: 'APIGatewayAgent', path: './integration/APIGatewayAgent.js' },
  ],
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
        const agentModule = await import(agent.path);
        const agentInstance = agentModule.default;

        // Register agent instance with SupervisorRegistry
        if (agentInstance) {
          SupervisorRegistry.registerAgentInstance(agent.name, agentInstance);
        }

        loadedAgents.add(agent.name);
        console.log(`[Agent Initializer] ✅ ${agent.name} loaded successfully`);
      } catch (error) {
        failedAgents.push({ name: agent.name, error: error.message });
        console.warn(
          `[Agent Initializer] ⚠️  ${agent.name} failed to load: ${error.message}`
        );
      }
    }
  }

  // Final status report
  console.log(`[Agent Initializer] 📊 Initialization Complete:`);
  console.log(
    `  ✅ Successfully loaded: ${loadedAgents.size}/${totalAgents} agents`
  );

  if (failedAgents.length > 0) {
    console.log(`  ❌ Failed to load: ${failedAgents.length} agents`);
    failedAgents.forEach(({ name, error }) => {
      console.log(`    - ${name}: ${error}`);
    });
  }

  // Display hierarchical supervisor status
  const hierarchyStatus = SupervisorRegistry.getHierarchyStatus();
  console.log(`[Agent Initializer] 🏛️ Hierarchical Structure:`);
  console.log(`  📊 Categories: ${hierarchyStatus.categories.length}`);
  console.log(`  👑 Supervisors: ${hierarchyStatus.supervisors.length}`);
  console.log(`  🤖 Total agents: ${hierarchyStatus.total_agents}`);
  console.log(
    `  🔗 Registered instances: ${hierarchyStatus.registered_instances}`
  );

  return {
    loaded: Array.from(loadedAgents),
    failed: failedAgents,
    total: totalAgents,
    success_rate: Math.round((loadedAgents.size / totalAgents) * 100),
    hierarchy: hierarchyStatus,
  };
}

// Main initialization function for the AGI system
async function initializeAGISystem() {
  console.log('[Agent Initializer] 🧠 Starting Advanced AGI System...');

  try {
    // Step 1: Initialize core agents
    const agentResults = await initializeAgents();

    // Step 2: Initialize Advanced 2025 MCP Orchestrator
    console.log(
      '[Agent Initializer] 🌟 Integrating with Advanced 2025 MCP Orchestrator...'
    );
    let mcpOrchestrator = null;
    let mcpStatus = 'not_initialized';

    try {
      mcpOrchestrator = Advanced2025MCPInitializer.getOrchestrator();
      if (mcpOrchestrator && mcpOrchestrator.initialized) {
        console.log(
          '[Agent Initializer] ✅ Advanced 2025 MCP Orchestrator integration successful'
        );
        mcpStatus = 'integrated';

        // Register all loaded agents with the Advanced MCP Orchestrator
        for (const agentName of agentResults.loaded) {
          const agentInstance = SupervisorRegistry.getAgentInstance(agentName);
          if (agentInstance && mcpOrchestrator.agents) {
            mcpOrchestrator.agents.set(agentName, agentInstance);
            console.log(
              `[Agent Initializer] 📡 Registered ${agentName} with Advanced MCP Orchestrator`
            );
          }
        }
      }
    } catch (mcpError) {
      console.warn(
        '[Agent Initializer] ⚠️ Advanced 2025 MCP integration failed:',
        mcpError.message
      );
      mcpStatus = 'failed';
    }

    // Step 3: Enhanced system health check with MCP integration
    const systemHealth = {
      agents_loaded: agentResults.loaded.length,
      agents_failed: agentResults.failed.length,
      system_ready: agentResults.success_rate >= 50, // At least 50% agents must load
      mcp_orchestrator_status: mcpStatus,
      advanced_features_enabled: mcpStatus === 'integrated',
      timestamp: new Date().toISOString(),
    };

    if (systemHealth.system_ready && systemHealth.advanced_features_enabled) {
      console.log(
        '[Agent Initializer] 🎉 Advanced 2025 MCP AGI system is online with cutting-edge features!'
      );
    } else if (systemHealth.system_ready) {
      console.log(
        '[Agent Initializer] ✅ AGI system is online (fallback mode - advanced features unavailable)'
      );
    } else {
      console.warn(
        '[Agent Initializer] ⚠️  AGI system partially loaded - some functionality may be limited'
      );
    }

    return {
      status: systemHealth.system_ready
        ? systemHealth.advanced_features_enabled
          ? 'advanced'
          : 'ready'
        : 'partial',
      agents: agentResults,
      health: systemHealth,
      mcp_orchestrator: mcpOrchestrator
        ? {
            version: '2025-06-18',
            features: [
              'swarm_intelligence',
              'self_improving_agents',
              'maestro_security',
              'observability_tracing',
              'semantic_caching',
              'immutable_audit_trails',
            ],
          }
        : null,
    };
  } catch (error) {
    console.error(
      '[Agent Initializer] ❌ Failed to initialize AGI system:',
      error
    );
    return {
      status: 'failed',
      error: error.message,
      agents: { loaded: [], failed: [], total: 0 },
    };
  }
}

export default {
  initializeAgents,
  initializeAGISystem,
  agentManifest,
};
