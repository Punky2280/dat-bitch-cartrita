/**
 * Agent Orchestrator - Manages and coordinates all specialized HuggingFace agents
 * Provides intelligent agent selection and task routing
 */

import VisionMasterAgent from './agents/VisionMasterAgent.js';
import AudioWizardAgent from './agents/AudioWizardAgent.js';
import LanguageMaestroAgent from './agents/LanguageMaestroAgent.js';
import MultiModalOracleAgent from './agents/MultiModalOracleAgent.js';
import DataSageAgent from './agents/DataSageAgent.js';
import HuggingFaceRouterService from '../../modelRouting/HuggingFaceRouterService.js';
import RAGPipelineService from '../../services/rag/RAGPipelineService.js';

export default class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.agentCapabilities = new Map();
    this.isInitialized = false;
    
    // Enhanced services
    this.routerService = HuggingFaceRouterService;
    this.ragService = new RAGPipelineService();
    
    // Performance tracking
    this.routingStats = {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0,
      fallbacksUsed: 0
    };
    
    // Task-to-agent mapping
    this.taskAgentMap = {
      // Vision tasks
      'image-classification': 'VisionMaster',
      'object-detection': 'VisionMaster', 
      'image-segmentation': 'VisionMaster',
      'depth-estimation': 'VisionMaster',
      'text-to-image': 'VisionMaster',
      'image-to-text': 'VisionMaster',
      'zero-shot-image-classification': 'VisionMaster',
      
      // Audio tasks
      'automatic-speech-recognition': 'AudioWizard',
      'text-to-speech': 'AudioWizard',
      'audio-classification': 'AudioWizard',
      'voice-activity-detection': 'AudioWizard',
      'text-to-audio': 'AudioWizard',
      
      // Language tasks
      'text-generation': 'LanguageMaestro',
      'text-classification': 'LanguageMaestro',
      'question-answering': 'LanguageMaestro',
      'summarization': 'LanguageMaestro',
      'translation': 'LanguageMaestro',
      'zero-shot-classification': 'LanguageMaestro',
      'token-classification': 'LanguageMaestro',
      'fill-mask': 'LanguageMaestro',
      'sentence-similarity': 'LanguageMaestro',
      
      // Multimodal tasks
      'visual-question-answering': 'MultiModalOracle',
      'document-question-answering': 'MultiModalOracle',
      'audio-text-to-text': 'MultiModalOracle',
      'image-text-to-text': 'MultiModalOracle',
      'multimodal-analysis': 'MultiModalOracle',
      
      // Data tasks
      'tabular-classification': 'DataSage',
      'tabular-regression': 'DataSage',
      'time-series-forecasting': 'DataSage',
      'data-analysis': 'DataSage'
    };
  }

  async initialize() {
    try {
      console.log('[AgentOrchestrator] 🎭 Initializing specialized agents...');
      
      // Initialize all agents
      const visionAgent = new VisionMasterAgent();
      const audioAgent = new AudioWizardAgent();
      const languageAgent = new LanguageMaestroAgent();
      const multiModalAgent = new MultiModalOracleAgent();
      const dataAgent = new DataSageAgent();
      
      // Store agents
      this.agents.set('VisionMaster', visionAgent);
      this.agents.set('AudioWizard', audioAgent);
      this.agents.set('LanguageMaestro', languageAgent);
      this.agents.set('MultiModalOracle', multiModalAgent);
      this.agents.set('DataSage', dataAgent);
      
      // Initialize all agents in parallel
      const initResults = await Promise.allSettled([
        visionAgent.initialize(),
        audioAgent.initialize(),
        languageAgent.initialize(),
        multiModalAgent.initialize(),
        dataAgent.initialize()
      ]);
      
      // Check initialization results
      const agentNames = ['VisionMaster', 'AudioWizard', 'LanguageMaestro', 'MultiModalOracle', 'DataSage'];
      let successCount = 0;
      
      initResults.forEach((result, index) => {
        const agentName = agentNames[index];
        if (result.status === 'fulfilled' && result.value) {
          console.log(`[AgentOrchestrator] ✅ ${agentName} initialized successfully`);
          
          // Store agent capabilities
          const agent = this.agents.get(agentName);
          if (agent && typeof agent.getCapabilities === 'function') {
            this.agentCapabilities.set(agentName, agent.getCapabilities());
          }
          successCount++;
        } else {
          console.warn(`[AgentOrchestrator] ⚠️ ${agentName} initialization failed:`, result.reason);
        }
      });
      
      this.isInitialized = successCount > 0;
      console.log(`[AgentOrchestrator] 🎭 Agent orchestrator ready with ${successCount}/${agentNames.length} agents`);
      
      return this.isInitialized;
    } catch (error) {
      console.error('[AgentOrchestrator] ❌ Initialization failed:', error);
      return false;
    }
  }

  async routeTask(taskType, inputs, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Agent orchestrator not initialized');
    }

    const startTime = Date.now();
    this.routingStats.totalRequests++;

    try {
      // Enhanced routing with safety, cost controls, and RAG integration
      const routingConstraints = {
        taskOverride: taskType,
        budget_tier: options.budgetTier || 'standard',
        min_confidence_threshold: options.minConfidence || 0.3,
        require_safety_filter: options.requireSafety || false,
        enable_fallback: options.enableFallback !== false,
        ...options
      };

      // Check if this is a RAG-enhanced query
      if (options.useRAG && options.documentStore) {
        console.log(`[AgentOrchestrator] 🔍 Executing RAG pipeline for ${taskType}`);
        
        const ragResult = await this.ragService.executeRAGPipeline(
          inputs.text || inputs.query || inputs,
          options.documentStore,
          {
            embeddingModel: options.embeddingModel,
            rerankModel: options.rerankModel,
            generationModel: options.generationModel,
            topKRetrieval: options.topKRetrieval || 20,
            topKRerank: options.topKRerank || 8,
            useMultiQuery: options.useMultiQuery || false,
            includeCitations: options.includeCitations !== false
          }
        );

        // Update routing stats
        const latency = Date.now() - startTime;
        this.updateRoutingStats(latency, true, ragResult.confidence);

        return {
          ...ragResult,
          agent: 'RAGPipeline',
          routing_method: 'rag_enhanced'
        };
      }

      // Determine agent and use enhanced routing
      const agentName = this.selectAgent(taskType, inputs, options);
      const agent = this.agents.get(agentName);
      
      if (!agent) {
        throw new Error(`No suitable agent found for task: ${taskType}`);
      }

      console.log(`[AgentOrchestrator] 📋 Routing ${taskType} to ${agentName} with advanced routing`);

      // Use router service for model selection and execution
      let result;
      
      if (this.isDirectModelTask(taskType)) {
        // Direct model routing for certain tasks
        result = await this.routerService.route(
          this.preparePromptForTask(taskType, inputs),
          routingConstraints
        );
        
        // Add agent context
        result.agent = agentName;
        result.routing_method = 'direct_model';
      } else {
        // Agent-mediated execution
        result = await this.executeTask(agent, taskType, inputs, options);
        result.agent = agentName;
        result.routing_method = 'agent_mediated';
      }

      // Update routing stats
      const latency = Date.now() - startTime;
      this.updateRoutingStats(latency, true, result.confidence);
      
      if (result.used_fallbacks > 0) {
        this.routingStats.fallbacksUsed++;
      }

      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateRoutingStats(latency, false);
      
      console.error(`[AgentOrchestrator] Task execution failed:`, error);
      throw error;
    }
  }

  selectAgent(taskType, inputs, options = {}) {
    // Check for explicit agent preference
    if (options.preferredAgent && this.agents.has(options.preferredAgent)) {
      return options.preferredAgent;
    }

    // Use task mapping
    if (this.taskAgentMap[taskType]) {
      return this.taskAgentMap[taskType];
    }

    // Intelligent agent selection based on input types
    const hasImage = inputs.image || inputs.imageData;
    const hasAudio = inputs.audio || inputs.audioData;
    const hasText = inputs.text || typeof inputs === 'string';
    const hasTabularData = Array.isArray(inputs) || (inputs.data && Array.isArray(inputs.data));
    
    // Multi-modal inputs
    const modalityCount = [hasImage, hasAudio, hasText].filter(Boolean).length;
    if (modalityCount > 1) {
      return 'MultiModalOracle';
    }
    
    // Single modality selection
    if (hasImage) return 'VisionMaster';
    if (hasAudio) return 'AudioWizard';
    if (hasTabularData) return 'DataSage';
    if (hasText) return 'LanguageMaestro';
    
    // Default fallback
    return 'LanguageMaestro';
  }

  async executeTask(agent, taskType, inputs, options = {}) {
    // Map task types to agent methods
    const methodMap = {
      // Vision tasks
      'image-classification': 'analyzeImage',
      'object-detection': 'analyzeImage', 
      'image-segmentation': 'analyzeImage',
      'depth-estimation': 'analyzeImage',
      'text-to-image': 'generateImage',
      'image-to-text': 'analyzeImage',
      'zero-shot-image-classification': 'classifyWithLabels',
      
      // Audio tasks
      'automatic-speech-recognition': 'transcribeAudio',
      'text-to-speech': 'synthesizeSpeech',
      'audio-classification': 'classifyAudio',
      'voice-activity-detection': 'detectVoiceActivity',
      'text-to-audio': 'generateAudioFromText',
      
      // Language tasks
      'text-generation': 'generateText',
      'text-classification': 'classifyText',
      'question-answering': 'answerQuestion',
      'summarization': 'summarizeText',
      'translation': 'translateText',
      'zero-shot-classification': 'classifyText',
      'token-classification': 'extractEntities',
      'fill-mask': 'fillInBlanks',
      'sentence-similarity': 'compareSentences',
      
      // Multimodal tasks
      'visual-question-answering': 'answerVisualQuestion',
      'document-question-answering': 'documentQuestionAnswering',
      'audio-text-to-text': 'audioTextToText',
      'image-text-to-text': 'imageTextToText',
      'multimodal-analysis': 'analyzeMultiModal',
      
      // Data tasks
      'tabular-classification': 'analyzeTabularData',
      'tabular-regression': 'analyzeTabularData',
      'time-series-forecasting': 'forecastTimeSeries',
      'data-analysis': 'analyzeTabularData'
    };

    const methodName = methodMap[taskType];
    
    if (!methodName || typeof agent[methodName] !== 'function') {
      throw new Error(`Agent ${agent.name} does not support task: ${taskType}`);
    }

    // Prepare arguments based on task type and agent
    const args = this.prepareTaskArguments(taskType, inputs, options);
    
    return await agent[methodName](...args);
  }

  prepareTaskArguments(taskType, inputs, options) {
    // Prepare arguments based on the specific task and expected agent method signature
    
    switch (taskType) {
      case 'visual-question-answering':
        return [inputs.image || inputs.imageData, inputs.question, options];
        
      case 'document-question-answering':
        return [inputs.document || inputs.imageData, inputs.question, options];
        
      case 'audio-text-to-text':
        return [inputs.audio || inputs.audioData, options];
        
      case 'image-text-to-text':
        return [inputs.image || inputs.imageData, inputs.text || null, options];
        
      case 'text-to-image':
        return [inputs.text || inputs, options];
        
      case 'text-to-speech':
        return [inputs.text || inputs, options];
        
      case 'automatic-speech-recognition':
        return [inputs.audio || inputs.audioData, options];
        
      case 'question-answering':
        return [inputs.question, inputs.context, options];
        
      case 'zero-shot-classification':
      case 'zero-shot-image-classification':
        return [inputs.data || inputs.image || inputs, inputs.labels || options.labels, options];
        
      case 'sentence-similarity':
        return [inputs.sentences || inputs, options];
        
      case 'translation':
        return [inputs.text || inputs, options];
        
      case 'multimodal-analysis':
        return [inputs, options.analysisType || 'comprehensive', options];
        
      case 'tabular-classification':
      case 'tabular-regression':
      case 'data-analysis':
        return [inputs.data || inputs, taskType.replace('tabular-', ''), options];
        
      case 'time-series-forecasting':
        return [inputs.timeSeries || inputs.data || inputs, options];
        
      // Default cases - single input with options
      default:
        if (typeof inputs === 'object' && !Array.isArray(inputs)) {
          // Extract the main input based on task type
          if (taskType.includes('image')) {
            return [inputs.image || inputs.imageData || inputs, options.analysisType || taskType.split('-')[0], options];
          } else if (taskType.includes('audio')) {
            return [inputs.audio || inputs.audioData || inputs, options.analysisType || taskType.split('-')[0], options];
          } else {
            return [inputs.text || inputs, options.analysisType || taskType.split('-')[0], options];
          }
        } else {
          return [inputs, options];
        }
    }
  }

  async getAgentCapabilities(agentName = null) {
    if (agentName) {
      return this.agentCapabilities.get(agentName) || null;
    }
    
    // Return all agent capabilities
    const allCapabilities = {};
    for (const [name, capabilities] of this.agentCapabilities.entries()) {
      allCapabilities[name] = capabilities;
    }
    
    return allCapabilities;
  }

  async healthCheck() {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Agent orchestrator not initialized',
        agents: {}
      };
    }

    const agentStatus = {};
    
    for (const [name, agent] of this.agents.entries()) {
      try {
        if (typeof agent.healthCheck === 'function') {
          agentStatus[name] = await agent.healthCheck();
        } else {
          agentStatus[name] = {
            status: agent.isInitialized ? 'healthy' : 'unhealthy',
            message: agent.isInitialized ? 'Agent operational' : 'Agent not initialized'
          };
        }
      } catch (error) {
        agentStatus[name] = {
          status: 'unhealthy',
          message: error.message
        };
      }
    }

    const healthyCount = Object.values(agentStatus).filter(status => status.status === 'healthy').length;
    
    return {
      status: healthyCount > 0 ? 'healthy' : 'unhealthy',
      message: `Agent orchestrator operational with ${healthyCount}/${Object.keys(agentStatus).length} healthy agents`,
      agents: agentStatus,
      taskMappings: this.taskAgentMap
    };
  }

  getAvailableTasks() {
    return Object.keys(this.taskAgentMap);
  }

  getAgentForTask(taskType) {
    return this.taskAgentMap[taskType] || null;
  }

  async batchProcess(tasks) {
    if (!this.isInitialized) {
      throw new Error('Agent orchestrator not initialized');
    }

    const results = [];
    
    for (const task of tasks) {
      try {
        const { taskType, inputs, options = {} } = task;
        const result = await this.routeTask(taskType, inputs, options);
        results.push({ 
          success: true, 
          result, 
          task,
          agent: this.selectAgent(taskType, inputs, options)
        });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          task 
        });
      }
    }
    
    return results;
  }

  // Helper methods for enhanced orchestration

  /**
   * Determine if a task should use direct model routing
   */
  isDirectModelTask(taskType) {
    const directTasks = [
      'text-generation',
      'text-classification',
      'translation',
      'summarization',
      'embedding',
      'rerank',
      'fill-mask'
    ];
    return directTasks.includes(taskType);
  }

  /**
   * Prepare prompt for direct model routing
   */
  preparePromptForTask(taskType, inputs) {
    if (typeof inputs === 'string') {
      return inputs;
    }

    switch (taskType) {
      case 'text-classification':
        return inputs.text || inputs;
      case 'translation':
        return `Translate: ${inputs.text || inputs}`;
      case 'summarization':
        return `Summarize: ${inputs.text || inputs}`;
      case 'question-answering':
        return `Question: ${inputs.question}\nContext: ${inputs.context || ''}`;
      default:
        return inputs.text || inputs.prompt || inputs;
    }
  }

  /**
   * Update routing performance statistics
   */
  updateRoutingStats(latency, success, confidence = null) {
    if (success) {
      this.routingStats.successfulRequests++;
    }
    
    // Update average latency with exponential moving average
    const alpha = 0.1;
    this.routingStats.averageLatency = 
      (alpha * latency) + ((1 - alpha) * this.routingStats.averageLatency);
  }

  /**
   * Get enhanced orchestrator statistics
   */
  getStats() {
    const successRate = this.routingStats.totalRequests > 0 
      ? this.routingStats.successfulRequests / this.routingStats.totalRequests 
      : 0;

    return {
      ...this.routingStats,
      successRate: Math.round(successRate * 100) / 100,
      ragCacheStats: this.ragService.getCacheStats(),
      availableModels: this.routerService.getCatalog().length
    };
  }

  /**
   * Enhanced health check with routing service status
   */
  async enhancedHealthCheck() {
    const basicHealth = await this.healthCheck();
    
    try {
      // Test routing service
      const testPrompt = "Hello, this is a health check.";
      const routingResult = await this.routerService.route(testPrompt, {
        max_candidates: 1,
        min_confidence_threshold: 0,
        enable_fallback: false
      });

      basicHealth.routing_service = {
        status: 'healthy',
        test_successful: true,
        model_used: routingResult.model_id,
        confidence: routingResult.confidence
      };

    } catch (error) {
      basicHealth.routing_service = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Add RAG service status
    basicHealth.rag_service = {
      status: 'healthy',
      cache_size: this.ragService.getCacheStats().size
    };

    // Add performance stats
    basicHealth.performance = this.getStats();

    return basicHealth;
  }

  /**
   * Clear all caches and reset stats
   */
  clearCaches() {
    this.ragService.clearCache();
    this.routingStats = {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0,
      fallbacksUsed: 0
    };
  }
}