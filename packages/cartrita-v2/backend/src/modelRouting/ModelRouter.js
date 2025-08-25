/**
 * Model Routing Engine
 *
 * Intelligent model selection and routing system with composite scoring,
 * budget-aware degradation, and fallback mechanisms.
 *
 * @author Robbie or Robert Allen Lead Architect
 * @date August 2025
 */
import { EventEmitter } from 'events';
export class ModelRouter extends EventEmitter {
    costEstimator;
    logger;
    databaseClient;
    modelRegistry = new Map();
    modelMetrics = new Map();
    loadBalancer = new Map(); // Track model load
    // Predefined routing strategies
    routingStrategies = new Map([
        [
            'quality_first',
            {
                name: 'Quality First',
                description: 'Prioritize model quality over cost and latency',
                weights: {
                    quality: 0.6,
                    cost: 0.1,
                    latency: 0.1,
                    safety: 0.15,
                    availability: 0.05,
                },
                fallback_enabled: true,
                budget_aware: false,
            },
        ],
        [
            'cost_optimized',
            {
                name: 'Cost Optimized',
                description: 'Minimize cost while maintaining acceptable quality',
                weights: {
                    quality: 0.2,
                    cost: 0.5,
                    latency: 0.1,
                    safety: 0.15,
                    availability: 0.05,
                },
                fallback_enabled: true,
                budget_aware: true,
            },
        ],
        [
            'balanced',
            {
                name: 'Balanced',
                description: 'Balance quality, cost, and latency',
                weights: {
                    quality: 0.35,
                    cost: 0.25,
                    latency: 0.25,
                    safety: 0.1,
                    availability: 0.05,
                },
                fallback_enabled: true,
                budget_aware: true,
            },
        ],
        [
            'speed_first',
            {
                name: 'Speed First',
                description: 'Minimize latency for real-time applications',
                weights: {
                    quality: 0.2,
                    cost: 0.1,
                    latency: 0.5,
                    safety: 0.15,
                    availability: 0.05,
                },
                fallback_enabled: true,
                budget_aware: false,
            },
        ],
        [
            'safety_critical',
            {
                name: 'Safety Critical',
                description: 'Prioritize safety and compliance',
                weights: {
                    quality: 0.25,
                    cost: 0.1,
                    latency: 0.15,
                    safety: 0.45,
                    availability: 0.05,
                },
                fallback_enabled: false,
                budget_aware: false,
            },
        ],
    ]);
    constructor(costEstimator, logger = console, databaseClient) {
        super();
        this.costEstimator = costEstimator;
        this.logger = logger;
        this.databaseClient = databaseClient;
        this.loadDefaultStrategies();
    }
    /**
     * Select optimal model based on criteria and context
     */
    async selectModel(criteria, context, strategyName = 'balanced') {
        const requestId = this.generateRequestId();
        this.logger.info('Starting model selection', {
            requestId,
            criteria,
            context,
            strategy: strategyName,
        });
        const startTime = Date.now();
        try {
            // Get routing strategy
            const strategy = this.routingStrategies.get(strategyName) ||
                this.routingStrategies.get('balanced');
            // Get candidate models
            const candidates = await this.getCandidateModels(criteria, context);
            if (candidates.length === 0) {
                throw new Error(`No models available for task type: ${criteria.task_type}`);
            }
            // Score all candidates
            const scoredModels = await this.scoreModels(candidates, criteria, context, strategy);
            // Apply budget constraints if enabled
            const budgetFilteredModels = strategy.budget_aware
                ? await this.applyBudgetConstraints(scoredModels, context)
                : scoredModels;
            if (budgetFilteredModels.length === 0) {
                if (strategy.fallback_enabled) {
                    return this.selectFallbackModel(criteria, context, requestId);
                }
                throw new Error('No models available within budget constraints');
            }
            // Sort by composite score
            const rankedModels = budgetFilteredModels.sort((a, b) => b.scores.composite_score - a.scores.composite_score);
            // Select the best model
            const selectedModel = rankedModels[0];
            // Check availability and load balancing
            const finalSelection = await this.checkAvailabilityAndBalance(selectedModel, rankedModels.slice(1, 4), // Top 3 alternatives
            context);
            const result = {
                request_id: requestId,
                task_type: criteria.task_type,
                candidates: rankedModels.slice(0, 5).map(sm => ({
                    model_id: sm.model.model_id,
                    score: sm.scores.composite_score,
                    quality_score: sm.scores.quality_score,
                    cost_score: sm.scores.cost_score,
                    latency_score: sm.scores.latency_score,
                    composite_score: sm.scores.composite_score,
                })),
                selected: finalSelection.model.model_id,
                reason: finalSelection.reasoning.join('; '),
                fallback_available: strategy.fallback_enabled && rankedModels.length > 1,
                estimated_cost_usd: finalSelection.estimated_cost_usd,
                estimated_latency_ms: finalSelection.estimated_latency_ms,
            };
            const duration = Date.now() - startTime;
            this.logger.info('Model selection completed', {
                requestId,
                selected: result.selected,
                duration,
            });
            this.emit('modelSelected', result);
            return result;
        }
        catch (error) {
            this.logger.error('Model selection failed', { requestId, error });
            this.emit('modelSelectionError', { requestId, error });
            // Try emergency fallback
            if (strategyName !== 'cost_optimized') {
                this.logger.info('Attempting emergency fallback', { requestId });
                return this.selectFallbackModel(criteria, context, requestId);
            }
            throw error;
        }
    }
    /**
     * Get candidate models based on criteria
     */
    async getCandidateModels(criteria, context) {
        // In production, this would query the database
        const allModels = Array.from(this.modelRegistry.values());
        return allModels.filter(model => {
            // Basic filters
            if (model.status !== 'active')
                return false;
            if (!model.task_types.includes(criteria.task_type))
                return false;
            if (criteria.commercial_use && !model.commercial_allowed)
                return false;
            // Quality filter
            if (criteria.min_quality_score &&
                (!model.quality_metrics.composite_score ||
                    model.quality_metrics.composite_score < criteria.min_quality_score)) {
                return false;
            }
            // Cost filter
            if (criteria.max_cost_per_1k_tokens &&
                model.cost_profile.estimated_cost_per_1k_tokens_usd >
                    criteria.max_cost_per_1k_tokens) {
                return false;
            }
            // Latency filter
            if (criteria.max_latency_ms &&
                model.avg_latency_ms_512_tokens &&
                model.avg_latency_ms_512_tokens > criteria.max_latency_ms) {
                return false;
            }
            // Safety filter
            if (criteria.safety_required && model.safety_risk_level === 'high')
                return false;
            // Tag filters
            if (criteria.required_tags &&
                !criteria.required_tags.every(tag => model.routing_tags.includes(tag))) {
                return false;
            }
            if (criteria.excluded_tags &&
                criteria.excluded_tags.some(tag => model.routing_tags.includes(tag))) {
                return false;
            }
            // Context-specific filters
            if (context.safety_requirements?.max_risk_level) {
                const riskLevels = ['low', 'medium', 'high', 'critical'];
                const maxRiskIndex = riskLevels.indexOf(context.safety_requirements.max_risk_level);
                const modelRiskIndex = riskLevels.indexOf(model.safety_risk_level);
                if (modelRiskIndex > maxRiskIndex)
                    return false;
            }
            return true;
        });
    }
    /**
     * Score models using composite scoring algorithm
     */
    async scoreModels(candidates, criteria, context, strategy) {
        const scoredModels = [];
        for (const model of candidates) {
            const scores = await this.calculateModelScores(model, criteria, context);
            // Calculate composite score using strategy weights
            const compositeScore = scores.quality_score * strategy.weights.quality +
                scores.cost_score * strategy.weights.cost +
                scores.latency_score * strategy.weights.latency +
                scores.safety_score * strategy.weights.safety +
                scores.availability_score * strategy.weights.availability;
            // Estimate costs
            const estimatedCost = await this.estimateRequestCost(model, context);
            const estimatedLatency = this.estimateLatency(model, context);
            const reasoning = this.generateReasoning(model, scores, strategy);
            scoredModels.push({
                model,
                scores: {
                    ...scores,
                    composite_score: compositeScore,
                },
                estimated_cost_usd: estimatedCost,
                estimated_latency_ms: estimatedLatency,
                confidence: this.calculateConfidence(model),
                reasoning,
            });
        }
        return scoredModels;
    }
    /**
     * Calculate individual scores for a model
     */
    async calculateModelScores(model, criteria, context) {
        // Quality Score (0-1)
        const qualityScore = model.quality_metrics.composite_score || 0.5;
        // Cost Score (0-1, higher is better/cheaper)
        const costScore = this.calculateCostScore(model, criteria);
        // Latency Score (0-1, higher is better/faster)
        const latencyScore = this.calculateLatencyScore(model, criteria);
        // Safety Score (0-1, higher is safer)
        const safetyScore = this.calculateSafetyScore(model, context);
        // Availability Score (0-1, higher is more available)
        const availabilityScore = await this.calculateAvailabilityScore(model);
        return {
            quality_score: qualityScore,
            cost_score: costScore,
            latency_score: latencyScore,
            safety_score: safetyScore,
            availability_score: availabilityScore,
        };
    }
    /**
     * Calculate cost score (higher = cheaper/better)
     */
    calculateCostScore(model, criteria) {
        const costPer1k = model.cost_profile.estimated_cost_per_1k_tokens_usd;
        const maxCost = criteria.max_cost_per_1k_tokens || 0.1; // Default max
        // Inverse score: cheaper models get higher scores
        return Math.max(0, 1 - costPer1k / maxCost);
    }
    /**
     * Calculate latency score (higher = faster/better)
     */
    calculateLatencyScore(model, criteria) {
        const latency = model.avg_latency_ms_512_tokens || 2000; // Default if unknown
        const maxLatency = criteria.max_latency_ms || 5000; // Default max
        // Inverse score: lower latency gets higher scores
        return Math.max(0, 1 - latency / maxLatency);
    }
    /**
     * Calculate safety score (higher = safer)
     */
    calculateSafetyScore(model, context) {
        const riskLevels = { low: 1.0, medium: 0.7, high: 0.4, critical: 0.1 };
        let baseScore = riskLevels[model.safety_risk_level] || 0.5;
        // Bonus for models with safety features
        if (model.routing_tags.includes('safety'))
            baseScore += 0.1;
        if (model.routing_tags.includes('moderated'))
            baseScore += 0.1;
        return Math.min(1.0, baseScore);
    }
    /**
     * Calculate availability score
     */
    async calculateAvailabilityScore(model) {
        // Check current load
        const currentLoad = this.loadBalancer.get(model.model_id) || 0;
        const maxLoad = 100; // Configurable threshold
        let score = Math.max(0, 1 - currentLoad / maxLoad);
        // Historical availability (would query metrics in production)
        const uptime = 0.99; // Mock 99% uptime
        score *= uptime;
        return score;
    }
    /**
     * Apply budget constraints to scored models
     */
    async applyBudgetConstraints(scoredModels, context) {
        if (!context.budget_constraints?.max_cost_usd) {
            return scoredModels;
        }
        const maxCost = context.budget_constraints.max_cost_usd;
        return scoredModels.filter(sm => {
            if (sm.estimated_cost_usd > maxCost) {
                this.logger.debug('Model filtered by budget constraint', {
                    model: sm.model.model_id,
                    estimated_cost: sm.estimated_cost_usd,
                    max_cost: maxCost,
                });
                return false;
            }
            return true;
        });
    }
    /**
     * Check availability and perform load balancing
     */
    async checkAvailabilityAndBalance(primaryChoice, alternatives, context) {
        // Check if primary choice is overloaded
        const currentLoad = this.loadBalancer.get(primaryChoice.model.model_id) || 0;
        const loadThreshold = context.priority === 'critical' ? 80 : 60;
        if (currentLoad > loadThreshold && alternatives.length > 0) {
            this.logger.info('Primary model overloaded, selecting alternative', {
                primary: primaryChoice.model.model_id,
                current_load: currentLoad,
                threshold: loadThreshold,
            });
            // Find least loaded alternative
            const availableAlternative = alternatives.sort((a, b) => {
                const loadA = this.loadBalancer.get(a.model.model_id) || 0;
                const loadB = this.loadBalancer.get(b.model.model_id) || 0;
                return loadA - loadB;
            })[0];
            if (availableAlternative) {
                availableAlternative.reasoning.push('Selected due to load balancing');
                return availableAlternative;
            }
        }
        // Update load balancer
        this.loadBalancer.set(primaryChoice.model.model_id, currentLoad + 1);
        // Decay load over time (simple implementation)
        setTimeout(() => {
            const currentLoad = this.loadBalancer.get(primaryChoice.model.model_id) || 0;
            this.loadBalancer.set(primaryChoice.model.model_id, Math.max(0, currentLoad - 1));
        }, 60000); // 1 minute decay
        return primaryChoice;
    }
    /**
     * Select fallback model when primary selection fails
     */
    async selectFallbackModel(criteria, context, requestId) {
        this.logger.warn('Selecting fallback model', { requestId });
        // Use the most permissive criteria for fallback
        const fallbackCriteria = {
            ...criteria,
            quality_weight: 0.2,
            cost_weight: 0.6,
            latency_weight: 0.2,
            min_quality_score: undefined,
            max_cost_per_1k_tokens: undefined,
            max_latency_ms: undefined,
        };
        return this.selectModel(fallbackCriteria, context, 'cost_optimized');
    }
    /**
     * Estimate request cost
     */
    async estimateRequestCost(model, context) {
        // Rough estimation - in production would use more sophisticated logic
        const avgTokens = 1000; // Estimate based on context or task type
        return (model.cost_profile.estimated_cost_per_1k_tokens_usd * (avgTokens / 1000));
    }
    /**
     * Estimate latency
     */
    estimateLatency(model, context) {
        let baseLatency = model.avg_latency_ms_512_tokens || 2000;
        // Adjust for load
        const currentLoad = this.loadBalancer.get(model.model_id) || 0;
        const loadMultiplier = 1 + currentLoad / 100;
        return baseLatency * loadMultiplier;
    }
    /**
     * Generate reasoning for model selection
     */
    generateReasoning(model, scores, strategy) {
        const reasoning = [];
        if (scores.quality_score > 0.8) {
            reasoning.push('High quality score');
        }
        if (scores.cost_score > 0.8) {
            reasoning.push('Cost effective');
        }
        if (scores.latency_score > 0.8) {
            reasoning.push('Low latency');
        }
        if (model.routing_tags.includes('popular')) {
            reasoning.push('Popular model with good track record');
        }
        reasoning.push(`Optimized for ${strategy.name.toLowerCase()} strategy`);
        return reasoning;
    }
    /**
     * Calculate confidence score
     */
    calculateConfidence(model) {
        let confidence = 0.5; // Base confidence
        if (model.last_benchmark &&
            Date.now() - new Date(model.last_benchmark).getTime() <
                7 * 24 * 60 * 60 * 1000) {
            confidence += 0.2; // Recent benchmark
        }
        if (model.quality_metrics.composite_score) {
            confidence += 0.2; // Has quality metrics
        }
        if (model.routing_tags.includes('production')) {
            confidence += 0.1; // Production tested
        }
        return Math.min(1.0, confidence);
    }
    /**
     * Load default routing strategies
     */
    loadDefaultStrategies() {
        // Strategies are already defined in the constructor
        this.logger.info('Loaded routing strategies', {
            strategies: Array.from(this.routingStrategies.keys()),
        });
    }
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Register a model in the registry
     */
    registerModel(model) {
        this.modelRegistry.set(model.model_id, model);
        this.logger.info('Model registered', { model_id: model.model_id });
    }
    /**
     * Update model metrics
     */
    updateModelMetrics(modelId, metrics) {
        this.modelMetrics.set(modelId, metrics);
    }
    /**
     * Get routing strategy
     */
    getStrategy(name) {
        return this.routingStrategies.get(name);
    }
    /**
     * Add custom routing strategy
     */
    addStrategy(name, strategy) {
        this.routingStrategies.set(name, strategy);
        this.logger.info('Custom strategy added', { name });
    }
}
