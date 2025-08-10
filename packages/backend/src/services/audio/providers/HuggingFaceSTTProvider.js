import BaseProvider from './BaseProvider.js';
import keyVaultService from '../../../services/security/keyVaultService.js';
import axios from 'axios';

export default class HuggingFaceSTTProvider extends BaseProvider {
  constructor() {
    super('huggingface-stt', ['stt']);
    this.baseURL = 'https://api-inference.huggingface.co';
  }

  async execute(payload, options = {}) {
    const { audioBuffer } = payload;
    if (!audioBuffer) return { success: false, error: 'Missing audioBuffer' };
    
    try {
      const keyRecord = await keyVaultService.get('huggingface_api_token');
      if (!keyRecord || !keyRecord.decryptedKey) {
        return { success: false, error: 'HF token unavailable' };
      }

      const model = options.model || 'openai/whisper-large-v3';
      const startTime = Date.now();

      // Prepare the request
      const response = await axios.post(
        `${this.baseURL}/models/${model}`,
        audioBuffer,
        {
          headers: {
            'Authorization': `Bearer ${keyRecord.decryptedKey}`,
            'Content-Type': 'application/octet-stream',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const latency = Date.now() - startTime;

      // Handle different response formats
      let transcript = '';
      let confidence = 0.0;

      if (response.data) {
        if (typeof response.data === 'string') {
          transcript = response.data;
          confidence = 0.8; // Default confidence for string responses
        } else if (response.data.text) {
          transcript = response.data.text;
          confidence = response.data.confidence || 0.8;
        } else if (Array.isArray(response.data) && response.data[0]) {
          const result = response.data[0];
          transcript = result.text || result.transcription || '';
          confidence = result.confidence || result.score || 0.8;
        } else {
          transcript = JSON.stringify(response.data);
          confidence = 0.5;
        }
      }

      return {
        success: true,
        data: {
          transcript: transcript.trim(),
          confidence,
          provider: 'huggingface',
          language: response.data.language || 'auto-detect',
          duration_ms: latency
        },
        meta: { 
          model,
          latency_ms: latency,
          tokens_estimated: Math.ceil(transcript.length / 4)
        }
      };

    } catch (e) {
      console.error('[HuggingFaceSTTProvider] Error:', e.message);
      
      // Handle specific HF API errors
      if (e.response?.status === 503) {
        return { 
          success: false, 
          error: 'Model loading, please retry in a few seconds',
          retryable: true
        };
      } else if (e.response?.status === 400) {
        return { 
          success: false, 
          error: 'Invalid audio format or model configuration',
          retryable: false
        };
      } else if (e.response?.status === 401 || e.response?.status === 403) {
        return { 
          success: false, 
          error: 'Invalid or insufficient HuggingFace API token permissions',
          retryable: false
        };
      } else if (e.response?.status === 429) {
        return { 
          success: false, 
          error: 'Rate limit exceeded, please retry later',
          retryable: true
        };
      }

      return { 
        success: false, 
        error: e.message,
        retryable: !e.response || e.response.status >= 500
      };
    }
  }
}
