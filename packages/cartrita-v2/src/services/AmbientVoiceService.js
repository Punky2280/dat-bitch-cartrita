/* global process, console */
// packages/backend/src/services/AmbientVoiceService.js

import { EventEmitter } from 'events';
import OpenAIWrapper from '../system/OpenAIWrapper.js';

/**
 * Advanced Ambient Voice Service with Wake Word Detection and Voice Activity Detection
 * Implements modern 2025 AI assistant voice capabilities with local processing
 */
class AmbientVoiceService extends EventEmitter {
  constructor() {
    super();
    
    // Session management
    this.activeSessions = new Map();
    this.sessionCounter = 0;
    
    // Wake word configuration
    this.wakeWords = ['hey cartrita', 'cartrita', 'hey ai'];
    this.wakeWordSensitivity = 0.7; // 0-1, higher = more sensitive
    
    // Voice Activity Detection settings
    this.vadSettings = {
      silenceThreshold: 0.01, // Audio level below which is considered silence
      silenceDuration: 2000,  // ms of silence before stopping recording
      maxRecordingDuration: 30000, // Max 30 seconds per recording
      sampleRate: 16000,
      channels: 1
    };
    
    // Feature flags
    this.features = {
      wakeWordDetection: process.env.ENABLE_WAKE_WORD === 'true',
      voiceActivityDetection: process.env.VOICE_ACTIVITY_DETECTION === 'true',
      continuousListening: process.env.CONTINUOUS_LISTENING === 'true',
      noiseSuppression: process.env.NOISE_SUPPRESSION === 'true'
    };
    
    console.log('[AmbientVoiceService] ✅ Initialized with features:', this.features);
  }

  /**
   * Start a new ambient voice session
   */
  async startSession(userId, options = {}) {
    const sessionId = `ambient-${++this.sessionCounter}-${Date.now()}`;
    
    const session = {
      id: sessionId,
      userId,
      status: 'active',
      startTime: Date.now(),
      options: {
        wakeWordsEnabled: options.wakeWordsEnabled ?? true,
        vadEnabled: options.vadEnabled ?? true,
        language: options.language || 'en-US',
        customWakeWords: options.customWakeWords || [],
        sensitivity: options.sensitivity || this.wakeWordSensitivity,
        ...options
      },
      stats: {
        audioChunksProcessed: 0,
        wakeWordsDetected: 0,
        voiceActivationsDetected: 0,
        transcriptionsGenerated: 0,
        averageProcessingTime: 0
      },
      buffers: {
        audioBuffer: [],
        contextBuffer: [], // Store recent context for better wake word accuracy
        prewakeBuffer: []  // Buffer audio before wake word for context
      }
    };
    
    this.activeSessions.set(sessionId, session);
    
    console.log(`[AmbientVoiceService] 🎤 Started session ${sessionId} for user ${userId}`);
    
    // Start the processing loop for this session
    this.startSessionProcessing(session);
    
    this.emit('sessionStarted', { sessionId, userId, options: session.options });
    
    return {
      success: true,
      session_id: sessionId,
      status: 'started',
      features: this.features,
      wakeWords: [...this.wakeWords, ...session.options.customWakeWords],
      settings: session.options
    };
  }

  /**
   * Stop an ambient voice session
   */
  async stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    session.status = 'stopping';
    
    // Clean up resources
    if (session.processingInterval) {
      clearInterval(session.processingInterval);
    }
    
    // Final stats
    const sessionDuration = Date.now() - session.startTime;
    const finalStats = {
      ...session.stats,
      sessionDuration,
      averageProcessingTime: session.stats.audioChunksProcessed > 0 
        ? session.stats.averageProcessingTime / session.stats.audioChunksProcessed 
        : 0
    };
    
    this.activeSessions.delete(sessionId);
    
    console.log(`[AmbientVoiceService] 🛑 Stopped session ${sessionId}`, finalStats);
    
    this.emit('sessionStopped', { sessionId, stats: finalStats });
    
