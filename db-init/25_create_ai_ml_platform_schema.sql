-- AI/ML Integration Platform Schema
-- Migration: 25_create_ai_ml_platform_schema.sql
-- Task 15: AI/ML Integration Platform

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Model registry and versioning
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    description TEXT,
    framework VARCHAR(100), -- tensorflow, pytorch, sklearn, xgboost, etc.
    model_type VARCHAR(100), -- classification, regression, clustering, nlp, computer_vision
    algorithm VARCHAR(100), -- specific algorithm used
    input_schema JSONB DEFAULT '{}',
    output_schema JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}', -- training metrics summary
    status VARCHAR(50) DEFAULT 'draft', -- draft, training, ready, deprecated, archived
    visibility VARCHAR(50) DEFAULT 'private', -- private, team, public
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, version)
);

-- Model artifacts and metadata
CREATE TABLE model_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    artifact_type VARCHAR(100) NOT NULL, -- model, weights, config, requirements, notebook, dataset
    name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    checksum VARCHAR(255),
    content_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    is_primary BOOLEAN DEFAULT FALSE, -- primary model artifact
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training experiments and runs
CREATE TABLE training_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    model_id UUID REFERENCES ml_models(id),
    parent_experiment_id UUID REFERENCES training_experiments(id), -- for nested experiments
    status VARCHAR(50) DEFAULT 'created', -- created, queued, running, completed, failed, cancelled
    priority INTEGER DEFAULT 1, -- 1 (low) to 5 (high)
    configuration JSONB DEFAULT '{}', -- training configuration
    hyperparameters JSONB DEFAULT '{}',
    dataset_config JSONB DEFAULT '{}',
    resource_requirements JSONB DEFAULT '{}', -- CPU, memory, GPU requirements
    environment JSONB DEFAULT '{}', -- Python version, packages, etc.
    tags JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training metrics and results
CREATE TABLE training_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES training_experiments(id) ON DELETE CASCADE,
    epoch INTEGER,
    step INTEGER,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,10),
    metric_type VARCHAR(50), -- train, validation, test
    metric_category VARCHAR(50), -- loss, accuracy, precision, recall, f1, custom
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Experiment logs and outputs
CREATE TABLE experiment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES training_experiments(id) ON DELETE CASCADE,
    log_level VARCHAR(20) DEFAULT 'INFO', -- DEBUG, INFO, WARNING, ERROR, CRITICAL
    message TEXT NOT NULL,
    source VARCHAR(100), -- component that generated the log
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model deployments
CREATE TABLE model_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    model_id UUID REFERENCES ml_models(id),
    version VARCHAR(100) NOT NULL,
    endpoint_url TEXT,
    deployment_config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- pending, deploying, active, inactive, failed, scaling
    environment VARCHAR(100), -- development, staging, production
    resources JSONB DEFAULT '{}', -- CPU, memory, GPU allocation
    scaling_config JSONB DEFAULT '{}', -- min/max replicas, scaling metrics
    health_check_config JSONB DEFAULT '{}',
    traffic_percentage DECIMAL(5,2) DEFAULT 100.00, -- for canary deployments
    created_by UUID REFERENCES users(id),
    deployed_at TIMESTAMP WITH TIME ZONE,
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deployment replicas and instances
CREATE TABLE deployment_replicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES model_deployments(id) ON DELETE CASCADE,
    replica_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255),
    pod_name VARCHAR(255), -- for Kubernetes deployments
    status VARCHAR(50) DEFAULT 'starting', -- starting, running, stopping, failed
    health_status VARCHAR(50) DEFAULT 'unknown', -- healthy, unhealthy, unknown
    resource_usage JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B testing experiments
CREATE TABLE ab_test_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, running, paused, completed, stopped
    traffic_split JSONB DEFAULT '{}', -- {"control": 50, "treatment_a": 25, "treatment_b": 25}
    control_deployment_id UUID REFERENCES model_deployments(id),
    treatment_deployments JSONB DEFAULT '[]', -- Array of deployment configurations
    success_metrics JSONB DEFAULT '[]', -- Primary and secondary success metrics
    statistical_config JSONB DEFAULT '{}', -- significance level, power, minimum effect size
    segment_filters JSONB DEFAULT '{}', -- user segment filtering criteria
    duration_days INTEGER DEFAULT 14,
    sample_size_target INTEGER,
    early_stopping_enabled BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    results JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test traffic allocation
CREATE TABLE ab_test_traffic (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_test_experiments(id) ON DELETE CASCADE,
    deployment_id UUID REFERENCES model_deployments(id),
    variant_name VARCHAR(100) NOT NULL, -- control, treatment_a, treatment_b, etc.
    traffic_percentage DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature store definitions
CREATE TABLE feature_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    feature_type VARCHAR(100) NOT NULL, -- numerical, categorical, boolean, text, vector, image
    data_source VARCHAR(255),
    transformation_logic TEXT,
    validation_rules JSONB DEFAULT '{}', -- data quality rules
    freshness_sla_minutes INTEGER DEFAULT 60, -- data freshness requirement
    tags JSONB DEFAULT '[]',
    schema_definition JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature values and storage
CREATE TABLE feature_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_definition_id UUID REFERENCES feature_definitions(id) ON DELETE CASCADE,
    entity_id VARCHAR(255) NOT NULL, -- user_id, product_id, etc.
    feature_value JSONB NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- for TTL-based expiration
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'
);

