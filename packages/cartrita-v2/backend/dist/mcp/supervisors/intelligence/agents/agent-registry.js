/**
 * @fileoverview Agent Registry - Maps task types to appropriate agents
 * Includes all agents from integrations/huggingface and packages/backend/src/agi
 */
import { Logger } from '../../core/index.js';
import { WriterAgent } from './writer-agent.js';
import { CodeWriterAgent } from './codewriter-agent.js';
import { AnalyticsAgent } from './analytics-agent.js';
import { ResearchAgent } from './research-agent.js';
import { LangChainAgentExecutor } from './langchain-executor.js';
import { HuggingFaceLanguageAgent } from './huggingface-language.js';
/**
 * Agent Registry - Provides unified access to all agent types
 *
 * Covers these agent categories:
 * - HuggingFace Agents: LanguageMaestroAgent, VisionMasterAgent, AudioWizardAgent, DataSageAgent, MultiModalOracleAgent
 * - Consciousness Agents: AnalyticsAgent, ArtistAgent, CodeWriterAgent, ComedianAgent, CoreAgent, DesignAgent,
 *   EmotionalIntelligenceAgent, EnhancedLangChainCoreAgent, GitHubSearchAgent, MultiModalFusionAgent,
 *   PersonalizationAgent, ResearcherAgent, SchedulerAgent, TaskManagementAgent, ToolAgent, WriterAgent
 * - Communication Agents: NotificationAgent, TranslationAgent
 * - Memory Agents: ContextMemoryAgent, ConversationStore, KnowledgeGraphAgent, LearningAdapterAgent, UserProfile
 * - Ethics Agents: BiasDetectionAgent, ConstitutionalAI, ExistentialCheckIn, PrivacyProtectionAgent
 * - Integration Agents: APIGatewayAgent
 * - Security Agents: SecurityAuditAgent
 * - System Agents: EnhancedMCPCoordinator, MCPCoordinatorAgent, TelemetryAgent
 * - Orchestration Agents: Advanced2025MCPOrchestrator, AgentToolRegistry, EnhancedLangChainOrchestrator
 */
