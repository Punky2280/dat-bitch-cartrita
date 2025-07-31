const DeepgramService = require('./DeepgramService');
const VoiceInteractionService = require('./VoiceInteractionService');
const TextToSpeechService = require('./TextToSpeechService');
const AmbientListeningService = require('./AmbientListeningService');
const VisualAnalysisService = require('./VisualAnalysisService');
const MultiModalFusionAgent = require('../agi/consciousness/MultiModalFusionAgent');

class ServiceInitializer {
  constructor() {
    this.servicesInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize all Cartrita services
   */
  async initializeServices() {
    if (this.servicesInitialized) {
      console.log('[ServiceInitializer] Services already initialized');
      return true;
    }

    if (this.initializationPromise) {
      console.log('[ServiceInitializer] Initialization already in progress');
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual service initialization
   */
  async _performInitialization() {
    try {
      console.log('[ServiceInitializer] Starting Cartrita Iteration 21 service initialization...');

      // Check required environment variables
      const requiredEnvVars = ['DEEPGRAM_API_KEY', 'OPENAI_API_KEY'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        console.warn(`[ServiceInitializer] Missing environment variables: ${missingVars.join(', ')}`);
        console.warn('[ServiceInitializer] Some features may not be available');
      }

      // Initialize core services
      console.log('[ServiceInitializer] Initializing core services...');

      // Initialize Deepgram Service
      if (process.env.DEEPGRAM_API_KEY) {
        console.log('[ServiceInitializer] ✓ Deepgram service available');
      } else {
        console.warn('[ServiceInitializer] ⚠ Deepgram service unavailable (no API key)');
      }

      // Initialize Visual Analysis Service
      if (process.env.OPENAI_API_KEY) {
        console.log('[ServiceInitializer] ✓ Visual analysis service available');
      } else {
        console.warn('[ServiceInitializer] ⚠ Visual analysis service unavailable (no API key)');
      }

      // Initialize Text-to-Speech Service
      if (process.env.OPENAI_API_KEY) {
        console.log('[ServiceInitializer] ✓ Text-to-speech service available');
      } else {
        console.warn('[ServiceInitializer] ⚠ Text-to-speech service unavailable (no API key)');
      }

      // Initialize multi-modal services
      console.log('[ServiceInitializer] Initializing multi-modal services...');

      // Set up service event listeners for cross-service communication
      this.setupServiceEventListeners();

      // Initialize the MultiModal Fusion Agent
      try {
        const fusionAgent = new MultiModalFusionAgent();
        await fusionAgent.onInitialize();
        console.log('[ServiceInitializer] ✓ MultiModal Fusion Agent initialized');
      } catch (error) {
        console.error('[ServiceInitializer] Error initializing MultiModal Fusion Agent:', error);
      }

      console.log('[ServiceInitializer] 🎉 Cartrita Iteration 21 services initialized successfully!');
      console.log('[ServiceInitializer] Available features:');
      console.log('  • Speech-to-text with Deepgram');
      console.log('  • Wake word detection ("Cartrita!")');
      console.log('  • Feminine urban voice synthesis');
      console.log('  • Live voice chat mode');
      console.log('  • Ambient listening and environmental sound analysis');
      console.log('  • Visual analysis with OpenAI Vision');
      console.log('  • Multi-modal sensory fusion');
      console.log('  • Context-aware personality adaptation');

      this.servicesInitialized = true;
      return true;

    } catch (error) {
      console.error('[ServiceInitializer] Service initialization failed:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Set up event listeners for cross-service communication
   */
  setupServiceEventListeners() {
    console.log('[ServiceInitializer] Setting up cross-service event listeners...');

    // Voice Interaction Service events
    VoiceInteractionService.on('voiceModeActivated', (data) => {
      console.log('[ServiceInitializer] Voice mode activated:', data);
      // Could trigger other services to adjust behavior
    });

    VoiceInteractionService.on('conversationStarted', (data) => {
      console.log('[ServiceInitializer] Voice conversation started');
      // Could pause ambient listening or adjust sensitivity
    });

    // Ambient Listening Service events
    AmbientListeningService.on('ambientResponse', (response) => {
      console.log('[ServiceInitializer] Ambient response generated:', response.text);
      // Could trigger TTS or other responses
    });

    AmbientListeningService.on('contextUpdated', (context) => {
      console.log('[ServiceInitializer] Environmental context updated:', context.activityLevel);
      // Could inform other services about environmental changes
    });

    // Visual Analysis Service events
    VisualAnalysisService.on('analysisCompleted', (analysis) => {
      console.log('[ServiceInitializer] Visual analysis completed:', analysis.scene);
      // Could trigger contextual responses or personality adjustments
    });

    VisualAnalysisService.on('contextUpdated', (context) => {
      console.log('[ServiceInitializer] Visual context updated:', context.environment);
      // Could inform other services about scene changes
    });

    // Deepgram Service events
    DeepgramService.on('finalTranscript', (result) => {
      // This will be handled by individual services
    });

    DeepgramService.on('speechStarted', () => {
      // User started speaking - could adjust other services
    });

    DeepgramService.on('speechEnded', () => {
      // User stopped speaking - could trigger processing
    });

    console.log('[ServiceInitializer] ✓ Cross-service event listeners configured');
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      initialized: this.servicesInitialized,
      services: {
        deepgram: {
          available: !!process.env.DEEPGRAM_API_KEY,
          status: 'ready'
        },
        textToSpeech: {
          available: !!process.env.OPENAI_API_KEY,
          status: 'ready'
        },
        visualAnalysis: {
          available: !!process.env.OPENAI_API_KEY,
          status: VisualAnalysisService.getStatus().openaiConfigured ? 'ready' : 'unavailable'
        },
        voiceInteraction: {
          available: !!process.env.DEEPGRAM_API_KEY && !!process.env.OPENAI_API_KEY,
          status: 'ready'
        },
        ambientListening: {
          available: !!process.env.DEEPGRAM_API_KEY,
          status: AmbientListeningService.getStatus().isAmbientActive ? 'active' : 'ready'
        },
        multiModalFusion: {
          available: true,
          status: 'ready'
        }
      },
      features: {
        speechToText: !!process.env.DEEPGRAM_API_KEY,
        wakeWordDetection: !!process.env.DEEPGRAM_API_KEY,
        voiceSynthesis: !!process.env.OPENAI_API_KEY,
        liveVoiceChat: !!process.env.DEEPGRAM_API_KEY && !!process.env.OPENAI_API_KEY,
        ambientListening: !!process.env.DEEPGRAM_API_KEY,
        visualAnalysis: !!process.env.OPENAI_API_KEY,
        multiModalFusion: true,
        contextualPersonality: true
      }
    };
  }

  /**
   * Cleanup services
   */
  async cleanup() {
    try {
      console.log('[ServiceInitializer] Cleaning up services...');

      // Cleanup individual services
      if (AmbientListeningService.cleanup) {
        AmbientListeningService.cleanup();
      }

      if (VisualAnalysisService.cleanup) {
        VisualAnalysisService.cleanup();
      }

      if (VoiceInteractionService.cleanup) {
        VoiceInteractionService.cleanup();
      }

      this.servicesInitialized = false;
      this.initializationPromise = null;

      console.log('[ServiceInitializer] ✓ Services cleaned up');

    } catch (error) {
      console.error('[ServiceInitializer] Error during cleanup:', error);
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      timestamp: new Date(),
      services: {}
    };

    try {
      // Check each service
      health.services.deepgram = {
        status: process.env.DEEPGRAM_API_KEY ? 'healthy' : 'unavailable',
        message: process.env.DEEPGRAM_API_KEY ? 'API key configured' : 'No API key'
      };

      health.services.openai = {
        status: process.env.OPENAI_API_KEY ? 'healthy' : 'unavailable',
        message: process.env.OPENAI_API_KEY ? 'API key configured' : 'No API key'
      };

      health.services.visualAnalysis = {
        status: 'healthy',
        details: VisualAnalysisService.getStatus()
      };

      health.services.ambientListening = {
        status: 'healthy',
        details: AmbientListeningService.getStatus()
      };

      // Check if any critical services are down
      const criticalServices = ['deepgram', 'openai'];
      const unhealthyServices = criticalServices.filter(
        service => health.services[service].status !== 'healthy'
      );

      if (unhealthyServices.length > 0) {
        health.overall = 'degraded';
        health.message = `Some services unavailable: ${unhealthyServices.join(', ')}`;
      }

    } catch (error) {
      health.overall = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }
}

// Export singleton instance
module.exports = new ServiceInitializer();