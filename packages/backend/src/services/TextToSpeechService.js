/* global process, console */
import OpenAI from 'openai';

class TextToSpeechService {
  constructor() {
    this.client = null;
    this.initialized = false;

    console.log('🗣️ TextToSpeechService initialized');
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        '[TextToSpeechService] OpenAI API key not configured - service will be limited'
      );
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.initialized = true;
      console.log('[TextToSpeechService] ✅ Client initialized');
    } catch (error) {
      console.error(
        '[TextToSpeechService] ❌ Failed to initialize client:',
        error
      );
    }
  }

  async synthesizeSpeech(text, options = {}) {
    if (!this.client) {
      return {
        success: false,
        error: 'OpenAI client not initialized',
      };
    }

    try {
      const {
        model = 'tts-1',
        voice = 'nova',
        speed = 1.0,
        response_format = 'mp3',
      } = options;

      const response = await this.client.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
        response_format,
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        success: true,
        audio: buffer,
        format: response_format,
        size: buffer.length,
        text: text,
      };
    } catch (error) {
      console.error('[TextToSpeechService] ❌ Speech synthesis failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async synthesizeWithPersonality(
    text,
    personality = 'friendly',
    options = {}
  ) {
    // Apply personality-based modifications to voice parameters
    const personalitySettings = {
      friendly: { voice: 'nova', speed: 1.0 },
      professional: { voice: 'echo', speed: 0.9 },
      energetic: { voice: 'fable', speed: 1.1 },
      calm: { voice: 'shimmer', speed: 0.8 },
      authoritative: { voice: 'onyx', speed: 0.9 },
    };

    const settings =
      personalitySettings[personality] || personalitySettings.friendly;

    return await this.synthesizeSpeech(text, {
      ...settings,
      ...options,
    });
  }

  async getAvailableVoices() {
    return [
      { id: 'alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'echo', name: 'Echo', gender: 'male' },
      { id: 'fable', name: 'Fable', gender: 'female' },
      { id: 'nova', name: 'Nova', gender: 'female' },
      { id: 'onyx', name: 'Onyx', gender: 'male' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' },
    ];
  }

  validateText(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Text must be a non-empty string' };
    }

    if (text.length > 4096) {
      return { valid: false, error: 'Text must be 4096 characters or less' };
    }

    return { valid: true };
  }

  getStatus() {
    return {
      service: 'TextToSpeechService',
      initialized: this.initialized,
      hasClient: !!this.client,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new TextToSpeechService();
