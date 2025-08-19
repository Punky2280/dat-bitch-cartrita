import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import VoiceAIErrorHandler from '../services/VoiceAIErrorHandler.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
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

// Initialize Voice AI Error Handler
let voiceErrorHandler;

const initializeServices = async () => {
  if (!voiceErrorHandler) {
    voiceErrorHandler = VoiceAIErrorHandler; // It's already a singleton instance
    if (voiceErrorHandler.initialize) {
      await voiceErrorHandler.initialize();
    }
  }
};

router.get('/', (req, res) => {
  res.json({
    message: 'Voice-to-text service',
    status: 'ready',
    endpoints: ['/transcribe', '/status'],
    timestamp: new Date().toISOString(),
  });
});

// Transcribe & analyze audio (file upload or URL) with Deepgram Audio Intelligence
router.post(
  '/transcribe',
  authenticateToken,
  upload.single('audio'),
  async (req, res) => {
    try {
      // Initialize services on first use
      await initializeServices();
      
      console.log('[VoiceToText] 🎤 Transcription request received:', {
        hasFile: !!req.file,
        bodyKeys: Object.keys(req.body || {}),
        query: req.query
      });

      // Determine source: file upload (multipart) OR JSON { url }
      const hasFile = !!req.file;
      const body = req.is('application/json') ? (req.body || {}) : {};
      const urlSource = body.url || body.audioUrl || body.sourceUrl || null;
      
      if (!hasFile && !urlSource) {
        return res.status(400).json({ 
          success: false, 
          error: 'No audio provided. Use multipart form-data with field "audio" or JSON { url }.' 
        });
      }

      // Build analysis options from query/body
      const q = req.query || {};
      const parseBool = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
        return false;
      };

      const language = body.language || q.language || 'en';
      const model = body.model || q.model || process.env.DEEPGRAM_MODEL || 'nova-3';
      
      // Intelligence flags (audio)
      const analysisOptions = {
        sentiment: body.sentiment ?? parseBool(q.sentiment),
        intents: body.intents ?? parseBool(q.intents),
        topics: body.topics ?? parseBool(q.topics),
        summarize: body.summarize ?? (q.summarize || undefined), // allow 'v2' or 'true'
        detect_entities: body.detect_entities ?? parseBool(q.detect_entities),
      };

      // Use VoiceAIErrorHandler for transcription with comprehensive error handling
      let audioSource;
      if (hasFile) {
        audioSource = {
          type: 'buffer',
          buffer: req.file.buffer,
          mimetype: req.file.mimetype || 'audio/webm'
        };
      } else {
        audioSource = {
          type: 'url',
          url: urlSource
        };
      }

      const transcriptionOptions = {
        model,
        language,
        smart_format: true,
        punctuate: true,
        diarize: false,
        utterances: false,
        ...analysisOptions
      };

      console.log(`[VoiceToText] � Using VoiceAIErrorHandler with options:`, {
        model,
        language,
        hasFile,
        urlSource: urlSource ? `${urlSource.substring(0, 50)}...` : null,
        intelligence: analysisOptions
      });

      const result = await voiceErrorHandler.transcribeAudio(audioSource, transcriptionOptions);
      
      if (!result.success) {
        console.error('[VoiceToText] ❌ Transcription failed:', result.error);
        return res.status(result.statusCode || 500).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

      // Wake word detection: "cartrita"
      const wake = detectWakeWord(result.transcript, 'cartrita');

      return res.json({
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
        wakeWord: wake,
        analysis: result.analysis || {},
        raw: result.raw,
        model: result.model || model,
        language: result.language || language,
        used_options: {
          sentiment: !!analysisOptions.sentiment,
          intents: !!analysisOptions.intents,
          topics: !!analysisOptions.topics,
          summarize: analysisOptions.summarize || false,
          detect_entities: !!analysisOptions.detect_entities,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[VoiceToText] ❌ Transcription error:', error);
      res.status(500).json({
        success: false,
        error: 'Transcription failed',
        details: error.message,
      });
    }
  }
);

// Get transcription status/health
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Initialize services and get status
    await initializeServices();
    const status = await voiceErrorHandler.getStatus();
    
    res.json({
      service: 'voice-to-text',
      status: 'operational',
      deepgramStatus: status.deepgram,
      features: {
        transcription: status.deepgram.available ? 'active' : 'mock',
        intelligence: status.deepgram.available
          ? {
              sentiment: 'available',
              intents: 'available',
              topics: 'available',
              summarize: 'available',
              detect_entities: 'available',
            }
          : 'unavailable',
        supported_formats: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a'],
        max_file_size: '25MB',
      },
      healthScore: status.healthScore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[VoiceToText] Status check error:', error);
    res.status(500).json({
      service: 'voice-to-text',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

// --- helpers ---
function detectWakeWord(transcript, wakeWord) {
  try {
    if (!transcript || !wakeWord) return { detected: false, wakeWord, cleanTranscript: transcript || '' };
    const t = String(transcript).toLowerCase();
    const w = String(wakeWord).toLowerCase();
    const idx = t.indexOf(w);
    if (idx === -1) return { detected: false, wakeWord, cleanTranscript: transcript };
    const after = transcript.slice(idx + wakeWord.length).trim().replace(/^[\s,.:;!-]+/, '');
    return { detected: true, wakeWord, cleanTranscript: after };
  } catch (_) {
    return { detected: false, wakeWord, cleanTranscript: transcript || '' };
  }
}
