/**
 * @fileoverview LangChain Agent Executor
 * Wraps LangChain functionality from node_modules and existing backend
 */
import { Logger, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
/**
 * LangChain Agent Executor - handles LangChain-based tasks
 */
export class LangChainAgentExecutor {
  config;
  logger;
  tracer = trace.getTracer('langchain-executor');
  isInitialized = false;
  chatModel;
  agentExecutor;
  constructor(config = {}) {
    this.config = config;
    this.logger = Logger.create('LangChainAgentExecutor');
  }
  async initialize() {
    if (this.isInitialized) return;
    try {
      this.logger.info('Initializing LangChain Agent Executor...');
      // Dynamic import to avoid bundling issues
      const { ChatOpenAI } = await import('@langchain/openai');
      const { AgentExecutor, createOpenAIFunctionsAgent } = await import(
        'langchain/agents'
      );
      const { pull } = await import('langchain/hub');
      const { TavilySearchResults } = await import(
        '@langchain/community/tools/tavily_search'
      );
      // Initialize OpenAI chat model
      this.chatModel = new ChatOpenAI({
        openAIApiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
        modelName: this.config.model || 'gpt-4o',
        temperature: this.config.temperature || 0.1,
        organization:
          this.config.organization || process.env.OPENAI_ORGANIZATION,
      });
      // Initialize tools
      const tools = [
        new TavilySearchResults({
          maxResults: 5,
          apiKey: process.env.TAVILY_API_KEY,
        }),
      ];
      // Get prompt template
      const prompt = await pull('hwchase17/openai-functions-agent');
      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm: this.chatModel,
        tools,
        prompt,
      });
      // Create agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: process.env.NODE_ENV === 'development',
        maxIterations: 10,
        returnIntermediateSteps: true,
      });
      this.isInitialized = true;
      this.logger.info('LangChain Agent Executor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LangChain Agent Executor', error);
      throw error;
    }
  }
  /**
   * Execute LangChain task
   */
  async execute(request, context) {
    const span = this.tracer.startSpan('langchain.executor.execute', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });
    const startTime = performance.now();
    try {
      this.logger.info('Executing LangChain task', {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      let result;
      switch (request.taskType) {
        case 'langchain.agent.execute':
          result = await this.executeAgent(request.parameters);
          break;
        case 'langchain.chat.execute':
          result = await this.executeChat(request.parameters);
          break;
        case 'langchain.react.execute':
          result = await this.executeReAct(request.parameters);
          break;
        default:
          throw new Error(
            `Unsupported LangChain task type: ${request.taskType}`
          );
      }
      const processingTime = performance.now() - startTime;
      span.setAttributes({
        'task.success': true,
        'task.processing_time_ms': processingTime,
      });
      return {
        taskId: request.taskId,
        status: TaskStatus.COMPLETED,
        result,
        metrics: {
          processingTimeMs: Math.round(processingTime),
          queueTimeMs: 0,
          retryCount: 0,
          costUsd: this.estimateCost(result),
          tokensUsed: this.estimateTokens(result),
          customMetrics: {
            stepsCount: result.intermediateSteps?.length || 0,
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      span.recordException(error);
      this.logger.error('LangChain task failed', error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: error.message,
        errorCode: 'LANGCHAIN_ERROR',
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
   * Execute agent with tools
   */
  async executeAgent(parameters) {
    const { input, tools = [] } = parameters;
    if (!input) {
      throw new Error('Input is required for agent execution');
    }
    try {
      const result = await this.agentExecutor.invoke({
        input,
        chat_history: parameters.chatHistory || [],
      });
      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps || [],
        metadata: {
          model: this.config.model || 'gpt-4o',
          timestamp: new Date().toISOString(),
          toolsUsed: this.extractToolsUsed(result.intermediateSteps),
        },
      };
    } catch (error) {
      this.logger.error('Agent execution failed', error, { input });
      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }
  /**
   * Execute simple chat
   */
  async executeChat(parameters) {
    const { message, history = [], model } = parameters;
    if (!message) {
      throw new Error('Message is required for chat execution');
    }
    try {
      // Use the chat model directly for simple conversations
      const { HumanMessage, AIMessage } = await import(
        '@langchain/core/messages'
      );
      const messages = [
        ...history.map(msg =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
        ),
        new HumanMessage(message),
      ];
      const result = await this.chatModel.invoke(messages);
      return {
        message: result.content,
        role: 'assistant',
        metadata: {
          model: model || this.config.model || 'gpt-4o',
          timestamp: new Date().toISOString(),
          tokens: result.usage?.total_tokens || null,
        },
      };
    } catch (error) {
      this.logger.error('Chat execution failed', error, { message });
      throw new Error(`Chat execution failed: ${error.message}`);
    }
  }
  /**
   * Execute ReAct (Reasoning + Acting) pattern
   */
  async executeReAct(parameters) {
    const { question, context = {} } = parameters;
    if (!question) {
      throw new Error('Question is required for ReAct execution');
    }
    try {
      // Use agent executor for ReAct pattern
      const result = await this.agentExecutor.invoke({
        input: `Using the ReAct pattern, think step by step and act to answer: ${question}`,
        ...context,
      });
      return {
        answer: result.output,
        reasoning: this.extractReasoning(result.intermediateSteps),
        actions: this.extractActions(result.intermediateSteps),
        metadata: {
          model: this.config.model || 'gpt-4o',
          timestamp: new Date().toISOString(),
          stepsCount: result.intermediateSteps?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error('ReAct execution failed', error, { question });
      throw new Error(`ReAct execution failed: ${error.message}`);
    }
  }
  /**
   * Extract tools used from intermediate steps
   */
  extractToolsUsed(intermediateSteps) {
    if (!intermediateSteps) return [];
    return intermediateSteps
      .map(step => step[0]?.tool)
      .filter(tool => tool)
      .map(tool => (typeof tool === 'string' ? tool : tool.name || 'unknown'));
  }
  /**
   * Extract reasoning steps
   */
  extractReasoning(intermediateSteps) {
    if (!intermediateSteps) return [];
    return intermediateSteps
      .map(step => step[0]?.log)
      .filter(log => log && log.includes('Thought:'))
      .map(log => log.split('Thought:')[1]?.split('Action:')[0]?.trim())
      .filter(thought => thought);
  }
  /**
   * Extract actions taken
   */
  extractActions(intermediateSteps) {
    if (!intermediateSteps) return [];
    return intermediateSteps.map(step => ({
      tool: step[0]?.tool || 'unknown',
      input: step[0]?.toolInput || {},
      output: step[1] || null,
    }));
  }
  /**
   * Estimate cost based on model usage
   */
  estimateCost(result) {
    // Basic cost estimation for OpenAI models
    const modelCosts = {
      'gpt-4': 0.03 / 1000, // $0.03 per 1K tokens
      'gpt-4o': 0.005 / 1000, // $0.005 per 1K tokens
      'gpt-3.5-turbo': 0.002 / 1000, // $0.002 per 1K tokens
    };
    const model = this.config.model || 'gpt-4o';
    const costPerToken = modelCosts[model] || modelCosts['gpt-4o'];
    const estimatedTokens = this.estimateTokens(result);
    return costPerToken * estimatedTokens;
  }
  /**
   * Estimate tokens used
   */
  estimateTokens(result) {
    if (!result) return 0;
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}
