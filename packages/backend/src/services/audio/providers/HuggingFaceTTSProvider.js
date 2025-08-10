import BaseProvider from './BaseProvider.js';
import keyVaultService from '../../../services/security/keyVaultService.js';
import axios from 'axios';

export default class HuggingFaceTTSProvider extends BaseProvider {
  constructor() {
    super('huggingface-tts', ['tts']);
    this.baseURL = 'https://api-inference.huggingface.co';
  }

  async execute(payload, options = {}) {
    const { text } = payload;
    if (!text) return { success: false, error: 'Missing text' };
    
    try {
      const keyRecord = await keyVaultService.get('huggingface_api_token');
      if (!keyRecord || !keyRecord.decryptedKey) {
        return { success: false, error: 'HF token unavailable' };
      }

      // Use a TTS model - microsoft/speecht5_tts is a good option
      const model = options.model || 'microsoft/speecht5_tts';
      const startTime = Date.now();

      // For TTS, we need to send the text as JSON
      const requestData = {
        inputs: text,
        parameters: {
          // Optional parameters for voice customization
          ...(options.speaker_id && { speaker_id: options.speaker_id }),
          ...(options.speed && { speed: options.speed }),
          ...(options.pitch && { pitch: options.pitch })
        }
      };

      const response = await axios.post(
        `${this.baseURL}/models/${model}`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${keyRecord.decryptedKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer', // Important for audio data
          timeout: 60000, // 60 second timeout for longer text
        }
      );

      const latency = Date.now() - startTime;
      
      // The response should be raw audio data
      const audioBuffer = Buffer.from(response.data);
      
      // Determine format from headers or model info
      const contentType = response.headers['content-type'];
      let format = 'wav'; // Default
      
      if (contentType) {
        if (contentType.includes('audio/wav')) format = 'wav';
        else if (contentType.includes('audio/mpeg')) format = 'mp3';
        else if (contentType.includes('audio/flac')) format = 'flac';
        else if (contentType.includes('audio/ogg')) format = 'ogg';
      }

      return {
        success: true,
        data: {
          audio: audioBuffer,
          format,
          provider: 'huggingface',
          duration_ms: latency,
          size_bytes: audioBuffer.length
        },
        meta: {
          model,
          latency_ms: latency,
          text_length: text.length,
          estimated_duration_s: Math.ceil(text.length / 15), // Rough estimate: ~15 chars per second
          quality: 'standard'
        }
      };

    } catch (e) {
      console.error('[HuggingFaceTTSProvider] Error:', e.message);
      
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
          error: 'Invalid text input or model configuration',
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
      } else if (e.response?.status === 413) {
        return { 
          success: false, 
          error: 'Text input too long for TTS processing',
          retryable: false
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
