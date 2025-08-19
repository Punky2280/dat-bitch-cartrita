/**
 * @fileoverview Audio Post-Processing Service - Task 16 Implementation
 * @description Handles audio recording selection logic, quality assessment,
 * and post-processing workflows for the voice AI system
 */

import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class AudioPostProcessingService {
  constructor() {
    this.qualityThreshold = 0.7;
    this.optimalDurationMin = 2.0; // seconds
    this.optimalDurationMax = 5.0; // seconds
    
    // Initialize OpenTelemetry metrics
    this.initializeMetrics();
  }

  initializeMetrics() {
    try {
      this.metrics = {
        processedRecordings: OpenTelemetryTracing.createCounter(
          'audio_postprocessing_recordings_total',
          'Total number of audio recordings processed'
        ),
        qualityDistribution: OpenTelemetryTracing.createHistogram(
          'audio_postprocessing_quality_distribution',
          'Distribution of audio quality scores'
        ),
        selectionLatency: OpenTelemetryTracing.createHistogram(
          'audio_postprocessing_selection_latency_ms',
          'Time taken to select best audio recording'
        )
      };
    } catch (error) {
      console.warn('[AudioPostProcessing] Failed to initialize metrics:', error.message);
      this.metrics = {};
    }
  }

  /**
   * Select the best audio recording from a collection based on quality and duration
   * FIXED: Resolves the floating-point comparison issue that was causing wrong selection
   * 
   * @param {Array} recordings - Array of recording objects with { id, duration, quality, content }
   * @param {Object} options - Selection options
   * @returns {Object|null} - The best recording or null if none found
   */
  selectBestRecording(recordings, options = {}) {
    const startTime = Date.now();
    
    try {
      // Input validation
      if (!recordings || !Array.isArray(recordings) || recordings.length === 0) {
        return null;
      }

      // Track processed recordings
      if (this.metrics.processedRecordings) {
        this.metrics.processedRecordings.add(recordings.length);
      }

      // Track quality distribution
      recordings.forEach(recording => {
        if (this.metrics.qualityDistribution && typeof recording.quality === 'number') {
          this.metrics.qualityDistribution.record(recording.quality);
        }
      });

      // Apply quality filtering
      const qualityThreshold = options.qualityThreshold || this.qualityThreshold;
      const qualityFiltered = recordings.filter(r => 
        r.quality !== undefined && r.quality >= qualityThreshold
      );

      if (qualityFiltered.length === 0) {
        console.warn('[AudioPostProcessing] No recordings meet quality threshold, using first available');
        return recordings[0];
      }

      // Sort by quality (descending) then by optimal duration preference
      const sorted = qualityFiltered.sort((a, b) => {
        // Fix floating-point precision issues
        const qualityDiff = b.quality - a.quality;
        const qualityDiffRounded = Math.round(qualityDiff * 100) / 100;
        
        // If quality difference is significant (>=0.1), prioritize quality
        if (Math.abs(qualityDiffRounded) >= 0.1) {
          return qualityDiffRounded;
        }
        
        // If qualities are similar, prefer optimal duration range
        const optimalMin = options.optimalDurationMin || this.optimalDurationMin;
        const optimalMax = options.optimalDurationMax || this.optimalDurationMax;
        
        const aIsOptimal = a.duration >= optimalMin && a.duration <= optimalMax ? 1 : 0;
        const bIsOptimal = b.duration >= optimalMin && b.duration <= optimalMax ? 1 : 0;
        
        if (aIsOptimal !== bIsOptimal) {
          return bIsOptimal - aIsOptimal;
        }
        
        // If both optimal or both non-optimal, prefer shorter duration for responsiveness
        return a.duration - b.duration;
      });

      const selectedRecording = sorted[0];
      
      // Track selection latency
      const latency = Date.now() - startTime;
      if (this.metrics.selectionLatency) {
        this.metrics.selectionLatency.record(latency);
      }

      console.log('[AudioPostProcessing] Selected recording:', {
        id: selectedRecording.id,
        quality: selectedRecording.quality,
        duration: selectedRecording.duration,
        selectionLatencyMs: latency
      });

      return selectedRecording;

    } catch (error) {
      console.error('[AudioPostProcessing] Selection failed:', error);
      return recordings?.[0] || null;
    }
  }

  /**
   * Analyze audio recording quality based on various metrics
   * 
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {Object} metadata - Audio metadata
   * @returns {Object} - Quality analysis results
   */
  async analyzeAudioQuality(audioBuffer, metadata = {}) {
    try {
      const analysis = {
        quality: 0.5, // Default quality score
        confidence: 0.0,
        metrics: {
          fileSize: audioBuffer?.length || 0,
          estimatedDuration: metadata.duration || 0,
          sampleRate: metadata.sampleRate || 16000,
          channels: metadata.channels || 1
        },
        issues: []
      };

      // File size checks
      if (analysis.metrics.fileSize < 1000) {
        analysis.issues.push('File too small (likely empty)');
        analysis.quality = 0.1;
      } else if (analysis.metrics.fileSize < 5000) {
        analysis.issues.push('File very small (likely truncated)');
        analysis.quality = 0.4;
      } else {
        analysis.quality += 0.3; // Bonus for reasonable size
      }

      // Duration checks  
      if (analysis.metrics.estimatedDuration > 0) {
        if (analysis.metrics.estimatedDuration < 0.5) {
          analysis.issues.push('Recording too short');
          analysis.quality -= 0.2;
        } else if (analysis.metrics.estimatedDuration > 10) {
          analysis.issues.push('Recording very long');
          analysis.quality -= 0.1;
        } else if (analysis.metrics.estimatedDuration >= 2 && analysis.metrics.estimatedDuration <= 5) {
          analysis.quality += 0.2; // Bonus for optimal duration
        }
      }

      // Sample rate checks
      if (analysis.metrics.sampleRate >= 16000) {
        analysis.quality += 0.1; // Bonus for good sample rate
      } else {
        analysis.issues.push('Low sample rate (may affect transcription quality)');
        analysis.quality -= 0.1;
      }

      // Normalize quality score to 0-1 range
      analysis.quality = Math.max(0, Math.min(1, analysis.quality));
      analysis.confidence = analysis.issues.length === 0 ? 0.9 : Math.max(0.1, 0.9 - (analysis.issues.length * 0.2));

      return analysis;

    } catch (error) {
      console.error('[AudioPostProcessing] Quality analysis failed:', error);
      return {
        quality: 0.3,
        confidence: 0.1,
        metrics: {},
        issues: ['Analysis failed: ' + error.message]
      };
    }
  }

  /**
   * Process audio recording batch and select the best one
   * 
   * @param {Array} recordingBatch - Array of recordings with buffers and metadata
   * @param {Object} options - Processing options
   * @returns {Object} - Processing results with selected recording
   */
  async processBatch(recordingBatch, options = {}) {
    try {
      console.log(`[AudioPostProcessing] Processing batch of ${recordingBatch.length} recordings`);

      // Analyze quality for each recording
      const analyzedRecordings = await Promise.all(
        recordingBatch.map(async (recording, index) => {
          const analysis = await this.analyzeAudioQuality(recording.buffer, recording.metadata);
          
          return {
            id: recording.id || index,
            duration: recording.metadata?.duration || 0,
            quality: analysis.quality,
            confidence: analysis.confidence,
            content: recording.content || `Recording ${index + 1}`,
            buffer: recording.buffer,
            metadata: recording.metadata,
            analysis: analysis
          };
        })
      );

      // Select the best recording
      const selectedRecording = this.selectBestRecording(analyzedRecordings, options);

      return {
        success: true,
        selectedRecording,
        totalRecordings: recordingBatch.length,
        qualityScores: analyzedRecordings.map(r => ({ id: r.id, quality: r.quality })),
        processingTime: Date.now()
      };

    } catch (error) {
      console.error('[AudioPostProcessing] Batch processing failed:', error);
      return {
        success: false,
        error: error.message,
        selectedRecording: recordingBatch?.[0] || null
      };
    }
  }

  /**
   * Get processing statistics and health status
   */
  getStatus() {
    return {
      service: 'audio-post-processing',
      status: 'operational',
      config: {
        qualityThreshold: this.qualityThreshold,
        optimalDurationMin: this.optimalDurationMin,
        optimalDurationMax: this.optimalDurationMax
      },
      features: {
        recordingSelection: 'active',
        qualityAnalysis: 'active',
        batchProcessing: 'active',
        metrics: Object.keys(this.metrics).length > 0 ? 'active' : 'disabled'
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const audioPostProcessingService = new AudioPostProcessingService();
export default audioPostProcessingService;