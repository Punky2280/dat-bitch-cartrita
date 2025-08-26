/**
 * @fileoverview Cost Manager - Manages API costs and budgets for intelligence tasks
 */

import { Logger } from '../../core/index.js';

export interface CostManagerConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  budgets?: {
    daily?: number;
    monthly?: number;
  };
  models?: {
    [key: string]: {
      inputCostPer1k: number;
      outputCostPer1k: number;
    };
  };
}

export class CostManager {
  private readonly logger: Logger;
  private readonly modelCosts = {
    'gpt-4o': { inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
    'gpt-4': { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
    'gpt-3.5-turbo': { inputCostPer1k: 0.002, outputCostPer1k: 0.002 },
    'claude-3-opus': { inputCostPer1k: 0.015, outputCostPer1k: 0.075 },
    'claude-3-sonnet': { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    'claude-3-haiku': { inputCostPer1k: 0.00025, outputCostPer1k: 0.00125 },
  };

  constructor(private config: CostManagerConfig) {
    this.logger = Logger.create('CostManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Cost Manager initialized');
  }

  /**
   * Calculate cost for tokens
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const modelCost =
      this.modelCosts[model as keyof typeof this.modelCosts] ||
      this.modelCosts['gpt-4o'];

    const inputCost = (inputTokens / 1000) * modelCost.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * modelCost.outputCostPer1k;

    return inputCost + outputCost;
  }

  /**
   * Check if cost is within budget
   */
  async checkBudget(estimatedCost: number): Promise<boolean> {
    // Simple budget check - in production this would check against Redis/DB
    const dailyBudget = this.config.budgets?.daily || 100;
    return estimatedCost <= dailyBudget;
  }

  /**
   * Record cost
   */
  async recordCost(
    taskId: string,
    model: string,
    cost: number,
    tokens: { input: number; output: number }
  ): Promise<void> {
    this.logger.debug('Recording cost', { taskId, model, cost, tokens });
    // In production, this would store in Redis/DB
  }
}