-- Feature sets for grouping related features
CREATE TABLE feature_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    feature_definition_ids JSONB DEFAULT '[]', -- Array of feature definition IDs
    tags JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model performance monitoring
CREATE TABLE model_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES model_deployments(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,10),
    metric_category VARCHAR(50), -- accuracy, latency, throughput, error_rate, drift
    metric_metadata JSONB DEFAULT '{}',
    aggregation_window VARCHAR(50), -- 1m, 5m, 1h, 1d
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model prediction drift detection
CREATE TABLE model_drift_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES model_deployments(id) ON DELETE CASCADE,
    drift_type VARCHAR(50) NOT NULL, -- data_drift, concept_drift, prediction_drift
    feature_name VARCHAR(255), -- specific feature if applicable
    drift_score DECIMAL(10,6),
    threshold_exceeded BOOLEAN DEFAULT FALSE,
    statistical_test VARCHAR(100), -- KS, PSI, chi-square, etc.
    reference_period_start TIMESTAMP WITH TIME ZONE,
    reference_period_end TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inference requests logging (sample for analysis)
CREATE TABLE inference_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES model_deployments(id),
    request_id VARCHAR(255),
    input_features JSONB,
    prediction JSONB,
    confidence_score DECIMAL(5,4),
    latency_ms INTEGER,
    model_version VARCHAR(100),
    ab_test_id UUID REFERENCES ab_test_experiments(id),
    ab_test_variant VARCHAR(100),
    user_id VARCHAR(255), -- external user identifier
    session_id VARCHAR(255),
    request_metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AutoML jobs and automated machine learning
CREATE TABLE automl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL, -- classification, regression, forecasting, clustering, nlp, computer_vision
    dataset_config JSONB DEFAULT '{}',
    target_column VARCHAR(255),
    feature_columns JSONB DEFAULT '[]',
    optimization_metric VARCHAR(100),
    optimization_direction VARCHAR(20) DEFAULT 'maximize', -- maximize, minimize
    search_space JSONB DEFAULT '{}', -- hyperparameter search space
    time_budget_minutes INTEGER DEFAULT 60,
    max_trials INTEGER DEFAULT 100,
    early_stopping_patience INTEGER DEFAULT 10,
    cross_validation_folds INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'queued', -- queued, running, completed, failed, cancelled
    best_model_id UUID REFERENCES ml_models(id),
    best_score DECIMAL(20,10),
    trials_completed INTEGER DEFAULT 0,
    results JSONB DEFAULT '{}',
    resource_usage JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AutoML trial results
CREATE TABLE automl_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automl_job_id UUID REFERENCES automl_jobs(id) ON DELETE CASCADE,
    trial_number INTEGER NOT NULL,
    hyperparameters JSONB DEFAULT '{}',
    cv_score DECIMAL(20,10),
    cv_std DECIMAL(20,10),
    train_time_seconds DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed, pruned
    model_artifacts JSONB DEFAULT '{}',
    feature_importance JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ML pipeline definitions
CREATE TABLE ml_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pipeline_type VARCHAR(100), -- training, batch_inference, streaming_inference, data_processing
    definition JSONB NOT NULL, -- pipeline DAG definition
    schedule_cron VARCHAR(100), -- cron expression for scheduled runs
    is_active BOOLEAN DEFAULT TRUE,
    tags JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ML pipeline runs
CREATE TABLE ml_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES ml_pipelines(id) ON DELETE CASCADE,
    run_id VARCHAR(255) NOT NULL UNIQUE,
    trigger_type VARCHAR(50), -- manual, scheduled, webhook, event
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed, cancelled
    parameters JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    resource_usage JSONB DEFAULT '{}',
    artifacts JSONB DEFAULT '{}',
    triggered_by UUID REFERENCES users(id)
);

-- Data lineage tracking
CREATE TABLE ml_data_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(100) NOT NULL, -- dataset, feature, model, experiment
    source_id UUID NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id UUID NOT NULL,
    relationship_type VARCHAR(100), -- input, output, derived_from, trained_on
    transformation_logic TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model approval workflow
CREATE TABLE model_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    deployment_id UUID REFERENCES model_deployments(id),
    approval_stage VARCHAR(100) NOT NULL, -- review, testing, approval, deployment
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, in_progress
    reviewer_id UUID REFERENCES users(id),
    approval_criteria JSONB DEFAULT '{}',
    review_notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================

-- Model registry indexes
CREATE INDEX idx_ml_models_name_version ON ml_models(name, version);
CREATE INDEX idx_ml_models_created_at ON ml_models(created_at DESC);
CREATE INDEX idx_ml_models_framework ON ml_models(framework);
CREATE INDEX idx_ml_models_status ON ml_models(status);
CREATE INDEX idx_ml_models_created_by ON ml_models(created_by);

