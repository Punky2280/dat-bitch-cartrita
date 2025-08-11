/**
 * Model Registry Types and Interfaces
 * 
 * Comprehensive TypeScript type definitions for the Model Registry system
 * implementing the specifications from the Cartrita MCP Whitepaper.
 * 
 * @author Claude (Internal Developer Agent)
 * @date August 2025
 */

// Core Model Registry Types
export type ModelStatus = 'active' | 'deprecated' | 'testing' | 'retired';
export type SafetyRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ArchitecturalType = 'decoder' | 'encoder-decoder' | 'encoder' | 'mixture-of-experts';
export type TaskType = 'text-generation' | 'chat-completions' | 'embeddings' | 'classification' | 
                      'summarization' | 'translation' | 'code-generation' | 'image-generation' |
                      'image-to-text' | 'text-to-speech' | 'speech-to-text' | 'reranking' |
                      'safety-moderation' | 'video-generation' | 'audio-generation';
export type Provider = 'huggingface' | 'openai' | 'anthropic' | 'google' | 'local' | 'aws' | 'azure';
export type Quantization = 'fp32' | 'fp16' | 'bf16' | 'int8' | 'int4' | 'nf4' | 'gguf';
export type BudgetType = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type EventType = 'model_call.planned' | 'model_call.started' | 'model_call.completed' | 
                       'model_call.failed' | 'model_cost.accumulated' | 'budget.threshold_crossed';

// Hardware Configuration
export interface HardwareConfig {
  gpu_type: string;
  gpu_count?: number;
  memory_gb?: number;
  cpu_cores?: number;
  storage_type?: string;
}

// Throughput Metadata
export interface ThroughputMetadata {
  [hardware: string]: number; // tokens per second
}

// Quality Metrics
export interface QualityMetrics {
  mmlu?: number;
  mt_bench?: number;
  truthfulqa?: number;
  hellaswag?: number;
  arena_elo?: number;
  composite_score?: number;
  custom_benchmarks?: Record<string, number>;
}

// Cost Profile
export interface CostProfile {
  endpoint_type: 'dedicated' | 'serverless' | 'spot' | 'shared';
  recommended_hardware: string;
  estimated_hourly_usd: number;
  estimated_tokens_per_hour: number;
  estimated_cost_per_1k_tokens_usd: number;
  pricing_model: 'hardware' | 'token_based' | 'request_based';
  moe_efficiency_factor?: number; // For mixture-of-experts models
  overhead_factor?: number; // Network + orchestration overhead
}

// Model Registry Entry
export interface ModelRegistryEntry {
  id?: number;
  model_id: string;
  provider: Provider;
  task_types: TaskType[];
  family?: string;
  parameters_billion?: number;
  architectural_type: ArchitecturalType;
  license?: string;
  commercial_allowed: boolean;
  context_length: number;
  quantizations: Quantization[];
  throughput_metadata: ThroughputMetadata;
  avg_latency_ms_512_tokens?: number;
  quality_metrics: QualityMetrics;
  safety_risk_level: SafetyRiskLevel;
  default_temperature: number;
  cost_profile: CostProfile;
  routing_tags: string[];
  fallback_chain: string[];
  status: ModelStatus;
  last_benchmark?: Date;
  risk_notes?: string;
  created_at?: Date;
  updated_at?: Date;
  metadata?: Record<string, any>;
}

// Model Performance Metrics
export interface ModelMetric {
  id?: number;
  model_id: string;
  metric_type: string;
  metric_name: string;
  metric_value: number;
  hardware_config?: string;
  measured_at: Date;
  measurement_context?: Record<string, any>;
}

// Cost Event
export interface CostEvent {
  id?: number;
  event_id: string;
  event_type: EventType;
  model_id: string;
  user_id?: number;
  workflow_run_id?: string;
  stage?: string;
  supervisor?: string;
  tokens_in: number;
  tokens_out: number;
  total_tokens?: number; // Auto-calculated
  latency_ms?: number;
  cost_usd: number;
  currency: string;
  estimation_method?: string;
  pipeline_context?: Record<string, any>;
  created_at: Date;
}

// Budget Tracking
export interface BudgetTracking {
  id?: number;
  budget_name: string;
  budget_type: BudgetType;
  limit_usd: number;
  spent_usd: number;
  period_start: Date;
  period_end?: Date;
  alert_thresholds: {
    warning: number;
    critical: number;
    hard_stop: number;
  };
  created_at?: Date;
  updated_at?: Date;
}

// Model Benchmark
export interface ModelBenchmark {
  id?: number;
  model_id: string;
  benchmark_name: string;
  score: number;
  max_score: number;
  normalized_score?: number; // Auto-calculated
  benchmark_date: Date;
  benchmark_config?: Record<string, any>;
}

// Safety Evaluation
export interface ModelSafetyEvaluation {
  id?: number;
  model_id: string;
  evaluation_type: string;
  risk_score: number; // 0-1
  flagged_content_rate?: number;
  evaluation_date: Date;
  evaluator_model?: string;
  notes?: string;
  evaluation_config?: Record<string, any>;
}

// Usage Analytics
export interface ModelUsageAnalytics {
  id?: number;
  model_id: string;
  usage_date: Date;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  fallback_triggered: number;
  avg_response_time_ms: number;
  total_tokens_processed: number;
  total_cost_usd: number;
  efficiency_score?: number;
}

