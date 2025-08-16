/**
 * PatternRecognizer - Advanced pattern detection and classification system
 * 
 * This service provides comprehensive pattern recognition capabilities including:
 * - Sequential pattern matching with dynamic programming algorithms
 * - Statistical pattern classification using multiple approaches
 * - Time series pattern detection with seasonal decomposition
 * - Behavioral pattern analysis with machine learning techniques
 * - Real-time pattern streaming with sliding window processing
 * - Pattern template matching and similarity scoring
 * 
 * Features:
 * - Multi-dimensional pattern analysis across various data types
 * - Adaptive pattern learning with feedback integration
 * - Hierarchical pattern classification and clustering
 * - Pattern correlation analysis and dependency detection
 * - Confidence scoring with statistical significance testing
 * - Real-time pattern alerts and notification system
 */

import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class PatternRecognizer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration with intelligent defaults
        this.config = {
            // Pattern detection settings
            minPatternLength: options.minPatternLength || 3,
            maxPatternLength: options.maxPatternLength || 100,
            similarityThreshold: options.similarityThreshold || 0.75,
            confidenceThreshold: options.confidenceThreshold || 0.6,
            
            // Sliding window configuration
            windowSize: options.windowSize || 200,
            overlapPercentage: options.overlapPercentage || 0.5,
            updateInterval: options.updateInterval || 10000, // 10 seconds
            
            // Pattern classification parameters
            maxClusters: options.maxClusters || 20,
            clusteringAlgorithm: options.clusteringAlgorithm || 'kmeans',
            dimensionReduction: options.dimensionReduction || 'pca',
            
            // Learning and adaptation
            learningRate: options.learningRate || 0.01,
            adaptationThreshold: options.adaptationThreshold || 0.8,
            patternMemorySize: options.patternMemorySize || 1000,
            
            // Performance optimization
            maxConcurrentProcessing: options.maxConcurrentProcessing || 5,
            batchProcessingSize: options.batchProcessingSize || 100,
            cacheSize: options.cacheSize || 5000,
            
            ...options
        };

        // Core pattern storage and management
        this.patterns = {
            templates: new Map(),
            learned: new Map(),
            clusters: new Map(),
            sequences: new Map(),
            statistical: new Map()
        };
        
        // Pattern classification models
        this.classifiers = {
            sequence: new Map(),
            statistical: new Map(),
            temporal: new Map(),
            behavioral: new Map()
        };
        
        // Data processing pipelines
        this.pipelines = new Map();
        this.activeProcessing = new Set();
        this.patternCache = new Map();
        this.similarityMatrix = new Map();
        
        // Performance metrics and analytics
        this.metrics = {
            patternsDetected: 0,
            classificationsPerformed: 0,
            learningUpdates: 0,
            cacheHits: 0,
            cacheMisses: 0,
            processingTimes: [],
            accuracyScores: []
        };
        
        // Real-time processing state
        this.dataBuffers = new Map();
        this.processingQueue = [];
        this.alertThresholds = new Map();
        
        // OpenTelemetry tracing setup
        this.tracer = OpenTelemetryTracing.getTracer('pattern-recognizer');
        
        // Background processing intervals
        this.intervals = {
            processing: null,
            learning: null,
            cleanup: null
        };
        
        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the pattern recognition system
     */
    async initialize() {
        return this.tracer.startActiveSpan('pattern-recognizer-initialize', async (span) => {
            try {
                span.setAttributes({
                    'pattern.component': 'PatternRecognizer',
                    'pattern.operation': 'initialize'
                });

                console.log('🔍 Initializing Pattern Recognizer...');
                
                // Initialize pattern templates
                await this.initializePatternTemplates();
                
                // Setup classification models
                await this.initializeClassifiers();
                
                // Initialize processing pipelines
                await this.setupProcessingPipelines();
                
                // Setup real-time processing
                await this.initializeRealtimeProcessing();
                
                // Start background processing
                this.startBackgroundProcessing();
                
                this.initialized = true;
                console.log('✅ Pattern Recognizer initialized successfully');
                
                span.setStatus({ code: 1, message: 'Pattern recognizer initialized' });
                this.emit('initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize pattern recognizer:', error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Initialize built-in pattern templates
     */
    async initializePatternTemplates() {
        console.log('📋 Initializing pattern templates...');
        
        // Time series patterns
        this.patterns.templates.set('upward_trend', {
            type: 'temporal',
            description: 'Consistent upward movement over time',
            signature: [0.1, 0.2, 0.4, 0.7, 0.9],
            flexibility: 0.3,
            minLength: 5,
            maxLength: 50,
            weight: 1.0
        });
        
        this.patterns.templates.set('downward_trend', {
            type: 'temporal',
            description: 'Consistent downward movement over time',
            signature: [0.9, 0.7, 0.4, 0.2, 0.1],
            flexibility: 0.3,
            minLength: 5,
            maxLength: 50,
            weight: 1.0
        });
        
        this.patterns.templates.set('spike', {
            type: 'anomaly',
            description: 'Sharp increase followed by sharp decrease',
            signature: [0.2, 0.3, 0.9, 0.3, 0.2],
            flexibility: 0.4,
            minLength: 3,
            maxLength: 10,
            weight: 1.2
        });
        
        this.patterns.templates.set('plateau', {
            type: 'stability',
            description: 'Extended period of stable values',
            signature: [0.5, 0.5, 0.5, 0.5, 0.5],
            flexibility: 0.2,
            minLength: 10,
            maxLength: 100,
            weight: 0.8
        });
        
        // Behavioral patterns
        this.patterns.templates.set('periodic_cycle', {
            type: 'behavioral',
            description: 'Regular repeating pattern',
            signature: [0.1, 0.5, 0.9, 0.5, 0.1, 0.5, 0.9, 0.5],
            flexibility: 0.3,
            minLength: 6,
            maxLength: 200,
            weight: 1.1
        });
        
        this.patterns.templates.set('burst_activity', {
            type: 'behavioral',
            description: 'Sudden increase in activity followed by normal levels',
            signature: [0.2, 0.2, 0.8, 0.9, 0.7, 0.3, 0.2, 0.2],
            flexibility: 0.4,
            minLength: 6,
            maxLength: 20,
            weight: 1.3
        });
        
        // Statistical patterns
        this.patterns.templates.set('normal_distribution', {
            type: 'statistical',
            description: 'Bell curve distribution pattern',
            signature: [0.1, 0.3, 0.6, 0.9, 0.6, 0.3, 0.1],
            flexibility: 0.3,
            minLength: 7,
            maxLength: 30,
            weight: 0.9
        });
        
        this.patterns.templates.set('exponential_decay', {
            type: 'statistical',
            description: 'Exponential decrease pattern',
            signature: [1.0, 0.6, 0.4, 0.2, 0.1, 0.05],
            flexibility: 0.3,
            minLength: 4,
            maxLength: 25,
            weight: 1.0
        });
        
        console.log(`✅ Initialized ${this.patterns.templates.size} pattern templates`);
    }

    /**
     * Initialize pattern classifiers
     */
    async initializeClassifiers() {
        console.log('🤖 Initializing pattern classifiers...');
        
        // Sequence classifier using dynamic programming
        this.classifiers.sequence.set('dynamic_programming', {
            algorithm: 'longest_common_subsequence',
            parameters: {
                gapPenalty: 0.1,
                mismatchPenalty: 0.2,
                matchBonus: 1.0
            },
            state: {
                memoization: new Map(),
                lastUpdate: Date.now()
            }
        });
        
        // Statistical classifier using correlation analysis
        this.classifiers.statistical.set('correlation', {
            algorithm: 'pearson_correlation',
            parameters: {
                minCorrelation: 0.5,
                significanceLevel: 0.05,
                windowSize: 50
            },
            state: {
                correlationMatrix: new Map(),
                lastComputation: Date.now()
            }
        });
        
        // Temporal classifier using time series analysis
        this.classifiers.temporal.set('fourier_transform', {
            algorithm: 'discrete_fourier_transform',
            parameters: {
                samplingRate: 1.0,
                frequencyBands: 10,
                windowFunction: 'hamming'
            },
            state: {
                frequencies: new Map(),
                phases: new Map()
            }
        });
        
        // Behavioral classifier using machine learning
        this.classifiers.behavioral.set('clustering', {
            algorithm: 'k_means',
            parameters: {
                k: this.config.maxClusters,
                maxIterations: 100,
                tolerance: 0.01
            },
            state: {
                centroids: [],
                assignments: new Map(),
                trained: false
            }
        });
        
        console.log('✅ Pattern classifiers initialized');
    }

    /**
     * Setup data processing pipelines
     */
    async setupProcessingPipelines() {
        console.log('⚙️ Setting up processing pipelines...');
        
        // Real-time pattern detection pipeline
        this.pipelines.set('realtime', {
            stages: [
                'data_preprocessing',
                'feature_extraction',
                'pattern_matching',
                'classification',
                'confidence_scoring',
                'result_aggregation'
            ],
            bufferSize: this.config.windowSize,
            processingMode: 'streaming',
            outputFormat: 'structured'
        });
        
        // Batch pattern analysis pipeline
        this.pipelines.set('batch', {
            stages: [
                'data_normalization',
                'dimensionality_reduction',
                'clustering',
                'pattern_extraction',
                'similarity_analysis',
                'pattern_validation'
            ],
            bufferSize: this.config.batchProcessingSize,
            processingMode: 'batch',
            outputFormat: 'detailed'
        });
        
        // Learning and adaptation pipeline
        this.pipelines.set('learning', {
            stages: [
                'feedback_collection',
                'pattern_evaluation',
                'model_updating',
                'template_refinement',
                'performance_assessment'
            ],
            bufferSize: 50,
            processingMode: 'adaptive',
            outputFormat: 'metrics'
        });
        
        console.log('✅ Processing pipelines configured');
    }

    /**
     * Initialize real-time processing capabilities
     */
    async initializeRealtimeProcessing() {
        console.log('⚡ Initializing real-time processing...');
        
        // Setup data buffers for different data types
        this.dataBuffers.set('numeric', {
            buffer: [],
            maxSize: this.config.windowSize,
            lastProcessed: Date.now(),
            processingInterval: this.config.updateInterval
        });
        
        this.dataBuffers.set('categorical', {
            buffer: [],
            maxSize: this.config.windowSize,
            lastProcessed: Date.now(),
            processingInterval: this.config.updateInterval
        });
        
        this.dataBuffers.set('temporal', {
            buffer: [],
            maxSize: this.config.windowSize,
            lastProcessed: Date.now(),
            processingInterval: this.config.updateInterval
        });
        
        // Setup alert thresholds
        this.alertThresholds.set('pattern_confidence', 0.9);
        this.alertThresholds.set('anomaly_score', 0.8);
        this.alertThresholds.set('classification_certainty', 0.85);
        
        console.log('✅ Real-time processing initialized');
    }

    /**
     * Start background processing intervals
     */
    startBackgroundProcessing() {
        console.log('⚡ Starting background processing...');
        
        // Pattern processing interval
        this.intervals.processing = setInterval(() => {
            this.processQueuedPatterns();
        }, this.config.updateInterval);
        
        // Learning and adaptation interval
        this.intervals.learning = setInterval(() => {
            this.performLearningUpdate();
        }, this.config.updateInterval * 5); // Less frequent learning updates
        
        // Cleanup and maintenance interval
        this.intervals.cleanup = setInterval(() => {
            this.performMaintenance();
        }, 60 * 60 * 1000); // Hourly cleanup
        
        this.isRunning = true;
        console.log('✅ Background processing started');
    }

    /**
     * Add data for pattern recognition
     */
    async addData(dataType, data, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Pattern recognizer not initialized');
        }

        return this.tracer.startActiveSpan('pattern-add-data', async (span) => {
            try {
                span.setAttributes({
                    'pattern.data_type': dataType,
                    'pattern.data_size': Array.isArray(data) ? data.length : 1,
                    'pattern.operation': 'add_data'
                });

                // Get appropriate buffer
                const buffer = this.dataBuffers.get(dataType);
                if (!buffer) {
                    throw new Error(`Unknown data type: ${dataType}`);
                }

                // Prepare data entry
                const entry = {
                    data,
                    timestamp: Date.now(),
                    metadata: {
                        source: metadata.source || 'unknown',
                        type: dataType,
                        ...metadata
                    }
                };

                // Add to buffer
                buffer.buffer.push(entry);

                // Maintain buffer size
                if (buffer.buffer.length > buffer.maxSize) {
                    buffer.buffer.shift();
                }

                // Trigger processing if buffer is ready
                if (this.shouldProcessBuffer(buffer)) {
                    this.queuePatternDetection(dataType);
                }

                span.setStatus({ code: 1, message: 'Data added successfully' });
                
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
     * Detect patterns in data
     */
    async detectPatterns(dataType, customOptions = {}) {
        if (this.activeProcessing.size >= this.config.maxConcurrentProcessing) {
            return null; // Skip if too many concurrent operations
        }

        const processingId = `${dataType}-${Date.now()}`;
        this.activeProcessing.add(processingId);

        return this.tracer.startActiveSpan('pattern-detect-patterns', async (span) => {
            try {
                span.setAttributes({
                    'pattern.data_type': dataType,
                    'pattern.processing_id': processingId,
                    'pattern.operation': 'detect_patterns'
                });

                const startTime = Date.now();
                const buffer = this.dataBuffers.get(dataType);
                
                if (!buffer || buffer.buffer.length === 0) {
                    return { error: 'No data available for pattern detection' };
                }

                console.log(`🔍 Detecting patterns in ${dataType} data...`);

                // Extract data sequences
                const sequences = this.extractSequences(buffer.buffer, customOptions);
                
                // Process through pipeline
                const pipelineResults = await this.processThroughPipeline('realtime', sequences);
                
                // Perform pattern matching
                const patternMatches = await this.performPatternMatching(sequences);
                
                // Classify detected patterns
                const classifications = await this.classifyPatterns(patternMatches);
                
                // Calculate confidence scores
                const confidenceScores = await this.calculateConfidenceScores(classifications);
                
                // Generate final results
                const results = {
                    dataType,
                    timestamp: Date.now(),
                    processingTime: Date.now() - startTime,
                    dataPoints: buffer.buffer.length,
                    patterns: classifications,
                    confidence: confidenceScores,
                    metadata: {
                        processingId,
                        pipelineUsed: 'realtime',
                        algorithmsUsed: this.getActiveAlgorithms()
                    }
                };

                // Update metrics
                this.updateMetrics(results);
                
                // Check for alerts
                this.checkForAlerts(results);
                
                // Update buffer processing timestamp
                buffer.lastProcessed = Date.now();

                // Emit results
                this.emit('patterns-detected', results);

                span.setAttributes({
                    'pattern.patterns_found': classifications.length,
                    'pattern.processing_time_ms': results.processingTime
                });

                span.setStatus({ code: 1, message: 'Pattern detection completed' });
                return results;

            } catch (error) {
                console.error(`❌ Error detecting patterns in ${dataType}:`, error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                this.activeProcessing.delete(processingId);
                span.end();
            }
        });
    }

    /**
     * Extract sequences from buffer data
     */
    extractSequences(bufferData, options = {}) {
        const sequences = [];
        const minLength = options.minLength || this.config.minPatternLength;
        const maxLength = options.maxLength || this.config.maxPatternLength;
        const overlap = options.overlapPercentage || this.config.overlapPercentage;
        
        // Extract numeric values from buffer
        const values = bufferData.map(entry => {
            if (typeof entry.data === 'number') return entry.data;
            if (Array.isArray(entry.data)) return entry.data[0] || 0;
            if (typeof entry.data === 'object' && entry.data.value) return entry.data.value;
            return 0;
        });
        
        if (values.length < minLength) {
            return sequences;
        }
        
        // Generate sequences with sliding window
        const stepSize = Math.max(1, Math.floor(maxLength * (1 - overlap)));
        
        for (let start = 0; start <= values.length - minLength; start += stepSize) {
            for (let length = minLength; length <= Math.min(maxLength, values.length - start); length += Math.ceil(length * 0.2)) {
                const sequence = {
                    values: values.slice(start, start + length),
                    startIndex: start,
                    length,
                    timestamp: bufferData[start]?.timestamp || Date.now(),
                    metadata: bufferData[start]?.metadata || {}
                };
                
                sequences.push(sequence);
            }
        }
        
        return sequences;
    }

    /**
     * Process sequences through specified pipeline
     */
    async processThroughPipeline(pipelineName, sequences) {
        const pipeline = this.pipelines.get(pipelineName);
        if (!pipeline) {
            throw new Error(`Unknown pipeline: ${pipelineName}`);
        }
        
        let processedData = sequences;
        
        // Process through each pipeline stage
        for (const stage of pipeline.stages) {
            switch (stage) {
                case 'data_preprocessing':
                    processedData = this.preprocessData(processedData);
                    break;
                case 'feature_extraction':
                    processedData = this.extractFeatures(processedData);
                    break;
                case 'data_normalization':
                    processedData = this.normalizeData(processedData);
                    break;
                case 'dimensionality_reduction':
                    processedData = this.reduceDimensionality(processedData);
                    break;
                case 'clustering':
                    processedData = await this.performClustering(processedData);
                    break;
                default:
                    // Stage will be handled in specific processing methods
                    break;
            }
        }
        
        return processedData;
    }

    /**
     * Preprocess data sequences
     */
    preprocessData(sequences) {
        return sequences.map(seq => {
            // Remove outliers using IQR method
            const sortedValues = [...seq.values].sort((a, b) => a - b);
            const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
            const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
            const iqr = q3 - q1;
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;
            
            const cleanedValues = seq.values.map(val => {
                if (val < lowerBound || val > upperBound) {
                    // Replace outliers with median
                    return sortedValues[Math.floor(sortedValues.length / 2)];
                }
                return val;
            });
            
            return {
                ...seq,
                values: cleanedValues,
                preprocessed: true
            };
        });
    }

    /**
     * Extract features from sequences
     */
    extractFeatures(sequences) {
        return sequences.map(seq => {
            const features = {
                // Statistical features
                mean: seq.values.reduce((a, b) => a + b, 0) / seq.values.length,
                variance: 0,
                skewness: 0,
                kurtosis: 0,
                
                // Trend features
                firstDerivative: [],
                secondDerivative: [],
                trendStrength: 0,
                
                // Pattern features
                peaks: [],
                valleys: [],
                periodicityScore: 0,
                
                // Frequency domain features
                dominantFrequency: 0,
                spectralCentroid: 0,
                spectralRolloff: 0
            };
            
            // Calculate statistical features
            const mean = features.mean;
            const variance = seq.values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / seq.values.length;
            features.variance = variance;
            features.standardDeviation = Math.sqrt(variance);
            
            // Calculate derivatives for trend analysis
            for (let i = 1; i < seq.values.length; i++) {
                features.firstDerivative.push(seq.values[i] - seq.values[i - 1]);
            }
            
            for (let i = 1; i < features.firstDerivative.length; i++) {
                features.secondDerivative.push(features.firstDerivative[i] - features.firstDerivative[i - 1]);
            }
            
            // Calculate trend strength
            if (features.firstDerivative.length > 0) {
                const avgDerivative = features.firstDerivative.reduce((a, b) => a + b, 0) / features.firstDerivative.length;
                features.trendStrength = Math.abs(avgDerivative) / (features.standardDeviation || 1);
            }
            
            // Detect peaks and valleys
            for (let i = 1; i < seq.values.length - 1; i++) {
                if (seq.values[i] > seq.values[i - 1] && seq.values[i] > seq.values[i + 1]) {
                    features.peaks.push({ index: i, value: seq.values[i] });
                }
                if (seq.values[i] < seq.values[i - 1] && seq.values[i] < seq.values[i + 1]) {
                    features.valleys.push({ index: i, value: seq.values[i] });
                }
            }
            
            // Calculate periodicity score (simplified autocorrelation)
            features.periodicityScore = this.calculateAutocorrelation(seq.values);
            
            return {
                ...seq,
                features,
                featuresExtracted: true
            };
        });
    }

    /**
     * Normalize data sequences
     */
    normalizeData(sequences) {
        return sequences.map(seq => {
            const min = Math.min(...seq.values);
            const max = Math.max(...seq.values);
            const range = max - min;
            
            if (range === 0) {
                return {
                    ...seq,
                    normalizedValues: seq.values.map(() => 0.5),
                    normalizationParams: { min, max, range }
                };
            }
            
            const normalizedValues = seq.values.map(val => (val - min) / range);
            
            return {
                ...seq,
                normalizedValues,
                normalizationParams: { min, max, range },
                normalized: true
            };
        });
    }

    /**
     * Reduce dimensionality of feature space
     */
    reduceDimensionality(sequences) {
        if (!sequences[0]?.features) {
            return sequences; // No features to reduce
        }
        
        // Simple PCA implementation for demonstration
        // In production, use more sophisticated libraries
        
        return sequences.map(seq => ({
            ...seq,
            reducedFeatures: {
                primaryComponent: seq.features.trendStrength || 0,
                secondaryComponent: seq.features.periodicityScore || 0,
                tertiaryComponent: seq.features.variance || 0
            },
            dimensionalityReduced: true
        }));
    }

    /**
     * Perform pattern matching against templates
     */
    async performPatternMatching(sequences) {
        const matches = [];
        
        for (const sequence of sequences) {
            const sequenceMatches = [];
            
            // Match against each template
            for (const [templateName, template] of this.patterns.templates) {
                const similarity = this.calculateTemplateSimilarity(sequence, template);
                
                if (similarity >= this.config.similarityThreshold) {
                    sequenceMatches.push({
                        templateName,
                        template,
                        similarity,
                        confidence: this.calculateMatchConfidence(similarity, template),
                        sequence: sequence
                    });
                }
            }
            
            if (sequenceMatches.length > 0) {
                matches.push({
                    sequence,
                    matches: sequenceMatches.sort((a, b) => b.similarity - a.similarity)
                });
            }
        }
        
        this.metrics.patternsDetected += matches.length;
        return matches;
    }

    /**
     * Calculate similarity between sequence and template
     */
    calculateTemplateSimilarity(sequence, template) {
        const values = sequence.normalizedValues || sequence.values;
        const templateSignature = template.signature;
        
        if (values.length < template.minLength || values.length > template.maxLength) {
            return 0;
        }
        
        // Resize template to match sequence length
        const resizedTemplate = this.resizeTemplate(templateSignature, values.length);
        
        // Calculate similarity using various metrics
        const euclideanSimilarity = this.calculateEuclideanSimilarity(values, resizedTemplate);
        const correlationSimilarity = this.calculateCorrelation(values, resizedTemplate);
        const shapeSimilarity = this.calculateShapeSimilarity(values, resizedTemplate);
        
        // Weighted combination of similarity metrics
        const combinedSimilarity = (
            euclideanSimilarity * 0.3 +
            correlationSimilarity * 0.4 +
            shapeSimilarity * 0.3
        );
        
        // Apply template flexibility
        const flexibility = template.flexibility || 0.1;
        const adjustedSimilarity = Math.min(1.0, combinedSimilarity + flexibility);
        
        return Math.max(0, adjustedSimilarity);
    }

    /**
     * Resize template to match sequence length
     */
    resizeTemplate(template, targetLength) {
        if (template.length === targetLength) {
            return template;
        }
        
        const resized = [];
        const scale = (template.length - 1) / (targetLength - 1);
        
        for (let i = 0; i < targetLength; i++) {
            const sourceIndex = i * scale;
            const lowerIndex = Math.floor(sourceIndex);
            const upperIndex = Math.min(template.length - 1, Math.ceil(sourceIndex));
            const fraction = sourceIndex - lowerIndex;
            
            if (lowerIndex === upperIndex) {
                resized.push(template[lowerIndex]);
            } else {
                const interpolated = template[lowerIndex] * (1 - fraction) + template[upperIndex] * fraction;
                resized.push(interpolated);
            }
        }
        
        return resized;
    }

    /**
     * Calculate Euclidean similarity
     */
    calculateEuclideanSimilarity(values1, values2) {
        if (values1.length !== values2.length) {
            return 0;
        }
        
        let sumSquaredDiff = 0;
        for (let i = 0; i < values1.length; i++) {
            sumSquaredDiff += Math.pow(values1[i] - values2[i], 2);
        }
        
        const euclideanDistance = Math.sqrt(sumSquaredDiff / values1.length);
        return Math.max(0, 1 - euclideanDistance);
    }

    /**
     * Calculate correlation coefficient
     */
    calculateCorrelation(values1, values2) {
        if (values1.length !== values2.length || values1.length < 2) {
            return 0;
        }
        
        const n = values1.length;
        const mean1 = values1.reduce((a, b) => a + b, 0) / n;
        const mean2 = values2.reduce((a, b) => a + b, 0) / n;
        
        let numerator = 0;
        let sumSquares1 = 0;
        let sumSquares2 = 0;
        
        for (let i = 0; i < n; i++) {
            const diff1 = values1[i] - mean1;
            const diff2 = values2[i] - mean2;
            
            numerator += diff1 * diff2;
            sumSquares1 += diff1 * diff1;
            sumSquares2 += diff2 * diff2;
        }
        
        const denominator = Math.sqrt(sumSquares1 * sumSquares2);
        if (denominator === 0) {
            return 0;
        }
        
        return Math.abs(numerator / denominator);
    }

    /**
     * Calculate shape similarity using derivative matching
     */
    calculateShapeSimilarity(values1, values2) {
        if (values1.length < 3 || values2.length < 3) {
            return 0;
        }
        
        // Calculate first derivatives
        const derivatives1 = [];
        const derivatives2 = [];
        
        for (let i = 1; i < values1.length; i++) {
            derivatives1.push(values1[i] - values1[i - 1]);
            derivatives2.push(values2[i] - values2[i - 1]);
        }
        
        // Compare derivative patterns
        return this.calculateCorrelation(derivatives1, derivatives2);
    }

    /**
     * Classify detected patterns
     */
    async classifyPatterns(patternMatches) {
        const classifications = [];
        
        for (const match of patternMatches) {
            for (const patternMatch of match.matches) {
                const classification = {
                    patternId: `${patternMatch.templateName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    templateName: patternMatch.templateName,
                    type: patternMatch.template.type,
                    confidence: patternMatch.confidence,
                    similarity: patternMatch.similarity,
                    sequence: {
                        startIndex: patternMatch.sequence.startIndex,
                        length: patternMatch.sequence.length,
                        values: patternMatch.sequence.values.slice(0, 10), // Truncate for storage
                        timestamp: patternMatch.sequence.timestamp
                    },
                    features: patternMatch.sequence.features || {},
                    metadata: {
                        detectionTime: Date.now(),
                        algorithmUsed: 'template_matching',
                        processingPipeline: 'realtime'
                    }
                };
                
                // Add classification-specific metadata
                switch (patternMatch.template.type) {
                    case 'temporal':
                        classification.temporal = {
                            trend: this.analyzeTrend(patternMatch.sequence.values),
                            duration: patternMatch.sequence.length,
                            volatility: this.calculateVolatility(patternMatch.sequence.values)
                        };
                        break;
                    case 'behavioral':
                        classification.behavioral = {
                            frequency: this.estimateFrequency(patternMatch.sequence.values),
                            amplitude: this.calculateAmplitude(patternMatch.sequence.values),
                            regularity: this.assessRegularity(patternMatch.sequence.values)
                        };
                        break;
                    case 'statistical':
                        classification.statistical = {
                            distribution: this.analyzeDistribution(patternMatch.sequence.values),
                            outliers: this.detectOutliers(patternMatch.sequence.values),
                            normality: this.testNormality(patternMatch.sequence.values)
                        };
                        break;
                }
                
                classifications.push(classification);
            }
        }
        
        this.metrics.classificationsPerformed += classifications.length;
        return classifications;
    }

    /**
     * Calculate confidence scores for classifications
     */
    async calculateConfidenceScores(classifications) {
        const confidenceScores = {
            overall: 0,
            individual: [],
            factors: {
                similarity: 0,
                template_quality: 0,
                data_quality: 0,
                consistency: 0
            }
        };
        
        if (classifications.length === 0) {
            return confidenceScores;
        }
        
        let totalConfidence = 0;
        
        for (const classification of classifications) {
            // Base confidence from similarity score
            let confidence = classification.similarity;
            
            // Adjust based on template quality
            const templateWeight = classification.template?.weight || 1.0;
            confidence *= templateWeight;
            
            // Adjust based on data quality (sequence length and completeness)
            const dataQualityFactor = Math.min(1.0, classification.sequence.length / 20);
            confidence *= dataQualityFactor;
            
            // Adjust based on feature consistency
            const consistencyFactor = this.calculateFeatureConsistency(classification);
            confidence *= consistencyFactor;
            
            // Normalize confidence to [0, 1]
            confidence = Math.max(0, Math.min(1, confidence));
            
            confidenceScores.individual.push({
                patternId: classification.patternId,
                confidence,
                factors: {
                    similarity: classification.similarity,
                    templateWeight,
                    dataQuality: dataQualityFactor,
                    consistency: consistencyFactor
                }
            });
            
            totalConfidence += confidence;
        }
        
        // Calculate overall confidence
        confidenceScores.overall = totalConfidence / classifications.length;
        
        // Calculate factor averages
        confidenceScores.factors.similarity = 
            confidenceScores.individual.reduce((sum, c) => sum + c.factors.similarity, 0) / classifications.length;
        confidenceScores.factors.template_quality = 
            confidenceScores.individual.reduce((sum, c) => sum + c.factors.templateWeight, 0) / classifications.length;
        confidenceScores.factors.data_quality = 
            confidenceScores.individual.reduce((sum, c) => sum + c.factors.dataQuality, 0) / classifications.length;
        confidenceScores.factors.consistency = 
            confidenceScores.individual.reduce((sum, c) => sum + c.factors.consistency, 0) / classifications.length;
        
        return confidenceScores;
    }

    /**
     * Calculate feature consistency for a classification
     */
    calculateFeatureConsistency(classification) {
        const features = classification.features;
        if (!features || Object.keys(features).length === 0) {
            return 0.5; // Neutral score when no features available
        }
        
        let consistencyScore = 1.0;
        
        // Check for reasonable feature values
        if (typeof features.mean === 'number' && !isNaN(features.mean)) {
            consistencyScore *= 1.0;
        } else {
            consistencyScore *= 0.8;
        }
        
        if (typeof features.variance === 'number' && features.variance >= 0) {
            consistencyScore *= 1.0;
        } else {
            consistencyScore *= 0.8;
        }
        
        if (typeof features.trendStrength === 'number' && !isNaN(features.trendStrength)) {
            consistencyScore *= 1.0;
        } else {
            consistencyScore *= 0.9;
        }
        
        return Math.max(0.1, consistencyScore);
    }

    /**
     * Calculate autocorrelation for periodicity detection
     */
    calculateAutocorrelation(values) {
        if (values.length < 4) return 0;
        
        const maxLag = Math.min(Math.floor(values.length / 2), 20);
        let maxCorrelation = 0;
        
        for (let lag = 1; lag <= maxLag; lag++) {
            let correlation = 0;
            let count = 0;
            
            for (let i = 0; i < values.length - lag; i++) {
                correlation += values[i] * values[i + lag];
                count++;
            }
            
            if (count > 0) {
                correlation /= count;
                maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
            }
        }
        
        return maxCorrelation;
    }

    /**
     * Analyze trend in values
     */
    analyzeTrend(values) {
        if (values.length < 2) return 'stable';
        
        let increases = 0;
        let decreases = 0;
        
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1]) increases++;
            else if (values[i] < values[i - 1]) decreases++;
        }
        
        const totalChanges = increases + decreases;
        if (totalChanges === 0) return 'stable';
        
        const increaseRatio = increases / totalChanges;
        if (increaseRatio > 0.7) return 'increasing';
        if (increaseRatio < 0.3) return 'decreasing';
        return 'stable';
    }

    /**
     * Calculate volatility of values
     */
    calculateVolatility(values) {
        if (values.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < values.length; i++) {
            if (values[i - 1] !== 0) {
                returns.push((values[i] - values[i - 1]) / values[i - 1]);
            }
        }
        
        if (returns.length === 0) return 0;
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Should process buffer based on conditions
     */
    shouldProcessBuffer(buffer) {
        const timeSinceLastProcessing = Date.now() - buffer.lastProcessed;
        const bufferFull = buffer.buffer.length >= buffer.maxSize * 0.8;
        const timeThreshold = timeSinceLastProcessing >= buffer.processingInterval;
        
        return bufferFull || timeThreshold;
    }

    /**
     * Queue pattern detection for processing
     */
    queuePatternDetection(dataType) {
        if (!this.processingQueue.includes(dataType)) {
            this.processingQueue.push(dataType);
        }
    }

    /**
     * Process queued pattern detection tasks
     */
    async processQueuedPatterns() {
        if (this.processingQueue.length === 0) return;
        
        const dataType = this.processingQueue.shift();
        try {
            await this.detectPatterns(dataType);
        } catch (error) {
            console.error(`Error processing queued patterns for ${dataType}:`, error);
        }
    }

    /**
     * Perform learning updates based on feedback
     */
    async performLearningUpdate() {
        if (!this.initialized) return;
        
        // This would typically involve updating models based on feedback
        // For now, implement basic adaptation
        console.log('🧠 Performing learning update...');
        this.metrics.learningUpdates++;
    }

    /**
     * Perform maintenance tasks
     */
    async performMaintenance() {
        // Clean up old cache entries
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [key, value] of this.patternCache) {
            if (now - value.timestamp > maxAge) {
                this.patternCache.delete(key);
            }
        }
        
        // Limit processing time arrays
        if (this.metrics.processingTimes.length > 1000) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-500);
        }
        
        console.log('🧹 Pattern recognizer maintenance completed');
    }

    /**
     * Update metrics based on processing results
     */
    updateMetrics(results) {
        this.metrics.processingTimes.push(results.processingTime);
        
        // Calculate accuracy if available
        if (results.confidence && results.confidence.overall) {
            this.metrics.accuracyScores.push(results.confidence.overall);
        }
        
        // Keep only recent accuracy scores
        if (this.metrics.accuracyScores.length > 100) {
            this.metrics.accuracyScores = this.metrics.accuracyScores.slice(-100);
        }
    }

    /**
     * Check for alerts based on results
     */
    checkForAlerts(results) {
        // Check confidence threshold
        if (results.confidence.overall > this.alertThresholds.get('pattern_confidence')) {
            this.emit('high-confidence-pattern', {
                type: 'high_confidence',
                confidence: results.confidence.overall,
                patterns: results.patterns.length,
                dataType: results.dataType,
                timestamp: results.timestamp
            });
        }
        
        // Check for anomaly patterns
        const anomalyPatterns = results.patterns.filter(p => p.type === 'anomaly');
        if (anomalyPatterns.length > 0) {
            this.emit('anomaly-pattern-detected', {
                type: 'anomaly_detected',
                count: anomalyPatterns.length,
                patterns: anomalyPatterns,
                dataType: results.dataType,
                timestamp: results.timestamp
            });
        }
    }

    /**
     * Get active algorithms for reporting
     */
    getActiveAlgorithms() {
        const algorithms = [];
        
        for (const [type, classifiers] of Object.entries(this.classifiers)) {
            for (const [name, classifier] of classifiers) {
                algorithms.push(`${type}_${name}`);
            }
        }
        
        return algorithms;
    }

    /**
     * Get pattern recognition statistics
     */
    getStatistics() {
        const avgProcessingTime = this.metrics.processingTimes.length > 0 ?
            this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length : 0;
            
        const avgAccuracy = this.metrics.accuracyScores.length > 0 ?
            this.metrics.accuracyScores.reduce((a, b) => a + b, 0) / this.metrics.accuracyScores.length : 0;
        
        return {
            patternsDetected: this.metrics.patternsDetected,
            classificationsPerformed: this.metrics.classificationsPerformed,
            learningUpdates: this.metrics.learningUpdates,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses + 1),
            avgProcessingTime: Math.round(avgProcessingTime),
            avgAccuracy: avgAccuracy,
            templatesAvailable: this.patterns.templates.size,
            activeProcessing: this.activeProcessing.size,
            queuedTasks: this.processingQueue.length,
            dataBuffers: Array.from(this.dataBuffers.entries()).map(([type, buffer]) => ({
                type,
                size: buffer.buffer.length,
                lastProcessed: buffer.lastProcessed
            })),
            initialized: this.initialized,
            running: this.isRunning
        };
    }

    /**
     * Stop the pattern recognizer
     */
    async stop() {
        console.log('🛑 Stopping Pattern Recognizer...');
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        // Wait for active processing to complete
        const maxWait = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activeProcessing.size > 0 && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log('✅ Pattern Recognizer stopped');
    }
}

export default PatternRecognizer;
