/**
 * Audio Analytics API Routes
 * Exposes advanced audio processing capabilities including speaker diarization,
 * voice activity detection, and overlapped speech detection
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import authenticateToken from '../middleware/authenticateToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../audio_temp');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create upload directory:', error);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `audio-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
        const extension = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${extension}. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});

// Initialize audio analytics service reference
let audioAnalyticsService = null;

// Set service reference (called from main app)
export const setAudioAnalyticsService = (service) => {
    audioAnalyticsService = service;
};

// Middleware to ensure service is available
const requireAudioService = (req, res, next) => {
    if (!audioAnalyticsService || !audioAnalyticsService.isInitialized) {
        return res.status(503).json({
            error: 'Audio analytics service not available',
            message: 'The audio analytics service is not initialized or not available'
        });
    }
    next();
};

// Routes

/**
 * POST /api/audio-analytics/analyze
 * Analyze uploaded audio file for speaker diarization, VAD, and overlapped speech
 */
router.post('/analyze', authenticateToken, requireAudioService, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No audio file provided',
                message: 'Please upload an audio file'
            });
        }

        const analysisType = req.body.analysisType || 'full';
        const options = {
            userId: req.user?.id,
            analysisType: analysisType,
            metadata: {
                originalName: req.file.originalname,
                uploadedAt: new Date(),
                userAgent: req.get('User-Agent')
            }
        };

        console.log(`[AudioAnalytics] Starting analysis for ${req.file.originalname}`);

        // Perform analysis
        const results = await audioAnalyticsService.analyzeAudio(req.file.path, options);

        // Clean up temporary file
        try {
            await fs.unlink(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary file:', cleanupError);
        }

        res.json({
            success: true,
            analysis: results,
            file: {
                originalName: req.file.originalname,
                size: req.file.size,
                type: analysisType
            }
        });

    } catch (error) {
        console.error('[AudioAnalytics] Analysis failed:', error);
        
        // Clean up file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.warn('Failed to clean up temporary file:', cleanupError);
            }
        }

        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
});

/**
 * POST /api/audio-analytics/analyze-segment
 * Analyze a specific segment of an uploaded audio file
 */
router.post('/analyze-segment', authenticateToken, requireAudioService, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No audio file provided',
                message: 'Please upload an audio file'
            });
        }

        const { startTime, endTime } = req.body;
        
        if (startTime === undefined || endTime === undefined) {
            return res.status(400).json({
                error: 'Missing segment parameters',
                message: 'Please provide startTime and endTime for segment analysis'
            });
        }

        const start = parseFloat(startTime);
        const end = parseFloat(endTime);

        if (isNaN(start) || isNaN(end) || start >= end || start < 0) {
            return res.status(400).json({
                error: 'Invalid segment parameters',
                message: 'startTime and endTime must be valid numbers with startTime < endTime'
            });
        }

        const analysisType = req.body.analysisType || 'segmentation';
        const options = {
            userId: req.user?.id,
            analysisType: analysisType
        };

        console.log(`[AudioAnalytics] Analyzing segment ${start}-${end}s from ${req.file.originalname}`);

        // Perform segment analysis
        const results = await audioAnalyticsService.analyzeAudioSegment(
            req.file.path, 
            start, 
            end, 
            options
        );

        // Clean up temporary file
        try {
            await fs.unlink(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary file:', cleanupError);
        }

        res.json({
            success: true,
            analysis: results,
            segment: { start, end, duration: end - start },
            file: {
                originalName: req.file.originalname,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('[AudioAnalytics] Segment analysis failed:', error);
        
        // Clean up file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.warn('Failed to clean up temporary file:', cleanupError);
            }
        }

        res.status(500).json({
            error: 'Segment analysis failed',
            message: error.message
        });
    }
});

/**
 * POST /api/audio-analytics/queue
 * Queue audio analysis for batch processing
 */
