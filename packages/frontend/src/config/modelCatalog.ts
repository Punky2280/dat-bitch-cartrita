// Central HuggingFace / multi-provider model catalog (>=25 models) grouped by category.
// This does not trigger any backend fetch by itself; UI components can import and filter.
// Structure kept simple to allow future expansion (e.g., provider, contextLength, license).

export type ModelCategory = 'chat' | 'code' | 'embeddings' | 'rerank' | 'vision' | 'audio-stt' | 'tts' | 'multimodal';

export interface ModelCatalogEntry {
  id: string;              // provider/model identifier (HF repo or provider:model)
  name: string;            // display name
  category: ModelCategory; // functional category
  provider?: string;       // optional provider label (openai, hf, anthropic, etc.)
  size?: string;           // rough size descriptor (small/medium/large) or parameter scale
  quality?: 'Low' | 'Basic' | 'Med' | 'High' | 'SOTA';
  speed?: 'Ultra Fast' | 'Very Fast' | 'Fast' | 'Medium' | 'Slow';
  languages?: string[];    // primary language coverage
  notes?: string;          // brief usage note
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Chat / General LLM
  { id: 'meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B Instruct', category: 'chat', provider: 'hf', size: '8B', quality: 'High', speed: 'Fast', notes: 'Balanced general instruct.' },
  { id: 'meta-llama/Meta-Llama-3-70B-Instruct', name: 'Llama 3 70B Instruct', category: 'chat', provider: 'hf', size: '70B', quality: 'SOTA', speed: 'Slow', notes: 'High quality, heavier latency.' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct', category: 'chat', provider: 'hf', size: '7B', quality: 'High', speed: 'Fast', notes: 'Strong performance small footprint.' },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', category: 'chat', provider: 'hf', size: 'MoE 46.7B act', quality: 'High', speed: 'Medium', notes: 'Mixture-of-Experts efficiency.' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B IT', category: 'chat', provider: 'hf', size: '9B', quality: 'High', speed: 'Medium', notes: 'Instruction tuned, multilingual lean.' },
  { id: 'Qwen/Qwen2-7B-Instruct', name: 'Qwen2 7B Instruct', category: 'chat', provider: 'hf', size: '7B', quality: 'High', speed: 'Fast', notes: 'Good reasoning & multilingual.' },
  { id: 'databricks/dbrx-instruct', name: 'DBRX Instruct', category: 'chat', provider: 'hf', size: 'MoE', quality: 'High', speed: 'Slow', notes: 'Enterprise-grade mixture model.' },

  // Code
  { id: 'bigcode/starcoder2-15b', name: 'StarCoder2 15B', category: 'code', provider: 'hf', size: '15B', quality: 'High', speed: 'Medium', notes: 'Strong multi-language coding.' },
  { id: 'deepseek-ai/deepseek-coder-6.7b-instruct', name: 'DeepSeek Coder 6.7B', category: 'code', provider: 'hf', size: '6.7B', quality: 'High', speed: 'Fast', notes: 'Efficient code instruct model.' },
  { id: 'Salesforce/codegen25-7b-multi', name: 'CodeGen25 7B Multi', category: 'code', provider: 'hf', size: '7B', quality: 'Med', speed: 'Fast', notes: 'General multi-language code gen.' },
  { id: 'defog/sqlcoder-7b-2', name: 'SQLCoder 7B', category: 'code', provider: 'hf', size: '7B', quality: 'High', speed: 'Fast', notes: 'SQL-focused generation.' },

  // Embeddings
  { id: 'sentence-transformers/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', category: 'embeddings', provider: 'hf', size: '22M', quality: 'Med', speed: 'Ultra Fast', notes: 'Baseline general embeddings.' },
  { id: 'sentence-transformers/multi-qa-mpnet-base-dot-v1', name: 'multi-qa-mpnet-base-dot-v1', category: 'embeddings', provider: 'hf', size: 'Base', quality: 'High', speed: 'Fast', notes: 'QA / semantic search strong.' },
  { id: 'intfloat/e5-large-v2', name: 'e5-large-v2', category: 'embeddings', provider: 'hf', size: 'Large', quality: 'High', speed: 'Medium', notes: 'Instruction tuned embeddings.' },
  { id: 'BAAI/bge-large-en-v1.5', name: 'bge-large-en-v1.5', category: 'embeddings', provider: 'hf', size: 'Large', quality: 'High', speed: 'Medium', notes: 'Strong retrieval English.' },
  { id: 'nomic-ai/nomic-embed-text-v1', name: 'nomic-embed-text-v1', category: 'embeddings', provider: 'hf', size: 'Base', quality: 'High', speed: 'Fast', notes: 'High quality open embeddings.' },

  // Rerank
  { id: 'BAAI/bge-reranker-base', name: 'bge-reranker-base', category: 'rerank', provider: 'hf', size: 'Base', quality: 'Med', speed: 'Fast', notes: 'Baseline re-ranker.' },
  { id: 'cross-encoder/ms-marco-MiniLM-L-6-v2', name: 'ms-marco MiniLM L-6', category: 'rerank', provider: 'hf', size: 'Mini', quality: 'Med', speed: 'Very Fast', notes: 'Lightweight cross-encoder.' },
  { id: 'BAAI/bge-reranker-large', name: 'bge-reranker-large', category: 'rerank', provider: 'hf', size: 'Large', quality: 'High', speed: 'Slow', notes: 'Higher accuracy, slower.' },

  // Vision
  { id: 'google/vit-base-patch16-224', name: 'ViT Base 224', category: 'vision', provider: 'hf', size: 'Base', quality: 'Med', speed: 'Fast', notes: 'General image classification.' },
  { id: 'openai/clip-vit-base-patch32', name: 'CLIP ViT-B/32', category: 'vision', provider: 'hf', size: 'Base', quality: 'High', speed: 'Fast', notes: 'Image-text similarity.' },
  { id: 'Salesforce/blip-image-captioning-base', name: 'BLIP Caption Base', category: 'vision', provider: 'hf', size: 'Base', quality: 'Med', speed: 'Fast', notes: 'Image captioning.' },

  // Audio (STT)
  { id: 'openai/whisper-small', name: 'Whisper Small', category: 'audio-stt', provider: 'hf', size: '244M', quality: 'Basic', speed: 'Very Fast', notes: 'Fast baseline STT.' },
  { id: 'openai/whisper-large-v3', name: 'Whisper Large v3', category: 'audio-stt', provider: 'hf', size: '1.55B', quality: 'High', speed: 'Medium', notes: 'High accuracy multilingual.' },
  { id: 'distil-whisper/distil-large-v3', name: 'Distil Whisper Large v3', category: 'audio-stt', provider: 'hf', size: 'Compressed', quality: 'High', speed: 'Fast', notes: 'Distilled speed/quality tradeoff.' },

  // TTS (placeholder IDs referencing popular open community models)
  { id: 'myshell-ai/MeloTTS-English', name: 'MeloTTS English', category: 'tts', provider: 'hf', size: 'Base', quality: 'Med', speed: 'Fast', notes: 'English TTS melodic voice.' },
  { id: 'coqui/XTTS-v2', name: 'XTTS v2', category: 'tts', provider: 'hf', size: 'Large', quality: 'High', speed: 'Medium', notes: 'Multilingual TTS + cloning.' },

  // Multimodal
  { id: 'llava-hf/llava-v1.6-mistral-7b-hf', name: 'LLaVA 1.6 Mistral 7B', category: 'multimodal', provider: 'hf', size: '7B', quality: 'High', speed: 'Medium', notes: 'Image + text chat.' },
  { id: 'Qwen/Qwen2-VL-7B-Instruct', name: 'Qwen2-VL 7B Instruct', category: 'multimodal', provider: 'hf', size: '7B', quality: 'High', speed: 'Medium', notes: 'Vision-language reasoning.' }
];

// Helper filters
export const getModelsByCategory = (category: ModelCategory): ModelCatalogEntry[] =>
  MODEL_CATALOG.filter(m => m.category === category);

export const findModel = (id: string): ModelCatalogEntry | undefined =>
  MODEL_CATALOG.find(m => m.id === id);

export const listCategories = (): ModelCategory[] => {
  return Array.from(new Set(MODEL_CATALOG.map(m => m.category))) as ModelCategory[];
};

export default MODEL_CATALOG;
