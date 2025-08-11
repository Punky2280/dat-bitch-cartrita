#!/usr/bin/env node

/**
 * Model Registry Seeder
 * 
 * Seeds the model registry with initial models based on the specifications
 * from the Cartrita Model Registry specification document.
 * 
 * Usage: node scripts/seed-model-registry.mjs
 */

// Use the integrated service instead for simplicity
import IntegratedAIService from '../src/services/IntegratedAIService.js';
import pool from '../src/db.js';
import { createClient } from 'redis';

// Model data based on specification
const INITIAL_MODELS = [
  // General LLM (Balanced)
  {
    model_id: 'mistral-7b-instruct',
    provider: 'huggingface',
    task_types: ['text-generation', 'chat-completions'],
    family: 'mistral',
    parameters_billion: 7,
    architectural_type: 'decoder',
    license: 'Apache-2.0',
    commercial_allowed: true,
    context_length: 8192,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'A10G': 120,
      'L4': 95,
      'T4': 55
    },
    avg_latency_ms_512_tokens: 950,
    quality_metrics: {
      mmlu: 64.3,
      mt_bench: 7.3,
      truthfulqa: 48.1,
      composite_score: 6.6
    },
    safety_risk_level: 'medium',
    default_temperature: 0.7,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'A10G',
      estimated_hourly_usd: 1.3,
      estimated_tokens_per_hour: 432000,
      estimated_cost_per_1k_tokens_usd: 0.003009,
      pricing_model: 'hardware'
    },
    routing_tags: ['general', 'fast', 'instruct', 'balanced'],
    fallback_chain: ['phi-3-mini-instruct'],
    status: 'active',
    risk_notes: 'Monitor hallucination above 4K context.'
  },

  {
    model_id: 'mixtral-8x7b-instruct',
    provider: 'huggingface',
    task_types: ['text-generation', 'chat-completions'],
    family: 'mixtral',
    parameters_billion: 56,
    architectural_type: 'mixture-of-experts',
    license: 'Apache-2.0',
    commercial_allowed: true,
    context_length: 32768,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'A10G': 80,
      'L4': 60,
      'A100': 180
    },
    avg_latency_ms_512_tokens: 1200,
    quality_metrics: {
      mmlu: 70.6,
      mt_bench: 8.3,
      truthfulqa: 64.6,
      composite_score: 7.8
    },
    safety_risk_level: 'medium',
    default_temperature: 0.7,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'A100',
      estimated_hourly_usd: 4.5,
      estimated_tokens_per_hour: 648000,
      estimated_cost_per_1k_tokens_usd: 0.00694,
      pricing_model: 'hardware',
      moe_efficiency_factor: 0.75
    },
    routing_tags: ['general', 'high-quality', 'instruct', 'moe'],
    fallback_chain: ['mistral-7b-instruct'],
    status: 'active'
  },

  {
    model_id: 'llama-3-8b-instruct',
    provider: 'huggingface',
    task_types: ['text-generation', 'chat-completions'],
    family: 'llama',
    parameters_billion: 8,
    architectural_type: 'decoder',
    license: 'Llama-3-Community',
    commercial_allowed: true,
    context_length: 8192,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'A10G': 110,
      'L4': 85,
      'T4': 50
    },
    avg_latency_ms_512_tokens: 1000,
    quality_metrics: {
      mmlu: 68.4,
      mt_bench: 8.0,
      truthfulqa: 51.8,
      composite_score: 7.2
    },
    safety_risk_level: 'low',
    default_temperature: 0.7,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'A10G',
      estimated_hourly_usd: 1.4,
      estimated_tokens_per_hour: 396000,
      estimated_cost_per_1k_tokens_usd: 0.00353,
      pricing_model: 'hardware'
    },
    routing_tags: ['general', 'instruct', 'balanced', 'safe'],
    fallback_chain: ['mistral-7b-instruct'],
    status: 'active'
  },

  // Lightweight Fast
  {
    model_id: 'phi-3-mini-instruct',
    provider: 'huggingface',
    task_types: ['text-generation', 'chat-completions', 'classification'],
    family: 'phi',
    parameters_billion: 3.8,
    architectural_type: 'decoder',
    license: 'MIT',
    commercial_allowed: true,
    context_length: 4096,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'T4': 180,
      'L4': 220,
      'A10G': 300
    },
    avg_latency_ms_512_tokens: 400,
    quality_metrics: {
      mmlu: 69.0,
      mt_bench: 7.5,
      composite_score: 7.1
    },
    safety_risk_level: 'low',
    default_temperature: 0.7,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'T4',
      estimated_hourly_usd: 0.6,
      estimated_tokens_per_hour: 648000,
      estimated_cost_per_1k_tokens_usd: 0.000926,
      pricing_model: 'hardware'
    },
    routing_tags: ['lightweight', 'fast', 'classification', 'routing'],
    fallback_chain: [],
    status: 'active',
    risk_notes: 'Suitable for low-latency tasks and routing decisions.'
  },

  // Code Generation
  {
    model_id: 'starcoder2-15b',
    provider: 'huggingface',
    task_types: ['code-generation', 'text-generation'],
    family: 'starcoder',
    parameters_billion: 15,
    architectural_type: 'decoder',
    license: 'BigCode-OpenRAIL-M',
    commercial_allowed: true,
    context_length: 16384,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'A10G': 85,
      'L4': 65,
      'A100': 150
    },
    avg_latency_ms_512_tokens: 1100,
    quality_metrics: {
      humaneval: 46.2,
      mbpp: 52.7,
      composite_score: 7.4
    },
    safety_risk_level: 'medium',
    default_temperature: 0.1,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'A10G',
      estimated_hourly_usd: 2.1,
      estimated_tokens_per_hour: 306000,
      estimated_cost_per_1k_tokens_usd: 0.00686,
      pricing_model: 'hardware'
    },
    routing_tags: ['code', 'programming', 'development'],
    fallback_chain: ['llama-3-8b-instruct'],
    status: 'active'
  },

  {
    model_id: 'codellama-34b-instruct',
    provider: 'huggingface',
    task_types: ['code-generation', 'text-generation', 'chat-completions'],
    family: 'codellama',
    parameters_billion: 34,
    architectural_type: 'decoder',
    license: 'Llama-2-Community',
    commercial_allowed: true,
    context_length: 16384,
    quantizations: ['fp16', 'int8', 'int4'],
    throughput_metadata: {
      'A100': 90,
      'A10G': 45,
      'L4': 30
    },
    avg_latency_ms_512_tokens: 1800,
    quality_metrics: {
      humaneval: 53.7,
      mbpp: 56.2,
      composite_score: 8.1
    },
    safety_risk_level: 'medium',
    default_temperature: 0.1,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'A100',
      estimated_hourly_usd: 6.2,
      estimated_tokens_per_hour: 324000,
      estimated_cost_per_1k_tokens_usd: 0.01914,
      pricing_model: 'hardware'
    },
    routing_tags: ['code', 'programming', 'high-quality', 'complex'],
    fallback_chain: ['starcoder2-15b'],
    status: 'active'
  },

  // Embeddings
  {
    model_id: 'bge-large-en-v1.5',
    provider: 'huggingface',
    task_types: ['embeddings'],
    family: 'bge',
    parameters_billion: 0.34,
    architectural_type: 'encoder',
    license: 'MIT',
    commercial_allowed: true,
    context_length: 512,
    quantizations: ['fp16', 'int8'],
    throughput_metadata: {
      'T4': 2500,
      'L4': 3200,
      'A10G': 4500
    },
    avg_latency_ms_512_tokens: 80,
    quality_metrics: {
      mteb_average: 75.7,
      retrieval_accuracy: 0.82,
      composite_score: 8.5
    },
    safety_risk_level: 'low',
    default_temperature: 0.0,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'T4',
      estimated_hourly_usd: 0.4,
      estimated_tokens_per_hour: 9000000,
      estimated_cost_per_1k_tokens_usd: 0.0000444,
      pricing_model: 'hardware'
    },
    routing_tags: ['embeddings', 'retrieval', 'english', 'rag'],
    fallback_chain: ['text-embedding-ada-002'],
    status: 'active'
  },

  {
    model_id: 'text-embedding-ada-002',
    provider: 'openai',
    task_types: ['embeddings'],
    family: 'ada',
    parameters_billion: 0.35,
    architectural_type: 'encoder',
    license: 'OpenAI-Commercial',
    commercial_allowed: true,
    context_length: 8191,
    quantizations: ['fp16'],
    throughput_metadata: {
      'openai_api': 3000
    },
    avg_latency_ms_512_tokens: 200,
    quality_metrics: {
      mteb_average: 69.1,
      retrieval_accuracy: 0.78,
      composite_score: 7.8
    },
    safety_risk_level: 'low',
    default_temperature: 0.0,
    cost_profile: {
      endpoint_type: 'serverless',
      recommended_hardware: 'openai_api',
      estimated_hourly_usd: 0.0,
      estimated_tokens_per_hour: 10800000,
      estimated_cost_per_1k_tokens_usd: 0.0001,
      pricing_model: 'token_based'
    },
    routing_tags: ['embeddings', 'retrieval', 'openai', 'rag'],
    fallback_chain: ['bge-large-en-v1.5'],
    status: 'active'
  },

  // Safety/Moderation
  {
    model_id: 'llama-guard-2',
    provider: 'huggingface',
    task_types: ['safety-moderation', 'classification'],
    family: 'llama-guard',
    parameters_billion: 8,
    architectural_type: 'decoder',
    license: 'Llama-2-Community',
    commercial_allowed: true,
    context_length: 4096,
    quantizations: ['fp16', 'int8'],
    throughput_metadata: {
      'T4': 150,
      'L4': 200,
      'A10G': 280
    },
    avg_latency_ms_512_tokens: 350,
    quality_metrics: {
      safety_accuracy: 0.94,
      precision: 0.89,
      recall: 0.91,
      composite_score: 9.1
    },
    safety_risk_level: 'low',
    default_temperature: 0.0,
    cost_profile: {
      endpoint_type: 'dedicated',
      recommended_hardware: 'T4',
      estimated_hourly_usd: 0.5,
      estimated_tokens_per_hour: 540000,
      estimated_cost_per_1k_tokens_usd: 0.000926,
      pricing_model: 'hardware'
    },
    routing_tags: ['safety', 'moderation', 'classification', 'guard'],
    fallback_chain: [],
    status: 'active',
    risk_notes: 'Specialized for content moderation - not for general text generation.'
  }
];

