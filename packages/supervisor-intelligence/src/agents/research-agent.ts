/**
 * @fileoverview Research Agent - Wrapper for existing research functionality
 * Integrates with packages/backend/src/agi/agents/ResearcherAgent.js
 */

import { Logger, TaskRequest, TaskResponse, TaskStatus } from '@cartrita/mcp-core';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Import existing ResearcherAgent from backend
const { ResearcherAgent } = await import('../../../../backend/src/agi/agents/ResearcherAgent.js');

export interface ResearchAgentConfig {
  openai?: {
    apiKey?: string;
    organization?: string;
  };
  searchEngines?: {
    tavilyApiKey?: string;
    serpApiKey?: string;
    gnewsApiKey?: string;
  };
}

/**
 * Research Agent - performs web search and information gathering tasks
 */
export class ResearchAgent {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('research-agent');
  private researcherAgent: any;
  private isInitialized = false;

  constructor(private config: ResearchAgentConfig) {
    this.logger = Logger.create('ResearchAgent');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing Research Agent...');

      // Initialize the existing ResearcherAgent
      this.researcherAgent = new ResearcherAgent({
        openaiApiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY,
        tavilyApiKey: this.config.searchEngines?.tavilyApiKey || process.env.TAVILY_API_KEY,
        serpApiKey: this.config.searchEngines?.serpApiKey || process.env.SERPAPI_API_KEY,
        gnewsApiKey: this.config.searchEngines?.gnewsApiKey || process.env.GNEWS_API_KEY,
      });

      await this.researcherAgent.initialize();
      this.isInitialized = true;
      
      this.logger.info('Research Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Research Agent', error as Error);
      throw error;
    }
  }

  /**
   * Execute research task
   */
  async execute(request: TaskRequest, context: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('research.agent.execute', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'task.type': request.taskType,
        'task.id': request.taskId,
      },
    });

    const startTime = performance.now();

    try {
      this.logger.info('Executing research task', { 
        taskId: request.taskId,
        taskType: request.taskType,
        parameters: request.parameters,
      });

      let result: any;

      switch (request.taskType) {
        case 'research.web.search':
          result = await this.performWebSearch(request.parameters);
          break;
        case 'research.web.scrape':
          result = await this.performWebScrape(request.parameters);
          break;
        default:
          throw new Error(`Unsupported research task type: ${request.taskType}`);
      }

      const processingTime = performance.now() - startTime;

      span.setAttributes({
        'task.success': true,
        'task.processing_time_ms': processingTime,
      });

      this.logger.info('Research task completed successfully', {
        taskId: request.taskId,
        processingTimeMs: processingTime,
      });

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
            searchResultsCount: result?.results?.length || 0,
          },
        },
        warnings: [],
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      span.recordException(error as Error);
      span.setAttributes({
        'task.success': false,
        'task.error': (error as Error).message,
      });

      this.logger.error('Research task failed', error as Error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });

      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
        errorCode: 'RESEARCH_ERROR',
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
   * Perform web search
   */
  private async performWebSearch(parameters: any): Promise<any> {
    const { query, limit = 10, sources = ['tavily', 'serp'] } = parameters;

    if (!query) {
      throw new Error('Search query is required');
    }

    try {
      // Use the existing ResearcherAgent's search functionality
      const searchResults = await this.researcherAgent.performWebSearch({
        query,
        maxResults: limit,
        sources,
      });

      return {
        query,
        results: searchResults.results || [],
        totalResults: searchResults.totalResults || 0,
        searchTime: searchResults.searchTime || 0,
        sources: searchResults.sources || [],
        metadata: {
          timestamp: new Date().toISOString(),
          sources: searchResults.sourcesUsed || sources,
        },
      };
    } catch (error) {
      this.logger.error('Web search failed', error as Error, { query });
      throw new Error(`Web search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Perform web scraping
   */
  private async performWebScrape(parameters: any): Promise<any> {
    const { urls, extractors = ['text', 'links'] } = parameters;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('URLs array is required');
    }

    try {
      // Use the existing ResearcherAgent's scraping functionality
      const scrapeResults = await this.researcherAgent.scrapeUrls({
        urls,
        extractors,
      });

      return {
        urls,
        results: scrapeResults.map((result: any, index: number) => ({
          url: urls[index],
          title: result.title || '',
          content: result.content || '',
          links: result.links || [],
          metadata: result.metadata || {},
          success: !result.error,
          error: result.error || null,
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          totalUrls: urls.length,
          successfulScrapes: scrapeResults.filter((r: any) => !r.error).length,
        },
      };
    } catch (error) {
      this.logger.error('Web scraping failed', error as Error, { urls });
      throw new Error(`Web scraping failed: ${(error as Error).message}`);
    }
  }

  /**
   * Estimate cost for research task
   */
  private estimateCost(taskType: string, result: any): number {
    // Basic cost estimation
    const baseCosts = {
      'research.web.search': 0.01, // Per search
      'research.web.scrape': 0.005, // Per URL
    };

    const baseCost = baseCosts[taskType as keyof typeof baseCosts] || 0;
    
    if (taskType === 'research.web.scrape' && result?.results) {
      return baseCost * result.results.length;
    }
    
    return baseCost;
  }

  /**
   * Estimate tokens used
   */
  private estimateTokens(result: any): number {
    if (!result) return 0;
    
    const textContent = JSON.stringify(result);
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(textContent.length / 4);
  }
}