/* global process, console */
// packages/backend/src/services/HuggingFaceInferenceService.js

import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * HuggingFace Inference Providers Service
 * Comprehensive integration with HF's unified inference API for all AI tasks
 * Supports LLM chat, vision models, text-to-image, speech-to-text, embeddings, and more
 */
class HuggingFaceInferenceService {
  constructor() {
    this.hfToken =
      process.env.HF_TOKEN ||
      process.env.HUGGINGFACE_API_TOKEN ||
      process.env.HUGGINGFACE_API_KEY;
    this.baseURL = 'https://router.huggingface.co/v1';

    console.log('[HuggingFaceInferenceService] 🔍 Token check:', {
      HF_TOKEN: process.env.HF_TOKEN
        ? `${process.env.HF_TOKEN.substring(0, 8)}...`
        : 'not found',
      HUGGINGFACE_API_TOKEN: process.env.HUGGINGFACE_API_TOKEN
        ? `${process.env.HUGGINGFACE_API_TOKEN.substring(0, 8)}...`
        : 'not found',
      HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY
        ? `${process.env.HUGGINGFACE_API_KEY.substring(0, 8)}...`
        : 'not found',
    });

    if (this.hfToken && this.hfToken.startsWith('hf_')) {
      this.client = new HfInference(this.hfToken);
      console.log('[HuggingFaceInferenceService] ✅ Initialized with HF token');
    } else {
      this.client = null;
      console.warn(
        '[HuggingFaceInferenceService] ⚠️ No valid HF token provided, service will return mock responses'
      );
    }

    // Model configurations for different providers
    this.models = {
      // Chat Completion Models (LLM)
      chat: {
        'deepseek-v3': 'deepseek-ai/DeepSeek-V3-0324',
        'llama-3.1-8b': 'meta-llama/Llama-3.1-8B-Instruct',
        'llama-3.1-70b': 'meta-llama/Llama-3.1-70B-Instruct',
        'mistral-7b': 'mistralai/Mistral-7B-Instruct-v0.3',
        codestral: 'mistralai/Codestral-22B-v0.1',
        'gemma-2-9b': 'google/gemma-2-9b-it',
      },

      // Vision Language Models (VLM)
      vision: {
        'llava-1.5-7b': 'llava-hf/llava-1.5-7b-hf',
        'llava-1.6-vicuna-7b': 'llava-hf/llava-v1.6-vicuna-7b-hf',
        'instructblip-vicuna-7b': 'Salesforce/instructblip-vicuna-7b',
      },

      // Text-to-Image Models
      textToImage: {
        'flux-1-dev': 'black-forest-labs/FLUX.1-dev',
        'flux-1-schnell': 'black-forest-labs/FLUX.1-schnell',
        'stable-diffusion-xl': 'stabilityai/stable-diffusion-xl-base-1.0',
        'stable-diffusion-3': 'stabilityai/stable-diffusion-3-medium-diffusers',
        'kandinsky-2.2': 'kandinsky-community/kandinsky-2-2-decoder',
      },

      // Speech-to-Text Models
      speechToText: {
        'whisper-large-v3': 'openai/whisper-large-v3',
        'whisper-medium': 'openai/whisper-medium',
        'wav2vec2-base': 'facebook/wav2vec2-base-960h',
      },

      // Embedding Models
      embeddings: {
        'all-mpnet-base-v2': 'sentence-transformers/all-mpnet-base-v2',
        'all-MiniLM-L6-v2': 'sentence-transformers/all-MiniLM-L6-v2',
        'bge-large-en-v1.5': 'BAAI/bge-large-en-v1.5',
      },
    };

    // Provider preferences for different tasks
    this.providerPreferences = {
      chat: ['together', 'fireworks', 'groq', 'sambanova'],
      vision: ['together', 'fireworks', 'replicate'],
      textToImage: ['fal-ai', 'replicate', 'novita'],
      speechToText: ['hf-inference'],
      embeddings: ['hf-inference', 'together'],
    };

    console.log(
      '[HuggingFaceInferenceService] 🚀 Service initialized with comprehensive model support'
    );
  }

