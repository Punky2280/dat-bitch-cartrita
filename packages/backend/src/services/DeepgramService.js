/* global process, console */
import { createClient } from '@deepgram/sdk';
import EventEmitter from 'events';

class DeepgramService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.liveConnection = null;
    this.isConnected = false;
    this.initialized = false;
    
    console.log('🎤 DeepgramService initialized');
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.DEEPGRAM_API_KEY) {
      console.warn('[DeepgramService] API key not configured - service will be limited');
      return;
    }

    try {
      this.client = createClient(process.env.DEEPGRAM_API_KEY);
      this.initialized = true;
      console.log('[DeepgramService] ✅ Client initialized');
    } catch (error) {
      console.error('[DeepgramService] ❌ Failed to initialize client:', error);
    }
  }

  async transcribeAudio(audioBuffer, options = {}) {
    if (!this.client) {
      throw new Error('Deepgram client not initialized');
    }

    try {
      const { result } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          smart_format: true,
          model: 'nova-2',
          language: 'en-US',
          ...options
        }
      );

      return {
        success: true,
        transcript: result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
        confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
      };
    } catch (error) {
      console.error('[DeepgramService] Transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async startLiveTranscription(options = {}) {
    if (!this.client) {
      throw new Error('Deepgram client not initialized');
    }

    const connection = this.client.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      ...options
    });

    connection.on('open', () => {
      this.isConnected = true;
      this.emit('connected');
    });

    connection.on('Results', (data) => {
      this.emit('transcript', data);
    });

    connection.on('close', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });

    connection.on('error', (error) => {
      this.emit('error', error);
    });

    this.liveConnection = connection;
    return connection;
  }

  stopLiveTranscription() {
    if (this.liveConnection) {
      this.liveConnection.finish();
      this.liveConnection = null;
      this.isConnected = false;
    }
  }

  getStatus() {
    return {
      service: 'DeepgramService',
      initialized: this.initialized,
      connected: this.isConnected,
      timestamp: new Date().toISOString()
    };
  }
}

export default new DeepgramService();