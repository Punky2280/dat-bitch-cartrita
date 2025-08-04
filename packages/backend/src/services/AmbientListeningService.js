/* global process, console */
import EventEmitter from 'events';
import DeepgramService from './DeepgramService.js';

class AmbientListeningService extends EventEmitter {
  constructor() {
    super();
    this.isActive = false;
    this.isAnalyzing = false;
    this.soundClassification = new Map();
    this.ambientProfile = null;
    this.initialized = false;
    
    console.log('🌊 AmbientListeningService initialized');
    this.initialize();
  }

  async initialize() {
    try {
      // Set up ambient sound monitoring
      this.setupAmbientMonitoring();
      
      this.initialized = true;
      console.log('[AmbientListeningService] ✅ Service initialized');
    } catch (error) {
      console.error('[AmbientListeningService] ❌ Initialization failed:', error);
    }
  }

  setupAmbientMonitoring() {
    // Listen for transcription results to classify ambient sounds
    DeepgramService.on('transcript', (data) => {
      if (this.isActive) {
        this.analyzeAmbientSound(data);
      }
    });
  }

  async startAmbientListening() {
    if (this.isActive) {
      return { success: false, message: 'Ambient listening already active' };
    }

    try {
      this.isActive = true;
      
      // Start continuous listening for ambient analysis
      await DeepgramService.startLiveTranscription({
        interim_results: false,
        smart_format: true,
        model: 'nova-2',
        language: 'en-US'
      });

      this.emit('ambient-listening-started');
      console.log('[AmbientListeningService] 🎵 Started ambient listening');
      
      return { success: true, message: 'Ambient listening started' };
    } catch (error) {
      this.isActive = false;
      console.error('[AmbientListeningService] ❌ Failed to start ambient listening:', error);
      return { success: false, error: error.message };
    }
  }

  stopAmbientListening() {
    if (!this.isActive) {
      return { success: false, message: 'Ambient listening not active' };
    }

    this.isActive = false;
    this.emit('ambient-listening-stopped');
    console.log('[AmbientListeningService] 🔇 Stopped ambient listening');
    
    return { success: true, message: 'Ambient listening stopped' };
  }

  analyzeAmbientSound(transcriptionData) {
    if (this.isAnalyzing) return;

    try {
      this.isAnalyzing = true;
      
      const transcript = transcriptionData.channel?.alternatives?.[0]?.transcript || '';
      const confidence = transcriptionData.channel?.alternatives?.[0]?.confidence || 0;
      
      // Classify the sound based on transcription patterns
      const soundType = this.classifySound(transcript, confidence);
      
      if (soundType) {
        this.updateSoundClassification(soundType, confidence);
        this.emit('ambient-sound-detected', {
          type: soundType,
          confidence,
          transcript,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('[AmbientListeningService] ❌ Sound analysis failed:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  classifySound(transcript, confidence) {
    const lowerTranscript = transcript.toLowerCase();
    
    // Basic sound classification based on common patterns
    const soundPatterns = {
      music: ['music', 'song', 'melody', 'beat', 'rhythm'],
      conversation: ['talking', 'speaking', 'voice', 'chat'],
      traffic: ['car', 'truck', 'traffic', 'engine', 'horn'],
      nature: ['bird', 'wind', 'rain', 'water', 'nature'],
      household: ['door', 'phone', 'television', 'tv', 'cooking'],
      notification: ['beep', 'ring', 'alert', 'notification', 'alarm']
    };

    for (const [soundType, patterns] of Object.entries(soundPatterns)) {
      if (patterns.some(pattern => lowerTranscript.includes(pattern))) {
        return soundType;
      }
    }

    // If confidence is very low, might be background noise
    if (confidence < 0.3) {
      return 'background_noise';
    }

    return 'unknown';
  }

  updateSoundClassification(soundType, confidence) {
    const current = this.soundClassification.get(soundType) || {
      count: 0,
      totalConfidence: 0,
      lastDetected: null
    };

    current.count++;
    current.totalConfidence += confidence;
    current.lastDetected = new Date().toISOString();

    this.soundClassification.set(soundType, current);
  }

  getAmbientProfile() {
    const profile = {
      timestamp: new Date().toISOString(),
      isActive: this.isActive,
      soundTypes: {}
    };

    for (const [soundType, data] of this.soundClassification.entries()) {
      profile.soundTypes[soundType] = {
        count: data.count,
        averageConfidence: data.totalConfidence / data.count,
        lastDetected: data.lastDetected
      };
    }

    return profile;
  }

  clearAmbientProfile() {
    this.soundClassification.clear();
    console.log('[AmbientListeningService] 🧹 Ambient profile cleared');
  }

  getStatus() {
    return {
      service: 'AmbientListeningService',
      initialized: this.initialized,
      isActive: this.isActive,
      isAnalyzing: this.isAnalyzing,
      soundTypesDetected: this.soundClassification.size,
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup method
  destroy() {
    this.stopAmbientListening();
    this.clearAmbientProfile();
    this.removeAllListeners();
  }
}

export default new AmbientListeningService();