  /**
   * Chat Completion with LLM models
   */
  async chatCompletion(params) {
    try {
      const startTime = Date.now();
      console.log(
        `[HuggingFaceInferenceService] 💬 Chat completion request: ${params.model || 'default'}`
      );

      if (!this.client) {
        return this.getMockChatResponse(params);
      }

      const model =
        this.models.chat[params.model] ||
        params.model ||
        this.models.chat['deepseek-v3'];
      const provider = params.provider || 'auto';

      // Use text generation for now - will implement chat completion via OpenAI-compatible endpoint
      const prompt = this.formatMessagesAsPrompt(params.messages);
      const response = await this.client.textGeneration({
        model,
        inputs: prompt,
        parameters: {
          temperature: params.temperature || 0.7,
          max_new_tokens: params.max_tokens || 2000,
          top_p: params.top_p || 0.95,
          do_sample: true,
          return_full_text: false,
        },
      });

      const result = {
        success: true,
        response: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: response.generated_text,
              },
            },
          ],
        },
        model,
        provider,
        processingTime: Date.now() - startTime,
        usage: null,
      };

      console.log(
        `[HuggingFaceInferenceService] ✅ Chat completion successful (${result.processingTime}ms)`
      );
      return result;
    } catch (error) {
      console.error(
        '[HuggingFaceInferenceService] ❌ Chat completion failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        model: params.model,
      };
    }
  }

  /**
   * Vision Language Model chat with images
   */
  async visionChatCompletion(params) {
    try {
      const startTime = Date.now();
      console.log(
        `[HuggingFaceInferenceService] 👁️ Vision chat completion: ${params.model || 'default'}`
      );

      if (!this.client) {
        return this.getMockVisionResponse(params);
      }

      const model =
        this.models.vision[params.model] ||
        params.model ||
        this.models.vision['llava-1.5-7b'];
      const provider = params.provider || 'auto';

      // Format messages for vision model
      const formattedMessages = params.messages.map(msg => {
        if (typeof msg.content === 'string') {
          return msg;
        }
        // Handle multimodal content (text + images)
        return {
          role: msg.role,
          content: msg.content,
        };
      });

      // Use visual question answering for vision tasks
      const textContent = formattedMessages.find(
        msg =>
          typeof msg.content === 'string' ||
          (Array.isArray(msg.content) &&
            msg.content.some(c => c.type === 'text'))
      );

      const imageContent = formattedMessages.find(
        msg =>
          Array.isArray(msg.content) &&
          msg.content.some(c => c.type === 'image_url')
      );

      if (!imageContent) {
        throw new Error('No image provided for vision model');
      }

      const question =
        typeof textContent.content === 'string'
          ? textContent.content
          : textContent.content.find(c => c.type === 'text')?.text ||
            'Describe this image';

      const imageUrl = imageContent.content.find(c => c.type === 'image_url')
        ?.image_url?.url;

      const response = await this.client.visualQuestionAnswering({
        model,
        inputs: {
          question,
          image: imageUrl,
        },
      });

      const result = {
        success: true,
        response: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: response.answer || JSON.stringify(response),
              },
            },
          ],
        },
        model,
        provider,
        processingTime: Date.now() - startTime,
        type: 'vision',
      };

      console.log(
        `[HuggingFaceInferenceService] ✅ Vision completion successful (${result.processingTime}ms)`
      );
      return result;
    } catch (error) {
      console.error(
        '[HuggingFaceInferenceService] ❌ Vision completion failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        model: params.model,
        type: 'vision',
      };
    }
  }

  /**
   * Text-to-Image generation
   */
  async textToImage(params) {
    try {
      const startTime = Date.now();
      console.log(
        `[HuggingFaceInferenceService] 🎨 Text-to-image: "${params.prompt.substring(0, 50)}..."`
      );

      if (!this.client) {
        return this.getMockImageResponse(params);
      }

      const model =
        this.models.textToImage[params.model] ||
        params.model ||
        this.models.textToImage['flux-1-dev'];
      const provider = params.provider || 'auto';

      const imageBlob = await this.client.textToImage({
        model,
        inputs: params.prompt,
        parameters: {
          width: params.width || 1024,
          height: params.height || 1024,
          num_inference_steps: params.num_inference_steps || 50,
          guidance_scale: params.guidance_scale || 7.5,
          negative_prompt: params.negative_prompt,
        },
      });

      // Convert blob to base64 for easier handling
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      const result = {
        success: true,
        image: {
          dataUrl,
          format: 'png',
          size: arrayBuffer.byteLength,
        },
        model,
        provider,
        processingTime: Date.now() - startTime,
        parameters: {
          prompt: params.prompt,
          width: params.width || 1024,
          height: params.height || 1024,
        },
      };

      console.log(
        `[HuggingFaceInferenceService] ✅ Image generated successfully (${result.processingTime}ms)`
      );
      return result;
    } catch (error) {
      console.error(
        '[HuggingFaceInferenceService] ❌ Image generation failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        prompt: params.prompt,
        model: params.model,
      };
    }
  }

  /**
   * Speech-to-Text transcription
   */
  async speechToText(params) {
    try {
      const startTime = Date.now();
      console.log(
        `[HuggingFaceInferenceService] 🎤 Speech-to-text transcription`
      );

      if (!this.client) {
        return this.getMockTranscriptionResponse();
      }

      const model =
        this.models.speechToText[params.model] ||
        params.model ||
        this.models.speechToText['whisper-large-v3'];

      let audioInput = params.audio;
      if (typeof audioInput === 'string' && audioInput.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(audioInput);
        audioInput = await response.blob();
      }

      const result = await this.client.automaticSpeechRecognition({
        model,
        data: audioInput,
      });

      const response = {
        success: true,
        text: result.text,
        model,
        processingTime: Date.now() - startTime,
        confidence: result.confidence || null,
      };

      console.log(
        `[HuggingFaceInferenceService] ✅ Transcription successful (${response.processingTime}ms)`
      );
      return response;
    } catch (error) {
      console.error(
        '[HuggingFaceInferenceService] ❌ Speech-to-text failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        model: params.model,
      };
    }
  }

  /**
   * Generate text embeddings
   */
  async createEmbeddings(params) {
    try {
      const startTime = Date.now();
      console.log(
        `[HuggingFaceInferenceService] 📊 Creating embeddings for ${Array.isArray(params.inputs) ? params.inputs.length : 1} inputs`
      );

      if (!this.client) {
        return this.getMockEmbeddingResponse(params);
      }

      const model =
        this.models.embeddings[params.model] ||
        params.model ||
        this.models.embeddings['all-mpnet-base-v2'];

      const embeddings = await this.client.featureExtraction({
        model,
        inputs: params.inputs,
      });

      const result = {
        success: true,
        embeddings: Array.isArray(embeddings[0]) ? embeddings : [embeddings],
        model,
        processingTime: Date.now() - startTime,
        dimensions: Array.isArray(embeddings[0])
          ? embeddings[0].length
          : embeddings.length,
      };

      console.log(
        `[HuggingFaceInferenceService] ✅ Embeddings created (${result.processingTime}ms)`
      );
      return result;
    } catch (error) {
      console.error(
        '[HuggingFaceInferenceService] ❌ Embeddings failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        model: params.model,
      };
    }
  }

  /**
   * Get available models for each task type
   */
  getAvailableModels() {
    return {
      success: true,
      models: this.models,
      providers: this.providerPreferences,
      total: Object.values(this.models).reduce(
        (sum, category) => sum + Object.keys(category).length,
        0
      ),
    };
  }

  /**
   * Test service connectivity and authentication
   */
  async testConnection() {
    if (!this.client) {
      return { success: false, error: 'No HF token configured' };
    }

    try {
      const response = await this.chatCompletion({
        model: 'deepseek-v3',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      });

      return {
        success: response.success,
        authenticated: true,
        model: response.model,
        processingTime: response.processingTime,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get comprehensive service statistics
   */
  getServiceStats() {
    return {
      available: !!this.client,
      authenticated: !!this.hfToken,
      baseURL: this.baseURL,
      models: {
        chat: Object.keys(this.models.chat).length,
        vision: Object.keys(this.models.vision).length,
        textToImage: Object.keys(this.models.textToImage).length,
        speechToText: Object.keys(this.models.speechToText).length,
        embeddings: Object.keys(this.models.embeddings).length,
      },
      totalModels: Object.values(this.models).reduce(
        (sum, category) => sum + Object.keys(category).length,
        0
      ),
      healthy: this.isHealthy(),
    };
  }

  isHealthy() {
    return !!this.client && !!this.hfToken;
  }

  /**
   * Format chat messages as a prompt for text generation models
   */
  formatMessagesAsPrompt(messages) {
    return (
      messages
        .map(msg => {
          if (msg.role === 'system') {
            return `System: ${msg.content}`;
          } else if (msg.role === 'user') {
            return `Human: ${msg.content}`;
          } else if (msg.role === 'assistant') {
            return `Assistant: ${msg.content}`;
          }
          return msg.content;
        })
        .join('\n\n') + '\n\nAssistant:'
    );
  }

  // Mock responses for development/testing
  getMockChatResponse(params) {
    return {
      success: true,
      response: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: `[MOCK HF RESPONSE] I understand your message. This is a mock response from HuggingFace Inference Providers because no valid token is configured.`,
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 25, total_tokens: 45 },
      },
      model: params.model || 'mock-model',
      provider: 'mock',
      processingTime: 150,
    };
  }

  getMockVisionResponse(params) {
    return {
      success: true,
      response: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: `[MOCK VISION] I can see the image(s) you've shared. This is a mock vision response from HuggingFace VLM.`,
            },
          },
        ],
      },
      model: params.model || 'mock-vision-model',
      provider: 'mock',
      processingTime: 200,
      type: 'vision',
    };
  }

  getMockImageResponse(params) {
    return {
      success: true,
      image: {
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        format: 'png',
        size: 1024,
      },
      model: params.model || 'mock-image-model',
      provider: 'mock',
      processingTime: 300,
      parameters: { prompt: params.prompt },
    };
  }

  getMockTranscriptionResponse() {
    return {
      success: true,
      text: '[MOCK TRANSCRIPTION] This is a mock transcription response.',
      model: 'mock-whisper',
      processingTime: 100,
      confidence: 0.95,
    };
  }

  getMockEmbeddingResponse(params) {
    const inputCount = Array.isArray(params.inputs) ? params.inputs.length : 1;
    return {
      success: true,
      embeddings: Array(inputCount)
        .fill(0)
        .map(() =>
          Array(384)
            .fill(0)
            .map(() => Math.random() * 2 - 1)
        ),
      model: params.model || 'mock-embedding-model',
      processingTime: 80,
      dimensions: 384,
    };
  }
}

export default new HuggingFaceInferenceService();
