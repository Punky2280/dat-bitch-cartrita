import BaseProvider from './BaseProvider.js';
import keyVaultService from '../../../services/security/keyVaultService.js';
import axios from 'axios';

export default class HuggingFaceVoiceSwapProvider extends BaseProvider {
  constructor() {
    super('huggingface-voice-swap', ['voice-swap']);
    this.baseURL = 'https://api-inference.huggingface.co';
  }

  async execute(payload, options = {}) {
    const { audioBuffer, targetVoice } = payload;
    if (!audioBuffer) return { success: false, error: 'Missing audioBuffer' };

    try {
      const keyRecord = await keyVaultService.get('huggingface_api_token');
      if (!keyRecord || !keyRecord.decryptedKey) {
        return { success: false, error: 'HF token unavailable' };
      }

      // Voice conversion approach: STT -> TTS with target voice
      const startTime = Date.now();

      // Step 1: Transcribe the original audio
      const sttModel = 'openai/whisper-large-v3';

      const transcriptResponse = await axios.post(
        `${this.baseURL}/models/${sttModel}`,
        audioBuffer,
        {
          headers: {
            Authorization: `Bearer ${keyRecord.decryptedKey}`,
            'Content-Type': 'application/octet-stream',
          },
          timeout: 30000,
        }
      );

      // Extract text from transcription
      let transcript = '';
      if (typeof transcriptResponse.data === 'string') {
        transcript = transcriptResponse.data;
      } else if (transcriptResponse.data.text) {
        transcript = transcriptResponse.data.text;
      } else if (
        Array.isArray(transcriptResponse.data) &&
        transcriptResponse.data[0]?.text
      ) {
        transcript = transcriptResponse.data[0].text;
      } else {
        throw new Error('Could not extract transcript for voice conversion');
      }

      if (!transcript.trim()) {
        throw new Error('Empty transcript - cannot perform voice conversion');
      }

      // Step 2: Synthesize with target voice using TTS
      const ttsModel = options.ttsModel || 'microsoft/speecht5_tts';

      const ttsResponse = await axios.post(
        `${this.baseURL}/models/${ttsModel}`,
        {
          inputs: transcript,
          parameters: {
            speaker_id: targetVoice,
            ...(options.speed && { speed: options.speed }),
            ...(options.pitch && { pitch: options.pitch }),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${keyRecord.decryptedKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );

      const totalLatency = Date.now() - startTime;
      const synthesizedBuffer = Buffer.from(ttsResponse.data);

      return {
        success: true,
        data: {
          transformedAudio: synthesizedBuffer,
          targetVoice: targetVoice || 'default',
          provider: 'huggingface',
          transcript,
          format: 'wav',
          duration_ms: totalLatency,
        },
        meta: {
          stt_model: sttModel,
          tts_model: ttsModel,
          latency_ms: totalLatency,
          transcript_length: transcript.length,
          original_size: audioBuffer.length,
          converted_size: synthesizedBuffer.length,
        },
      };
    } catch (e) {
      console.error('[HuggingFaceVoiceSwapProvider] Error:', e.message);

      // Handle specific HF API errors
      if (e.response?.status === 503) {
        return {
          success: false,
          error: 'Model loading, please retry in a few seconds',
          retryable: true,
        };
      } else if (e.response?.status === 400) {
        return {
          success: false,
          error: 'Invalid audio input or voice configuration',
          retryable: false,
        };
      } else if (e.response?.status === 401 || e.response?.status === 403) {
        return {
          success: false,
          error: 'Invalid or insufficient HuggingFace API token permissions',
          retryable: false,
        };
      } else if (e.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded, please retry later',
          retryable: true,
        };
      }

      return {
        success: false,
        error: e.message,
        retryable: !e.response || e.response.status >= 500,
      };
    }
  }
}
