/**
 * Cartrita V2 - Enhanced OpenAI Service Manager
 * Intelligent routing between general AI operations and specialized fine-tuning/training
 */

import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../core/logger.js';

export class OpenAIServiceManager {
  constructor() {
    this.clients = {};
    this.langchainClients = {};
    this.keyUsageStats = {
      general: { requests: 0, tokens: 0, lastUsed: null },
      finetuning: { requests: 0, tokens: 0, lastUsed: null }
    };
    this.initialized = false;
  }

  /**
   * Initialize OpenAI clients with intelligent key routing
   */
  async initialize() {
    try {
      // General purpose client (versatile key)
      if (process.env.OPENAI_API_KEY) {
        this.clients.general = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORG_ID || undefined,
          defaultHeaders: {
            'User-Agent': 'Cartrita-V2/2.0.0'
          }
        });

        // LangChain client for general operations
        this.langchainClients.general = new ChatOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          modelName: process.env.OPENAI_MODEL || 'gpt-4o',
          temperature: 0.7,
          maxTokens: 2000,
          organization: process.env.OPENAI_ORG_ID || undefined,
          timeout: 60000,
          maxRetries: 3,
          streaming: true,
          callbacks: [{
            handleLLMEnd: (output) => {
              this.updateUsageStats('general', output.llmOutput?.tokenUsage);
            }
          }]
        });

        logger.info('✅ OpenAI general client initialized', {
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          rpmLimit: process.env.OPENAI_RPM_LIMIT || 60,
          tpmLimit: process.env.OPENAI_TPM_LIMIT || 90000
        });
      } else {
        logger.warn('⚠️ OPENAI_API_KEY not found - general AI features disabled');
      }

      // Fine-tuning/training client (specialized key)
      if (process.env.OPENAI_FINETUNING_API_KEY && 
          process.env.OPENAI_FINETUNING_API_KEY !== process.env.OPENAI_API_KEY) {
        
        this.clients.finetuning = new OpenAI({
          apiKey: process.env.OPENAI_FINETUNING_API_KEY,
          organization: process.env.OPENAI_ORG_ID || undefined,
          defaultHeaders: {
            'User-Agent': 'Cartrita-V2-Training/2.0.0'
          }
        });

        // LangChain client for fine-tuning operations
        this.langchainClients.finetuning = new ChatOpenAI({
          apiKey: process.env.OPENAI_FINETUNING_API_KEY,
          modelName: process.env.OPENAI_FINETUNING_MODEL || 'gpt-4o',
          temperature: 0.1, // Lower temperature for training consistency
          maxTokens: 4000,
          organization: process.env.OPENAI_ORG_ID || undefined,
          timeout: 120000, // Longer timeout for training operations
          maxRetries: 5,
          callbacks: [{
            handleLLMEnd: (output) => {
              this.updateUsageStats('finetuning', output.llmOutput?.tokenUsage);
            }
          }]
        });

        logger.info('✅ OpenAI fine-tuning client initialized', {
          model: process.env.OPENAI_FINETUNING_MODEL || 'gpt-4o',
          purpose: 'model_training_and_specialized_tasks'
        });
      } else {
        logger.info('ℹ️ Using general key for fine-tuning operations (same key configured)');
        this.clients.finetuning = this.clients.general;
        this.langchainClients.finetuning = this.langchainClients.general;
      }

      this.initialized = true;
      logger.info('✅ OpenAI Service Manager fully initialized', {
        generalClient: !!this.clients.general,
        finetuningClient: !!this.clients.finetuning,
        separateKeys: process.env.OPENAI_FINETUNING_API_KEY !== process.env.OPENAI_API_KEY
      });

    } catch (error) {
      logger.error('❌ Failed to initialize OpenAI Service Manager', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`OpenAI Service Manager initialization failed: ${error.message}`);
    }
  }

  /**
   * Get the appropriate OpenAI client based on operation type
   */
  getClient(operationType = 'general') {
    if (!this.initialized) {
      throw new Error('OpenAI Service Manager not initialized. Call initialize() first.');
    }

    const clientType = this.determineClientType(operationType);
    const client = this.clients[clientType];
    
    if (!client) {
      throw new Error(`OpenAI client not available for operation: ${operationType}`);
    }

    return client;
  }

  /**
   * Get the appropriate LangChain client based on operation type
   */
  getLangChainClient(operationType = 'general') {
    if (!this.initialized) {
      throw new Error('OpenAI Service Manager not initialized. Call initialize() first.');
    }

    const clientType = this.determineClientType(operationType);
    const client = this.langchainClients[clientType];
    
    if (!client) {
      throw new Error(`LangChain OpenAI client not available for operation: ${operationType}`);
    }

    return client;
  }

  /**
   * Determine which client to use based on operation type
   */
  determineClientType(operationType) {
    const finetuningOperations = [
      'fine-tune',
      'training',
      'model-training', 
      'fine-tuning',
      'dataset-processing',
      'model-evaluation',
      'custom-model',
      'batch-processing',
      'data-preparation'
    ];

    const specializedOperations = [
      'embeddings-bulk',
      'batch-completions',
      'data-analysis',
      'content-generation-bulk'
    ];

    // Route to fine-tuning client for training operations
    if (finetuningOperations.some(op => operationType.includes(op))) {
      return 'finetuning';
    }

    // Route to fine-tuning client for bulk operations to preserve general quota
    if (specializedOperations.some(op => operationType.includes(op))) {
      return this.clients.finetuning ? 'finetuning' : 'general';
    }

    // Default to general client
    return 'general';
  }

  /**
   * Intelligent chat completion with automatic client selection
   */
  async createChatCompletion(messages, options = {}) {
    const operationType = options.operationType || 'general';
    const client = this.getClient(operationType);
    
    const startTime = Date.now();
    
    // Extract OpenAI-specific options and remove our custom ones
    const { operationType: _, ...openAIOptions } = options;
    
    // Convert camelCase to snake_case for OpenAI API
    if (openAIOptions.maxTokens) {
      openAIOptions.max_tokens = openAIOptions.maxTokens;
      delete openAIOptions.maxTokens;
    }
    
    try {
      logger.ai('openai-chat-completion-started', {
        operationType,
        clientType: this.determineClientType(operationType),
        model: openAIOptions.model || process.env.OPENAI_MODEL || 'gpt-4o',
        messageCount: messages.length
      });

      const completion = await client.chat.completions.create({
        model: openAIOptions.model || process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: openAIOptions.temperature || 0.7,
        max_tokens: openAIOptions.max_tokens || 2000,
        stream: openAIOptions.stream || false,
        ...openAIOptions
      });

      const duration = Date.now() - startTime;
      
      // Update usage statistics
      this.updateUsageStats(this.determineClientType(operationType), {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      });

      logger.ai('openai-chat-completion-success', {
        operationType,
        duration,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      });

      return completion;
    } catch (error) {
      logger.error('OpenAI chat completion failed', {
        operationType,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * LangChain invoke with intelligent routing
   */
  async invokeLangChain(messages, options = {}) {
    const operationType = options.operationType || 'general';
    const client = this.getLangChainClient(operationType);
    
    const startTime = Date.now();
    
    try {
      logger.ai('langchain-openai-invoke-started', {
        operationType,
        clientType: this.determineClientType(operationType),
        messageCount: messages.length
      });

      const result = await client.invoke(messages, options);
      
      logger.ai('langchain-openai-invoke-success', {
        operationType,
        duration: Date.now() - startTime,
        responseLength: result.content?.length || 0
      });

      return result;
    } catch (error) {
      logger.error('LangChain OpenAI invoke failed', {
        operationType,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Update usage statistics
   */
  updateUsageStats(clientType, tokenUsage) {
    if (tokenUsage) {
      this.keyUsageStats[clientType].requests += 1;
      this.keyUsageStats[clientType].tokens += tokenUsage.totalTokens || 0;
      this.keyUsageStats[clientType].lastUsed = new Date().toISOString();
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      ...this.keyUsageStats,
      separateKeys: process.env.OPENAI_FINETUNING_API_KEY !== process.env.OPENAI_API_KEY,
      initialized: this.initialized,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check for all clients
   */
  async healthCheck() {
    const results = {};
    
    for (const [clientType, client] of Object.entries(this.clients)) {
      if (client) {
        try {
          const start = Date.now();
          await client.models.list({ limit: 1 });
          results[clientType] = {
            status: 'healthy',
            responseTime: Date.now() - start
          };
        } catch (error) {
          results[clientType] = {
            status: 'unhealthy',
            error: error.message
          };
        }
      } else {
        results[clientType] = {
          status: 'not_configured'
        };
      }
    }

    return results;
  }

  /**
   * Get available models for each client
   */
  async getAvailableModels() {
    const models = {};
    
    for (const [clientType, client] of Object.entries(this.clients)) {
      if (client) {
        try {
          const response = await client.models.list();
          models[clientType] = response.data
            .filter(model => model.id.includes('gpt') || model.id.includes('text'))
            .map(model => ({
              id: model.id,
              owned_by: model.owned_by,
              created: model.created
            }));
        } catch (error) {
          models[clientType] = { error: error.message };
        }
      }
    }

    return models;
  }
}

// Singleton instance
export const openAIService = new OpenAIServiceManager();

// Initialize on import (will be called when service is first used)
export const initializeOpenAI = () => openAIService.initialize();