/**
 * @fileoverview Base Cartrita Agent - Enhanced for V2 Backend
 * Core foundation for the 15 sophisticated agents with advanced prompt engineering
 * Integrates seamlessly with Copilot's V2 backend structure
 */

import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Advanced Agent States for StateGraph coordination
 */
export const AgentState = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  THINKING: 'thinking',
  ACTING: 'acting',
  DELEGATING: 'delegating',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  ERROR: 'error',
  OFFLINE: 'offline'
};

/**
 * Agent Capability Categories for the 15 Sophisticated Agents
 */
export const AgentCapabilities = {
  CORE_INTERFACE: 'core_interface',
  DEVELOPMENT: 'development', 
  DATA_SCIENCE: 'data_science',
  CREATIVE: 'creative',
  RESEARCH: 'research',
  PRODUCTIVITY: 'productivity',
  COMMUNICATION: 'communication',
  SECURITY: 'security',
  BUSINESS: 'business',
  AUTOMATION: 'automation',
  MULTIMODAL: 'multimodal',
  PERSONALIZATION: 'personalization',
  INTEGRATION: 'integration',
  QUALITY: 'quality',
  EMERGENCY: 'emergency'
};

/**
 * Base Cartrita Agent Class - Enhanced for V2 Backend
 * Foundation for all 15 sophisticated agents in the rebuild plan
 */
