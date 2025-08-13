/**
 * JSON Schema Validation for Model Registry
 *
 * Comprehensive validation schemas using JSON Schema for all model registry
 * data structures, ensuring data integrity and type safety.
 *
 * @author Claude (Internal Developer Agent)
 * @date August 2025
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
// Initialize AJV with formats support
const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);
// Base schema definitions
const providerSchema = {
    type: 'string',
    enum: ['huggingface', 'openai', 'anthropic', 'google', 'local', 'aws', 'azure']
};
const taskTypeSchema = {
    type: 'string',
    enum: [
        'text-generation', 'chat-completions', 'embeddings', 'classification',
        'summarization', 'translation', 'code-generation', 'image-generation',
        'image-to-text', 'text-to-speech', 'speech-to-text', 'reranking',
        'safety-moderation', 'video-generation', 'audio-generation'
    ]
};
const architecturalTypeSchema = {
    type: 'string',
    enum: ['decoder', 'encoder-decoder', 'encoder', 'mixture-of-experts']
};
const modelStatusSchema = {
    type: 'string',
    enum: ['active', 'deprecated', 'testing', 'retired']
};
const safetyRiskLevelSchema = {
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical']
};
const quantizationSchema = {
    type: 'string',
    enum: ['fp32', 'fp16', 'bf16', 'int8', 'int4', 'nf4', 'gguf']
};
// Hardware Configuration Schema
const hardwareConfigSchema = {
    type: 'object',
    properties: {
        gpu_type: { type: 'string' },
        gpu_count: { type: 'integer', minimum: 1 },
        memory_gb: { type: 'number', minimum: 0 },
        cpu_cores: { type: 'integer', minimum: 1 },
        storage_type: { type: 'string' }
    },
    required: ['gpu_type'],
    additionalProperties: false
};
// Throughput Metadata Schema
const throughputMetadataSchema = {
    type: 'object',
    additionalProperties: {
        type: 'number',
        minimum: 0
    }
};
// Quality Metrics Schema
const qualityMetricsSchema = {
    type: 'object',
    properties: {
        mmlu: { type: 'number', minimum: 0, maximum: 100 },
        mt_bench: { type: 'number', minimum: 0, maximum: 10 },
        truthfulqa: { type: 'number', minimum: 0, maximum: 100 },
        hellaswag: { type: 'number', minimum: 0, maximum: 100 },
        arena_elo: { type: 'number', minimum: 0 },
        composite_score: { type: 'number', minimum: 0, maximum: 1 },
        custom_benchmarks: {
            type: 'object',
            additionalProperties: { type: 'number' }
        }
    },
    additionalProperties: false
};
// Cost Profile Schema
const costProfileSchema = {
    type: 'object',
    properties: {
        endpoint_type: {
            type: 'string',
            enum: ['dedicated', 'serverless', 'spot', 'shared']
        },
        recommended_hardware: { type: 'string' },
        estimated_hourly_usd: { type: 'number', minimum: 0 },
        estimated_tokens_per_hour: { type: 'number', minimum: 0 },
        estimated_cost_per_1k_tokens_usd: { type: 'number', minimum: 0 },
        pricing_model: {
            type: 'string',
            enum: ['hardware', 'token_based', 'request_based']
        },
        moe_efficiency_factor: { type: 'number', minimum: 0, maximum: 1 },
        overhead_factor: { type: 'number', minimum: 1 }
    },
    required: [
        'endpoint_type', 'recommended_hardware', 'estimated_hourly_usd',
        'estimated_tokens_per_hour', 'estimated_cost_per_1k_tokens_usd', 'pricing_model'
    ],
    additionalProperties: false
};
// Model Registry Entry Schema
export const modelRegistryEntrySchema = {
    type: 'object',
    properties: {
        id: { type: 'integer', minimum: 1 },
        model_id: { type: 'string', minLength: 1, maxLength: 100 },
        provider: providerSchema,
        task_types: {
            type: 'array',
            items: taskTypeSchema,
            minItems: 1,
            uniqueItems: true
        },
        family: { type: 'string', maxLength: 50 },
        parameters_billion: { type: 'number', minimum: 0 },
        architectural_type: architecturalTypeSchema,
        license: { type: 'string', maxLength: 100 },
        commercial_allowed: { type: 'boolean' },
        context_length: { type: 'integer', minimum: 1 },
        quantizations: {
            type: 'array',
            items: quantizationSchema,
            minItems: 1,
            uniqueItems: true
        },
        throughput_metadata: throughputMetadataSchema,
        avg_latency_ms_512_tokens: { type: 'integer', minimum: 1 },
        quality_metrics: qualityMetricsSchema,
        safety_risk_level: safetyRiskLevelSchema,
        default_temperature: { type: 'number', minimum: 0, maximum: 2 },
        cost_profile: costProfileSchema,
        routing_tags: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
        },
        fallback_chain: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
        },
        status: modelStatusSchema,
        last_benchmark: { type: 'string', format: 'date-time' },
        risk_notes: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        metadata: { type: 'object' }
    },
    required: [
        'model_id', 'provider', 'task_types', 'architectural_type',
        'commercial_allowed', 'context_length', 'quantizations',
        'throughput_metadata', 'quality_metrics', 'safety_risk_level',
        'default_temperature', 'cost_profile', 'routing_tags',
        'fallback_chain', 'status'
    ],
    additionalProperties: false
};
// Cost Event Schema
export const costEventSchema = {
    type: 'object',
    properties: {
        id: { type: 'integer', minimum: 1 },
        event_id: { type: 'string', minLength: 1, maxLength: 100 },
        event_type: {
            type: 'string',
            enum: [
                'model_call.planned', 'model_call.started', 'model_call.completed',
                'model_call.failed', 'model_cost.accumulated', 'budget.threshold_crossed'
            ]
        },
        model_id: { type: 'string', minLength: 1, maxLength: 100 },
        user_id: { type: 'integer', minimum: 1 },
        workflow_run_id: { type: 'string', maxLength: 100 },
        stage: { type: 'string', maxLength: 100 },
        supervisor: { type: 'string', maxLength: 100 },
        tokens_in: { type: 'integer', minimum: 0 },
        tokens_out: { type: 'integer', minimum: 0 },
        total_tokens: { type: 'integer', minimum: 0 },
        latency_ms: { type: 'integer', minimum: 0 },
        cost_usd: { type: 'number', minimum: 0, multipleOf: 0.000001 },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
        estimation_method: { type: 'string', maxLength: 50 },
        pipeline_context: { type: 'object' },
        created_at: { type: 'string', format: 'date-time' }
    },
    required: [
        'event_id', 'event_type', 'model_id', 'tokens_in',
        'tokens_out', 'cost_usd', 'currency', 'created_at'
    ],
    additionalProperties: false
};
// Budget Tracking Schema
export const budgetTrackingSchema = {
    type: 'object',
    properties: {
        id: { type: 'integer', minimum: 1 },
        budget_name: { type: 'string', minLength: 1, maxLength: 100 },
        budget_type: {
            type: 'string',
            enum: ['hourly', 'daily', 'weekly', 'monthly']
        },
        limit_usd: { type: 'number', minimum: 0 },
        spent_usd: { type: 'number', minimum: 0 },
        period_start: { type: 'string', format: 'date-time' },
        period_end: { type: 'string', format: 'date-time' },
        alert_thresholds: {
            type: 'object',
            properties: {
                warning: { type: 'number', minimum: 0, maximum: 1 },
                critical: { type: 'number', minimum: 0, maximum: 1 },
                hard_stop: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['warning', 'critical', 'hard_stop'],
            additionalProperties: false
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
    },
    required: [
        'budget_name', 'budget_type', 'limit_usd', 'spent_usd',
        'period_start', 'alert_thresholds'
    ],
    additionalProperties: false
};
// Model Benchmark Schema
export const modelBenchmarkSchema = {
    type: 'object',
    properties: {
        id: { type: 'integer', minimum: 1 },
        model_id: { type: 'string', minLength: 1, maxLength: 100 },
        benchmark_name: { type: 'string', minLength: 1, maxLength: 100 },
        score: { type: 'number' },
        max_score: { type: 'number', minimum: 0 },
        normalized_score: { type: 'number', minimum: 0, maximum: 1 },
        benchmark_date: { type: 'string', format: 'date-time' },
        benchmark_config: { type: 'object' }
    },
    required: [
        'model_id', 'benchmark_name', 'score', 'max_score', 'benchmark_date'
    ],
    additionalProperties: false
};
// Model Selection Criteria Schema
export const modelSelectionCriteriaSchema = {
    type: 'object',
    properties: {
        task_type: taskTypeSchema,
        quality_weight: { type: 'number', minimum: 0, maximum: 1 },
        cost_weight: { type: 'number', minimum: 0, maximum: 1 },
        latency_weight: { type: 'number', minimum: 0, maximum: 1 },
        safety_required: { type: 'boolean' },
        commercial_use: { type: 'boolean' },
        max_cost_per_1k_tokens: { type: 'number', minimum: 0 },
        max_latency_ms: { type: 'integer', minimum: 1 },
        min_quality_score: { type: 'number', minimum: 0, maximum: 1 },
        required_tags: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
        },
        excluded_tags: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
        }
    },
    required: [
        'task_type', 'quality_weight', 'cost_weight',
        'latency_weight', 'safety_required', 'commercial_use'
    ],
    additionalProperties: false
};
// Benchmark Configuration Schema
export const benchmarkConfigSchema = {
    type: 'object',
    properties: {
        model_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            uniqueItems: true
        },
        benchmark_suite: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            uniqueItems: true
        },
        hardware_configs: {
            type: 'array',
            items: hardwareConfigSchema,
            minItems: 1
        },
        warmup_runs: { type: 'integer', minimum: 1, maximum: 100 },
        measurement_runs: { type: 'integer', minimum: 1, maximum: 1000 },
        context_lengths: {
            type: 'array',
            items: { type: 'integer', minimum: 1 },
            minItems: 1,
            uniqueItems: true
        },
        temperature_settings: {
            type: 'array',
            items: { type: 'number', minimum: 0, maximum: 2 },
            minItems: 1,
            uniqueItems: true
        },
        concurrent_requests: { type: 'integer', minimum: 1, maximum: 100 },
        timeout_ms: { type: 'integer', minimum: 1000 }
    },
    required: [
        'model_ids', 'benchmark_suite', 'hardware_configs',
        'warmup_runs', 'measurement_runs', 'context_lengths',
        'temperature_settings'
    ],
    additionalProperties: false
};
// Safety Pipeline Configuration Schema
export const safetyPipelineConfigSchema = {
    type: 'object',
    properties: {
        pre_generation: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                classifier_model: { type: 'string' },
                risk_threshold: { type: 'number', minimum: 0, maximum: 1 },
                categories: {
                    type: 'array',
                    items: { type: 'string' },
                    uniqueItems: true
                }
            },
            required: ['enabled'],
            additionalProperties: false
        },
        post_generation: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                safety_model: { type: 'string' },
                risk_threshold: { type: 'number', minimum: 0, maximum: 1 },
                redaction_enabled: { type: 'boolean' },
                regeneration_enabled: { type: 'boolean' }
            },
            required: ['enabled'],
            additionalProperties: false
        },
        audit: {
            type: 'object',
            properties: {
                log_all_interactions: { type: 'boolean' },
                flag_high_risk: { type: 'boolean' },
                human_review_threshold: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['log_all_interactions', 'flag_high_risk'],
            additionalProperties: false
        }
    },
    required: ['pre_generation', 'post_generation', 'audit'],
    additionalProperties: false
};
// Create compiled validators
export const validateModelRegistryEntry = ajv.compile(modelRegistryEntrySchema);
export const validateCostEvent = ajv.compile(costEventSchema);
export const validateBudgetTracking = ajv.compile(budgetTrackingSchema);
export const validateModelBenchmark = ajv.compile(modelBenchmarkSchema);
export const validateModelSelectionCriteria = ajv.compile(modelSelectionCriteriaSchema);
export const validateBenchmarkConfig = ajv.compile(benchmarkConfigSchema);
export const validateSafetyPipelineConfig = ajv.compile(safetyPipelineConfigSchema);
// Validation helper functions
export function validateData(data, validator, errorPrefix = 'Validation failed') {
    if (!validator(data)) {
        const errors = validator.errors?.map((err) => `${err.instancePath}: ${err.message}`).join(', ') || 'Unknown validation error';
        throw new Error(`${errorPrefix}: ${errors}`);
    }
    return data;
}
// Pre-configured validation functions
export const validateModelEntry = (data) => validateData(data, validateModelRegistryEntry, 'Model registry entry validation failed');
export const validateCostEventData = (data) => validateData(data, validateCostEvent, 'Cost event validation failed');
export const validateBudgetData = (data) => validateData(data, validateBudgetTracking, 'Budget tracking validation failed');
export const validateBenchmarkData = (data) => validateData(data, validateModelBenchmark, 'Model benchmark validation failed');
export const validateSelectionCriteria = (data) => validateData(data, validateModelSelectionCriteria, 'Model selection criteria validation failed');
export const validateBenchmarkConfiguration = (data) => validateData(data, validateBenchmarkConfig, 'Benchmark configuration validation failed');
export const validateSafetyConfig = (data) => validateData(data, validateSafetyPipelineConfig, 'Safety pipeline configuration validation failed');
// Schema validation middleware factory
export function createValidationMiddleware(validator) {
    return (req, res, next) => {
        try {
            validateData(req.body, validator);
            next();
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : 'Validation failed',
                    details: validator.errors
                }
            });
        }
    };
}
// Export middleware for common validations
export const validateModelEntryMiddleware = createValidationMiddleware(validateModelRegistryEntry);
export const validateCostEventMiddleware = createValidationMiddleware(validateCostEvent);
export const validateBudgetMiddleware = createValidationMiddleware(validateBudgetTracking);
export const validateBenchmarkMiddleware = createValidationMiddleware(validateModelBenchmark);
