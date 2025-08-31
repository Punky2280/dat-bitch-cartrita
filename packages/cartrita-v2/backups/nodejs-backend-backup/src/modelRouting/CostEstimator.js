/**
 * Cost Estimation Utility
 *
 * Comprehensive cost calculation and estimation service implementing
 * multiple pricing models as specified in the MCP whitepaper.
 *
 * Formula: cost_per_1k = hourly_hardware_cost / ((tokens_per_second * 3600)/1000)
 *
 * @author Robbie or Robert Allen Lead Architect
 * @date August 2025
 */
import { EventEmitter } from 'events';
export class CostEstimator extends EventEmitter {
    logger;
    redisClient;
    costCache = new Map();
    CACHE_TTL_MS = 300000; // 5 minutes
    constructor(logger = console, redisClient // Optional Redis cache
    ) {
        super();
        this.logger = logger;
        this.redisClient = redisClient;
    }
    /**
     * Estimate cost for a model inference request
     */
    async estimateCost(context, model) {
        const cacheKey = this.generateCacheKey(context);
        // Check cache first
        const cached = this.getCachedCost(cacheKey);
        if (cached) {
            return cached;
        }
        let result;
        // Determine estimation method based on available data
        if (model?.cost_profile) {
            result = this.estimateFromCostProfile(context, model);
        }
        else if (context.hardware_hourly_usd &&
            context.measured_tokens_per_second) {
            result = this.estimateFromHardwareMetrics(context);
        }
        else {
            result = this.estimateFromFallbackMethod(context);
        }
        // Cache the result
        this.setCachedCost(cacheKey, result);
        this.logger.debug('Cost estimated', { context, result });
        this.emit('costEstimated', { context, result });
        return result;
    }
    /**
     * Estimate cost using model's cost profile
     */
    estimateFromCostProfile(context, model) {
        const profile = model.cost_profile;
        const totalTokens = context.tokens_in + context.tokens_out;
        let baseCostPer1k = profile.estimated_cost_per_1k_tokens_usd;
        let estimationMethod = `cost_profile_${profile.pricing_model}`;
        // Apply MoE efficiency factor if available
        if (profile.moe_efficiency_factor &&
            model.architectural_type === 'mixture-of-experts') {
            baseCostPer1k *= profile.moe_efficiency_factor;
            estimationMethod += '_moe_adjusted';
        }
        // Apply overhead factor for network and orchestration
        const overheadFactor = profile.overhead_factor || context.overhead_factor || 1.0;
        const overheadCost = baseCostPer1k * (overheadFactor - 1.0);
        const baseCost = baseCostPer1k * (totalTokens / 1000);
        const totalOverheadCost = overheadCost * (totalTokens / 1000);
        const totalCost = baseCost + totalOverheadCost;
        return {
            cost_usd: totalCost,
            cost_per_1k_tokens: baseCostPer1k + overheadCost,
            estimation_method: estimationMethod,
            breakdown: {
                base_cost: baseCost,
                overhead_cost: totalOverheadCost,
                efficiency_adjustment: 0,
                total_cost: totalCost,
            },
            confidence_level: 'high',
            factors_used: [
                'cost_profile',
                profile.moe_efficiency_factor ? 'moe_efficiency' : '',
                overheadFactor > 1.0 ? 'overhead_factor' : '',
            ].filter(Boolean),
        };
    }
    /**
     * Estimate cost from hardware metrics
     */
    estimateFromHardwareMetrics(context) {
        const tokensPerHour = context.measured_tokens_per_second * 3600;
        const costPer1k = context.hardware_hourly_usd / (tokensPerHour / 1000);
        // Apply overhead factor
        const overheadFactor = context.overhead_factor || 1.05; // Default 5% overhead
        const adjustedCostPer1k = costPer1k * overheadFactor;
        // Apply MoE efficiency if applicable
        const moeAdjustment = context.moe_efficiency_factor || 1.0;
        const finalCostPer1k = adjustedCostPer1k * moeAdjustment;
        const totalTokens = context.tokens_in + context.tokens_out;
        const baseCost = costPer1k * (totalTokens / 1000);
        const overheadCost = (adjustedCostPer1k - costPer1k) * (totalTokens / 1000);
        const efficiencyAdjustment = (finalCostPer1k - adjustedCostPer1k) * (totalTokens / 1000);
        const totalCost = finalCostPer1k * (totalTokens / 1000);
        return {
            cost_usd: totalCost,
            cost_per_1k_tokens: finalCostPer1k,
            estimation_method: 'hardware_metrics',
            breakdown: {
                base_cost: baseCost,
                overhead_cost: overheadCost,
                efficiency_adjustment: efficiencyAdjustment,
                total_cost: totalCost,
            },
            confidence_level: 'medium',
            factors_used: [
                'hardware_hourly_cost',
                'measured_throughput',
                overheadFactor > 1.0 ? 'overhead_factor' : '',
                moeAdjustment !== 1.0 ? 'moe_efficiency' : '',
            ].filter(Boolean),
        };
    }
    /**
     * Fallback cost estimation method
     */
    estimateFromFallbackMethod(context) {
        // Use industry averages based on model size/type
        const totalTokens = context.tokens_in + context.tokens_out;
        // Rough estimates based on typical cloud pricing
        let estimatedCostPer1k = 0.002; // $0.002 per 1k tokens default
        // Adjust based on model size (if available in context)
        const modelId = context.model_id.toLowerCase();
        if (modelId.includes('gpt-4') || modelId.includes('claude-3')) {
            estimatedCostPer1k = 0.015;
        }
        else if (modelId.includes('gpt-3.5') || modelId.includes('claude-2')) {
            estimatedCostPer1k = 0.002;
        }
        else if (modelId.includes('llama') || modelId.includes('mistral')) {
            estimatedCostPer1k = 0.001;
        }
        const totalCost = estimatedCostPer1k * (totalTokens / 1000);
        return {
            cost_usd: totalCost,
            cost_per_1k_tokens: estimatedCostPer1k,
            estimation_method: 'fallback_industry_average',
            breakdown: {
                base_cost: totalCost,
                overhead_cost: 0,
                efficiency_adjustment: 0,
                total_cost: totalCost,
            },
            confidence_level: 'low',
            factors_used: ['industry_averages', 'model_name_heuristics'],
        };
    }
    /**
     * Calculate batch processing cost
     */
    async estimateBatchCost(requests, model) {
        const individualCosts = await Promise.all(requests.map(context => this.estimateCost(context, model)));
        const totalIndividualCost = individualCosts.reduce((sum, cost) => sum + cost.cost_usd, 0);
        // Apply batch discount (typically 10-20% for large batches)
        const batchSize = requests.length;
        const discountPercent = Math.min(20, Math.floor(batchSize / 10) * 2);
        const batchDiscount = discountPercent / 100;
        const batchCost = totalIndividualCost * (1 - batchDiscount);
        const totalTokens = requests.reduce((sum, req) => sum + req.tokens_in + req.tokens_out, 0);
        const batchResult = {
            cost_usd: batchCost,
            cost_per_1k_tokens: (batchCost / totalTokens) * 1000,
            estimation_method: `batch_processing_${batchSize}_requests`,
            breakdown: {
                base_cost: totalIndividualCost,
                overhead_cost: 0,
                efficiency_adjustment: -totalIndividualCost * batchDiscount,
                total_cost: batchCost,
            },
            confidence_level: 'medium',
            factors_used: ['batch_discount', `${discountPercent}%_discount`],
        };
        return {
            individual_costs: individualCosts,
            batch_cost: batchResult,
            batch_discount_percent: discountPercent,
        };
    }
    /**
     * Check budget status
     */
    async checkBudgetStatus(budgetName, currentSpend) {
        // This would typically query the database
        // For now, using example values
        const budget = {
            budget_name: budgetName,
            budget_type: 'daily',
            limit_usd: 100,
            spent_usd: currentSpend,
            period_start: new Date(),
            alert_thresholds: {
                warning: 0.7,
                critical: 0.9,
                hard_stop: 1.0,
            },
        };
        const remaining = budget.limit_usd - currentSpend;
        const utilizationPercent = (currentSpend / budget.limit_usd) * 100;
        let status = 'safe';
        if (utilizationPercent >= budget.alert_thresholds.hard_stop * 100) {
            status = 'exceeded';
        }
        else if (utilizationPercent >= budget.alert_thresholds.critical * 100) {
            status = 'critical';
        }
        else if (utilizationPercent >= budget.alert_thresholds.warning * 100) {
            status = 'warning';
        }
        return {
            budget_name: budgetName,
            limit_usd: budget.limit_usd,
            spent_usd: currentSpend,
            remaining_usd: Math.max(0, remaining),
            utilization_percent: Math.min(100, utilizationPercent),
            status,
            time_remaining: this.calculateTimeRemaining(budget, currentSpend),
            projected_end_date: this.projectBudgetExhaustion(budget, currentSpend),
        };
    }
    /**
     * Generate cost optimization suggestions
     */
    async generateOptimizationSuggestions(currentModel, usage, availableModels) {
        const suggestions = [];
        // Calculate current average cost
        const avgCost = usage.reduce((sum, event) => sum + event.cost_usd, 0) / usage.length;
        const avgTokens = usage.reduce((sum, event) => sum + event.total_tokens, 0) / usage.length;
        const currentCostPer1k = (avgCost / avgTokens) * 1000;
        // Find cheaper alternatives
        const alternatives = availableModels
            .filter(model => model.model_id !== currentModel &&
            model.status === 'active' &&
            model.cost_profile.estimated_cost_per_1k_tokens_usd < currentCostPer1k)
            .sort((a, b) => a.cost_profile.estimated_cost_per_1k_tokens_usd -
            b.cost_profile.estimated_cost_per_1k_tokens_usd);
        for (const alt of alternatives.slice(0, 3)) {
            // Top 3 alternatives
            const savingsPercent = ((currentCostPer1k -
                alt.cost_profile.estimated_cost_per_1k_tokens_usd) /
                currentCostPer1k) *
                100;
            const savingsUsd = avgCost * (savingsPercent / 100);
            suggestions.push({
                type: 'model_switch',
                current_model: currentModel,
                suggested_model: alt.model_id,
                estimated_savings_percent: savingsPercent,
                estimated_savings_usd: savingsUsd,
                trade_offs: this.analyzeTradeOffs(currentModel, alt),
                confidence: this.calculateConfidence(alt),
            });
        }
        // Suggest quantization if available
        const currentModelEntry = availableModels.find(m => m.model_id === currentModel);
        if (currentModelEntry && currentModelEntry.quantizations.includes('int8')) {
            suggestions.push({
                type: 'quantization',
                current_model: currentModel,
                estimated_savings_percent: 25, // Typical int8 savings
                estimated_savings_usd: avgCost * 0.25,
                trade_offs: ['Slight quality reduction', 'Faster inference'],
                confidence: 0.8,
            });
        }
        // Suggest batch processing for high volume
        const dailyRequests = usage.length;
        if (dailyRequests > 100) {
            suggestions.push({
                type: 'batch_processing',
                current_model: currentModel,
                estimated_savings_percent: 15,
                estimated_savings_usd: avgCost * usage.length * 0.15,
                trade_offs: ['Higher latency', 'More efficient resource usage'],
                confidence: 0.9,
            });
        }
        return suggestions.sort((a, b) => b.estimated_savings_usd - a.estimated_savings_usd);
    }
    /**
     * Enforce budget constraints
     */
    async enforceBudget(costUsd, budgetName = 'default') {
        const budgetStatus = await this.checkBudgetStatus(budgetName, costUsd);
        if (budgetStatus.status === 'exceeded') {
            return {
                allowed: false,
                reason: 'Daily budget exceeded',
                suggested_action: 'Use economy tier models or wait until budget reset',
            };
        }
        if (budgetStatus.status === 'critical') {
            this.emit('budgetAlert', {
                type: 'critical',
                budget_name: budgetName,
                utilization: budgetStatus.utilization_percent,
            });
        }
        return { allowed: true };
    }
    /**
     * Cache management
     */
    generateCacheKey(context) {
        return `cost:${context.model_id}:${context.tokens_in}:${context.tokens_out}:${context.hardware_hourly_usd || 'default'}`;
    }
    getCachedCost(key) {
        const cached = this.costCache.get(key);
        if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
            return cached.cost; // Type assertion for simplicity
        }
        this.costCache.delete(key);
        return null;
    }
    setCachedCost(key, result) {
        this.costCache.set(key, {
            cost: result,
            timestamp: new Date(),
        });
        // Cleanup old entries periodically
        if (this.costCache.size > 1000) {
            const oldestKeys = Array.from(this.costCache.keys()).slice(0, 100);
            for (const oldKey of oldestKeys) {
                this.costCache.delete(oldKey);
            }
        }
    }
    /**
     * Helper methods
     */
    calculateTimeRemaining(budget, currentSpend) {
        // Simple linear projection
        const hoursInPeriod = budget.budget_type === 'daily'
            ? 24
            : budget.budget_type === 'weekly'
                ? 168
                : budget.budget_type === 'monthly'
                    ? 720
                    : 1;
        const burnRate = currentSpend / 1; // Assume 1 hour elapsed for simplicity
        const remainingBudget = budget.limit_usd - currentSpend;
        const hoursRemaining = remainingBudget / burnRate;
        return `${Math.max(0, hoursRemaining).toFixed(1)} hours`;
    }
    projectBudgetExhaustion(budget, currentSpend) {
        const hoursInPeriod = budget.budget_type === 'daily' ? 24 : 168;
        const burnRate = currentSpend / 1;
        const hoursUntilExhaustion = (budget.limit_usd - currentSpend) / burnRate;
        return new Date(Date.now() + hoursUntilExhaustion * 60 * 60 * 1000);
    }
    analyzeTradeOffs(currentModel, alternativeModel) {
        const tradeOffs = [];
        if (alternativeModel.parameters_billion &&
            alternativeModel.parameters_billion < 30) {
            tradeOffs.push('Smaller model - may have reduced capabilities');
        }
        if (alternativeModel.safety_risk_level === 'high') {
            tradeOffs.push('Higher safety risk - requires additional moderation');
        }
        if (alternativeModel.context_length < 8192) {
            tradeOffs.push('Shorter context length');
        }
        return tradeOffs.length > 0 ? tradeOffs : ['Comparable quality expected'];
    }
    calculateConfidence(model) {
        let confidence = 0.5; // Base confidence
        if (model.last_benchmark &&
            Date.now() - new Date(model.last_benchmark).getTime() <
                7 * 24 * 60 * 60 * 1000) {
            confidence += 0.3; // Recent benchmark data
        }
        if (model.quality_metrics.composite_score &&
            model.quality_metrics.composite_score > 0.7) {
            confidence += 0.2; // High quality score
        }
        return Math.min(1.0, confidence);
    }
}
