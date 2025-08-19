/**
 * @fileoverview Quality Gate - Ensures task quality and validates outputs
 */

import { Logger, TaskRequest, TaskResponse } from '../../core/index.js';

export interface QualityGateConfig {
  enableContentFilter?: boolean;
  enableToxicityCheck?: boolean;
  enableFactCheck?: boolean;
  minConfidenceThreshold?: number;
}

export class QualityGate {
  private readonly logger: Logger;

  constructor(private config: QualityGateConfig = {}) {
    this.logger = Logger.create('QualityGate');
  }

  async initialize(): Promise<void> {
    this.logger.info('Quality Gate initialized');
  }

  /**
   * Pre-process request validation
   */
  async validateRequest(request: TaskRequest): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // Basic validation
    if (!request.taskId || !request.taskType) {
      return { valid: false, warnings: ['Missing required task ID or type'] };
    }

    // Content filtering (basic implementation)
    if (this.config.enableContentFilter && request.parameters?.input) {
      const hasInappropriateContent = this.checkInappropriateContent(request.parameters.input);
      if (hasInappropriateContent) {
        warnings.push('Content may contain inappropriate material');
      }
    }

    return { valid: true, warnings };
  }

  /**
   * Post-process response validation
   */
  async validateResponse(response: TaskResponse): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // Check confidence threshold
    if (this.config.minConfidenceThreshold) {
      const confidence = response.metrics?.customMetrics?.confidence;
      if (confidence && confidence < this.config.minConfidenceThreshold) {
        warnings.push(`Response confidence ${confidence} below threshold ${this.config.minConfidenceThreshold}`);
      }
    }

    // Check for toxicity (basic implementation)
    if (this.config.enableToxicityCheck && response.result) {
      const hasToxicity = this.checkToxicity(response.result);
      if (hasToxicity) {
        warnings.push('Response may contain toxic content');
      }
    }

    return { valid: true, warnings };
  }

  /**
   * Basic inappropriate content check
   */
  private checkInappropriateContent(text: string): boolean {
    const inappropriateTerms = ['violence', 'harmful', 'illegal']; // Simplified list
    return inappropriateTerms.some(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
  }

  /**
   * Basic toxicity check
   */
  private checkToxicity(result: any): boolean {
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    const toxicTerms = ['hate', 'threat', 'abuse']; // Simplified list
    return toxicTerms.some(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
  }
}