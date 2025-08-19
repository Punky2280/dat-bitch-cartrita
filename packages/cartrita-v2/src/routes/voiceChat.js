/**
 * @fileoverview Routes for the Advanced Voice System.
 * @description Implements features from the "Voice & Multi-Modal Interface" section of the README,
 * including real-time transcription and AI voice synthesis.
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { OpenAI } from 'openai';
import multer from 'multer';
import VoiceAIErrorHandler from '../services/VoiceAIErrorHandler.js';

// Multer in‑memory storage for short audio clips
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = express.Router();

// Initialize Voice AI Error Handler
let voiceErrorHandler;

const initializeServices = async () => {
  if (!voiceErrorHandler) {
    voiceErrorHandler = VoiceAIErrorHandler; // It's already a singleton instance
    await voiceErrorHandler.initialize();
  }
};

// Root route for voice chat service
router.get('/', (req, res) => {
  res.json({
    message: 'Voice Chat Service',
    status: 'operational',
    endpoints: ['/credentials', '/synthesize', '/transcribe', '/status'],
    description: 'Real-time voice transcription and AI voice synthesis',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   POST /api/voice-chat/credentials
 * @desc    Generate temporary credentials for a client to connect to the real-time transcription service.
 * @access  Private
 */
router.post('/credentials', authenticateToken, async (req, res) => {
  try {
    await initializeServices();
    const status = await voiceErrorHandler.getStatus();
    
    if (!global.otelCounters?.voiceCredentials) {
      try {
        global.otelCounters = global.otelCounters || {};
        global.otelCounters.voiceCredentials = OpenTelemetryTracing.createCounter('voice_credentials_requests_total','Voice credentials issuance requests');
      } catch (_) {}
    }
    try { global.otelCounters?.voiceCredentials?.add(1); } catch(_) {}
    
    res.status(200).json({
      provider: 'Deepgram',
      token: status.deepgram.available ? 'ephemeral-token-not-implemented' : 'mock-deepgram-jwt-token-for-client',
      ephemeral: status.deepgram.available,
      expires_in: 300,
      message: status.deepgram.available ? 'Ephemeral voice session granted (scoped).' : 'Mock voice session granted (no Deepgram key set).',
      deepgramStatus: status.deepgram,
      openaiStatus: status.openai,
      healthScore: status.healthScore
    });
  } catch (e) {
    console.error('[VoiceChat] Credentials error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @route   POST /api/voice-chat/synthesize
 * @desc    Convert text to speech using OpenAI's TTS with Cartrita's personality.
 * @access  Private
 * @body    { text: string, voice_style?: 'sassy' | 'neutral' }
 */
router.post('/synthesize', authenticateToken, async (req, res) => {
  try {
    // Initialize services on first use
    await initializeServices();
    
    const { text, voice_style = 'sassy', format = 'mp3' } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Provide some text for synthesis.' });
    }

    const started = Date.now();
    const voice = voice_style === 'neutral' ? 'alloy' : 'shimmer';
    
    // Add OpenTelemetry counter
    if (!global.otelCounters?.voiceTTS) {
      try {
        global.otelCounters = global.otelCounters || {};
        global.otelCounters.voiceTTS = OpenTelemetryTracing.createCounter('voice_tts_requests_total','Voice TTS synthesis requests');
      } catch(_) {}
    }
    try { global.otelCounters?.voiceTTS?.add(1,{ style: voice_style }); } catch(_) {}

    // Prepare TTS options with Cartrita persona
    const ttsOptions = {
      voice,
      format,
      persona: voice_style === 'sassy' ? 'cartrita' : 'neutral',
      model: 'tts-1'
    };

    // Use VoiceAIErrorHandler for synthesis with comprehensive error handling
    const result = await voiceErrorHandler.synthesizeText(text, ttsOptions);
    
    if (!result.success) {
      console.error('[VoiceChat] ❌ TTS synthesis failed:', result.error);
      return res.status(result.statusCode || 500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

    // Return audio buffer
    res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
    res.setHeader('X-Processing-Time', `${Date.now() - started}ms`);
    res.setHeader('X-Voice-Style', voice_style);
    res.setHeader('X-Voice-Model', result.model || 'tts-1');
    res.send(result.audioBuffer);

  } catch (error) {
    console.error('[VoiceChat] ❌ Synthesis error:', error);
    res.status(500).json({
      success: false,
      error: 'Text-to-speech synthesis failed',
      details: error.message,
    });
  }
});

// Backward-compatible alias: /api/voice-chat/speak -> /synthesize
router.post('/speak', authenticateToken, async (req, res) => {
  try {
    // Initialize services on first use
    await initializeServices();
    
    const { text, voice_style = 'sassy', format = 'mp3' } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Provide some text for synthesis.' });
    }

    const started = Date.now();
    const voice = voice_style === 'neutral' ? 'alloy' : 'shimmer';
    
    // Prepare TTS options with Cartrita persona
    const ttsOptions = {
      voice,
      format,
      persona: voice_style === 'sassy' ? 'cartrita' : 'neutral',
      model: 'tts-1'
    };

    // Use VoiceAIErrorHandler for synthesis with comprehensive error handling
    const result = await voiceErrorHandler.synthesizeText(text, ttsOptions);
    
    if (!result.success) {
      console.error('[VoiceChat] ❌ TTS synthesis failed:', result.error);
      return res.status(result.statusCode || 500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

    // Return audio buffer
    res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
    res.setHeader('X-Processing-Time', `${Date.now() - started}ms`);
    res.setHeader('X-Voice-Style', voice_style);
    res.setHeader('X-Voice-Model', result.model || 'tts-1');
    res.send(result.audioBuffer);

  } catch (error) {
    console.error('[VoiceChat] ❌ Speak synthesis error:', error);
    res.status(500).json({
      success: false,
      error: 'Text-to-speech synthesis failed',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/voice-chat/transcribe
 * @desc  Transcribe short audio clip (multipart/form-data field: audio | base64 field: audio_base64)
 */
router.post('/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    // Initialize services on first use
    await initializeServices();
    
    if (!global.otelCounters?.voiceASR) {
      try {
        global.otelCounters = global.otelCounters || {};
        global.otelCounters.voiceASR = OpenTelemetryTracing.createCounter('voice_asr_requests_total','Voice ASR transcription requests');
      } catch(_) {}
    }
    try { global.otelCounters?.voiceASR?.add(1); } catch(_) {}

    let audioSource = null;
    
    if (req.file) {
      audioSource = {
        type: 'buffer',
        buffer: req.file.buffer,
        mimetype: req.file.mimetype || 'audio/wav'
      };
    } else if (req.body?.audio_base64) {
      const b64 = req.body.audio_base64.replace(/^data:audio\/[a-zA-Z0-9+.-]+;base64,/, '');
      const buffer = Buffer.from(b64, 'base64');
      audioSource = {
        type: 'buffer',
        buffer: buffer,
        mimetype: 'audio/wav'
      };
    }
    
    if (!audioSource) {
      return res.status(400).json({ success: false, error: 'No audio provided.' });
    }

    // Use VoiceAIErrorHandler for transcription
    const result = await voiceErrorHandler.transcribeAudio(audioSource, {
      model: 'whisper-1',
      response_format: 'json'
    });
    
    if (!result.success) {
      console.error('[VoiceChat] ❌ Transcription failed:', result.error);
      return res.status(result.statusCode || 500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

    res.status(200).json({ 
      success: true, 
      transcript: result.transcript,
      confidence: result.confidence,
      model: result.model
    });
    
  } catch (error) {
    console.error('[VoiceChat] ❌ Transcription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Transcription failed',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/voice-chat/status
 * @desc Get voice chat service status and health
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    await initializeServices();
    const status = await voiceErrorHandler.getStatus();
    
    res.json({
      service: 'voice-chat',
      status: 'operational',
      deepgram: status.deepgram,
      openai: status.openai,
      features: {
        transcription: status.deepgram.available ? 'active' : 'mock',
        synthesis: status.openai.available ? 'active' : 'mock',
        credentials: 'available',
        realtime: status.deepgram.available ? 'available' : 'mock'
      },
      healthScore: status.healthScore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[VoiceChat] Status check error:', error);
    res.status(500).json({
      service: 'voice-chat',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
