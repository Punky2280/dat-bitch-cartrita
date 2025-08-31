-- Iteration 22: Advanced AI Integration & Multi-Modal Intelligence - Database Schema
-- Create tables for multi-modal processing, intelligent orchestration, and adaptive learning

-- Multi-Modal Data Storage table
CREATE TABLE IF NOT EXISTS multimodal_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('text', 'image', 'audio', 'video', 'mixed')),
    content_hash VARCHAR(64) NOT NULL, -- SHA256 hash for deduplication
    file_path VARCHAR(500), -- Path to stored file if applicable
    metadata JSONB NOT NULL DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    analysis_results JSONB DEFAULT '{}',
    embeddings VECTOR(1536), -- OpenAI embedding dimensions
    cross_modal_refs INTEGER[] DEFAULT '{}', -- References to related multi-modal data
    modality_weights JSONB DEFAULT '{}', -- Weights for different modalities in fusion
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Multi-Modal Relationships table
CREATE TABLE IF NOT EXISTS multimodal_relationships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_data_id INTEGER NOT NULL REFERENCES multimodal_data(id) ON DELETE CASCADE,
    related_data_id INTEGER NOT NULL REFERENCES multimodal_data(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('semantic', 'temporal', 'spatial', 'contextual', 'causal')),
    similarity_score FLOAT CHECK (similarity_score >= 0 AND similarity_score <= 1),
    confidence_level FLOAT CHECK (confidence_level >= 0 AND confidence_level <= 1),
    relationship_metadata JSONB DEFAULT '{}',
    detected_by VARCHAR(100), -- Which AI model/agent detected this relationship
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(primary_data_id, related_data_id, relationship_type)
);

-- AI Learning Models table
CREATE TABLE IF NOT EXISTS ai_learning_models (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for global models
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) NOT NULL CHECK (model_type IN ('classification', 'regression', 'clustering', 'embedding', 'generation', 'fusion')),
    model_architecture VARCHAR(100) NOT NULL,
    training_data_refs INTEGER[] DEFAULT '{}', -- References to training data
    model_config JSONB NOT NULL DEFAULT '{}',
    model_weights_path VARCHAR(500), -- Path to model weights/parameters
    performance_metrics JSONB DEFAULT '{}',
    validation_metrics JSONB DEFAULT '{}',
    training_status VARCHAR(50) DEFAULT 'initialized' CHECK (training_status IN ('initialized', 'training', 'trained', 'deployed', 'deprecated')),
    version VARCHAR(50) DEFAULT '1.0.0',
    parent_model_id INTEGER REFERENCES ai_learning_models(id), -- For model evolution
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    last_training_at TIMESTAMPTZ
);

-- Tool Performance History table
CREATE TABLE IF NOT EXISTS tool_performance_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_name VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    input_data_hash VARCHAR(64), -- Hash of input data for pattern recognition
    output_data_hash VARCHAR(64), -- Hash of output data
    performance_score FLOAT CHECK (performance_score >= 0 AND performance_score <= 100),
    context_metadata JSONB DEFAULT '{}',
    resource_usage JSONB DEFAULT '{}', -- CPU, memory, etc.
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Adaptation Rules table
CREATE TABLE IF NOT EXISTS agent_adaptation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for global rules
    agent_type VARCHAR(100) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('performance', 'preference', 'context', 'temporal', 'collaborative')),
    condition_pattern JSONB NOT NULL, -- Pattern to match for rule activation
    adaptation_action JSONB NOT NULL, -- Action to take when rule triggers
    rule_priority INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    learned_from VARCHAR(100), -- Source of learning (user_feedback, pattern_analysis, etc.)
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1) DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, agent_type, rule_name)
);

-- Intelligent Orchestration Logs table
CREATE TABLE IF NOT EXISTS orchestration_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    orchestration_id VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    coordination_strategy VARCHAR(100) NOT NULL,
    selected_agents TEXT[] NOT NULL,
    selected_tools TEXT[] NOT NULL,
    execution_sequence JSONB NOT NULL,
    total_execution_time_ms INTEGER NOT NULL,
    success_rate FLOAT CHECK (success_rate >= 0 AND success_rate <= 1),
    optimization_score FLOAT CHECK (optimization_score >= 0 AND optimization_score <= 100),
    resource_efficiency FLOAT CHECK (resource_efficiency >= 0 AND resource_efficiency <= 100),
    user_satisfaction_score INTEGER CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
    lessons_learned JSONB DEFAULT '{}',
    performance_improvements JSONB DEFAULT '{}',
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-Time Intelligence Streams table
CREATE TABLE IF NOT EXISTS intelligence_streams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stream_name VARCHAR(255) NOT NULL,
    stream_type VARCHAR(50) NOT NULL CHECK (stream_type IN ('sensor', 'text', 'audio', 'video', 'mixed')),
    data_source VARCHAR(255) NOT NULL,
    processing_pipeline JSONB NOT NULL,
    current_status VARCHAR(50) DEFAULT 'inactive' CHECK (current_status IN ('inactive', 'active', 'paused', 'error')),
    data_rate_per_second INTEGER DEFAULT 0,
    processing_latency_ms INTEGER DEFAULT 0,
    accuracy_metrics JSONB DEFAULT '{}',
    stream_config JSONB DEFAULT '{}',
    last_data_point TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stream_name)
);

