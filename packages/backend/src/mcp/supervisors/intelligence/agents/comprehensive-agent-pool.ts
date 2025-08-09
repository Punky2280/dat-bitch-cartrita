/**
 * @fileoverview Comprehensive Agent Pool - Wraps all existing backend agents
 * Provides unified access to all 40+ agents in the Cartrita system
 */

import { Logger, TaskRequest, TaskResponse, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Agent category interfaces
export interface AgentConfig {
  openai?: {
    apiKey?: string;
    organization?: string;
    model?: string;
  };
  anthropic?: {
    apiKey?: string;
    model?: string;
  };
  database?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  };
  searchEngines?: {
    tavilyApiKey?: string;
    serpApiKey?: string;
    gnewsApiKey?: string;
  };
  services?: {
    deepgramApiKey?: string;
    huggingfaceApiKey?: string;
    wolframApiKey?: string;
  };
}

/**
 * Comprehensive wrapper for all backend agents organized by category
 */
export class ComprehensiveAgentPool {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('comprehensive-agent-pool');
  private readonly agentInstances = new Map<string, any>();
  private isInitialized = false;

  // Agent categories
  private readonly agentCategories = {
    consciousness: [
      'AnalyticsAgent',
      'ArtistAgent', 
      'CodeWriterAgent',
      'ComedianAgent',
      'CoreAgent',
      'DesignAgent',
      'EmotionalIntelligenceAgent',
      'EnhancedLangChainCoreAgent',
      'GitHubSearchAgent',
      'MultiModalFusionAgent',
      'PersonalizationAgent',
      'ResearcherAgent',
      'SchedulerAgent',
      'TaskManagementAgent',
      'ToolAgent',
      'WriterAgent'
    ],
    memory: [
      'ContextMemoryAgent',
      'ConversationStore',
      'KnowledgeGraphAgent',
      'LearningAdapterAgent',
      'UserProfile'
    ],
    communication: [
      'NotificationAgent',
      'TranslationAgent'
    ],
    ethics: [
      'BiasDetectionAgent',
      'ConstitutionalAI',
      'ExistentialCheckIn',
      'PrivacyProtectionAgent'
    ],
    integration: [
      'APIGatewayAgent'
    ],
    system: [
      'EnhancedMCPCoordinator',
      'MCPCoordinatorAgent',
      'TelemetryAgent'
    ],
    security: [
      'SecurityAuditAgent'
    ],
    orchestration: [
      'Advanced2025MCPOrchestrator',
      'AgentToolRegistry',
      'EnhancedLangChainOrchestrator',
      'EnhancedLangChainToolRegistry',
      'FullyFunctionalToolRegistry'
    ]
  };

  constructor(private config: AgentConfig = {}) {
    this.logger = Logger.create('ComprehensiveAgentPool');
  }