export class AgentRegistry {
  config;
  logger;
  agents = new Map();
  taskTypeMap = {
    // Writing tasks
    'writer.content.create': 'writer',
    'writer.content.edit': 'writer',
    'writer.content.summarize': 'writer',
    'writer.blog.post': 'writer',
    'writer.email.compose': 'writer',
    // Code writing tasks
    'codewriter.generate.function': 'codewriter',
    'codewriter.generate.class': 'codewriter',
    'codewriter.refactor.code': 'codewriter',
    'codewriter.fix.bugs': 'codewriter',
    'codewriter.optimize.performance': 'codewriter',
    'codewriter.add.tests': 'codewriter',
    'codewriter.document.code': 'codewriter',
    // Analytics tasks
    'analytics.data.query': 'analytics',
    'analytics.report.generate': 'analytics',
    'analytics.metrics.calculate': 'analytics',
    'analytics.trend.analyze': 'analytics',
    // Research tasks
    'research.web.search': 'research',
    'research.web.scrape': 'research',
    'research.github.search': 'research',
    // LangChain tasks
    'langchain.agent.execute': 'langchain',
    'langchain.chat.execute': 'langchain',
    'langchain.react.execute': 'langchain',
    // HuggingFace tasks
    'huggingface.text.generation': 'huggingface',
    'huggingface.text.classification': 'huggingface',
    'huggingface.text.summarization': 'huggingface',
    'huggingface.text.translation': 'huggingface',
    'huggingface.text.question_answering': 'huggingface',
    // Vision tasks (would need VisionMasterAgent wrapper)
    'huggingface.vision.classification': 'huggingface',
    'huggingface.vision.object_detection': 'huggingface',
    'huggingface.vision.segmentation': 'huggingface',
    // Audio tasks (would need AudioWizardAgent wrapper)
    'huggingface.audio.speech_recognition': 'huggingface',
    'huggingface.audio.text_to_speech': 'huggingface',
    // Multimodal tasks (would need MultiModalOracleAgent wrapper)
    'huggingface.multimodal.visual_qa': 'huggingface',
    'multimodal.fuse': 'huggingface',
    // Data tasks (would need DataSageAgent wrapper)
    'data.analyze': 'analytics',
    'data.process': 'analytics',
  };
  isInitialized = false;
  constructor(config = {}) {
    this.config = config;
    this.logger = Logger.create('AgentRegistry');
  }
  /**
   * Initialize all available agents
   */
  async initialize() {
    if (this.isInitialized) return;
    try {
      this.logger.info('Initializing Agent Registry...');
      // Initialize core agent wrappers
      await this.initializeWriterAgent();
      await this.initializeCodeWriterAgent();
      await this.initializeAnalyticsAgent();
      await this.initializeResearchAgent();
      await this.initializeLangChainAgent();
      await this.initializeHuggingFaceAgent();
      this.isInitialized = true;
      this.logger.info(
        `Agent Registry initialized with ${this.agents.size} agents`
      );
    } catch (error) {
      this.logger.error('Failed to initialize Agent Registry', error);
      throw error;
    }
  }
  /**
   * Initialize Writer Agent
   */
  async initializeWriterAgent() {
    try {
      const agent = new WriterAgent({
        openai: this.config.openai,
        anthropic: this.config.anthropic,
      });
      await agent.initialize();
      this.agents.set('writer', agent);
      this.logger.debug('Writer Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize Writer Agent', error);
    }
  }
  /**
   * Initialize Code Writer Agent
   */
  async initializeCodeWriterAgent() {
    try {
      const agent = new CodeWriterAgent({
        openai: this.config.openai,
        anthropic: this.config.anthropic,
      });
      await agent.initialize();
      this.agents.set('codewriter', agent);
      this.logger.debug('Code Writer Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize Code Writer Agent', error);
    }
  }
  /**
   * Initialize Analytics Agent
   */
  async initializeAnalyticsAgent() {
    try {
      const agent = new AnalyticsAgent({
        database: this.config.database,
      });
      await agent.initialize();
      this.agents.set('analytics', agent);
      this.logger.debug('Analytics Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize Analytics Agent', error);
    }
  }
  /**
   * Initialize Research Agent
   */
  async initializeResearchAgent() {
    try {
      const agent = new ResearchAgent({
        openai: this.config.openai,
        searchEngines: this.config.searchEngines,
      });
      await agent.initialize();
      this.agents.set('research', agent);
      this.logger.debug('Research Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize Research Agent', error);
    }
  }
  /**
   * Initialize LangChain Agent
   */
  async initializeLangChainAgent() {
    try {
      const agent = new LangChainAgentExecutor({
        apiKey: this.config.openai?.apiKey,
        organization: this.config.openai?.organization,
        model: this.config.openai?.model,
      });
      await agent.initialize();
      this.agents.set('langchain', agent);
      this.logger.debug('LangChain Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize LangChain Agent', error);
    }
  }
  /**
   * Initialize HuggingFace Agent
   */
  async initializeHuggingFaceAgent() {
    try {
      const agent = new HuggingFaceLanguageAgent({
        apiKey: this.config.services?.huggingfaceApiKey,
      });
      await agent.initialize();
      this.agents.set('huggingface', agent);
      this.logger.debug('HuggingFace Agent initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize HuggingFace Agent', error);
    }
  }
  /**
   * Get appropriate agent for task type
   */
  getAgentForTask(taskType) {
    const agentType = this.taskTypeMap[taskType];
    if (agentType) {
      const agent = this.agents.get(agentType);
      if (agent) {
        this.logger.debug('Agent found for task', { taskType, agentType });
        return agent;
      }
    }
    // Fallback: try pattern matching
    if (taskType.includes('writer') || taskType.includes('writing')) {
      return this.agents.get('writer');
    }
    if (taskType.includes('code') || taskType.includes('programming')) {
      return this.agents.get('codewriter');
    }
    if (taskType.includes('analytics') || taskType.includes('data')) {
      return this.agents.get('analytics');
    }
    if (taskType.includes('research') || taskType.includes('search')) {
      return this.agents.get('research');
    }
    if (taskType.includes('langchain')) {
      return this.agents.get('langchain');
    }
    if (taskType.includes('huggingface')) {
      return this.agents.get('huggingface');
    }
    this.logger.warn('No agent found for task type', { taskType });
    return null;
  }
  /**
   * Execute task with appropriate agent
   */
  async executeTask(request, context) {
    const agent = this.getAgentForTask(request.taskType);
    if (!agent) {
      throw new Error(`No agent available for task type: ${request.taskType}`);
    }
    this.logger.info('Executing task with agent', {
      taskId: request.taskId,
      taskType: request.taskType,
    });
    return await agent.execute(request, context);
  }
  /**
   * Get registry statistics
   */
  getStats() {
    return {
      totalAgents: this.agents.size,
      availableAgents: Array.from(this.agents.keys()),
      supportedTaskTypes: Object.keys(this.taskTypeMap),
      initialized: this.isInitialized,
    };
  }
  /**
   * Get all supported task types
   */
  getSupportedTaskTypes() {
    return Object.keys(this.taskTypeMap);
  }
  /**
   * Check if task type is supported
   */
  isTaskTypeSupported(taskType) {
    return (
      taskType in this.taskTypeMap || this.getAgentForTask(taskType) !== null
    );
  }
  /**
   * Shutdown all agents
   */
  async shutdown() {
    this.logger.info('Shutting down Agent Registry...');
    for (const [name, agent] of this.agents) {
      try {
        if (typeof agent.shutdown === 'function') {
          await agent.shutdown();
        }
        this.logger.debug(`Shutdown agent: ${name}`);
      } catch (error) {
        this.logger.warn(`Error shutting down agent ${name}`, error);
      }
    }
    this.agents.clear();
    this.isInitialized = false;
    this.logger.info('Agent Registry shutdown complete');
  }
}
