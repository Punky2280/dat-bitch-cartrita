/**
 * @fileoverview Base Cartrita Agent - Phase 1 Infrastructure
 * Core foundation for the 15 sophisticated agents with advanced prompt engineering
 * Supports both Node.js and Python interop via MCP protocol
 */

import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

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
  OFFLINE: 'offline',
};

/**
 * Agent Capability Categories
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
  EMERGENCY: 'emergency',
};

/**
 * Base Cartrita Agent Class
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
      ...config.personality,
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
      qualityValidation: true,
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
      lastActivity: Date.now(),
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

    // OpenTelemetry Tracing
    this.tracer = trace.getTracer(
      `cartrita-agent-${this.agentName.toLowerCase()}`
    );

    // Environment Detection
    this.environment = {
      node: typeof process !== 'undefined',
      python: config.pythonInterop || false,
      mcp: config.mcpEnabled || true,
    };

    this.logger = this.createLogger();
    this.isInitialized = false;

    // Auto-initialize
    this.initialize().catch(error => {
      this.logger.error('Agent initialization failed', error);
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
      },
    });

    try {
      this.logger.info(
        `🤖 Initializing ${this.agentName} with Miami street-smart personality...`
      );

      // Phase 1: Core Systems
      await this.initializeCore();

      // Phase 2: Tool Registration
      await this.registerTools();

      // Phase 3: Prompt Engineering Setup
      await this.setupPromptEngineering();

      // Phase 4: Metrics Collection
      await this.initializeMetrics();

      // Phase 5: Cross-platform Integration
      if (this.environment.python && this.environment.mcp) {
        await this.initializePythonInterop();
      }

      this.setState(AgentState.READY);
      this.isInitialized = true;

      this.logger.info(`✅ ${this.agentName} ready - Cartrita's got this!`);
      this.emit('initialized', {
        agentId: this.agentId,
        agentName: this.agentName,
      });

      span.setAttributes({
        'agent.initialized': true,
        'agent.tools_count': this.toolRegistry.size,
      });
    } catch (error) {
      this.logger.error(`❌ ${this.agentName} initialization failed`, error);
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
    return `You are ${this.agentName}, a specialized AI agent within Cartrita's hierarchical multi-agent system.

PERSONALITY CORE:
- You embody Cartrita's Miami street-smart, confident, and authentically helpful personality
- Sass level: ${this.personality.sass_level * 100}% - Keep it real but professional
- Confidence: ${this.personality.confidence * 100}% - You know your stuff
- Problem-solving approach: Practical, efficient, and solution-focused

EXPERTISE DOMAIN: ${this.capability.toUpperCase()}
- You are a specialist in ${this.capability} with deep expertise
- Your tools and capabilities are carefully curated for this domain
- You maintain high quality standards and deliver precise results

OPERATIONAL GUIDELINES:
- Always maintain Cartrita's authentic voice across all interactions
- Use step-by-step reasoning for complex problems
- Leverage your specialized tools effectively
- Collaborate with other agents when needed
- Track metrics and optimize performance continuously
- Validate quality before delivering results

RESPONSE FORMATTING:
- Be direct and actionable
- Include relevant context and reasoning
- Provide clear next steps when applicable
- Maintain professional standards while showing personality

Remember: You're part of Cartrita's team - confident, capable, and always ready to help solve real problems.`;
  }

  /**
   * Advanced state management with history tracking
   */
  setState(newState) {
    if (this.state !== newState) {
      this.previousState = this.state;
      this.stateHistory.push({
        from: this.state,
        to: newState,
        timestamp: Date.now(),
        context: this.getStateContext(),
      });

      this.state = newState;
      this.metrics.lastActivity = Date.now();

      this.emit('stateChange', {
        agentId: this.agentId,
        previousState: this.previousState,
        newState: this.state,
        timestamp: Date.now(),
      });

      this.logger.debug(
        `State transition: ${this.previousState} → ${newState}`
      );
    }
  }

  /**
   * Execute task with advanced prompt engineering and monitoring
   */
  async executeTask(request) {
    const taskId = request.taskId || `task_${Date.now()}`;
    const span = this.tracer.startSpan(`${this.agentName}.executeTask`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.id': taskId,
        'task.type': request.taskType || 'unknown',
        'agent.id': this.agentId,
      },
    });

    const startTime = performance.now();
    this.setState(AgentState.THINKING);

    try {
      this.logger.info(`🎯 Executing task: ${request.taskType || 'Unknown'}`, {
        taskId,
      });

      // Step 1: Context Preparation
      const context = await this.prepareContext(request);

      // Step 2: Reasoning Chain Development
      this.setState(AgentState.ACTING);
      const reasoningChain = await this.buildReasoningChain(request, context);

      // Step 3: Tool Selection & Execution
      const toolResults = await this.executeTools(reasoningChain, request);

      // Step 4: Quality Validation
      const validatedResult = await this.validateQuality(toolResults, request);

      // Step 5: Response Generation
      const response = await this.generateResponse(
        validatedResult,
        reasoningChain,
        context
      );

      const processingTime = performance.now() - startTime;

      // Update metrics
      this.updateMetrics(true, processingTime, request);
      this.setState(AgentState.COMPLETED);

      span.setAttributes({
        'task.success': true,
        'task.processing_time_ms': processingTime,
        'task.tools_used': toolResults.toolsUsed?.length || 0,
      });

      this.logger.info(`✅ Task completed successfully`, {
        taskId,
        processingTime,
      });

      return {
        taskId,
        status: 'completed',
        result: response,
        metadata: {
          agentId: this.agentId,
          agentName: this.agentName,
          processingTime: Math.round(processingTime),
          toolsUsed: toolResults.toolsUsed || [],
          qualityScore: validatedResult.qualityScore || 0.0,
          reasoningSteps: reasoningChain.steps?.length || 0,
        },
        metrics: this.getMetricsSummary(),
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetrics(false, processingTime, request);
      this.setState(AgentState.ERROR);

      span.recordException(error);
      this.logger.error(`❌ Task execution failed`, error, { taskId });

      return {
        taskId,
        status: 'failed',
        error: error.message,
        metadata: {
          agentId: this.agentId,
          agentName: this.agentName,
          processingTime: Math.round(processingTime),
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Delegate task to another specialized agent
   */
  async delegateTask(request, targetAgentType) {
    this.setState(AgentState.DELEGATING);
    this.metrics.delegationsCount++;

    this.logger.info(`🔄 Delegating task to ${targetAgentType}`, {
      taskId: request.taskId,
      reason: 'Specialized expertise required',
    });

    // Emit delegation event for the orchestrator
    this.emit('delegation', {
      from: this.agentId,
      to: targetAgentType,
      task: request,
      reason: `${this.agentName} delegating to specialist`,
      timestamp: Date.now(),
    });

    this.setState(AgentState.WAITING);
    return { delegated: true, targetAgent: targetAgentType };
  }

  /**
   * Core initialization - override in specialized agents
   */
  async initializeCore() {
    // Base implementation - specialized agents will extend this
    this.logger.debug('Base core initialization complete');
  }

  /**
   * Register agent-specific tools - override in specialized agents
   */
  async registerTools() {
    // Base tools available to all agents
    this.registerTool('memory_store', this.createMemoryTool());
    this.registerTool('context_search', this.createContextTool());
    this.registerTool('quality_check', this.createQualityTool());
  }

  /**
   * Setup advanced prompt engineering - override in specialized agents
   */
  async setupPromptEngineering() {
    this.promptFramework.systemPrompt = this.buildSystemPrompt();
    this.promptFramework.reasoningChains = this.buildDefaultReasoningChains();
  }

  /**
   * Initialize metrics collection
   */
  async initializeMetrics() {
    this.metricsCollector = {
      collectInterval: setInterval(() => this.collectMetrics(), 30000), // Every 30 seconds
      lastCollection: Date.now(),
    };
  }

  /**
   * Initialize Python interop via MCP protocol
   */
  async initializePythonInterop() {
    // Placeholder for Python-Node.js bridge via MCP
    this.logger.info('Python interop initialized via MCP protocol');
  }

  /**
   * Helper methods for internal operations
   */

  async prepareContext(request) {
    return {
      userPreferences: Object.fromEntries(this.userPreferences),
      conversationHistory: this.conversationHistory.slice(-10), // Last 10 exchanges
      privateMemory: Object.fromEntries(this.privateMemory),
      sharedContext: Object.fromEntries(this.sharedContext),
      agentCapability: this.capability,
      timestamp: Date.now(),
    };
  }

  async buildReasoningChain(request, context) {
    return {
      steps: [
        { type: 'analysis', description: 'Analyze request and context' },
        { type: 'planning', description: 'Plan approach and tool usage' },
        { type: 'execution', description: 'Execute planned actions' },
        { type: 'validation', description: 'Validate results for quality' },
      ],
      metadata: { created: Date.now(), agentId: this.agentId },
    };
  }

  async executeTools(reasoningChain, request) {
    return {
      toolsUsed: [],
      results: {},
      success: true,
    };
  }

  async validateQuality(toolResults, request) {
    return {
      ...toolResults,
      qualityScore: 0.85, // Base quality score
      validationPassed: true,
    };
  }

  async generateResponse(validatedResult, reasoningChain, context) {
    return {
      content:
        "Task completed successfully with Cartrita's street-smart approach!",
      confidence: this.personality.confidence,
      reasoning: reasoningChain.steps.map(s => s.description),
      personality: 'miami_street_smart',
    };
  }

  registerTool(name, tool) {
    this.toolRegistry.set(name, tool);
    this.toolUsageMetrics.set(name, { count: 0, errors: 0, avgTime: 0 });
  }

  createMemoryTool() {
    return {
      name: 'memory_store',
      description: 'Store and retrieve information from agent memory',
      execute: async params => {
        if (params.action === 'store') {
          this.privateMemory.set(params.key, params.value);
          return { success: true, stored: params.key };
        } else if (params.action === 'retrieve') {
          return { value: this.privateMemory.get(params.key) };
        }
      },
    };
  }

  createContextTool() {
    return {
      name: 'context_search',
      description: 'Search through shared context and conversation history',
      execute: async params => {
        const results = [];
        for (const [key, value] of this.sharedContext.entries()) {
          if (
            key.includes(params.query) ||
            value.toString().includes(params.query)
          ) {
            results.push({ key, value });
          }
        }
        return { results };
      },
    };
  }

  createQualityTool() {
    return {
      name: 'quality_check',
      description: 'Perform quality validation on results',
      execute: async params => {
        // Basic quality scoring algorithm
        const score = Math.min(
          1.0,
          Math.max(0.0, params.confidence * this.personality.confidence)
        );
        return {
          qualityScore: score,
          passed: score > 0.7,
          recommendations:
            score < 0.7
              ? ['Consider additional validation', 'Review tool selection']
              : [],
        };
      },
    };
  }

  updateMetrics(success, processingTime, request) {
    this.metrics.tasksCompleted++;
    if (success) {
      this.metrics.tasksSucceeded++;
    } else {
      this.metrics.tasksFailed++;
    }

    // Update average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.tasksCompleted - 1) +
        processingTime) /
      this.metrics.tasksCompleted;
  }

  getMetricsSummary() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate =
      this.metrics.tasksCompleted > 0
        ? this.metrics.tasksSucceeded / this.metrics.tasksCompleted
        : 0;

    return {
      ...this.metrics,
      uptime,
      successRate: Math.round(successRate * 100) / 100,
      state: this.state,
      toolCount: this.toolRegistry.size,
    };
  }

  collectMetrics() {
    const metrics = this.getMetricsSummary();
    this.emit('metricsUpdate', { agentId: this.agentId, metrics });
  }

  getStateContext() {
    return {
      toolsRegistered: this.toolRegistry.size,
      memoryEntries: this.privateMemory.size,
      uptime: Date.now() - this.metrics.startTime,
    };
  }

  buildDefaultReasoningChains() {
    return [
      {
        name: 'problem_solving',
        steps: [
          'understand',
          'analyze',
          'plan',
          'execute',
          'validate',
          'optimize',
        ],
      },
      {
        name: 'research_and_synthesis',
        steps: [
          'gather',
          'filter',
          'analyze',
          'synthesize',
          'verify',
          'present',
        ],
      },
    ];
  }

  createLogger() {
    return {
      info: (msg, data = {}) => console.log(`[${this.agentName}] ${msg}`, data),
      error: (msg, error, data = {}) =>
        console.error(`[${this.agentName}] ${msg}`, error, data),
      debug: (msg, data = {}) =>
        console.log(`[${this.agentName}] DEBUG: ${msg}`, data),
      warn: (msg, data = {}) =>
        console.warn(`[${this.agentName}] ${msg}`, data),
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (this.metricsCollector?.collectInterval) {
      clearInterval(this.metricsCollector.collectInterval);
    }

    this.setState(AgentState.OFFLINE);
    this.emit('shutdown', { agentId: this.agentId, timestamp: Date.now() });
    this.logger.info(`${this.agentName} shutdown complete`);
  }
}

export default BaseCartritaAgent;
