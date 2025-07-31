const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/authenticateToken');
const DeepgramService = require('../services/DeepgramService');
const TextToSpeechService = require('../services/TextToSpeechService');
const VoiceInteractionService = require('../services/VoiceInteractionService');

const router = express.Router();

// Public endpoint for testing - no authentication required
router.get('/test', (req, res) => {
  res.json({
    message: 'Voice chat API is working!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /transcribe - Transcribe audio to text',
      'POST /generate-speech - Generate speech from text', 
      'POST /conversation - Full voice conversation',
      'GET /status - Get service status (auth required)',
      'POST /start-session - Start voice session (auth required)',
      'POST /stop-session - Stop voice session (auth required)'
    ]
  });
});

// Configure multer for handling audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max for longer recordings
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

/**
 * POST /api/voice-chat/transcribe
 * Enhanced transcribe audio with wake word detection
 */
router.post('/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
      });
    }

    console.log(`[VoiceChat] Processing audio for user: ${req.user.name}`);

    const options = {
      model: req.body.model || 'nova-2',
      language: req.body.language || 'en-US',
      smart_format: true,
      punctuate: true,
      diarize: false,
      filler_words: false,
      utterances: true
    };

    const result = await DeepgramService.transcribeFile(req.file.buffer, options);

    if (!result.transcript) {
      return res.status(422).json({
        error: 'No speech detected in audio',
      });
    }

    // Check for wake word
    const wakeWordResult = DeepgramService.detectWakeWord(result.transcript);

    console.log(`[VoiceChat] Transcription successful: "${result.transcript.substring(0, 50)}..."`);

    res.json({
      transcript: result.transcript,
      confidence: result.confidence,
      language: result.language,
      words: result.words,
      wakeWord: wakeWordResult,
      metadata: {
        processingTime: Date.now(),
        audioLength: req.file.buffer.length,
        model: options.model
      }
    });

  } catch (error) {
    console.error('[VoiceChat] Transcription error:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error.message
    });
  }
});

/**
 * POST /api/voice-chat/speak
 * Generate speech from text with Cartrita's voice
 */
router.post('/speak', authenticateToken, async (req, res) => {
  try {
    const { text, emotion = 'friendly', voice = 'nova', speed = 1.0 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'No text provided for speech generation'
      });
    }

    console.log(`[VoiceChat] Generating speech for user: ${req.user.name}`);

    const speechResult = await TextToSpeechService.generateEmotionalSpeech(text, emotion, {
      voice: voice,
      speed: speed
    });

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': speechResult.audioBuffer.length,
      'X-Audio-Duration': speechResult.duration,
      'X-Text-Original': text,
      'X-Voice-Emotion': emotion
    });

    res.send(speechResult.audioBuffer);

  } catch (error) {
    console.error('[VoiceChat] Speech generation error:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      details: error.message
    });
  }
});

/**
 * POST /api/voice-chat/conversation
 * Process voice input and get conversational response
 */
router.post('/conversation', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
      });
    }

    const { context, emotion = 'friendly' } = req.body;
    
    console.log(`[VoiceChat] Processing conversation for user: ${req.user.name}`);

    // Transcribe the audio
    const transcriptionResult = await DeepgramService.transcribeFile(req.file.buffer);

    if (!transcriptionResult.transcript) {
      return res.status(422).json({
        error: 'No speech detected in audio',
      });
    }

    // Get AI response (this would integrate with your agent system)
    const aiResponse = await generateConversationalResponse(
      transcriptionResult.transcript,
      req.user.id,
      context
    );

    // Generate speech response
    const speechResult = await TextToSpeechService.generateConversationalResponse(
      aiResponse.text,
      aiResponse.emotion || emotion
    );

    res.json({
      transcript: transcriptionResult.transcript,
      transcriptionConfidence: transcriptionResult.confidence,
      response: {
        text: aiResponse.text,
        emotion: aiResponse.emotion,
        audioBuffer: speechResult.audioBuffer.toString('base64'),
        audioDuration: speechResult.duration,
        audioFormat: speechResult.format
      },
      conversation: {
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        sessionActive: true
      }
    });

  } catch (error) {
    console.error('[VoiceChat] Conversation error:', error);
    res.status(500).json({
      error: 'Failed to process conversation',
      details: error.message
    });
  }
});

/**
 * POST /api/voice-chat/start-session
 * Start voice interaction session
 */
