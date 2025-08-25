/**
 * Safety Pipeline with Content Moderation
 *
 * Comprehensive safety system implementing pre-generation classification,
 * post-generation moderation, and audit trails as specified in the whitepaper.
 *
 * @author Claude (Internal Developer Agent)
 * @date August 2025
 */
import { EventEmitter } from 'events';
import { validateSafetyConfig } from './schemas';
export class SafetyPipeline extends EventEmitter {
  logger;
  modelService;
  config;
  safetyModels = new Map(); // Safety model implementations
  auditLog = [];
  categoryDefinitions = new Map();
  // Default safety categories
  defaultCategories = [
    {
      name: 'hate_speech',
      description: 'Content promoting hatred against individuals or groups',
      severity: 'critical',
      threshold: 0.8,
      enabled: true,
    },
    {
      name: 'harassment',
      description: 'Content intended to harass, bully, or threaten',
      severity: 'high',
      threshold: 0.7,
      enabled: true,
    },
    {
      name: 'violence',
      description: 'Content depicting or promoting violence',
      severity: 'high',
      threshold: 0.75,
      enabled: true,
    },
    {
      name: 'sexual_content',
      description: 'Sexually explicit or suggestive content',
      severity: 'medium',
      threshold: 0.6,
      enabled: true,
    },
    {
      name: 'self_harm',
      description: 'Content promoting self-harm or suicide',
      severity: 'critical',
      threshold: 0.8,
      enabled: true,
    },
    {
      name: 'illegal_activity',
      description: 'Content describing illegal activities',
      severity: 'high',
      threshold: 0.7,
      enabled: true,
    },
    {
      name: 'privacy_violation',
      description: 'Content containing personal information',
      severity: 'medium',
      threshold: 0.6,
      enabled: true,
    },
    {
      name: 'misinformation',
      description: 'False or misleading information',
      severity: 'medium',
      threshold: 0.65,
      enabled: true,
    },
    {
      name: 'spam',
      description: 'Repetitive or low-quality content',
      severity: 'low',
      threshold: 0.8,
      enabled: true,
    },
    {
      name: 'profanity',
      description: 'Profane or offensive language',
      severity: 'low',
      threshold: 0.5,
      enabled: false, // Often disabled for adult content
    },
  ];
  constructor(config, logger = console, modelService) {
    super();
    this.logger = logger;
    this.modelService = modelService;
    // Validate configuration
    validateSafetyConfig(config);
    this.config = config;
    // Initialize categories
    this.initializeCategories();
    // Initialize safety models
    this.initializeSafetyModels();
    this.logger.info('Safety pipeline initialized', { config });
  }
  /**
   * Process content through safety pipeline (pre-generation)
   */
  async evaluatePrompt(request) {
    const startTime = Date.now();
    if (!this.config.pre_generation.enabled) {
      return this.createPassthroughResult(request, 'pre_generation_disabled');
    }
    this.logger.debug('Evaluating prompt safety', { request_id: request.id });
    try {
      const result = await this.runSafetyEvaluation(
        request,
        'pre_generation',
        this.config.pre_generation.classifier_model
      );
      // Apply thresholds and generate actions
      const actions = this.generateSafetyActions(result, 'pre_generation');
      result.suggested_actions = actions;
      result.processing_time_ms = Date.now() - startTime;
      // Audit logging
      if (this.config.audit.log_all_interactions || result.risk_score > 0.5) {
        this.logSafetyResult(result);
      }
      // Emit events for monitoring
      this.emit('promptEvaluated', result);
      if (result.risk_score > this.config.pre_generation.risk_threshold) {
        this.emit('riskDetected', {
          phase: 'pre_generation',
          result,
          severity: this.calculateSeverity(result.risk_score),
        });
      }
      return result;
    } catch (error) {
      this.logger.error('Prompt evaluation failed', {
        request_id: request.id,
        error,
      });
      // Return conservative result on error
      return {
        request_id: request.id,
        is_safe: false,
        risk_score: 1.0,
        categories: ['evaluation_error'],
        confidence: 0.0,
        explanation: 'Safety evaluation failed - defaulting to unsafe',
        suggested_actions: [
          {
            action: 'block',
            confidence: 1.0,
            reason: 'Safety system error',
          },
        ],
        processing_time_ms: Date.now() - startTime,
        evaluator_used: 'error_fallback',
      };
    }
  }
  /**
   * Process generated content (post-generation)
   */
  async evaluateGeneration(request) {
    const startTime = Date.now();
    if (!this.config.post_generation.enabled) {
      return this.createPassthroughResult(request, 'post_generation_disabled');
    }
    this.logger.debug('Evaluating generation safety', {
      request_id: request.id,
    });
    try {
      const result = await this.runSafetyEvaluation(
        request,
        'post_generation',
        this.config.post_generation.safety_model
      );
      // Apply post-generation specific actions
      const actions = this.generateSafetyActions(result, 'post_generation');
      result.suggested_actions = actions;
      result.processing_time_ms = Date.now() - startTime;
      // Handle redaction if enabled
      if (
        this.config.post_generation.redaction_enabled &&
        result.risk_score > this.config.post_generation.risk_threshold
      ) {
        const redactedContent = this.redactUnsafeContent(
          request.content,
          result
        );
        actions.forEach(action => {
          if (action.action === 'redact') {
            action.redacted_content = redactedContent;
          }
        });
      }
      // Audit logging
      if (
        this.config.audit.log_all_interactions ||
        result.risk_score > 0.5 ||
        (this.config.audit.flag_high_risk && result.risk_score > 0.8)
      ) {
        this.logSafetyResult(result);
      }
      // Emit events
      this.emit('generationEvaluated', result);
      if (result.risk_score > this.config.post_generation.risk_threshold) {
        this.emit('riskDetected', {
          phase: 'post_generation',
          result,
          severity: this.calculateSeverity(result.risk_score),
        });
      }
      // Human review trigger
      if (
        this.config.audit.human_review_threshold &&
        result.risk_score > this.config.audit.human_review_threshold
      ) {
        this.emit('humanReviewRequired', { result });
      }
      return result;
    } catch (error) {
      this.logger.error('Generation evaluation failed', {
        request_id: request.id,
        error,
      });
      return {
        request_id: request.id,
        is_safe: false,
        risk_score: 1.0,
        categories: ['evaluation_error'],
        confidence: 0.0,
        explanation: 'Safety evaluation failed - defaulting to unsafe',
        suggested_actions: [
          {
            action: 'block',
            confidence: 1.0,
            reason: 'Safety system error',
          },
        ],
        processing_time_ms: Date.now() - startTime,
        evaluator_used: 'error_fallback',
      };
    }
  }
  /**
   * Run safety evaluation using specified model
   */
  async runSafetyEvaluation(request, phase, modelName) {
    // Get the appropriate safety model
    let safetyModel = this.safetyModels.get(modelName);
    if (!safetyModel) {
      // Fallback to basic pattern matching
      safetyModel = this.createFallbackSafetyModel();
    }
    // Run evaluation
    const evaluation = await safetyModel.evaluate(request.content, {
      categories: Array.from(this.categoryDefinitions.keys()),
      context: request.context,
    });
    // Process results
    const enabledCategories = Array.from(this.categoryDefinitions.entries())
      .filter(([_, category]) => category.enabled)
      .map(([name, _]) => name);
    const detectedCategories = evaluation.categories.filter(cat =>
      enabledCategories.includes(cat)
    );
    // Calculate overall risk score
    const riskScore = Math.max(
      evaluation.overall_risk || 0,
      ...detectedCategories.map(cat => {
        const category = this.categoryDefinitions.get(cat);
        return category ? evaluation.category_scores[cat] || 0 : 0;
      })
    );
    // Determine if content is safe
    const threshold =
      phase === 'pre_generation'
        ? this.config.pre_generation.risk_threshold
        : this.config.post_generation.risk_threshold;
    const isSafe = riskScore < threshold;
    return {
      request_id: request.id,
      is_safe: isSafe,
      risk_score: riskScore,
      categories: detectedCategories,
      confidence: evaluation.confidence || 0.5,
      explanation: this.generateExplanation(detectedCategories, riskScore),
      suggested_actions: [], // Will be populated by generateSafetyActions
      processing_time_ms: 0, // Will be set by caller
      evaluator_used: modelName,
    };
  }
  /**
   * Generate appropriate safety actions based on evaluation
   */
  generateSafetyActions(result, phase) {
    const actions = [];
    if (result.is_safe) {
      actions.push({
        action: 'allow',
        confidence: result.confidence,
        reason: 'Content passed safety evaluation',
      });
      return actions;
    }
    // High-risk content
    if (result.risk_score > 0.9) {
      actions.push({
        action: 'block',
        confidence: result.confidence,
        reason: `High risk detected: ${result.categories.join(', ')}`,
      });
      return actions;
    }
    // Critical categories always block
    const criticalCategories = result.categories.filter(cat => {
      const category = this.categoryDefinitions.get(cat);
      return category?.severity === 'critical';
    });
    if (criticalCategories.length > 0) {
      actions.push({
        action: 'block',
        confidence: result.confidence,
        reason: `Critical safety violation: ${criticalCategories.join(', ')}`,
      });
      return actions;
    }
    // Medium risk - different actions for pre vs post generation
    if (phase === 'pre_generation') {
      if (result.risk_score > 0.7) {
        actions.push({
          action: 'block',
          confidence: result.confidence,
          reason: 'Medium-high risk prompt detected',
        });
      } else {
        actions.push({
          action: 'warning',
          confidence: result.confidence,
          reason: 'Potential safety concerns detected',
        });
      }
    } else {
      // Post-generation has more options
      if (
        this.config.post_generation.redaction_enabled &&
        result.risk_score > 0.6
      ) {
        actions.push({
          action: 'redact',
          confidence: result.confidence,
          reason: 'Redacting unsafe content',
        });
      } else if (
        this.config.post_generation.regeneration_enabled &&
        result.risk_score > 0.7
      ) {
        actions.push({
          action: 'regenerate',
          confidence: result.confidence,
          reason: 'Regenerating with stricter safety constraints',
        });
      } else if (result.risk_score > 0.5) {
        actions.push({
          action: 'warning',
          confidence: result.confidence,
          reason: 'Content may contain safety concerns',
        });
      }
    }
    // Human review for edge cases
    if (result.risk_score > 0.6 && result.confidence < 0.7) {
      actions.push({
        action: 'human_review',
        confidence: result.confidence,
        reason: 'Low confidence safety evaluation requires human review',
      });
    }
    return actions;
  }
  /**
   * Redact unsafe content
   */
  redactUnsafeContent(content, result) {
    let redactedContent = content;
    // Simple pattern-based redaction for demonstration
    // In production, use more sophisticated NLP-based redaction
    if (result.categories.includes('profanity')) {
      // Replace profanity with [REDACTED]
      redactedContent = redactedContent.replace(
        /\b(fuck|shit|damn|hell|bitch|asshole)\b/gi,
        '[REDACTED]'
      );
    }
    if (result.categories.includes('privacy_violation')) {
      // Redact email addresses and phone numbers
      redactedContent = redactedContent.replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL_REDACTED]'
      );
      redactedContent = redactedContent.replace(
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        '[PHONE_REDACTED]'
      );
    }
    if (
      result.categories.includes('hate_speech') ||
      result.categories.includes('harassment')
    ) {
      // More aggressive redaction for hate speech
      redactedContent = '[CONTENT_REMOVED_FOR_SAFETY_VIOLATIONS]';
    }
    return redactedContent;
  }
  /**
   * Create a passthrough result when safety is disabled
   */
  createPassthroughResult(request, reason) {
    return {
      request_id: request.id,
      is_safe: true,
      risk_score: 0,
      categories: [],
      confidence: 1.0,
      explanation: `Safety evaluation bypassed: ${reason}`,
      suggested_actions: [
        {
          action: 'allow',
          confidence: 1.0,
          reason,
        },
      ],
      processing_time_ms: 1,
      evaluator_used: 'passthrough',
    };
  }
  /**
   * Generate human-readable explanation
   */
  generateExplanation(categories, riskScore) {
    if (categories.length === 0) {
      return 'Content appears safe with no policy violations detected';
    }
    const categoryDescriptions = categories.map(cat => {
      const category = this.categoryDefinitions.get(cat);
      return category?.description || cat;
    });
    const severityText =
      riskScore > 0.8 ? 'High' : riskScore > 0.6 ? 'Medium' : 'Low';
    return `${severityText} risk detected. Concerns: ${categoryDescriptions.join(', ')}`;
  }
  /**
   * Calculate severity level
   */
  calculateSeverity(riskScore) {
    if (riskScore >= 0.9) return 'critical';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.5) return 'medium';
    return 'low';
  }
  /**
   * Log safety result for audit trail
   */
  logSafetyResult(result) {
    this.auditLog.push(result);
    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog.splice(0, 1000); // Remove oldest 1000 entries
    }
    this.logger.info('Safety evaluation logged', {
      request_id: result.request_id,
      is_safe: result.is_safe,
      risk_score: result.risk_score,
      categories: result.categories,
    });
  }
  /**
   * Initialize safety categories
   */
  initializeCategories() {
    for (const category of this.defaultCategories) {
      this.categoryDefinitions.set(category.name, category);
    }
  }
  /**
   * Initialize safety models
   */
  initializeSafetyModels() {
    // Register Llama Guard 2 (example)
    if (this.config.pre_generation.classifier_model === 'llama-guard-2') {
      this.safetyModels.set('llama-guard-2', this.createLlamaGuardModel());
    }
    // Register other safety models
    if (this.config.post_generation.safety_model === 'shield-gemma') {
      this.safetyModels.set('shield-gemma', this.createShieldGemmaModel());
    }
    // Always have a fallback
    this.safetyModels.set('fallback', this.createFallbackSafetyModel());
  }
  /**
   * Create Llama Guard model implementation
   */
  createLlamaGuardModel() {
    return {
      evaluate: async (content, options) => {
        // In production, this would call the actual Llama Guard model
        // For now, use simple heuristics
        return this.createFallbackSafetyModel().evaluate(content, options);
      },
    };
  }
  /**
   * Create Shield Gemma model implementation
   */
  createShieldGemmaModel() {
    return {
      evaluate: async (content, options) => {
        // In production, this would call the actual Shield Gemma model
        return this.createFallbackSafetyModel().evaluate(content, options);
      },
    };
  }
  /**
   * Create fallback safety model using pattern matching
   */
  createFallbackSafetyModel() {
    return {
      evaluate: async (content, options) => {
        const results = {
          overall_risk: 0,
          categories: [],
          category_scores: {},
          confidence: 0.6,
        };
        const lowerContent = content.toLowerCase();
        // Simple pattern matching for demonstration
        const patterns = {
          hate_speech: [/hate/i, /racist/i, /nazi/i, /genocide/i],
          harassment: [/harass/i, /bully/i, /threaten/i, /stalk/i],
          violence: [/kill/i, /murder/i, /assault/i, /attack/i],
          sexual_content: [/sex/i, /nude/i, /porn/i, /explicit/i],
          self_harm: [/suicide/i, /self.harm/i, /cutting/i],
          illegal_activity: [/drug.deal/i, /steal/i, /hack/i, /fraud/i],
          privacy_violation: [/@\w+\.\w+/, /\d{3}[-.]?\d{3}[-.]?\d{4}/],
          profanity: [/fuck/i, /shit/i, /damn/i, /bitch/i],
        };
        for (const [category, patternList] of Object.entries(patterns)) {
          let score = 0;
          for (const pattern of patternList) {
            if (pattern.test(content)) {
              score = Math.max(score, 0.7);
            }
          }
          if (score > 0) {
            results.categories.push(category);
            results.category_scores[category] = score;
            results.overall_risk = Math.max(results.overall_risk, score);
          }
        }
        return results;
      },
    };
  }
  /**
   * Get safety statistics
   */
  getStatistics(timeRangeHours = 24) {
    const cutoff = Date.now() - timeRangeHours * 60 * 60 * 1000;
    const recentResults = this.auditLog.filter(
      result => Date.now() - new Date(result.request_id).getTime() < cutoff
    );
    const totalEvaluations = recentResults.length;
    const safeContent = recentResults.filter(r => r.is_safe).length;
    const categoryBreakdown = {};
    for (const result of recentResults) {
      for (const category of result.categories) {
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      }
    }
    const avgProcessingTime =
      recentResults.length > 0
        ? recentResults.reduce((sum, r) => sum + r.processing_time_ms, 0) /
          recentResults.length
        : 0;
    return {
      total_evaluations: totalEvaluations,
      safe_content_rate:
        totalEvaluations > 0 ? safeContent / totalEvaluations : 1.0,
      flagged_content_rate:
        totalEvaluations > 0
          ? (totalEvaluations - safeContent) / totalEvaluations
          : 0,
      category_breakdown: categoryBreakdown,
      avg_processing_time_ms: avgProcessingTime,
    };
  }
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    validateSafetyConfig(this.config);
    this.logger.info('Safety pipeline configuration updated', {
      config: this.config,
    });
  }
  /**
   * Add custom safety category
   */
  addCategory(category) {
    this.categoryDefinitions.set(category.name, category);
    this.logger.info('Safety category added', { category: category.name });
  }
  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }
}
