/* global process, console */
import EventEmitter from 'events';
import DeepgramService from './DeepgramService.js';

/**
 * AmbientListeningService - Provides environmental sound classification and monitoring
 * Features:
 * - Real-time ambient sound detection and classification
 * - Sound pattern analysis with confidence scoring
 * - Ambient profile generation and management
 * - Event-driven architecture for real-time notifications
 * - Health monitoring and graceful error handling
 */
class AmbientListeningService extends EventEmitter {
  constructor() {
    super();
    this.isActive = false;
    this.isAnalyzing = false;
    this.soundClassification = new Map();
    this.ambientProfile = null;
    this.initialized = false;
    this.lastError = null;
    this.errorCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.healthStatus = 'unknown';

    // Configuration
    this.config = {
      confidenceThreshold: 0.3,
      maxSoundTypes: 50, // Prevent memory overflow
      profileRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
      analysisTimeoutMs: 5000, // 5 second timeout for analysis
      maxConcurrentAnalysis: 1,
    };

    this.initTime = Date.now();

    console.log('🌊 AmbientListeningService initialized');
    this.initialize();
  }

  async initialize() {
    try {
      // Validate dependencies
      if (!DeepgramService) {
        throw new Error('DeepgramService dependency not available');
      }

      // Set up ambient sound monitoring
      await this.setupAmbientMonitoring();

      // Set up cleanup intervals
      this.setupMaintenanceTasks();

      this.initialized = true;
      this.healthStatus = 'healthy';
      this.lastError = null;
      this.errorCount = 0;

      console.log(
        '[AmbientListeningService] ✅ Service initialized successfully'
      );
      this.emit('service-initialized', { timestamp: new Date().toISOString() });
    } catch (error) {
      this.initialized = false;
      this.healthStatus = 'error';
      this.lastError = error.message;
      console.error(
        '[AmbientListeningService] ❌ Initialization failed:',
        error
      );
      this.emit('service-error', {
        error: error.message,
        phase: 'initialization',
      });
      throw error;
    }
  }

  async setupAmbientMonitoring() {
    try {
      // Listen for transcription results to classify ambient sounds
      DeepgramService.on('transcript', data => {
        if (this.isActive && !this.isAnalyzing) {
          this.analyzeAmbientSound(data);
        }
      });

      // Handle DeepgramService errors
      DeepgramService.on('error', error => {
        this.handleError(error, 'deepgram_error');
      });

      console.log(
        '[AmbientListeningService] Ambient monitoring setup completed'
      );
    } catch (error) {
      console.error(
        '[AmbientListeningService] Failed to setup ambient monitoring:',
        error
      );
      throw error;
    }
  }

