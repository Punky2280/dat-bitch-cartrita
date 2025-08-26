/**
 * Integrated AI Service
 *
 * Main orchestrator that brings together the Model Registry, Workflow Engine,
 * and Knowledge Hub to create a unified AI system with intelligent model
 * selection, cost optimization, and RAG capabilities.
 *
 * @author Robbie or Robert Allen Lead Architect
 * @date August 2025
 */

// Model Registry will be loaded dynamically to avoid TypeScript import issues
import EnhancedWorkflowEngine from './EnhancedWorkflowEngine.js';
import EnhancedKnowledgeHub from './EnhancedKnowledgeHub.js';
import pool from '../db.js';
import { createClient } from 'redis';
import { shouldQuietLogs } from '../util/env.js';

class IntegratedAIService {
  constructor() {
    this.modelRegistry = null;
    this.workflowEngine = null;
    this.knowledgeHub = null;
    this.coreAgent = null;
    this.redisClient = null;
    this.isInitialized = false;

    console.log('[IntegratedAIService] 🎯 Integrated AI service constructed');
  }

  /**
   * Initialize the integrated AI service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[IntegratedAIService] Already initialized');
      return true;
    }

    try {
      console.log(
        '[IntegratedAIService] 🚀 Initializing integrated AI service...'
      );

      // Initialize Redis client (optional)
      await this.initializeRedis();

      // Initialize Knowledge Hub
      await this.initializeKnowledgeHub();

      // Initialize Model Registry
      await this.initializeModelRegistry();

      // Initialize Workflow Engine
      await this.initializeWorkflowEngine();

      // Wire services together
      this.wireServices();

      this.isInitialized = true;

      console.log(
        '[IntegratedAIService] ✅ All AI services integrated and ready'
      );

      return true;
    } catch (error) {
      console.error('[IntegratedAIService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis client
   */
  async initializeRedis() {
    try {
      this.redisClient = createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      });

