/* global process, console */
// packages/backend/src/services/HuggingFaceRouterService.js

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * HuggingFace Router Service using direct fetch API calls
 * Implements the JavaScript approach from HF documentation
 */
class HuggingFaceRouterService {
  constructor() {
    this.hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || process.env.HUGGINGFACE_API_KEY;
    this.baseURL = 'https://router.huggingface.co';
    
    console.log('[HuggingFaceRouterService] 🔍 Token check:', {
      HF_TOKEN: this.hfToken ? `${this.hfToken.substring(0, 8)}...` : 'not found'
    });
    
    if (this.hfToken && this.hfToken.startsWith('hf_')) {
      console.log('[HuggingFaceRouterService] ✅ Initialized with HF token');
    } else {
      console.warn('[HuggingFaceRouterService] ⚠️ No valid HF token provided, service will return mock responses');
    }

    // Available models and providers
    this.models = {
      chat: {
        'smollm3-3b': 'HuggingFaceTB/SmolLM3-3B:hf-inference',
        'deepseek-v3': 'deepseek-ai/DeepSeek-V3-0324',
        'llama-3.1-8b': 'meta-llama/Llama-3.1-8B-Instruct',
        'mistral-7b': 'mistralai/Mistral-7B-Instruct-v0.3'
      },
      textToImage: {
        'stable-diffusion-xl': 'stabilityai/stable-diffusion-xl-base-1.0',
        'flux-1-dev': 'black-forest-labs/FLUX.1-dev'
      },
      embeddings: {
        'multilingual-e5-large': 'intfloat/multilingual-e5-large',
        'all-mpnet-base-v2': 'sentence-transformers/all-mpnet-base-v2'
      },
      speechToText: {
        'whisper-large-v3': 'openai/whisper-large-v3'
      }
    };

    console.log('[HuggingFaceRouterService] 🚀 Service initialized with JavaScript fetch approach');
  }

  /**
   * Chat completion using OpenAI-compatible endpoint
   */
  async chatCompletion(params) {
    try {
      const startTime = Date.now();
      console.log(`[HuggingFaceRouterService] 💬 Chat completion: ${params.model || 'default'}`);

      if (!this.hfToken) {
        return this.getMockChatResponse(params);
      }

      const model = this.models.chat[params.model] || params.model || this.models.chat['smollm3-3b'];
      
      const requestBody = {
        messages: params.messages,
        model: model,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 2000,
        stream: params.stream || false
      };

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      console.log(`[HuggingFaceRouterService] ✅ Chat completion successful (${Date.now() - startTime}ms)`);
      
      return {
        success: true,
        response: result,
        model,
        processingTime: Date.now() - startTime,
        usage: result.usage
      };

    } catch (error) {
      console.error('[HuggingFaceRouterService] ❌ Chat completion failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: params.model
      };
    }
  }

