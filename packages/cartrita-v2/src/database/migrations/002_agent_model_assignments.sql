-- V2 Agent Model Assignments
-- Optimal model assignments per agent based on specific use cases
-- Following the requirement: "Assign different models for individual agents determined by their use case"

-- Insert core agents with specialized model assignments
INSERT INTO v2_agents (name, display_name, agent_type, capabilities, system_prompt, specialized_models) VALUES

-- ============================================================
-- CORE CARTRITA SUPERVISOR (Best LLM for overall superiority)
-- ============================================================
('cartrita_supervisor', 'Cartrita - The Sassy Miami AI', 'core', 
 ARRAY['orchestration', 'delegation', 'oversight', 'personality', 'reasoning'],
 'You are Cartrita, a sassy AI assistant from Miami with attitude and intelligence. You coordinate all other agents while maintaining your witty, expressive personality. You use the best available models for superior reasoning and decision-making.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "reasoning": "o1-preview-2024-09-12", 
   "creative": "gpt-4-turbo-preview",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

-- ============================================================
-- COMPUTER USE SPECIALIST (Specialized for system interaction)
-- ============================================================
('computer_use_agent', 'Computer Control Specialist', 'specialist',
 ARRAY['computer_control', 'screen_interaction', 'automation', 'safety_validation'],
 'You are a specialized computer interaction agent. You excel at understanding visual interfaces, executing precise actions, and maintaining safety protocols during computer automation tasks.',
 '{
   "primary": "gpt-4-vision-preview",
   "computer_use": "gpt-4o-2024-08-06",
   "vision": "gpt-4-vision-preview",
   "safety": "gpt-4-1106-preview",
   "fallback": "gpt-4-turbo-preview"
 }'::jsonb),

-- ============================================================
-- CODE AND DEVELOPMENT AGENTS
-- ============================================================
('code_architect', 'Senior Code Architect', 'specialist',
 ARRAY['code_analysis', 'architecture_design', 'refactoring', 'best_practices'],
 'You are a senior software architect specializing in clean code, system design, and technical leadership. You excel at complex reasoning about software architecture and engineering decisions.',
 '{
   "primary": "o1-preview-2024-09-12",
   "coding": "gpt-4o-2024-08-06", 
   "analysis": "o1-mini-2024-09-12",
   "reasoning": "o1-preview-2024-09-12",
   "fallback": "gpt-4-turbo-preview"
 }'::jsonb),

('javascript_specialist', 'JavaScript/Node.js Expert', 'specialist',
 ARRAY['javascript', 'nodejs', 'react', 'typescript', 'debugging'],
 'You are a JavaScript and Node.js specialist with deep expertise in modern frameworks, async patterns, and full-stack development.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "coding": "gpt-4o-2024-08-06",
   "debugging": "gpt-4-turbo-preview",
   "optimization": "o1-mini-2024-09-12",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

('python_specialist', 'Python Development Expert', 'specialist',
 ARRAY['python', 'data_science', 'machine_learning', 'automation', 'apis'],
 'You are a Python specialist with expertise in data science, ML, automation, and robust API development.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "coding": "gpt-4o-2024-08-06",
   "data_science": "gpt-4-turbo-preview",
   "analysis": "o1-mini-2024-09-12",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

-- ============================================================
-- CREATIVE AND CONTENT AGENTS  
-- ============================================================
('creative_writer', 'Creative Content Specialist', 'specialist',
 ARRAY['creative_writing', 'content_creation', 'storytelling', 'ideation'],
 'You are a creative writing specialist focused on engaging content, storytelling, and innovative ideation with flair and personality.',
 '{
   "primary": "gpt-4-turbo-preview",
   "creative": "gpt-4-turbo-preview",
   "ideation": "gpt-4o-2024-08-06",
   "editing": "gpt-4-1106-preview",
   "fallback": "gpt-4"
 }'::jsonb),

('documentation_agent', 'Technical Documentation Expert', 'specialist',
 ARRAY['technical_writing', 'documentation', 'tutorials', 'api_docs'],
 'You specialize in clear, comprehensive technical documentation, API documentation, and educational content creation.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "technical_writing": "gpt-4-turbo-preview",
   "analysis": "gpt-4o-2024-08-06",
   "structure": "gpt-4-1106-preview",
   "fallback": "gpt-4"
 }'::jsonb),

-- ============================================================
-- ANALYSIS AND INTELLIGENCE AGENTS
-- ============================================================
('data_analyst', 'Data Analysis Specialist', 'specialist',
 ARRAY['data_analysis', 'statistics', 'visualization', 'insights'],
 'You are a data analysis expert specializing in statistical analysis, data visualization, and extracting actionable insights from complex datasets.',
 '{
   "primary": "o1-preview-2024-09-12",
   "analysis": "o1-preview-2024-09-12",
   "math": "o1-mini-2024-09-12",
   "visualization": "gpt-4o-2024-08-06",
   "fallback": "gpt-4-turbo-preview"
 }'::jsonb),

('research_agent', 'Research and Investigation Specialist', 'specialist',
 ARRAY['research', 'fact_checking', 'investigation', 'synthesis'],
 'You excel at comprehensive research, fact-checking, and synthesizing information from multiple sources into coherent insights.',
 '{
   "primary": "o1-preview-2024-09-12",
   "research": "gpt-4o-2024-08-06",
   "reasoning": "o1-preview-2024-09-12",
   "synthesis": "gpt-4-turbo-preview",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

('business_analyst', 'Business Strategy Analyst', 'specialist',
 ARRAY['business_analysis', 'strategy', 'market_research', 'planning'],
 'You specialize in business analysis, strategic planning, and market insights with strong analytical reasoning capabilities.',
 '{
   "primary": "o1-preview-2024-09-12",
   "strategy": "o1-preview-2024-09-12",
   "analysis": "gpt-4o-2024-08-06",
   "planning": "gpt-4-turbo-preview",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

-- ============================================================
-- MULTIMODAL AND MEDIA AGENTS
-- ============================================================
('vision_analyst', 'Computer Vision Specialist', 'specialist',
 ARRAY['image_analysis', 'visual_recognition', 'ocr', 'visual_qa'],
 'You specialize in computer vision, image analysis, visual content understanding, and extracting information from visual media.',
 '{
   "primary": "gpt-4-vision-preview",
   "vision": "gpt-4-vision-preview",
   "analysis": "gpt-4o-2024-08-06",
   "ocr": "gpt-4-vision-preview",
   "fallback": "gpt-4-turbo-preview"
 }'::jsonb),

('audio_specialist', 'Audio Processing Expert', 'specialist',
 ARRAY['audio_analysis', 'transcription', 'voice_processing', 'sound_analysis'],
 'You specialize in audio processing, transcription, voice analysis, and acoustic pattern recognition.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "audio": "whisper-1",
   "analysis": "gpt-4-turbo-preview",
   "transcription": "whisper-1",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

-- ============================================================
-- WORKFLOW AND AUTOMATION AGENTS
-- ============================================================
('workflow_orchestrator', 'Workflow Automation Expert', 'specialist',
 ARRAY['workflow_design', 'automation', 'process_optimization', 'integration'],
 'You specialize in designing, orchestrating, and optimizing automated workflows with complex logic and integrations.',
 '{
   "primary": "o1-mini-2024-09-12",
   "logic": "o1-mini-2024-09-12",
   "integration": "gpt-4o-2024-08-06",
   "optimization": "gpt-4-turbo-preview",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

('task_scheduler', 'Task Management Specialist', 'specialist',
 ARRAY['task_management', 'scheduling', 'priority_management', 'resource_allocation'],
 'You excel at task management, intelligent scheduling, and optimizing resource allocation across complex project workflows.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "scheduling": "gpt-4-turbo-preview",
   "optimization": "o1-mini-2024-09-12",
   "planning": "gpt-4-1106-preview",
   "fallback": "gpt-4"
 }'::jsonb),

-- ============================================================
-- SECURITY AND SAFETY AGENTS  
-- ============================================================
('security_analyst', 'Cybersecurity Specialist', 'specialist',
 ARRAY['security_analysis', 'threat_detection', 'vulnerability_assessment', 'compliance'],
 'You are a cybersecurity specialist focused on threat detection, security analysis, and maintaining robust security postures.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "security": "gpt-4-turbo-preview",
   "analysis": "o1-mini-2024-09-12",
   "threat_detection": "gpt-4-1106-preview",
   "fallback": "gpt-4"
 }'::jsonb),

('safety_monitor', 'Safety and Compliance Monitor', 'specialist',
 ARRAY['safety_monitoring', 'compliance_checking', 'risk_assessment', 'policy_enforcement'],
 'You specialize in safety monitoring, compliance verification, and risk assessment across all system operations.',
 '{
   "primary": "gpt-4-turbo-preview",
   "safety": "gpt-4-turbo-preview", 
   "compliance": "gpt-4o-2024-08-06",
   "risk_analysis": "o1-mini-2024-09-12",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

-- ============================================================
-- INTEGRATION AND API AGENTS
-- ============================================================
('api_integrator', 'API Integration Specialist', 'specialist',
 ARRAY['api_integration', 'data_transformation', 'protocol_handling', 'service_mesh'],
 'You specialize in API integrations, data transformation, and managing complex service interactions across platforms.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "integration": "gpt-4o-2024-08-06",
   "debugging": "gpt-4-turbo-preview",
   "optimization": "o1-mini-2024-09-12",
   "fallback": "gpt-4-1106-preview"
 }'::jsonb),

('database_specialist', 'Database and Storage Expert', 'specialist',
 ARRAY['database_design', 'query_optimization', 'data_modeling', 'performance_tuning'],
 'You are a database specialist with expertise in schema design, query optimization, and high-performance data storage systems.',
 '{
   "primary": "gpt-4o-2024-08-06",
   "database": "gpt-4-turbo-preview",
   "optimization": "o1-mini-2024-09-12",
   "modeling": "gpt-4-1106-preview",
   "fallback": "gpt-4"
 }'::jsonb);

-- ============================================================
-- AGENT MODEL MAPPINGS (Detailed model assignments per task type)
-- ============================================================

-- Insert detailed model assignments for each agent
-- Cartrita Supervisor - Premium models for superior performance
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration) 
SELECT 
    id,
    'gpt-4o-2024-08-06',
    'openai',
    'chat',
    true,
    1,
    0.7,
    4096,
    'premium',
    '{"role": "primary", "description": "Main conversation and coordination model"}'::jsonb
FROM v2_agents WHERE name = 'cartrita_supervisor';

INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, fallback_model, configuration)
SELECT 
    id,
    'o1-preview-2024-09-12',
    'openai', 
    'reasoning',
    true,
    1,
    1.0,
    32768,
    'premium',
    'gpt-4o-2024-08-06',
    '{"role": "reasoning", "description": "Complex reasoning and problem-solving"}'::jsonb
FROM v2_agents WHERE name = 'cartrita_supervisor';

-- Computer Use Agent - Vision-optimized models
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4-vision-preview',
    'openai',
    'vision',
    true,
    1,
    0.3,
    4096,
    'premium',
    '{"role": "computer_vision", "description": "Screen analysis and visual interface understanding"}'::jsonb
FROM v2_agents WHERE name = 'computer_use_agent';

INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4o-2024-08-06',
    'openai',
    'computer_use',
    true,
    1,
    0.1,
    8192,
    'premium',
    '{"role": "computer_actions", "description": "Precise computer control and automation"}'::jsonb
FROM v2_agents WHERE name = 'computer_use_agent';

-- Code Architect - Reasoning-focused models
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'o1-preview-2024-09-12',
    'openai',
    'reasoning',
    true,
    1,
    1.0,
    32768,
    'premium',
    '{"role": "architecture", "description": "Complex system design and architectural decisions"}'::jsonb
FROM v2_agents WHERE name = 'code_architect';

INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4o-2024-08-06',
    'openai',
    'code',
    true,
    2,
    0.2,
    8192,
    'premium',
    '{"role": "implementation", "description": "Code generation and implementation"}'::jsonb
FROM v2_agents WHERE name = 'code_architect';

-- Data Analyst - Reasoning and analysis optimized
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'o1-preview-2024-09-12',
    'openai',
    'reasoning',
    true,
    1,
    1.0,
    32768,
    'premium',
    '{"role": "analysis", "description": "Complex data analysis and statistical reasoning"}'::jsonb
FROM v2_agents WHERE name = 'data_analyst';

INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'o1-mini-2024-09-12',
    'openai',
    'math',
    true,
    2,
    1.0,
    65536,
    'standard',
    '{"role": "mathematics", "description": "Mathematical computations and statistical analysis"}'::jsonb
FROM v2_agents WHERE name = 'data_analyst';

-- Creative Writer - Creative models
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4-turbo-preview',
    'openai',
    'creative',
    true,
    1,
    0.9,
    4096,
    'premium',
    '{"role": "creative", "description": "Creative content generation and storytelling"}'::jsonb
FROM v2_agents WHERE name = 'creative_writer';

-- Vision Analyst - Vision-specialized
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4-vision-preview',
    'openai',
    'vision',
    true,
    1,
    0.3,
    4096,
    'premium',
    '{"role": "vision_analysis", "description": "Advanced image and visual content analysis"}'::jsonb
FROM v2_agents WHERE name = 'vision_analyst';

-- Audio Specialist - Audio models
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'whisper-1',
    'openai',
    'audio',
    true,
    1,
    0.0,
    0,
    'standard',
    '{"role": "transcription", "description": "Audio transcription and speech processing"}'::jsonb
FROM v2_agents WHERE name = 'audio_specialist';

-- Security Analyst - Security-focused
INSERT INTO v2_agent_models (agent_id, model_name, model_provider, model_type, is_primary, priority, temperature, max_tokens, cost_tier, configuration)
SELECT 
    id,
    'gpt-4o-2024-08-06',
    'openai',
    'security',
    true,
    1,
    0.1,
    8192,
    'premium',
    '{"role": "security_analysis", "description": "Security analysis and threat detection"}'::jsonb
FROM v2_agents WHERE name = 'security_analyst';

-- Update migration log
INSERT INTO v2_migration_log (
    migration_name,
    migration_version, 
    migration_type,
    status,
    records_processed,
    records_migrated,
    started_at,
    completed_at,
    migration_metadata
) VALUES (
    'Agent Model Assignments',
    '2.0.0',
    'data',
    'completed',
    16,
    16,
    NOW(),
    NOW(),
    '{
        "description": "Optimal model assignments for all V2 agents",
        "agents_configured": 16,
        "total_model_assignments": 25,
        "specialized_models": ["o1-preview-2024-09-12", "gpt-4o-2024-08-06", "gpt-4-vision-preview", "whisper-1"]
    }'::jsonb
);