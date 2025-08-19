/**
 * @fileoverview Multimodal Agent Pool - Manages vision, audio, and multimodal agents
 */

import { Logger, TaskRequest, TaskResponse } from '../../core/index.js';
import { DeepgramAgent } from './deepgram-agent.js';

export interface MultiModalAgentPoolConfig {
  openai?: {
    apiKey?: string;
    organization?: string;
  };
  deepgram?: {
    apiKey?: string;
  };
  huggingface?: {
    apiKey?: string;
  };
}

export class MultiModalAgentPool {
  private readonly logger: Logger;
  private readonly agents = new Map<string, any>();
  private isInitialized = false;

  constructor() {
    this.logger = Logger.create('MultiModalAgentPool');
  }

  async initialize(config: MultiModalAgentPoolConfig): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing MultiModal Agent Pool...');

      // Initialize Deepgram agent
      const deepgramAgent = new DeepgramAgent({
        apiKey: config.deepgram?.apiKey,
      });
      await deepgramAgent.initialize();
      this.agents.set('deepgram', deepgramAgent);

      // TODO: Initialize other multimodal agents
      // - OpenAI Vision agent
      // - HuggingFace multimodal agents
      // - Artist agent for image generation

      this.isInitialized = true;
      this.logger.info(`MultiModal Agent Pool initialized with ${this.agents.size} agents`);
    } catch (error) {
      this.logger.error('Failed to initialize MultiModal Agent Pool', error as Error);
      throw error;
    }
  }

  /**
   * Get available agent for task type
   */
  async getAvailableAgent(taskType: string): Promise<any> {
    if (taskType.includes('deepgram')) {
      return this.agents.get('deepgram');
    }

    // Default to first available agent
    const agents = Array.from(this.agents.values());
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * Get pool status
   */
  async getStatus(): Promise<any> {
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
    };
  }

  /**
   * Shutdown agent pool
   */
  async shutdown(): Promise<void> {
    for (const [name, agent] of this.agents) {
      try {
        if (typeof agent.shutdown === 'function') {
          await agent.shutdown();
        }
        this.logger.debug(`Shutdown agent: ${name}`);
      } catch (error) {
        this.logger.warn(`Error shutting down agent ${name}`, error as Error);
      }
    }

    this.agents.clear();
    this.isInitialized = false;
    this.logger.info('MultiModal Agent Pool shutdown complete');
  }
}