  /**
   * Text-to-image generation using hf-inference
   */
  async textToImage(params) {
    try {
      const startTime = Date.now();
      console.log(`[HuggingFaceRouterService] 🎨 Text-to-image: "${params.prompt.substring(0, 50)}..."`);

      if (!this.hfToken) {
        return this.getMockImageResponse(params);
      }

      const model = this.models.textToImage[params.model] || params.model || this.models.textToImage['stable-diffusion-xl'];
      
      const response = await fetch(`${this.baseURL}/hf-inference/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: params.prompt,
          parameters: {
            width: params.width || 1024,
            height: params.height || 1024,
            num_inference_steps: params.num_inference_steps || 50,
            guidance_scale: params.guidance_scale || 7.5,
            negative_prompt: params.negative_prompt
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // HF returns image as binary data
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      console.log(`[HuggingFaceRouterService] ✅ Image generated successfully (${Date.now() - startTime}ms)`);

      return {
        success: true,
        image: {
          dataUrl,
          format: 'png',
          size: imageBuffer.byteLength
        },
        model,
        processingTime: Date.now() - startTime,
        parameters: {
          prompt: params.prompt,
          width: params.width || 1024,
          height: params.height || 1024
        }
      };

    } catch (error) {
      console.error('[HuggingFaceRouterService] ❌ Image generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        prompt: params.prompt,
        model: params.model
      };
    }
  }

  /**
   * Feature extraction (embeddings)
   */
  async createEmbeddings(params) {
    try {
      const startTime = Date.now();
      console.log(`[HuggingFaceRouterService] 📊 Creating embeddings`);

      if (!this.hfToken) {
        return this.getMockEmbeddingResponse(params);
      }

      const model = this.models.embeddings[params.model] || params.model || this.models.embeddings['multilingual-e5-large'];
      
      const response = await fetch(`${this.baseURL}/hf-inference/models/${model}/pipeline/feature-extraction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: Array.isArray(params.inputs) ? params.inputs : [params.inputs]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const embeddings = await response.json();

      console.log(`[HuggingFaceRouterService] ✅ Embeddings created (${Date.now() - startTime}ms)`);

      return {
        success: true,
        embeddings: Array.isArray(embeddings[0]) ? embeddings : [embeddings],
        model,
        processingTime: Date.now() - startTime,
        dimensions: Array.isArray(embeddings[0]) ? embeddings[0].length : embeddings.length
      };

    } catch (error) {
      console.error('[HuggingFaceRouterService] ❌ Embeddings failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: params.model
      };
    }
  }

  /**
   * Speech-to-text transcription
   */
  async speechToText(params) {
    try {
      const startTime = Date.now();
      console.log(`[HuggingFaceRouterService] 🎤 Speech-to-text transcription`);

      if (!this.hfToken) {
        return this.getMockTranscriptionResponse();
      }

      const model = this.models.speechToText[params.model] || params.model || this.models.speechToText['whisper-large-v3'];
      
      let audioData = params.audio;
      if (typeof audioData === 'string' && audioData.startsWith('data:')) {
        // Convert data URL to buffer
        const base64 = audioData.split(',')[1];
        audioData = Buffer.from(base64, 'base64');
      }

      const response = await fetch(`${this.baseURL}/hf-inference/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'audio/flac'
        },
        body: audioData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      console.log(`[HuggingFaceRouterService] ✅ Transcription successful (${Date.now() - startTime}ms)`);

      return {
        success: true,
        text: result.text,
        model,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('[HuggingFaceRouterService] ❌ Speech-to-text failed:', error.message);
      return {
        success: false,
        error: error.message,
        model: params.model
      };
    }
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return {
      success: true,
      models: this.models,
      total: Object.values(this.models).reduce((sum, category) => sum + Object.keys(category).length, 0)
    };
  }

  /**
   * Test service connectivity
   */
  async testConnection() {
    if (!this.hfToken) {
      return { success: false, error: 'No HF token configured' };
    }

    try {
      const response = await this.chatCompletion({
        model: 'smollm3-3b',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      return {
        success: response.success,
        authenticated: true,
        model: response.model,
        processingTime: response.processingTime
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      available: !!this.hfToken,
      authenticated: !!this.hfToken,
      baseURL: this.baseURL,
      models: {
        chat: Object.keys(this.models.chat).length,
        textToImage: Object.keys(this.models.textToImage).length,
        embeddings: Object.keys(this.models.embeddings).length,
        speechToText: Object.keys(this.models.speechToText).length
      },
      totalModels: Object.values(this.models).reduce((sum, category) => sum + Object.keys(category).length, 0),
      healthy: this.isHealthy()
    };
  }

  isHealthy() {
    return !!this.hfToken;
  }

  // Mock responses for testing
  getMockChatResponse(params) {
    return {
      success: true,
      response: {
        choices: [{
          message: {
            role: 'assistant',
            content: `[MOCK HF RESPONSE] I understand your message. This is a mock response from HuggingFace Router Service.`
          }
        }],
        usage: { prompt_tokens: 20, completion_tokens: 25, total_tokens: 45 }
      },
      model: params.model || 'mock-model',
      processingTime: 150
    };
  }

  getMockImageResponse(params) {
    return {
      success: true,
      image: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        format: 'png',
        size: 1024
      },
      model: params.model || 'mock-image-model',
      processingTime: 300,
      parameters: { prompt: params.prompt }
    };
  }

  getMockTranscriptionResponse() {
    return {
      success: true,
      text: '[MOCK TRANSCRIPTION] This is a mock transcription response.',
      model: 'mock-whisper',
      processingTime: 100
    };
  }

  getMockEmbeddingResponse(params) {
    const inputCount = Array.isArray(params.inputs) ? params.inputs.length : 1;
    return {
      success: true,
      embeddings: Array(inputCount).fill(0).map(() => Array(384).fill(0).map(() => Math.random() * 2 - 1)),
      model: params.model || 'mock-embedding-model',
      processingTime: 80,
      dimensions: 384
    };
  }
}

export default new HuggingFaceRouterService();