  /**
   * Initialize all agent categories
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const span = this.tracer.startSpan('agent-pool.initialize');

    try {
      this.logger.info('Initializing comprehensive agent pool...');

      // Initialize agents by category
      await this.initializeConsciousnessAgents();
      await this.initializeMemoryAgents();
      await this.initializeCommunicationAgents();
      await this.initializeEthicsAgents();
      await this.initializeIntegrationAgents();
      await this.initializeSystemAgents();
      await this.initializeSecurityAgents();
      await this.initializeOrchestrationAgents();

      this.isInitialized = true;
      this.logger.info(`Initialized ${this.agentInstances.size} agents successfully`);

    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to initialize agent pool', error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize consciousness agents
   */
  private async initializeConsciousnessAgents(): Promise<void> {
    // Use the local agent wrappers instead of dynamic imports to backend
    const { WriterAgent } = await import('./writer-agent.js');
    const { CodeWriterAgent } = await import('./codewriter-agent.js'); 
    const { AnalyticsAgent } = await import('./analytics-agent.js');
    const { ResearchAgent } = await import('./research-agent.js');
    const { LangChainAgentExecutor } = await import('./langchain-executor.js');
    const { HuggingFaceLanguageAgent } = await import('./huggingface-language.js');

    try {
      // Initialize core agents
      this.agentInstances.set('writeragent', {
        name: 'WriterAgent',
        instance: new WriterAgent(this.config),
        category: 'consciousness',
        initialized: false
      });

      this.agentInstances.set('codewriteragent', {
        name: 'CodeWriterAgent', 
        instance: new CodeWriterAgent(this.config),
        category: 'consciousness',
        initialized: false
      });

      this.agentInstances.set('analyticsagent', {
        name: 'AnalyticsAgent',
        instance: new AnalyticsAgent(this.config),
        category: 'consciousness',
        initialized: false
      });

      this.agentInstances.set('researchagent', {
        name: 'ResearchAgent',
        instance: new ResearchAgent(this.config),
        category: 'consciousness', 
        initialized: false
      });

      this.agentInstances.set('langchainagent', {
        name: 'LangChainAgentExecutor',
        instance: new LangChainAgentExecutor(this.config),
        category: 'consciousness',
        initialized: false
      });

      this.agentInstances.set('huggingfaceagent', {
        name: 'HuggingFaceLanguageAgent',
        instance: new HuggingFaceLanguageAgent(this.config),
        category: 'consciousness',
        initialized: false
      });

      // Initialize all agents
      for (const [key, wrapper] of this.agentInstances.entries()) {
        if (wrapper.category === 'consciousness' && !wrapper.initialized) {
          try {
            if (typeof wrapper.instance.initialize === 'function') {
              await wrapper.instance.initialize();
            }
            wrapper.initialized = true;
            this.logger.debug(`Initialized agent: ${wrapper.name}`);
          } catch (error) {
            this.logger.warn(`Failed to initialize agent ${wrapper.name}`, error as Error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error initializing consciousness agents', error as Error);
    }
  }

  /**
   * Initialize memory agents
   */
  private async initializeMemoryAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('ContextMemoryAgent', () => import('../../../../backend/src/agi/memory/ContextMemoryAgent.js')),
      this.initializeAgent('ConversationStore', () => import('../../../../backend/src/agi/memory/ConversationStore.js')),
      this.initializeAgent('KnowledgeGraphAgent', () => import('../../../../backend/src/agi/memory/KnowledgeGraphAgent.js')),
      this.initializeAgent('LearningAdapterAgent', () => import('../../../../backend/src/agi/memory/LearningAdapterAgent.js')),
      this.initializeAgent('UserProfile', () => import('../../../../backend/src/agi/memory/UserProfile.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize communication agents
   */
  private async initializeCommunicationAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('NotificationAgent', () => import('../../../../backend/src/agi/communication/NotificationAgent.js')),
      this.initializeAgent('TranslationAgent', () => import('../../../../backend/src/agi/communication/TranslationAgent.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize ethics agents
   */
  private async initializeEthicsAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('BiasDetectionAgent', () => import('../../../../backend/src/agi/ethics/BiasDetectionAgent.js')),
      this.initializeAgent('ConstitutionalAI', () => import('../../../../backend/src/agi/ethics/ConstitutionalAI.js')),
      this.initializeAgent('ExistentialCheckIn', () => import('../../../../backend/src/agi/ethics/ExistentialCheckIn.js')),
      this.initializeAgent('PrivacyProtectionAgent', () => import('../../../../backend/src/agi/ethics/PrivacyProtectionAgent.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize integration agents
   */
  private async initializeIntegrationAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('APIGatewayAgent', () => import('../../../../backend/src/agi/integration/APIGatewayAgent.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize system agents
   */
  private async initializeSystemAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('EnhancedMCPCoordinator', () => import('../../../../backend/src/agi/system/EnhancedMCPCoordinator.js')),
      this.initializeAgent('MCPCoordinatorAgent', () => import('../../../../backend/src/agi/system/MCPCoordinatorAgent.js')),
      this.initializeAgent('TelemetryAgent', () => import('../../../../backend/src/agi/system/TelemetryAgent.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize security agents
   */
  private async initializeSecurityAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('SecurityAuditAgent', () => import('../../../../backend/src/agi/security/SecurityAuditAgent.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Initialize orchestration agents
   */
  private async initializeOrchestrationAgents(): Promise<void> {
    const agentInits = [
      this.initializeAgent('Advanced2025MCPOrchestrator', () => import('../../../../backend/src/agi/orchestration/Advanced2025MCPOrchestrator.js')),
      this.initializeAgent('AgentToolRegistry', () => import('../../../../backend/src/agi/orchestration/AgentToolRegistry.js')),
      this.initializeAgent('EnhancedLangChainOrchestrator', () => import('../../../../backend/src/agi/orchestration/EnhancedLangChainOrchestrator.js')),
      this.initializeAgent('EnhancedLangChainToolRegistry', () => import('../../../../backend/src/agi/orchestration/EnhancedLangChainToolRegistry.js')),
      this.initializeAgent('FullyFunctionalToolRegistry', () => import('../../../../backend/src/agi/orchestration/FullyFunctionalToolRegistry.js'))
    ];

    await Promise.allSettled(agentInits);
  }

  /**
   * Generic agent initializer
   */
  private async initializeAgent(agentName: string, importFn: () => Promise<any>): Promise<void> {
    try {
      const module = await importFn();
      const AgentClass = module[agentName] || module.default || module;
      
      if (!AgentClass) {
        this.logger.warn(`Agent class not found for ${agentName}`);
        return;
      }

      // Create agent instance with appropriate config
      const agentConfig = this.getAgentSpecificConfig(agentName);
      const agentInstance = new AgentClass(agentConfig);

      // Initialize if it has an initialize method
      if (typeof agentInstance.initialize === 'function') {
        await agentInstance.initialize();
      }

      this.agentInstances.set(agentName.toLowerCase(), {
        name: agentName,
        instance: agentInstance,
        category: this.getAgentCategory(agentName),
        initialized: true
      });

      this.logger.debug(`Initialized agent: ${agentName}`);
    } catch (error) {
      this.logger.warn(`Failed to initialize agent ${agentName}`, error as Error);
    }
  }

  /**
   * Get agent-specific configuration
   */
  private getAgentSpecificConfig(agentName: string): any {
    const baseConfig = {
      openaiApiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY,
      anthropicApiKey: this.config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
    };

    // Add specific configs based on agent type
    switch (agentName.toLowerCase()) {
      case 'analyticsagent':
        return {
          ...baseConfig,
          database: this.config.database,
        };
      case 'researcheragent':
        return {
          ...baseConfig,
          searchEngines: this.config.searchEngines,
        };
      case 'multimodalfusionagent':
        return {
          ...baseConfig,
          services: this.config.services,
        };
      default:
        return baseConfig;
    }
  }

  /**
   * Get agent category
   */
  private getAgentCategory(agentName: string): string {
    for (const [category, agents] of Object.entries(this.agentCategories)) {
      if (agents.includes(agentName)) {
        return category;
      }
    }
    return 'unknown';
  }

  /**
   * Route task to appropriate agent
   */
  async execute(request: TaskRequest, context: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('agent-pool.execute', {
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });

    const startTime = performance.now();

    try {
      // Determine which agent should handle this task
      const agentName = this.getAgentForTaskType(request.taskType);
      const agentWrapper = this.agentInstances.get(agentName);

      if (!agentWrapper) {
        throw new Error(`No agent available for task type: ${request.taskType}`);
      }

      this.logger.info('Routing task to agent', {
        taskId: request.taskId,
        taskType: request.taskType,
        agent: agentWrapper.name,
        category: agentWrapper.category,
      });

      // Execute task with the agent
      let result: any;
      const agent = agentWrapper.instance;

      if (typeof agent.execute === 'function') {
        result = await agent.execute(request, context);
      } else if (typeof agent.processTask === 'function') {
        result = await agent.processTask(request, context);
      } else {
        // Try to map task type to agent methods
        result = await this.executeTaskWithAgentMethods(agent, request, context);
      }

      const processingTime = performance.now() - startTime;

      return {
        taskId: request.taskId,
        status: TaskStatus.COMPLETED,
        result,
        metrics: {
          processingTimeMs: Math.round(processingTime),
          queueTimeMs: 0,
          retryCount: 0,
          costUsd: this.estimateCost(request.taskType),
          tokensUsed: this.estimateTokens(result),
          customMetrics: {
            agentName: agentWrapper.name,
            agentCategory: agentWrapper.category,
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      span.recordException(error as Error);
      this.logger.error('Agent execution failed', error as Error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });

      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
        errorCode: 'AGENT_EXECUTION_ERROR',
        metrics: {
          processingTimeMs: Math.round(processingTime),
          queueTimeMs: 0,
          retryCount: 0,
          costUsd: 0,
          tokensUsed: 0,
          customMetrics: {},
        },
        warnings: [],
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get appropriate agent for task type
   */
  private getAgentForTaskType(taskType: string): string {
    const taskToAgentMap: Record<string, string> = {
      // Analytics tasks
      'analytics.data.query': 'analyticsagent',
      'analytics.report.generate': 'analyticsagent',
      'analytics.metrics.calculate': 'analyticsagent',
      'analytics.trend.analyze': 'analyticsagent',

      // Research tasks
      'research.web.search': 'researcheragent',
      'research.web.scrape': 'researcheragent',
      'research.github.search': 'githubsearchagent',

      // Writing tasks
      'writer.content.create': 'writeragent',
      'writer.content.edit': 'writeragent',
      'writer.blog.post': 'writeragent',

      // Code tasks
      'codewriter.generate.function': 'codewriteragent',
      'codewriter.refactor.code': 'codewriteragent',
      'codewriter.fix.bugs': 'codewriteragent',

      // Art tasks
      'artist.generate_image': 'artistagent',
      'artist.edit_image': 'artistagent',

      // Design tasks
      'design.create_layout': 'designagent',
      'design.optimize_ui': 'designagent',

      // Memory tasks
      'memory.store_context': 'contextmemoryagent',
      'memory.retrieve_context': 'contextmemoryagent',
      'knowledge.query': 'knowledgegrapragent',
      'knowledge.update': 'knowledgegrapragent',

      // Communication tasks
      'notification.send': 'notificationagent',
      'translation.translate_text': 'translationagent',

      // Scheduling tasks
      'scheduler.create_task': 'scheduleragent',
      'scheduler.update_task': 'scheduleragent',

      // Task management
      'task.create': 'taskmanagementagent',
      'task.update': 'taskmanagementagent',
      'task.complete': 'taskmanagementagent',

      // Multimodal tasks
      'multimodal.fuse': 'multimodalfusionagent',
      'multimodal.analyze': 'multimodalfusionagent',

      // LangChain tasks
      'langchain.agent.execute': 'enhancedlangchaincoreagent',
      'langchain.chat.execute': 'enhancedlangchaincoreagent',
      'langchain.react.execute': 'enhancedlangchaincoreagent',

      // Security tasks
      'security.audit': 'securityauditagent',
      'security.scan': 'securityauditagent',

      // Privacy tasks
      'privacy.check': 'privacyprotectionagent',
      'bias.detect': 'biasdetectionagent',

      // Default fallback
      'default': 'coreagent',
    };

    return taskToAgentMap[taskType] || taskToAgentMap['default'];
  }

  /**
   * Execute task with agent methods
   */
  private async executeTaskWithAgentMethods(agent: any, request: TaskRequest, context: any): Promise<any> {
    // Try common method patterns
    const methodPatterns = [
      `handle${this.capitalize(request.taskType.split('.').pop() || '')}`,
      `process${this.capitalize(request.taskType.split('.').pop() || '')}`,
      request.taskType.replace(/\./g, '_'),
      'processRequest',
      'handleRequest',
    ];

    for (const methodName of methodPatterns) {
      if (typeof agent[methodName] === 'function') {
        return await agent[methodName](request.parameters, context);
      }
    }

    throw new Error(`No suitable method found for task type: ${request.taskType}`);
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): string[] {
    return Array.from(this.agentInstances.keys());
  }

  /**
   * Get agent statistics
   */
  getStats(): any {
    const stats = {
      totalAgents: this.agentInstances.size,
      categoriesCount: Object.keys(this.agentCategories).length,
      categories: {} as any,
    };

    for (const [category, agentNames] of Object.entries(this.agentCategories)) {
      const initializedAgents = agentNames.filter(name => 
        this.agentInstances.has(name.toLowerCase())
      );
      
      stats.categories[category] = {
        total: agentNames.length,
        initialized: initializedAgents.length,
        agents: initializedAgents,
      };
    }

    return stats;
  }

  /**
   * Estimate cost for task
   */
  private estimateCost(taskType: string): number {
    const taskCosts: Record<string, number> = {
      'analytics.data.query': 0.01,
      'research.web.search': 0.015,
      'writer.content.create': 0.02,
      'codewriter.generate.function': 0.018,
      'artist.generate_image': 0.05,
      'multimodal.fuse': 0.025,
    };

    return taskCosts[taskType] || 0.01;
  }

  /**
   * Estimate tokens used
   */
  private estimateTokens(result: any): number {
    if (!result) return 0;
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down comprehensive agent pool...');

    for (const [name, wrapper] of this.agentInstances) {
      try {
        if (typeof wrapper.instance.shutdown === 'function') {
          await wrapper.instance.shutdown();
        }
        this.logger.debug(`Shutdown agent: ${wrapper.name}`);
      } catch (error) {
        this.logger.warn(`Error shutting down agent ${wrapper.name}`, error as Error);
      }
    }

    this.agentInstances.clear();
    this.isInitialized = false;
    this.logger.info('Agent pool shutdown complete');
  }
}