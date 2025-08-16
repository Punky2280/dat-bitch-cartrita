// Cartrita Router Provider Configuration
// Defines capabilities and models for each provider

export const providerConfig = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    tasks: ['chat', 'embedding', 'classification', 'audio_transcribe', 'vision'],
    models: {
      chat: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      embedding: ['text-embedding-3-small', 'text-embedding-3-large'],
      classification: ['gpt-4o-mini'],
      audio_transcribe: ['whisper-1'],
      vision: ['gpt-4o', 'gpt-4o-mini']
    },
    pricing: {
      'gpt-4o-mini': { input: 0.15, output: 0.60 }, // per 1M tokens
      'gpt-4o': { input: 2.50, output: 10.00 },
      'text-embedding-3-small': { input: 0.02 },
      'whisper-1': { input: 0.006 } // per minute
    },
    latencyScore: 0.8, // 0-1, higher is better
    reliabilityScore: 0.95
  },
  
  deepgram: {
    id: 'deepgram',
    name: 'Deepgram',
    baseUrl: 'https://api.deepgram.com/v1',
    tasks: ['audio_transcribe'],
    models: {
      audio_transcribe: ['nova-2', 'whisper-large', 'enhanced']
    },
    pricing: {
      'nova-2': { input: 0.0043 }, // per minute
      'whisper-large': { input: 0.0048 },
      'enhanced': { input: 0.0059 }
    },
    latencyScore: 0.9,
    reliabilityScore: 0.92
  },
  
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co',
    tasks: ['chat', 'classification', 'embedding', 'vision'],
    models: {
      chat: ['deepseek-ai/DeepSeek-V3', 'mistral-7b-instruct', 'llama-3-8b-instruct'],
      classification: ['distilbert-base-uncased', 'facebook/bart-large-mnli'],
      embedding: ['sentence-transformers/all-MiniLM-L6-v2', 'intfloat/multilingual-e5-large'],
      vision: ['vit-base-patch16-224', 'google/vit-large-patch16-224']
    },
    pricing: {
      // HF Inference API pricing (approximate)
      'deepseek-ai/DeepSeek-V3': { input: 0.14, output: 0.28 },
      'sentence-transformers/all-MiniLM-L6-v2': { input: 0.01 }
    },
    latencyScore: 0.6,
    reliabilityScore: 0.85
  },
  
  local: {
    id: 'local',
    name: 'Local Pipeline',
    baseUrl: 'http://localhost',
    tasks: ['classification', 'embedding', 'chat'],
    models: {
      classification: ['local-fast-text-clf', 'local-bert-classifier'],
      embedding: ['local-sentence-embed', 'local-word2vec'],
      chat: ['local-mock-chat']
    },
    pricing: {
      // Local models are essentially free (just compute cost)
      'local-fast-text-clf': { input: 0.001 },
      'local-sentence-embed': { input: 0.001 }
    },
    latencyScore: 0.95, // Usually fastest for simple tasks
    reliabilityScore: 0.75 // Depends on local setup
  }
};

// Task to providers mapping for quick lookup
export const taskProviders = {};
for (const [providerId, config] of Object.entries(providerConfig)) {
  for (const task of config.tasks) {
    if (!taskProviders[task]) taskProviders[task] = [];
    taskProviders[task].push(providerId);
  }
}

// Dynamic provider performance tracking
const providerMetrics = new Map();

// Get or initialize metrics for a provider
function getProviderMetrics(providerId) {
  if (!providerMetrics.has(providerId)) {
    providerMetrics.set(providerId, {
      averageLatency: null,
      successRate: 1.0,
      recentLatencies: [],
      totalRequests: 0,
      successfulRequests: 0,
      lastUpdated: Date.now()
    });
  }
  return providerMetrics.get(providerId);
}

// Update provider metrics after a request
export function updateProviderMetrics(providerId, latencyMs, success = true) {
  const metrics = getProviderMetrics(providerId);
  
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
    metrics.recentLatencies.push(latencyMs);
    
    // Keep only last 50 latencies for rolling average
    if (metrics.recentLatencies.length > 50) {
      metrics.recentLatencies.shift();
    }
    
    // Calculate rolling average latency
    metrics.averageLatency = metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length;
  }
  
  // Update success rate
  metrics.successRate = metrics.successfulRequests / metrics.totalRequests;
  metrics.lastUpdated = Date.now();
}

// Get real-time provider metrics
export function getRealTimeProviderMetrics(providerId) {
  return providerMetrics.get(providerId) || null;
}

// Enhanced provider scoring with dynamic metrics
export function scoreProvider(providerId, task, options = {}) {
  const config = providerConfig[providerId];
  if (!config || !config.tasks.includes(task)) return 0;
  
  const weights = {
    latency: options.latencyWeight || 0.4,
    reliability: options.reliabilityWeight || 0.3,
    cost: options.costWeight || 0.3
  };
  
  // Get cost for the default model for this task
  const models = config.models[task];
  const defaultModel = models?.[0];
  const pricing = config.pricing[defaultModel] || {};
  const cost = pricing.input || 0.1; // fallback cost
  
  // Normalize cost (lower is better, so invert)
  const maxCost = 10.0; // adjust based on actual price ranges
  const normalizedCost = Math.max(0, 1 - (cost / maxCost));
  
  // Get dynamic metrics for more accurate scoring
  const metrics = getRealTimeProviderMetrics(providerId);
  
  // Use dynamic latency if available, otherwise use static score
  let latencyScore = config.latencyScore;
  if (metrics && metrics.averageLatency !== null) {
    // Convert latency to score (lower latency = higher score)
    // Assume 5000ms is worst case, 100ms is best case
    const normalizedLatency = Math.max(0, Math.min(1, (5000 - metrics.averageLatency) / 4900));
    latencyScore = normalizedLatency;
  }
  
  // Use dynamic reliability if available, otherwise use static score
  let reliabilityScore = config.reliabilityScore;
  if (metrics && metrics.totalRequests > 5) { // Need some history for reliability
    reliabilityScore = metrics.successRate;
  }
  
  const score = (
    weights.latency * latencyScore +
    weights.reliability * reliabilityScore +
    weights.cost * normalizedCost
  );
  
  return score;
}

// Get best provider for a task
export function selectBestProvider(task, options = {}) {
  let candidates = taskProviders[task];
  if (!candidates || candidates.length === 0) {
    throw new Error(`No providers available for task: ${task}`);
  }
  
  // Filter by available providers if specified
  if (options.availableProviders && Array.isArray(options.availableProviders)) {
    candidates = candidates.filter(p => options.availableProviders.includes(p));
  }
  
  if (candidates.length === 0) {
    throw new Error(`No available providers for task: ${task}`);
  }
  
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  let bestProvider = candidates[0];
  let bestScore = scoreProvider(bestProvider, task, options);
  
  for (let i = 1; i < candidates.length; i++) {
    const score = scoreProvider(candidates[i], task, options);
    if (score > bestScore) {
      bestScore = score;
      bestProvider = candidates[i];
    }
  }
  
  return bestProvider;
}

// Get best model for a provider and task
export function selectModel(providerId, task, options = {}) {
  const config = providerConfig[providerId];
  if (!config || !config.tasks.includes(task)) {
    throw new Error(`Provider ${providerId} does not support task ${task}`);
  }
  
  const models = config.models[task];
  if (!models || models.length === 0) {
    throw new Error(`No models available for ${providerId}/${task}`);
  }
  
  // For now, return the first model (could be enhanced with model-specific scoring)
  return options.modelHint && models.includes(options.modelHint) 
    ? options.modelHint 
    : models[0];
}