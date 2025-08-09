/**
 * Comprehensive Hugging Face Integration Service
 * Supports all HF Inference API models and tasks
 */

import { InferenceClient } from "@huggingface/inference";
import { OpenAI } from "openai";
import pg from 'pg';

class HuggingFaceService {
    constructor() {
        this.inferenceClient = null;
        this.openAIClient = null;
        this.dbPool = null;
        this.isInitialized = false;
        this.supportedModels = new Map();
        this.modelMetrics = new Map();
        
        // Initialize supported models and tasks
        this.initializeSupportedModels();
    }

    async initialize(dbPool) {
        if (this.isInitialized) return;

        try {
            console.log('[HuggingFace] Initializing Hugging Face Service...');
            
            this.dbPool = dbPool;
            
            if (!process.env.HF_TOKEN) {
                throw new Error('HF_TOKEN environment variable is required');
            }

            // Initialize InferenceClient for direct HF API
            this.inferenceClient = new InferenceClient(process.env.HF_TOKEN);

            // Initialize OpenAI client for HF Router
            this.openAIClient = new OpenAI({
                baseURL: "https://router.huggingface.co/v1",
                apiKey: process.env.HF_TOKEN,
            });

            // Store model configurations in database
            await this.syncModelsWithDatabase();

            this.isInitialized = true;
            console.log('[HuggingFace] ✅ Hugging Face Service initialized with', this.supportedModels.size, 'models');
        } catch (error) {
            console.error('[HuggingFace] ❌ Failed to initialize:', error);
            throw error;
        }
    }

    initializeSupportedModels() {
        // Chat Completion Models (LLMs)
        this.supportedModels.set('google/gemma-2-2b-it', {
            task: 'chat-completion',
            type: 'llm',
            description: 'A text-generation model trained to follow instructions',
            maxTokens: 8192,
            provider: 'hf-inference'
        });

        this.supportedModels.set('deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Smaller variant of one of the most powerful models',
            maxTokens: 4096,
            provider: 'hf-inference'
        });

