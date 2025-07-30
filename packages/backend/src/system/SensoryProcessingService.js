// packages/backend/src/system/SensoryProcessingService.js
const { createClient } = require('@deepgram/sdk');

/**
 * The SensoryProcessingService handles real-time sensory data streams.
 */
class SensoryProcessingService {
  constructor(coreAgent) {
    if (!process.env.DEEPGRAM_API_KEY) {
      console.warn(
        '[SensoryService] DEEPGRAM_API_KEY not found. Ambient listening is disabled.'
      );
      this.deepgram = null;
    } else {
      this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    }

    this.coreAgent = coreAgent;
    this.connections = new Map();
    this.frameBuffer = new Map(); // Store recent frames for analysis
    this.analysisQueue = new Map(); // Queue for processing video frames

    console.log(
      '[SensoryService] Initialized with audio and video processing capabilities.'
    );
  }

  handleConnection(socket) {
    const { audioEnabled, videoEnabled, privacyMode } = socket.handshake.query;

    console.log(
      `[SensoryService] New ambient connection for user: ${socket.user.name}`,
      {
        audio: audioEnabled === 'true',
        video: videoEnabled === 'true',
        privacy: privacyMode,
      }
    );

    const connectionData = {
      user: socket.user,
      audioEnabled: audioEnabled === 'true',
      videoEnabled: videoEnabled === 'true',
      privacyMode: privacyMode || 'standard',
      deepgramConnection: null,
      lastVideoAnalysis: 0,
    };

    // Setup audio processing if enabled
    if (connectionData.audioEnabled && this.deepgram) {
      this.setupAudioProcessing(socket, connectionData);
    }

    // Setup video processing if enabled
    if (connectionData.videoEnabled) {
      this.setupVideoProcessing(socket, connectionData);
    }

    socket.on('disconnect', () => {
      console.log(
        `[SensoryService] Ambient socket disconnected for user: ${socket.user.name}`
      );
      this.cleanupConnection(socket.id);
    });

    this.connections.set(socket.id, connectionData);
  }

  setupAudioProcessing(socket, connectionData) {
    const deepgramConnection = this.deepgram.listen.live({
      model: 'nova-2',
      smart_format: true,
      interim_results: false,
      endpointing: 300,
    });

    deepgramConnection.on('open', () => {
      console.log(
        `[SensoryService] Deepgram connection opened for user: ${connectionData.user.name}`
      );

      deepgramConnection.on('transcript', data => {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript) {
          console.log(`[SensoryService] Transcript received: "${transcript}"`);
          this.coreAgent.handleAmbientTranscript(
            transcript,
            connectionData.user
          );
        }
      });

      deepgramConnection.on('error', error => {
        console.error('[SensoryService] Deepgram error:', error);
      });

      deepgramConnection.on('close', () => {
        console.log(
          `[SensoryService] Deepgram connection closed for user: ${connectionData.user.name}`
        );
      });
    });

    socket.on('audio_stream', audioData => {
      if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
        deepgramConnection.send(audioData);
      }
    });

    connectionData.deepgramConnection = deepgramConnection;
  }

  setupVideoProcessing(socket, connectionData) {
    console.log(
      `[SensoryService] Setting up video processing for user: ${connectionData.user.name}`
    );

    socket.on('video_frame', async frameData => {
      try {
        // Rate limiting: process frames at most every 5 seconds for privacy and performance
        const now = Date.now();
        if (now - connectionData.lastVideoAnalysis < 5000) {
          return;
        }

        connectionData.lastVideoAnalysis = now;

        // Process the video frame
        const analysisResult = await this.analyzeVideoFrame(
          frameData,
          connectionData
        );

        if (analysisResult) {
          // Send to CoreAgent for potential proactive response
          this.coreAgent.handleVideoFrame(analysisResult, connectionData.user);
        }
      } catch (error) {
        console.error('[SensoryService] Video frame processing error:', error);
      }
    });
  }

  async analyzeVideoFrame(frameData, connectionData) {
    try {
      // For privacy, we'll do basic scene analysis without storing the image
      const analysis = await this.processVideoFrame(
        frameData,
        connectionData.privacyMode
      );

      console.log(
        `[SensoryService] Video analysis for ${connectionData.user.name}:`,
        analysis.scene
      );

      return analysis;
    } catch (error) {
      console.error('[SensoryService] Video analysis error:', error);
      return null;
    }
  }

  async processVideoFrame(frameData, privacyMode) {
    // For now, we'll create a mock analysis
    // In production, this would use OpenAI Vision API or similar
    const mockAnalysis = {
      scene: this.generateMockSceneDescription(),
      objects: ['person', 'computer', 'desk'],
      activities: ['working', 'typing'],
      mood: 'focused',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      privacyMode,
    };

    return mockAnalysis;
  }

  generateMockSceneDescription() {
    const scenes = [
      'Person working at a computer desk',
      'Someone reading documents',
      'Individual typing on a keyboard',
      'Person in a video call',
      'Someone taking notes',
      'Individual looking at multiple monitors',
    ];

    return scenes[Math.floor(Math.random() * scenes.length)];
  }

  cleanupConnection(socketId) {
    const connectionData = this.connections.get(socketId);
    if (connectionData) {
      if (connectionData.deepgramConnection) {
        connectionData.deepgramConnection.finish();
      }
      this.connections.delete(socketId);
    }
  }
}

// FIXED: Export the class itself, not an instance.
module.exports = SensoryProcessingService;