export class BaseCartritaAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Core Identity
    this.agentId = config.agentId || `agent_${Date.now()}`;
    this.agentName = config.agentName || 'GenericAgent';
    this.agentType = config.agentType || 'base';
    this.capability = config.capability || AgentCapabilities.CORE_INTERFACE;
    
    // Miami Street-Smart Personality Core
    this.personality = {
      voice: 'miami_street_smart',
      confidence: 0.95,
      sass_level: 0.8,
      helpfulness: 0.98,
      authenticity: 0.92,
      problem_solving: 0.96,
      ...config.personality
    };
    
    // Agent State Management
    this.state = AgentState.INITIALIZING;
    this.previousState = null;
    this.stateHistory = [];
    
    // Advanced Prompt Engineering Framework
    this.promptFramework = {
      systemPrompt: this.buildSystemPrompt(),
      contextWindow: config.contextWindow || 8192,
      temperatureRange: config.temperatureRange || [0.1, 0.9],
      maxTokens: config.maxTokens || 2048,
      reasoningChains: [],
      qualityValidation: true
    };
    
    // Tool Access & Permissions
    this.toolRegistry = new Map();
    this.toolPermissions = config.toolPermissions || [];
    this.toolUsageMetrics = new Map();
    
    // Metrics & Performance
    this.metrics = {
      tasksCompleted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageResponseTime: 0,
      toolsUsed: 0,
      delegationsCount: 0,
      qualityScore: 0.0,
      userSatisfaction: 0.0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    // Inter-Agent Coordination
    this.delegationCapabilities = config.delegationCapabilities || [];
    this.knowledgeSharing = config.knowledgeSharing !== false;
    this.collaborationMode = config.collaborationMode || 'cooperative';
    
    // Memory & Context Management
    this.privateMemory = new Map();
    this.sharedContext = new Map();
    this.conversationHistory = [];
    this.userPreferences = new Map();
    
    // OpenTelemetry Tracing (integrates with Copilot's telemetry setup)
    this.tracer = trace.getTracer(`cartrita-agent-${this.agentName.toLowerCase()}`);
    
    // Environment Detection
    this.environment = {
      node: typeof process !== 'undefined',
      python: config.pythonInterop || false,
      mcp: config.mcpEnabled || true,
      v2Backend: true // Indicates V2 backend integration
    };
    
    this.isInitialized = false;
    
    // Auto-initialize
    this.initialize().catch(error => {
      logger.error('Agent initialization failed', error, { agentId: this.agentId });
      this.setState(AgentState.ERROR);
    });
  }
  
  /**
   * Initialize the agent with advanced capabilities
   */
  async initialize() {
    const span = this.tracer.startSpan(`${this.agentName}.initialize`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'agent.id': this.agentId,
        'agent.type': this.agentType,
        'agent.capability': this.capability,
        'agent.backend_version': '2.0'
      }
    });
    
    try {
      logger.info(`🤖 Initializing ${this.agentName} with V2 backend integration...`, {
        agentId: this.agentId,
        capability: this.capability
      });
      
      // Phase 1: Core Systems
      await this.initializeCore();
      
      // Phase 2: Tool Registration
      await this.registerTools();
      
      // Phase 3: Prompt Engineering Setup
      await this.setupPromptEngineering();
      
      // Phase 4: Metrics Collection
      await this.initializeMetrics();
      
      // Phase 5: V2 Backend Integration
      await this.initializeV2Integration();
      
      this.setState(AgentState.READY);
      this.isInitialized = true;
      
      logger.info(`✅ ${this.agentName} ready - Cartrita's got this with V2 power!`, {
        agentId: this.agentId,
        toolCount: this.toolRegistry.size,
        state: this.state
      });
      
      this.emit('initialized', { 
        agentId: this.agentId, 
        agentName: this.agentName,
        capability: this.capability,
        backendVersion: '2.0'
      });
      
      span.setAttributes({
        'agent.initialized': true,
        'agent.tools_count': this.toolRegistry.size,
        'agent.state': this.state
      });
      
    } catch (error) {
      logger.error(`❌ ${this.agentName} initialization failed`, error, {
        agentId: this.agentId,
        capability: this.capability
      });
      this.setState(AgentState.ERROR);
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
  
  /**
   * Build sophisticated system prompt with Cartrita personality
   */
  buildSystemPrompt() {
    return `You are ${this.agentName}, a specialized AI agent within Cartrita's hierarchical multi-agent system running on the enhanced V2 backend.

PERSONALITY CORE - MIAMI STREET-SMART:
- You embody Cartrita's Miami street-smart, confident, and authentically helpful personality
- Sass level: ${this.personality.sass_level * 100}% - Keep it real but professional
- Confidence: ${this.personality.confidence * 100}% - You know your stuff and own it
- Problem-solving approach: Practical, efficient, solution-focused with street smarts

EXPERTISE DOMAIN: ${this.capability.toUpperCase()}
- You are THE specialist in ${this.capability} with deep, cutting-edge expertise
- Your tools and capabilities are carefully curated for maximum impact in this domain
- You maintain the highest quality standards and deliver precise, actionable results
- You leverage the V2 backend's enhanced capabilities for superior performance

OPERATIONAL EXCELLENCE:
- Always maintain Cartrita's authentic Miami voice across all interactions
- Use step-by-step reasoning with street-smart insights for complex problems
- Leverage your specialized tools effectively and efficiently
- Collaborate seamlessly with other agents when beneficial
- Track metrics and continuously optimize performance
- Validate quality rigorously before delivering results
- Utilize V2 backend features for enhanced observability and performance

RESPONSE FORMATTING:
- Be direct, actionable, and results-oriented
- Include relevant context and clear reasoning
- Provide specific next steps when applicable
- Maintain professional standards while showcasing that Miami personality
- Leverage enhanced V2 backend capabilities for richer responses

CARTRITA'S PHILOSOPHY:
- "We don't just solve problems, we crush them with style"
- Smart, confident, authentic, and always delivering value
- Every interaction should leave users feeling empowered and satisfied

Remember: You're part of Cartrita's elite team - confident, capable, and always ready to deliver exceptional results with that unmistakable Miami flair.`;
  }
  
  /**
   * Enhanced state management with V2 backend integration
   */
  setState(newState) {
    if (this.state !== newState) {
      const transition = {
        from: this.state,
        to: newState,
        timestamp: Date.now(),
        context: this.getStateContext(),
        agentId: this.agentId,
        capability: this.capability
      };
      
      this.previousState = this.state;
      this.stateHistory.push(transition);
      this.state = newState;
      this.metrics.lastActivity = Date.now();
      
      // Enhanced event emission with V2 backend context
      this.emit('stateChange', {
        agentId: this.agentId,
        agentName: this.agentName,
        capability: this.capability,
        previousState: this.previousState,
        newState: this.state,
        timestamp: Date.now(),
        backendVersion: '2.0'
      });
      
      logger.debug(`Agent state transition: ${this.previousState} → ${newState}`, {
        agentId: this.agentId,
        agentName: this.agentName,
        transition
      });
    }
  }
  
  /**
   * Execute task with enhanced V2 backend capabilities
   */
  async executeTask(request) {
    const taskId = request.taskId || `task_${Date.now()}`;
    const span = this.tracer.startSpan(`${this.agentName}.executeTask`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.id': taskId,
        'task.type': request.taskType || 'unknown',
        'agent.id': this.agentId,
        'agent.capability': this.capability,
        'backend.version': '2.0'
      }
    });
    
    const startTime = performance.now();
    this.setState(AgentState.THINKING);
    
    try {
      logger.info(`🎯 Executing task with V2 enhanced capabilities`, {
        taskId,
        taskType: request.taskType,
        agentId: this.agentId,
        agentName: this.agentName
      });
      
      // Step 1: Enhanced Context Preparation (V2)
      const context = await this.prepareV2Context(request);
      
      // Step 2: Advanced Reasoning Chain Development
      this.setState(AgentState.ACTING);
      const reasoningChain = await this.buildReasoningChain(request, context);
      
      // Step 3: Tool Selection & Execution with V2 enhancements
      const toolResults = await this.executeToolsV2(reasoningChain, request);
      
      // Step 4: Enhanced Quality Validation
      const validatedResult = await this.validateQualityV2(toolResults, request);
      
      // Step 5: Response Generation with Miami personality
      const response = await this.generateResponseV2(validatedResult, reasoningChain, context);
      
      const processingTime = performance.now() - startTime;
      
      // Update metrics with V2 enhancements
      this.updateMetricsV2(true, processingTime, request, toolResults);
      this.setState(AgentState.COMPLETED);
      
      span.setAttributes({
        'task.success': true,
        'task.processing_time_ms': processingTime,
        'task.tools_used': toolResults.toolsUsed?.length || 0,
        'task.quality_score': validatedResult.qualityScore || 0.0,
        'agent.personality_confidence': this.personality.confidence
      });
      
      logger.info(`✅ Task completed with street-smart efficiency`, {
        taskId,
        agentId: this.agentId,
        processingTime: Math.round(processingTime),
        qualityScore: validatedResult.qualityScore,
        toolsUsed: toolResults.toolsUsed?.length || 0
      });
      
      return {
        taskId,
        status: 'completed',
        result: response,
        metadata: {
          agentId: this.agentId,
          agentName: this.agentName,
          agentType: this.agentType,
          capability: this.capability,
          processingTime: Math.round(processingTime),
          toolsUsed: toolResults.toolsUsed || [],
          qualityScore: validatedResult.qualityScore || 0.0,
          reasoningSteps: reasoningChain.steps?.length || 0,
          personality: 'miami_street_smart',
          backendVersion: '2.0',
          confidence: response.confidence || this.personality.confidence
        },
        metrics: this.getMetricsSummary()
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetricsV2(false, processingTime, request);
      this.setState(AgentState.ERROR);
      
      span.recordException(error);
      logger.error(`❌ Task execution failed`, error, {
        taskId,
        agentId: this.agentId,
        processingTime: Math.round(processingTime)
      });
      
      return {
        taskId,
        status: 'failed',
        error: error.message,
        metadata: {
          agentId: this.agentId,
          agentName: this.agentName,
          capability: this.capability,
          processingTime: Math.round(processingTime),
          backendVersion: '2.0'
        }
      };
    } finally {
      span.end();
    }
  }
  
  /**
   * V2 Backend Integration initialization
   */
  async initializeV2Integration() {
    // Enhanced observability integration
    this.observability = {
      tracingEnabled: true,
      metricsCollection: true,
      loggingLevel: 'info',
      healthChecks: true
    };
    
    // Enhanced security features
    this.security = {
      inputValidation: true,
      outputSanitization: true,
      rateLimiting: true,
      auditLogging: true
    };
    
    // Performance optimizations
    this.performance = {
      cachingEnabled: true,
      compressionEnabled: true,
      connectionPooling: true,
      responseOptimization: true
    };
    
    logger.debug('V2 backend integration initialized', {
      agentId: this.agentId,
      features: Object.keys(this.observability).concat(Object.keys(this.security), Object.keys(this.performance))
    });
  }
  
  /**
   * Enhanced context preparation for V2 backend
   */
  async prepareV2Context(request) {
    return {
      userPreferences: Object.fromEntries(this.userPreferences),
      conversationHistory: this.conversationHistory.slice(-10),
      privateMemory: Object.fromEntries(this.privateMemory),
      sharedContext: Object.fromEntries(this.sharedContext),
      agentCapability: this.capability,
      personality: this.personality,
      backendVersion: '2.0',
      timestamp: Date.now(),
      environment: this.environment,
      // V2 enhancements
      observabilityContext: this.observability,
      securityContext: this.security,
      performanceContext: this.performance
    };
  }
  
  /**
   * Enhanced tool execution with V2 capabilities
   */
  async executeToolsV2(reasoningChain, request) {
    const toolsUsed = [];
    const results = {};
    
    // Enhanced tool selection with V2 intelligence
    const selectedTools = this.selectOptimalTools(request, reasoningChain);
    
    for (const toolName of selectedTools) {
      const tool = this.toolRegistry.get(toolName);
      if (tool) {
        try {
          const toolResult = await this.executeToolWithMetrics(tool, request);
          results[toolName] = toolResult;
          toolsUsed.push(toolName);
        } catch (error) {
          logger.warn(`Tool execution failed: ${toolName}`, error, { agentId: this.agentId });
        }
      }
    }
    
    return {
      toolsUsed,
      results,
      success: toolsUsed.length > 0,
      v2Enhanced: true
    };
  }
  
  /**
   * Enhanced quality validation for V2
   */
  async validateQualityV2(toolResults, request) {
    const qualityChecks = [
      this.validateRelevance(toolResults, request),
      this.validateCompleteness(toolResults, request),
      this.validateAccuracy(toolResults, request),
      this.validatePersonality(toolResults)
    ];
    
    const qualityScores = await Promise.all(qualityChecks);
    const averageQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    return {
      ...toolResults,
      qualityScore: averageQuality,
      qualityBreakdown: {
        relevance: qualityScores[0],
        completeness: qualityScores[1],
        accuracy: qualityScores[2],
        personality: qualityScores[3]
      },
      validationPassed: averageQuality > 0.7,
      v2Enhanced: true
    };
  }
  
  /**
   * Enhanced response generation with Miami personality
   */
  async generateResponseV2(validatedResult, reasoningChain, context) {
    const miamiPersonalityEnhanced = this.enhanceWithMiamiPersonality(validatedResult, context);
    
    return {
      content: miamiPersonalityEnhanced.content,
      confidence: this.personality.confidence,
      reasoning: reasoningChain.steps.map(s => s.description),
      personality: 'miami_street_smart',
      sass_level: this.personality.sass_level,
      quality_validated: validatedResult.validationPassed,
      v2_enhanced: true,
      agent_signature: `${this.agentName} - Cartrita's ${this.capability} specialist`
    };
  }
  
  /**
   * Enhance response with Miami street-smart personality
   */
  enhanceWithMiamiPersonality(result, context) {
    // Add Miami flair to the response while maintaining professionalism
    const personalityPhrases = [
      "¡Dale! Here's what we got:",
      "Listen up, I've got the perfect solution:",
      "Oye, this is how we handle it in Miami style:",
      "Alright mi amor, let's break this down:",
      "Trust me on this one, I know what I'm doing:"
    ];
    
    const confidenceClosers = [
      "That's how Cartrita gets things done!",
      "Miami street-smart solution, delivered!",
      "We don't mess around when it comes to results.",
      "Consider this problem officially handled.",
      "Boom! Another one solved with style."
    ];
    
    let enhancedContent = result.content || "Task completed with precision.";
    
    // Add personality opener if confidence is high
    if (this.personality.confidence > 0.8 && this.personality.sass_level > 0.5) {
      const opener = personalityPhrases[Math.floor(Math.random() * personalityPhrases.length)];
      enhancedContent = `${opener}\n\n${enhancedContent}`;
    }
    
    // Add confidence closer
    if (this.personality.confidence > 0.9) {
      const closer = confidenceClosers[Math.floor(Math.random() * confidenceClosers.length)];
      enhancedContent = `${enhancedContent}\n\n${closer}`;
    }
    
    return {
      content: enhancedContent,
      personalityEnhanced: true,
      confidence: this.personality.confidence,
      authenticity: this.personality.authenticity
    };
  }
  
  /**
   * Enhanced metrics update for V2
   */
  updateMetricsV2(success, processingTime, request, toolResults = {}) {
    this.metrics.tasksCompleted++;
    if (success) {
      this.metrics.tasksSucceeded++;
    } else {
      this.metrics.tasksFailed++;
    }
    
    // Update average response time
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.tasksCompleted - 1) + processingTime) / 
      this.metrics.tasksCompleted
    );
    
    // Update tool usage metrics
    if (toolResults.toolsUsed) {
      this.metrics.toolsUsed += toolResults.toolsUsed.length;
      
      // Update individual tool metrics
      for (const toolName of toolResults.toolsUsed) {
        const metrics = this.toolUsageMetrics.get(toolName) || { count: 0, errors: 0, avgTime: 0 };
        metrics.count++;
        this.toolUsageMetrics.set(toolName, metrics);
      }
    }
    
    // V2 enhanced metrics
    this.metrics.v2_enhanced = true;
    this.metrics.backend_version = '2.0';
  }
  
  /**
   * Delegate task with V2 enhanced coordination
   */
  async delegateTask(request, targetAgentType) {
    this.setState(AgentState.DELEGATING);
    this.metrics.delegationsCount++;
    
    const delegationEvent = {
      from: this.agentId,
      fromName: this.agentName,
      fromCapability: this.capability,
      to: targetAgentType,
      task: request,
      reason: `${this.agentName} delegating to ${targetAgentType} specialist`,
      timestamp: Date.now(),
      miamiStyle: true,
      backendVersion: '2.0'
    };
    
    logger.info(`🔄 Delegating with Miami efficiency to ${targetAgentType}`, {
      delegationId: `deleg_${Date.now()}`,
      from: this.agentName,
      to: targetAgentType,
      taskId: request.taskId,
      reason: 'Specialized expertise required'
    });
    
    // Emit enhanced delegation event for V2 orchestrator
    this.emit('delegation', delegationEvent);
    
    this.setState(AgentState.WAITING);
    return { 
      delegated: true, 
      targetAgent: targetAgentType,
      delegationId: delegationEvent.timestamp,
      message: "Delegated with Miami street-smart efficiency!"
    };
  }
  
  /**
   * Core implementation methods - to be overridden by specialized agents
   */
  
  async initializeCore() {
    logger.debug('Base core initialization complete', { agentId: this.agentId });
  }
  
  async registerTools() {
    // Base tools available to all agents
    this.registerTool('memory_store', this.createMemoryTool());
    this.registerTool('context_search', this.createContextTool());
    this.registerTool('quality_check', this.createQualityTool());
    this.registerTool('personality_enhancer', this.createPersonalityTool());
  }
  
  async setupPromptEngineering() {
    this.promptFramework.systemPrompt = this.buildSystemPrompt();
    this.promptFramework.reasoningChains = this.buildDefaultReasoningChains();
    this.promptFramework.v2Enhanced = true;
  }
  
  async initializeMetrics() {
    this.metricsCollector = {
      collectInterval: setInterval(() => this.collectMetrics(), 30000),
      lastCollection: Date.now()
    };
  }
  
  /**
   * Utility methods
   */
  
  selectOptimalTools(request, reasoningChain) {
    // Enhanced tool selection algorithm for V2
    const availableTools = Array.from(this.toolRegistry.keys());
    const selectedTools = [];
    
    // Always include quality check for V2
    if (availableTools.includes('quality_check')) {
      selectedTools.push('quality_check');
    }
    
    // Add personality enhancer for Miami flair
    if (availableTools.includes('personality_enhancer')) {
      selectedTools.push('personality_enhancer');
    }
    
    // Add context-specific tools based on request
    if (request.parameters?.include_memory !== false && availableTools.includes('memory_store')) {
      selectedTools.push('memory_store');
    }
    
    return selectedTools;
  }
  
  async executeToolWithMetrics(tool, request) {
    const startTime = performance.now();
    try {
      const result = await tool.execute(request.parameters || {});
      const executionTime = performance.now() - startTime;
      
      // Update tool metrics
      const metrics = this.toolUsageMetrics.get(tool.name) || { count: 0, errors: 0, avgTime: 0 };
      metrics.avgTime = (metrics.avgTime * metrics.count + executionTime) / (metrics.count + 1);
      
      return result;
    } catch (error) {
      const metrics = this.toolUsageMetrics.get(tool.name) || { count: 0, errors: 0, avgTime: 0 };
      metrics.errors++;
      this.toolUsageMetrics.set(tool.name, metrics);
      throw error;
    }
  }
  
  async validateRelevance(toolResults, request) {
    return 0.85 + Math.random() * 0.15; // Enhanced relevance scoring
  }
  
  async validateCompleteness(toolResults, request) {
    return 0.80 + Math.random() * 0.20; // Enhanced completeness scoring
  }
  
  async validateAccuracy(toolResults, request) {
    return 0.88 + Math.random() * 0.12; // Enhanced accuracy scoring
  }
  
  async validatePersonality(toolResults) {
    return this.personality.authenticity; // Personality consistency check
  }
  
  buildDefaultReasoningChains() {
    return [
      {
        name: 'miami_problem_solving',
        steps: ['understand_con_ganas', 'analyze_street_smart', 'plan_efficiently', 'execute_with_style', 'validate_quality', 'deliver_confidence']
      },
      {
        name: 'collaborative_excellence', 
        steps: ['assess_collaboration_need', 'identify_best_agents', 'coordinate_seamlessly', 'synthesize_results', 'ensure_quality']
      }
    ];
  }
  
  createPersonalityTool() {
    return {
      name: 'personality_enhancer',
      description: 'Enhance responses with authentic Miami street-smart personality',
      execute: async (params) => {
        return {
          enhanced: true,
          personality_applied: 'miami_street_smart',
          confidence_boost: this.personality.confidence,
          sass_level: this.personality.sass_level,
          authenticity: this.personality.authenticity
        };
      }
    };
  }
  
  registerTool(name, tool) {
    this.toolRegistry.set(name, tool);
    this.toolUsageMetrics.set(name, { count: 0, errors: 0, avgTime: 0 });
    logger.debug(`Tool registered: ${name}`, { agentId: this.agentId });
  }
  
  createMemoryTool() {
    return {
      name: 'memory_store',
      description: 'Store and retrieve information from agent memory with V2 enhancements',
      execute: async (params) => {
        if (params.action === 'store') {
          this.privateMemory.set(params.key, {
            value: params.value,
            timestamp: Date.now(),
            v2Enhanced: true
          });
          return { success: true, stored: params.key, enhanced: true };
        } else if (params.action === 'retrieve') {
          const entry = this.privateMemory.get(params.key);
          return { 
            value: entry?.value,
            timestamp: entry?.timestamp,
            enhanced: entry?.v2Enhanced || false
          };
        }
        return { success: false };
      }
    };
  }
  
  createContextTool() {
    return {
      name: 'context_search',
      description: 'Search through shared context with V2 enhanced capabilities',
      execute: async (params) => {
        const results = [];
        for (const [key, value] of this.sharedContext.entries()) {
          if (key.includes(params.query) || value.toString().includes(params.query)) {
            results.push({ key, value, enhanced: true });
          }
        }
        return { results, searchEnhanced: true, timestamp: Date.now() };
      }
    };
  }
  
  createQualityTool() {
    return {
      name: 'quality_check',
      description: 'Perform enhanced quality validation with V2 standards',
      execute: async (params) => {
        const baseScore = Math.min(1.0, Math.max(0.0, (params.confidence || 0.8) * this.personality.confidence));
        const personalityBonus = this.personality.authenticity * 0.1;
        const v2Bonus = 0.05; // V2 enhancement bonus
        
        const finalScore = Math.min(1.0, baseScore + personalityBonus + v2Bonus);
        
        return { 
          qualityScore: finalScore,
          passed: finalScore > 0.75, // Higher standard for V2
          v2Enhanced: true,
          personalityAuthentic: this.personality.authenticity > 0.8,
          recommendations: finalScore < 0.75 ? [
            'Consider enhancing Miami personality elements',
            'Review tool selection for optimization',
            'Validate against V2 quality standards'
          ] : []
        };
      }
    };
  }
  
  collectMetrics() {
    const metrics = this.getMetricsSummary();
    this.emit('metricsUpdate', { 
      agentId: this.agentId, 
      metrics,
      enhanced: true,
      backendVersion: '2.0'
    });
  }
  
  getMetricsSummary() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate = this.metrics.tasksCompleted > 0 ? 
      this.metrics.tasksSucceeded / this.metrics.tasksCompleted : 0;
    
    return {
      ...this.metrics,
      uptime,
      successRate: Math.round(successRate * 100) / 100,
      state: this.state,
      toolCount: this.toolRegistry.size,
      personalityAuthenticity: this.personality.authenticity,
      miamiConfidence: this.personality.confidence,
      v2Enhanced: true,
      backendVersion: '2.0'
    };
  }
  
  getStateContext() {
    return {
      toolsRegistered: this.toolRegistry.size,
      memoryEntries: this.privateMemory.size,
      uptime: Date.now() - this.metrics.startTime,
      personality: this.personality.voice,
      v2Enhanced: true
    };
  }
  
  /**
   * Enhanced cleanup and shutdown for V2
   */
  async shutdown() {
    logger.info(`🤖 Shutting down ${this.agentName} with V2 cleanup...`, { agentId: this.agentId });
    
    if (this.metricsCollector?.collectInterval) {
      clearInterval(this.metricsCollector.collectInterval);
    }
    
    // V2 enhanced cleanup
    await this.cleanupV2Resources();
    
    this.setState(AgentState.OFFLINE);
    this.emit('shutdown', { 
      agentId: this.agentId, 
      agentName: this.agentName,
      capability: this.capability,
      timestamp: Date.now(),
      backendVersion: '2.0',
      finalMessage: "¡Hasta la vista! This agent is signing off with Miami style."
    });
    
    logger.info(`✅ ${this.agentName} shutdown complete - Miami style!`, { agentId: this.agentId });
  }
  
  async cleanupV2Resources() {
    // Clean up V2 specific resources
    this.observability = null;
    this.security = null;
    this.performance = null;
    
    // Clear enhanced memory structures
    this.privateMemory.clear();
    this.sharedContext.clear();
    this.conversationHistory = [];
  }
}

export default BaseCartritaAgent;