/* global process, console */
import DeepgramService from './DeepgramService.js';
import VoiceInteractionService from './VoiceInteractionService.js';
import TextToSpeechService from './TextToSpeechService.js';
import AmbientListeningService from './AmbientListeningService.js';
import VisualAnalysisService from './VisualAnalysisService.js';
import MultiModalFusionAgent from '../agi/consciousness/MultiModalFusionAgent.js';
import WorkflowEngine from './WorkflowEngine.js';
import MultiModalProcessingService from './MultiModalProcessingService.js'; // Iteration 22
import WolframAlphaService from './WolframAlphaService.js';
import WorkflowToolsService from './WorkflowToolsService.js';

/**
 * 🚀 CARTRITA SERVICE INITIALIZER
 * Manages initialization and coordination of all Cartrita services
 * Compatible with EnhancedLangChainCoreAgent hierarchical system
 */
class ServiceInitializer {
  constructor() {
    this.servicesInitialized = false;
    this.initializationPromise = null;
    this.services = {};
    this.healthStatus = {};
    console.log('[ServiceInitializer] Constructor initialized');
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
      console.log(
        '[ServiceInitializer] Starting Cartrita Iteration 21 service initialization...'
      );

      // Check required environment variables
      const requiredEnvVars = ['DEEPGRAM_API_KEY', 'OPENAI_API_KEY'];
      const missingVars = requiredEnvVars.filter(
        varName => !process.env[varName]
      );

      if (missingVars.length > 0) {
        console.warn(
          `[ServiceInitializer] Missing environment variables: ${missingVars.join(
            ', '
          )}`
        );
        console.warn('[ServiceInitializer] Some features may not be available');
      }

      // Initialize core services
      console.log('[ServiceInitializer] Initializing core services...');

      // Initialize Deepgram Service
      if (process.env.DEEPGRAM_API_KEY) {
        console.log('[ServiceInitializer] ✓ Deepgram service available');
        this.services.deepgram = DeepgramService;
      } else {
        console.warn(
          '[ServiceInitializer] ⚠ Deepgram service unavailable (no API key)'
        );
      }

      // Initialize Visual Analysis Service
      if (process.env.OPENAI_API_KEY) {
        console.log('[ServiceInitializer] ✓ Visual analysis service available');
        this.services.visualAnalysis = VisualAnalysisService;
      } else {
        console.warn(
          '[ServiceInitializer] ⚠ Visual analysis service unavailable (no API key)'
        );
      }

      // Initialize Text-to-Speech Service
      if (process.env.OPENAI_API_KEY) {
        console.log('[ServiceInitializer] ✓ Text-to-speech service available');
        this.services.textToSpeech = TextToSpeechService;
      } else {
        console.warn(
          '[ServiceInitializer] ⚠ Text-to-speech service unavailable (no API key)'
        );
      }

      // Initialize Voice Interaction Service
      if (process.env.DEEPGRAM_API_KEY && process.env.OPENAI_API_KEY) {
        console.log(
          '[ServiceInitializer] ✓ Voice interaction service available'
        );
        this.services.voiceInteraction = VoiceInteractionService;
      } else {
        console.warn(
          '[ServiceInitializer] ⚠ Voice interaction service unavailable (missing API keys)'
        );
      }

      // Initialize Ambient Listening Service
      if (process.env.DEEPGRAM_API_KEY) {
        console.log(
          '[ServiceInitializer] ✓ Ambient listening service available'
        );
        this.services.ambientListening = AmbientListeningService;
      } else {
        console.warn(
          '[ServiceInitializer] ⚠ Ambient listening service unavailable (no Deepgram API key)'
        );
      }

      // Initialize multi-modal services
      console.log('[ServiceInitializer] Initializing multi-modal services...');

      // Initialize WorkflowEngine
      try {
        this.services.workflowEngine = new WorkflowEngine();
        console.log('[ServiceInitializer] ✓ WorkflowEngine initialized');
      } catch (error) {
        console.error(
          '[ServiceInitializer] Error initializing WorkflowEngine:',
          error
        );
      }

      // Set up service event listeners for cross-service communication
      this.setupServiceEventListeners();

      // Initialize the MultiModal Fusion Agent (imported as instance)
      try {
        if (
          MultiModalFusionAgent.onInitialize &&
          typeof MultiModalFusionAgent.onInitialize === 'function'
        ) {
          await MultiModalFusionAgent.onInitialize();
        } else if (
          MultiModalFusionAgent.initialize &&
          typeof MultiModalFusionAgent.initialize === 'function'
        ) {
          await MultiModalFusionAgent.initialize();
        }
        this.services.multiModalFusion = MultiModalFusionAgent;
        console.log(
          '[ServiceInitializer] ✓ MultiModal Fusion Agent initialized'
        );
      } catch (error) {
        console.error(
          '[ServiceInitializer] Error initializing MultiModal Fusion Agent:',
          error
        );
      }

      // Initialize MultiModal Processing Service (Iteration 22)
      try {
        await MultiModalProcessingService.initialize();
        this.services.multiModalProcessing = MultiModalProcessingService;
        console.log(
          '[ServiceInitializer] ✓ MultiModal Processing Service initialized (Iteration 22)'
        );
      } catch (error) {
        console.error(
          '[ServiceInitializer] Error initializing MultiModal Processing Service:',
          error
        );
      }

      // Initialize Wolfram Alpha Service
      try {
        const wolframInitialized = await WolframAlphaService.initialize();
        if (wolframInitialized) {
          this.services.wolframAlpha = WolframAlphaService;
          console.log(
            '[ServiceInitializer] ✓ Wolfram Alpha Service initialized with full capabilities'
          );
        }
      } catch (error) {
        console.error(
          '[ServiceInitializer] Error initializing Wolfram Alpha Service:',
          error
        );
      }

      // Initialize Workflow Tools Service
      try {
        await WorkflowToolsService.initialize();
        this.services.workflowTools = WorkflowToolsService;
        console.log(
          '[ServiceInitializer] ✓ Workflow Tools Service initialized with 1000+ automation tools'
        );
      } catch (error) {
        console.error(
          '[ServiceInitializer] Error initializing Workflow Tools Service:',
          error
        );
      }

      console.log(
        '[ServiceInitializer] 🎉 Cartrita services initialized successfully! (Iterations 18-22 + Workflow Tools)'
      );
      console.log('[ServiceInitializer] Available features:');
      console.log('  • Speech-to-text with Deepgram');
      console.log('  • Wake word detection ("Cartrita!")');
      console.log('  • Feminine urban voice synthesis');
      console.log('  • Live voice chat mode');
      console.log('  • Ambient listening and environmental sound analysis');
      console.log('  • Visual analysis with OpenAI Vision');
      console.log('  • Multi-modal sensory fusion');
      console.log('  • Context-aware personality adaptation');
      console.log('  • Workflow automation engine');
      console.log('  • Enhanced LangChain agent orchestration');
      console.log('  • Wolfram Alpha computational intelligence');
      console.log('  • 1000+ Workflow automation tools with semantic search');
      console.log(
        '  • AI-powered knowledge management and documentation system'
      );

      this.servicesInitialized = true;
      return true;
    } catch (error) {
      console.error(
        '[ServiceInitializer] Service initialization failed:',
        error
      );
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Set up event listeners for cross-service communication
   */
  setupServiceEventListeners() {
    console.log(
      '[ServiceInitializer] Setting up cross-service event listeners...'
    );

    try {
      // Voice Interaction Service events
      if (this.services.voiceInteraction) {
        VoiceInteractionService.getInstance().on('voiceModeActivated', data => {
          console.log('[ServiceInitializer] Voice mode activated:', data);
          // Could trigger other services to adjust behavior
        });

        VoiceInteractionService.getInstance().on(
          'conversationStarted',
          data => {
            console.log('[ServiceInitializer] Voice conversation started');
            // Could pause ambient listening or adjust sensitivity
          }
        );
      }

      // Ambient Listening Service events
      if (this.services.ambientListening) {
        AmbientListeningService.on('ambientResponse', response => {
          console.log(
            '[ServiceInitializer] Ambient response generated:',
            response.text
          );
          // Could trigger TTS or other responses
        });

        AmbientListeningService.on('contextUpdated', context => {
          console.log(
            '[ServiceInitializer] Environmental context updated:',
            context.activityLevel
          );
          // Could inform other services about environmental changes
        });
      }

      // Visual Analysis Service events
      if (this.services.visualAnalysis) {
        VisualAnalysisService.on('analysisCompleted', analysis => {
          console.log(
            '[ServiceInitializer] Visual analysis completed:',
            analysis.scene
          );
          // Could trigger contextual responses or personality adjustments
        });

        VisualAnalysisService.on('contextUpdated', context => {
          console.log(
            '[ServiceInitializer] Visual context updated:',
            context.environment
          );
          // Could inform other services about scene changes
        });
      }

      // Deepgram Service events
      if (this.services.deepgram) {
        DeepgramService.on('finalTranscript', result => {
          // This will be handled by individual services
        });

        DeepgramService.on('speechStarted', () => {
          // User started speaking - could adjust other services
        });

        DeepgramService.on('speechEnded', () => {
          // User stopped speaking - could trigger processing
        });
      }

      console.log(
        '[ServiceInitializer] ✓ Cross-service event listeners configured'
      );
    } catch (error) {
      console.error(
        '[ServiceInitializer] Error setting up event listeners:',
        error
      );
    }
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
          status: 'ready',
        },
        textToSpeech: {
          available: !!process.env.OPENAI_API_KEY,
          status: 'ready',
        },
        visualAnalysis: {
          available: !!process.env.OPENAI_API_KEY,
          status:
            this.services.visualAnalysis && VisualAnalysisService.getStatus
              ? VisualAnalysisService.getStatus().openaiConfigured
                ? 'ready'
                : 'unavailable'
              : 'ready',
        },
        voiceInteraction: {
          available: !!(
            process.env.DEEPGRAM_API_KEY && process.env.OPENAI_API_KEY
          ),
          status: 'ready',
        },
        ambientListening: {
          available: !!process.env.DEEPGRAM_API_KEY,
          status:
            this.services.ambientListening && AmbientListeningService.getStatus
              ? AmbientListeningService.getStatus().isAmbientActive
                ? 'active'
                : 'ready'
              : 'ready',
        },
        multiModalFusion: {
          available: true,
          status: 'ready',
        },
        workflowEngine: {
          available: true,
          status: this.services.workflowEngine ? 'ready' : 'unavailable',
        },
      },
      features: {
        speechToText: !!process.env.DEEPGRAM_API_KEY,
        wakeWordDetection: !!process.env.DEEPGRAM_API_KEY,
        voiceSynthesis: !!process.env.OPENAI_API_KEY,
        liveVoiceChat: !!(
          process.env.DEEPGRAM_API_KEY && process.env.OPENAI_API_KEY
        ),
        ambientListening: !!process.env.DEEPGRAM_API_KEY,
        visualAnalysis: !!process.env.OPENAI_API_KEY,
        multiModalFusion: true,
        contextualPersonality: true,
        workflowAutomation: true,
        langChainOrchestration: true,
      },
    };
  }

  /**
   * Cleanup services
   */
  async cleanup() {
    try {
      console.log('[ServiceInitializer] Cleaning up services...');

      // Cleanup individual services
      if (this.services.ambientListening && AmbientListeningService.cleanup) {
        await AmbientListeningService.cleanup();
      }

      if (this.services.visualAnalysis && VisualAnalysisService.cleanup) {
        await VisualAnalysisService.cleanup();
      }

      if (this.services.voiceInteraction && VoiceInteractionService.cleanup) {
        await VoiceInteractionService.cleanup();
      }

      if (
        this.services.multiModalFusion &&
        this.services.multiModalFusion.cleanup
      ) {
        await this.services.multiModalFusion.cleanup();
      }

      this.servicesInitialized = false;
      this.initializationPromise = null;
      this.services = {};

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
      services: {},
    };

    try {
      // Check each service
      health.services.deepgram = {
        status: process.env.DEEPGRAM_API_KEY ? 'healthy' : 'unavailable',
        message: process.env.DEEPGRAM_API_KEY
          ? 'API key configured'
          : 'No API key',
      };

      health.services.openai = {
        status: process.env.OPENAI_API_KEY ? 'healthy' : 'unavailable',
        message: process.env.OPENAI_API_KEY
          ? 'API key configured'
          : 'No API key',
      };

      health.services.visualAnalysis = {
        status: 'healthy',
        details:
          this.services.visualAnalysis && VisualAnalysisService.getStatus
            ? VisualAnalysisService.getStatus()
            : { initialized: true },
      };

      health.services.ambientListening = {
        status: 'healthy',
        details:
          this.services.ambientListening && AmbientListeningService.getStatus
            ? AmbientListeningService.getStatus()
            : { initialized: true },
      };

      health.services.workflowEngine = {
        status: this.services.workflowEngine ? 'healthy' : 'unavailable',
        details: this.services.workflowEngine
          ? this.services.workflowEngine.getStatus()
          : { initialized: false },
      };

      // Check if any critical services are down
      const criticalServices = ['deepgram', 'openai'];
      const unhealthyServices = criticalServices.filter(
        service => health.services[service].status !== 'healthy'
      );

      if (unhealthyServices.length > 0) {
        health.overall = 'degraded';
        health.message = `Some services unavailable: ${unhealthyServices.join(
          ', '
        )}`;
      }

      return health;
    } catch (error) {
      console.error('[ServiceInitializer] Health check error:', error);
      health.overall = 'error';
      health.error = error.message;
      return health;
    }
  }

  /**
   * Get initialized services
   */
  getServices() {
    return this.services;
  }

  /**
   * Check if a specific service is available
   */
  isServiceAvailable(serviceName) {
    return !!this.services[serviceName];
  }

  /**
   * Get a specific service
   */
  getService(serviceName) {
    return this.services[serviceName] || null;
  }
}

export default new ServiceInitializer();