        this.supportedModels.set('meta-llama/Meta-Llama-3.1-8B-Instruct', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Very powerful text generation model trained to follow instructions',
            maxTokens: 32768,
            provider: 'hf-inference'
        });

        this.supportedModels.set('microsoft/phi-4', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Powerful text generation model by Microsoft',
            maxTokens: 16384,
            provider: 'hf-inference'
        });

        this.supportedModels.set('simplescaling/s1.1-32B', {
            task: 'chat-completion',
            type: 'llm',
            description: 'A very powerful model with reasoning capabilities',
            maxTokens: 8192,
            provider: 'hf-inference'
        });

        this.supportedModels.set('Qwen/Qwen2.5-7B-Instruct-1M', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Strong conversational model that supports very long instructions',
            maxTokens: 1000000,
            provider: 'hf-inference'
        });

        this.supportedModels.set('Qwen/Qwen2.5-Coder-32B-Instruct', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Text generation model used to write code',
            maxTokens: 32768,
            provider: 'hf-inference'
        });

        this.supportedModels.set('deepseek-ai/DeepSeek-R1', {
            task: 'chat-completion',
            type: 'llm',
            description: 'Powerful reasoning based open large language model',
            maxTokens: 8192,
            provider: 'hf-inference'
        });

        // Vision-Language Models (VLMs)
        this.supportedModels.set('Qwen/Qwen2.5-VL-7B-Instruct', {
            task: 'image-text-to-text',
            type: 'vlm',
            description: 'Strong image-text-to-text model',
            maxTokens: 8192,
            provider: 'together'
        });

        this.supportedModels.set('meta-llama/Llama-4-Scout-17B-16E-Instruct', {
            task: 'image-text-to-text',
            type: 'vlm',
            description: 'Advanced vision-language model',
            maxTokens: 16384,
            provider: 'featherless-ai'
        });

        // Text-to-Image Models
        this.supportedModels.set('black-forest-labs/FLUX.1-dev', {
            task: 'text-to-image',
            type: 'image-generation',
            description: 'One of the most powerful image generation models',
            provider: 'fal-ai'
        });

        this.supportedModels.set('stabilityai/stable-diffusion-3-medium-diffusers', {
            task: 'text-to-image',
            type: 'image-generation',
            description: 'A powerful text-to-image model',
            provider: 'fal-ai'
        });

        this.supportedModels.set('Kwai-Kolors/Kolors', {
            task: 'text-to-image',
            type: 'image-generation',
            description: 'Text-to-image model for photorealistic generation',
            provider: 'fal-ai'
        });

        // Feature Extraction Models
        this.supportedModels.set('thenlper/gte-large', {
            task: 'feature-extraction',
            type: 'embedding',
            description: 'A powerful feature extraction model for natural language processing tasks',
            provider: 'hf-inference'
        });

        this.supportedModels.set('intfloat/multilingual-e5-large', {
            task: 'feature-extraction',
            type: 'embedding',
            description: 'Multilingual embedding model',
            provider: 'hf-inference'
        });

        // Audio Models
        this.supportedModels.set('openai/whisper-large-v3', {
            task: 'automatic-speech-recognition',
            type: 'audio-processing',
            description: 'A powerful ASR model by OpenAI',
            provider: 'fal-ai'
        });

        // Specialized Models
        this.supportedModels.set('facebook/bart-large-cnn', {
            task: 'summarization',
            type: 'text-processing',
            description: 'A strong summarization model trained on English news articles',
            provider: 'hf-inference'
        });

        this.supportedModels.set('deepset/roberta-base-squad2', {
            task: 'question-answering',
            type: 'text-processing',
            description: 'A robust baseline model for most question answering domains',
            provider: 'hf-inference'
        });
    }

    async syncModelsWithDatabase() {
        if (!this.dbPool) return;

        try {
            for (const [modelId, config] of this.supportedModels) {
                await this.dbPool.query(`
                    INSERT INTO hf_models (model_id, model_name, task_type, provider, description, parameters)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (model_id) DO UPDATE SET
                        model_name = EXCLUDED.model_name,
                        task_type = EXCLUDED.task_type,
                        provider = EXCLUDED.provider,
                        description = EXCLUDED.description,
                        parameters = EXCLUDED.parameters,
                        updated_at = NOW()
                `, [
                    modelId,
                    modelId.split('/')[1] || modelId,
                    config.task,
                    config.provider,
                    config.description,
                    JSON.stringify(config)
                ]);
            }
            console.log('[HuggingFace] ✅ Models synced with database');
        } catch (error) {
            console.error('[HuggingFace] Failed to sync models:', error);
        }
    }

    // Chat Completion Methods
    async chatCompletion(messages, options = {}) {
        const modelId = options.model || 'google/gemma-2-2b-it';
        const modelConfig = this.supportedModels.get(modelId);
        
        if (!modelConfig || modelConfig.task !== 'chat-completion') {
            throw new Error(`Model ${modelId} not supported for chat completion`);
        }

        const startTime = Date.now();
        let result;

        try {
            if (options.stream) {
                result = await this.streamChatCompletion(messages, options);
            } else {
                // Use OpenAI-compatible endpoint for chat completion
                result = await this.openAIClient.chat.completions.create({
                    model: `${modelId}:hf-inference`,
                    messages,
                    max_tokens: options.maxTokens || modelConfig.maxTokens || 2048,
                    temperature: options.temperature || 0.7,
                    top_p: options.topP || 0.9,
                    stream: false
                });
            }

            // Record metrics
            await this.recordModelUsage(modelId, 'chat-completion', Date.now() - startTime, true);
            
            return result;
        } catch (error) {
            await this.recordModelUsage(modelId, 'chat-completion', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    async streamChatCompletion(messages, options = {}) {
        const modelId = options.model || 'google/gemma-2-2b-it';
        
        const stream = await this.openAIClient.chat.completions.create({
            model: `${modelId}:hf-inference`,
            messages,
            max_tokens: options.maxTokens || 2048,
            temperature: options.temperature || 0.7,
            stream: true
        });

        return stream;
    }

    // Vision Language Model Methods
    async imageTextToText(imageUrl, prompt, options = {}) {
        const modelId = options.model || 'Qwen/Qwen2.5-VL-7B-Instruct';
        const modelConfig = this.supportedModels.get(modelId);
        
        if (!modelConfig || modelConfig.task !== 'image-text-to-text') {
            throw new Error(`Model ${modelId} not supported for image-text-to-text`);
        }

        const startTime = Date.now();

        try {
            const completion = await this.inferenceClient.chatCompletion({
                provider: modelConfig.provider,
                model: modelId,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: imageUrl } }
                    ]
                }],
                max_tokens: options.maxTokens || 2048
            });

            await this.recordModelUsage(modelId, 'image-text-to-text', Date.now() - startTime, true);
            return completion;
        } catch (error) {
            await this.recordModelUsage(modelId, 'image-text-to-text', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    // Text-to-Image Methods
    async textToImage(prompt, options = {}) {
        const modelId = options.model || 'black-forest-labs/FLUX.1-dev';
        const modelConfig = this.supportedModels.get(modelId);
        
        if (!modelConfig || modelConfig.task !== 'text-to-image') {
            throw new Error(`Model ${modelId} not supported for text-to-image`);
        }

        const startTime = Date.now();

        try {
            const image = await this.inferenceClient.textToImage(prompt, {
                model: modelId,
                parameters: {
                    width: options.width || 1024,
                    height: options.height || 1024,
                    guidance_scale: options.guidanceScale || 7.5,
                    num_inference_steps: options.numInferenceSteps || 50,
                    seed: options.seed
                }
            });

            await this.recordModelUsage(modelId, 'text-to-image', Date.now() - startTime, true);
            return image;
        } catch (error) {
            await this.recordModelUsage(modelId, 'text-to-image', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    // Feature Extraction (Embeddings)
    async featureExtraction(text, options = {}) {
        const modelId = options.model || 'thenlper/gte-large';
        const modelConfig = this.supportedModels.get(modelId);
        
        if (!modelConfig || modelConfig.task !== 'feature-extraction') {
            throw new Error(`Model ${modelId} not supported for feature extraction`);
        }

        const startTime = Date.now();

        try {
            const embeddings = await this.inferenceClient.featureExtraction(text, {
                model: modelId,
                normalize: options.normalize !== false,
                truncate: options.truncate !== false
            });

            await this.recordModelUsage(modelId, 'feature-extraction', Date.now() - startTime, true);
            return embeddings;
        } catch (error) {
            await this.recordModelUsage(modelId, 'feature-extraction', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    // Audio Processing
    async automaticSpeechRecognition(audioData, options = {}) {
        const modelId = options.model || 'openai/whisper-large-v3';
        const modelConfig = this.supportedModels.get(modelId);
        
        if (!modelConfig || modelConfig.task !== 'automatic-speech-recognition') {
            throw new Error(`Model ${modelId} not supported for ASR`);
        }

        const startTime = Date.now();

        try {
            const transcription = await this.inferenceClient.automaticSpeechRecognition(audioData, {
                model: modelId,
                return_timestamps: options.returnTimestamps || false
            });

            await this.recordModelUsage(modelId, 'automatic-speech-recognition', Date.now() - startTime, true);
            return transcription;
        } catch (error) {
            await this.recordModelUsage(modelId, 'automatic-speech-recognition', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    // Text Processing Tasks
    async summarization(text, options = {}) {
        const modelId = options.model || 'facebook/bart-large-cnn';
        const startTime = Date.now();

        try {
            const summary = await this.inferenceClient.summarization(text, {
                model: modelId,
                parameters: {
                    max_length: options.maxLength || 150,
                    min_length: options.minLength || 30
                }
            });

            await this.recordModelUsage(modelId, 'summarization', Date.now() - startTime, true);
            return summary;
        } catch (error) {
            await this.recordModelUsage(modelId, 'summarization', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    async questionAnswering(question, context, options = {}) {
        const modelId = options.model || 'deepset/roberta-base-squad2';
        const startTime = Date.now();

        try {
            const answer = await this.inferenceClient.questionAnswering({
                question,
                context
            }, {
                model: modelId,
                parameters: {
                    top_k: options.topK || 1
                }
            });

            await this.recordModelUsage(modelId, 'question-answering', Date.now() - startTime, true);
            return answer;
        } catch (error) {
            await this.recordModelUsage(modelId, 'question-answering', Date.now() - startTime, false, error.message);
            throw error;
        }
    }

    // Model Management
    getAvailableModels(task = null) {
        if (task) {
            return Array.from(this.supportedModels.entries())
                .filter(([_, config]) => config.task === task)
                .map(([modelId, config]) => ({ modelId, ...config }));
        }
        return Array.from(this.supportedModels.entries())
            .map(([modelId, config]) => ({ modelId, ...config }));
    }

    async recordModelUsage(modelId, task, durationMs, success, errorMessage = null) {
        if (!this.dbPool) return;

        try {
            await this.dbPool.query(`
                INSERT INTO agent_interactions (agent_id, user_id, interaction_type, input_data, output_data, processing_time_ms, success, error_message)
                VALUES ((SELECT id FROM agents WHERE agent_type = 'huggingface' LIMIT 1), NULL, $1, $2, $3, $4, $5, $6)
            `, [
                `hf-${task}`,
                JSON.stringify({ model: modelId, task }),
                JSON.stringify({ success, duration_ms: durationMs }),
                durationMs,
                success,
                errorMessage
            ]);

            // Update metrics
            const key = `${modelId}-${task}`;
            if (!this.modelMetrics.has(key)) {
                this.modelMetrics.set(key, { totalCalls: 0, totalTime: 0, errors: 0 });
            }
            const metrics = this.modelMetrics.get(key);
            metrics.totalCalls++;
            metrics.totalTime += durationMs;
            if (!success) metrics.errors++;
        } catch (error) {
            console.error('[HuggingFace] Failed to record usage:', error);
        }
    }

    async getUsageStatistics() {
        if (!this.dbPool) return null;

        try {
            const result = await this.dbPool.query(`
                SELECT 
                    interaction_type,
                    COUNT(*) as total_calls,
                    AVG(processing_time_ms) as avg_processing_time,
                    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as error_count
                FROM agent_interactions 
                WHERE interaction_type LIKE 'hf-%' 
                  AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY interaction_type
                ORDER BY total_calls DESC
            `);

            return {
                daily_statistics: result.rows,
                memory_metrics: Object.fromEntries(this.modelMetrics.entries()),
                timestamp: new Date()
            };
        } catch (error) {
            console.error('[HuggingFace] Failed to get usage statistics:', error);
            return null;
        }
    }

    // Health check
    async healthCheck() {
        try {
            // Test with a simple completion
            const result = await this.chatCompletion([{
                role: 'user',
                content: 'Test message for health check'
            }], {
                model: 'google/gemma-2-2b-it',
                maxTokens: 10
            });

            return {
                status: 'healthy',
                models_available: this.supportedModels.size,
                last_check: new Date(),
                test_result: result ? 'success' : 'failed'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                last_check: new Date()
            };
        }
    }
}

export default HuggingFaceService;