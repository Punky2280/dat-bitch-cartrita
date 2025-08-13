import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { createClient as createDeepgramClient } from '@deepgram/sdk';

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
      console.log('[VoiceToText] 🎤 Transcription request received:', {
        hasFile: !!req.file,
        bodyKeys: Object.keys(req.body || {}),
        query: req.query
      });

      // Support multiple env var aliases for Deepgram key
      const dgKey =
        process.env.DEEPGRAM_API_KEY ||
        process.env.DEEPGRAM_KEY ||
        process.env.DG_API_KEY ||
        process.env.DEEPGRAM_TOKEN;
      if (!dgKey) {
        console.log('[VoiceToText] ⚠️ No Deepgram API key found, using mock response');
        // Graceful degradation: mock response if key missing
        const mockTranscription = {
          text: 'This is a mock transcription. Configure DEEPGRAM_API_KEY for real ASR.',
          confidence: 0.8,
          duration: 0,
          language: 'en',
          metadata: {
            fileSize: req.file?.size || null,
            mimetype: req.file?.mimetype || null,
            service: 'mock',
          },
        };
        return res.json({
          success: true,
          transcript: mockTranscription.text,
          wakeWord: { detected: false, wakeWord: 'cartrita', cleanTranscript: mockTranscription.text },
          raw: mockTranscription,
          tokens: null,
          model: 'mock-deepgram',
          timestamp: new Date().toISOString(),
        });
      }

      // Build analysis options from query/body
      const q = req.query || {};
      const body = req.is('application/json') ? (req.body || {}) : {};

      const parseBool = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
        return false;
      };

      const language = body.language || q.language || 'en';
      const model = body.model || q.model || process.env.DEEPGRAM_MODEL || 'nova-3';
      // Intelligence flags (audio)
      const optsFromReq = {
        sentiment: body.sentiment ?? parseBool(q.sentiment),
        intents: body.intents ?? parseBool(q.intents),
        topics: body.topics ?? parseBool(q.topics),
        summarize: body.summarize ?? (q.summarize || undefined), // allow 'v2' or 'true'
        detect_entities: body.detect_entities ?? parseBool(q.detect_entities),
      };

      // Determine source: file upload (multipart) OR JSON { url }
      const hasFile = !!req.file;
      const urlSource = body.url || body.audioUrl || body.sourceUrl || null;
      if (!hasFile && !urlSource) {
        return res.status(400).json({ success: false, error: 'No audio provided. Use multipart form-data with field "audio" or JSON { url }.' });
      }

      // Deepgram prerecorded transcription
      const deepgram = createDeepgramClient(dgKey);
      
      console.log(`[VoiceToText] 🔧 Using Deepgram with options:`, {
        model,
        language,
        hasFile,
        urlSource: urlSource ? `${urlSource.substring(0, 50)}...` : null,
        intelligence: optsFromReq
      });

      // Direct call without OpenTelemetry wrapper to debug
      const transcribeAudio = async () => {
        const baseOptions = {
          model,
          language,
          smart_format: true,
          punctuate: true,
          diarize: false,
          utterances: false,
          // Intelligence features
          sentiment: !!optsFromReq.sentiment,
          intents: !!optsFromReq.intents,
          topics: !!optsFromReq.topics,
          summarize: optsFromReq.summarize, // can be 'v2' or true
          detect_entities: !!optsFromReq.detect_entities,
        };

        if (hasFile) {
          const source = {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype || 'audio/webm',
          };
          console.log('[VoiceToText] 📁 Transcribing file, size:', req.file.buffer.length);
          return await deepgram.listen.prerecorded.transcribeFile(source, baseOptions);
        }
        // URL source
        console.log('[VoiceToText] 🌐 Transcribing URL:', urlSource);
        return await deepgram.listen.prerecorded.transcribeUrl({ url: urlSource }, baseOptions);
      };

      let dgResult;
      try {
        dgResult = await transcribeAudio();
        console.log('[VoiceToText] ✅ Deepgram response:', JSON.stringify(dgResult, null, 2).substring(0, 500));
      } catch (err) {
        console.error('[VoiceToText] ❌ Deepgram transcription failed:', err?.message || err);
        console.error('[VoiceToText] Full error:', err);
        console.error('[VoiceToText] Stack trace:', err?.stack);
        
        // Check if it's an authentication error and fall back to mock
        if (err?.status === 401 || err?.message?.includes('INVALID_AUTH')) {
          console.log('[VoiceToText] 🔄 Falling back to mock due to invalid API key');
          const mockTranscription = {
            text: 'Mock transcription: Deepgram API key is invalid. Please configure a valid DEEPGRAM_API_KEY.',
            confidence: 0.7,
            duration: 0,
            language: 'en',
            metadata: {
              fileSize: req.file?.size || null,
              mimetype: req.file?.mimetype || null,
              service: 'mock-fallback',
              originalError: 'INVALID_AUTH'
            },
          };
          return res.json({
            success: true,
            transcript: mockTranscription.text,
            wakeWord: { detected: false, wakeWord: 'cartrita', cleanTranscript: mockTranscription.text },
            raw: mockTranscription,
            tokens: null,
            model: 'mock-deepgram-fallback',
            timestamp: new Date().toISOString(),
          });
        }
        
        return res.status(502).json({ 
          success: false, 
          error: 'ASR provider error',
          details: err?.message || 'Unknown error'
        });
      }

      // Extract transcript text
      let transcriptText = '';
      let confidence = undefined;
      let analysis = {};
      try {
        // v4 SDK returns object with result & channels
        const resultRoot = dgResult?.result || dgResult;
        const alt = resultRoot?.results?.channels?.[0]?.alternatives?.[0];
        transcriptText = alt?.transcript || '';
        confidence = alt?.confidence;
        // Collect intelligence payloads if present
        analysis = {
          summary: resultRoot?.results?.summary || undefined,
          sentiments: resultRoot?.results?.sentiments || undefined,
          intents: resultRoot?.results?.intents || undefined,
          topics: resultRoot?.results?.topics || undefined,
          entities: alt?.entities || undefined,
          warnings: resultRoot?.warnings || undefined,
          metadata: resultRoot?.metadata || undefined,
        };
      } catch (_) {}

      // Wake word detection: "cartrita"
      const wake = detectWakeWord(transcriptText, 'cartrita');

      return res.json({
        success: true,
        transcript: transcriptText,
        confidence,
        wakeWord: wake,
        analysis,
        raw: dgResult?.result || dgResult,
        model,
        language,
        used_options: {
          sentiment: !!optsFromReq.sentiment,
          intents: !!optsFromReq.intents,
          topics: !!optsFromReq.topics,
          summarize: optsFromReq.summarize || false,
          detect_entities: !!optsFromReq.detect_entities,
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
router.get('/status', authenticateToken, (req, res) => {
  const dgKey =
    process.env.DEEPGRAM_API_KEY ||
    process.env.DEEPGRAM_KEY ||
    process.env.DG_API_KEY ||
    process.env.DEEPGRAM_TOKEN;
  res.json({
    service: 'voice-to-text',
    status: 'operational',
    features: {
      transcription: dgKey ? 'active' : 'mock',
      intelligence: dgKey
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
    timestamp: new Date().toISOString(),
  });
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
