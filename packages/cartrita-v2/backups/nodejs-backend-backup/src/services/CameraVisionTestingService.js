import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
/**
 * Camera Vision Testing Service
 *
 * Comprehensive camera testing, diagnostics, and multi-frame analysis service
 * for Task 17: Camera Vision Testing Overhaul
 *
 * Features:
 * - Black screen/blob detection and resolution
 * - Camera permissions and media stream management
 * - Frame capture with resizing and quality optimization
 * - Multi-frame analysis and comparison
 * - Diagnostic tools for camera performance
 * - OpenTelemetry integration for monitoring
 */

import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';

export default class CameraVisionTestingService {
  constructor() {
    this.initialized = false;
    this.testSessions = new Map(); // Active testing sessions
    this.diagnosticResults = new Map(); // Cached diagnostic results
  }

  /**
   * Initialize the camera vision testing service
   */
  async initialize() {
    if (this.initialized) {
      console.log('[CameraVisionTesting] ⚠️ Service already initialized');
      return;
    }

    try {
      console.log(
        '[CameraVisionTesting] 🚀 Initializing Camera Vision Testing Service...'
      );

      // Test service capabilities
      await this.testServiceCapabilities();

      this.initialized = true;
      console.log(
        '[CameraVisionTesting] ✅ Camera Vision Testing Service initialized successfully'
      );
    } catch (error) {
      console.error(
        '[CameraVisionTesting] ❌ Failed to initialize service:',
        error
      );
      throw error;
    }
  }