async function seedModelRegistry() {
  
  try {
    console.log('[Model Registry Seeder] 🌱 Starting model registry seeding...');

    // Initialize integrated AI service
    const aiService = new IntegratedAIService();
    await aiService.initialize();

    console.log('[Model Registry Seeder] ✅ Integrated AI service initialized');

    // Get the model registry from the service
    const modelRegistry = aiService.modelRegistry;
    
    if (!modelRegistry) {
      throw new Error('Model registry not available from integrated service');
    }

    // Seed models
    let successCount = 0;
    let failureCount = 0;

    for (const model of INITIAL_MODELS) {
      try {
        console.log(`[Model Registry Seeder] 📝 Seeding model: ${model.model_id}`);
        
        const result = await modelRegistry.registerModel(model);
        
        if (result.success) {
          successCount++;
          console.log(`[Model Registry Seeder] ✅ Successfully seeded: ${model.model_id}`);
        } else {
          failureCount++;
          console.error(`[Model Registry Seeder] ❌ Failed to seed ${model.model_id}:`, result.error?.message);
        }
      } catch (error) {
        failureCount++;
        console.error(`[Model Registry Seeder] ❌ Error seeding ${model.model_id}:`, error.message);
      }
    }

    console.log(`[Model Registry Seeder] 🏁 Seeding complete!`);
    console.log(`[Model Registry Seeder] ✅ Success: ${successCount} models`);
    console.log(`[Model Registry Seeder] ❌ Failures: ${failureCount} models`);

    // Update efficiency scores
    try {
      await pool.query('SELECT update_model_efficiency_scores()');
      console.log('[Model Registry Seeder] ✅ Efficiency scores updated');
    } catch (error) {
      console.warn('[Model Registry Seeder] ⚠️ Failed to update efficiency scores:', error.message);
    }

    // Test model selection
    try {
      console.log('[Model Registry Seeder] 🧪 Testing model selection...');
      
      const testSelections = [
        { task_type: 'text-generation', quality_weight: 0.6, cost_weight: 0.4, latency_weight: 0.0 },
        { task_type: 'code-generation', quality_weight: 0.8, cost_weight: 0.1, latency_weight: 0.1 },
        { task_type: 'embeddings', quality_weight: 0.3, cost_weight: 0.5, latency_weight: 0.2 },
        { task_type: 'safety-moderation', quality_weight: 0.9, cost_weight: 0.05, latency_weight: 0.05 }
      ];

      for (const criteria of testSelections) {
        const selection = await modelRegistry.selectModel(criteria, {
          user_id: 1,
          stage: 'seeding_test'
        });
        console.log(`[Model Registry Seeder] 🎯 ${criteria.task_type}: ${selection.selected} (${selection.reason})`);
      }
    } catch (testError) {
      console.warn('[Model Registry Seeder] ⚠️ Model selection test failed:', testError.message);
    }

    await aiService.cleanup();

  } catch (error) {
    console.error('[Model Registry Seeder] ❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (dbError) {
      console.warn('[Model Registry Seeder] ⚠️ Database disconnect error:', dbError.message);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedModelRegistry().catch(console.error);
}

export { seedModelRegistry, INITIAL_MODELS };