/**
 * @fileoverview Writer Agent - Wrapper for existing writing functionality
 * Integrates with packages/backend/src/agi/agents/WriterAgent.js
 */

import { Logger, TaskRequest, TaskResponse, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Import existing WriterAgent from backend
const { WriterAgent: BackendWriterAgent } = await import('../../../../backend/src/agi/agents/WriterAgent.js');

export interface WriterAgentConfig {
  openai?: {
    apiKey?: string;
    organization?: string;
    model?: string;
  };
  anthropic?: {
    apiKey?: string;
    model?: string;
  };
}

/**
 * Writer Agent - performs content writing and editing tasks
 */
export class WriterAgent {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('writer-agent');
  private writerAgent: any;
  private isInitialized = false;

  constructor(private config: WriterAgentConfig) {
    this.logger = Logger.create('WriterAgent');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing Writer Agent...');

      // Initialize the existing WriterAgent
      this.writerAgent = new BackendWriterAgent({
        openaiApiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY,
        anthropicApiKey: this.config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
        defaultModel: this.config.openai?.model || 'gpt-4o',
      });

      await this.writerAgent.initialize();
      this.isInitialized = true;
      
      this.logger.info('Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Writer Agent', error as Error);
      throw error;
    }
  }

  /**
   * Execute writing task
   */
  async execute(request: TaskRequest, context: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('writer.agent.execute', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });

    const startTime = performance.now();

    try {
      this.logger.info('Executing writing task', { 
        taskId: request.taskId,
        taskType: request.taskType,
      });

      let result: any;

      switch (request.taskType) {
        case 'writer.content.create':
          result = await this.createContent(request.parameters);
          break;
        case 'writer.content.edit':
          result = await this.editContent(request.parameters);
          break;
        case 'writer.content.summarize':
          result = await this.summarizeContent(request.parameters);
          break;
        case 'writer.blog.post':
          result = await this.createBlogPost(request.parameters);
          break;
        case 'writer.email.compose':
          result = await this.composeEmail(request.parameters);
          break;
        default:
          throw new Error(`Unsupported writer task type: ${request.taskType}`);
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
            wordCount: this.countWords(result?.content || result?.text || ''),
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      span.recordException(error as Error);
      this.logger.error('Writing task failed', error as Error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });

      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
        errorCode: 'WRITER_ERROR',
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
   * Create new content
   */
  private async createContent(parameters: any): Promise<any> {
    const { prompt, tone = 'professional', length = 'medium', format = 'text' } = parameters;

    if (!prompt) {
      throw new Error('Prompt is required for content creation');
    }

    return await this.writerAgent.generateContent({
      prompt,
      tone,
      length,
      format,
    });
  }

  /**
   * Edit existing content
   */
  private async editContent(parameters: any): Promise<any> {
    const { content, instructions, style = 'maintain' } = parameters;

    if (!content || !instructions) {
      throw new Error('Content and instructions are required for editing');
    }

    return await this.writerAgent.editContent({
      content,
      instructions,
      style,
    });
  }

  /**
   * Summarize content
   */
  private async summarizeContent(parameters: any): Promise<any> {
    const { content, length = 'short', format = 'paragraph' } = parameters;

    if (!content) {
      throw new Error('Content is required for summarization');
    }

    return await this.writerAgent.summarizeContent({
      content,
      length,
      format,
    });
  }

  /**
   * Create blog post
   */
  private async createBlogPost(parameters: any): Promise<any> {
    const { topic, keywords = [], tone = 'engaging', length = 'medium' } = parameters;

    if (!topic) {
      throw new Error('Topic is required for blog post creation');
    }

    return await this.writerAgent.createBlogPost({
      topic,
      keywords,
      tone,
      length,
    });
  }

  /**
   * Compose email
   */
  private async composeEmail(parameters: any): Promise<any> {
    const { purpose, recipient, tone = 'professional', context = {} } = parameters;

    if (!purpose) {
      throw new Error('Purpose is required for email composition');
    }

    return await this.writerAgent.composeEmail({
      purpose,
      recipient,
      tone,
      context,
    });
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Estimate cost for writing task
   */
  private estimateCost(taskType: string, result: any): number {
    const baseCosts = {
      'writer.content.create': 0.02,
      'writer.content.edit': 0.015,
      'writer.content.summarize': 0.01,
      'writer.blog.post': 0.03,
      'writer.email.compose': 0.008,
    };

    return baseCosts[taskType as keyof typeof baseCosts] || 0.015;
  }

  /**
   * Estimate tokens used
   */
  private estimateTokens(result: any): number {
    if (!result) return 0;
    
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }
}