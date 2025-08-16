/**
 * AnomalyDetector - Comprehensive anomaly detection system for time series and multi-dimensional data
 * 
 * This service provides advanced anomaly detection capabilities including:
 * - Statistical anomaly detection using multiple algorithms
 * - Machine learning-based anomaly detection with isolation forests
 * - Real-time streaming anomaly detection with adaptive thresholds
 * - Multi-variate anomaly detection for complex data patterns
 * - Contextual anomaly detection based on historical patterns
 * - Ensemble anomaly detection combining multiple techniques
 * 
 * Features:
 * - Z-score, Modified Z-score, IQR, and Isolation Forest algorithms
 * - Dynamic threshold adaptation based on data distribution changes
 * - Seasonal anomaly detection with pattern-aware algorithms
 * - Clustering-based anomaly detection for complex patterns
 * - Real-time alerting and notification system
 * - Historical anomaly analysis and trend tracking
 */

import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class AnomalyDetector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration with intelligent defaults
        this.config = {
            // Detection algorithms configuration
            enabledAlgorithms: options.enabledAlgorithms || [
                'z_score', 'modified_z_score', 'iqr', 'isolation_forest', 'local_outlier_factor'
            ],
            
            // Threshold settings
            zScoreThreshold: options.zScoreThreshold || 3.0,
            modifiedZScoreThreshold: options.modifiedZScoreThreshold || 3.5,
            iqrMultiplier: options.iqrMultiplier || 1.5,
            isolationForestContamination: options.isolationForestContamination || 0.1,
            lofNeighbors: options.lofNeighbors || 20,
            
            // Adaptive threshold settings
            adaptiveThresholds: options.adaptiveThresholds || true,
            adaptationRate: options.adaptationRate || 0.1,
            minAdaptationSamples: options.minAdaptationSamples || 100,
            
            // Ensemble settings
            ensembleMethod: options.ensembleMethod || 'voting', // 'voting', 'weighted', 'consensus'
            consensusThreshold: options.consensusThreshold || 0.5,
            algorithmWeights: options.algorithmWeights || 'auto', // 'auto' or custom weights
            
            // Seasonal anomaly detection
            seasonalDetection: options.seasonalDetection || true,
            seasonalPeriods: options.seasonalPeriods || [24, 168, 720], // hourly, daily, monthly
            seasonalThresholdMultiplier: options.seasonalThresholdMultiplier || 1.2,
            
            // Multi-variate settings
            multivariateDetection: options.multivariateDetection || true,
            correlationThreshold: options.correlationThreshold || 0.7,
            maxDimensions: options.maxDimensions || 10,
            
            // Real-time processing
            windowSize: options.windowSize || 100,
            slideSize: options.slideSize || 1,
            minWindowFill: options.minWindowFill || 0.8,
            updateInterval: options.updateInterval || 60000, // 1 minute
            
            // Alert and notification settings
            alertThresholds: {
                low: options.lowAlertThreshold || 0.3,
                medium: options.mediumAlertThreshold || 0.6,
                high: options.highAlertThreshold || 0.8,
                critical: options.criticalAlertThreshold || 0.95
            },
            
            alertCooldown: options.alertCooldown || 300000, // 5 minutes
            maxAlertsPerHour: options.maxAlertsPerHour || 20,
            
            // Performance settings
            maxConcurrentDetections: options.maxConcurrentDetections || 10,
            historyRetention: options.historyRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
            cacheSize: options.cacheSize || 1000,
            
            ...options
        };

        // Data storage and processing
        this.dataStreams = new Map(); // Store time series data streams
        this.slidingWindows = new Map(); // Sliding windows for real-time detection
        this.anomalies = new Map(); // Detected anomalies storage
        this.models = new Map(); // Trained models for each data stream
        
        // Adaptive threshold tracking
        this.adaptiveThresholds = new Map();
        this.thresholdHistory = new Map();
        
        // Seasonal pattern storage
        this.seasonalPatterns = new Map();
        this.seasonalBaselines = new Map();
        
        // Alert management
        this.alertHistory = new Map();
        this.alertCooldowns = new Map();
        
        // Detection state
        this.activeDetections = new Set();
        this.detectionQueue = [];
        
        // Performance metrics
        this.metrics = {
            totalDetections: 0,
            anomaliesDetected: 0,
            falsePositives: 0,
            truePositives: 0,
            algorithmPerformance: new Map(),
            detectionTimes: [],
            alertsSent: 0,
            accuracyHistory: []
        };
        
        // Algorithm implementations
        this.algorithms = {
            z_score: this.detectZScoreAnomalies.bind(this),
            modified_z_score: this.detectModifiedZScoreAnomalies.bind(this),
            iqr: this.detectIQRAnomalies.bind(this),
            isolation_forest: this.detectIsolationForestAnomalies.bind(this),
            local_outlier_factor: this.detectLOFAnomalies.bind(this),
            seasonal: this.detectSeasonalAnomalies.bind(this),
            multivariate: this.detectMultivariateAnomalies.bind(this)
        };
        
        // OpenTelemetry tracing setup
        this.tracer = OpenTelemetryTracing.getTracer('anomaly-detector');
        
        // Background processing intervals
        this.intervals = {
            detection: null,
            adaptation: null,
            cleanup: null
        };
        
        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the anomaly detection system
     */
    async initialize() {
        return this.tracer.startActiveSpan('anomaly-detector-initialize', async (span) => {
            try {
                span.setAttributes({
                    'anomaly.component': 'AnomalyDetector',
                    'anomaly.operation': 'initialize'
                });

                console.log('🔍 Initializing Anomaly Detector...');
                
                // Initialize detection algorithms
                await this.initializeAlgorithms();
                
                // Setup real-time processing
                await this.setupRealTimeProcessing();
                
                // Initialize adaptive thresholds
                await this.initializeAdaptiveThresholds();
                
                // Setup seasonal detection
                await this.setupSeasonalDetection();
                
                // Initialize alert system
                await this.initializeAlertSystem();
                
                // Start background processing
                this.startBackgroundProcessing();
                
                this.initialized = true;
                console.log('✅ Anomaly Detector initialized successfully');
                
                span.setStatus({ code: 1, message: 'Anomaly detector initialized' });
                this.emit('initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize anomaly detector:', error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Initialize detection algorithms
     */
    async initializeAlgorithms() {
        console.log('🤖 Initializing detection algorithms...');
        
        // Initialize algorithm-specific configurations
        for (const algorithm of this.config.enabledAlgorithms) {
            this.metrics.algorithmPerformance.set(algorithm, {
                detections: 0,
                truePositives: 0,
                falsePositives: 0,
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1Score: 0,
                lastUpdate: Date.now()
            });
        }
        
        console.log(`✅ Initialized ${this.config.enabledAlgorithms.length} detection algorithms`);
    }

    /**
     * Setup real-time processing
     */
    async setupRealTimeProcessing() {
        console.log('⚡ Setting up real-time processing...');
        
        // Configure sliding window parameters
        this.slidingWindowConfig = {
            windowSize: this.config.windowSize,
            slideSize: this.config.slideSize,
            minFill: this.config.minWindowFill,
            overlapRatio: 1 - (this.config.slideSize / this.config.windowSize)
        };
        
        console.log('✅ Real-time processing configured');
    }

    /**
     * Initialize adaptive thresholds
     */
    async initializeAdaptiveThresholds() {
        console.log('📊 Initializing adaptive thresholds...');
        
        // Setup adaptive threshold tracking for each algorithm
        for (const algorithm of this.config.enabledAlgorithms) {
            this.adaptiveThresholds.set(algorithm, {
                current: this.getDefaultThreshold(algorithm),
                baseline: this.getDefaultThreshold(algorithm),
                adaptationCount: 0,
                lastAdaptation: Date.now(),
                history: []
            });
        }
        
        console.log('✅ Adaptive thresholds initialized');
    }

    /**
     * Setup seasonal detection
     */
    async setupSeasonalDetection() {
        if (!this.config.seasonalDetection) return;
        
        console.log('🌐 Setting up seasonal detection...');
        
        // Initialize seasonal pattern analysis
        this.seasonalConfig = {
            periods: this.config.seasonalPeriods,
            minCycles: 2,
            confidenceThreshold: 0.7,
            patternUpdateInterval: 24 * 60 * 60 * 1000 // Daily updates
        };
        
        console.log('✅ Seasonal detection configured');
    }

    /**
     * Initialize alert system
     */
    async initializeAlertSystem() {
        console.log('🚨 Initializing alert system...');
        
        // Setup alert severity levels
        this.alertSeverityLevels = {
            low: { priority: 1, color: 'yellow', description: 'Minor anomaly detected' },
            medium: { priority: 2, color: 'orange', description: 'Moderate anomaly detected' },
            high: { priority: 3, color: 'red', description: 'Significant anomaly detected' },
            critical: { priority: 4, color: 'darkred', description: 'Critical anomaly detected' }
        };
        
        console.log('✅ Alert system initialized');
    }

    /**
     * Start background processing
     */
    startBackgroundProcessing() {
        console.log('⚡ Starting background processing...');
        
        // Real-time detection interval
        this.intervals.detection = setInterval(() => {
            this.processDetectionQueue();
        }, this.config.updateInterval / 2);
        
        // Threshold adaptation interval
        this.intervals.adaptation = setInterval(() => {
            this.adaptThresholds();
        }, this.config.updateInterval * 2);
        
        // Cleanup interval
        this.intervals.cleanup = setInterval(() => {
            this.performCleanup();
        }, 60 * 60 * 1000); // Hourly cleanup
        
        this.isRunning = true;
        console.log('✅ Background processing started');
    }

    /**
     * Add data for anomaly detection
     */
    async addData(streamName, data, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Anomaly detector not initialized');
        }

        return this.tracer.startActiveSpan('anomaly-add-data', async (span) => {
            try {
                span.setAttributes({
                    'anomaly.stream_name': streamName,
                    'anomaly.data_points': Array.isArray(data) ? data.length : 1,
                    'anomaly.operation': 'add_data'
                });

                // Initialize stream if it doesn't exist
                if (!this.dataStreams.has(streamName)) {
                    this.dataStreams.set(streamName, {
                        data: [],
                        metadata: {
                            created: Date.now(),
                            lastUpdated: Date.now(),
                            ...metadata
                        },
                        statistics: {
                            count: 0,
                            mean: 0,
                            variance: 0,
                            min: Infinity,
                            max: -Infinity
                        }
                    });
                    
                    // Initialize sliding window
                    this.slidingWindows.set(streamName, []);
                }

                const stream = this.dataStreams.get(streamName);
                const slidingWindow = this.slidingWindows.get(streamName);

                // Add new data points
                const newPoints = Array.isArray(data) ? data : [data];
                
                for (const point of newPoints) {
                    const dataPoint = {
                        timestamp: point.timestamp || Date.now(),
                        value: Array.isArray(point.value) ? point.value : [point.value],
                        metadata: point.metadata || {}
                    };

                    // Add to stream
                    stream.data.push(dataPoint);
                    
                    // Add to sliding window
                    slidingWindow.push(dataPoint);
                    
                    // Maintain sliding window size
                    if (slidingWindow.length > this.config.windowSize) {
                        slidingWindow.shift();
                    }
                    
                    // Update statistics
                    this.updateStreamStatistics(stream, dataPoint);
                }

                // Maintain data retention
                const maxHistory = Math.max(10000, this.config.windowSize * 10);
                if (stream.data.length > maxHistory) {
                    stream.data = stream.data.slice(-maxHistory);
                }

                // Update metadata
                stream.metadata.lastUpdated = Date.now();

                // Queue for real-time detection if window is sufficiently filled
                const fillRatio = slidingWindow.length / this.config.windowSize;
                if (fillRatio >= this.config.minWindowFill) {
                    this.queueDetection(streamName);
                }

                span.setStatus({ code: 1, message: 'Data added successfully' });
                this.emit('data-added', { streamName, dataPoints: newPoints.length });

            } catch (error) {
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Detect anomalies in data stream
     */
    async detectAnomalies(streamName, options = {}) {
        if (this.activeDetections.size >= this.config.maxConcurrentDetections) {
            return { error: 'Maximum concurrent detections reached' };
        }

        const detectionId = `${streamName}-${Date.now()}`;
        this.activeDetections.add(detectionId);

        return this.tracer.startActiveSpan('anomaly-detect-anomalies', async (span) => {
            try {
                span.setAttributes({
                    'anomaly.stream_name': streamName,
                    'anomaly.detection_id': detectionId,
                    'anomaly.operation': 'detect_anomalies'
                });

                const startTime = Date.now();
                
                const stream = this.dataStreams.get(streamName);
                if (!stream) {
                    throw new Error(`Data stream ${streamName} not found`);
                }

                const slidingWindow = this.slidingWindows.get(streamName) || [];
                if (slidingWindow.length < this.config.windowSize * this.config.minWindowFill) {
                    throw new Error(`Insufficient data in sliding window for ${streamName}`);
                }

                console.log(`🔍 Detecting anomalies for ${streamName}...`);

                // Run enabled algorithms
                const algorithmResults = {};
                const detectedAnomalies = [];
                
                for (const algorithm of this.config.enabledAlgorithms) {
                    try {
                        const result = await this.algorithms[algorithm](slidingWindow, streamName);
                        algorithmResults[algorithm] = result;
                        
                        // Update algorithm performance metrics
                        this.updateAlgorithmMetrics(algorithm, result);
                        
                    } catch (error) {
                        console.warn(`Algorithm ${algorithm} failed:`, error.message);
                        algorithmResults[algorithm] = { 
                            anomalies: [], 
                            score: 0, 
                            error: error.message 
                        };
                    }
                }

                // Create ensemble detection result
                const ensembleResult = await this.createEnsembleResult(
                    algorithmResults, slidingWindow, streamName
                );

                // Generate alerts for significant anomalies
                const alerts = await this.generateAlerts(
                    ensembleResult.anomalies, streamName
                );

                // Compile results
                const results = {
                    streamName,
                    detectionId,
                    timestamp: Date.now(),
                    processingTime: Date.now() - startTime,
                    windowSize: slidingWindow.length,
                    algorithms: algorithmResults,
                    ensemble: ensembleResult,
                    alerts,
                    metadata: {
                        algorithmsUsed: Object.keys(algorithmResults),
                        ensembleMethod: this.config.ensembleMethod,
                        adaptiveThresholds: this.config.adaptiveThresholds
                    }
                };

                // Store anomalies for historical analysis
                this.storeAnomalies(streamName, results);

                // Update metrics
                this.updateDetectionMetrics(results);

                // Emit results
                this.emit('anomalies-detected', results);

                span.setAttributes({
                    'anomaly.processing_time_ms': results.processingTime,
                    'anomaly.anomalies_found': ensembleResult.anomalies.length,
                    'anomaly.alerts_generated': alerts.length
                });

                span.setStatus({ code: 1, message: 'Anomaly detection completed' });
                return results;

            } catch (error) {
                console.error(`❌ Error detecting anomalies for ${streamName}:`, error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                this.activeDetections.delete(detectionId);
                span.end();
            }
        });
    }

    /**
     * Z-score anomaly detection
     */
    async detectZScoreAnomalies(window, streamName) {
        const values = window.map(point => 
            Array.isArray(point.value) ? point.value[0] : point.value
        );
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        const threshold = this.adaptiveThresholds.get('z_score')?.current || this.config.zScoreThreshold;
        const anomalies = [];
        let maxScore = 0;
        
        window.forEach((point, index) => {
            const value = Array.isArray(point.value) ? point.value[0] : point.value;
            const zScore = Math.abs((value - mean) / stdDev);
            
            if (zScore > threshold) {
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value,
                    score: zScore / threshold,
                    method: 'z_score',
                    threshold,
                    details: {
                        zScore,
                        mean,
                        stdDev
                    }
                });
            }
            
            maxScore = Math.max(maxScore, zScore / threshold);
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'z_score',
            parameters: { threshold, mean, stdDev }
        };
    }

    /**
     * Modified Z-score anomaly detection (more robust to outliers)
     */
    async detectModifiedZScoreAnomalies(window, streamName) {
        const values = window.map(point => 
            Array.isArray(point.value) ? point.value[0] : point.value
        );
        
        const median = this.calculateMedian(values);
        const deviations = values.map(val => Math.abs(val - median));
        const mad = this.calculateMedian(deviations); // Median Absolute Deviation
        
        const threshold = this.adaptiveThresholds.get('modified_z_score')?.current || 
                         this.config.modifiedZScoreThreshold;
        const anomalies = [];
        let maxScore = 0;
        
        window.forEach((point, index) => {
            const value = Array.isArray(point.value) ? point.value[0] : point.value;
            const modifiedZScore = 0.6745 * Math.abs((value - median) / mad);
            
            if (modifiedZScore > threshold) {
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value,
                    score: modifiedZScore / threshold,
                    method: 'modified_z_score',
                    threshold,
                    details: {
                        modifiedZScore,
                        median,
                        mad
                    }
                });
            }
            
            maxScore = Math.max(maxScore, modifiedZScore / threshold);
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'modified_z_score',
            parameters: { threshold, median, mad }
        };
    }

    /**
     * IQR (Interquartile Range) anomaly detection
     */
    async detectIQRAnomalies(window, streamName) {
        const values = window.map(point => 
            Array.isArray(point.value) ? point.value[0] : point.value
        ).sort((a, b) => a - b);
        
        const q1 = values[Math.floor(values.length * 0.25)];
        const q3 = values[Math.floor(values.length * 0.75)];
        const iqr = q3 - q1;
        const multiplier = this.config.iqrMultiplier;
        
        const lowerBound = q1 - multiplier * iqr;
        const upperBound = q3 + multiplier * iqr;
        
        const anomalies = [];
        let maxScore = 0;
        
        window.forEach((point, index) => {
            const value = Array.isArray(point.value) ? point.value[0] : point.value;
            
            if (value < lowerBound || value > upperBound) {
                const distance = value < lowerBound ? 
                    Math.abs(value - lowerBound) : 
                    Math.abs(value - upperBound);
                const score = distance / iqr;
                
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value,
                    score: score,
                    method: 'iqr',
                    threshold: `[${lowerBound}, ${upperBound}]`,
                    details: {
                        q1,
                        q3,
                        iqr,
                        lowerBound,
                        upperBound,
                        distance
                    }
                });
                
                maxScore = Math.max(maxScore, score);
            }
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'iqr',
            parameters: { q1, q3, iqr, lowerBound, upperBound, multiplier }
        };
    }

    /**
     * Isolation Forest anomaly detection
     */
    async detectIsolationForestAnomalies(window, streamName) {
        // Simplified Isolation Forest implementation
        const features = window.map(point => 
            Array.isArray(point.value) ? point.value : [point.value]
        );
        
        const contamination = this.config.isolationForestContamination;
        const numTrees = 100;
        const maxDepth = Math.ceil(Math.log2(features.length));
        
        // Calculate isolation scores
        const scores = features.map((feature, index) => {
            let totalDepth = 0;
            
            for (let tree = 0; tree < numTrees; tree++) {
                totalDepth += this.calculateIsolationDepth(feature, features, 0, maxDepth);
            }
            
            const avgDepth = totalDepth / numTrees;
            const expectedDepth = 2 * (Math.log(features.length - 1) + 0.5772156649) - 
                                2 * (features.length - 1) / features.length;
            
            return Math.pow(2, -avgDepth / expectedDepth);
        });
        
        // Determine threshold based on contamination rate
        const sortedScores = [...scores].sort((a, b) => b - a);
        const thresholdIndex = Math.floor(contamination * sortedScores.length);
        const threshold = sortedScores[thresholdIndex] || 0.5;
        
        const anomalies = [];
        let maxScore = 0;
        
        scores.forEach((score, index) => {
            if (score > threshold) {
                const point = window[index];
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value: Array.isArray(point.value) ? point.value[0] : point.value,
                    score: score,
                    method: 'isolation_forest',
                    threshold,
                    details: {
                        isolationScore: score,
                        expectedDepth: 2 * (Math.log(features.length - 1) + 0.5772156649) - 
                                     2 * (features.length - 1) / features.length
                    }
                });
            }
            
            maxScore = Math.max(maxScore, score);
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'isolation_forest',
            parameters: { contamination, threshold, numTrees, maxDepth }
        };
    }

    /**
     * Local Outlier Factor (LOF) anomaly detection
     */
    async detectLOFAnomalies(window, streamName) {
        const features = window.map(point => 
            Array.isArray(point.value) ? point.value : [point.value]
        );
        
        const k = Math.min(this.config.lofNeighbors, Math.floor(features.length / 2));
        if (k < 2) return { anomalies: [], score: 0, method: 'lof' };
        
        const lofScores = [];
        
        for (let i = 0; i < features.length; i++) {
            // Calculate k-distance and k-nearest neighbors
            const distances = features.map((feature, idx) => ({
                index: idx,
                distance: this.calculateEuclideanDistance(features[i], feature)
            }));
            
            distances.sort((a, b) => a.distance - b.distance);
            const kNearest = distances.slice(1, k + 1); // Exclude self
            const kDistance = kNearest[kNearest.length - 1].distance;
            
            // Calculate local reachability density
            let sumReachabilityDistance = 0;
            kNearest.forEach(neighbor => {
                const neighborKDistance = this.calculateKDistance(features, neighbor.index, k);
                const reachabilityDistance = Math.max(neighbor.distance, neighborKDistance);
                sumReachabilityDistance += reachabilityDistance;
            });
            
            const lrd = k / (sumReachabilityDistance || 1);
            
            // Calculate LOF score
            let sumNeighborLRD = 0;
            kNearest.forEach(neighbor => {
                const neighborLRD = this.calculateLRD(features, neighbor.index, k);
                sumNeighborLRD += neighborLRD;
            });
            
            const lofScore = (sumNeighborLRD / k) / (lrd || 1);
            lofScores.push(lofScore);
        }
        
        // Identify anomalies (LOF > threshold)
        const threshold = 1.5; // Typical LOF threshold
        const anomalies = [];
        let maxScore = 0;
        
        lofScores.forEach((score, index) => {
            if (score > threshold) {
                const point = window[index];
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value: Array.isArray(point.value) ? point.value[0] : point.value,
                    score: score / threshold,
                    method: 'lof',
                    threshold,
                    details: {
                        lofScore: score,
                        kNeighbors: k
                    }
                });
            }
            
            maxScore = Math.max(maxScore, score / threshold);
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'lof',
            parameters: { k, threshold }
        };
    }

    /**
     * Seasonal anomaly detection
     */
    async detectSeasonalAnomalies(window, streamName) {
        if (!this.config.seasonalDetection) {
            return { anomalies: [], score: 0, method: 'seasonal' };
        }
        
        const seasonalPattern = this.seasonalPatterns.get(streamName);
        if (!seasonalPattern) {
            // Need to build seasonal pattern first
            await this.buildSeasonalPattern(streamName);
            return { anomalies: [], score: 0, method: 'seasonal' };
        }
        
        const anomalies = [];
        let maxScore = 0;
        
        window.forEach((point, index) => {
            const value = Array.isArray(point.value) ? point.value[0] : point.value;
            const expectedValue = this.getExpectedSeasonalValue(point.timestamp, seasonalPattern);
            const threshold = seasonalPattern.threshold * this.config.seasonalThresholdMultiplier;
            
            const deviation = Math.abs(value - expectedValue);
            if (deviation > threshold) {
                const score = deviation / threshold;
                
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value,
                    score,
                    method: 'seasonal',
                    threshold,
                    details: {
                        expectedValue,
                        deviation,
                        seasonalPeriod: seasonalPattern.period
                    }
                });
                
                maxScore = Math.max(maxScore, score);
            }
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'seasonal',
            parameters: { period: seasonalPattern.period, threshold: seasonalPattern.threshold }
        };
    }

    /**
     * Multivariate anomaly detection
     */
    async detectMultivariateAnomalies(window, streamName) {
        if (!this.config.multivariateDetection) {
            return { anomalies: [], score: 0, method: 'multivariate' };
        }
        
        // Check if we have multivariate data
        const samplePoint = window[0];
        if (!Array.isArray(samplePoint.value) || samplePoint.value.length <= 1) {
            return { anomalies: [], score: 0, method: 'multivariate' };
        }
        
        const dimensions = samplePoint.value.length;
        if (dimensions > this.config.maxDimensions) {
            return { anomalies: [], score: 0, method: 'multivariate' };
        }
        
        // Use Mahalanobis distance for multivariate anomaly detection
        const features = window.map(point => point.value);
        const mean = this.calculateMultivariateMean(features);
        const covariance = this.calculateCovarianceMatrix(features, mean);
        const invCovariance = this.invertMatrix(covariance);
        
        if (!invCovariance) {
            return { anomalies: [], score: 0, method: 'multivariate' };
        }
        
        const anomalies = [];
        let maxScore = 0;
        const threshold = 3.0; // Chi-square threshold for given dimensions
        
        window.forEach((point, index) => {
            const mahalanobisDistance = this.calculateMahalanobisDistance(
                point.value, mean, invCovariance
            );
            
            if (mahalanobisDistance > threshold) {
                const score = mahalanobisDistance / threshold;
                
                anomalies.push({
                    index,
                    timestamp: point.timestamp,
                    value: point.value,
                    score,
                    method: 'multivariate',
                    threshold,
                    details: {
                        mahalanobisDistance,
                        dimensions
                    }
                });
                
                maxScore = Math.max(maxScore, score);
            }
        });
        
        return {
            anomalies,
            score: maxScore,
            method: 'multivariate',
            parameters: { dimensions, threshold }
        };
    }

    /**
     * Create ensemble result from individual algorithm results
     */
    async createEnsembleResult(algorithmResults, window, streamName) {
        const ensembleAnomalies = [];
        const method = this.config.ensembleMethod;
        const algorithms = Object.keys(algorithmResults);
        
        // Create a map of all detected anomalies by timestamp
        const anomalyMap = new Map();
        
        algorithms.forEach(algorithm => {
            const result = algorithmResults[algorithm];
            if (result.anomalies) {
                result.anomalies.forEach(anomaly => {
                    const key = `${anomaly.timestamp}_${anomaly.index}`;
                    if (!anomalyMap.has(key)) {
                        anomalyMap.set(key, {
                            ...anomaly,
                            detectedBy: [algorithm],
                            scores: new Map([[algorithm, anomaly.score]]),
                            confidence: 0
                        });
                    } else {
                        const existing = anomalyMap.get(key);
                        existing.detectedBy.push(algorithm);
                        existing.scores.set(algorithm, anomaly.score);
                    }
                });
            }
        });
        
        // Apply ensemble method
        anomalyMap.forEach((anomaly, key) => {
            let shouldInclude = false;
            let ensembleScore = 0;
            let confidence = 0;
            
            switch (method) {
                case 'voting':
                    // Include if detected by majority of algorithms
                    shouldInclude = anomaly.detectedBy.length > algorithms.length / 2;
                    ensembleScore = Array.from(anomaly.scores.values()).reduce((a, b) => a + b, 0) / 
                                  anomaly.scores.size;
                    confidence = anomaly.detectedBy.length / algorithms.length;
                    break;
                    
                case 'consensus':
                    // Include if consensus threshold is met
                    const consensusRatio = anomaly.detectedBy.length / algorithms.length;
                    shouldInclude = consensusRatio >= this.config.consensusThreshold;
                    ensembleScore = Array.from(anomaly.scores.values()).reduce((a, b) => a + b, 0) / 
                                  anomaly.scores.size;
                    confidence = consensusRatio;
                    break;
                    
                case 'weighted':
                    // Use weighted average with algorithm performance
                    let weightedScore = 0;
                    let totalWeight = 0;
                    
                    anomaly.detectedBy.forEach(algorithm => {
                        const weight = this.getAlgorithmWeight(algorithm);
                        const score = anomaly.scores.get(algorithm);
                        weightedScore += score * weight;
                        totalWeight += weight;
                    });
                    
                    ensembleScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
                    shouldInclude = ensembleScore > 0.5;
                    confidence = Math.min(1, totalWeight / algorithms.length);
                    break;
            }
            
            if (shouldInclude) {
                ensembleAnomalies.push({
                    ...anomaly,
                    ensembleScore,
                    confidence,
                    method: 'ensemble',
                    ensembleMethod: method
                });
            }
        });
        
        // Sort by ensemble score
        ensembleAnomalies.sort((a, b) => b.ensembleScore - a.ensembleScore);
        
        return {
            anomalies: ensembleAnomalies,
            method: 'ensemble',
            ensembleMethod: method,
            algorithmsUsed: algorithms,
            totalDetections: anomalyMap.size,
            ensembleDetections: ensembleAnomalies.length
        };
    }

    /**
     * Generate alerts for detected anomalies
     */
    async generateAlerts(anomalies, streamName) {
        const alerts = [];
        const now = Date.now();
        
        // Check alert cooldown
        const lastAlert = this.alertCooldowns.get(streamName);
        if (lastAlert && now - lastAlert < this.config.alertCooldown) {
            return alerts; // Still in cooldown period
        }
        
        // Check rate limiting
        const hourlyAlerts = this.getHourlyAlertCount();
        if (hourlyAlerts >= this.config.maxAlertsPerHour) {
            return alerts; // Rate limit exceeded
        }
        
        for (const anomaly of anomalies) {
            const severity = this.determineAlertSeverity(anomaly);
            
            if (severity !== 'none') {
                const alert = {
                    id: `alert_${streamName}_${anomaly.timestamp}`,
                    streamName,
                    timestamp: now,
                    severity,
                    anomaly: {
                        timestamp: anomaly.timestamp,
                        value: anomaly.value,
                        score: anomaly.ensembleScore || anomaly.score,
                        confidence: anomaly.confidence || 1,
                        method: anomaly.method,
                        detectedBy: anomaly.detectedBy || [anomaly.method]
                    },
                    message: this.generateAlertMessage(anomaly, severity),
                    metadata: {
                        streamName,
                        detectionMethod: anomaly.method,
                        severity
                    }
                };
                
                alerts.push(alert);
            }
        }
        
        // Update alert tracking
        if (alerts.length > 0) {
            this.alertCooldowns.set(streamName, now);
            this.metrics.alertsSent += alerts.length;
            
            // Store alert history
            const history = this.alertHistory.get(streamName) || [];
            history.push(...alerts);
            this.alertHistory.set(streamName, history.slice(-100)); // Keep last 100 alerts
        }
        
        return alerts;
    }

    /**
     * Helper methods
     */

    updateStreamStatistics(stream, dataPoint) {
        const value = Array.isArray(dataPoint.value) ? dataPoint.value[0] : dataPoint.value;
        const stats = stream.statistics;
        
        stats.count++;
        const delta = value - stats.mean;
        stats.mean += delta / stats.count;
        stats.variance += delta * (value - stats.mean);
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
    }

    queueDetection(streamName) {
        if (!this.detectionQueue.includes(streamName)) {
            this.detectionQueue.push(streamName);
        }
    }

    async processDetectionQueue() {
        if (this.detectionQueue.length === 0) return;
        
        const streamName = this.detectionQueue.shift();
        
        try {
            await this.detectAnomalies(streamName);
        } catch (error) {
            console.error(`Error processing detection for ${streamName}:`, error);
        }
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? 
            (sorted[middle - 1] + sorted[middle]) / 2 : 
            sorted[middle];
    }

    calculateEuclideanDistance(a, b) {
        if (a.length !== b.length) return Infinity;
        return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
    }

    getDefaultThreshold(algorithm) {
        const defaults = {
            z_score: this.config.zScoreThreshold,
            modified_z_score: this.config.modifiedZScoreThreshold,
            iqr: this.config.iqrMultiplier,
            isolation_forest: this.config.isolationForestContamination,
            lof: 1.5
        };
        return defaults[algorithm] || 1.0;
    }

    getAlgorithmWeight(algorithm) {
        // Simple implementation - in practice, this would be based on historical performance
        const performance = this.metrics.algorithmPerformance.get(algorithm);
        if (performance && performance.accuracy > 0) {
            return performance.accuracy;
        }
        return 1.0; // Default weight
    }

    determineAlertSeverity(anomaly) {
        const score = anomaly.ensembleScore || anomaly.score;
        const confidence = anomaly.confidence || 1;
        const adjustedScore = score * confidence;
        
        if (adjustedScore >= this.config.alertThresholds.critical) {
            return 'critical';
        } else if (adjustedScore >= this.config.alertThresholds.high) {
            return 'high';
        } else if (adjustedScore >= this.config.alertThresholds.medium) {
            return 'medium';
        } else if (adjustedScore >= this.config.alertThresholds.low) {
            return 'low';
        }
        
        return 'none';
    }

    generateAlertMessage(anomaly, severity) {
        const method = anomaly.method === 'ensemble' ? 
            `${anomaly.detectedBy?.join(', ') || 'multiple algorithms'}` : 
            anomaly.method;
            
        return `${severity.toUpperCase()} anomaly detected using ${method}. ` +
               `Value: ${Array.isArray(anomaly.value) ? anomaly.value.join(', ') : anomaly.value}, ` +
               `Score: ${(anomaly.ensembleScore || anomaly.score).toFixed(2)}`;
    }

    getHourlyAlertCount() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        let count = 0;
        
        for (const history of this.alertHistory.values()) {
            count += history.filter(alert => alert.timestamp > oneHourAgo).length;
        }
        
        return count;
    }

    updateAlgorithmMetrics(algorithm, result) {
        const performance = this.metrics.algorithmPerformance.get(algorithm);
        if (performance) {
            performance.detections++;
            performance.lastUpdate = Date.now();
            // Additional performance tracking would go here
        }
    }

    updateDetectionMetrics(results) {
        this.metrics.totalDetections++;
        this.metrics.anomaliesDetected += results.ensemble.anomalies.length;
        this.metrics.detectionTimes.push(results.processingTime);
        
        // Limit arrays
        if (this.metrics.detectionTimes.length > 1000) {
            this.metrics.detectionTimes = this.metrics.detectionTimes.slice(-500);
        }
    }

    storeAnomalies(streamName, results) {
        if (!this.anomalies.has(streamName)) {
            this.anomalies.set(streamName, []);
        }
        
        const storage = this.anomalies.get(streamName);
        storage.push({
            timestamp: results.timestamp,
            anomalies: results.ensemble.anomalies,
            processingTime: results.processingTime
        });
        
        // Limit storage
        if (storage.length > 1000) {
            storage.splice(0, storage.length - 500);
        }
    }

    async adaptThresholds() {
        if (!this.config.adaptiveThresholds) return;
        
        // Adaptive threshold logic would go here
        // This is a simplified version
        console.log('🔧 Adapting detection thresholds...');
    }

    async performCleanup() {
        const now = Date.now();
        const maxAge = this.config.historyRetention;
        
        // Clean up old data
        for (const [streamName, stream] of this.dataStreams) {
            stream.data = stream.data.filter(point => now - point.timestamp < maxAge);
            if (stream.data.length === 0) {
                this.dataStreams.delete(streamName);
                this.slidingWindows.delete(streamName);
            }
        }
        
        // Clean up old anomalies
        for (const [streamName, anomalies] of this.anomalies) {
            const filtered = anomalies.filter(a => now - a.timestamp < maxAge);
            if (filtered.length === 0) {
                this.anomalies.delete(streamName);
            } else {
                this.anomalies.set(streamName, filtered);
            }
        }
        
        // Clean up alert history
        for (const [streamName, alerts] of this.alertHistory) {
            const filtered = alerts.filter(alert => now - alert.timestamp < maxAge);
            if (filtered.length === 0) {
                this.alertHistory.delete(streamName);
            } else {
                this.alertHistory.set(streamName, filtered);
            }
        }
        
        console.log('🧹 Anomaly detector cleanup completed');
    }

    /**
     * Get detection statistics
     */
    getStatistics() {
        const avgDetectionTime = this.metrics.detectionTimes.length > 0 ?
            this.metrics.detectionTimes.reduce((a, b) => a + b, 0) / this.metrics.detectionTimes.length : 0;

        return {
            totalDetections: this.metrics.totalDetections,
            anomaliesDetected: this.metrics.anomaliesDetected,
            alertsSent: this.metrics.alertsSent,
            avgDetectionTime: Math.round(avgDetectionTime),
            dataStreams: this.dataStreams.size,
            activeDetections: this.activeDetections.size,
            enabledAlgorithms: this.config.enabledAlgorithms,
            algorithmPerformance: Object.fromEntries(
                Array.from(this.metrics.algorithmPerformance.entries()).map(([key, value]) => [
                    key, {
                        detections: value.detections,
                        accuracy: value.accuracy,
                        lastUpdate: value.lastUpdate
                    }
                ])
            ),
            initialized: this.initialized,
            running: this.isRunning
        };
    }

    /**
     * Stop the anomaly detector
     */
    async stop() {
        console.log('🛑 Stopping Anomaly Detector...');
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        // Wait for active detections to complete
        const maxWait = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activeDetections.size > 0 && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log('✅ Anomaly Detector stopped');
    }
}

export default AnomalyDetector;
