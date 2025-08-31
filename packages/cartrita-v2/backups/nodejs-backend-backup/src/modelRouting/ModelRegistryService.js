/**
 * Model Registry Service
 *
 * Main service that orchestrates all model registry components including
 * routing, cost estimation, benchmarking, safety, and event emission.
 *
 * @author Robbie Allen (Lead Architect)
 * @date August 2025
 */
import { EventEmitter } from 'events';
import { ModelRouter } from './ModelRouter';
import { CostEstimator } from './CostEstimator';
import { BenchmarkHarness } from './BenchmarkHarness';
import { SafetyPipeline } from './SafetyPipeline';
import { ModelRegistryEventEmitter } from './EventEmitter';
export class ModelRegistryService extends EventEmitter {
    config;
    modelInferenceService;
    router;
    costEstimator;
    benchmarkHarness;
    safetyPipeline;
    eventEmitter;
    models = new Map();
    isInitialized = false;
    constructor(config, modelInferenceService) {
        super();
        this.config = config;
        this.modelInferenceService = modelInferenceService;
        const logger = config.monitoring.logger || console;
        // Initialize components
        this.costEstimator = new CostEstimator(logger, config.redis?.client);
        this.router = new ModelRouter(this.costEstimator, logger, config.database.client);
        this.benchmarkHarness = new BenchmarkHarness(modelInferenceService, config.monitoring.metricsCollector, logger);
        this.safetyPipeline = new SafetyPipeline(config.safety, logger, modelInferenceService);
        this.eventEmitter = new ModelRegistryEventEmitter(logger, config.database.client, config.redis?.client);
        this.setupEventHandlers();
    }
    /**
     * Initialize the model registry service
     */
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            // Load models from database
            await this.loadModelsFromDatabase();
            // Register models with router
            for (const model of this.models.values()) {
                this.router.registerModel(model);
            }
            // Setup periodic benchmarking if enabled
            if (this.config.benchmarking.enabled) {
                await this.scheduleBenchmarking();
            }
            this.isInitialized = true;
            this.emit('initialized', { models_loaded: this.models.size });
            console.log('Model Registry Service initialized', {
                models_count: this.models.size,
                benchmarking_enabled: this.config.benchmarking.enabled,
            });
        }
        catch (error) {
            console.error('Failed to initialize Model Registry Service', error);
            throw error;
        }
    }
    /**
     * Select optimal model for a task
     */
    async selectModel(criteria, context = {}, strategyName = 'balanced') {
        this.ensureInitialized();
        // Emit planning event
        const estimatedTokens = 1000; // Default estimate
        const estimatedCost = await this.estimateBasicCost(criteria.task_type, estimatedTokens);
        this.eventEmitter.emitModelCallPlanned({
            model_id: 'tbd',
            user_id: context.user_id,
            workflow_run_id: context.workflow_run_id,
            stage: context.stage,
            supervisor: context.supervisor,
            estimated_tokens: estimatedTokens,
            estimated_cost_usd: estimatedCost,
            pipeline_context: { criteria, strategy: strategyName },
        });
        // Perform model selection
        const result = await this.router.selectModel(criteria, {
            ...context,
            priority: context.priority || 'medium',
        }, strategyName);
        this.emit('modelSelected', result);
        return result;
    }
    /**
     * Execute a model inference with full pipeline
     */
    async executeInference(modelId, prompt, options = {}) {
        this.ensureInitialized();
        const startTime = Date.now();
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        // Safety check (pre-generation)
        let safetyResult;
        if (options.safety_enabled !== false) {
            safetyResult = await this.safetyPipeline.evaluatePrompt({
                id: `safety_${Date.now()}`,
                content: prompt,
                context: {
                    user_id: options.user_id,
                    model_id: modelId,
                    task_type: model.task_types[0],
                },
            });
            if (!safetyResult.is_safe) {
                throw new Error(`Content rejected by safety pipeline: ${safetyResult.explanation}`);
            }
        }
        // Emit started event
        this.eventEmitter.emitModelCallStarted({
            model_id: modelId,
            user_id: options.user_id,
            workflow_run_id: options.workflow_run_id,
            stage: options.stage,
            supervisor: options.supervisor,
            actual_tokens_in: this.estimateTokenCount(prompt),
            pipeline_context: { safety_enabled: options.safety_enabled !== false },
        });
        try {
            // Execute inference
            const inferenceResult = await this.modelInferenceService.generate({
                model: modelId,
                prompt,
                temperature: options.temperature || model.default_temperature,
                max_tokens: options.max_tokens || 512,
            });
            const endTime = Date.now();
            const latencyMs = endTime - startTime;
            // Count tokens
            const tokensIn = this.estimateTokenCount(prompt);
            const tokensOut = this.estimateTokenCount(inferenceResult.text || '');
            // Calculate cost
            const costResult = await this.costEstimator.estimateCost({
                model_id: modelId,
                hardware_hourly_usd: model.cost_profile.estimated_hourly_usd,
                measured_tokens_per_second: model.cost_profile.estimated_tokens_per_hour / 3600,
                tokens_in: tokensIn,
                tokens_out: tokensOut,
            }, model);
            // Post-generation safety check
            if (options.safety_enabled !== false && inferenceResult.text) {
                const postSafetyResult = await this.safetyPipeline.evaluateGeneration({
                    id: `safety_post_${Date.now()}`,
                    content: inferenceResult.text,
                    context: {
                        user_id: options.user_id,
                        model_id: modelId,
                        task_type: model.task_types[0],
                    },
                });
                // Apply safety actions
                if (!postSafetyResult.is_safe) {
                    const redactAction = postSafetyResult.suggested_actions.find(a => a.action === 'redact');
                    if (redactAction?.redacted_content) {
                        inferenceResult.text = redactAction.redacted_content;
                    }
                }
                safetyResult = postSafetyResult;
            }
            // Emit completed event
            this.eventEmitter.emitModelCallCompleted({
                model_id: modelId,
                user_id: options.user_id,
                workflow_run_id: options.workflow_run_id,
                stage: options.stage,
                supervisor: options.supervisor,
                tokens_in: tokensIn,
                tokens_out: tokensOut,
                latency_ms: latencyMs,
                cost_usd: costResult.cost_usd,
                estimation_method: costResult.estimation_method,
                pipeline_context: {
                    safety_enabled: options.safety_enabled !== false,
                    temperature: options.temperature,
                    max_tokens: options.max_tokens,
                },
            });
            return {
                result: inferenceResult,
                cost_usd: costResult.cost_usd,
                latency_ms: latencyMs,
                tokens_used: { input: tokensIn, output: tokensOut },
                safety_result: safetyResult,
            };
        }
        catch (error) {
            // Emit failed event
            this.eventEmitter.emitModelCallFailed({
                model_id: modelId,
                user_id: options.user_id,
                workflow_run_id: options.workflow_run_id,
                stage: options.stage,
                supervisor: options.supervisor,
                error: error,
                tokens_in: this.estimateTokenCount(prompt),
                latency_ms: Date.now() - startTime,
                pipeline_context: { safety_enabled: options.safety_enabled !== false },
            });
            throw error;
        }
    }
    /**
     * Run benchmarks on models
     */
    async runBenchmarks(config) {
        this.ensureInitialized();
        this.emit('benchmarkStarted', { config });
        try {
            const results = await this.benchmarkHarness.runBenchmarks(config);
            // Store results in database
            await this.storeBenchmarkResults(results);
            this.emit('benchmarkCompleted', { results });
        }
        catch (error) {
            this.emit('benchmarkFailed', { error });
            throw error;
        }
    }
    /**
     * Add or update a model in the registry
     */
    async registerModel(model) {
        this.ensureInitialized();
        try {
            // Validate model
            // validateModelEntry(model); // Using schema validation
            // Store in database
            const query = `
        INSERT INTO models (
          model_id, provider, task_types, family, parameters_billion,
          architectural_type, license, commercial_allowed, context_length,
          quantizations, throughput_metadata, avg_latency_ms_512_tokens,
          quality_metrics, safety_risk_level, default_temperature,
          cost_profile, routing_tags, fallback_chain, status,
          last_benchmark, risk_notes, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (model_id) DO UPDATE SET
          updated_at = NOW(),
          provider = ?,
          task_types = ?,
          status = ?
      `;
            await this.config.database.client.query(query, [
                model.model_id,
                model.provider,
                JSON.stringify(model.task_types),
                model.family,
                model.parameters_billion,
                model.architectural_type,
                model.license,
                model.commercial_allowed,
                model.context_length,
                JSON.stringify(model.quantizations),
                JSON.stringify(model.throughput_metadata),
                model.avg_latency_ms_512_tokens,
                JSON.stringify(model.quality_metrics),
                model.safety_risk_level,
                model.default_temperature,
                JSON.stringify(model.cost_profile),
                JSON.stringify(model.routing_tags),
                JSON.stringify(model.fallback_chain),
                model.status,
                model.last_benchmark,
                model.risk_notes,
                JSON.stringify(model.metadata || {}),
                // For conflict update
                model.provider,
                JSON.stringify(model.task_types),
                model.status,
            ]);
            // Update in-memory registry
            this.models.set(model.model_id, model);
            this.router.registerModel(model);
            this.emit('modelRegistered', { model_id: model.model_id });
            return {
                success: true,
                data: model,
                meta: { timestamp: new Date() },
            };
        }
        catch (error) {
            console.error('Failed to register model', {
                model_id: model.model_id,
                error,
            });
            return {
                success: false,
                error: {
                    code: 'MODEL_REGISTRATION_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { timestamp: new Date() },
            };
        }
    }
    /**
     * Get cost statistics
     */
    async getCostStatistics(timeRangeHours = 24) {
        this.ensureInitialized();
        try {
            const query = `
        SELECT 
          model_id,
          user_id,
          SUM(cost_usd) as total_cost,
          SUM(tokens_in + tokens_out) as total_tokens,
          COUNT(*) as call_count
        FROM cost_events 
        WHERE created_at >= NOW() - INTERVAL '${timeRangeHours} hours'
        GROUP BY model_id, user_id
      `;
            const results = await this.config.database.client.query(query);
            const stats = {
                total_cost_usd: 0,
                cost_by_model: {},
                cost_by_user: {},
                total_tokens: 0,
                avg_cost_per_1k_tokens: 0,
                top_models: [],
            };
            const modelStats = new Map();
            for (const row of results.rows) {
                stats.total_cost_usd += parseFloat(row.total_cost);
                stats.total_tokens += parseInt(row.total_tokens);
                stats.cost_by_model[row.model_id] =
                    (stats.cost_by_model[row.model_id] || 0) + parseFloat(row.total_cost);
                stats.cost_by_user[row.user_id] =
                    (stats.cost_by_user[row.user_id] || 0) + parseFloat(row.total_cost);
                if (!modelStats.has(row.model_id)) {
                    modelStats.set(row.model_id, { cost: 0, calls: 0, tokens: 0 });
                }
                const modelStat = modelStats.get(row.model_id);
                modelStat.cost += parseFloat(row.total_cost);
                modelStat.calls += parseInt(row.call_count);
                modelStat.tokens += parseInt(row.total_tokens);
            }
            stats.avg_cost_per_1k_tokens =
                stats.total_tokens > 0
                    ? (stats.total_cost_usd / stats.total_tokens) * 1000
                    : 0;
            stats.top_models = Array.from(modelStats.entries())
                .map(([model_id, stat]) => ({
                model_id,
                cost_usd: stat.cost,
                calls: stat.calls,
            }))
                .sort((a, b) => b.cost_usd - a.cost_usd)
                .slice(0, 10);
            return {
                success: true,
                data: stats,
                meta: { timestamp: new Date() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'STATS_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { timestamp: new Date() },
            };
        }
    }
    /**
     * Private helper methods
     */
    async loadModelsFromDatabase() {
        const query = 'SELECT * FROM models WHERE status = ?';
        const results = await this.config.database.client.query(query, ['active']);
        for (const row of results.rows) {
            const model = {
                id: row.id,
                model_id: row.model_id,
                provider: row.provider,
                task_types: JSON.parse(row.task_types),
                family: row.family,
                parameters_billion: row.parameters_billion,
                architectural_type: row.architectural_type,
                license: row.license,
                commercial_allowed: row.commercial_allowed,
                context_length: row.context_length,
                quantizations: JSON.parse(row.quantizations),
                throughput_metadata: JSON.parse(row.throughput_metadata),
                avg_latency_ms_512_tokens: row.avg_latency_ms_512_tokens,
                quality_metrics: JSON.parse(row.quality_metrics),
                safety_risk_level: row.safety_risk_level,
                default_temperature: row.default_temperature,
                cost_profile: JSON.parse(row.cost_profile),
                routing_tags: JSON.parse(row.routing_tags),
                fallback_chain: JSON.parse(row.fallback_chain),
                status: row.status,
                last_benchmark: row.last_benchmark,
                risk_notes: row.risk_notes,
                created_at: row.created_at,
                updated_at: row.updated_at,
                metadata: JSON.parse(row.metadata || '{}'),
            };
            this.models.set(model.model_id, model);
        }
    }
    async scheduleBenchmarking() {
        // Simple interval-based scheduling (in production, use cron)
        setInterval(async () => {
            try {
                const models = Array.from(this.models.keys()).slice(0, 5); // Limit to 5 models
                const config = {
                    model_ids: models,
                    benchmark_suite: ['performance', 'quality'],
                    hardware_configs: [{ gpu_type: 'A10G' }],
                    warmup_runs: 3,
                    measurement_runs: 10,
                    context_lengths: [512, 2048],
                    temperature_settings: [0.7, 1.0],
                };
                await this.runBenchmarks(config);
            }
            catch (error) {
                console.error('Scheduled benchmark failed', error);
            }
        }, 24 * 60 * 60 * 1000); // Daily
    }
    async storeBenchmarkResults(results) {
        // Store benchmark results in database
        for (const result of results) {
            const query = `
        INSERT INTO model_benchmarks (
          model_id, benchmark_name, score, max_score,
          benchmark_date, benchmark_config
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
            await this.config.database.client.query(query, [
                result.model_id,
                result.benchmark_name,
                result.metrics.tokens_per_second,
                1000, // Max theoretical tokens per second
                result.timestamp,
                JSON.stringify({
                    context_length: result.context_length,
                    temperature: result.temperature,
                    hardware: result.hardware_config,
                }),
            ]);
        }
    }
    setupEventHandlers() {
        this.eventEmitter.on('highCostEvent', event => {
            this.emit('highCostDetected', event);
        });
        this.eventEmitter.on('slowResponseEvent', event => {
            this.emit('slowResponseDetected', event);
        });
        this.eventEmitter.on('budgetAlertEvent', event => {
            this.emit('budgetAlert', event);
        });
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Model Registry Service not initialized. Call initialize() first.');
        }
    }
    estimateTokenCount(text) {
        // Simple approximation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
    async estimateBasicCost(taskType, tokens) {
        // Simple cost estimation for planning
        const costPer1k = taskType === 'text-generation' ? 0.002 : 0.001;
        return (costPer1k * tokens) / 1000;
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.eventEmitter.cleanup();
        this.removeAllListeners();
    }
}