      await this.redisClient.connect();
      console.log('[IntegratedAIService] ✅ Redis connected');
    } catch (error) {
      console.warn(
        '[IntegratedAIService] ⚠️ Redis connection failed, continuing without caching:',
        error.message
      );
      this.redisClient = null;
    }
  }

  /**
   * Initialize Knowledge Hub
   */
  async initializeKnowledgeHub() {
    console.log('[IntegratedAIService] 🧠 Initializing Knowledge Hub...');

    this.knowledgeHub = new EnhancedKnowledgeHub();
    const khInitialized = await this.knowledgeHub.initialize();

    if (khInitialized) {
      console.log('[IntegratedAIService] ✅ Knowledge Hub initialized');
    } else {
      console.warn(
        '[IntegratedAIService] ⚠️ Knowledge Hub initialization failed, continuing with limited functionality'
      );
    }
  }

  /**
   * Initialize Model Registry (dynamically loaded)
   */
  async initializeModelRegistry() {
    console.log('[IntegratedAIService] 🎯 Initializing Model Registry...');

    try {
      // Dynamic import to avoid TypeScript loading issues
      const { ModelRegistryService } = await import('../modelRouting/index.ts');

      const modelRegistryConfig = {
        database: {
          client: pool,
          schema: 'public',
        },
        redis: this.redisClient
          ? {
              client: this.redisClient,
              keyPrefix: 'model_registry:',
            }
          : undefined,
        safety: {
          pre_generation: {
            enabled: true,
            classifier_model: 'llama-guard-2',
            risk_threshold: 0.7,
            categories: ['hate', 'violence', 'sexual', 'harassment'],
          },
          post_generation: {
            enabled: true,
            safety_model: 'llama-guard-2',
            risk_threshold: 0.8,
            redaction_enabled: true,
            regeneration_enabled: false,
          },
          audit: {
            log_all_interactions: true,
            flag_high_risk: true,
            human_review_threshold: 0.9,
          },
        },
        benchmarking: {
          enabled: true,
          scheduleCron: '0 2 * * 0', // Weekly on Sunday at 2 AM
        },
        monitoring: {
          logger: shouldQuietLogs() ? null : console,
        },
      };

      // Create a mock HuggingFace service for model registry
      const mockHuggingFaceService = {
        generate: async options => {
          // Fallback to OpenAI if HuggingFace is not available
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const response = await openai.chat.completions.create({
            model: options.model || 'gpt-4o',
            messages: [{ role: 'user', content: options.prompt }],
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 512,
          });

          return {
            text: response.choices[0].message.content,
            usage: response.usage,
          };
        },
      };

      this.modelRegistry = new ModelRegistryService(
        modelRegistryConfig,
        mockHuggingFaceService
      );
      await this.modelRegistry.initialize();

      console.log('[IntegratedAIService] ✅ Model Registry initialized');
    } catch (error) {
      console.warn(
        '[IntegratedAIService] ⚠️ Model Registry initialization failed:',
        error.message
      );
      console.warn(
        '[IntegratedAIService] Continuing without Model Registry - workflows will use fallback models'
      );
      this.modelRegistry = null;
    }
  }

  /**
   * Initialize Workflow Engine
   */
  async initializeWorkflowEngine() {
    console.log('[IntegratedAIService] ⚙️ Initializing Workflow Engine...');

    this.workflowEngine = new EnhancedWorkflowEngine();

    console.log('[IntegratedAIService] ✅ Workflow Engine initialized');
  }

  /**
   * Wire services together
   */
  wireServices() {
    console.log('[IntegratedAIService] 🔗 Wiring services together...');

    // Connect Workflow Engine with Model Registry
    if (this.modelRegistry && this.workflowEngine) {
      this.workflowEngine.setModelRegistry(this.modelRegistry);
      console.log(
        '[IntegratedAIService] ✅ Workflow Engine ↔ Model Registry connected'
      );
    }

    // Connect Workflow Engine with Knowledge Hub
    if (this.knowledgeHub && this.workflowEngine) {
      this.workflowEngine.setKnowledgeHub(this.knowledgeHub);
      console.log(
        '[IntegratedAIService] ✅ Workflow Engine ↔ Knowledge Hub connected'
      );
    }

    // Connect Core Agent if available
    if (this.coreAgent) {
      this.workflowEngine.setCoreAgent(this.coreAgent);
      console.log('[IntegratedAIService] ✅ Core Agent connected');
    }
  }

  /**
   * Set core agent reference
   */
  setCoreAgent(coreAgent) {
    this.coreAgent = coreAgent;
    if (this.workflowEngine) {
      this.workflowEngine.setCoreAgent(coreAgent);
    }
    console.log('[IntegratedAIService] 🤖 Core agent set');
  }

  /**
   * Execute a workflow with full AI integration
   */
  async executeWorkflow(workflowId, userId, inputData = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('IntegratedAIService not initialized');
    }

    if (!this.workflowEngine) {
      throw new Error('Workflow Engine not available');
    }

    try {
      console.log(
        `[IntegratedAIService] 🚀 Executing integrated workflow ${workflowId}`
      );

      const result = await this.workflowEngine.executeWorkflow(
        workflowId,
        userId,
        inputData,
        options.triggerType || 'manual'
      );

      // Log to model registry if available
      if (this.modelRegistry && result.success) {
        try {
          const costStats = await this.modelRegistry.getCostStatistics(1); // Last hour
          console.log(
            `[IntegratedAIService] 💰 Recent AI costs: $${costStats.data?.total_cost_usd || 0}`
          );
        } catch (costError) {
          console.warn(
            '[IntegratedAIService] Failed to retrieve cost stats:',
            costError.message
          );
        }
      }

      return result;
    } catch (error) {
      console.error(
        `[IntegratedAIService] ❌ Workflow execution failed:`,
        error
      );
      throw error;
    }
  }

  /**
   * Process a document in the knowledge hub
   */
  async processDocument(userId, fileInfo, filePath, metadata = {}) {
    if (!this.knowledgeHub) {
      throw new Error('Knowledge Hub not available');
    }

    try {
      console.log(
        `[IntegratedAIService] 📄 Processing document: ${fileInfo.originalname}`
      );

      const result = await this.knowledgeHub.processDocument(
        userId,
        fileInfo,
        filePath,
        metadata
      );

      return result;
    } catch (error) {
      console.error(
        '[IntegratedAIService] ❌ Document processing failed:',
        error
      );
      throw error;
    }
  }

  /**
   * Perform semantic search across knowledge base
   */
  async semanticSearch(userId, query, options = {}) {
    if (!this.knowledgeHub) {
      throw new Error('Knowledge Hub not available');
    }

    try {
      const result = await this.knowledgeHub.semanticSearch(
        userId,
        query,
        options
      );
      return result;
    } catch (error) {
      console.error('[IntegratedAIService] ❌ Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Generate RAG response using knowledge hub
   */
  async generateRAGResponse(userId, query, searchResults = null, options = {}) {
    if (!this.knowledgeHub) {
      throw new Error('Knowledge Hub not available');
    }

    try {
      // If no search results provided, perform search first
      if (!searchResults) {
        const searchResult = await this.knowledgeHub.semanticSearch(
          userId,
          query,
          {
            limit: options.searchLimit || 5,
            threshold: options.searchThreshold || 0.7,
          }
        );

        if (!searchResult.success || searchResult.results.length === 0) {
          return {
            success: false,
            message: 'No relevant information found in knowledge base',
          };
        }

        searchResults = searchResult.results;
      }

      const result = await this.knowledgeHub.generateRAGResponse(
        userId,
        query,
        searchResults,
        options
      );
      return result;
    } catch (error) {
      console.error(
        '[IntegratedAIService] ❌ RAG response generation failed:',
        error
      );
      throw error;
    }
  }

  /**
   * Select optimal model for a task
   */
  async selectModel(criteria, context = {}, strategy = 'balanced') {
    if (!this.modelRegistry) {
      throw new Error('Model Registry not available');
    }

    try {
      const result = await this.modelRegistry.selectModel(
        criteria,
        context,
        strategy
      );
      return result;
    } catch (error) {
      console.error('[IntegratedAIService] ❌ Model selection failed:', error);
      throw error;
    }
  }

  /**
   * Execute model inference with cost tracking
   */
  async executeModelInference(modelId, prompt, options = {}) {
    if (!this.modelRegistry) {
      throw new Error('Model Registry not available');
    }

    try {
      const result = await this.modelRegistry.executeInference(
        modelId,
        prompt,
        options
      );
      return result;
    } catch (error) {
      console.error('[IntegratedAIService] ❌ Model inference failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive service status
   */
  getStatus() {
    return {
      service: 'IntegratedAIService',
      version: '1.0.0',
      initialized: this.isInitialized,
      components: {
        model_registry: {
          available: !!this.modelRegistry,
          initialized: this.modelRegistry?.isInitialized || false,
        },
        workflow_engine: {
          available: !!this.workflowEngine,
          stats: this.workflowEngine?.getExecutionStats() || null,
        },
        knowledge_hub: {
          available: !!this.knowledgeHub,
          status: this.knowledgeHub?.getStatus() || null,
        },
        redis: {
          available: !!this.redisClient,
          connected: this.redisClient?.isOpen || false,
        },
      },
      capabilities: [
        'Intelligent model selection',
        'Cost-optimized inference',
        'Workflow automation with AI',
        'Semantic knowledge search',
        'RAG-powered Q&A',
        'Multi-modal processing',
        'Real-time cost tracking',
        'Safety & content moderation',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cost analytics across all services
   */
  async getCostAnalytics(timeRangeHours = 24) {
    const analytics = {
      time_range_hours: timeRangeHours,
      timestamp: new Date().toISOString(),
    };

    // Model Registry costs
    if (this.modelRegistry) {
      try {
        const modelCosts =
          await this.modelRegistry.getCostStatistics(timeRangeHours);
        analytics.model_costs = modelCosts.data;
      } catch (error) {
        analytics.model_costs = { error: error.message };
      }
    }

    // Workflow execution stats
    if (this.workflowEngine) {
      analytics.workflow_stats = this.workflowEngine.getExecutionStats();
    }

    // Knowledge Hub analytics
    if (this.knowledgeHub) {
      try {
        const khAnalytics = await this.knowledgeHub.getKnowledgeAnalytics(1); // dummy user ID
        analytics.knowledge_stats = khAnalytics.system_stats;
      } catch (error) {
        analytics.knowledge_stats = { error: error.message };
      }
    }

    return analytics;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('[IntegratedAIService] 🧹 Cleaning up resources...');

    if (this.modelRegistry) {
      await this.modelRegistry.cleanup();
    }

    if (this.redisClient) {
      try {
        await this.redisClient.disconnect();
      } catch (error) {
        console.warn(
          '[IntegratedAIService] Redis disconnect error:',
          error.message
        );
      }
    }

    console.log('[IntegratedAIService] ✅ Cleanup completed');
  }
}

export default IntegratedAIService;
