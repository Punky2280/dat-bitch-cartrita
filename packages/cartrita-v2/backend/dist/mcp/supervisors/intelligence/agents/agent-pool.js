/**
 * @fileoverview Intelligence Agent Pool
 * Manages and coordinates language processing agents
 */
import { EventEmitter } from 'events';
import { Logger } from '../../core/index.js';
import { LangChainAgentExecutor } from './langchain-executor.js';
import { HuggingFaceLanguageAgent } from './huggingface-language.js';
import { ResearchAgent } from './research-agent.js';
import { WriterAgent } from './writer-agent.js';
import { CodeWriterAgent } from './codewriter-agent.js';
import { AnalyticsAgent } from './analytics-agent.js';
/**
 * Pool of intelligence agents for language processing tasks
 */
export class IntelligenceAgentPool extends EventEmitter {
  logger;
  agents = new Map();
  constructor() {
    super();
    this.logger = Logger.create('IntelligenceAgentPool');
  }
  /**
   * Initialize the agent pool
   */
  async initialize(config) {
    this.logger.info('Initializing Intelligence Agent Pool...');
    try {
      // Initialize LangChain agents
      await this.initializeLangChainAgents(config);
      // Initialize HuggingFace agents
      await this.initializeHuggingFaceAgents(config);
      // Initialize specialized agents
      await this.initializeSpecializedAgents(config);
      this.logger.info('Intelligence Agent Pool initialized', {
        agentCount: this.agents.size,
      });
    } catch (error) {
      this.logger.error('Failed to initialize agent pool', error);
      throw error;
    }
  }
  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId) || null;
  }
  /**
   * Get agents by capability
   */
  getAgentsByCapability(taskType) {
    return Array.from(this.agents.values()).filter(
      agent => agent.capabilities.includes(taskType) && agent.isHealthy
    );
  }
  /**
   * Get available agent with lowest load
   */
  getAvailableAgent(taskType) {
    const candidates = this.getAgentsByCapability(taskType)
      .filter(agent => agent.activeTaskCount < agent.maxConcurrency)
      .sort((a, b) => {
        const loadA = a.activeTaskCount / a.maxConcurrency;
        const loadB = b.activeTaskCount / b.maxConcurrency;
        return loadA - loadB;
      });
    return candidates.length > 0 ? candidates[0] : null;
  }
  /**
   * Get pool status
   */
  async getStatus() {
    return {
      totalAgents: this.agents.size,
      healthyAgents: Array.from(this.agents.values()).filter(a => a.isHealthy)
        .length,
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        isHealthy: agent.isHealthy,
        activeTaskCount: agent.activeTaskCount,
        utilization: agent.activeTaskCount / agent.maxConcurrency,
      })),
    };
  }
  /**
   * Shutdown all agents
   */
  async shutdown() {
    this.logger.info('Shutting down agent pool...');
    for (const agent of this.agents.values()) {
      // Cancel active tasks and cleanup
      agent.activeTaskCount = 0;
      agent.isHealthy = false;
    }
    this.agents.clear();
    this.removeAllListeners();
    this.logger.info('Agent pool shutdown complete');
  }
  async initializeLangChainAgents(config) {
    // LangChain Agent Executor
    const langchainExecutor = new LangChainAgentExecutor(config.openai);
    await langchainExecutor.initialize();
    this.agents.set('langchain-executor', {
      id: 'langchain-executor',
      name: 'LangChain Agent Executor',
      type: 'langchain',
      capabilities: [
        'langchain.agent.execute',
        'langchain.chat.execute',
        'langchain.react.execute',
      ],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 5,
      execute: langchainExecutor.execute.bind(langchainExecutor),
    });
  }
  async initializeHuggingFaceAgents(config) {
    // HuggingFace Language Agent
    const hfLanguageAgent = new HuggingFaceLanguageAgent(config.huggingface);
    await hfLanguageAgent.initialize();
    this.agents.set('language-maestro', {
      id: 'language-maestro',
      name: 'Language Maestro (HuggingFace)',
      type: 'huggingface',
      capabilities: [
        'huggingface.text.generation',
        'huggingface.text.classification',
        'huggingface.text.summarization',
        'huggingface.text.translation',
        'huggingface.text.question_answering',
      ],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 10,
      execute: hfLanguageAgent.execute.bind(hfLanguageAgent),
    });
  }
  async initializeSpecializedAgents(config) {
    // Research Agent
    const researchAgent = new ResearchAgent(config);
    await researchAgent.initialize();
    this.agents.set('researcher', {
      id: 'researcher',
      name: 'Research Agent',
      type: 'specialized',
      capabilities: ['research.web.search', 'research.web.scrape'],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 8,
      execute: researchAgent.execute.bind(researchAgent),
    });
    // Writer Agent
    const writerAgent = new WriterAgent(config);
    await writerAgent.initialize();
    this.agents.set('writer', {
      id: 'writer',
      name: 'Writer Agent',
      type: 'specialized',
      capabilities: ['writer.compose'],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 5,
      execute: writerAgent.execute.bind(writerAgent),
    });
    // Code Writer Agent
    const codeWriterAgent = new CodeWriterAgent(config);
    await codeWriterAgent.initialize();
    this.agents.set('codewriter', {
      id: 'codewriter',
      name: 'Code Writer Agent',
      type: 'specialized',
      capabilities: ['codewriter.generate'],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 3,
      execute: codeWriterAgent.execute.bind(codeWriterAgent),
    });
    // Analytics Agent
    const analyticsAgent = new AnalyticsAgent(config);
    await analyticsAgent.initialize();
    this.agents.set('analytics', {
      id: 'analytics',
      name: 'Analytics Agent',
      type: 'specialized',
      capabilities: ['analytics.run_query'],
      isHealthy: true,
      activeTaskCount: 0,
      maxConcurrency: 5,
      execute: analyticsAgent.execute.bind(analyticsAgent),
    });
  }
}
