import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authenticateToken.js';

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
    endpoints: ['/transcribe'],
    timestamp: new Date().toISOString(),
  });
});

// Transcribe audio to text
router.post(
  '/transcribe',
  authenticateToken,
  upload.single('audio'),
  async (req, res) => {
    try {
      console.log('[VoiceToText] 🎤 Transcription request received');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });
      }

      // TODO: Implement Deepgram integration
      // For now, return a mock response to prevent errors
      const mockTranscription = {
        text: 'This is a mock transcription. Real Deepgram integration needed.',
        confidence: 0.85,
        duration: 2.5,
        language: 'en',
        metadata: {
          fileSize: req.file.size,
          mimetype: req.file.mimetype,
          service: 'mock',
        },
      };

      console.log(
        `[VoiceToText] ✅ Mock transcription completed: ${req.file.size} bytes`
      );

      res.json({
  success: true,
  transcript: mockTranscription.text,
  raw: mockTranscription,
  tokens: null,
  model: 'mock-deepgram',
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
  res.json({
    service: 'voice-to-text',
    status: 'operational',
    features: {
      transcription: 'mock', // Change to 'active' when Deepgram is integrated
      supported_formats: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a'],
      max_file_size: '25MB',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