router.post('/queue', authenticateToken, requireAudioService, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No audio file provided',
                message: 'Please upload an audio file'
            });
        }

        const analysisType = req.body.analysisType || 'full';
        const options = {
            userId: req.user?.id,
            analysisType: analysisType,
            priority: req.body.priority || 'normal',
            metadata: {
                originalName: req.file.originalname,
                queuedAt: new Date()
            }
        };

        // Queue for processing
        const queuePromise = audioAnalyticsService.queueAnalysis(req.file.path, options);

        res.json({
            success: true,
            message: 'Audio queued for analysis',
            queueId: Date.now().toString(),
            estimatedWaitTime: '1-5 minutes',
            file: {
                originalName: req.file.originalname,
                size: req.file.size,
                type: analysisType
            }
        });

        // Process asynchronously
        try {
            await queuePromise;
            console.log(`[AudioAnalytics] Queued analysis completed for ${req.file.originalname}`);
        } catch (error) {
            console.error(`[AudioAnalytics] Queued analysis failed for ${req.file.originalname}:`, error);
        } finally {
            // Clean up file after processing
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.warn('Failed to clean up queued file:', cleanupError);
            }
        }

    } catch (error) {
        console.error('[AudioAnalytics] Queue operation failed:', error);
        res.status(500).json({
            error: 'Queue operation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/audio-analytics/history
 * Get user's audio analysis history
 */
router.get('/history', authenticateToken, requireAudioService, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = await audioAnalyticsService.getAnalysisHistory(req.user.id, limit);

        res.json({
            success: true,
            history: history,
            count: history.length
        });
    } catch (error) {
        console.error('[AudioAnalytics] Failed to get history:', error);
        res.status(500).json({
            error: 'Failed to retrieve history',
            message: error.message
        });
    }
});

/**
 * GET /api/audio-analytics/speakers
 * Get user's speaker profiles
 */
router.get('/speakers', authenticateToken, requireAudioService, async (req, res) => {
    try {
        const speakers = await audioAnalyticsService.getSpeakerProfiles(req.user.id);

        res.json({
            success: true,
            speakers: speakers,
            count: speakers.length
        });
    } catch (error) {
        console.error('[AudioAnalytics] Failed to get speaker profiles:', error);
        res.status(500).json({
            error: 'Failed to retrieve speaker profiles',
            message: error.message
        });
    }
});

/**
 * PUT /api/audio-analytics/speakers/:speakerId
 * Update speaker profile information
 */
router.put('/speakers/:speakerId', authenticateToken, async (req, res) => {
    try {
        const { speakerId } = req.params;
        const { speakerName, characteristics } = req.body;

        if (!req.dbPool) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'Cannot update speaker profile'
            });
        }

        await req.dbPool.query(`
            UPDATE speaker_profiles 
            SET speaker_name = $1, 
                voice_characteristics = $2,
                updated_at = NOW()
            WHERE user_id = $3 AND speaker_id = $4
        `, [speakerName, JSON.stringify(characteristics || {}), req.user.id, speakerId]);

        res.json({
            success: true,
            message: 'Speaker profile updated',
            speakerId,
            speakerName
        });
    } catch (error) {
        console.error('[AudioAnalytics] Failed to update speaker profile:', error);
        res.status(500).json({
            error: 'Failed to update speaker profile',
            message: error.message
        });
    }
});

/**
 * GET /api/audio-analytics/capabilities
 * Get available analysis capabilities and supported formats
 */
router.get('/capabilities', (req, res) => {
    res.json({
        success: true,
        capabilities: {
            speakerDiarization: {
                description: 'Identify and separate different speakers in audio',
                maxSpeakers: 3,
                chunkDuration: '10 seconds',
                model: 'pyannote/segmentation-3.0'
            },
            voiceActivityDetection: {
                description: 'Detect speech vs. non-speech segments',
                precision: 'Frame-level detection',
                useCase: 'Audio preprocessing, silence removal'
            },
            overlappedSpeechDetection: {
                description: 'Identify when multiple speakers talk simultaneously',
                precision: 'Temporal overlap detection',
                useCase: 'Meeting analysis, conversation quality'
            },
            segmentation: {
                description: 'Raw audio segmentation analysis',
                output: 'Multi-class probability matrix',
                useCase: 'Advanced audio analysis'
            }
        },
        supportedFormats: ['.wav', '.mp3', '.m4a', '.flac', '.ogg'],
        maxFileSize: '50MB',
        processingTime: 'Typically 10-30% of audio duration',
        requirements: {
            python: '3.8+',
            pytorch: '2.0+',
            huggingfaceToken: 'Required for model access'
        }
    });
});

/**
 * GET /api/audio-analytics/health
 * Check audio analytics service health
 */
router.get('/health', async (req, res) => {
    try {
        if (!audioAnalyticsService) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Audio analytics service not initialized'
            });
        }

        const health = await audioAnalyticsService.healthCheck();
        
        res.json({
            success: true,
            health: health,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('[AudioAnalytics] Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date()
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Audio file must be less than 50MB'
            });
        }
        return res.status(400).json({
            error: 'Upload error',
            message: error.message
        });
    }
    
    console.error('[AudioAnalytics] Route error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

export default router;