-- Model artifacts indexes
CREATE INDEX idx_model_artifacts_model_id ON model_artifacts(model_id);
CREATE INDEX idx_model_artifacts_type ON model_artifacts(artifact_type);
CREATE INDEX idx_model_artifacts_primary ON model_artifacts(model_id, is_primary) WHERE is_primary = TRUE;

-- Experiment tracking indexes
CREATE INDEX idx_training_experiments_model_id ON training_experiments(model_id);
CREATE INDEX idx_training_experiments_status ON training_experiments(status);
CREATE INDEX idx_training_experiments_created_by ON training_experiments(created_by);
CREATE INDEX idx_training_experiments_created_at ON training_experiments(created_at DESC);
CREATE INDEX idx_training_metrics_experiment_epoch ON training_metrics(experiment_id, epoch);
CREATE INDEX idx_training_metrics_name_time ON training_metrics(experiment_id, metric_name, recorded_at DESC);

-- Experiment logs indexes
CREATE INDEX idx_experiment_logs_experiment_time ON experiment_logs(experiment_id, timestamp DESC);
CREATE INDEX idx_experiment_logs_level ON experiment_logs(log_level, timestamp DESC);

-- Deployment indexes
CREATE INDEX idx_model_deployments_model_version ON model_deployments(model_id, version);
CREATE INDEX idx_model_deployments_status_env ON model_deployments(status, environment);
CREATE INDEX idx_model_deployments_created_by ON model_deployments(created_by);
CREATE INDEX idx_deployment_replicas_deployment_id ON deployment_replicas(deployment_id);
CREATE INDEX idx_deployment_replicas_status ON deployment_replicas(deployment_id, status);

-- Performance monitoring indexes
CREATE INDEX idx_model_performance_deployment_time ON model_performance_metrics(deployment_id, recorded_at DESC);
CREATE INDEX idx_model_performance_metric_category ON model_performance_metrics(deployment_id, metric_category, recorded_at DESC);
CREATE INDEX idx_model_drift_deployment_time ON model_drift_metrics(deployment_id, detected_at DESC);
CREATE INDEX idx_model_drift_threshold_exceeded ON model_drift_metrics(deployment_id, threshold_exceeded, detected_at DESC);

-- Inference logging indexes (for sampling and analysis)
CREATE INDEX idx_inference_requests_deployment_time ON inference_requests(deployment_id, timestamp DESC);
CREATE INDEX idx_inference_requests_ab_test ON inference_requests(ab_test_id, timestamp) WHERE ab_test_id IS NOT NULL;
CREATE INDEX idx_inference_requests_user_time ON inference_requests(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- A/B testing indexes
CREATE INDEX idx_ab_test_experiments_status ON ab_test_experiments(status);
CREATE INDEX idx_ab_test_experiments_created_by ON ab_test_experiments(created_by);
CREATE INDEX idx_ab_test_traffic_experiment ON ab_test_traffic(experiment_id);

-- Feature store indexes
CREATE INDEX idx_feature_definitions_name ON feature_definitions(name);
CREATE INDEX idx_feature_definitions_type ON feature_definitions(feature_type);
CREATE INDEX idx_feature_definitions_active ON feature_definitions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_feature_values_definition_entity ON feature_values(feature_definition_id, entity_id);
CREATE INDEX idx_feature_values_computed_at ON feature_values(computed_at DESC);
CREATE INDEX idx_feature_values_expires_at ON feature_values(expires_at) WHERE expires_at IS NOT NULL;

-- AutoML indexes
CREATE INDEX idx_automl_jobs_status ON automl_jobs(status);
CREATE INDEX idx_automl_jobs_created_at ON automl_jobs(created_at DESC);
CREATE INDEX idx_automl_jobs_created_by ON automl_jobs(created_by);
CREATE INDEX idx_automl_trials_job_score ON automl_trials(automl_job_id, cv_score DESC);
CREATE INDEX idx_automl_trials_status ON automl_trials(automl_job_id, status);

-- Pipeline indexes
CREATE INDEX idx_ml_pipelines_active ON ml_pipelines(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ml_pipelines_created_by ON ml_pipelines(created_by);
CREATE INDEX idx_ml_pipeline_runs_pipeline_id ON ml_pipeline_runs(pipeline_id, started_at DESC);
CREATE INDEX idx_ml_pipeline_runs_status ON ml_pipeline_runs(status, started_at DESC);

-- Data lineage indexes
CREATE INDEX idx_ml_data_lineage_source ON ml_data_lineage(source_type, source_id);
CREATE INDEX idx_ml_data_lineage_target ON ml_data_lineage(target_type, target_id);

-- Approval workflow indexes
CREATE INDEX idx_model_approvals_model_id ON model_approvals(model_id);
CREATE INDEX idx_model_approvals_status ON model_approvals(status, created_at DESC);

COMMIT;