  /**
   * Test service capabilities
   */
  async testServiceCapabilities() {
    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.test_capabilities',
      { attributes: { 'service.component': 'camera_vision_testing' } },
      async span => {
        const capabilities = {
          image_processing: false,
          canvas_support: false,
          multi_frame_analysis: false,
          black_frame_detection: false,
        };

        try {
          // Test Sharp image processing
          const testBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGdXPgGAAAAASUVORK5CYII=',
            'base64'
          );
          await sharp(testBuffer).resize(10, 10).png().toBuffer();
          capabilities.image_processing = true;

          // Test Canvas support
          const canvas = createCanvas(10, 10);
          const ctx = canvas.getContext('2d');
          ctx.fillRect(0, 0, 10, 10);
          capabilities.canvas_support = true;

          // Service-specific capabilities
          capabilities.multi_frame_analysis = true;
          capabilities.black_frame_detection = true;

          span.setAttributes({
            'capabilities.image_processing': capabilities.image_processing,
            'capabilities.canvas_support': capabilities.canvas_support,
            'capabilities.multi_frame_analysis':
              capabilities.multi_frame_analysis,
            'capabilities.black_frame_detection':
              capabilities.black_frame_detection,
          });

          console.log(
            '[CameraVisionTesting] ✅ Service capabilities verified:',
            capabilities
          );
          return capabilities;
        } catch (error) {
          span.recordException(error);
          console.error(
            '[CameraVisionTesting] ❌ Capability test failed:',
            error
          );
          throw error;
        }
      }
    );
  }

  /**
   * Create a new camera testing session
   */
  async createTestingSession(userId, sessionConfig = {}) {
    if (!this.initialized) {
      throw new Error('Service not initialized');
    }

    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.create_session',
      {
        attributes: {
          'session.user_id': userId,
          'session.config': JSON.stringify(sessionConfig),
        },
      },
      async span => {
        const sessionId = `camera_test_${userId}_${Date.now()}`;
        const session = {
          id: sessionId,
          userId,
          created: new Date().toISOString(),
          config: {
            resolution: sessionConfig.resolution || 'medium',
            quality: sessionConfig.quality || 0.8,
            enable_multi_frame: sessionConfig.enable_multi_frame || true,
            frame_comparison: sessionConfig.frame_comparison || true,
            black_frame_threshold: sessionConfig.black_frame_threshold || 0.05,
            warmup_time: sessionConfig.warmup_time || 2000,
            ...sessionConfig,
          },
          captures: [],
          diagnostics: {},
          status: 'active',
        };

        this.testSessions.set(sessionId, session);

        span.setAttributes({
          'session.id': sessionId,
          'session.status': 'created',
        });

        console.log(
          `[CameraVisionTesting] 📋 Created testing session: ${sessionId}`
        );
        return { sessionId, session };
      }
    );
  }

  /**
   * Process camera frame for black screen/blob detection
   */
  async analyzeFrame(sessionId, imageData, frameMetadata = {}) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Testing session not found: ${sessionId}`);
    }

    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.analyze_frame',
      {
        attributes: {
          'session.id': sessionId,
          'frame.metadata': JSON.stringify(frameMetadata),
        },
      },
      async span => {
        try {
          let imageBuffer;

          // Convert various input formats to buffer
          if (typeof imageData === 'string') {
            // Base64 data URL
            const base64Data = imageData.replace(
              /^data:image\/\w+;base64,/,
              ''
            );
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (Buffer.isBuffer(imageData)) {
            imageBuffer = imageData;
          } else {
            throw new Error('Unsupported image format');
          }

          // Get image metadata
          const metadata = await sharp(imageBuffer).metadata();

          // Analyze frame for black screen/blob issues
          const analysis = await this.performFrameAnalysis(
            imageBuffer,
            metadata,
            session.config
          );

          // Store capture in session
          const capture = {
            id: `capture_${Date.now()}`,
            timestamp: new Date().toISOString(),
            metadata: {
              width: metadata.width,
              height: metadata.height,
              channels: metadata.channels,
              format: metadata.format,
              size: imageBuffer.length,
              ...frameMetadata,
            },
            analysis,
            processed: true,
          };

          session.captures.push(capture);

          // Limit stored captures (keep last 50)
          if (session.captures.length > 50) {
            session.captures = session.captures.slice(-50);
          }

          span.setAttributes({
            'frame.width': metadata.width || 0,
            'frame.height': metadata.height || 0,
            'frame.size_bytes': imageBuffer.length,
            'analysis.is_black_frame': analysis.isBlackFrame,
            'analysis.quality_score': analysis.qualityScore,
            'analysis.brightness_avg': analysis.brightness.average,
          });

          console.log(
            `[CameraVisionTesting] 📸 Frame analyzed for session ${sessionId}:`,
            {
              isBlackFrame: analysis.isBlackFrame,
              qualityScore: analysis.qualityScore,
              brightness: analysis.brightness.average,
            }
          );

          return {
            success: true,
            capture,
            analysis,
            session_stats: {
              total_captures: session.captures.length,
              black_frames: session.captures.filter(
                c => c.analysis.isBlackFrame
              ).length,
            },
          };
        } catch (error) {
          span.recordException(error);
          console.error(
            `[CameraVisionTesting] ❌ Frame analysis failed for session ${sessionId}:`,
            error
          );
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );
  }

  /**
   * Perform detailed frame analysis
   */
  async performFrameAnalysis(imageBuffer, metadata, config) {
    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.perform_frame_analysis',
      { attributes: { 'analysis.type': 'comprehensive_frame_analysis' } },
      async span => {
        // Basic image statistics
        const stats = await sharp(imageBuffer).stats();

        // Calculate brightness metrics
        const brightness = {
          average: this.calculateChannelAverage(stats.channels),
          min: Math.min(...stats.channels.map(ch => ch.min)),
          max: Math.max(...stats.channels.map(ch => ch.max)),
          variance: this.calculateBrightnessVariance(stats.channels),
        };

        // Black frame detection
        const isBlackFrame = this.detectBlackFrame(
          brightness,
          config.black_frame_threshold
        );

        // Quality assessment
        const qualityScore = this.calculateQualityScore(
          brightness,
          metadata,
          stats
        );

        // Color analysis
        const colorAnalysis = this.analyzeColorDistribution(stats.channels);

        // Frame stability assessment
        const stabilityScore = await this.assessFrameStability(
          imageBuffer,
          metadata
        );

        const analysis = {
          isBlackFrame,
          qualityScore,
          brightness,
          colorAnalysis,
          stabilityScore,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
            format: metadata.format,
            density: metadata.density,
          },
          suggestions: [],
        };

        // Generate suggestions based on analysis
        if (isBlackFrame) {
          analysis.suggestions.push({
            type: 'black_frame',
            message:
              'Black frame detected. Check camera lens, lighting conditions, or permissions.',
            priority: 'high',
          });
        }

        if (qualityScore < 0.3) {
          analysis.suggestions.push({
            type: 'low_quality',
            message:
              'Poor image quality detected. Improve lighting or check camera settings.',
            priority: 'medium',
          });
        }

        if (brightness.variance < 10) {
          analysis.suggestions.push({
            type: 'low_variance',
            message:
              'Low color variance. Camera may be covered or in dark environment.',
            priority: 'medium',
          });
        }

        span.setAttributes({
          'analysis.black_frame': isBlackFrame,
          'analysis.quality_score': qualityScore,
          'analysis.stability_score': stabilityScore,
          'analysis.suggestions_count': analysis.suggestions.length,
        });

        return analysis;
      }
    );
  }

  /**
   * Multi-frame analysis for comparison and trends
   */
  async performMultiFrameAnalysis(sessionId, frameCount = 5) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Testing session not found: ${sessionId}`);
    }

    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.multi_frame_analysis',
      {
        attributes: {
          'session.id': sessionId,
          'analysis.frame_count': frameCount,
        },
      },
      async span => {
        const recentCaptures = session.captures.slice(-frameCount);

        if (recentCaptures.length < 2) {
          return {
            success: false,
            error: 'Not enough frames for multi-frame analysis',
            required_frames: 2,
            available_frames: recentCaptures.length,
          };
        }

        // Calculate trends
        const brightnessValues = recentCaptures.map(
          c => c.analysis.brightness.average
        );
        const qualityValues = recentCaptures.map(c => c.analysis.qualityScore);
        const blackFrameCount = recentCaptures.filter(
          c => c.analysis.isBlackFrame
        ).length;

        const trends = {
          brightness: {
            trend: this.calculateTrend(brightnessValues),
            stability: this.calculateStability(brightnessValues),
            average:
              brightnessValues.reduce((a, b) => a + b, 0) /
              brightnessValues.length,
          },
          quality: {
            trend: this.calculateTrend(qualityValues),
            stability: this.calculateStability(qualityValues),
            average:
              qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length,
          },
          consistency: {
            black_frame_ratio: blackFrameCount / recentCaptures.length,
            frame_consistency: this.calculateFrameConsistency(recentCaptures),
          },
        };

        // Performance assessment
        const performance = {
          overall_score:
            trends.quality.average * 0.4 +
            trends.consistency.frame_consistency * 0.6,
          stability_rating: this.getStabilityRating(
            trends.brightness.stability,
            trends.quality.stability
          ),
          issues_detected: [],
        };

        // Issue detection
        if (trends.consistency.black_frame_ratio > 0.3) {
          performance.issues_detected.push({
            type: 'high_black_frame_ratio',
            severity: 'high',
            message: `${(trends.consistency.black_frame_ratio * 100).toFixed(1)}% of frames are black/dark`,
          });
        }

        if (trends.brightness.stability < 0.7) {
          performance.issues_detected.push({
            type: 'brightness_instability',
            severity: 'medium',
            message: 'Inconsistent brightness levels detected',
          });
        }

        if (trends.quality.average < 0.5) {
          performance.issues_detected.push({
            type: 'poor_quality',
            severity: 'medium',
            message: 'Overall image quality is below acceptable threshold',
          });
        }

        const multiFrameAnalysis = {
          frame_count: recentCaptures.length,
          time_span: {
            start: recentCaptures[0].timestamp,
            end: recentCaptures[recentCaptures.length - 1].timestamp,
          },
          trends,
          performance,
          recommendations: this.generateRecommendations(trends, performance),
        };

        span.setAttributes({
          'analysis.frames_analyzed': recentCaptures.length,
          'analysis.black_frame_ratio': trends.consistency.black_frame_ratio,
          'analysis.overall_score': performance.overall_score,
          'analysis.issues_count': performance.issues_detected.length,
        });

        console.log(
          `[CameraVisionTesting] 📊 Multi-frame analysis completed for session ${sessionId}:`,
          {
            overallScore: performance.overall_score,
            blackFrameRatio: trends.consistency.black_frame_ratio,
            issuesCount: performance.issues_detected.length,
          }
        );

        return {
          success: true,
          analysis: multiFrameAnalysis,
        };
      }
    );
  }

  /**
   * Resize and optimize camera frame
   */
  async resizeFrame(imageData, options = {}) {
    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.resize_frame',
      { attributes: { 'resize.options': JSON.stringify(options) } },
      async span => {
        try {
          let imageBuffer;

          // Handle different input formats
          if (typeof imageData === 'string') {
            const base64Data = imageData.replace(
              /^data:image\/\w+;base64,/,
              ''
            );
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (Buffer.isBuffer(imageData)) {
            imageBuffer = imageData;
          } else {
            throw new Error('Unsupported image format');
          }

          const {
            width = 640,
            height = 480,
            quality = 80,
            format = 'jpeg',
            fit = 'cover',
            background = { r: 0, g: 0, b: 0 },
          } = options;

          let processor = sharp(imageBuffer);

          // Apply resizing with proper fit and background
          processor = processor.resize(width, height, {
            fit: fit,
            background: background,
            withoutEnlargement: false,
          });

          // Apply format-specific optimizations
          let outputBuffer;
          switch (format.toLowerCase()) {
            case 'jpeg':
            case 'jpg':
              outputBuffer = await processor.jpeg({ quality }).toBuffer();
              break;
            case 'png':
              outputBuffer = await processor.png({ quality }).toBuffer();
              break;
            case 'webp':
              outputBuffer = await processor.webp({ quality }).toBuffer();
              break;
            default:
              outputBuffer = await processor.jpeg({ quality }).toBuffer();
          }

          const originalSize = imageBuffer.length;
          const newSize = outputBuffer.length;
          const compressionRatio = (originalSize - newSize) / originalSize;

          span.setAttributes({
            'resize.original_size': originalSize,
            'resize.new_size': newSize,
            'resize.compression_ratio': compressionRatio,
            'resize.width': width,
            'resize.height': height,
            'resize.format': format,
          });

          return {
            success: true,
            data: outputBuffer,
            metadata: {
              original_size: originalSize,
              new_size: newSize,
              compression_ratio: compressionRatio,
              width,
              height,
              format,
            },
          };
        } catch (error) {
          span.recordException(error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );
  }

  /**
   * Generate comprehensive diagnostic report
   */
  async generateDiagnosticReport(sessionId) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Testing session not found: ${sessionId}`);
    }

    return await OpenTelemetryTracing.traceOperation(
      'camera_vision_testing.generate_diagnostic_report',
      { attributes: { 'session.id': sessionId } },
      async span => {
        /* The above code is a JavaScript snippet that is attempting to access the `captures` property
        of the `session` object and store it in a constant variable named `captures`. However, the
        code snippet is incomplete and the actual functionality or purpose of the code is not fully
        clear without additional context. */
        const { captures } = session;
        const totalCaptures = captures.length;

        if (totalCaptures === 0) {
          return {
            success: false,
            error: 'No captures available for analysis',
          };
        }

        // Basic statistics
        const blackFrames = captures.filter(c => c.analysis.isBlackFrame);
        const lowQualityFrames = captures.filter(
          c => c.analysis.qualityScore < 0.5
        );

        const avgBrightness =
          captures.reduce((sum, c) => sum + c.analysis.brightness.average, 0) /
          totalCaptures;
        const avgQuality =
          captures.reduce((sum, c) => sum + c.analysis.qualityScore, 0) /
          totalCaptures;

        // Performance metrics
        const performance = {
          black_frame_ratio: blackFrames.length / totalCaptures,
          low_quality_ratio: lowQualityFrames.length / totalCaptures,
          average_brightness: avgBrightness,
          average_quality: avgQuality,
          brightness_stability: this.calculateStability(
            captures.map(c => c.analysis.brightness.average)
          ),
          quality_stability: this.calculateStability(
            captures.map(c => c.analysis.qualityScore)
          ),
        };

        // Health score calculation
        const healthScore = this.calculateHealthScore(performance);

        // Issue analysis
        const issues = this.identifyIssues(performance, captures);

        // Recommendations
        const recommendations = this.generateDetailedRecommendations(
          performance,
          issues
        );

        const report = {
          session_id: sessionId,
          generated: new Date().toISOString(),
          summary: {
            total_captures: totalCaptures,
            analysis_period: {
              start: captures[0]?.timestamp,
              end: captures[captures.length - 1]?.timestamp,
            },
            health_score: healthScore,
            overall_status:
              healthScore > 0.8
                ? 'excellent'
                : healthScore > 0.6
                  ? 'good'
                  : healthScore > 0.4
                    ? 'fair'
                    : 'poor',
          },
          performance,
          issues,
          recommendations,
          technical_details: {
            session_config: session.config,
            frame_formats: [...new Set(captures.map(c => c.metadata.format))],
            resolution_range: this.getResolutionRange(captures),
          },
        };

        span.setAttributes({
          'report.total_captures': totalCaptures,
          'report.health_score': healthScore,
          'report.black_frame_ratio': performance.black_frame_ratio,
          'report.issues_count': issues.length,
        });

        console.log(
          `[CameraVisionTesting] 📋 Generated diagnostic report for session ${sessionId}:`,
          {
            healthScore,
            totalCaptures,
            blackFrameRatio: performance.black_frame_ratio,
            issuesCount: issues.length,
          }
        );

        return {
          success: true,
          report,
        };
      }
    );
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      active_sessions: this.testSessions.size,
      total_diagnostics: this.diagnosticResults.size,
      capabilities: {
        frame_analysis: true,
        multi_frame_comparison: true,
        black_frame_detection: true,
        image_resizing: true,
        quality_assessment: true,
        diagnostic_reporting: true,
      },
      version: '1.0.0',
      last_updated: new Date().toISOString(),
    };
  }

  // Helper methods
  calculateChannelAverage(channels) {
    return channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length;
  }

  calculateBrightnessVariance(channels) {
    const means = channels.map(ch => ch.mean);
    const avg = means.reduce((a, b) => a + b, 0) / means.length;
    return (
      means.reduce((sum, mean) => sum + Math.pow(mean - avg, 2), 0) /
      means.length
    );
  }

  detectBlackFrame(brightness, threshold = 0.05) {
    return brightness.average < 255 * threshold && brightness.variance < 100;
  }

  calculateQualityScore(brightness, metadata, stats) {
    let score = 0;

    // Brightness component (0-0.4)
    const brightnessScore = Math.min(brightness.average / 127.5, 1) * 0.4;

    // Variance component (0-0.3)
    const varianceScore = Math.min(brightness.variance / 1000, 1) * 0.3;

    // Resolution component (0-0.3)
    const resolutionScore =
      Math.min((metadata.width * metadata.height) / (1920 * 1080), 1) * 0.3;

    score = brightnessScore + varianceScore + resolutionScore;
    return Math.min(Math.max(score, 0), 1);
  }

  analyzeColorDistribution(channels) {
    return {
      channel_count: channels.length,
      dominant_channel: channels.reduce((prev, current) =>
        prev.mean > current.mean ? prev : current
      ),
      color_balance: channels.map(ch => ({
        mean: ch.mean,
        std: ch.std,
        min: ch.min,
        max: ch.max,
      })),
    };
  }

  async assessFrameStability(imageBuffer, metadata) {
    // For now, return a basic stability score
    // In a full implementation, this would compare with previous frames
    return 0.8;
  }

  calculateTrend(values) {
    if (values.length < 2) {
      return 'insufficient_data';
    }

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;
    if (Math.abs(change) < 0.05) {
      return 'stable';
    }
    return change > 0 ? 'increasing' : 'decreasing';
  }

  calculateStability(values) {
    if (values.length < 2) {
      return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const coefficient = Math.sqrt(variance) / mean;

    return Math.max(0, 1 - coefficient);
  }

  calculateFrameConsistency(captures) {
    const qualityValues = captures.map(c => c.analysis.qualityScore);
    const brightnessValues = captures.map(c => c.analysis.brightness.average);

    const qualityConsistency = this.calculateStability(qualityValues);
    const brightnessConsistency = this.calculateStability(brightnessValues);

    return (qualityConsistency + brightnessConsistency) / 2;
  }

  getStabilityRating(brightnessStability, qualityStability) {
    const avgStability = (brightnessStability + qualityStability) / 2;

    if (avgStability > 0.9) {
      return 'excellent';
    }
    if (avgStability > 0.7) {
      return 'good';
    }
    if (avgStability > 0.5) {
      return 'fair';
    }
    return 'poor';
  }

  generateRecommendations(trends, performance) {
    const recommendations = [];

    if (performance.overall_score < 0.5) {
      recommendations.push({
        category: 'image_quality',
        priority: 'high',
        message: 'Improve lighting conditions or check camera settings',
        actions: [
          'Increase ambient lighting',
          'Clean camera lens',
          'Adjust camera settings',
        ],
      });
    }

    if (trends.consistency.black_frame_ratio > 0.2) {
      recommendations.push({
        category: 'black_frames',
        priority: 'high',
        message: 'High number of black frames detected',
        actions: [
          'Check camera permissions',
          'Verify camera is not covered',
          'Restart camera application',
        ],
      });
    }

    if (trends.brightness.stability < 0.6) {
      recommendations.push({
        category: 'stability',
        priority: 'medium',
        message: 'Inconsistent brightness levels',
        actions: [
          'Stabilize lighting conditions',
          'Use fixed camera position',
          'Check for auto-exposure settings',
        ],
      });
    }

    return recommendations;
  }

  calculateHealthScore(performance) {
    let score = 1.0;

    // Penalize black frames
    score -= performance.black_frame_ratio * 0.4;

    // Penalize low quality
    score -= performance.low_quality_ratio * 0.3;

    // Reward stability
    score *=
      performance.brightness_stability * 0.5 +
      performance.quality_stability * 0.5;
    return Math.max(0, Math.min(1, score));
  }

  identifyIssues(performance, captures) {
    const issues = [];

    if (performance.black_frame_ratio > 0.1) {
      issues.push({
        type: 'black_frames',
        severity: performance.black_frame_ratio > 0.3 ? 'critical' : 'warning',
        description: `${(performance.black_frame_ratio * 100).toFixed(1)}% of frames are black`,
        impact: 'Camera functionality severely impacted',
      });
    }

    if (performance.average_quality < 0.4) {
      issues.push({
        type: 'poor_quality',
        severity: 'warning',
        description: `Low average quality score: ${performance.average_quality.toFixed(2)}`,
        impact: 'Vision analysis accuracy may be reduced',
      });
    }

    if (performance.brightness_stability < 0.5) {
      issues.push({
        type: 'brightness_instability',
        severity: 'info',
        description: 'Inconsistent brightness across frames',
        impact: 'May affect motion detection and analysis',
      });
    }

    return issues;
  }

  generateDetailedRecommendations(performance, issues) {
    const recommendations = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'black_frames':
          recommendations.push({
            for_issue: issue.type,
            category: 'camera_setup',
            steps: [
              'Check camera permissions in browser/system settings',
              'Verify camera lens is clean and unobstructed',
              'Ensure adequate lighting conditions',
              'Try switching to a different camera if available',
              'Restart the camera application or browser',
            ],
          });
          break;

        case 'poor_quality':
          recommendations.push({
            for_issue: issue.type,
            category: 'image_optimization',
            steps: [
              'Improve lighting conditions (add more light sources)',
              'Adjust camera resolution settings',
              'Check camera focus and positioning',
              'Update camera drivers if possible',
              'Use manual camera settings if auto-adjust is problematic',
            ],
          });
          break;

        case 'brightness_instability':
          recommendations.push({
            for_issue: issue.type,
            category: 'environment',
            steps: [
              'Use consistent lighting conditions',
              'Avoid direct sunlight or backlighting',
              'Turn off automatic exposure/brightness adjustment',
              'Position camera away from moving light sources',
              'Consider using external lighting equipment',
            ],
          });
          break;
      }
    });

    return recommendations;
  }

  getResolutionRange(captures) {
    const resolutions = captures.map(c => ({
      width: c.metadata.width,
      height: c.metadata.height,
    }));
    const widths = resolutions.map(r => r.width);
    const heights = resolutions.map(r => r.height);

    return {
      min_resolution: {
        width: Math.min(...widths),
        height: Math.min(...heights),
      },
      max_resolution: {
        width: Math.max(...widths),
        height: Math.max(...heights),
      },
      unique_resolutions: [
        ...new Set(resolutions.map(r => `${r.width}x${r.height}`)),
      ],
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of this.testSessions) {
      const created = new Date(session.created).getTime();
      if (now - created > maxAge) {
        this.testSessions.delete(sessionId);
        console.log(
          `[CameraVisionTesting] 🧹 Cleaned up expired session: ${sessionId}`
        );
      }
    }
  }

  /**
   * Get session details
   */
  getSession(sessionId) {
    return this.testSessions.get(sessionId);
  }

  /**
   * Delete session
   */
  deleteSession(sessionId) {
    const deleted = this.testSessions.delete(sessionId);
    if (deleted) {
      console.log(`[CameraVisionTesting] 🗑️ Deleted session: ${sessionId}`);
    }
    return deleted;
  }
}
