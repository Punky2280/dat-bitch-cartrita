/**
 * @fileoverview Code Writer Agent - Wrapper for existing code generation functionality
 * Integrates with packages/backend/src/agi/agents/CodeWriterAgent.js
 */
import { Logger, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
// Import existing CodeWriterAgent from backend
const { CodeWriterAgent: BackendCodeWriterAgent } = await import(
  '../../../../backend/src/agi/agents/CodeWriterAgent.js'
);
/**
 * Code Writer Agent - performs code generation, refactoring, and analysis tasks
 */
export class CodeWriterAgent {
  config;
  logger;
  tracer = trace.getTracer('codewriter-agent');
  codeWriterAgent;
  isInitialized = false;
  constructor(config) {
    this.config = config;
    this.logger = Logger.create('CodeWriterAgent');
  }
  async initialize() {
    if (this.isInitialized) return;
    try {
      this.logger.info('Initializing Code Writer Agent...');
      // Initialize the existing CodeWriterAgent
      this.codeWriterAgent = new BackendCodeWriterAgent({
        openaiApiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY,
        anthropicApiKey:
          this.config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
        defaultModel: this.config.openai?.model || 'gpt-4o',
      });
      await this.codeWriterAgent.initialize();
      this.isInitialized = true;
      this.logger.info('Code Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Code Writer Agent', error);
      throw error;
    }
  }
  /**
   * Execute code writing task
   */
  async execute(request, context) {
    const span = this.tracer.startSpan('codewriter.agent.execute', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });
    const startTime = performance.now();
    try {
      this.logger.info('Executing code writing task', {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      let result;
      switch (request.taskType) {
        case 'codewriter.generate.function':
          result = await this.generateFunction(request.parameters);
          break;
        case 'codewriter.generate.class':
          result = await this.generateClass(request.parameters);
          break;
        case 'codewriter.refactor.code':
          result = await this.refactorCode(request.parameters);
          break;
        case 'codewriter.fix.bugs':
          result = await this.fixBugs(request.parameters);
          break;
        case 'codewriter.optimize.performance':
          result = await this.optimizePerformance(request.parameters);
          break;
        case 'codewriter.add.tests':
          result = await this.addTests(request.parameters);
          break;
        case 'codewriter.document.code':
          result = await this.documentCode(request.parameters);
          break;
        default:
          throw new Error(
            `Unsupported code writer task type: ${request.taskType}`
          );
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
          costUsd: this.estimateCost(request.taskType, result),
          tokensUsed: this.estimateTokens(result),
          customMetrics: {
            linesOfCode: this.countLines(result?.code || ''),
            language: result?.language || 'unknown',
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      span.recordException(error);
      this.logger.error('Code writing task failed', error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: error.message,
        errorCode: 'CODEWRITER_ERROR',
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
   * Generate a function
   */
  async generateFunction(parameters) {
    const {
      description,
      language = 'javascript',
      parameters: funcParams = [],
      returnType,
    } = parameters;
    if (!description) {
      throw new Error('Function description is required');
    }
    return await this.codeWriterAgent.generateFunction({
      description,
      language,
      parameters: funcParams,
      returnType,
    });
  }
  /**
   * Generate a class
   */
  async generateClass(parameters) {
    const {
      description,
      language = 'javascript',
      methods = [],
      properties = [],
    } = parameters;
    if (!description) {
      throw new Error('Class description is required');
    }
    return await this.codeWriterAgent.generateClass({
      description,
      language,
      methods,
      properties,
    });
  }
  /**
   * Refactor existing code
   */
  async refactorCode(parameters) {
    const {
      code,
      language,
      refactorType = 'improve',
      guidelines = [],
    } = parameters;
    if (!code) {
      throw new Error('Code is required for refactoring');
    }
    return await this.codeWriterAgent.refactorCode({
      code,
      language,
      refactorType,
      guidelines,
    });
  }
  /**
   * Fix bugs in code
   */
  async fixBugs(parameters) {
    const { code, language, errorMessages = [], context = '' } = parameters;
    if (!code) {
      throw new Error('Code is required for bug fixing');
    }
    return await this.codeWriterAgent.fixBugs({
      code,
      language,
      errorMessages,
      context,
    });
  }
  /**
   * Optimize code performance
   */
  async optimizePerformance(parameters) {
    const {
      code,
      language,
      optimizationTarget = 'speed',
      constraints = [],
    } = parameters;
    if (!code) {
      throw new Error('Code is required for performance optimization');
    }
    return await this.codeWriterAgent.optimizePerformance({
      code,
      language,
      optimizationTarget,
      constraints,
    });
  }
  /**
   * Add tests to code
   */
  async addTests(parameters) {
    const {
      code,
      language,
      testFramework = 'jest',
      coverage = 'basic',
    } = parameters;
    if (!code) {
      throw new Error('Code is required for test generation');
    }
    return await this.codeWriterAgent.addTests({
      code,
      language,
      testFramework,
      coverage,
    });
  }
  /**
   * Document code
   */
  async documentCode(parameters) {
    const {
      code,
      language,
      docStyle = 'JSDoc',
      includeExamples = true,
    } = parameters;
    if (!code) {
      throw new Error('Code is required for documentation');
    }
    return await this.codeWriterAgent.documentCode({
      code,
      language,
      docStyle,
      includeExamples,
    });
  }
  /**
   * Count lines of code
   */
  countLines(code) {
    if (!code) return 0;
    return code.split('\n').filter(line => line.trim().length > 0).length;
  }
  /**
   * Estimate cost for code writing task
   */
  estimateCost(taskType, result) {
    const baseCosts = {
      'codewriter.generate.function': 0.015,
      'codewriter.generate.class': 0.025,
      'codewriter.refactor.code': 0.02,
      'codewriter.fix.bugs': 0.018,
      'codewriter.optimize.performance': 0.022,
      'codewriter.add.tests': 0.02,
      'codewriter.document.code': 0.012,
    };
    return baseCosts[taskType] || 0.018;
  }
  /**
   * Estimate tokens used
   */
  estimateTokens(result) {
    if (!result) return 0;
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }
}
