/* global process, console */
import EventEmitter from 'events';
import DeepgramService from './DeepgramService.js';
import TextToSpeechService from './TextToSpeechService.js';
import messageBus from '../system/MessageBus.js';

class VoiceInteractionService extends EventEmitter {
  constructor() {
    super();
    this.isListening = false;
    this.isProcessing = false;
    this.currentConversation = null;
    this.wakeWord = 'cartrita';
    this.initialized = false;

    console.log('🎙️ VoiceInteractionService initialized');
    this.initialize();
  }

  async initialize() {
    try {
      // Set up wake word detection
      this.setupWakeWordDetection();

      // Subscribe to message bus events
      messageBus.subscribe(
        'voice:start-listening',
        this.startListening.bind(this)
      );
      messageBus.subscribe(
        'voice:stop-listening',
        this.stopListening.bind(this)
      );
      messageBus.subscribe('voice:process-audio', this.processAudio.bind(this));

      this.initialized = true;
      console.log('[VoiceInteractionService] ✅ Service initialized');
    } catch (error) {
      console.error(
        '[VoiceInteractionService] ❌ Initialization failed:',
        error
      );
    }
  }

  setupWakeWordDetection() {
    // Simple wake word detection based on transcription
    DeepgramService.on('transcript', data => {
      const transcript =
        data.channel?.alternatives?.[0]?.transcript?.toLowerCase() || '';

      if (transcript.includes(this.wakeWord)) {
        console.log('[VoiceInteractionService] 👂 Wake word detected!');
        this.emit('wake-word-detected', { transcript });
        this.activateListening();
      }
    });
  }

  async startListening() {
    if (this.isListening) {
      return { success: false, message: 'Already listening' };
    }

    try {
      this.isListening = true;
      await DeepgramService.startLiveTranscription({
        interim_results: true,
        smart_format: true,
        model: 'nova-2',
      });

      this.emit('listening-started');
      console.log('[VoiceInteractionService] 🎤 Started listening');

      return { success: true, message: 'Voice listening started' };
    } catch (error) {
      this.isListening = false;
      console.error(
        '[VoiceInteractionService] ❌ Failed to start listening:',
        error
      );
      return { success: false, error: error.message };
    }
  }

  stopListening() {
    if (!this.isListening) {
      return { success: false, message: 'Not currently listening' };
    }

    this.isListening = false;
    DeepgramService.stopLiveTranscription();
    this.emit('listening-stopped');
    console.log('[VoiceInteractionService] 🔇 Stopped listening');

    return { success: true, message: 'Voice listening stopped' };
  }

  async processAudio(audioBuffer, options = {}) {
    if (this.isProcessing) {
      return { success: false, message: 'Already processing audio' };
    }

    try {
      this.isProcessing = true;
      this.emit('processing-started');

      const transcription = await DeepgramService.transcribeAudio(
        audioBuffer,
        options
      );

      if (transcription.success) {
        this.emit('transcript-ready', {
          transcript: transcription.transcript,
          confidence: transcription.confidence,
        });

        // Send to AI for processing if confidence is high enough
        if (transcription.confidence > 0.7) {
          const response = await this.processTranscript(
            transcription.transcript
          );
          return response;
        }
      }

      return transcription;
    } catch (error) {
      console.error(
        '[VoiceInteractionService] ❌ Audio processing failed:',
        error
      );
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
      this.emit('processing-completed');
    }
  }

  async processTranscript(transcript) {
    try {
      // Send transcript to AI agent for processing
      messageBus.publish('ai:process-voice-input', {
        text: transcript,
        source: 'voice',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        transcript,
        message: 'Transcript sent for AI processing',
      };
    } catch (error) {
      console.error(
        '[VoiceInteractionService] ❌ Transcript processing failed:',
        error
      );
      return { success: false, error: error.message };
    }
  }

  activateListening() {
    // Activate listening mode after wake word detection
    this.emit('wake-word-activated');

    // Start a focused listening session
    setTimeout(() => {
      this.startListening();
    }, 500);
  }

  async speakResponse(text, options = {}) {
    try {
      const audioResponse = await TextToSpeechService.synthesizeSpeech(text, {
        voice: 'nova',
        model: 'tts-1',
        ...options,
      });

      if (audioResponse.success) {
        this.emit('speech-ready', audioResponse);
        return audioResponse;
      }

      return audioResponse;
    } catch (error) {
      console.error(
        '[VoiceInteractionService] ❌ Speech synthesis failed:',
        error
      );
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      service: 'VoiceInteractionService',
      initialized: this.initialized,
      isListening: this.isListening,
      isProcessing: this.isProcessing,
      deepgramConnected: DeepgramService.isConnected,
      timestamp: new Date().toISOString(),
    };
  }

  // Cleanup method
  destroy() {
    this.stopListening();
    messageBus.unsubscribe('voice:start-listening');
    messageBus.unsubscribe('voice:stop-listening');
    messageBus.unsubscribe('voice:process-audio');
    this.removeAllListeners();
  }
}

// Export the class to avoid instantiation issues during import
let voiceInteractionServiceInstance = null;

export default {
  getInstance() {
    if (!voiceInteractionServiceInstance) {
      voiceInteractionServiceInstance = new VoiceInteractionService();
    }
    return voiceInteractionServiceInstance;
  },
  // Proxy common methods for backward compatibility
  startListening() {
    return this.getInstance().startListening();
  },
  stopListening() {
    return this.getInstance().stopListening();
  },
  processAudio(audioBuffer, options) {
    return this.getInstance().processAudio(audioBuffer, options);
  },
  speakResponse(text, options) {
    return this.getInstance().speakResponse(text, options);
  },
  getStatus() {
    return this.getInstance().getStatus();
  },
  destroy() {
    return this.getInstance().destroy();
  },
  on(event, listener) {
    return this.getInstance().on(event, listener);
  },
  emit(event, ...args) {
    return this.getInstance().emit(event, ...args);
  },
};
