/**
 * @fileoverview HuggingFace Language Agent - Wrapper for HF text models
 * Integrates with integrations/huggingface/agents/LanguageMaestroAgent.js
 */
import { Logger, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
// Import existing LanguageMaestroAgent
const { LanguageMaestroAgent } = await import(
  '../../../../integrations/huggingface/agents/LanguageMaestroAgent.js'
);
/**
 * HuggingFace Language Agent - performs text processing tasks
 */
export class HuggingFaceLanguageAgent {
  config;
  logger;
  tracer = trace.getTracer('huggingface-language-agent');
  languageMaestro;
  isInitialized = false;
  constructor(config = {}) {
    this.config = config;
    this.logger = Logger.create('HuggingFaceLanguageAgent');
  }
  async initialize() {
    if (this.isInitialized) return;
    try {
      this.logger.info('Initializing HuggingFace Language Agent...');
      // Initialize the existing LanguageMaestroAgent
      this.languageMaestro = new LanguageMaestroAgent({
        apiKey: this.config.apiKey || process.env.HUGGINGFACE_API_KEY,
      });
      await this.languageMaestro.initialize();
      this.isInitialized = true;
      this.logger.info('HuggingFace Language Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize HuggingFace Language Agent',
        error
      );
      throw error;
    }
  }
  /**
   * Execute HuggingFace text task
   */
  async execute(request, context) {
    const span = this.tracer.startSpan('huggingface.language.execute', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });
    const startTime = performance.now();
    try {
      this.logger.info('Executing HuggingFace text task', {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      let result;
      switch (request.taskType) {
        case 'huggingface.text.generation':
          result = await this.performTextGeneration(request.parameters);
          break;
        case 'huggingface.text.classification':
          result = await this.performTextClassification(request.parameters);
          break;
        case 'huggingface.text.summarization':
          result = await this.performTextSummarization(request.parameters);
          break;
        case 'huggingface.text.translation':
          result = await this.performTextTranslation(request.parameters);
          break;
        case 'huggingface.text.question_answering':
          result = await this.performQuestionAnswering(request.parameters);
          break;
        default:
          throw new Error(
            `Unsupported HuggingFace task type: ${request.taskType}`
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
            modelUsed: result?.metadata?.model || 'unknown',
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      span.recordException(error);
      this.logger.error('HuggingFace task failed', error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });
      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: error.message,
        errorCode: 'HUGGINGFACE_ERROR',
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
  async performTextGeneration(parameters) {
    const { text, model = 'gpt2', options = {} } = parameters;
    return await this.languageMaestro.generateText({
      input: text,
      model,
      ...options,
    });
  }
  async performTextClassification(parameters) {
    const { text, model = 'distilbert-base-uncased-finetuned-sst-2-english' } =
      parameters;
    return await this.languageMaestro.classifyText({
      input: text,
      model,
    });
  }
  async performTextSummarization(parameters) {
    const {
      text,
      model = 'facebook/bart-large-cnn',
      options = {},
    } = parameters;
    return await this.languageMaestro.summarizeText({
      input: text,
      model,
      ...options,
    });
  }
  async performTextTranslation(parameters) {
    const {
      text,
      sourceLanguage = 'en',
      targetLanguage = 'fr',
      model,
    } = parameters;
    return await this.languageMaestro.translateText({
      input: text,
      sourceLanguage,
      targetLanguage,
      model,
    });
  }
  async performQuestionAnswering(parameters) {
    const {
      question,
      context,
      model = 'distilbert-base-cased-distilled-squad',
    } = parameters;
    return await this.languageMaestro.answerQuestion({
      question,
      context,
      model,
    });
  }
  estimateCost(taskType, result) {
    // Basic cost estimation for HuggingFace inference
    return 0.001; // Very low cost for HF inference API
  }
  estimateTokens(result) {
    if (!result) return 0;
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }
}
