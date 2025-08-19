/**
 * GPT-5 Model Configuration for Cartrita V2 Migration
 * Optimal model assignments based on agent use cases and GPT-5 capabilities
 * Created: January 27, 2025
 */

const GPT5_MODELS = {
  // Standard GPT-5 with high reasoning capabilities
  GPT5: {
    model: 'gpt-5',
    temperature: 0.3,
    reasoning: 'high',
    verbosity: 'medium',
    features: ['freeform_calling', 'context_free_grammar', 'minimal_reasoning']
  },

  // GPT-5 optimized for speed with minimal reasoning
  GPT5_FAST: {
    model: 'gpt-5-fast',
    temperature: 0.1,
    reasoning: 'minimal',
    verbosity: 'low',
    features: ['minimal_reasoning', 'speed_optimization']
  },

  // GPT-5 Mini for cost-effective operations
  GPT5_MINI: {
    model: 'gpt-5-mini',
    temperature: 0.5,
    reasoning: 'medium',
    verbosity: 'medium',
    features: ['cost_effective', 'balanced_performance']
  },

  // GPT-5 Nano for lightweight tasks
  GPT5_NANO: {
    model: 'gpt-5-nano',
    temperature: 0.2,
    reasoning: 'minimal',
    verbosity: 'low',
    features: ['ultra_lightweight', 'fast_response']
  }
};

/**
 * Optimal model assignments for each agent based on their specialization
 * and required reasoning complexity
 */
const AGENT_MODEL_ASSIGNMENTS = {
  // Core orchestration - requires high reasoning
  supervisor: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'high',
    rationale: 'Complex orchestration and delegation decisions'
  },

  // Specialized agents with high complexity requirements
  computer_use: {
    ...GPT5_MODELS.GPT5_FAST,
    reasoning: 'medium',
    verbosity: 'low',
    rationale: 'Precise computer control with safety validation'
  },

  code_maestro: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'high',
    rationale: 'Complex code generation and refactoring'
  },

  architect: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'high',
    rationale: 'System architecture and design decisions'
  },

  analytics: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'medium',
    rationale: 'Complex data analysis and insights'
  },

  workflow_maestro: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'medium',
    rationale: 'Complex workflow orchestration and optimization'
  },

  // Medium complexity agents
  writer: {
    ...GPT5_MODELS.GPT5_MINI,
    temperature: 0.8,
    reasoning: 'medium',
    verbosity: 'high',
    rationale: 'Creative writing with balanced performance'
  },

  researcher: {
    ...GPT5_MODELS.GPT5_MINI,
    reasoning: 'medium',
    verbosity: 'medium',
    rationale: 'Information gathering and synthesis'
  },

  integration: {
    ...GPT5_MODELS.GPT5_MINI,
    reasoning: 'medium',
    verbosity: 'low',
    rationale: 'API integration and data processing'
  },

  security: {
    ...GPT5_MODELS.GPT5,
    reasoning: 'high',
    verbosity: 'low',
    rationale: 'Security analysis requires high reasoning'
  },

  // Creative agents with balanced requirements
  artist: {
    ...GPT5_MODELS.GPT5_MINI,
    temperature: 0.8,
    reasoning: 'medium',
    verbosity: 'medium',
    rationale: 'Creative visual generation with cost efficiency'
  },

  // Simple task agents
  file_organizer: {
    ...GPT5_MODELS.GPT5_NANO,
    reasoning: 'minimal',
    verbosity: 'low',
    rationale: 'Simple file operations'
  },

  knowledge_curator: {
    ...GPT5_MODELS.GPT5_MINI,
    reasoning: 'medium',
    verbosity: 'medium',
    rationale: 'Knowledge organization and retrieval'
  },

  // HuggingFace bridge agents
  hf_language: {
    ...GPT5_MODELS.GPT5_NANO,
    reasoning: 'minimal',
    verbosity: 'low',
    rationale: 'Bridge to HF models, minimal reasoning needed'
  },

  hf_vision: {
    ...GPT5_MODELS.GPT5_NANO,
    reasoning: 'minimal',
    verbosity: 'low',
    rationale: 'Bridge to HF models, minimal reasoning needed'
  },

  hf_audio: {
    ...GPT5_MODELS.GPT5_NANO,
    reasoning: 'minimal',
    verbosity: 'low',
    rationale: 'Bridge to HF models, minimal reasoning needed'
  }
};

/**
 * Get optimal model configuration for a specific agent
 * @param {string} agentName - Name of the agent
 * @returns {object} Model configuration with GPT-5 features
 */
export function getOptimalModelForAgent(agentName) {
  const assignment = AGENT_MODEL_ASSIGNMENTS[agentName];
  if (!assignment) {
    console.warn(`[GPT5Models] No specific assignment for agent '${agentName}', using default GPT5_MINI`);
    return {
      ...GPT5_MODELS.GPT5_MINI,
      rationale: 'Default assignment - no specific configuration found'
    };
  }

  return {
    ...assignment,
    agentName,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get all agent model assignments for management and monitoring
 * @returns {object} Complete mapping of agents to model configurations
 */
export function getAllAgentAssignments() {
  return AGENT_MODEL_ASSIGNMENTS;
}

/**
 * Update model assignment for an agent (for dynamic optimization)
 * @param {string} agentName - Name of the agent
 * @param {object} modelConfig - New model configuration
 */
export function updateAgentModelAssignment(agentName, modelConfig) {
  AGENT_MODEL_ASSIGNMENTS[agentName] = {
    ...modelConfig,
    lastUpdated: new Date().toISOString()
  };
  console.log(`[GPT5Models] Updated model assignment for ${agentName}: ${modelConfig.model}`);
}

/**
 * Get GPT-5 feature compatibility for a model
 * @param {string} modelName - Name of the model
 * @returns {array} Array of supported features
 */
export function getModelFeatures(modelName) {
  const modelConfig = Object.values(GPT5_MODELS).find(config => config.model === modelName);
  return modelConfig?.features || [];
}

export default {
  MODELS: GPT5_MODELS,
  ASSIGNMENTS: AGENT_MODEL_ASSIGNMENTS,
  getOptimalModelForAgent,
  getAllAgentAssignments,
  updateAgentModelAssignment,
  getModelFeatures
};