  setupMaintenanceTasks() {
    // Clean up old sound classifications periodically (every hour)
    this.maintenanceInterval = setInterval(
      () => {
        this.cleanupOldClassifications();
      },
      60 * 60 * 1000
    );

    // Health check every 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthCheck();
      },
      5 * 60 * 1000
    );
  }

  cleanupOldClassifications() {
    try {
      const now = Date.now();
      const cutoff = now - this.config.profileRetentionMs;
      let cleaned = 0;

      for (const [soundType, data] of this.soundClassification.entries()) {
        const lastDetectedTime = new Date(data.lastDetected).getTime();
        if (lastDetectedTime < cutoff) {
          this.soundClassification.delete(soundType);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(
          `[AmbientListeningService] Cleaned up ${cleaned} old sound classifications`
        );
      }
    } catch (error) {
      console.error(
        '[AmbientListeningService] Failed to cleanup old classifications:',
        error
      );
    }
  }

  performHealthCheck() {
    try {
      const status = this.getHealthStatus();

      if (status.status !== 'healthy') {
        console.warn('[AmbientListeningService] Health check warning:', status);
        this.emit('health-warning', status);
      }
    } catch (error) {
      console.error('[AmbientListeningService] Health check failed:', error);
    }
  }

  async startAmbientListening(options = {}) {
    if (!this.initialized) {
      return {
        success: false,
        message: 'Service not initialized',
        code: 'SERVICE_NOT_INITIALIZED',
      };
    }

    if (this.isActive) {
      return {
        success: false,
        message: 'Ambient listening already active',
        code: 'ALREADY_ACTIVE',
      };
    }

    let retryCount = 0;
    while (retryCount < this.maxRetries) {
      try {
        this.isActive = true;
        this.healthStatus = 'starting';

        // Merge default options with provided options
        const transcriptionOptions = {
          interim_results: false,
          smart_format: true,
          model: 'nova-2',
          language: 'en-US',
          ...options,
        };

        // Start continuous listening for ambient analysis
        await DeepgramService.startLiveTranscription(transcriptionOptions);

        this.healthStatus = 'healthy';
        this.lastError = null;
        this.errorCount = 0;

        this.emit('ambient-listening-started', {
          timestamp: new Date().toISOString(),
          options: transcriptionOptions,
        });

        console.log(
          '[AmbientListeningService] 🎵 Started ambient listening successfully'
        );

        return {
          success: true,
          message: 'Ambient listening started successfully',
          options: transcriptionOptions,
        };
      } catch (error) {
        retryCount++;
        this.errorCount++;
        this.lastError = error.message;

        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
          console.warn(
            `[AmbientListeningService] ⚠️ Start attempt ${retryCount} failed, retrying in ${delay}ms:`,
            error.message
          );
          await this.delay(delay);
        } else {
          this.isActive = false;
          this.healthStatus = 'error';
          console.error(
            '[AmbientListeningService] ❌ Failed to start ambient listening after all retries:',
            error
          );
          this.emit('service-error', {
            error: error.message,
            phase: 'start',
            retryCount,
          });

          return {
            success: false,
            message: `Failed to start ambient listening: ${error.message}`,
            error: error.message,
            code: 'START_FAILED',
            retryCount,
          };
        }
      }
    }
  }

  stopAmbientListening(reason = 'user_request') {
    if (!this.isActive) {
      return {
        success: false,
        message: 'Ambient listening not active',
        code: 'NOT_ACTIVE',
      };
    }

    try {
      this.isActive = false;
      this.healthStatus = 'stopped';

      // Try to stop DeepgramService gracefully
      try {
        DeepgramService.stopLiveTranscription?.();
      } catch (error) {
        console.warn(
          '[AmbientListeningService] Warning: Could not stop DeepgramService cleanly:',
          error.message
        );
      }

      this.emit('ambient-listening-stopped', {
        timestamp: new Date().toISOString(),
        reason,
      });

      console.log(
        `[AmbientListeningService] 🔇 Stopped ambient listening (reason: ${reason})`
      );

      return {
        success: true,
        message: 'Ambient listening stopped successfully',
        reason,
      };
    } catch (error) {
      console.error('[AmbientListeningService] ❌ Error during stop:', error);
      return {
        success: false,
        message: `Error stopping ambient listening: ${error.message}`,
        error: error.message,
        code: 'STOP_ERROR',
      };
    }
  }

  async analyzeAmbientSound(transcriptionData) {
    if (this.isAnalyzing) {
      return; // Prevent concurrent analysis
    }

    // Create analysis timeout
    const analysisTimeout = setTimeout(() => {
      this.isAnalyzing = false;
      console.warn('[AmbientListeningService] ⚠️ Sound analysis timed out');
    }, this.config.analysisTimeoutMs);

    try {
      this.isAnalyzing = true;

      // Validate input data
      if (!transcriptionData || typeof transcriptionData !== 'object') {
        throw new Error('Invalid transcription data provided');
      }

      const transcript =
        transcriptionData.channel?.alternatives?.[0]?.transcript || '';
      const confidence =
        transcriptionData.channel?.alternatives?.[0]?.confidence || 0;

      // Skip empty or very low confidence transcripts
      if (!transcript.trim() || confidence < 0.1) {
        return;
      }

      // Classify the sound based on transcription patterns
      const soundType = this.classifySound(transcript, confidence);

      if (soundType && soundType !== 'unknown') {
        // Check if we've hit the max sound types limit
        if (
          this.soundClassification.size >= this.config.maxSoundTypes &&
          !this.soundClassification.has(soundType)
        ) {
          console.warn(
            '[AmbientListeningService] ⚠️ Max sound types limit reached, ignoring new sound type'
          );
          return;
        }

        this.updateSoundClassification(soundType, confidence);

        const eventData = {
          type: soundType,
          confidence,
          transcript: transcript.substring(0, 100), // Limit transcript length
          timestamp: new Date().toISOString(),
          metadata: {
            analysisTime: Date.now(),
          },
        };

        this.emit('ambient-sound-detected', eventData);

        // Log significant sound detections
        if (confidence > 0.7) {
          console.log(
            `[AmbientListeningService] 🔊 High-confidence sound detected: ${soundType} (${(
              confidence * 100
            ).toFixed(1)}%)`
          );
        }
      }
    } catch (error) {
      this.handleError(error, 'sound_analysis');
      console.error(
        '[AmbientListeningService] ❌ Sound analysis failed:',
        error
      );
    } finally {
      clearTimeout(analysisTimeout);
      this.isAnalyzing = false;
    }
  }

  classifySound(transcript, confidence) {
    if (!transcript || typeof transcript !== 'string') {
      return null;
    }

    const lowerTranscript = transcript.toLowerCase().trim();

    // Enhanced sound classification with more patterns and better logic
    const soundPatterns = {
      music: {
        patterns: [
          'music',
          'song',
          'melody',
          'beat',
          'rhythm',
          'singing',
          'guitar',
          'piano',
          'drums',
        ],
        weight: 1.0,
      },
      conversation: {
        patterns: [
          'talking',
          'speaking',
          'voice',
          'chat',
          'discussion',
          'conversation',
          'dialogue',
        ],
        weight: 0.9,
      },
      traffic: {
        patterns: [
          'car',
          'truck',
          'traffic',
          'engine',
          'horn',
          'vehicle',
          'motorcycle',
          'siren',
        ],
        weight: 1.0,
      },
      nature: {
        patterns: [
          'bird',
          'wind',
          'rain',
          'water',
          'nature',
          'thunder',
          'storm',
          'ocean',
          'river',
        ],
        weight: 1.0,
      },
      household: {
        patterns: [
          'door',
          'phone',
          'television',
          'tv',
          'cooking',
          'microwave',
          'dishwasher',
          'vacuum',
          'blender',
        ],
        weight: 0.8,
      },
      notification: {
        patterns: [
          'beep',
          'ring',
          'alert',
          'notification',
          'alarm',
          'chime',
          'buzz',
          'ding',
        ],
        weight: 1.0,
      },
      mechanical: {
        patterns: [
          'machine',
          'motor',
          'fan',
          'air conditioning',
          'hvac',
          'pump',
          'generator',
        ],
        weight: 0.9,
      },
      animals: {
        patterns: ['dog', 'cat', 'bark', 'meow', 'pet', 'animal'],
        weight: 1.0,
      },
    };

    let bestMatch = null;
    let bestScore = 0;

    for (const [soundType, config] of Object.entries(soundPatterns)) {
      const matchCount = config.patterns.filter(pattern =>
        lowerTranscript.includes(pattern)
      ).length;

      if (matchCount > 0) {
        // Calculate score based on pattern matches, confidence, and weight
        const score =
          (matchCount / config.patterns.length) * confidence * config.weight;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = soundType;
        }
      }
    }

    // Confidence-based classification
    if (bestMatch && bestScore > 0.2) {
      return bestMatch;
    }

    // If confidence is very low, classify as background noise
    if (confidence < this.config.confidenceThreshold) {
      return 'background_noise';
    }

    // Check for silence or very short transcripts
    if (lowerTranscript.length < 3) {
      return 'silence';
    }

    return 'unknown';
  }

  updateSoundClassification(soundType, confidence) {
    try {
      if (
        !soundType ||
        typeof soundType !== 'string' ||
        typeof confidence !== 'number'
      ) {
        console.warn(
          '[AmbientListeningService] Invalid parameters for sound classification update'
        );
        return;
      }

      const current = this.soundClassification.get(soundType) || {
        count: 0,
        totalConfidence: 0,
        lastDetected: null,
        firstDetected: new Date().toISOString(),
        highestConfidence: 0,
        lowestConfidence: 1,
      };

      current.count++;
      current.totalConfidence += confidence;
      current.lastDetected = new Date().toISOString();
      current.highestConfidence = Math.max(
        current.highestConfidence,
        confidence
      );
      current.lowestConfidence = Math.min(current.lowestConfidence, confidence);

      this.soundClassification.set(soundType, current);

      // Emit update event for real-time monitoring
      this.emit('classification-updated', {
        soundType,
        confidence,
        totalCount: current.count,
        averageConfidence: current.totalConfidence / current.count,
        timestamp: current.lastDetected,
      });
    } catch (error) {
      console.error(
        '[AmbientListeningService] Failed to update sound classification:',
        error
      );
    }
  }

  getAmbientProfile(detailed = false) {
    try {
      const profile = {
        timestamp: new Date().toISOString(),
        isActive: this.isActive,
        isAnalyzing: this.isAnalyzing,
        healthStatus: this.healthStatus,
        totalSoundTypes: this.soundClassification.size,
        soundTypes: {},
      };

      for (const [soundType, data] of this.soundClassification.entries()) {
        const soundProfile = {
          count: data.count,
          averageConfidence: Number(
            (data.totalConfidence / data.count).toFixed(3)
          ),
          lastDetected: data.lastDetected,
        };

        // Add detailed information if requested
        if (detailed) {
          soundProfile.firstDetected = data.firstDetected;
          soundProfile.highestConfidence = Number(
            data.highestConfidence.toFixed(3)
          );
          soundProfile.lowestConfidence = Number(
            data.lowestConfidence.toFixed(3)
          );
          soundProfile.confidenceRange = Number(
            (data.highestConfidence - data.lowestConfidence).toFixed(3)
          );
        }

        profile.soundTypes[soundType] = soundProfile;
      }

      // Sort sound types by frequency for better UX
      const sortedSoundTypes = Object.entries(profile.soundTypes)
        .sort(([, a], [, b]) => b.count - a.count)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      profile.soundTypes = sortedSoundTypes;
      profile.mostFrequentSound = Object.keys(sortedSoundTypes)[0] || null;

      return profile;
    } catch (error) {
      console.error(
        '[AmbientListeningService] Failed to generate ambient profile:',
        error
      );
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
        isActive: this.isActive,
      };
    }
  }

  clearAmbientProfile(reason = 'user_request') {
    try {
      const cleared = this.soundClassification.size;
      this.soundClassification.clear();

      this.emit('profile-cleared', {
        clearedCount: cleared,
        reason,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[AmbientListeningService] 🧹 Ambient profile cleared (${cleared} types, reason: ${reason})`
      );

      return {
        success: true,
        clearedCount: cleared,
        message: `Cleared ${cleared} sound classifications`,
      };
    } catch (error) {
      console.error(
        '[AmbientListeningService] Failed to clear ambient profile:',
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getStatus() {
    return {
      service: 'AmbientListeningService',
      initialized: this.initialized,
      isActive: this.isActive,
      isAnalyzing: this.isAnalyzing,
      healthStatus: this.healthStatus,
      soundTypesDetected: this.soundClassification.size,
      errorCount: this.errorCount,
      lastError: this.lastError,
      timestamp: new Date().toISOString(),
      uptime: this.initialized ? Date.now() - this.initTime : 0,
    };
  }

  getHealthStatus() {
    const now = Date.now();
    let status = 'healthy';
    const issues = [];

    // Check if service is initialized
    if (!this.initialized) {
      status = 'error';
      issues.push('Service not initialized');
    }

    // Check error rate
    if (this.errorCount > 10) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High error count: ${this.errorCount}`);
    }

    // Check if analysis is stuck
    if (
      this.isAnalyzing &&
      this.lastAnalysisStart &&
      now - this.lastAnalysisStart > this.config.analysisTimeoutMs * 2
    ) {
      status = 'warning';
      issues.push('Analysis may be stuck');
    }

    // Check DeepgramService dependency
    try {
      if (
        !DeepgramService ||
        typeof DeepgramService.startLiveTranscription !== 'function'
      ) {
        status = 'warning';
        issues.push('DeepgramService dependency issues');
      }
    } catch (error) {
      status = 'warning';
      issues.push('Cannot verify DeepgramService dependency');
    }

    return {
      status,
      issues,
      timestamp: new Date().toISOString(),
      lastError: this.lastError,
      errorCount: this.errorCount,
    };
  }

  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleError(error, context = 'unknown') {
    this.errorCount++;
    this.lastError = error.message;

    if (this.errorCount > 20) {
      this.healthStatus = 'critical';
      console.error(
        `[AmbientListeningService] ⚠️ Critical error count reached (${this.errorCount})`
      );
      this.emit('critical-error', {
        error: error.message,
        context,
        errorCount: this.errorCount,
      });
    }

    this.emit('error', {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Cleanup method
  async destroy() {
    try {
      console.log('[AmbientListeningService] 🔄 Destroying service...');

      // Stop listening
      await this.stopAmbientListening('service_destroy');

      // Clear intervals
      if (this.maintenanceInterval) {
        clearInterval(this.maintenanceInterval);
      }
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Clear data
      this.clearAmbientProfile('service_destroy');

      // Remove all listeners
      this.removeAllListeners();

      // Reset state
      this.initialized = false;
      this.healthStatus = 'destroyed';

      console.log(
        '[AmbientListeningService] ✅ Service destroyed successfully'
      );
    } catch (error) {
      console.error(
        '[AmbientListeningService] ❌ Error during destroy:',
        error
      );
    }
  }
}

export default new AmbientListeningService();
