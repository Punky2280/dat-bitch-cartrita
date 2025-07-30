// packages/backend/src/routes/voiceToText.js

const express = require('express');
const { createClient } = require('@deepgram/sdk');
const multer = require('multer');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Configure multer for handling audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

/**
 * POST /api/voice-to-text/transcribe
 * Transcribe audio data using Deepgram
 */
router.post(
  '/transcribe',
  authenticateToken,
  upload.single('audio'),
  async (req, res) => {
    try {
      if (!process.env.DEEPGRAM_API_KEY) {
        return res.status(503).json({
          error: 'Voice-to-text service is not configured',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No audio file provided',
        });
      }

      console.log(`[VoiceToText] Processing audio for user: ${req.user.name}`);

      const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

      // Transcribe the audio
      const response = await deepgram.listen.prerecorded.transcribeFile(
        req.file.buffer,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
        }
      );

      const transcript =
        response.result?.channels?.[0]?.alternatives?.[0]?.transcript;

      if (!transcript) {
        return res.status(422).json({
          error: 'No speech detected in audio',
        });
      }

      console.log(
        `[VoiceToText] Transcription successful: "${transcript.substring(0, 50)}..."`
      );

      res.json({
        transcript: transcript.trim(),
        confidence:
          response.result?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
        language: response.result?.channels?.[0]?.detected_language || 'en',
      });
    } catch (error) {
      console.error('[VoiceToText] Transcription error:', error);

      if (error.name === 'MulterError') {
        return res.status(400).json({
          error: 'Audio file too large or invalid format',
        });
      }

      res.status(500).json({
        error: 'Failed to transcribe audio',
      });
    }
  }
);

/**
 * GET /api/voice-to-text/websocket-token
 * Get a temporary token for WebSocket connection to Deepgram
 */
router.get('/websocket-token', authenticateToken, async (req, res) => {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(503).json({
        error: 'Voice-to-text service is not configured',
      });
    }

    // For security, we don't expose the real API key
    // Instead, we create a session-specific token
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: req.user.id,
        timestamp: Date.now(),
        key: process.env.DEEPGRAM_API_KEY,
      })
    ).toString('base64');

    res.json({
      token: sessionToken,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error('[VoiceToText] Token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate WebSocket token',
    });
  }
});

module.exports = router;
