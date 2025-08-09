/**
 * @fileoverview HuggingFace Language Agent - Wrapper for HF text models
 * Integrates with integrations/huggingface/agents/LanguageMaestroAgent.js
 */

import { Logger, TaskRequest, TaskResponse, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Import existing LanguageMaestroAgent
const { LanguageMaestroAgent } = await import('../../../../integrations/huggingface/agents/LanguageMaestroAgent.js');

export interface HuggingFaceConfig {
  apiKey?: string;
}

/**
 * HuggingFace Language Agent - performs text processing tasks
 */
export class HuggingFaceLanguageAgent {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('huggingface-language-agent');
  private languageMaestro: any;
  private isInitialized = false;

  constructor(private config: HuggingFaceConfig = {}) {
    this.logger = Logger.create('HuggingFaceLanguageAgent');
  }

  async initialize(): Promise<void> {
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
      this.logger.error('Failed to initialize HuggingFace Language Agent', error as Error);
      throw error;
    }
  }

  /**
   * Execute HuggingFace text task
   */
  async execute(request: TaskRequest, context: any): Promise<TaskResponse> {
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

      let result: any;

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
          throw new Error(`Unsupported HuggingFace task type: ${request.taskType}`);
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
      
      span.recordException(error as Error);
      this.logger.error('HuggingFace task failed', error as Error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });

      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
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

  private async performTextGeneration(parameters: any): Promise<any> {
    const { text, model = 'gpt2', options = {} } = parameters;
    
    return await this.languageMaestro.generateText({
      input: text,
      model,
      ...options,
    });
  }

  private async performTextClassification(parameters: any): Promise<any> {
    const { text, model = 'distilbert-base-uncased-finetuned-sst-2-english' } = parameters;
    
    return await this.languageMaestro.classifyText({
      input: text,
      model,
    });
  }

  private async performTextSummarization(parameters: any): Promise<any> {
    const { text, model = 'facebook/bart-large-cnn', options = {} } = parameters;
    
    return await this.languageMaestro.summarizeText({
      input: text,
      model,
      ...options,
    });
  }

  private async performTextTranslation(parameters: any): Promise<any> {
    const { text, sourceLanguage = 'en', targetLanguage = 'fr', model } = parameters;
    
    return await this.languageMaestro.translateText({
      input: text,
      sourceLanguage,
      targetLanguage,
      model,
    });
  }

  private async performQuestionAnswering(parameters: any): Promise<any> {
    const { question, context, model = 'distilbert-base-cased-distilled-squad' } = parameters;
    
    return await this.languageMaestro.answerQuestion({
      question,
      context,
      model,
    });
  }

  private estimateCost(taskType: string, result: any): number {
    // Basic cost estimation for HuggingFace inference
    return 0.001; // Very low cost for HF inference API
  }

  private estimateTokens(result: any): number {
    if (!result) return 0;
    
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }
}