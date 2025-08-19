/**
 * Enhanced GPT-5 Supervisor Agent for Cartrita V2
 * Builds upon EnhancedLangChainCoreAgent with GPT-5 advanced capabilities
 * Features: Dynamic model assignment, verbosity control, freeform calling, CFG support
 * Created: January 27, 2025
 */

import { StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import AgentToolRegistry from '../orchestration/AgentToolRegistry.js';
import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';
import GPT5Service from '../../services/GPT5Service.js';
import { getOptimalModelForAgent, getAllAgentAssignments } from '../../config/gpt5-models.js';

const AgentState = {
  messages: { value: (x, y) => x.concat(y), default: () => [] },
  next_agent: String,
  user_id: String,
  private_state: { value: (x, y) => ({ ...x, ...y }), default: () => ({}) },
  tools_used: { value: (x, y) => x.concat(y), default: () => [] },
  v2_metadata: { value: (x, y) => ({ ...x, ...y }), default: () => ({}) } // V2 Enhancement
};

/**
 * Enhanced supervisor with GPT-5 capabilities and intelligent model assignment
 */
class EnhancedGPT5SupervisorAgent {
  constructor() {
    this.isInitialized = false;
    this.llm = null;
    this.stateGraph = null;
    this.subAgents = new Map();
    this.toolRegistry = new AgentToolRegistry(this);
    this.gpt5Service = new GPT5Service(); // V2 Enhancement
    this.modelAssignments = new Map(); // V2 Enhancement: Per-agent model tracking

    // Enhanced metrics for V2
    this.metrics = {
      requests_processed: 0,
      successful_responses: 0,
      failed_responses: 0,
      tools_used_total: 0,
      average_response_time: 0,
      start_time: Date.now(),
      user_interactions: 0,
      agent_delegations: 0,
      gpt5_enhanced_requests: 0, // V2 Metric
      model_switches: 0, // V2 Metric
      verbosity_adjustments: 0, // V2 Metric
      reasoning_optimizations: 0 // V2 Metric
    };

    this.userContextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    this.lastModelOptimization = Date.now();
  }

  /**
   * Initialize with GPT-5 enhanced capabilities
   */
  async initialize() {
    try {
      console.log('[EnhancedGPT5Supervisor] 🚀 Initializing V2 hierarchical multi-agent system...');
      
      // Initialize GPT-5 service first
      await this.gpt5Service.initialize();
      
      // Get optimal model assignment for supervisor
      const supervisorModel = getOptimalModelForAgent('supervisor');
      console.log(`[EnhancedGPT5Supervisor] 🎯 Using optimal model: ${supervisorModel.model} (reasoning: ${supervisorModel.reasoning})`);

      // Initialize LLM with optimal settings
      this.llm = new ChatOpenAI({
        model: supervisorModel.model,
        temperature: supervisorModel.temperature,
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Load all agent model assignments
      this.loadAgentModelAssignments();

      // Initialize tool registry
      await this.toolRegistry.initialize();
      console.log('[EnhancedGPT5Supervisor] 🛠️ Tool registry initialized with advanced capabilities');

      // Load and initialize all sub-agents with optimal models
      await this.loadSubAgentsWithOptimalModels();

      // Build enhanced state graph
      await this.buildEnhancedStateGraph();

      this.isInitialized = true;
      console.log('[EnhancedGPT5Supervisor] ✅ V2 Enhanced supervisor ready with GPT-5 capabilities');
      
      return true;
    } catch (error) {
      console.error('[EnhancedGPT5Supervisor] ❌ Initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Load agent model assignments for V2 optimization
   */
  loadAgentModelAssignments() {
    const assignments = getAllAgentAssignments();
    Object.entries(assignments).forEach(([agentName, config]) => {
      this.modelAssignments.set(agentName, {
        ...config,
        lastUsed: null,
        performanceMetrics: {
          averageResponseTime: 0,
          successRate: 100,
          qualityScore: 0
        }
      });
    });
    
    console.log(`[EnhancedGPT5Supervisor] 📊 Loaded ${this.modelAssignments.size} agent model assignments`);
  }

  /**
   * Load sub-agents with optimal model configurations
   */
  async loadSubAgentsWithOptimalModels() {
    const agentFileNames = [
      'WriterAgent.js', 'AnalyticsAgent.js', 'ArchitectAgent.js', 'CodeMaestroAgent.js',
      'IntegrationAgent.js', 'ArtistAgent.js', 'KnowledgeCuratorAgent.js',
      'SecurityAgent.js', 'WorkflowMaestroAgent.js', 'FileOrganizerAgent.js',
      'ResearcherAgent.js', 'ComputerUseAgent.js', // V2: Added Computer Use Agent
      // HuggingFace Bridge Agents with V2 optimization
      '../integrations/huggingface/bridge/HFLanguageAgent.js',
      '../integrations/huggingface/bridge/HFVisionAgent.js',
      '../integrations/huggingface/bridge/HFAudioAgent.js',
      '../integrations/huggingface/bridge/HFMultimodalAgent.js'
    ];

    console.log(`[EnhancedGPT5Supervisor] 📦 Loading ${agentFileNames.length} sub-agents with V2 enhancements...`);

    const loadPromises = agentFileNames.map(async (fileName) => {
      try {
        const agentName = fileName.replace('.js', '').toLowerCase().replace('agent', '');
        
        // Get optimal model for this agent
        const modelConfig = getOptimalModelForAgent(agentName);
        
        const agentModule = await import(`./${fileName}`);
        const AgentClass = agentModule.default;
        
        // Initialize agent with optimal model
        const agentInstance = new AgentClass(
          new ChatOpenAI({
            model: modelConfig.model,
            temperature: modelConfig.temperature,
            apiKey: process.env.OPENAI_API_KEY,
          }),
          this.toolRegistry
        );

        // Store with V2 metadata
        this.subAgents.set(agentName, {
          instance: agentInstance,
          config: modelConfig,
          v2Enhanced: true,
          loadedAt: new Date().toISOString()
        });

        console.log(`[EnhancedGPT5Supervisor] ✅ ${agentName} loaded with ${modelConfig.model} (${modelConfig.reasoning} reasoning)`);
        
      } catch (error) {
        const agentName = fileName.replace('.js', '');
        console.warn(`[EnhancedGPT5Supervisor] ⚠️ Failed to load ${agentName}:`, error.message);
      }
    });

    await Promise.allSettled(loadPromises);
    console.log(`[EnhancedGPT5Supervisor] 🎉 Loaded ${this.subAgents.size} sub-agents with V2 optimizations`);
  }

  /**
   * Build enhanced state graph with V2 features
   */
  async buildEnhancedStateGraph() {
    const workflow = new StateGraph(AgentState);

    // Enhanced supervisor node with GPT-5 capabilities
    workflow.addNode('cartrita', this.createEnhancedSupervisorNode());

    // Add all sub-agent nodes with V2 enhancements
    for (const [agentName, agentData] of this.subAgents) {
      workflow.addNode(agentName, this.createEnhancedSubAgentNode(agentName, agentData));
    }

    // Enhanced routing with intelligent model selection
    workflow.addConditionalEdges(
      'cartrita',
      this.createEnhancedRouter(),
      ['END', ...Array.from(this.subAgents.keys())]
    );

    // All agents return to supervisor for V2 coordination
    for (const agentName of this.subAgents.keys()) {
      workflow.addEdge(agentName, 'cartrita');
    }

    workflow.setEntryPoint('cartrita');
    this.stateGraph = workflow.compile();
    
    console.log('[EnhancedGPT5Supervisor] 🔗 Enhanced state graph built with V2 routing');
  }

  /**
   * Create enhanced supervisor node with GPT-5 capabilities
   */
  createEnhancedSupervisorNode() {
    return async (state) => {
      const startTime = Date.now();
      
      return await OpenTelemetryTracing.traceAgentOperation(
        'CartritaSupervisor',
        'v2.enhanced_processing',
        { 
          'user.id': state.user_id || 'anonymous',
          'gpt5.enabled': true,
          'v2.features': 'verbosity,reasoning,dynamic_models'
        },
        async () => {
          try {
            // Analyze request complexity for optimal processing
            const requestAnalysis = this.analyzeRequestComplexity(state);
            
            // Determine optimal verbosity and reasoning level
            const processingConfig = this.determineProcessingConfig(requestAnalysis);
            
            // Use GPT-5 enhanced generation
            const response = await this.generateEnhancedResponse(state, processingConfig);
            
            // Update V2 metrics
            this.updateV2Metrics(processingConfig, Date.now() - startTime);
            
            return {
              messages: response.messages,
              next_agent: response.next_agent,
              tools_used: response.tools_used || [],
              v2_metadata: {
                processingConfig,
                enhancedFeatures: response.enhancedFeatures,
                performanceMetrics: response.performanceMetrics
              }
            };

          } catch (error) {
            console.error('[EnhancedGPT5Supervisor] Processing error:', error);
            return this.createErrorResponse(error, state);
          }
        }
      );
    };
  }

  /**
   * Generate enhanced response using GPT-5 capabilities
   */
  async generateEnhancedResponse(state, processingConfig) {
    const lastMessage = state.messages[state.messages.length - 1];
    const userMessage = lastMessage.content || lastMessage;

    // Use GPT-5 service for advanced generation
    const enhancedResponse = await this.gpt5Service.generateWithAdvancedFeatures(
      this.buildEnhancedSystemPrompt(state, processingConfig),
      {
        model: processingConfig.model,
        verbosity: processingConfig.verbosity,
        reasoning: processingConfig.reasoning,
        enableFreeformCalling: processingConfig.enableFreeformCalling,
        temperature: processingConfig.temperature,
        userId: state.user_id
      }
    );

    // Parse response for delegation decisions
    const decision = this.parseEnhancedDecision(enhancedResponse.content);

    return {
      messages: [new AIMessage({ 
        content: decision.response,
        metadata: { v2Enhanced: true, ...enhancedResponse.features }
      })],
      next_agent: decision.action === 'delegate' ? decision.delegate_to : 'END',
      enhancedFeatures: enhancedResponse.features,
      performanceMetrics: enhancedResponse.performance
    };
  }

  /**
   * Analyze request complexity for optimal processing
   */
  analyzeRequestComplexity(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const content = lastMessage.content || lastMessage;
    
    // Analyze various complexity factors
    const wordCount = content.split(' ').length;
    const hasCodeBlocks = content.includes('```') || content.includes('function') || content.includes('class');
    const hasMultipleQuestions = (content.match(/\?/g) || []).length > 1;
    const hasComplexRequests = /create|build|implement|develop|analyze|optimize/i.test(content);
    
    let complexityScore = 0;
    if (wordCount > 100) complexityScore += 2;
    if (wordCount > 200) complexityScore += 2;
    if (hasCodeBlocks) complexityScore += 3;
    if (hasMultipleQuestions) complexityScore += 2;
    if (hasComplexRequests) complexityScore += 3;
    
    return {
      score: complexityScore,
      level: complexityScore <= 3 ? 'simple' : complexityScore <= 6 ? 'medium' : 'complex',
      factors: { wordCount, hasCodeBlocks, hasMultipleQuestions, hasComplexRequests }
    };
  }

  /**
   * Determine optimal processing configuration based on complexity
   */
  determineProcessingConfig(analysis) {
    const config = getOptimalModelForAgent('supervisor');
    
    // Adjust based on complexity
    if (analysis.level === 'simple') {
      return {
        model: 'gpt-5-fast',
        verbosity: 'low',
        reasoning: 'minimal',
        enableFreeformCalling: false,
        temperature: 0.3
      };
    } else if (analysis.level === 'complex') {
      return {
        model: 'gpt-5',
        verbosity: 'high',
        reasoning: 'high',
        enableFreeformCalling: true,
        temperature: 0.7
      };
    }
    
    // Default medium complexity
    return {
      model: config.model,
      verbosity: 'medium',
      reasoning: 'medium',
      enableFreeformCalling: false,
      temperature: config.temperature
    };
  }

  /**
   * Build enhanced system prompt with V2 capabilities
   */
  buildEnhancedSystemPrompt(state, config) {
    const agentList = Array.from(this.subAgents.keys()).join(', ');
    
    return `You are Cartrita, the enhanced V2 supervisor of a sophisticated multi-agent AI system with GPT-5 capabilities.

PERSONALITY: You embody Miami's vibrant energy with professional expertise. You're warm, confident, and direct, but never rude. Use "honey," "babe," or "mi amor" naturally when appropriate.

CURRENT PROCESSING MODE:
- Model: ${config.model}
- Verbosity: ${config.verbosity}
- Reasoning: ${config.reasoning}
- Advanced Features: ${config.enableFreeformCalling ? 'Enabled' : 'Basic'}

V2 ENHANCEMENTS ACTIVE:
✅ Dynamic model assignment based on task complexity
✅ Verbosity optimization for user experience  
✅ Intelligent reasoning level selection
✅ Freeform function calling for complex tasks
✅ Real-time performance monitoring

AVAILABLE AGENTS: ${agentList}

USER CONTEXT:
${JSON.stringify(state.private_state || {}, null, 2)}

DECISION FORMAT (JSON):
{
  "thought": "Your analysis of the request",
  "response": "Your direct response to the user",
  "action": "respond" | "delegate",
  "delegate_to": "agent_name" (only if delegating)
}

Remember: Always maintain Cartrita's personality while leveraging V2's advanced capabilities for optimal user experience.`;
  }

  /**
   * Parse enhanced decision from GPT-5 response
   */
  parseEnhancedDecision(responseContent) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        return {
          thought: decision.thought || '',
          response: decision.response || responseContent,
          action: decision.action || 'respond',
          delegate_to: decision.delegate_to || null
        };
      }
    } catch (error) {
      console.warn('[EnhancedGPT5Supervisor] Failed to parse JSON decision, using fallback');
    }

    // Fallback parsing
    return {
      thought: 'Enhanced processing completed',
      response: responseContent,
      action: 'respond',
      delegate_to: null
    };
  }

  /**
   * Update V2 specific metrics
   */
  updateV2Metrics(config, responseTime) {
    this.metrics.requests_processed++;
    this.metrics.gpt5_enhanced_requests++;
    
    if (config.verbosity !== 'medium') {
      this.metrics.verbosity_adjustments++;
    }
    
    if (config.reasoning === 'minimal') {
      this.metrics.reasoning_optimizations++;
    }
    
    // Update average response time
    const currentAvg = this.metrics.average_response_time;
    const totalRequests = this.metrics.requests_processed;
    this.metrics.average_response_time = 
      ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  /**
   * Create enhanced router with intelligent agent selection
   */
  createEnhancedRouter() {
    return (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      
      // Check for END condition
      if (!lastMessage.content || lastMessage.content.includes('"action": "respond"')) {
        return 'END';
      }

      // Enhanced agent selection with V2 optimization
      try {
        const decision = this.parseEnhancedDecision(lastMessage.content);
        if (decision.action === 'delegate' && decision.delegate_to) {
          const targetAgent = decision.delegate_to;
          
          // Validate agent exists and optimize if needed
          if (this.subAgents.has(targetAgent)) {
            this.optimizeAgentModelIfNeeded(targetAgent);
            this.metrics.agent_delegations++;
            return targetAgent;
          }
        }
      } catch (error) {
        console.warn('[EnhancedGPT5Supervisor] Router decision parsing failed:', error);
      }

      return 'END';
    };
  }

  /**
   * Optimize agent model based on performance metrics
   */
  optimizeAgentModelIfNeeded(agentName) {
    const assignment = this.modelAssignments.get(agentName);
    if (!assignment) return;

    const now = Date.now();
    
    // Only optimize every 5 minutes to prevent thrashing
    if (now - this.lastModelOptimization < 300000) return;

    const metrics = assignment.performanceMetrics;
    
    // If success rate is low, consider upgrading model
    if (metrics.successRate < 90 && !assignment.model.includes('gpt-5')) {
      console.log(`[EnhancedGPT5Supervisor] 🎯 Optimizing model for ${agentName}: upgrading for better performance`);
      this.upgradeAgentModel(agentName);
      this.metrics.model_switches++;
    }
    
    // If response time is consistently high, consider faster model
    if (metrics.averageResponseTime > 2000 && assignment.model === 'gpt-5') {
      console.log(`[EnhancedGPT5Supervisor] ⚡ Optimizing model for ${agentName}: switching to faster model`);
      this.switchToFasterModel(agentName);
      this.metrics.model_switches++;
    }

    this.lastModelOptimization = now;
  }

  /**
   * Upgrade agent to higher-tier model
   */
  upgradeAgentModel(agentName) {
    const assignment = this.modelAssignments.get(agentName);
    if (assignment.model.includes('nano')) {
      assignment.model = 'gpt-5-mini';
    } else if (assignment.model.includes('mini')) {
      assignment.model = 'gpt-5';
    }
    this.modelAssignments.set(agentName, assignment);
  }

  /**
   * Switch agent to faster model variant
   */
  switchToFasterModel(agentName) {
    const assignment = this.modelAssignments.get(agentName);
    if (assignment.model === 'gpt-5') {
      assignment.model = 'gpt-5-fast';
      assignment.reasoning = 'minimal';
    }
    this.modelAssignments.set(agentName, assignment);
  }

  /**
   * Create enhanced sub-agent node with V2 capabilities
   */
  createEnhancedSubAgentNode(agentName, agentData) {
    return async (state) => {
      const startTime = Date.now();
      
      return await OpenTelemetryTracing.traceAgentOperation(
        agentName,
        'v2.sub_agent_processing',
        {
          'agent.name': agentName,
          'agent.model': agentData.config.model,
          'user.id': state.user_id || 'anonymous'
        },
        async () => {
          try {
            // Execute agent with V2 enhancements
            const result = await agentData.instance.execute(
              state.messages, 
              state.user_id,
              { 
                v2Enhanced: true, 
                modelConfig: agentData.config,
                private_state: state.private_state[agentName] || {}
              }
            );

            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.updateAgentPerformanceMetrics(agentName, responseTime, true);

            return {
              messages: result.messages || [],
              next_agent: 'cartrita',
              tools_used: result.tools_used || [],
              private_state: { [agentName]: result.private_state || {} },
              v2_metadata: {
                agent: agentName,
                model: agentData.config.model,
                enhanced: true,
                responseTime
              }
            };

          } catch (error) {
            console.error(`[EnhancedGPT5Supervisor] Agent ${agentName} execution failed:`, error);
            this.updateAgentPerformanceMetrics(agentName, Date.now() - startTime, false);
            return this.createAgentErrorResponse(agentName, error, state);
          }
        }
      );
    };
  }

  /**
   * Update individual agent performance metrics
   */
  updateAgentPerformanceMetrics(agentName, responseTime, success) {
    const assignment = this.modelAssignments.get(agentName);
    if (!assignment) return;

    const metrics = assignment.performanceMetrics;
    
    // Update response time average
    if (metrics.averageResponseTime === 0) {
      metrics.averageResponseTime = responseTime;
    } else {
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
    }
    
    // Update success rate
    metrics.successRate = (metrics.successRate + (success ? 100 : 0)) / 2;
    
    assignment.lastUsed = new Date().toISOString();
    this.modelAssignments.set(agentName, assignment);
  }

  /**
   * Get enhanced V2 metrics including GPT-5 specific data
   */
  getEnhancedMetrics() {
    const baseMetrics = this.metrics;
    const modelMetrics = {};
    
    // Compile per-agent model performance
    for (const [agentName, assignment] of this.modelAssignments) {
      modelMetrics[agentName] = {
        model: assignment.model,
        reasoning: assignment.reasoning,
        lastUsed: assignment.lastUsed,
        performance: assignment.performanceMetrics
      };
    }
    
    return {
      ...baseMetrics,
      v2_enhancements: {
        gpt5_service_active: this.gpt5Service.initialized,
        dynamic_model_assignment: true,
        intelligent_verbosity: true,
        advanced_reasoning: true
      },
      agent_models: modelMetrics,
      gpt5_metrics: this.gpt5Service.getMetrics()
    };
  }

  /**
   * Process enhanced request (main entry point)
   */
  async processEnhancedRequest(messages, userId = null) {
    if (!this.isInitialized) {
      throw new Error('EnhancedGPT5SupervisorAgent not initialized');
    }

    const startTime = Date.now();

    try {
      const result = await this.stateGraph.invoke({
        messages: Array.isArray(messages) ? messages : [new HumanMessage({ content: messages })],
        user_id: userId,
        private_state: {},
        tools_used: [],
        v2_metadata: {}
      });

      const responseTime = Date.now() - startTime;
      
      this.metrics.successful_responses++;
      this.metrics.user_interactions++;
      
      console.log(`[EnhancedGPT5Supervisor] ✅ Enhanced request processed in ${responseTime}ms with V2 features`);
      
      return {
        ...result,
        v2_enhanced: true,
        performance: { responseTime },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.metrics.failed_responses++;
      console.error('[EnhancedGPT5Supervisor] Enhanced request processing failed:', error);
      throw error;
    }
  }

  /**
   * Create enhanced error response
   */
  createErrorResponse(error, state) {
    return {
      messages: [new AIMessage({ 
        content: "I apologize, mi amor, but I encountered an issue processing your request. My V2 systems are working to resolve this. Please try again in a moment. 💫",
        metadata: { error: true, v2Enhanced: true }
      })],
      next_agent: 'END',
      v2_metadata: {
        error: error.message,
        timestamp: new Date().toISOString(),
        recovery_attempted: true
      }
    };
  }

  /**
   * Create agent-specific error response
   */
  createAgentErrorResponse(agentName, error, state) {
    return {
      messages: [new AIMessage({
        content: `I had a brief issue with my ${agentName} specialist, but I'm handling your request directly instead, honey. 🌟`,
        metadata: { agent_error: true, failed_agent: agentName, v2Enhanced: true }
      })],
      next_agent: 'cartrita',
      private_state: {},
      v2_metadata: {
        agent_error: agentName,
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

export default EnhancedGPT5SupervisorAgent;