-- Predictive Insights table
CREATE TABLE IF NOT EXISTS predictive_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(100) NOT NULL,
    insight_category VARCHAR(50) NOT NULL CHECK (insight_category IN ('recommendation', 'prediction', 'anomaly', 'pattern', 'optimization')),
    insight_data JSONB NOT NULL,
    confidence_level FLOAT CHECK (confidence_level >= 0 AND confidence_level <= 1) NOT NULL,
    relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 100) NOT NULL,
    data_sources TEXT[] NOT NULL,
    generated_by VARCHAR(100) NOT NULL, -- Which AI system generated this insight
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    action_taken BOOLEAN DEFAULT false,
    user_feedback INTEGER CHECK (user_feedback >= -1 AND user_feedback <= 1), -- -1 negative, 0 neutral, 1 positive
    impact_score FLOAT CHECK (impact_score >= 0 AND impact_score <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-Modal Learning Sessions table
CREATE TABLE IF NOT EXISTS cross_modal_learning_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    learning_objective VARCHAR(500) NOT NULL,
    input_modalities TEXT[] NOT NULL,
    output_modalities TEXT[] NOT NULL,
    training_data_refs INTEGER[] DEFAULT '{}',
    model_architecture JSONB NOT NULL,
    training_progress JSONB DEFAULT '{}',
    validation_results JSONB DEFAULT '{}',
    session_status VARCHAR(50) DEFAULT 'initialized' CHECK (session_status IN ('initialized', 'training', 'validating', 'completed', 'failed')),
    learning_rate FLOAT DEFAULT 0.001,
    batch_size INTEGER DEFAULT 32,
    epochs_completed INTEGER DEFAULT 0,
    target_epochs INTEGER DEFAULT 100,
    best_validation_score FLOAT,
    early_stopping_patience INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enhanced MCP Message History table (extends existing message tracking)
CREATE TABLE IF NOT EXISTS mcp_message_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(100) NOT NULL,
    sender_agent VARCHAR(255) NOT NULL,
    recipient_agent VARCHAR(255),
    payload_size_bytes INTEGER,
    processing_time_ms INTEGER,
    route_optimization_applied BOOLEAN DEFAULT false,
    priority_adjustment JSONB DEFAULT '{}',
    multimodal_data_included BOOLEAN DEFAULT false,
    learning_impact_score FLOAT CHECK (learning_impact_score >= 0 AND learning_impact_score <= 100),
    message_metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_multimodal_data_user_type ON multimodal_data(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_multimodal_data_hash ON multimodal_data(content_hash);
CREATE INDEX IF NOT EXISTS idx_multimodal_data_status ON multimodal_data(processing_status, created_at);
CREATE INDEX IF NOT EXISTS idx_multimodal_data_embeddings ON multimodal_data USING ivfflat (embeddings vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_multimodal_relationships_primary ON multimodal_relationships(primary_data_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_multimodal_relationships_related ON multimodal_relationships(related_data_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_multimodal_relationships_similarity ON multimodal_relationships(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_learning_models_user_type ON ai_learning_models(user_id, model_type);
CREATE INDEX IF NOT EXISTS idx_learning_models_status ON ai_learning_models(training_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_learning_models_performance ON ai_learning_models USING GIN (performance_metrics);

CREATE INDEX IF NOT EXISTS idx_tool_performance_user_tool ON tool_performance_history(user_id, tool_name, executed_at);
CREATE INDEX IF NOT EXISTS idx_tool_performance_agent_task ON tool_performance_history(agent_id, task_type, executed_at);
CREATE INDEX IF NOT EXISTS idx_tool_performance_success ON tool_performance_history(success, performance_score);

CREATE INDEX IF NOT EXISTS idx_adaptation_rules_agent_active ON agent_adaptation_rules(agent_type, is_active, rule_priority);
CREATE INDEX IF NOT EXISTS idx_adaptation_rules_user_confidence ON agent_adaptation_rules(user_id, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_orchestration_logs_user_task ON orchestration_logs(user_id, task_type, executed_at);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_optimization ON orchestration_logs(optimization_score DESC, executed_at);

CREATE INDEX IF NOT EXISTS idx_intelligence_streams_user_active ON intelligence_streams(user_id, current_status);
CREATE INDEX IF NOT EXISTS idx_intelligence_streams_performance ON intelligence_streams(processing_latency_ms, data_rate_per_second);

CREATE INDEX IF NOT EXISTS idx_predictive_insights_user_relevance ON predictive_insights(user_id, relevance_score DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_confidence ON predictive_insights(confidence_level DESC, insight_category);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_feedback ON predictive_insights(user_feedback, impact_score);

CREATE INDEX IF NOT EXISTS idx_cross_modal_sessions_user_status ON cross_modal_learning_sessions(user_id, session_status);
CREATE INDEX IF NOT EXISTS idx_cross_modal_sessions_progress ON cross_modal_learning_sessions(epochs_completed, target_epochs);

CREATE INDEX IF NOT EXISTS idx_mcp_analytics_agents ON mcp_message_analytics(sender_agent, recipient_agent, timestamp);
CREATE INDEX IF NOT EXISTS idx_mcp_analytics_performance ON mcp_message_analytics(processing_time_ms, learning_impact_score);

-- Add text search capabilities
CREATE INDEX IF NOT EXISTS idx_multimodal_analysis_search ON multimodal_data USING GIN (to_tsvector('english', (analysis_results->>'summary')::text));
CREATE INDEX IF NOT EXISTS idx_learning_objective_search ON cross_modal_learning_sessions USING GIN (to_tsvector('english', learning_objective));

-- Add triggers for updating timestamps
CREATE TRIGGER update_multimodal_data_updated_at BEFORE UPDATE ON multimodal_data FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_learning_models_updated_at BEFORE UPDATE ON ai_learning_models FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_adaptation_rules_updated_at BEFORE UPDATE ON agent_adaptation_rules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_intelligence_streams_updated_at BEFORE UPDATE ON intelligence_streams FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cross_modal_sessions_updated_at BEFORE UPDATE ON cross_modal_learning_sessions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add table comments
COMMENT ON TABLE multimodal_data IS 'Storage for multi-modal data with embeddings and cross-references';
COMMENT ON TABLE multimodal_relationships IS 'Relationships and similarities between different modal data types';
COMMENT ON TABLE ai_learning_models IS 'AI model configurations, training states, and performance metrics';
COMMENT ON TABLE tool_performance_history IS 'Historical performance data for intelligent tool selection';
COMMENT ON TABLE agent_adaptation_rules IS 'Rules for adaptive agent behavior based on learning';
COMMENT ON TABLE orchestration_logs IS 'Logs of intelligent orchestration decisions and outcomes';
COMMENT ON TABLE intelligence_streams IS 'Configuration and status of real-time intelligence streams';
COMMENT ON TABLE predictive_insights IS 'AI-generated predictive insights and user feedback';
COMMENT ON TABLE cross_modal_learning_sessions IS 'Cross-modal learning session tracking and progress';
COMMENT ON TABLE mcp_message_analytics IS 'Analytics for MCP message routing and optimization';

-- Insert initial configuration data for Iteration 22
INSERT INTO ai_learning_models (model_name, model_type, model_architecture, model_config, performance_metrics)
VALUES 
('multimodal_fusion_v1', 'fusion', 'transformer_fusion', 
 '{"input_modalities": ["text", "image"], "fusion_strategy": "attention", "embedding_dim": 1536}', 
 '{"accuracy": 0.85, "latency_ms": 150}'),
('tool_selection_classifier', 'classification', 'neural_network', 
 '{"input_features": ["task_type", "context", "performance_history"], "output_classes": 42}', 
 '{"accuracy": 0.92, "precision": 0.88, "recall": 0.90}'),
('adaptive_routing_optimizer', 'optimization', 'reinforcement_learning', 
 '{"state_space": "agent_performance", "action_space": "routing_decisions", "reward_function": "task_success"}', 
 '{"reward_score": 0.78, "convergence_epochs": 150}');

INSERT INTO intelligence_streams (user_id, stream_name, stream_type, data_source, processing_pipeline, stream_config)
SELECT 1, 'ambient_audio_analysis', 'audio', 'microphone', 
       '["voice_activity_detection", "emotion_recognition", "content_transcription", "intent_analysis"]', 
       '{"sample_rate": 16000, "buffer_size": 1024, "processing_interval_ms": 500}'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO predictive_insights (user_id, insight_type, insight_category, insight_data, confidence_level, relevance_score, data_sources, generated_by)
SELECT 1, 'iteration_22_activation', 'recommendation', 
       '{"message": "Advanced AI Integration system is now active", "features": ["multi_modal_processing", "intelligent_orchestration", "adaptive_learning"], "benefits": ["improved_accuracy", "faster_processing", "personalized_experience"]}', 
       0.95, 85.0, ARRAY['system_initialization'], 'iteration_22_bootstrap'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);