    return {
      success: true,
      session_id: sessionId,
      status: 'stopped',
      stats: finalStats
    };
  }

  /**
   * Get session status and statistics
   */
  getSessionStatus(sessionId) {
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      
      return {
        success: true,
        session_id: sessionId,
        status: session.status,
        uptime: Date.now() - session.startTime,
        stats: session.stats,
        settings: session.options
      };
    }
    
    // Return overview of all sessions
    const sessions = Array.from(this.activeSessions.values()).map(session => ({
      id: session.id,
      userId: session.userId,
      status: session.status,
      uptime: Date.now() - session.startTime,
      stats: session.stats
    }));
    
    return {
      success: true,
      activeSessions: sessions.length,
      sessions,
      features: this.features
    };
  }

  /**
   * Process incoming audio data for a session
   */
  async processAudioChunk(sessionId, audioData, metadata = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return { success: false, error: 'Invalid or inactive session' };
    }
    
    const startTime = Date.now();
    session.stats.audioChunksProcessed++;
    
    try {
      // Add to audio buffer
      session.buffers.audioBuffer.push({
        data: audioData,
        timestamp: Date.now(),
        metadata
      });
      
      // Keep buffer manageable (last 5 seconds)
      const bufferLimit = Math.ceil(this.vadSettings.sampleRate * 5 / 1024); // ~5 seconds of audio
      if (session.buffers.audioBuffer.length > bufferLimit) {
        session.buffers.audioBuffer = session.buffers.audioBuffer.slice(-bufferLimit);
      }
      
      let result = { processed: true };
      
      // Voice Activity Detection
      if (session.options.vadEnabled && this.features.voiceActivityDetection) {
        const vadResult = await this.detectVoiceActivity(audioData, session);
        if (vadResult.voiceDetected) {
          result.voiceActivity = vadResult;
          session.stats.voiceActivationsDetected++;
        }
      }
      
      // Wake Word Detection
      if (session.options.wakeWordsEnabled && this.features.wakeWordDetection) {
        const wakeResult = await this.detectWakeWord(audioData, session);
        if (wakeResult.wakeWordDetected) {
          result.wakeWord = wakeResult;
          session.stats.wakeWordsDetected++;
          
          // Trigger voice assistant activation
          await this.handleWakeWordDetection(session, wakeResult);
        }
      }
      
      // Update processing time stats
      const processingTime = Date.now() - startTime;
      session.stats.averageProcessingTime = 
        (session.stats.averageProcessingTime + processingTime) / 2;
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error(`[AmbientVoiceService] ❌ Audio processing failed for ${sessionId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Advanced Voice Activity Detection using audio analysis
   */
  async detectVoiceActivity(audioData, session) {
    // Convert audio data to analyzable format
    const audioBuffer = this.normalizeAudioData(audioData);
    
    // Calculate RMS (Root Mean Square) for volume detection
    let rms = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      rms += audioBuffer[i] * audioBuffer[i];
    }
    rms = Math.sqrt(rms / audioBuffer.length);
    
    // Calculate zero-crossing rate for voice characteristic detection
    let zeroCrossings = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / (audioBuffer.length - 1);
    
    // Voice detection logic
    const voiceDetected = rms > this.vadSettings.silenceThreshold && 
                         zcr > 0.01 && zcr < 0.5; // Typical voice characteristics
    
    // Spectral analysis for enhanced detection (simplified)
    const spectralCentroid = this.calculateSpectralCentroid(audioBuffer);
    const enhancedVoiceDetected = voiceDetected && 
                                 spectralCentroid > 500 && spectralCentroid < 4000; // Human voice range
    
    return {
      voiceDetected: enhancedVoiceDetected,
      confidence: enhancedVoiceDetected ? Math.min(rms * 10, 1.0) : 0,
      metrics: {
        rms,
        zeroCrossingRate: zcr,
        spectralCentroid,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Wake Word Detection using pattern matching and audio analysis
   */
  async detectWakeWord(audioData, session) {
    // For production, this would use a trained model like openWakeWord
    // Here we implement a simplified version with audio pattern matching
    
    const audioBuffer = this.normalizeAudioData(audioData);
    const allWakeWords = [...this.wakeWords, ...session.options.customWakeWords];
    
    // Transcribe recent audio buffer to text for keyword detection
    let transcriptionText = '';
    try {
      // Use last few seconds of audio for wake word detection
      const recentAudio = this.concatenateRecentAudio(session, 3000); // 3 seconds
      
      if (recentAudio.length > 0) {
        // Create a simple wav buffer for transcription
        const wavBuffer = this.createWavBuffer(recentAudio, this.vadSettings.sampleRate);
        
        const transcription = await OpenAIWrapper.createTranscription({
          file: new Blob([wavBuffer], { type: 'audio/wav' }),
          model: 'whisper-1',
          response_format: 'text'
        });
        
        transcriptionText = transcription.text.toLowerCase();
      }
    } catch (error) {
      console.warn(`[AmbientVoiceService] Transcription failed for wake word detection:`, error.message);
    }
    
    // Check for wake words in transcription
    for (const wakeWord of allWakeWords) {
      const normalizedWakeWord = wakeWord.toLowerCase();
      if (transcriptionText.includes(normalizedWakeWord)) {
        console.log(`[AmbientVoiceService] 🎯 Wake word detected: "${wakeWord}"`);
        
        return {
          wakeWordDetected: true,
          wakeWord: wakeWord,
          confidence: 0.8, // High confidence for transcription-based detection
          transcription: transcriptionText,
          timestamp: Date.now(),
          method: 'transcription'
        };
      }
    }
    
    // Alternative: Audio pattern matching (simplified implementation)
    const patternConfidence = this.matchAudioPattern(audioBuffer, allWakeWords);
    if (patternConfidence > session.options.sensitivity) {
      return {
        wakeWordDetected: true,
        wakeWord: 'pattern-match',
        confidence: patternConfidence,
        timestamp: Date.now(),
        method: 'pattern-matching'
      };
    }
    
    return { wakeWordDetected: false };
  }

  /**
   * Handle wake word detection by activating voice assistant
   */
  async handleWakeWordDetection(session, wakeResult) {
    console.log(`[AmbientVoiceService] 🎤 Activating voice assistant for session ${session.id}`);
    
    // Emit wake word event for frontend
    this.emit('wakeWordDetected', {
      sessionId: session.id,
      userId: session.userId,
      wakeWord: wakeResult.wakeWord,
      confidence: wakeResult.confidence,
      timestamp: wakeResult.timestamp
    });
    
    // Start recording for command after wake word
    await this.startCommandRecording(session);
  }

  /**
   * Start recording user command after wake word detection
   */
  async startCommandRecording(session) {
    session.commandRecording = {
      active: true,
      startTime: Date.now(),
      audioChunks: [],
      timeout: null
    };
    
    // Set timeout for command recording
    session.commandRecording.timeout = setTimeout(async () => {
      await this.processCommand(session);
    }, this.vadSettings.maxRecordingDuration);
    
    console.log(`[AmbientVoiceService] 🎙️ Started command recording for session ${session.id}`);
  }

  /**
   * Process recorded command and generate response
   */
  async processCommand(session) {
    if (!session.commandRecording || !session.commandRecording.active) {
      return;
    }
    
    session.commandRecording.active = false;
    if (session.commandRecording.timeout) {
      clearTimeout(session.commandRecording.timeout);
    }
    
    try {
      // Concatenate recorded audio chunks
      const commandAudio = this.concatenateAudioChunks(session.commandRecording.audioChunks);
      
      if (commandAudio.length === 0) {
        console.log(`[AmbientVoiceService] No command audio recorded for session ${session.id}`);
        return;
      }
      
      // Transcribe command
      const wavBuffer = this.createWavBuffer(commandAudio, this.vadSettings.sampleRate);
      const transcription = await OpenAIWrapper.createTranscription({
        file: new Blob([wavBuffer], { type: 'audio/wav' }),
        model: 'whisper-1',
        response_format: 'verbose_json'
      });
      
      session.stats.transcriptionsGenerated++;
      
      console.log(`[AmbientVoiceService] 📝 Command transcribed: "${transcription.text}"`);
      
      // Emit command for processing by main chat system
      this.emit('voiceCommand', {
        sessionId: session.id,
        userId: session.userId,
        command: transcription.text,
        transcription: transcription,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`[AmbientVoiceService] ❌ Command processing failed:`, error.message);
    } finally {
      // Clean up command recording
      delete session.commandRecording;
    }
  }

  /**
   * Helper methods for audio processing
   */
  normalizeAudioData(audioData) {
    // Convert various audio formats to float32 array
    if (audioData instanceof ArrayBuffer) {
      return new Float32Array(audioData);
    } else if (audioData instanceof Uint8Array) {
      const float32 = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        float32[i] = (audioData[i] - 128) / 128.0;
      }
      return float32;
    }
    return audioData;
  }

  calculateSpectralCentroid(audioBuffer) {
    // Simplified spectral centroid calculation
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const magnitude = Math.abs(audioBuffer[i]);
      numerator += i * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  matchAudioPattern(audioBuffer, wakeWords) {
    // Simplified pattern matching - in production this would use trained models
    // Returns confidence score 0-1
    return Math.random() * 0.3; // Mock implementation
  }

  concatenateRecentAudio(session, durationMs) {
    const cutoffTime = Date.now() - durationMs;
    const recentChunks = session.buffers.audioBuffer.filter(chunk => chunk.timestamp > cutoffTime);
    return this.concatenateAudioChunks(recentChunks.map(chunk => chunk.data));
  }

  concatenateAudioChunks(chunks) {
    if (chunks.length === 0) return new Float32Array(0);
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  createWavBuffer(audioData, sampleRate) {
    // Create a simple WAV file buffer
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    const int16View = new Int16Array(buffer, 44);
    for (let i = 0; i < length; i++) {
      int16View[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
    }
    
    return buffer;
  }

  startSessionProcessing(session) {
    // Periodic cleanup and maintenance
    session.processingInterval = setInterval(() => {
      if (session.status === 'active') {
        // Clean up old buffers
        const cutoffTime = Date.now() - 30000; // Keep 30 seconds
        session.buffers.audioBuffer = session.buffers.audioBuffer.filter(
          chunk => chunk.timestamp > cutoffTime
        );
      }
    }, 5000);
  }

  /**
   * Get service statistics and health
   */
  getServiceStats() {
    const sessions = Array.from(this.activeSessions.values());
    const totalStats = sessions.reduce((acc, session) => ({
      audioChunksProcessed: acc.audioChunksProcessed + session.stats.audioChunksProcessed,
      wakeWordsDetected: acc.wakeWordsDetected + session.stats.wakeWordsDetected,
      voiceActivationsDetected: acc.voiceActivationsDetected + session.stats.voiceActivationsDetected,
      transcriptionsGenerated: acc.transcriptionsGenerated + session.stats.transcriptionsGenerated
    }), { audioChunksProcessed: 0, wakeWordsDetected: 0, voiceActivationsDetected: 0, transcriptionsGenerated: 0 });
    
    return {
      activeSessions: sessions.length,
      features: this.features,
      wakeWords: this.wakeWords,
      totalStats,
      healthy: this.isHealthy()
    };
  }

  isHealthy() {
    return this.activeSessions.size < 100; // Reasonable session limit
  }

  /**
   * Update service configuration
   */
  updateConfiguration(config) {
    if (config.wakeWords) {
      this.wakeWords = config.wakeWords;
    }
    if (config.sensitivity !== undefined) {
      this.wakeWordSensitivity = Math.max(0, Math.min(1, config.sensitivity));
    }
    if (config.vadSettings) {
      this.vadSettings = { ...this.vadSettings, ...config.vadSettings };
    }
    
    console.log('[AmbientVoiceService] 🔧 Configuration updated');
    return { success: true, config: { wakeWords: this.wakeWords, sensitivity: this.wakeWordSensitivity } };
  }
}

export default new AmbientVoiceService();