router.post('/start-session', authenticateToken, async (req, res) => {
  try {
    const { settings = {} } = req.body;
    
    console.log(`[VoiceChat] Starting voice session for user: ${req.user.name}`);

    const sessionStarted = await VoiceInteractionService.startVoiceSession(req.user.id, settings);

    if (!sessionStarted) {
      return res.status(409).json({
        error: 'Voice session already active or failed to start'
      });
    }

    const status = VoiceInteractionService.getStatus();

    res.json({
      sessionStarted: true,
      status: status,
      message: 'Voice session started successfully'
    });

  } catch (error) {
    console.error('[VoiceChat] Session start error:', error);
    res.status(500).json({
      error: 'Failed to start voice session',
      details: error.message
    });
  }
});

/**
 * POST /api/voice-chat/stop-session
 * Stop voice interaction session
 */
router.post('/stop-session', authenticateToken, async (req, res) => {
  try {
    console.log(`[VoiceChat] Stopping voice session for user: ${req.user.name}`);

    const sessionStopped = await VoiceInteractionService.stopVoiceSession();

    res.json({
      sessionStopped: sessionStopped,
      message: sessionStopped ? 'Voice session stopped successfully' : 'No active session to stop'
    });

  } catch (error) {
    console.error('[VoiceChat] Session stop error:', error);
    res.status(500).json({
      error: 'Failed to stop voice session',
      details: error.message
    });
  }
});

/**
 * GET /api/voice-chat/status
 * Get voice interaction service status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = VoiceInteractionService.getStatus();
    const history = VoiceInteractionService.getInteractionHistory();

    res.json({
      status: status,
      history: history,
      services: {
        deepgram: DeepgramService.getStatus(),
        textToSpeech: TextToSpeechService.getStatus()
      }
    });

  } catch (error) {
    console.error('[VoiceChat] Status error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error.message
    });
  }
});

/**
 * POST /api/voice-chat/test-services
 * Test all voice services
 */
router.post('/test-services', authenticateToken, async (req, res) => {
  try {
    console.log(`[VoiceChat] Testing services for user: ${req.user.name}`);

    const tests = {
      deepgram: await DeepgramService.testConnection(),
      textToSpeech: await TextToSpeechService.testService()
    };

    const allPassed = Object.values(tests).every(test => test.success);

    res.json({
      allServicesPassed: allPassed,
      tests: tests,
      message: allPassed ? 'All services are working correctly' : 'Some services have issues'
    });

  } catch (error) {
    console.error('[VoiceChat] Service test error:', error);
    res.status(500).json({
      error: 'Failed to test services',
      details: error.message
    });
  }
});

/**
 * GET /api/voice-chat/websocket-token
 * Get enhanced WebSocket token for real-time voice interaction
 */
router.get('/websocket-token', authenticateToken, async (req, res) => {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(503).json({
        error: 'Voice service is not configured',
      });
    }

    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: req.user.id,
        userName: req.user.name,
        timestamp: Date.now(),
        key: process.env.DEEPGRAM_API_KEY,
        capabilities: ['transcription', 'wake_word', 'live_chat']
      })
    ).toString('base64');

    res.json({
      token: sessionToken,
      expiresIn: 3600, // 1 hour
      capabilities: ['real_time_transcription', 'wake_word_detection', 'voice_responses'],
      websocketUrl: '/voice-stream' // Would be used for WebSocket connection
    });

  } catch (error) {
    console.error('[VoiceChat] Token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate WebSocket token',
    });
  }
});

/**
 * Helper function to generate conversational response
 * In full implementation, this would integrate with your agent system
 */
async function generateConversationalResponse(input, userId, context) {
  // This is a placeholder - in the full implementation, this would:
  // 1. Send the input to your agent system
  // 2. Get a response from the appropriate agent
  // 3. Return the response with appropriate emotion

  const lowerInput = input.toLowerCase();
  
  // Handle greetings
  if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    return {
      text: "Hey there! Great to hear your voice! What can I help you with today?",
      emotion: 'friendly'
    };
  }
  
  // Handle questions about capabilities
  if (lowerInput.includes('what can you do') || lowerInput.includes('help me')) {
    return {
      text: "I can help you with tons of stuff! I can answer questions, help with tasks, have conversations, and even just chat! What are you interested in?",
      emotion: 'excited'
    };
  }
  
  // Handle compliments
  if (lowerInput.includes('beautiful') || lowerInput.includes('amazing') || lowerInput.includes('great')) {
    return {
      text: "Aww, thank you so much! You're so sweet! That really made my day!",
      emotion: 'excited'
    };
  }
  
  // Handle questions about herself
  if (lowerInput.includes('who are you') || lowerInput.includes('your name')) {
    return {
      text: "I'm Cartrita! I'm your AI assistant and I'm here to help make your day better! I love chatting and helping out however I can!",
      emotion: 'friendly'
    };
  }
  
  // Default friendly response
  return {
    text: "That's really interesting! I love talking about this stuff. Tell me more - what specifically would you like to know or do?",
    emotion: 'friendly'
  };
}

module.exports = router;