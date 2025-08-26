/**
 * Advanced Audio Analytics Service
 * Integrates pyannote.audio for speaker diarization, voice activity detection, and overlapped speech detection
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import HuggingFaceJobsService from './HuggingFaceJobsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AdvancedAudioAnalyticsService {
  constructor() {
    this.dbPool = null;
    this.isInitialized = false;
    this.pythonProcesses = new Map();
    this.audioCache = new Map();
    this.analysisQueue = [];
    this.processingQueue = false;

    // Initialize HF Jobs service
    this.hfJobsService = new HuggingFaceJobsService();
    this.cloudJobs = new Map();

    // Configuration
    this.config = {
      maxSpeakersPerChunk: 3,
      maxSpeakersPerFrame: 2,
      minDurationOn: 0.0,
      minDurationOff: 0.0,
      sampleRate: 16000,
      chunkDuration: 10, // seconds
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['.wav', '.mp3', '.m4a', '.flac', '.ogg'],
      // Cloud processing preferences
      cloudProcessing: {
        enabled: true,
        preferCloud: false, // Use cloud for heavy processing
        fallbackToLocal: true,
        minFileSizeForCloud: 10 * 1024 * 1024, // 10MB
        maxLocalProcessingTime: 300, // 5 minutes
      },
    };
  }

  async initialize(dbPool) {
  if (this.isInitialized) { return; }

    try {
      console.log(
        '[AudioAnalytics] Initializing Advanced Audio Analytics Service...'
      );

      this.dbPool = dbPool;

      // Check if HuggingFace token is available
      if (!process.env.HF_TOKEN) {
        throw new Error('HF_TOKEN required for pyannote.audio models');
      }

      // Create Python environment and install dependencies
      await this.setupPythonEnvironment();

      // Initialize database tables for audio analytics
      await this.initializeDatabase();

      // Create audio processing directories
      await this.createDirectories();

      // Initialize HF Jobs service for cloud processing
      if (this.config.cloudProcessing.enabled) {
        try {
          await this.hfJobsService.initialize();
          console.log('[AudioAnalytics] ✅ Cloud processing enabled');
        } catch (error) {
          console.warn(
            '[AudioAnalytics] ⚠️ Cloud processing unavailable:',
            error.message
          );
          this.config.cloudProcessing.enabled = false;
        }
      }

      // Start processing queue
      this.startQueueProcessor();

      this.isInitialized = true;
      console.log(
        '[AudioAnalytics] ✅ Advanced Audio Analytics Service initialized'
      );
    } catch (error) {
      console.error('[AudioAnalytics] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  async setupPythonEnvironment() {
    try {
      // Create Python script for pyannote.audio integration
      const pythonScript = `
import sys
import json
import torch
import torchaudio
import numpy as np
from pyannote.audio import Model, Inference
from pyannote.audio.pipelines import VoiceActivityDetection, OverlappedSpeechDetection
from pyannote.audio.utils.powerset import Powerset
from pyannote.core import Segment
import warnings
warnings.filterwarnings("ignore")

class AudioAnalyzer:
    def __init__(self, hf_token):
        self.hf_token = hf_token
        self.models = {}
        self.pipelines = {}
        self.load_models()
    
    def load_models(self):
        try:
            # Load segmentation model
            self.models['segmentation'] = Model.from_pretrained(
                "pyannote/segmentation-3.0",
                use_auth_token=self.hf_token
            )
            
            # Load speaker diarization pipeline
            from pyannote.audio import Pipeline
            self.pipelines['diarization'] = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.0",
                use_auth_token=self.hf_token
            )
            
            # Setup VAD pipeline
            self.pipelines['vad'] = VoiceActivityDetection(
                segmentation=self.models['segmentation']
            )
            self.pipelines['vad'].instantiate({
                "min_duration_on": 0.0,
                "min_duration_off": 0.0
            })
            
            # Setup overlapped speech detection
            self.pipelines['osd'] = OverlappedSpeechDetection(
                segmentation=self.models['segmentation']
            )
            self.pipelines['osd'].instantiate({
                "min_duration_on": 0.0,
                "min_duration_off": 0.0
            })
            
            # Setup inference
            self.inference = Inference(self.models['segmentation'])
            
            # Setup powerset converter
            self.to_multilabel = Powerset(3, 2).to_multilabel
            
            print("Models loaded successfully", file=sys.stderr)
            
        except Exception as e:
            print(f"Error loading models: {str(e)}", file=sys.stderr)
            raise
    
    def analyze_audio(self, audio_path, analysis_type="full"):
        try:
            results = {}
            
            if analysis_type in ["full", "diarization"]:
                # Speaker diarization
                diarization = self.pipelines['diarization'](audio_path)
                results['diarization'] = self.format_diarization(diarization)
            
            if analysis_type in ["full", "vad"]:
                # Voice activity detection
                vad = self.pipelines['vad'](audio_path)
                results['vad'] = self.format_annotation(vad)
            
            if analysis_type in ["full", "osd"]:
                # Overlapped speech detection
                osd = self.pipelines['osd'](audio_path)
                results['osd'] = self.format_annotation(osd)
            
            if analysis_type in ["full", "segmentation"]:
                # Raw segmentation inference
                segmentation = self.inference(audio_path)
                results['segmentation'] = self.format_segmentation(segmentation)
            
            return results
            
        except Exception as e:
            print(f"Error analyzing audio: {str(e)}", file=sys.stderr)
            return {"error": str(e)}
    
    def analyze_segment(self, audio_path, start_time, end_time, analysis_type="full"):
        try:
            segment = Segment(start=start_time, end=end_time)
            results = {}
            
            if analysis_type in ["full", "segmentation"]:
                segmentation = self.inference.crop(audio_path, segment)
                results['segmentation'] = self.format_segmentation(segmentation)
            
            return results
            
        except Exception as e:
            print(f"Error analyzing segment: {str(e)}", file=sys.stderr)
            return {"error": str(e)}
    
    def format_diarization(self, diarization):
        speakers = []
        for segment, _, speaker in diarization.itertracks(yield_label=True):
            speakers.append({
                "start": float(segment.start),
                "end": float(segment.end),
                "speaker": speaker,
                "duration": float(segment.end - segment.start)
            })
        return speakers
    
    def format_annotation(self, annotation):
        segments = []
        for segment in annotation.get_timeline():
            segments.append({
                "start": float(segment.start),
                "end": float(segment.end),
                "duration": float(segment.end - segment.start)
            })
        return segments
    
    def format_segmentation(self, segmentation):
        return {
            "shape": segmentation.shape,
            "data": segmentation.tolist() if hasattr(segmentation, 'tolist') else str(segmentation)
        }

def main():
    if len(sys.argv) < 4:
        print("Usage: python script.py <hf_token> <audio_path> <analysis_type> [start_time] [end_time]")
        sys.exit(1)
    
    hf_token = sys.argv[1]
    audio_path = sys.argv[2]
    analysis_type = sys.argv[3]
    
    analyzer = AudioAnalyzer(hf_token)
    
    if len(sys.argv) >= 6:
        start_time = float(sys.argv[4])
        end_time = float(sys.argv[5])
        results = analyzer.analyze_segment(audio_path, start_time, end_time, analysis_type)
    else:
        results = analyzer.analyze_audio(audio_path, analysis_type)
    
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`;

      // Save Python script
      const scriptPath = path.join(
        __dirname,
        '../../scripts/audio_analyzer.py'
      );
      await fs.writeFile(scriptPath, pythonScript);
      await fs.chmod(scriptPath, 0o755);

      console.log('[AudioAnalytics] ✅ Python environment setup completed');
    } catch (error) {
      console.error(
        '[AudioAnalytics] Failed to setup Python environment:',
        error
      );
      throw error;
    }
  }

  async initializeDatabase() {
  if (!this.dbPool) { return; }

    try {
      // Create audio analytics tables
      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS audio_analyses (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    audio_file_path TEXT NOT NULL,
                    audio_file_hash VARCHAR(64),
                    file_size_bytes INTEGER,
                    duration_seconds FLOAT,
                    sample_rate INTEGER,
                    analysis_type VARCHAR(50) NOT NULL,
                    results JSONB NOT NULL,
                    processing_time_ms INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );

                CREATE INDEX IF NOT EXISTS idx_audio_analyses_user_id ON audio_analyses(user_id);
                CREATE INDEX IF NOT EXISTS idx_audio_analyses_type ON audio_analyses(analysis_type);
                CREATE INDEX IF NOT EXISTS idx_audio_analyses_hash ON audio_analyses(audio_file_hash);

                CREATE TABLE IF NOT EXISTS speaker_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    speaker_id VARCHAR(100) NOT NULL,
                    speaker_name VARCHAR(255),
                    voice_characteristics JSONB DEFAULT '{}'::jsonb,
                    total_speaking_time FLOAT DEFAULT 0,
                    analysis_count INTEGER DEFAULT 0,
                    first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    confidence_scores FLOAT[] DEFAULT ARRAY[]::FLOAT[],
                    metadata JSONB DEFAULT '{}'::jsonb,
                    UNIQUE(user_id, speaker_id)
                );

                CREATE INDEX IF NOT EXISTS idx_speaker_profiles_user_id ON speaker_profiles(user_id);
                CREATE INDEX IF NOT EXISTS idx_speaker_profiles_speaker_id ON speaker_profiles(speaker_id);
            `);

      console.log('[AudioAnalytics] ✅ Database tables initialized');
    } catch (error) {
      console.error('[AudioAnalytics] Failed to initialize database:', error);
    }
  }

  async createDirectories() {
    const dirs = ['audio_temp', 'audio_processed', 'audio_segments'];

    for (const dir of dirs) {
      const dirPath = path.join(__dirname, '../../', dir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.warn(
            `[AudioAnalytics] Could not create directory ${dir}:`,
            error.message
          );
        }
      }
    }
  }

  // Main Analysis Methods
  async analyzeAudio(audioFilePath, options = {}) {
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate file
      const audioInfo = await this.validateAudioFile(audioFilePath);
      if (!audioInfo.valid) {
        throw new Error(`Invalid audio file: ${audioInfo.error}`);
      }

      const analysisType = options.analysisType || 'full';
  const { userId } = options;

      console.log(
        `[AudioAnalytics] Starting ${analysisType} analysis for ${audioFilePath}`
      );

      // Check cache first
      const cacheKey = `${audioInfo.hash}_${analysisType}`;
      if (this.audioCache.has(cacheKey)) {
        console.log(
          `[AudioAnalytics] Using cached results for ${audioFilePath}`
        );
        return this.audioCache.get(cacheKey);
      }

      const startTime = Date.now();

      // Decide between local vs cloud processing
      let results;
      if (this.shouldUseCloudProcessing(audioInfo, analysisType, options)) {
        console.log(
          `[AudioAnalytics] Using cloud processing for ${audioFilePath}`
        );
        results = await this.runCloudAnalysis(
          audioFilePath,
          analysisType,
          options
        );
      } else {
        console.log(
          `[AudioAnalytics] Using local processing for ${audioFilePath}`
        );
        results = await this.runPythonAnalysis(audioFilePath, analysisType);
      }

      const processingTime = Date.now() - startTime;

      // Process and enhance results
      const enhancedResults = await this.enhanceAnalysisResults(
        results,
        audioInfo,
        options
      );

      // Store in database
      await this.storeAnalysisResults(
        userId,
        audioFilePath,
        audioInfo,
        analysisType,
        enhancedResults,
        processingTime
      );

      // Cache results
      this.audioCache.set(cacheKey, enhancedResults);

      // Update speaker profiles if diarization was performed
      if (results.diarization) {
        await this.updateSpeakerProfiles(
          userId,
          results.diarization,
          audioInfo
        );
      }

      console.log(
        `[AudioAnalytics] ✅ Analysis completed in ${processingTime}ms`
      );
      return enhancedResults;
    } catch (error) {
      console.error(
        `[AudioAnalytics] Analysis failed for ${audioFilePath}:`,
        error
      );
      throw error;
    }
  }

  async analyzeAudioSegment(audioFilePath, startTime, endTime, options = {}) {
    try {
      const audioInfo = await this.validateAudioFile(audioFilePath);
      if (!audioInfo.valid) {
        throw new Error(`Invalid audio file: ${audioInfo.error}`);
      }

      const analysisType = options.analysisType || 'segmentation';

      console.log(
        `[AudioAnalytics] Analyzing segment ${startTime}-${endTime}s from ${audioFilePath}`
      );

      const results = await this.runPythonAnalysis(
        audioFilePath,
        analysisType,
        startTime,
        endTime
      );

      return {
        segment: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime,
        },
        analysis: results,
        audioInfo: audioInfo,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error(`[AudioAnalytics] Segment analysis failed:`, error);
      throw error;
    }
  }

  async runPythonAnalysis(
    audioPath,
    analysisType,
    startTime = null,
    endTime = null
  ) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(
        __dirname,
        '../../scripts/audio_analyzer.py'
      );

      const args = [scriptPath, process.env.HF_TOKEN, audioPath, analysisType];

      if (startTime !== null && endTime !== null) {
        args.push(startTime.toString(), endTime.toString());
      }

  const pythonProcess = spawn('/bin/python3.13', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000, // 5 minutes timeout
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', data => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      pythonProcess.on('close', code => {
        if (code !== 0) {
          reject(
            new Error(`Python process failed with code ${code}: ${stderr}`)
          );
          return;
        }

        try {
          const results = JSON.parse(stdout);
          if (results.error) {
            reject(new Error(`Python analysis error: ${results.error}`));
          } else {
            resolve(results);
          }
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error.message}`));
        }
      });

      pythonProcess.on('error', error => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  async validateAudioFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const fileExtension = path.extname(filePath).toLowerCase();

      if (!this.config.supportedFormats.includes(fileExtension)) {
        return {
          valid: false,
          error: `Unsupported file format: ${fileExtension}`,
        };
      }

      if (fileSize > this.config.maxFileSize) {
        return {
          valid: false,
          error: `File too large: ${fileSize} bytes (max: ${this.config.maxFileSize})`,
        };
      }

      // Generate file hash for caching
      const crypto = await import('crypto');
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        valid: true,
        size: fileSize,
        extension: fileExtension,
        hash: hash,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  async enhanceAnalysisResults(results, audioInfo, options) {
    const enhanced = {
      ...results,
      metadata: {
        audioInfo,
        analysisOptions: options,
        processedAt: new Date(),
        version: '1.0.0',
      },
    };

    // Add statistics and insights
    if (results.diarization) {
      enhanced.speakerStats = this.calculateSpeakerStatistics(
        results.diarization
      );
    }

    if (results.vad) {
      enhanced.speechStats = this.calculateSpeechStatistics(
        results.vad,
        audioInfo
      );
    }

    if (results.osd) {
      enhanced.overlapStats = this.calculateOverlapStatistics(
        results.osd,
        audioInfo
      );
    }

    return enhanced;
  }

  calculateSpeakerStatistics(diarization) {
    const speakerStats = {};
    let totalSpeechTime = 0;

    for (const segment of diarization) {
  const { speaker, duration } = segment;

      if (!speakerStats[speaker]) {
        speakerStats[speaker] = {
          totalTime: 0,
          segmentCount: 0,
          averageSegmentDuration: 0,
          longestSegment: 0,
          shortestSegment: Infinity,
        };
      }

      speakerStats[speaker].totalTime += duration;
      speakerStats[speaker].segmentCount += 1;
      speakerStats[speaker].longestSegment = Math.max(
        speakerStats[speaker].longestSegment,
        duration
      );
      speakerStats[speaker].shortestSegment = Math.min(
        speakerStats[speaker].shortestSegment,
        duration
      );
      totalSpeechTime += duration;
    }

    // Calculate percentages and averages
    for (const speaker of Object.keys(speakerStats)) {
      const stats = speakerStats[speaker];
      stats.averageSegmentDuration = stats.totalTime / stats.segmentCount;
      stats.speakingTimePercentage = (stats.totalTime / totalSpeechTime) * 100;
    }

    return {
      speakers: speakerStats,
      totalSpeakers: Object.keys(speakerStats).length,
      totalSpeechTime,
      averageSpeechTime: totalSpeechTime / Object.keys(speakerStats).length,
    };
  }

  calculateSpeechStatistics(vad, audioInfo) {
    let totalSpeechTime = 0;
    let speechSegments = 0;

    for (const segment of vad) {
      totalSpeechTime += segment.duration;
      speechSegments += 1;
    }

    const totalDuration = audioInfo.duration || 0;
    const speechRatio =
      totalDuration > 0 ? (totalSpeechTime / totalDuration) * 100 : 0;

    return {
      totalSpeechTime,
      speechSegments,
      averageSegmentDuration:
        speechSegments > 0 ? totalSpeechTime / speechSegments : 0,
      speechRatio,
      silenceTime: totalDuration - totalSpeechTime,
      silenceRatio: 100 - speechRatio,
    };
  }

  calculateOverlapStatistics(osd, audioInfo) {
    let totalOverlapTime = 0;
    let overlapSegments = 0;

    for (const segment of osd) {
      totalOverlapTime += segment.duration;
      overlapSegments += 1;
    }

    const totalDuration = audioInfo.duration || 0;
    const overlapRatio =
      totalDuration > 0 ? (totalOverlapTime / totalDuration) * 100 : 0;

    return {
      totalOverlapTime,
      overlapSegments,
      averageOverlapDuration:
        overlapSegments > 0 ? totalOverlapTime / overlapSegments : 0,
      overlapRatio,
    };
  }

  async storeAnalysisResults(
    userId,
    audioPath,
    audioInfo,
    analysisType,
    results,
    processingTime
  ) {
  if (!this.dbPool) { return; }

    try {
      await this.dbPool.query(
        `
                INSERT INTO audio_analyses (
                    user_id, audio_file_path, audio_file_hash, file_size_bytes,
                    analysis_type, results, processing_time_ms, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
        [
          userId,
          audioPath,
          audioInfo.hash,
          audioInfo.size,
          analysisType,
          JSON.stringify(results),
          processingTime,
          JSON.stringify({
            extension: audioInfo.extension,
            lastModified: audioInfo.lastModified,
          }),
        ]
      );
    } catch (error) {
      console.error(
        '[AudioAnalytics] Failed to store analysis results:',
        error
      );
    }
  }

  async updateSpeakerProfiles(userId, diarization, audioInfo) {
  if (!this.dbPool || !userId) { return; }

    try {
      for (const segment of diarization) {
        const speakerId = segment.speaker;
  const { duration } = segment;

        await this.dbPool.query(
          `
                    INSERT INTO speaker_profiles (user_id, speaker_id, total_speaking_time, analysis_count, last_detected)
                    VALUES ($1, $2, $3, 1, NOW())
                    ON CONFLICT (user_id, speaker_id) DO UPDATE SET
                        total_speaking_time = speaker_profiles.total_speaking_time + $3,
                        analysis_count = speaker_profiles.analysis_count + 1,
                        last_detected = NOW()
                `,
          [userId, speakerId, duration]
        );
      }
    } catch (error) {
      console.error(
        '[AudioAnalytics] Failed to update speaker profiles:',
        error
      );
    }
  }

  // Queue Management
  startQueueProcessor() {
    setInterval(async () => {
      if (!this.processingQueue && this.analysisQueue.length > 0) {
        this.processingQueue = true;
        const job = this.analysisQueue.shift();

        try {
          const results = await this.analyzeAudio(job.audioPath, job.options);
          job.resolve(results);
        } catch (error) {
          job.reject(error);
        }

        this.processingQueue = false;
      }
    }, 1000);
  }

  // Public API Methods
  async queueAnalysis(audioFilePath, options = {}) {
    return new Promise((resolve, reject) => {
      this.analysisQueue.push({
        audioPath: audioFilePath,
        options,
        resolve,
        reject,
        queuedAt: new Date(),
      });
    });
  }

  async getAnalysisHistory(userId, limit = 20) {
  if (!this.dbPool) { return []; }

    try {
      const result = await this.dbPool.query(
        `
                SELECT audio_file_path, analysis_type, processing_time_ms, created_at,
                       jsonb_extract_path(results, 'speakerStats', 'totalSpeakers') as speaker_count,
                       jsonb_extract_path(results, 'speechStats', 'speechRatio') as speech_ratio
                FROM audio_analyses 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
            `,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('[AudioAnalytics] Failed to get analysis history:', error);
      return [];
    }
  }

  async getSpeakerProfiles(userId) {
  if (!this.dbPool) { return []; }

    try {
      const result = await this.dbPool.query(
        `
                SELECT speaker_id, speaker_name, total_speaking_time, analysis_count,
                       first_detected, last_detected, voice_characteristics
                FROM speaker_profiles 
                WHERE user_id = $1 
                ORDER BY total_speaking_time DESC
            `,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('[AudioAnalytics] Failed to get speaker profiles:', error);
      return [];
    }
  }

  // Cloud Processing Methods
  shouldUseCloudProcessing(audioInfo, analysisType, options = {}) {
  if (!this.config.cloudProcessing.enabled) { return false; }
  if (options.forceLocal) { return false; }
  if (options.forceCloud) { return true; }

    // Use cloud for large files
    if (audioInfo.size >= this.config.cloudProcessing.minFileSizeForCloud) {
      return true;
    }

    // Use cloud for full analysis on medium files
    if (analysisType === 'full' && audioInfo.size >= 5 * 1024 * 1024) {
      return true;
    }

    // Use cloud if local queue is backed up
    if (this.analysisQueue.length > 3) {
      return true;
    }

    return this.config.cloudProcessing.preferCloud;
  }

  async runCloudAnalysis(audioFilePath, analysisType, options = {}) {
    try {
      // Upload audio file to temporary location accessible by HF Jobs
      const cloudAudioPath = await this.prepareAudioForCloud(audioFilePath);

      // Submit job to HF Jobs
      const jobResult = await this.hfJobsService.runAudioAnalysisJob(
        cloudAudioPath,
        analysisType,
        {
          ...options,
          priority: options.priority || 'balanced',
        }
      );

      // Track cloud job
      this.cloudJobs.set(jobResult.jobId, {
        ...jobResult,
        localPath: audioFilePath,
        startTime: new Date(),
        options,
      });

      // Poll for results
      const results = await this.waitForCloudResults(jobResult.jobId);

      // Clean up
      await this.cleanupCloudFiles(cloudAudioPath);
      this.cloudJobs.delete(jobResult.jobId);

      return results;
    } catch (error) {
      console.error('[AudioAnalytics] Cloud analysis failed:', error);

      // Fallback to local processing if enabled
      if (this.config.cloudProcessing.fallbackToLocal) {
        console.log('[AudioAnalytics] Falling back to local processing');
        return await this.runPythonAnalysis(audioFilePath, analysisType);
      }

      throw error;
    }
  }

  async prepareAudioForCloud(audioFilePath) {
    // For now, return the local path
    // In production, you'd upload to a cloud storage service
    // accessible by HF Jobs (S3, GCS, etc.)
    return audioFilePath;
  }

  async waitForCloudResults(jobId, maxWaitTime = 1800) {
    // 30 minutes
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime * 1000) {
      try {
        const status = await this.hfJobsService.getJobStatus(jobId);

        if (status.status === 'COMPLETED') {
          const logs = await this.hfJobsService.getJobLogs(jobId);
          return this.parseCloudResults(logs);
        } else if (
          status.status === 'FAILED' ||
          status.status === 'CANCELLED'
        ) {
          throw new Error(
            `Cloud job ${status.status.toLowerCase()}: ${status.error || 'Unknown error'}`
          );
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`[AudioAnalytics] Error polling job ${jobId}:`, error);
        throw error;
      }
    }

    throw new Error(
      `Cloud job ${jobId} timed out after ${maxWaitTime} seconds`
    );
  }

  parseCloudResults(jobLogs) {
    try {
      // Extract JSON results from job logs
      const lines = jobLogs.split('\n');
      let resultsLine = null;

      for (const line of lines) {
        if (line.trim().startsWith('{') && line.includes('diarization')) {
          resultsLine = line.trim();
          break;
        }
      }

      if (!resultsLine) {
        throw new Error('No valid results found in job logs');
      }

      return JSON.parse(resultsLine);
    } catch (error) {
      console.error('[AudioAnalytics] Failed to parse cloud results:', error);
      throw new Error(
        `Failed to parse cloud analysis results: ${error.message}`
      );
    }
  }

  async cleanupCloudFiles(cloudPath) {
    // Clean up temporary cloud files
    // Implementation depends on cloud storage solution
    console.log(`[AudioAnalytics] Cleaning up cloud file: ${cloudPath}`);
  }

  // Cloud Job Management
  async getCloudJobs(userId = null) {
    const jobs = Array.from(this.cloudJobs.values());

    if (userId) {
      return jobs.filter(job => job.options?.userId === userId);
    }

    return jobs;
  }

  async cancelCloudJob(jobId) {
    if (this.cloudJobs.has(jobId)) {
      await this.hfJobsService.cancelJob(jobId);
      this.cloudJobs.delete(jobId);
      return true;
    }
    return false;
  }

  // Enhanced Health Check
  async healthCheck() {
    try {
      // Test local Python environment
      const localTest = await this.runPythonAnalysis('/dev/null', 'test').catch(
        () => null
      );

      // Test cloud processing if enabled
      let cloudHealth = { available: false };
      if (this.config.cloudProcessing.enabled) {
        cloudHealth = await this.hfJobsService.healthCheck();
      }

      return {
        status: 'healthy',
        local_processing: {
          python_environment: localTest ? 'available' : 'unavailable',
          queue_size: this.analysisQueue.length,
          cache_size: this.audioCache.size,
        },
        cloud_processing: {
          enabled: this.config.cloudProcessing.enabled,
          health: cloudHealth,
          active_jobs: this.cloudJobs.size,
        },
        last_check: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        last_check: new Date(),
      };
    }
  }
}

export default AdvancedAudioAnalyticsService;
