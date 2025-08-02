// packages/backend/src/agi/orchestration/AgentToolRegistry.js

/**
 * Registry that converts existing Cartrita agents into LangChain tools
 */

class AgentToolRegistry {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.registeredAgents = new Map();
  }

  /**
   * Register all available agents as LangChain tools
   */
  async registerAllAgents() {
    try {
      // Import all agents
      const researcherAgent = require('../consciousness/ResearcherAgent');
      const writerAgent = require('../consciousness/WriterAgent');
      const comedianAgent = require('../consciousness/ComedianAgent');
      const artistAgent = require('../consciousness/ArtistAgent');
      const codeWriterAgent = require('../consciousness/CodeWriterAgent');
      const emotionalIntelligenceAgent = require('../consciousness/EmotionalIntelligenceAgent');
      const taskManagementAgent = require('../consciousness/TaskManagementAgent');
      const schedulerAgent = require('../consciousness/SchedulerAgent');
      const githubSearchAgent = require('../consciousness/GitHubSearchAgent');
      const personalizationAgent = require('../consciousness/PersonalizationAgent');
      const multiModalFusionAgent = require('../consciousness/MultiModalFusionAgent');

      // Register research tools
      this.registerAgent(
        'research_web',
        'Search the web for current information, news, and research on any topic',
        researcherAgent
      );

      // Register writing tools
      this.registerAgent(
        'write_content',
        'Create written content like articles, stories, emails, or any text-based content',
        writerAgent
      );

      // Register humor tools
      this.registerAgent(
        'create_humor',
        'Generate jokes, funny content, or humorous responses about any topic',
        comedianAgent
      );

      // Register creative tools
      this.registerAgent(
        'create_art',
        'Generate artistic content, creative writing, or visual art descriptions',
        artistAgent
      );

      // Register coding tools
      this.registerAgent(
        'write_code',
        'Write, debug, or explain code in any programming language',
        codeWriterAgent
      );

      // Register emotional support
      this.registerAgent(
        'emotional_support',
        'Provide emotional support, empathy, and wellness guidance',
        emotionalIntelligenceAgent
      );

      // Register task management
      this.registerAgent(
        'manage_tasks',
        'Help organize, prioritize, and manage tasks and projects',
        taskManagementAgent
      );

      // Register scheduling
      this.registerAgent(
        'schedule_events',
        'Help with scheduling, calendar management, and time organization',
        schedulerAgent
      );

      // Register GitHub search
      this.registerAgent(
        'search_github',
        'Search GitHub repositories, code, and developer resources',
        githubSearchAgent
      );

      // Register personalization
      this.registerAgent(
        'personalize_response',
        'Adapt responses based on user preferences and interaction history',
        personalizationAgent
      );

      // Register multi-modal processing
      this.registerAgent(
        'process_multimodal',
        'Process and analyze multiple types of content (text, audio, visual)',
        multiModalFusionAgent
      );

      console.log(`[AgentToolRegistry] Registered ${this.registeredAgents.size} agents as LangChain tools`);
      return true;

    } catch (error) {
      console.error('[AgentToolRegistry] Failed to register agents:', error);
      return false;
    }
  }

  /**
   * Register a single agent as a LangChain tool
   */
  registerAgent(toolName, description, agentInstance) {
    try {
      this.orchestrator.addTool(toolName, description, agentInstance);
      this.registeredAgents.set(toolName, {
        description,
        agent: agentInstance,
        registered_at: new Date().toISOString()
      });
      
      console.log(`[AgentToolRegistry] Registered: ${toolName}`);
    } catch (error) {
      console.error(`[AgentToolRegistry] Failed to register ${toolName}:`, error);
    }
  }

  /**
   * Get list of all registered tools
   */
  getRegisteredTools() {
    return Array.from(this.registeredAgents.entries()).map(([name, info]) => ({
      name,
      description: info.description,
      registered_at: info.registered_at
    }));
  }

  /**
   * Check if an agent is registered
   */
  isRegistered(toolName) {
    return this.registeredAgents.has(toolName);
  }

  /**
   * Get agent instance by tool name
   */
  getAgent(toolName) {
    const registration = this.registeredAgents.get(toolName);
    return registration ? registration.agent : null;
  }

  /**
   * Unregister a tool
   */
  unregisterAgent(toolName) {
    if (this.registeredAgents.has(toolName)) {
      this.registeredAgents.delete(toolName);
      // Note: LangChain doesn't have a direct way to remove tools from executor
      // Would need to recreate the executor to remove tools
      console.log(`[AgentToolRegistry] Unregistered: ${toolName}`);
      return true;
    }
    return false;
  }

  /**
   * Get registry status
   */
  getStatus() {
    return {
      total_registered: this.registeredAgents.size,
      tools: this.getRegisteredTools(),
      last_updated: new Date().toISOString()
    };
  }
}

module.exports = AgentToolRegistry;