// Daily Cost Aggregate
export interface ModelDailyCosts {
  model_id: string;
  day: Date;
  total_calls: number;
  total_cost_usd: number;
  total_tokens: number;
  avg_latency_ms: number;
  avg_cost_per_call: number;
  cost_per_1k_tokens: number;
}

// Model Selection Criteria
export interface ModelSelectionCriteria {
  task_type: TaskType;
  quality_weight: number;
  cost_weight: number;
  latency_weight: number;
  safety_required: boolean;
  commercial_use: boolean;
  max_cost_per_1k_tokens?: number;
  max_latency_ms?: number;
  min_quality_score?: number;
  required_tags?: string[];
  excluded_tags?: string[];
}

// Model Selection Result
export interface ModelSelectionResult {
  request_id: string;
  task_type: TaskType;
  candidates: Array<{
    model_id: string;
    score: number;
    quality_score: number;
    cost_score: number;
    latency_score: number;
    composite_score: number;
  }>;
  selected: string;
  reason: string;
  fallback_available: boolean;
  estimated_cost_usd: number;
  estimated_latency_ms: number;
}

// Cost Context for Estimation
export interface CostContext {
  model_id: string;
  hardware_hourly_usd: number;
  measured_tokens_per_second: number;
  tokens_in: number;
  tokens_out: number;
  overhead_factor?: number;
  moe_efficiency_factor?: number;
}

// Benchmark Configuration
export interface BenchmarkConfig {
  model_ids: string[];
  benchmark_suite: string[];
  hardware_configs: HardwareConfig[];
  warmup_runs: number;
  measurement_runs: number;
  context_lengths: number[];
  temperature_settings: number[];
  concurrent_requests?: number;
  timeout_ms?: number;
}

// Performance Benchmark Result
export interface BenchmarkResult {
  model_id: string;
  hardware_config: HardwareConfig;
  benchmark_name: string;
  metrics: {
    tokens_per_second: number;
    latency_p50_ms: number;
    latency_p95_ms: number;
    latency_p99_ms: number;
    memory_usage_gb: number;
    gpu_utilization_percent: number;
    throughput_variance: number;
  };
  quality_scores?: Record<string, number>;
  timestamp: Date;
  context_length: number;
  temperature: number;
}

// Safety Pipeline Configuration
export interface SafetyPipelineConfig {
  pre_generation: {
    enabled: boolean;
    classifier_model: string;
    risk_threshold: number;
    categories: string[];
  };
  post_generation: {
    enabled: boolean;
    safety_model: string;
    risk_threshold: number;
    redaction_enabled: boolean;
    regeneration_enabled: boolean;
  };
  audit: {
    log_all_interactions: boolean;
    flag_high_risk: boolean;
    human_review_threshold: number;
  };
}

// Alert Configuration
export interface AlertConfig {
  id?: number;
  alert_name: string;
  alert_type: 'cost_threshold' | 'latency_spike' | 'error_rate' | 'safety_violation';
  conditions: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    time_window_minutes: number;
  };
  severity: 'info' | 'warning' | 'critical';
  notification_channels: string[];
  enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// Dashboard Metric Definition
export interface DashboardMetric {
  metric_id: string;
  metric_name: string;
  metric_type: 'counter' | 'gauge' | 'histogram' | 'summary';
  query: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  time_range: string;
  refresh_interval_seconds: number;
  visualization_type: 'line' | 'bar' | 'gauge' | 'table' | 'pie';
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp: Date;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    timestamp: Date;
  };
}

// Search and Filter Types
export interface ModelSearchParams {
  query?: string;
  providers?: Provider[];
  task_types?: TaskType[];
  status?: ModelStatus[];
  commercial_allowed?: boolean;
  safety_risk_level?: SafetyRiskLevel[];
  min_quality_score?: number;
  max_cost_per_1k_tokens?: number;
  routing_tags?: string[];
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CostEventSearchParams {
  model_ids?: string[];
  user_ids?: number[];
  workflow_run_ids?: string[];
  stages?: string[];
  supervisors?: string[];
  date_from?: Date;
  date_to?: Date;
  min_cost?: number;
  max_cost?: number;
  event_types?: EventType[];
  page?: number;
  limit?: number;
}

// Utility Types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Model Registry Operations
export type CreateModelRequest = Omit<ModelRegistryEntry, 'id' | 'created_at' | 'updated_at'>;
export type UpdateModelRequest = Partial<CreateModelRequest>;
export type ModelListResponse = PaginatedResponse<ModelRegistryEntry>;
export type ModelDetailResponse = APIResponse<ModelRegistryEntry>;

// Cost Tracking Operations
export type CreateCostEventRequest = Omit<CostEvent, 'id' | 'total_tokens'>;
export type CostEventListResponse = PaginatedResponse<CostEvent>;
export type DailyCostSummaryResponse = APIResponse<ModelDailyCosts[]>;

// Benchmark Operations
export type CreateBenchmarkRequest = Omit<ModelBenchmark, 'id' | 'normalized_score'>;
export type BenchmarkListResponse = PaginatedResponse<ModelBenchmark>;
export type BenchmarkSummaryResponse = APIResponse<{
  model_id: string;
  latest_benchmarks: ModelBenchmark[];
  performance_trend: 'improving' | 'stable' | 'degrading';
}>;