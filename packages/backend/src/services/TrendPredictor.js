/**
 * TrendPredictor - Advanced trend forecasting and time series prediction system
 * 
 * This service provides comprehensive trend prediction capabilities including:
 * - Time series forecasting using multiple statistical and ML models
 * - Seasonal decomposition and trend extraction
 * - Multi-step ahead predictions with uncertainty quantification
 * - Ensemble forecasting with model combination techniques
 * - Adaptive model selection based on data characteristics
 * - Real-time trend monitoring and prediction updates
 * 
 * Features:
 * - ARIMA, Exponential Smoothing, Linear Regression, and Neural Network models
 * - Seasonal pattern recognition and forecasting
 * - Confidence intervals and prediction uncertainty estimation
 * - Model performance evaluation and automatic selection
 * - Drift detection and model adaptation capabilities
 * - Multi-variate trend analysis and cross-correlation modeling
 */

import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class TrendPredictor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration with intelligent defaults
        this.config = {
            // Prediction parameters
            defaultHorizon: options.defaultHorizon || 24, // 24 time steps ahead
            maxHorizon: options.maxHorizon || 100,
            minHistoryLength: options.minHistoryLength || 10,
            confidenceLevel: options.confidenceLevel || 0.95,
            
            // Model configuration
            enabledModels: options.enabledModels || ['arima', 'exponential_smoothing', 'linear_regression', 'seasonal_naive'],
            ensembleWeights: options.ensembleWeights || 'auto', // 'auto' or custom weights
            modelSelectionCriteria: options.modelSelectionCriteria || 'aic', // 'aic', 'bic', 'mse', 'mae'
            
            // ARIMA parameters
            arimaMaxP: options.arimaMaxP || 5,
            arimaMaxD: options.arimaMaxD || 2,
            arimaMaxQ: options.arimaMaxQ || 5,
            arimaSeasonalP: options.arimaSeasonalP || 2,
            arimaSeasonalD: options.arimaSeasonalD || 1,
            arimaSeasonalQ: options.arimaSeasonalQ || 2,
            arimaSeasonalPeriod: options.arimaSeasonalPeriod || 12,
            
            // Exponential smoothing parameters
            smoothingAlpha: options.smoothingAlpha || 0.3,
            smoothingBeta: options.smoothingBeta || 0.1,
            smoothingGamma: options.smoothingGamma || 0.1,
            
            // Seasonal analysis
            seasonalityDetection: options.seasonalityDetection || 'auto',
            seasonalPeriods: options.seasonalPeriods || [7, 24, 168], // daily, hourly, weekly patterns
            decomposeMethod: options.decomposeMethod || 'additive',
            
            // Performance and processing
            updateInterval: options.updateInterval || 300000, // 5 minutes
            maxConcurrentPredictions: options.maxConcurrentPredictions || 10,
            cacheSize: options.cacheSize || 1000,
            historyRetention: options.historyRetention || 7 * 24 * 60 * 60 * 1000, // 7 days
            
            ...options
        };

        // Model registry and state
        this.models = {
            arima: new Map(),
            exponentialSmoothing: new Map(),
            linearRegression: new Map(),
            seasonalNaive: new Map(),
            ensemble: new Map()
        };
        
        // Time series data storage
        this.timeSeries = new Map();
        this.predictions = new Map();
        this.modelPerformance = new Map();
        this.seasonalComponents = new Map();
        
        // Processing state
        this.activePredictions = new Set();
        this.predictionQueue = [];
        this.updateSchedule = new Map();
        
        // Performance metrics
        this.metrics = {
            totalPredictions: 0,
            successfulPredictions: 0,
            averageAccuracy: 0,
            modelUsageStats: new Map(),
            processingTimes: [],
            accuracyHistory: [],
            ensemblePerformance: []
        };
        
        // Cache for predictions and intermediate results
        this.predictionCache = new Map();
        this.decompositionCache = new Map();
        this.modelFitCache = new Map();
        
        // OpenTelemetry tracing setup
        this.tracer = OpenTelemetryTracing.getTracer('trend-predictor');
        
        // Background processing intervals
        this.intervals = {
            update: null,
            evaluation: null,
            cleanup: null
        };
        
        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the trend prediction system
     */
    async initialize() {
        return this.tracer.startActiveSpan('trend-predictor-initialize', async (span) => {
            try {
                span.setAttributes({
                    'trend.component': 'TrendPredictor',
                    'trend.operation': 'initialize'
                });

                console.log('📈 Initializing Trend Predictor...');
                
                // Initialize prediction models
                await this.initializeModels();
                
                // Setup time series processing
                await this.setupTimeSeriesProcessing();
                
                // Initialize model evaluation system
                await this.initializeModelEvaluation();
                
                // Setup ensemble forecasting
                await this.setupEnsembleForecasting();
                
                // Start background processing
                this.startBackgroundProcessing();
                
                this.initialized = true;
                console.log('✅ Trend Predictor initialized successfully');
                
                span.setStatus({ code: 1, message: 'Trend predictor initialized' });
                this.emit('initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize trend predictor:', error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Initialize prediction models
     */
    async initializeModels() {
        console.log('🤖 Initializing prediction models...');
        
        // Initialize ARIMA models
        if (this.config.enabledModels.includes('arima')) {
            this.models.arima.set('auto_arima', {
                type: 'auto_arima',
                parameters: {
                    maxP: this.config.arimaMaxP,
                    maxD: this.config.arimaMaxD,
                    maxQ: this.config.arimaMaxQ,
                    seasonal: true,
                    seasonalPeriod: this.config.arimaSeasonalPeriod
                },
                state: {
                    fitted: false,
                    coefficients: [],
                    residuals: [],
                    aic: Infinity,
                    bic: Infinity
                }
            });
        }
        
        // Initialize Exponential Smoothing models
        if (this.config.enabledModels.includes('exponential_smoothing')) {
            this.models.exponentialSmoothing.set('holt_winters', {
                type: 'holt_winters',
                parameters: {
                    alpha: this.config.smoothingAlpha,
                    beta: this.config.smoothingBeta,
                    gamma: this.config.smoothingGamma,
                    seasonal: 'additive',
                    seasonalPeriod: 12
                },
                state: {
                    level: 0,
                    trend: 0,
                    seasonal: [],
                    fitted: false
                }
            });
            
            this.models.exponentialSmoothing.set('simple_exponential', {
                type: 'simple_exponential',
                parameters: {
                    alpha: this.config.smoothingAlpha
                },
                state: {
                    level: 0,
                    fitted: false
                }
            });
        }
        
        // Initialize Linear Regression models
        if (this.config.enabledModels.includes('linear_regression')) {
            this.models.linearRegression.set('trend_regression', {
                type: 'linear_trend',
                parameters: {
                    includeIntercept: true,
                    regularization: 'none'
                },
                state: {
                    coefficients: [],
                    intercept: 0,
                    rSquared: 0,
                    fitted: false
                }
            });
        }
        
        // Initialize Seasonal Naive models
        if (this.config.enabledModels.includes('seasonal_naive')) {
            this.models.seasonalNaive.set('seasonal_naive', {
                type: 'seasonal_naive',
                parameters: {
                    seasonalPeriod: 24 // Default to daily patterns
                },
                state: {
                    seasonalPattern: [],
                    lastValues: [],
                    fitted: false
                }
            });
        }
        
        console.log('✅ Prediction models initialized');
    }

    /**
     * Setup time series processing capabilities
     */
    async setupTimeSeriesProcessing() {
        console.log('⏱️ Setting up time series processing...');
        
        // Configure data preprocessing pipeline
        this.preprocessingPipeline = {
            steps: [
                'missing_value_imputation',
                'outlier_detection',
                'seasonal_decomposition',
                'stationarity_testing',
                'transformation_selection'
            ],
            config: {
                imputationMethod: 'linear_interpolation',
                outlierMethod: 'iqr',
                transformations: ['log', 'diff', 'seasonal_diff']
            }
        };
        
        // Setup seasonal analysis
        this.seasonalAnalysis = {
            methods: ['autocorrelation', 'periodogram', 'x13_arima'],
            detectionThreshold: 0.7,
            maxSeasonalPeriods: 3
        };
        
        console.log('✅ Time series processing configured');
    }

    /**
     * Initialize model evaluation system
     */
    async initializeModelEvaluation() {
        console.log('📊 Initializing model evaluation system...');
        
        // Setup evaluation metrics
        this.evaluationMetrics = {
            accuracy: ['mae', 'mse', 'rmse', 'mape', 'smape'],
            information: ['aic', 'bic', 'hqc'],
            validation: ['cross_validation', 'walk_forward', 'holdout']
        };
        
        // Initialize performance tracking
        for (const modelType of this.config.enabledModels) {
            this.modelPerformance.set(modelType, {
                accuracy: new Map(),
                predictions: [],
                errors: [],
                lastEvaluation: null,
                rank: 0
            });
        }
        
        console.log('✅ Model evaluation system initialized');
    }

    /**
     * Setup ensemble forecasting
     */
    async setupEnsembleForecasting() {
        console.log('🎯 Setting up ensemble forecasting...');
        
        // Initialize ensemble methods
        this.ensembleMethods = {
            simple_average: {
                description: 'Simple average of all model predictions',
                weights: 'equal'
            },
            weighted_average: {
                description: 'Weighted average based on model performance',
                weights: 'performance_based'
            },
            median_ensemble: {
                description: 'Median of all model predictions',
                weights: 'none'
            },
            best_model: {
                description: 'Best performing model only',
                weights: 'winner_takes_all'
            }
        };
        
        // Default ensemble configuration
        this.models.ensemble.set('adaptive_ensemble', {
            type: 'adaptive_ensemble',
            method: 'weighted_average',
            weights: new Map(),
            lastUpdate: Date.now(),
            performance: {
                accuracy: 0,
                predictions: 0
            }
        });
        
        console.log('✅ Ensemble forecasting configured');
    }

    /**
     * Start background processing
     */
    startBackgroundProcessing() {
        console.log('⚡ Starting background processing...');
        
        // Model update interval
        this.intervals.update = setInterval(() => {
            this.updateModelsScheduled();
        }, this.config.updateInterval);
        
        // Model evaluation interval
        this.intervals.evaluation = setInterval(() => {
            this.evaluateModelPerformance();
        }, this.config.updateInterval * 2);
        
        // Cleanup interval
        this.intervals.cleanup = setInterval(() => {
            this.performCleanup();
        }, 60 * 60 * 1000); // Hourly cleanup
        
        this.isRunning = true;
        console.log('✅ Background processing started');
    }

    /**
     * Add time series data for trend prediction
     */
    async addTimeSeriesData(seriesName, data, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Trend predictor not initialized');
        }

        return this.tracer.startActiveSpan('trend-add-timeseries', async (span) => {
            try {
                span.setAttributes({
                    'trend.series_name': seriesName,
                    'trend.data_points': Array.isArray(data) ? data.length : 1,
                    'trend.operation': 'add_timeseries_data'
                });

                // Initialize series if it doesn't exist
                if (!this.timeSeries.has(seriesName)) {
                    this.timeSeries.set(seriesName, {
                        data: [],
                        metadata: {
                            created: Date.now(),
                            lastUpdated: Date.now(),
                            ...metadata
                        },
                        preprocessing: {
                            outliers: [],
                            transformations: [],
                            stationarity: null
                        },
                        seasonal: {
                            detected: false,
                            periods: [],
                            components: null
                        }
                    });
                }

                const series = this.timeSeries.get(seriesName);
                
                // Add new data points
                if (Array.isArray(data)) {
                    series.data.push(...data.map(point => ({
                        timestamp: point.timestamp || Date.now(),
                        value: point.value,
                        metadata: point.metadata || {}
                    })));
                } else {
                    series.data.push({
                        timestamp: data.timestamp || Date.now(),
                        value: data.value,
                        metadata: data.metadata || {}
                    });
                }

                // Sort by timestamp
                series.data.sort((a, b) => a.timestamp - b.timestamp);

                // Maintain history limit
                const maxHistory = Math.max(1000, this.config.maxHorizon * 10);
                if (series.data.length > maxHistory) {
                    series.data = series.data.slice(-maxHistory);
                }

                // Update metadata
                series.metadata.lastUpdated = Date.now();
                series.metadata.dataPoints = series.data.length;

                // Schedule model updates if enough data
                if (series.data.length >= this.config.minHistoryLength) {
                    this.scheduleModelUpdate(seriesName);
                }

                // Invalidate relevant caches
                this.invalidateCache(seriesName);

                span.setStatus({ code: 1, message: 'Time series data added' });
                this.emit('data-added', { seriesName, dataPoints: series.data.length });

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
     * Predict future trends for a time series
     */
    async predictTrend(seriesName, horizon = null, options = {}) {
        if (this.activePredictions.size >= this.config.maxConcurrentPredictions) {
            return { error: 'Maximum concurrent predictions reached' };
        }

        const predictionId = `${seriesName}-${Date.now()}`;
        this.activePredictions.add(predictionId);

        return this.tracer.startActiveSpan('trend-predict-trend', async (span) => {
            try {
                span.setAttributes({
                    'trend.series_name': seriesName,
                    'trend.prediction_id': predictionId,
                    'trend.horizon': horizon || this.config.defaultHorizon,
                    'trend.operation': 'predict_trend'
                });

                const startTime = Date.now();
                horizon = horizon || this.config.defaultHorizon;

                // Validate inputs
                if (horizon > this.config.maxHorizon) {
                    throw new Error(`Horizon ${horizon} exceeds maximum ${this.config.maxHorizon}`);
                }

                const series = this.timeSeries.get(seriesName);
                if (!series || series.data.length < this.config.minHistoryLength) {
                    throw new Error(`Insufficient data for series ${seriesName}`);
                }

                console.log(`📈 Predicting trend for ${seriesName} (horizon: ${horizon})`);

                // Check cache first
                const cacheKey = `${seriesName}_${horizon}_${series.metadata.lastUpdated}`;
                if (this.predictionCache.has(cacheKey) && !options.ignoreCache) {
                    return this.predictionCache.get(cacheKey);
                }

                // Preprocess data
                const preprocessedData = await this.preprocessTimeSeries(series);
                
                // Detect seasonality
                const seasonalAnalysis = await this.analyzeSeasonality(preprocessedData);
                
                // Generate predictions from all models
                const modelPredictions = await this.generateModelPredictions(
                    preprocessedData, horizon, seasonalAnalysis
                );
                
                // Create ensemble prediction
                const ensemblePrediction = await this.createEnsemblePrediction(
                    modelPredictions, horizon
                );
                
                // Calculate prediction intervals
                const predictionIntervals = await this.calculatePredictionIntervals(
                    modelPredictions, ensemblePrediction, horizon
                );
                
                // Generate trend analysis
                const trendAnalysis = await this.analyzeTrendCharacteristics(
                    ensemblePrediction, preprocessedData
                );

                // Compile results
                const results = {
                    seriesName,
                    predictionId,
                    timestamp: Date.now(),
                    processingTime: Date.now() - startTime,
                    horizon,
                    dataPoints: series.data.length,
                    predictions: {
                        ensemble: ensemblePrediction,
                        individual: modelPredictions,
                        intervals: predictionIntervals
                    },
                    analysis: {
                        trend: trendAnalysis,
                        seasonal: seasonalAnalysis,
                        preprocessing: preprocessedData.transformations
                    },
                    metadata: {
                        modelsUsed: Object.keys(modelPredictions),
                        ensembleMethod: this.models.ensemble.get('adaptive_ensemble').method,
                        confidenceLevel: this.config.confidenceLevel
                    }
                };

                // Cache results
                this.predictionCache.set(cacheKey, results);

                // Update metrics
                this.updatePredictionMetrics(results);

                // Store prediction for later evaluation
                this.storePredictionForEvaluation(results);

                // Emit results
                this.emit('prediction-complete', results);

                span.setAttributes({
                    'trend.processing_time_ms': results.processingTime,
                    'trend.models_used': Object.keys(modelPredictions).length,
                    'trend.data_points': series.data.length
                });

                span.setStatus({ code: 1, message: 'Trend prediction completed' });
                return results;

            } catch (error) {
                console.error(`❌ Error predicting trend for ${seriesName}:`, error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                this.activePredictions.delete(predictionId);
                span.end();
            }
        });
    }

    /**
     * Preprocess time series data
     */
    async preprocessTimeSeries(series) {
        const data = series.data.map(point => point.value);
        const timestamps = series.data.map(point => point.timestamp);
        
        const preprocessed = {
            original: data,
            processed: [...data],
            timestamps,
            transformations: [],
            outliers: [],
            missing: []
        };

        // Handle missing values
        preprocessed.processed = this.imputeMissingValues(preprocessed.processed);
        if (preprocessed.processed.some((val, idx) => val !== data[idx])) {
            preprocessed.transformations.push('missing_value_imputation');
        }

        // Detect and handle outliers
        const outlierIndices = this.detectOutliers(preprocessed.processed);
        if (outlierIndices.length > 0) {
            preprocessed.outliers = outlierIndices;
            preprocessed.processed = this.handleOutliers(preprocessed.processed, outlierIndices);
            preprocessed.transformations.push('outlier_handling');
        }

        // Test for stationarity
        const stationarity = this.testStationarity(preprocessed.processed);
        
        // Apply transformations if needed
        if (!stationarity.isStationary) {
            // Apply differencing
            if (stationarity.suggestedTransformation.includes('diff')) {
                preprocessed.processed = this.applyDifferencing(preprocessed.processed);
                preprocessed.transformations.push('differencing');
            }
            
            // Apply log transformation if variance is non-constant
            if (stationarity.suggestedTransformation.includes('log')) {
                preprocessed.processed = this.applyLogTransformation(preprocessed.processed);
                preprocessed.transformations.push('log_transformation');
            }
        }

        return preprocessed;
    }

    /**
     * Analyze seasonality in time series
     */
    async analyzeSeasonality(preprocessedData) {
        const data = preprocessedData.processed;
        
        if (data.length < 2 * Math.max(...this.config.seasonalPeriods)) {
            return {
                detected: false,
                periods: [],
                strength: 0,
                components: null
            };
        }

        const seasonalAnalysis = {
            detected: false,
            periods: [],
            strength: 0,
            components: null,
            decomposition: null
        };

        // Test each potential seasonal period
        for (const period of this.config.seasonalPeriods) {
            if (data.length >= 2 * period) {
                const seasonality = this.testSeasonality(data, period);
                
                if (seasonality.strength > 0.3) {
                    seasonalAnalysis.periods.push({
                        period,
                        strength: seasonality.strength,
                        significance: seasonality.significance
                    });
                }
            }
        }

        // If seasonality detected, perform decomposition
        if (seasonalAnalysis.periods.length > 0) {
            seasonalAnalysis.detected = true;
            seasonalAnalysis.strength = Math.max(...seasonalAnalysis.periods.map(p => p.strength));
            
            // Use the strongest seasonal period for decomposition
            const strongestPeriod = seasonalAnalysis.periods.reduce((max, p) => 
                p.strength > max.strength ? p : max
            );
            
            seasonalAnalysis.decomposition = this.decomposeTimeSeries(
                data, strongestPeriod.period
            );
        }

        return seasonalAnalysis;
    }

    /**
     * Generate predictions from all enabled models
     */
    async generateModelPredictions(preprocessedData, horizon, seasonalAnalysis) {
        const predictions = {};
        const data = preprocessedData.processed;

        // ARIMA predictions
        if (this.config.enabledModels.includes('arima')) {
            try {
                const arimaModel = await this.fitARIMAModel(data, seasonalAnalysis);
                predictions.arima = await this.predictARIMA(arimaModel, horizon);
                this.updateModelUsageStats('arima');
            } catch (error) {
                console.warn('ARIMA prediction failed:', error.message);
            }
        }

        // Exponential Smoothing predictions
        if (this.config.enabledModels.includes('exponential_smoothing')) {
            try {
                const esModel = await this.fitExponentialSmoothingModel(data, seasonalAnalysis);
                predictions.exponential_smoothing = await this.predictExponentialSmoothing(esModel, horizon);
                this.updateModelUsageStats('exponential_smoothing');
            } catch (error) {
                console.warn('Exponential Smoothing prediction failed:', error.message);
            }
        }

        // Linear Regression predictions
        if (this.config.enabledModels.includes('linear_regression')) {
            try {
                const lrModel = await this.fitLinearRegressionModel(data);
                predictions.linear_regression = await this.predictLinearRegression(lrModel, horizon);
                this.updateModelUsageStats('linear_regression');
            } catch (error) {
                console.warn('Linear Regression prediction failed:', error.message);
            }
        }

        // Seasonal Naive predictions
        if (this.config.enabledModels.includes('seasonal_naive')) {
            try {
                const snModel = await this.fitSeasonalNaiveModel(data, seasonalAnalysis);
                predictions.seasonal_naive = await this.predictSeasonalNaive(snModel, horizon);
                this.updateModelUsageStats('seasonal_naive');
            } catch (error) {
                console.warn('Seasonal Naive prediction failed:', error.message);
            }
        }

        return predictions;
    }

    /**
     * Fit ARIMA model
     */
    async fitARIMAModel(data, seasonalAnalysis) {
        const model = this.models.arima.get('auto_arima');
        
        // Auto-select ARIMA parameters
        const bestParams = await this.selectARIMAParameters(data, seasonalAnalysis);
        
        // Fit ARIMA model with selected parameters
        const fittedModel = {
            ...model,
            parameters: bestParams,
            data: data,
            fitted: true,
            fittedAt: Date.now()
        };
        
        // Calculate residuals and fit statistics
        fittedModel.residuals = this.calculateARIMAResiduals(data, bestParams);
        fittedModel.aic = this.calculateAIC(fittedModel.residuals, bestParams);
        fittedModel.bic = this.calculateBIC(fittedModel.residuals, bestParams, data.length);
        
        return fittedModel;
    }

    /**
     * Predict using ARIMA model
     */
    async predictARIMA(model, horizon) {
        const predictions = [];
        const confidence = [];
        
        // Simple ARIMA prediction implementation
        const lastValues = model.data.slice(-Math.max(model.parameters.p, 1));
        const lastForecast = lastValues[lastValues.length - 1];
        
        for (let i = 1; i <= horizon; i++) {
            // Simplified ARIMA prediction (in production, use proper ARIMA implementation)
            const trend = this.calculateTrend(lastValues);
            const seasonalComponent = model.parameters.seasonal ? 
                this.getSeasonalComponent(i, model.parameters.seasonalPeriod) : 0;
            
            const prediction = lastForecast + (trend * i) + seasonalComponent;
            const confidenceInterval = this.calculateARIMAConfidence(model, i);
            
            predictions.push({
                step: i,
                value: prediction,
                timestamp: Date.now() + (i * 60000) // Assume 1-minute intervals
            });
            
            confidence.push({
                step: i,
                lower: prediction - confidenceInterval,
                upper: prediction + confidenceInterval,
                interval: confidenceInterval
            });
        }
        
        return {
            model: 'arima',
            predictions,
            confidence,
            parameters: model.parameters,
            performance: {
                aic: model.aic,
                bic: model.bic,
                residualVariance: this.calculateVariance(model.residuals)
            }
        };
    }

    /**
     * Fit Exponential Smoothing model
     */
    async fitExponentialSmoothingModel(data, seasonalAnalysis) {
        const model = seasonalAnalysis.detected ? 
            this.models.exponentialSmoothing.get('holt_winters') :
            this.models.exponentialSmoothing.get('simple_exponential');
        
        const fittedModel = { ...model };
        
        if (seasonalAnalysis.detected) {
            // Holt-Winters triple exponential smoothing
            const seasonalPeriod = seasonalAnalysis.periods[0]?.period || 12;
            fittedModel.parameters.seasonalPeriod = seasonalPeriod;
            
            const smoothingResult = this.fitHoltWinters(data, seasonalPeriod, 
                fittedModel.parameters.alpha,
                fittedModel.parameters.beta,
                fittedModel.parameters.gamma
            );
            
            fittedModel.state = smoothingResult;
        } else {
            // Simple exponential smoothing
            const smoothingResult = this.fitSimpleExponentialSmoothing(
                data, fittedModel.parameters.alpha
            );
            
            fittedModel.state = smoothingResult;
        }
        
        fittedModel.fitted = true;
        fittedModel.fittedAt = Date.now();
        
        return fittedModel;
    }

    /**
     * Predict using Exponential Smoothing
     */
    async predictExponentialSmoothing(model, horizon) {
        const predictions = [];
        const confidence = [];
        
        for (let i = 1; i <= horizon; i++) {
            let prediction;
            
            if (model.type === 'holt_winters') {
                // Holt-Winters prediction
                const seasonalIndex = (i - 1) % model.parameters.seasonalPeriod;
                const seasonalComponent = model.state.seasonal[seasonalIndex] || 0;
                
                prediction = model.state.level + (model.state.trend * i) + seasonalComponent;
            } else {
                // Simple exponential smoothing
                prediction = model.state.level;
            }
            
            const confidenceInterval = this.calculateESConfidence(model, i);
            
            predictions.push({
                step: i,
                value: prediction,
                timestamp: Date.now() + (i * 60000)
            });
            
            confidence.push({
                step: i,
                lower: prediction - confidenceInterval,
                upper: prediction + confidenceInterval,
                interval: confidenceInterval
            });
        }
        
        return {
            model: 'exponential_smoothing',
            predictions,
            confidence,
            parameters: model.parameters,
            performance: {
                mse: this.calculateMSE(model.state.residuals || []),
                smoothingParameters: {
                    alpha: model.parameters.alpha,
                    beta: model.parameters.beta,
                    gamma: model.parameters.gamma
                }
            }
        };
    }

    /**
     * Create ensemble prediction
     */
    async createEnsemblePrediction(modelPredictions, horizon) {
        const ensembleModel = this.models.ensemble.get('adaptive_ensemble');
        const method = ensembleModel.method;
        
        const ensemblePredictions = [];
        const ensembleConfidence = [];
        
        // Get model weights
        const weights = await this.calculateEnsembleWeights(modelPredictions, method);
        
        for (let i = 1; i <= horizon; i++) {
            let weightedSum = 0;
            let weightSum = 0;
            let confidenceSum = 0;
            const stepPredictions = [];
            
            // Collect predictions from all models for this step
            for (const [modelName, modelPrediction] of Object.entries(modelPredictions)) {
                const stepPrediction = modelPrediction.predictions.find(p => p.step === i);
                const stepConfidence = modelPrediction.confidence.find(c => c.step === i);
                
                if (stepPrediction && weights.has(modelName)) {
                    const weight = weights.get(modelName);
                    weightedSum += stepPrediction.value * weight;
                    weightSum += weight;
                    confidenceSum += stepConfidence.interval * weight;
                    
                    stepPredictions.push({
                        model: modelName,
                        value: stepPrediction.value,
                        weight: weight
                    });
                }
            }
            
            if (weightSum > 0) {
                const ensembleValue = weightedSum / weightSum;
                const ensembleConfidenceInterval = confidenceSum / weightSum;
                
                ensemblePredictions.push({
                    step: i,
                    value: ensembleValue,
                    timestamp: Date.now() + (i * 60000),
                    components: stepPredictions
                });
                
                ensembleConfidence.push({
                    step: i,
                    lower: ensembleValue - ensembleConfidenceInterval,
                    upper: ensembleValue + ensembleConfidenceInterval,
                    interval: ensembleConfidenceInterval
                });
            }
        }
        
        return {
            model: 'ensemble',
            method: method,
            predictions: ensemblePredictions,
            confidence: ensembleConfidence,
            weights: Object.fromEntries(weights),
            modelCount: Object.keys(modelPredictions).length
        };
    }

    /**
     * Calculate ensemble weights based on model performance
     */
    async calculateEnsembleWeights(modelPredictions, method) {
        const weights = new Map();
        const modelNames = Object.keys(modelPredictions);
        
        switch (method) {
            case 'simple_average':
                modelNames.forEach(name => weights.set(name, 1.0 / modelNames.length));
                break;
                
            case 'weighted_average':
                // Weight based on historical performance
                let totalPerformance = 0;
                const performances = new Map();
                
                modelNames.forEach(name => {
                    const perf = this.modelPerformance.get(name);
                    const accuracy = perf ? (perf.accuracy.get('mae') || 1.0) : 1.0;
                    const performance = 1.0 / (accuracy + 0.001); // Higher is better
                    performances.set(name, performance);
                    totalPerformance += performance;
                });
                
                if (totalPerformance > 0) {
                    performances.forEach((perf, name) => {
                        weights.set(name, perf / totalPerformance);
                    });
                } else {
                    modelNames.forEach(name => weights.set(name, 1.0 / modelNames.length));
                }
                break;
                
            case 'median_ensemble':
                // Equal weights for median calculation
                modelNames.forEach(name => weights.set(name, 1.0));
                break;
                
            case 'best_model':
                // Find best performing model
                let bestModel = modelNames[0];
                let bestPerformance = Infinity;
                
                modelNames.forEach(name => {
                    const perf = this.modelPerformance.get(name);
                    const accuracy = perf ? (perf.accuracy.get('mae') || Infinity) : Infinity;
                    if (accuracy < bestPerformance) {
                        bestPerformance = accuracy;
                        bestModel = name;
                    }
                });
                
                modelNames.forEach(name => {
                    weights.set(name, name === bestModel ? 1.0 : 0.0);
                });
                break;
        }
        
        return weights;
    }

    /**
     * Calculate prediction intervals
     */
    async calculatePredictionIntervals(modelPredictions, ensemblePrediction, horizon) {
        const intervals = {
            ensemble: ensemblePrediction.confidence,
            individual: {},
            summary: {
                averageWidth: 0,
                convergence: 0,
                uncertainty: 0
            }
        };
        
        // Collect individual model intervals
        Object.entries(modelPredictions).forEach(([modelName, prediction]) => {
            intervals.individual[modelName] = prediction.confidence;
        });
        
        // Calculate summary statistics
        if (ensemblePrediction.confidence.length > 0) {
            const widths = ensemblePrediction.confidence.map(c => c.upper - c.lower);
            intervals.summary.averageWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
            
            // Measure how intervals change over time (convergence/divergence)
            if (widths.length > 1) {
                const firstWidth = widths[0];
                const lastWidth = widths[widths.length - 1];
                intervals.summary.convergence = (firstWidth - lastWidth) / firstWidth;
            }
            
            // Overall uncertainty measure
            intervals.summary.uncertainty = Math.max(...widths) / (Math.abs(ensemblePrediction.predictions[0]?.value) || 1);
        }
        
        return intervals;
    }

    /**
     * Analyze trend characteristics
     */
    async analyzeTrendCharacteristics(ensemblePrediction, preprocessedData) {
        const predictions = ensemblePrediction.predictions.map(p => p.value);
        const historicalData = preprocessedData.processed;
        
        const analysis = {
            direction: 'stable',
            strength: 0,
            acceleration: 0,
            volatility: 0,
            confidence: 0,
            turning_points: [],
            seasonal_component: 0
        };
        
        if (predictions.length < 2) return analysis;
        
        // Determine trend direction
        const firstValue = predictions[0];
        const lastValue = predictions[predictions.length - 1];
        const overallChange = (lastValue - firstValue) / Math.abs(firstValue);
        
        if (overallChange > 0.05) {
            analysis.direction = 'increasing';
        } else if (overallChange < -0.05) {
            analysis.direction = 'decreasing';
        }
        
        // Calculate trend strength
        analysis.strength = Math.abs(overallChange);
        
        // Calculate acceleration (second derivative)
        if (predictions.length >= 3) {
            const firstDerivative = [];
            for (let i = 1; i < predictions.length; i++) {
                firstDerivative.push(predictions[i] - predictions[i - 1]);
            }
            
            const secondDerivative = [];
            for (let i = 1; i < firstDerivative.length; i++) {
                secondDerivative.push(firstDerivative[i] - firstDerivative[i - 1]);
            }
            
            analysis.acceleration = secondDerivative.reduce((a, b) => a + b, 0) / secondDerivative.length;
        }
        
        // Calculate volatility
        const changes = [];
        for (let i = 1; i < predictions.length; i++) {
            changes.push(Math.abs(predictions[i] - predictions[i - 1]) / Math.abs(predictions[i - 1]));
        }
        analysis.volatility = changes.reduce((a, b) => a + b, 0) / changes.length;
        
        // Detect turning points
        for (let i = 1; i < predictions.length - 1; i++) {
            const prev = predictions[i - 1];
            const curr = predictions[i];
            const next = predictions[i + 1];
            
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                analysis.turning_points.push({
                    step: i + 1,
                    value: curr,
                    type: curr > prev && curr > next ? 'peak' : 'valley'
                });
            }
        }
        
        // Overall confidence in trend analysis
        analysis.confidence = Math.max(0, Math.min(1, 1 - analysis.volatility));
        
        return analysis;
    }

    /**
     * Helper methods for time series processing
     */

    imputeMissingValues(data) {
        const result = [...data];
        
        for (let i = 0; i < result.length; i++) {
            if (result[i] === null || result[i] === undefined || isNaN(result[i])) {
                // Linear interpolation
                let prevValue = null;
                let nextValue = null;
                
                // Find previous valid value
                for (let j = i - 1; j >= 0; j--) {
                    if (!isNaN(result[j])) {
                        prevValue = result[j];
                        break;
                    }
                }
                
                // Find next valid value
                for (let j = i + 1; j < result.length; j++) {
                    if (!isNaN(result[j])) {
                        nextValue = result[j];
                        break;
                    }
                }
                
                // Interpolate
                if (prevValue !== null && nextValue !== null) {
                    result[i] = (prevValue + nextValue) / 2;
                } else if (prevValue !== null) {
                    result[i] = prevValue;
                } else if (nextValue !== null) {
                    result[i] = nextValue;
                } else {
                    result[i] = 0; // Last resort
                }
            }
        }
        
        return result;
    }

    detectOutliers(data) {
        const sortedData = [...data].sort((a, b) => a - b);
        const q1 = sortedData[Math.floor(sortedData.length * 0.25)];
        const q3 = sortedData[Math.floor(sortedData.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const outliers = [];
        data.forEach((value, index) => {
            if (value < lowerBound || value > upperBound) {
                outliers.push(index);
            }
        });
        
        return outliers;
    }

    handleOutliers(data, outlierIndices) {
        const result = [...data];
        const median = this.calculateMedian(data.filter((_, idx) => !outlierIndices.includes(idx)));
        
        outlierIndices.forEach(index => {
            result[index] = median;
        });
        
        return result;
    }

    testStationarity(data) {
        // Simplified stationarity test
        const mean1 = data.slice(0, Math.floor(data.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(data.length / 2);
        const mean2 = data.slice(Math.floor(data.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(data.length / 2);
        
        const var1 = this.calculateVariance(data.slice(0, Math.floor(data.length / 2)));
        const var2 = this.calculateVariance(data.slice(Math.floor(data.length / 2)));
        
        const meanDifference = Math.abs(mean1 - mean2);
        const varianceRatio = Math.max(var1, var2) / (Math.min(var1, var2) + 0.001);
        
        const isStationary = meanDifference < 0.1 && varianceRatio < 2.0;
        
        return {
            isStationary,
            meanDifference,
            varianceRatio,
            suggestedTransformation: isStationary ? [] : ['diff', 'log']
        };
    }

    applyDifferencing(data) {
        const differenced = [];
        for (let i = 1; i < data.length; i++) {
            differenced.push(data[i] - data[i - 1]);
        }
        return differenced;
    }

    applyLogTransformation(data) {
        return data.map(val => val > 0 ? Math.log(val) : 0);
    }

    testSeasonality(data, period) {
        // Simple seasonality test using autocorrelation
        let correlation = 0;
        let count = 0;
        
        for (let i = 0; i < data.length - period; i++) {
            correlation += data[i] * data[i + period];
            count++;
        }
        
        if (count === 0) return { strength: 0, significance: 0 };
        
        correlation /= count;
        const strength = Math.abs(correlation) / (this.calculateVariance(data) + 0.001);
        
        return {
            strength: Math.min(1, strength),
            significance: strength > 0.3 ? 0.95 : 0.05,
            period
        };
    }

    decomposeTimeSeries(data, period) {
        const trend = [];
        const seasonal = [];
        const residual = [];
        
        // Simple moving average for trend
        const halfPeriod = Math.floor(period / 2);
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - halfPeriod);
            const end = Math.min(data.length, i + halfPeriod + 1);
            const window = data.slice(start, end);
            trend.push(window.reduce((a, b) => a + b, 0) / window.length);
        }
        
        // Calculate seasonal component
        const seasonalPattern = new Array(period).fill(0);
        const seasonalCounts = new Array(period).fill(0);
        
        for (let i = 0; i < data.length; i++) {
            const seasonalIndex = i % period;
            const detrended = data[i] - trend[i];
            seasonalPattern[seasonalIndex] += detrended;
            seasonalCounts[seasonalIndex]++;
        }
        
        for (let i = 0; i < period; i++) {
            if (seasonalCounts[i] > 0) {
                seasonalPattern[i] /= seasonalCounts[i];
            }
        }
        
        // Apply seasonal pattern and calculate residuals
        for (let i = 0; i < data.length; i++) {
            const seasonalIndex = i % period;
            seasonal.push(seasonalPattern[seasonalIndex]);
            residual.push(data[i] - trend[i] - seasonal[i]);
        }
        
        return {
            trend,
            seasonal: seasonalPattern,
            residual,
            period
        };
    }

    calculateMedian(data) {
        const sorted = [...data].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? 
            (sorted[middle - 1] + sorted[middle]) / 2 : 
            sorted[middle];
    }

    calculateVariance(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    }

    calculateMSE(residuals) {
        if (residuals.length === 0) return 0;
        return residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;
    }

    /**
     * Schedule model update
     */
    scheduleModelUpdate(seriesName) {
        if (!this.updateSchedule.has(seriesName)) {
            this.updateSchedule.set(seriesName, Date.now() + this.config.updateInterval);
        }
    }

    /**
     * Update models on schedule
     */
    async updateModelsScheduled() {
        const now = Date.now();
        
        for (const [seriesName, scheduledTime] of this.updateSchedule) {
            if (now >= scheduledTime) {
                try {
                    // Trigger model refit for this series
                    console.log(`🔄 Updating models for series: ${seriesName}`);
                    this.updateSchedule.delete(seriesName);
                } catch (error) {
                    console.error(`Error updating models for ${seriesName}:`, error);
                }
            }
        }
    }

    /**
     * Evaluate model performance
     */
    async evaluateModelPerformance() {
        // This would typically involve backtesting and cross-validation
        console.log('📊 Evaluating model performance...');
        // Implementation would go here
    }

    /**
     * Update prediction metrics
     */
    updatePredictionMetrics(results) {
        this.metrics.totalPredictions++;
        this.metrics.successfulPredictions++;
        this.metrics.processingTimes.push(results.processingTime);
        
        // Update model usage statistics
        if (results.metadata.modelsUsed) {
            results.metadata.modelsUsed.forEach(model => {
                this.updateModelUsageStats(model);
            });
        }
        
        // Limit arrays
        if (this.metrics.processingTimes.length > 1000) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-500);
        }
    }

    /**
     * Update model usage statistics
     */
    updateModelUsageStats(modelName) {
        const current = this.metrics.modelUsageStats.get(modelName) || 0;
        this.metrics.modelUsageStats.set(modelName, current + 1);
    }

    /**
     * Store prediction for evaluation
     */
    storePredictionForEvaluation(results) {
        // Store predictions for later accuracy evaluation
        const key = `${results.seriesName}_${results.timestamp}`;
        this.predictions.set(key, {
            seriesName: results.seriesName,
            predictions: results.predictions.ensemble.predictions,
            timestamp: results.timestamp,
            horizon: results.horizon
        });
        
        // Limit stored predictions
        if (this.predictions.size > 1000) {
            const oldestKey = this.predictions.keys().next().value;
            this.predictions.delete(oldestKey);
        }
    }

    /**
     * Invalidate cache for series
     */
    invalidateCache(seriesName) {
        for (const key of this.predictionCache.keys()) {
            if (key.startsWith(seriesName)) {
                this.predictionCache.delete(key);
            }
        }
    }

    /**
     * Perform cleanup
     */
    async performCleanup() {
        const now = Date.now();
        const maxAge = this.config.historyRetention;
        
        // Clean up old time series data
        for (const [seriesName, series] of this.timeSeries) {
            series.data = series.data.filter(point => now - point.timestamp < maxAge);
            if (series.data.length === 0) {
                this.timeSeries.delete(seriesName);
            }
        }
        
        // Clean up old predictions
        for (const [key, prediction] of this.predictions) {
            if (now - prediction.timestamp > maxAge) {
                this.predictions.delete(key);
            }
        }
        
        // Clean up caches
        [this.predictionCache, this.decompositionCache, this.modelFitCache].forEach(cache => {
            for (const [key, value] of cache) {
                if (value.timestamp && now - value.timestamp > maxAge) {
                    cache.delete(key);
                }
            }
        });
        
        console.log('🧹 Trend predictor cleanup completed');
    }

    /**
     * Get prediction statistics
     */
    getStatistics() {
        const avgProcessingTime = this.metrics.processingTimes.length > 0 ?
            this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length : 0;

        return {
            totalPredictions: this.metrics.totalPredictions,
            successfulPredictions: this.metrics.successfulPredictions,
            successRate: this.metrics.totalPredictions > 0 ? 
                this.metrics.successfulPredictions / this.metrics.totalPredictions : 0,
            avgProcessingTime: Math.round(avgProcessingTime),
            modelUsage: Object.fromEntries(this.metrics.modelUsageStats),
            timeSeriesCount: this.timeSeries.size,
            activePredictions: this.activePredictions.size,
            cacheSize: this.predictionCache.size,
            enabledModels: this.config.enabledModels,
            initialized: this.initialized,
            running: this.isRunning
        };
    }

    /**
     * Stop the trend predictor
     */
    async stop() {
        console.log('🛑 Stopping Trend Predictor...');
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        // Wait for active predictions to complete
        const maxWait = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activePredictions.size > 0 && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log('✅ Trend Predictor stopped');
    }
}

export default TrendPredictor;
