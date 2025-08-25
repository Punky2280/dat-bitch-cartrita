/**
 * Unified Model Registry - Task-based organization for HF token normalization
 * All models accessible through single HuggingFace Inference Router
 */
// Task configurations
export const TaskConfigs = {
    chat: { defaultTimeout: 30000, maxRetries: 2, cacheable: false },
    multimodal_chat: { defaultTimeout: 45000, maxRetries: 2, cacheable: false },
    asr: {
        defaultTimeout: 30000,
        maxRetries: 2,
        cacheable: true,
        cacheTtl: 86400,
    },
    embeddings: {
        defaultTimeout: 20000,
        maxRetries: 3,
        cacheable: true,
        cacheTtl: 604800,
    },
    image_generation: {
        defaultTimeout: 60000,
        maxRetries: 1,
        cacheable: true,
        cacheTtl: 86400,
    },
    image_edit: {
        defaultTimeout: 60000,
        maxRetries: 1,
        cacheable: true,
        cacheTtl: 86400,
    },
    video_generation: {
        defaultTimeout: 120000,
        maxRetries: 1,
        cacheable: true,
        cacheTtl: 86400,
    },
    nlp_classic: {
        defaultTimeout: 20000,
        maxRetries: 2,
        cacheable: true,
        cacheTtl: 3600,
    },
    vision_analysis: {
        defaultTimeout: 30000,
        maxRetries: 2,
        cacheable: true,
        cacheTtl: 3600,
    },
};
// Unified Model Registry organized by task families
export const Registry = {
    // Text Chat (General Instruction)
    chat: [
        {
            provider: 'together',
            model: 'openai/gpt-oss-120b',
            capabilities: ['chat', 'reasoning'],
            tier: 'primary',
            maxInputTokens: 32768,
            costTier: 'high',
        },
        {
            provider: 'cerebras',
            model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
            capabilities: ['chat', 'reasoning'],
            tier: 'primary',
            maxInputTokens: 16384,
            costTier: 'medium',
        },
        {
            provider: 'fireworks-ai',
            model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
            capabilities: ['chat'],
            tier: 'fallback',
            maxInputTokens: 16384,
            costTier: 'medium',
        },
        {
            provider: 'sambanova',
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            capabilities: ['chat'],
            tier: 'lite',
            maxInputTokens: 8192,
            costTier: 'low',
        },
        {
            provider: 'hf-inference',
            model: 'HuggingFaceTB/SmolLM3-3B',
            capabilities: ['chat'],
            tier: 'lite',
            maxInputTokens: 4096,
            costTier: 'low',
            notes: 'Ultra-light fallback',
        },
    ],
    // Multimodal Chat (Vision+Text)
    multimodal_chat: [
        {
            provider: 'together',
            model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
            capabilities: ['chat', 'vision'],
            tier: 'primary',
            maxInputTokens: 16384,
            costTier: 'high',
        },
        {
            provider: 'sambanova',
            model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
            capabilities: ['chat', 'vision'],
            tier: 'primary',
            maxInputTokens: 32768,
            costTier: 'high',
        },
        {
            provider: 'cohere',
            model: 'CohereLabs/command-a-vision-07-2025',
            capabilities: ['chat', 'vision'],
            tier: 'fallback',
            costTier: 'medium',
        },
        {
            provider: 'hyperbolic',
            model: 'Qwen/Qwen2.5-VL-7B-Instruct',
            capabilities: ['chat', 'vision'],
            tier: 'lite',
            maxInputTokens: 32768,
            costTier: 'medium',
        },
        {
            provider: 'novita',
            model: 'zai-org/GLM-4.1V-9B-Thinking',
            capabilities: ['chat', 'vision', 'reasoning'],
            tier: 'experimental',
            costTier: 'medium',
            notes: 'Reasoning+vision capability',
        },
    ],
    // ASR (Speech to Text)
    asr: [
        {
            provider: 'hf-inference',
            model: 'openai/whisper-large-v3',
            capabilities: ['asr'],
            tier: 'primary',
            costTier: 'medium',
        },
        {
            provider: 'fal-ai',
            model: 'openai/whisper-large-v3',
            capabilities: ['asr'],
            tier: 'fallback',
            costTier: 'medium',
        },
    ],
    // Embeddings / Feature Extraction
    embeddings: [
        {
            provider: 'hf-inference',
            model: 'intfloat/multilingual-e5-large',
            capabilities: ['embedding'],
            tier: 'primary',
            costTier: 'low',
            notes: 'Multilingual support',
        },
        {
            provider: 'sambanova',
            model: 'intfloat/e5-mistral-7b-instruct',
            capabilities: ['embedding'],
            tier: 'fallback',
            costTier: 'medium',
        },
        {
            provider: 'nebius',
            model: 'Qwen/Qwen3-Embedding-8B',
            capabilities: ['embedding'],
            tier: 'fallback',
            costTier: 'medium',
        },
    ],
    // Classical & Specialized NLP
    nlp_classic: [
        // Summarization
        {
            provider: 'hf-inference',
            model: 'facebook/bart-large-cnn',
            capabilities: ['summarization'],
            tier: 'primary',
            costTier: 'medium',
        },
        // Zero-shot classification
        {
            provider: 'hf-inference',
            model: 'facebook/bart-large-mnli',
            capabilities: ['zero-shot'],
            tier: 'primary',
            costTier: 'medium',
        },
        // Sentiment analysis (finance)
        {
            provider: 'hf-inference',
            model: 'ProsusAI/finbert',
            capabilities: ['sentiment'],
            tier: 'primary',
            costTier: 'low',
        },
        // Named Entity Recognition
        {
            provider: 'hf-inference',
            model: 'dslim/bert-base-NER',
            capabilities: ['ner'],
            tier: 'primary',
            costTier: 'low',
        },
        // Fill mask
        {
            provider: 'hf-inference',
            model: 'google-bert/bert-base-uncased',
            capabilities: ['fill-mask'],
            tier: 'primary',
            costTier: 'low',
        },
        // Question answering
        {
            provider: 'hf-inference',
            model: 'deepset/roberta-base-squad2',
            capabilities: ['qa'],
            tier: 'primary',
            costTier: 'medium',
        },
        // Table QA
        {
            provider: 'hf-inference',
            model: 'google/tapas-base-finetuned-wtq',
            capabilities: ['table-qa'],
            tier: 'primary',
            costTier: 'medium',
        },
        // Sequence-to-sequence
        {
            provider: 'hf-inference',
            model: 'google-t5/t5-small',
            capabilities: ['seq2seq'],
            tier: 'lite',
            costTier: 'low',
        },
    ],
    // Image Generation (Text->Image)
    image_generation: [
        {
            provider: 'nebius',
            model: 'black-forest-labs/FLUX.1-dev',
            capabilities: ['image'],
            tier: 'primary',
            costTier: 'high',
            notes: 'High quality generation',
        },
        {
            provider: 'fal-ai',
            model: 'Qwen/Qwen-Image',
            capabilities: ['image'],
            tier: 'fallback',
            costTier: 'medium',
        },
        {
            provider: 'replicate',
            model: 'Qwen/Qwen-Image',
            capabilities: ['image'],
            tier: 'fallback',
            costTier: 'medium',
        },
        {
            provider: 'hf-inference',
            model: 'stabilityai/stable-diffusion-xl-base-1.0',
            capabilities: ['image'],
            tier: 'lite',
            costTier: 'low',
        },
    ],
    // Image-to-Image / Image Editing
    image_edit: [
        {
            provider: 'replicate',
            model: 'black-forest-labs/FLUX.1-Kontext-dev',
            capabilities: ['image', 'edit'],
            tier: 'primary',
            costTier: 'high',
        },
    ],
    // Video Generation (Text->Video)
    video_generation: [
        {
            provider: 'fal-ai',
            model: 'Wan-AI/Wan2.2-T2V-A14B',
            capabilities: ['video'],
            tier: 'primary',
            costTier: 'high',
            notes: 'Highest quality',
        },
        {
            provider: 'novita',
            model: 'Wan-AI/Wan2.1-T2V-14B',
            capabilities: ['video'],
            tier: 'fallback',
            costTier: 'medium',
        },
        {
            provider: 'replicate',
            model: 'Wan-AI/Wan2.2-TI2V-5B',
            capabilities: ['video'],
            tier: 'lite',
            costTier: 'medium',
            notes: 'Lighter weight',
        },
    ],
    // Image Classification / Vision Analytics
    vision_analysis: [
        {
            provider: 'hf-inference',
            model: 'Falconsai/nsfw_image_detection',
            capabilities: ['image-classification'],
            tier: 'primary',
            costTier: 'low',
        },
        {
            provider: 'hf-inference',
            model: 'facebook/detr-resnet-50',
            capabilities: ['object-detection'],
            tier: 'primary',
            costTier: 'medium',
        },
        {
            provider: 'hf-inference',
            model: 'jonathandinu/face-parsing',
            capabilities: ['segmentation'],
            tier: 'primary',
            costTier: 'medium',
        },
    ],
};
// Helper functions
export function getTaskModels(task) {
    return Registry[task] || [];
}
export function getModelsByTier(task, tier) {
    return getTaskModels(task).filter(model => model.tier === tier);
}
export function getModelsByCapability(task, capability) {
    return getTaskModels(task).filter(model => model.capabilities.includes(capability));
}
export function getTaskConfig(task) {
    return TaskConfigs[task] || TaskConfigs.chat;
}
// Task aliases for backward compatibility
export const TaskAliases = {
    'text-classification': 'nlp_classic',
    'zero-shot': 'nlp_classic',
    ner: 'nlp_classic',
    qa: 'nlp_classic',
    generation: 'chat',
    multimodal: 'multimodal_chat',
    'vision-detection': 'vision_analysis',
    'vision-nsfw': 'vision_analysis',
    summarization: 'nlp_classic',
    'fill-mask': 'nlp_classic',
    'table-qa': 'nlp_classic',
};
export function normalizeTaskName(task) {
    return TaskAliases[task] || task;
}
