/**
 * InsightsGenerator - Intelligent insights generation from ML analytics data
 * 
 * This service provides comprehensive insights generation capabilities including:
 * - Automated analysis and interpretation of ML analytics results
 * - Pattern-based insights using template matching and classification
 * - Trend analysis with predictive insights and recommendations
 * - Anomaly summarization and impact assessment
 * - Performance insights with optimization recommendations
 * - Natural language generation for human-readable insights
 * 
 * Features:
 * - Multi-dimensional analysis combining patterns, trends, and anomalies
 * - Context-aware insights based on historical data and domain knowledge
 * - Severity classification and prioritization of insights
 * - Automated recommendations and action suggestions
 * - Real-time insights streaming for live monitoring
 * - Custom insight templates for domain-specific analysis
 */

import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class InsightsGenerator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration with intelligent defaults
        this.config = {
            // Insight generation settings
            enabledAnalyzers: options.enabledAnalyzers || [
                'pattern_insights', 'trend_insights', 'anomaly_insights', 
                'performance_insights', 'correlation_insights', 'forecasting_insights'
            ],
            
            // Natural language generation
            nlgEnabled: options.nlgEnabled !== false,
            language: options.language || 'en',
            verbosity: options.verbosity || 'medium', // 'low', 'medium', 'high'
            technicalLevel: options.technicalLevel || 'business', // 'technical', 'business', 'executive'
            
            // Insight filtering and ranking
            minConfidenceScore: options.minConfidenceScore || 0.3,
            maxInsightsPerAnalysis: options.maxInsightsPerAnalysis || 20,
            priorityWeights: {
                severity: options.severityWeight || 0.4,
                confidence: options.confidenceWeight || 0.3,
                impact: options.impactWeight || 0.2,
                novelty: options.noveltyWeight || 0.1
            },
            
            // Temporal analysis settings
            timeHorizons: options.timeHorizons || ['1h', '6h', '24h', '7d', '30d'],
            trendSignificanceThreshold: options.trendSignificanceThreshold || 0.05,
            seasonalityConfidence: options.seasonalityConfidence || 0.7,
            
            // Anomaly insights
            anomalyImpactThreshold: options.anomalyImpactThreshold || 0.5,
            anomalyClusteringThreshold: options.anomalyClusteringThreshold || 0.3,
            
            // Performance insights
            performanceBaselines: options.performanceBaselines || {
                responseTime: 200,
                throughput: 1000,
                errorRate: 0.01,
                cpuUsage: 0.7,
                memoryUsage: 0.8
            },
            
            // Correlation analysis
            correlationThreshold: options.correlationThreshold || 0.6,
            maxCorrelationLag: options.maxCorrelationLag || 24,
            
            // Real-time processing
            streamingInsights: options.streamingInsights !== false,
            insightBuffer: options.insightBuffer || 100,
            updateInterval: options.updateInterval || 300000, // 5 minutes
            
            // Caching and performance
            cacheEnabled: options.cacheEnabled !== false,
            cacheTTL: options.cacheTTL || 1800000, // 30 minutes
            maxCacheSize: options.maxCacheSize || 1000,
            
            ...options
        };

        // Insight analyzers and generators
        this.analyzers = {
            pattern_insights: this.generatePatternInsights.bind(this),
            trend_insights: this.generateTrendInsights.bind(this),
            anomaly_insights: this.generateAnomalyInsights.bind(this),
            performance_insights: this.generatePerformanceInsights.bind(this),
            correlation_insights: this.generateCorrelationInsights.bind(this),
            forecasting_insights: this.generateForecastingInsights.bind(this)
        };
        
        // Data storage
        this.historicalData = new Map(); // Historical data for context
        this.insights = new Map(); // Generated insights storage
        this.insightTemplates = new Map(); // Insight generation templates
        this.contextData = new Map(); // Context for insight generation
        
        // Performance tracking
        this.metrics = {
            totalInsightsGenerated: 0,
            insightsByType: new Map(),
            insightsBySeverity: new Map(),
            averageGenerationTime: 0,
            cacheHitRate: 0,
            nlgRequests: 0,
            processingTimes: []
        };
        
        // Insight cache
        this.insightCache = new Map();
        this.cacheAccessTimes = new Map();
        
        // Natural Language Generation templates
        this.nlgTemplates = this.initializeNLGTemplates();
        
        // Severity classification
        this.severityClassifiers = {
            critical: { threshold: 0.9, color: '#d32f2f', priority: 1 },
            high: { threshold: 0.7, color: '#f57c00', priority: 2 },
            medium: { threshold: 0.5, color: '#fbc02d', priority: 3 },
            low: { threshold: 0.3, color: '#388e3c', priority: 4 },
            info: { threshold: 0.0, color: '#1976d2', priority: 5 }
        };
        
        // OpenTelemetry tracing setup
        this.tracer = OpenTelemetryTracing.getTracer('insights-generator');
        
        // Background processing
        this.intervals = {
            insights: null,
            cleanup: null,
            cache: null
        };
        
        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the insights generation system
     */
    async initialize() {
        return this.tracer.startActiveSpan('insights-generator-initialize', async (span) => {
            try {
                span.setAttributes({
                    'insights.component': 'InsightsGenerator',
                    'insights.operation': 'initialize'
                });

                console.log('💡 Initializing Insights Generator...');
                
                // Initialize insight analyzers
                await this.initializeAnalyzers();
                
                // Setup insight templates
                await this.setupInsightTemplates();
                
                // Initialize natural language generation
                await this.initializeNLG();
                
                // Setup context tracking
                await this.setupContextTracking();
                
                // Start background processing
                this.startBackgroundProcessing();
                
                this.initialized = true;
                console.log('✅ Insights Generator initialized successfully');
                
                span.setStatus({ code: 1, message: 'Insights generator initialized' });
                this.emit('initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize insights generator:', error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Initialize insight analyzers
     */
    async initializeAnalyzers() {
        console.log('🔍 Initializing insight analyzers...');
        
        // Initialize analyzer configurations
        for (const analyzer of this.config.enabledAnalyzers) {
            this.metrics.insightsByType.set(analyzer, 0);
        }
        
        // Initialize severity tracking
        Object.keys(this.severityClassifiers).forEach(severity => {
            this.metrics.insightsBySeverity.set(severity, 0);
        });
        
        console.log(`✅ Initialized ${this.config.enabledAnalyzers.length} insight analyzers`);
    }

    /**
     * Setup insight templates
     */
    async setupInsightTemplates() {
        console.log('📋 Setting up insight templates...');
        
        // Pattern insight templates
        this.insightTemplates.set('pattern_recurring', {
            type: 'pattern_insights',
            template: 'Recurring pattern detected in {metric} with {frequency} frequency and {confidence}% confidence',
            severity: 'medium',
            actionable: true,
            tags: ['pattern', 'recurring', 'predictable']
        });
        
        this.insightTemplates.set('pattern_anomalous', {
            type: 'pattern_insights',
            template: 'Anomalous pattern break detected in {metric} at {timestamp}',
            severity: 'high',
            actionable: true,
            tags: ['pattern', 'break', 'anomaly']
        });
        
        // Trend insight templates
        this.insightTemplates.set('trend_increasing', {
            type: 'trend_insights',
            template: '{metric} showing {direction} trend with {rate} rate of change',
            severity: 'medium',
            actionable: true,
            tags: ['trend', 'increasing', 'growth']
        });
        
        this.insightTemplates.set('trend_degrading', {
            type: 'trend_insights',
            template: 'Performance degradation detected: {metric} declining by {rate} over {period}',
            severity: 'high',
            actionable: true,
            tags: ['trend', 'degradation', 'performance']
        });
        
        // Anomaly insight templates
        this.insightTemplates.set('anomaly_spike', {
            type: 'anomaly_insights',
            template: 'Significant spike detected in {metric}: {value} ({deviation}% above normal)',
            severity: 'critical',
            actionable: true,
            tags: ['anomaly', 'spike', 'outlier']
        });
        
        this.insightTemplates.set('anomaly_drop', {
            type: 'anomaly_insights',
            template: 'Unusual drop detected in {metric}: {value} ({deviation}% below normal)',
            severity: 'high',
            actionable: true,
            tags: ['anomaly', 'drop', 'decline']
        });
        
        // Performance insight templates
        this.insightTemplates.set('performance_bottleneck', {
            type: 'performance_insights',
            template: 'Performance bottleneck identified in {component}: {metric} at {percentage}% of capacity',
            severity: 'high',
            actionable: true,
            tags: ['performance', 'bottleneck', 'capacity']
        });
        
        // Correlation insight templates
        this.insightTemplates.set('correlation_strong', {
            type: 'correlation_insights',
            template: 'Strong correlation ({correlation}) detected between {metric1} and {metric2}',
            severity: 'medium',
            actionable: false,
            tags: ['correlation', 'relationship', 'dependency']
        });
        
        console.log('✅ Insight templates configured');
    }

    /**
     * Initialize Natural Language Generation templates
     */
    initializeNLGTemplates() {
        return {
            summaries: {
                pattern: 'Analysis of {metric} reveals {pattern_count} distinct patterns with average confidence of {avg_confidence}%',
                trend: 'Trend analysis shows {metric} is {trend_direction} at a rate of {trend_rate} over the {time_period}',
                anomaly: 'Anomaly detection identified {anomaly_count} outliers in {metric} with {severity} severity level',
                performance: 'Performance analysis indicates {component} is operating at {utilization}% capacity'
            },
            recommendations: {
                pattern: 'Consider scheduling resources based on identified {pattern_type} patterns',
                trend: 'Monitor {metric} closely as current trend suggests {prediction} by {timeframe}',
                anomaly: 'Investigate {metric} anomalies to prevent potential service disruptions',
                performance: 'Scale {component} resources to handle increased load'
            },
            explanations: {
                confidence: 'This insight is based on {data_points} data points with {confidence}% statistical confidence',
                impact: 'Estimated impact: {impact_level} affecting {affected_metrics}',
                timeline: 'Analysis covers data from {start_time} to {end_time}'
            }
        };
    }

    /**
     * Initialize Natural Language Generation
     */
    async initializeNLG() {
        if (!this.config.nlgEnabled) {
            console.log('📝 Natural Language Generation disabled');
            return;
        }
        
        console.log('📝 Initializing Natural Language Generation...');
        
        // Setup language-specific configurations
        this.nlgConfig = {
            language: this.config.language,
            verbosity: this.config.verbosity,
            technicalLevel: this.config.technicalLevel
        };
        
        console.log('✅ Natural Language Generation initialized');
    }

    /**
     * Setup context tracking
     */
    async setupContextTracking() {
        console.log('🧠 Setting up context tracking...');
        
        // Initialize context categories
        this.contextCategories = {
            system: new Map(),
            business: new Map(),
            operational: new Map(),
            historical: new Map()
        };
        
        console.log('✅ Context tracking configured');
    }

    /**
     * Start background processing
     */
    startBackgroundProcessing() {
        console.log('⚡ Starting background processing...');
        
        // Insights generation interval (if streaming enabled)
        if (this.config.streamingInsights) {
            this.intervals.insights = setInterval(() => {
                this.processInsightQueue();
            }, this.config.updateInterval);
        }
        
        // Cache management interval
        this.intervals.cache = setInterval(() => {
            this.manageCaches();
        }, this.config.updateInterval);
        
        // Cleanup interval
        this.intervals.cleanup = setInterval(() => {
            this.performCleanup();
        }, 60 * 60 * 1000); // Hourly cleanup
        
        this.isRunning = true;
        console.log('✅ Background processing started');
    }

    /**
     * Generate insights from analytics data
     */
    async generateInsights(analyticsData, options = {}) {
        if (!this.initialized) {
            throw new Error('Insights generator not initialized');
        }

        return this.tracer.startActiveSpan('insights-generate-insights', async (span) => {
            try {
                span.setAttributes({
                    'insights.data_sources': Object.keys(analyticsData).length,
                    'insights.analyzers': this.config.enabledAnalyzers.length,
                    'insights.operation': 'generate_insights'
                });

                const startTime = Date.now();
                console.log('💡 Generating insights from analytics data...');

                // Check cache first
                const cacheKey = this.generateCacheKey(analyticsData, options);
                if (this.config.cacheEnabled && this.insightCache.has(cacheKey)) {
                    const cached = this.insightCache.get(cacheKey);
                    this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
                    return cached;
                }

                // Generate insights from each enabled analyzer
                const analyzerResults = {};
                const allInsights = [];

                for (const analyzer of this.config.enabledAnalyzers) {
                    try {
                        const insights = await this.analyzers[analyzer](analyticsData, options);
                        analyzerResults[analyzer] = insights;
                        allInsights.push(...insights);
                        
                        // Update metrics
                        this.metrics.insightsByType.set(analyzer, 
                            (this.metrics.insightsByType.get(analyzer) || 0) + insights.length
                        );
                        
                    } catch (error) {
                        console.warn(`Analyzer ${analyzer} failed:`, error.message);
                        analyzerResults[analyzer] = [];
                    }
                }

                // Rank and filter insights
                const rankedInsights = this.rankInsights(allInsights);
                const filteredInsights = this.filterInsights(rankedInsights, options);

                // Generate natural language summaries if enabled
                const nlgSummaries = this.config.nlgEnabled ? 
                    await this.generateNLGSummaries(filteredInsights, analyticsData) : null;

                // Create insight categories
                const categorizedInsights = this.categorizeInsights(filteredInsights);

                // Generate recommendations
                const recommendations = await this.generateRecommendations(filteredInsights, analyticsData);

                // Compile results
                const results = {
                    timestamp: Date.now(),
                    processingTime: Date.now() - startTime,
                    summary: {
                        totalInsights: filteredInsights.length,
                        byType: this.groupInsightsByType(filteredInsights),
                        bySeverity: this.groupInsightsBySeverity(filteredInsights),
                        avgConfidence: this.calculateAverageConfidence(filteredInsights)
                    },
                    insights: filteredInsights,
                    categories: categorizedInsights,
                    recommendations,
                    nlgSummaries,
                    analyzerResults,
                    metadata: {
                        analyzersUsed: this.config.enabledAnalyzers,
                        totalInsightsGenerated: allInsights.length,
                        filteredCount: filteredInsights.length,
                        cacheUsed: false,
                        options
                    }
                };

                // Cache results if enabled
                if (this.config.cacheEnabled) {
                    this.insightCache.set(cacheKey, results);
                    this.cacheAccessTimes.set(cacheKey, Date.now());
                }

                // Update metrics
                this.updateMetrics(results);

                // Store historical data for context
                this.storeHistoricalInsights(results);

                // Emit insights
                this.emit('insights-generated', results);

                span.setAttributes({
                    'insights.processing_time_ms': results.processingTime,
                    'insights.total_generated': allInsights.length,
                    'insights.filtered_count': filteredInsights.length
                });

                span.setStatus({ code: 1, message: 'Insights generated successfully' });
                return results;

            } catch (error) {
                console.error('❌ Error generating insights:', error);
                span.recordException(error);
                span.setStatus({ code: 2, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Generate pattern insights
     */
    async generatePatternInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.patterns) return insights;

        const patterns = analyticsData.patterns;

        // Analyze recurring patterns
        if (patterns.recurring && patterns.recurring.length > 0) {
            patterns.recurring.forEach(pattern => {
                if (pattern.confidence > this.config.minConfidenceScore) {
                    insights.push({
                        id: `pattern_${pattern.id}`,
                        type: 'pattern_insights',
                        subtype: 'recurring',
                        severity: this.classifySeverity(pattern.confidence),
                        confidence: pattern.confidence,
                        timestamp: Date.now(),
                        title: 'Recurring Pattern Detected',
                        description: `Pattern "${pattern.name}" occurs ${pattern.frequency} with ${Math.round(pattern.confidence * 100)}% confidence`,
                        data: {
                            pattern: pattern.name,
                            frequency: pattern.frequency,
                            confidence: Math.round(pattern.confidence * 100),
                            occurrences: pattern.occurrences,
                            lastSeen: pattern.lastSeen
                        },
                        impact: pattern.impact || 0.5,
                        actionable: true,
                        recommendations: this.generatePatternRecommendations(pattern),
                        tags: ['pattern', 'recurring', 'predictable']
                    });
                }
            });
        }

        // Analyze pattern breaks
        if (patterns.breaks && patterns.breaks.length > 0) {
            patterns.breaks.forEach(breakPoint => {
                if (breakPoint.significance > this.config.minConfidenceScore) {
                    insights.push({
                        id: `pattern_break_${breakPoint.timestamp}`,
                        type: 'pattern_insights',
                        subtype: 'break',
                        severity: 'high',
                        confidence: breakPoint.significance,
                        timestamp: Date.now(),
                        title: 'Pattern Break Detected',
                        description: `Established pattern broken at ${new Date(breakPoint.timestamp).toLocaleString()}`,
                        data: {
                            breakTime: breakPoint.timestamp,
                            expectedPattern: breakPoint.expectedPattern,
                            actualValue: breakPoint.actualValue,
                            deviation: breakPoint.deviation
                        },
                        impact: 0.8,
                        actionable: true,
                        recommendations: ['Investigate cause of pattern break', 'Check for system changes'],
                        tags: ['pattern', 'break', 'anomaly']
                    });
                }
            });
        }

        return insights;
    }

    /**
     * Generate trend insights
     */
    async generateTrendInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.trends) return insights;

        const trends = analyticsData.trends;

        // Analyze trend directions
        if (trends.predictions) {
            Object.entries(trends.predictions).forEach(([metric, prediction]) => {
                if (prediction.confidence > this.config.minConfidenceScore) {
                    const trendDirection = prediction.direction;
                    const changeRate = prediction.changeRate;
                    
                    let severity = 'medium';
                    let impact = 0.5;
                    
                    // Determine severity based on change rate and direction
                    if (Math.abs(changeRate) > 0.5) {
                        severity = trendDirection.includes('degrading') ? 'critical' : 'high';
                        impact = Math.abs(changeRate);
                    }

                    insights.push({
                        id: `trend_${metric}`,
                        type: 'trend_insights',
                        subtype: trendDirection,
                        severity,
                        confidence: prediction.confidence,
                        timestamp: Date.now(),
                        title: `${trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} Trend Detected`,
                        description: `${metric} is ${trendDirection} at ${Math.round(Math.abs(changeRate) * 100)}% rate`,
                        data: {
                            metric,
                            direction: trendDirection,
                            changeRate: Math.round(changeRate * 100),
                            timeHorizon: prediction.timeHorizon,
                            projectedValue: prediction.projectedValue
                        },
                        impact,
                        actionable: true,
                        recommendations: this.generateTrendRecommendations(metric, trendDirection, changeRate),
                        tags: ['trend', trendDirection, metric]
                    });
                }
            });
        }

        // Analyze seasonal trends
        if (trends.seasonal && trends.seasonal.detected) {
            insights.push({
                id: 'seasonal_trend',
                type: 'trend_insights',
                subtype: 'seasonal',
                severity: 'medium',
                confidence: trends.seasonal.confidence,
                timestamp: Date.now(),
                title: 'Seasonal Pattern Detected',
                description: `Seasonal trend identified with ${trends.seasonal.period} cycle`,
                data: {
                    period: trends.seasonal.period,
                    strength: trends.seasonal.strength,
                    nextPeak: trends.seasonal.nextPeak,
                    nextTrough: trends.seasonal.nextTrough
                },
                impact: 0.6,
                actionable: true,
                recommendations: ['Plan capacity for seasonal peaks', 'Optimize resources during troughs'],
                tags: ['trend', 'seasonal', 'cyclical']
            });
        }

        return insights;
    }

    /**
     * Generate anomaly insights
     */
    async generateAnomalyInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.anomalies) return insights;

        const anomalies = analyticsData.anomalies;

        // Analyze recent anomalies
        if (anomalies.recent && anomalies.recent.length > 0) {
            const clusteredAnomalies = this.clusterAnomalies(anomalies.recent);
            
            clusteredAnomalies.forEach(cluster => {
                if (cluster.severity !== 'low') {
                    insights.push({
                        id: `anomaly_cluster_${cluster.id}`,
                        type: 'anomaly_insights',
                        subtype: cluster.type,
                        severity: cluster.severity,
                        confidence: cluster.confidence,
                        timestamp: Date.now(),
                        title: `${cluster.type} Anomaly Cluster`,
                        description: `${cluster.count} anomalies detected in ${cluster.metric}`,
                        data: {
                            anomalyCount: cluster.count,
                            metric: cluster.metric,
                            timeSpan: cluster.timeSpan,
                            averageDeviation: cluster.averageDeviation,
                            affectedValues: cluster.values
                        },
                        impact: cluster.impact,
                        actionable: true,
                        recommendations: this.generateAnomalyRecommendations(cluster),
                        tags: ['anomaly', cluster.type, cluster.severity]
                    });
                }
            });
        }

        return insights;
    }

    /**
     * Generate performance insights
     */
    async generatePerformanceInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.performance) return insights;

        const performance = analyticsData.performance;
        const baselines = this.config.performanceBaselines;

        // Analyze performance metrics
        Object.entries(performance.metrics || {}).forEach(([metric, data]) => {
            const baseline = baselines[metric];
            if (baseline && data.current !== undefined) {
                const utilizationRatio = data.current / baseline;
                
                if (utilizationRatio > 0.9) {
                    insights.push({
                        id: `performance_${metric}`,
                        type: 'performance_insights',
                        subtype: 'bottleneck',
                        severity: utilizationRatio > 0.95 ? 'critical' : 'high',
                        confidence: 0.9,
                        timestamp: Date.now(),
                        title: 'Performance Bottleneck Detected',
                        description: `${metric} at ${Math.round(utilizationRatio * 100)}% of baseline capacity`,
                        data: {
                            metric,
                            currentValue: data.current,
                            baseline,
                            utilization: Math.round(utilizationRatio * 100),
                            trend: data.trend
                        },
                        impact: Math.min(1, utilizationRatio),
                        actionable: true,
                        recommendations: this.generatePerformanceRecommendations(metric, utilizationRatio),
                        tags: ['performance', 'bottleneck', metric]
                    });
                }
                
                // Check for performance improvements
                if (data.trend && data.trend.direction === 'improving' && data.trend.confidence > 0.7) {
                    insights.push({
                        id: `performance_improvement_${metric}`,
                        type: 'performance_insights',
                        subtype: 'improvement',
                        severity: 'info',
                        confidence: data.trend.confidence,
                        timestamp: Date.now(),
                        title: 'Performance Improvement Detected',
                        description: `${metric} showing improvement trend`,
                        data: {
                            metric,
                            improvementRate: data.trend.changeRate,
                            currentValue: data.current,
                            baseline
                        },
                        impact: 0.3,
                        actionable: false,
                        recommendations: [`Continue monitoring ${metric} improvements`],
                        tags: ['performance', 'improvement', metric]
                    });
                }
            }
        });

        return insights;
    }

    /**
     * Generate correlation insights
     */
    async generateCorrelationInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.correlations) return insights;

        const correlations = analyticsData.correlations;

        // Analyze strong correlations
        if (correlations.strong && correlations.strong.length > 0) {
            correlations.strong.forEach(correlation => {
                if (Math.abs(correlation.coefficient) > this.config.correlationThreshold) {
                    insights.push({
                        id: `correlation_${correlation.metric1}_${correlation.metric2}`,
                        type: 'correlation_insights',
                        subtype: correlation.coefficient > 0 ? 'positive' : 'negative',
                        severity: 'medium',
                        confidence: Math.abs(correlation.coefficient),
                        timestamp: Date.now(),
                        title: `${correlation.coefficient > 0 ? 'Positive' : 'Negative'} Correlation Detected`,
                        description: `${correlation.metric1} and ${correlation.metric2} show ${Math.abs(correlation.coefficient).toFixed(2)} correlation`,
                        data: {
                            metric1: correlation.metric1,
                            metric2: correlation.metric2,
                            coefficient: correlation.coefficient,
                            significance: correlation.significance,
                            lag: correlation.lag || 0
                        },
                        impact: 0.4,
                        actionable: false,
                        recommendations: this.generateCorrelationRecommendations(correlation),
                        tags: ['correlation', 'relationship', correlation.coefficient > 0 ? 'positive' : 'negative']
                    });
                }
            });
        }

        return insights;
    }

    /**
     * Generate forecasting insights
     */
    async generateForecastingInsights(analyticsData, options) {
        const insights = [];
        
        if (!analyticsData.forecasts) return insights;

        const forecasts = analyticsData.forecasts;

        // Analyze forecast confidence and predictions
        Object.entries(forecasts).forEach(([metric, forecast]) => {
            if (forecast.confidence > this.config.minConfidenceScore) {
                // Check for significant changes in forecast
                const significantChanges = forecast.predictions.filter(p => 
                    Math.abs(p.changeFromBaseline) > this.config.trendSignificanceThreshold
                );

                if (significantChanges.length > 0) {
                    insights.push({
                        id: `forecast_${metric}`,
                        type: 'forecasting_insights',
                        subtype: 'prediction',
                        severity: 'medium',
                        confidence: forecast.confidence,
                        timestamp: Date.now(),
                        title: 'Significant Change Forecasted',
                        description: `${metric} forecasted to change significantly over next ${forecast.horizon}`,
                        data: {
                            metric,
                            horizon: forecast.horizon,
                            significantChanges: significantChanges.length,
                            maxChange: Math.max(...significantChanges.map(c => Math.abs(c.changeFromBaseline))),
                            predictions: forecast.predictions.slice(0, 5) // First 5 predictions
                        },
                        impact: 0.6,
                        actionable: true,
                        recommendations: [`Monitor ${metric} closely`, 'Plan for forecasted changes'],
                        tags: ['forecast', 'prediction', metric]
                    });
                }

                // Check for forecast uncertainty
                const avgUncertainty = forecast.predictions.reduce((sum, p) => 
                    sum + (p.upperBound - p.lowerBound), 0) / forecast.predictions.length;
                
                if (avgUncertainty > forecast.expectedUncertainty * 1.5) {
                    insights.push({
                        id: `forecast_uncertainty_${metric}`,
                        type: 'forecasting_insights',
                        subtype: 'uncertainty',
                        severity: 'low',
                        confidence: 0.7,
                        timestamp: Date.now(),
                        title: 'High Forecast Uncertainty',
                        description: `${metric} forecast shows higher than expected uncertainty`,
                        data: {
                            metric,
                            avgUncertainty,
                            expectedUncertainty: forecast.expectedUncertainty,
                            uncertaintyRatio: avgUncertainty / forecast.expectedUncertainty
                        },
                        impact: 0.3,
                        actionable: true,
                        recommendations: ['Collect more data to improve forecast accuracy', 'Consider shorter forecast horizons'],
                        tags: ['forecast', 'uncertainty', 'data-quality']
                    });
                }
            }
        });

        return insights;
    }

    /**
     * Rank insights by importance
     */
    rankInsights(insights) {
        return insights.sort((a, b) => {
            const scoreA = this.calculateInsightScore(a);
            const scoreB = this.calculateInsightScore(b);
            return scoreB - scoreA;
        });
    }

    /**
     * Calculate insight importance score
     */
    calculateInsightScore(insight) {
        const weights = this.config.priorityWeights;
        const severityScore = this.getSeverityScore(insight.severity);
        const confidenceScore = insight.confidence || 0;
        const impactScore = insight.impact || 0;
        const noveltyScore = this.calculateNoveltyScore(insight);

        return (
            weights.severity * severityScore +
            weights.confidence * confidenceScore +
            weights.impact * impactScore +
            weights.novelty * noveltyScore
        );
    }

    /**
     * Get severity score (higher is more severe)
     */
    getSeverityScore(severity) {
        const scores = { critical: 1.0, high: 0.8, medium: 0.6, low: 0.4, info: 0.2 };
        return scores[severity] || 0.5;
    }

    /**
     * Calculate novelty score
     */
    calculateNoveltyScore(insight) {
        // Simple implementation - in practice, this would check against historical insights
        const recentSimilar = this.findSimilarRecentInsights(insight);
        return Math.max(0, 1 - (recentSimilar.length * 0.2));
    }

    /**
     * Filter insights based on configuration
     */
    filterInsights(insights, options) {
        let filtered = insights;

        // Filter by minimum confidence
        filtered = filtered.filter(insight => 
            (insight.confidence || 0) >= this.config.minConfidenceScore
        );

        // Limit total insights
        if (filtered.length > this.config.maxInsightsPerAnalysis) {
            filtered = filtered.slice(0, this.config.maxInsightsPerAnalysis);
        }

        // Apply additional filters from options
        if (options.severityFilter) {
            filtered = filtered.filter(insight => 
                this.getSeverityScore(insight.severity) >= this.getSeverityScore(options.severityFilter)
            );
        }

        if (options.typeFilter) {
            filtered = filtered.filter(insight => 
                options.typeFilter.includes(insight.type)
            );
        }

        return filtered;
    }

    /**
     * Generate Natural Language summaries
     */
    async generateNLGSummaries(insights, analyticsData) {
        if (!this.config.nlgEnabled) return null;

        const summaries = {
            overview: this.generateOverviewSummary(insights),
            bySeverity: this.generateSeveritySummaries(insights),
            byType: this.generateTypeSummaries(insights),
            recommendations: this.generateRecommendationSummary(insights)
        };

        this.metrics.nlgRequests++;
        return summaries;
    }

    /**
     * Generate overview summary
     */
    generateOverviewSummary(insights) {
        const totalInsights = insights.length;
        const criticalCount = insights.filter(i => i.severity === 'critical').length;
        const highCount = insights.filter(i => i.severity === 'high').length;
        const avgConfidence = Math.round(this.calculateAverageConfidence(insights) * 100);

        let summary = `Analysis generated ${totalInsights} insights with ${avgConfidence}% average confidence.`;
        
        if (criticalCount > 0) {
            summary += ` ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require${criticalCount === 1 ? 's' : ''} immediate attention.`;
        }
        
        if (highCount > 0) {
            summary += ` ${highCount} high-priority item${highCount > 1 ? 's' : ''} need${highCount === 1 ? 's' : ''} review.`;
        }

        return summary;
    }

    /**
     * Categorize insights
     */
    categorizeInsights(insights) {
        const categories = {
            urgent: insights.filter(i => ['critical', 'high'].includes(i.severity)),
            actionable: insights.filter(i => i.actionable),
            informational: insights.filter(i => i.severity === 'info'),
            patterns: insights.filter(i => i.type === 'pattern_insights'),
            performance: insights.filter(i => i.type === 'performance_insights'),
            anomalies: insights.filter(i => i.type === 'anomaly_insights')
        };

        return Object.fromEntries(
            Object.entries(categories).map(([key, value]) => [key, value.slice(0, 10)]) // Limit each category
        );
    }

    /**
     * Generate recommendations
     */
    async generateRecommendations(insights, analyticsData) {
        const recommendations = [];
        
        // Collect all individual recommendations
        const allRecommendations = insights
            .filter(insight => insight.recommendations && insight.recommendations.length > 0)
            .flatMap(insight => insight.recommendations.map(rec => ({
                recommendation: rec,
                priority: this.getSeverityScore(insight.severity),
                type: insight.type,
                confidence: insight.confidence
            })));

        // Group and prioritize recommendations
        const groupedRecs = new Map();
        
        allRecommendations.forEach(rec => {
            if (groupedRecs.has(rec.recommendation)) {
                const existing = groupedRecs.get(rec.recommendation);
                existing.priority = Math.max(existing.priority, rec.priority);
                existing.count++;
            } else {
                groupedRecs.set(rec.recommendation, {
                    text: rec.recommendation,
                    priority: rec.priority,
                    type: rec.type,
                    confidence: rec.confidence,
                    count: 1
                });
            }
        });

        // Sort by priority and return top recommendations
        const sortedRecs = Array.from(groupedRecs.values())
            .sort((a, b) => b.priority - a.priority || b.count - a.count);

        return sortedRecs.slice(0, 10).map((rec, index) => ({
            id: `rec_${index}`,
            text: rec.text,
            priority: rec.priority,
            type: rec.type,
            confidence: rec.confidence,
            frequency: rec.count
        }));
    }

    /**
     * Helper methods for generating specific recommendations
     */
    
    generatePatternRecommendations(pattern) {
        const recommendations = [];
        
        if (pattern.frequency === 'daily') {
            recommendations.push('Consider daily resource scheduling based on this pattern');
        } else if (pattern.frequency === 'weekly') {
            recommendations.push('Plan weekly capacity adjustments');
        }
        
        if (pattern.confidence > 0.8) {
            recommendations.push('High confidence pattern - consider automation');
        }
        
        return recommendations;
    }

    generateTrendRecommendations(metric, direction, changeRate) {
        const recommendations = [];
        
        if (direction.includes('increasing') && Math.abs(changeRate) > 0.3) {
            recommendations.push(`Monitor ${metric} for continued growth`);
            recommendations.push('Consider scaling resources proactively');
        } else if (direction.includes('decreasing') && Math.abs(changeRate) > 0.3) {
            recommendations.push(`Investigate cause of ${metric} decline`);
            recommendations.push('Implement corrective measures if needed');
        }
        
        return recommendations;
    }

    generateAnomalyRecommendations(cluster) {
        const recommendations = [];
        
        if (cluster.severity === 'critical') {
            recommendations.push('Investigate immediately - potential service impact');
        }
        
        if (cluster.count > 5) {
            recommendations.push('Multiple anomalies suggest systematic issue');
        }
        
        recommendations.push(`Review ${cluster.metric} monitoring thresholds`);
        
        return recommendations;
    }

    generatePerformanceRecommendations(metric, utilizationRatio) {
        const recommendations = [];
        
        if (utilizationRatio > 0.95) {
            recommendations.push(`Scale ${metric} resources immediately`);
        } else if (utilizationRatio > 0.9) {
            recommendations.push(`Plan ${metric} capacity increase`);
        }
        
        recommendations.push(`Monitor ${metric} trends closely`);
        
        return recommendations;
    }

    generateCorrelationRecommendations(correlation) {
        const recommendations = [];
        
        if (Math.abs(correlation.coefficient) > 0.8) {
            recommendations.push(`Strong relationship between ${correlation.metric1} and ${correlation.metric2} - consider joint optimization`);
        }
        
        if (correlation.lag && correlation.lag > 0) {
            recommendations.push(`${correlation.metric1} leads ${correlation.metric2} by ${correlation.lag} time units - use for prediction`);
        }
        
        return recommendations;
    }

    /**
     * Utility methods
     */

    clusterAnomalies(anomalies) {
        // Simple clustering implementation
        const clusters = [];
        const processed = new Set();
        
        anomalies.forEach((anomaly, index) => {
            if (processed.has(index)) return;
            
            const cluster = {
                id: Date.now() + Math.random(),
                type: this.classifyAnomalyType(anomaly),
                severity: anomaly.severity || 'medium',
                confidence: anomaly.confidence || 0.5,
                count: 1,
                metric: anomaly.metric,
                values: [anomaly.value],
                timeSpan: { start: anomaly.timestamp, end: anomaly.timestamp },
                averageDeviation: Math.abs(anomaly.deviation || 0),
                impact: anomaly.impact || 0.5
            };
            
            // Find similar anomalies
            for (let i = index + 1; i < anomalies.length; i++) {
                if (processed.has(i)) continue;
                
                const other = anomalies[i];
                if (this.areAnomaliesSimilar(anomaly, other)) {
                    cluster.count++;
                    cluster.values.push(other.value);
                    cluster.timeSpan.end = Math.max(cluster.timeSpan.end, other.timestamp);
                    cluster.averageDeviation = (cluster.averageDeviation + Math.abs(other.deviation || 0)) / 2;
                    processed.add(i);
                }
            }
            
            processed.add(index);
            clusters.push(cluster);
        });
        
        return clusters;
    }

    classifyAnomalyType(anomaly) {
        if (anomaly.value > anomaly.expected) {
            return 'spike';
        } else if (anomaly.value < anomaly.expected) {
            return 'drop';
        }
        return 'outlier';
    }

    areAnomaliesSimilar(a1, a2) {
        // Simple similarity check
        return a1.metric === a2.metric && 
               Math.abs(a1.timestamp - a2.timestamp) < 3600000; // 1 hour
    }

    classifySeverity(confidence) {
        if (confidence > 0.9) return 'critical';
        if (confidence > 0.7) return 'high';
        if (confidence > 0.5) return 'medium';
        if (confidence > 0.3) return 'low';
        return 'info';
    }

    groupInsightsByType(insights) {
        const groups = {};
        insights.forEach(insight => {
            groups[insight.type] = (groups[insight.type] || 0) + 1;
        });
        return groups;
    }

    groupInsightsBySeverity(insights) {
        const groups = {};
        insights.forEach(insight => {
            groups[insight.severity] = (groups[insight.severity] || 0) + 1;
        });
        return groups;
    }

    calculateAverageConfidence(insights) {
        if (insights.length === 0) return 0;
        const total = insights.reduce((sum, insight) => sum + (insight.confidence || 0), 0);
        return total / insights.length;
    }

    generateCacheKey(analyticsData, options) {
        const dataKeys = Object.keys(analyticsData).sort().join(',');
        const optionsStr = JSON.stringify(options);
        return `${dataKeys}_${Buffer.from(optionsStr).toString('base64')}`;
    }

    findSimilarRecentInsights(insight) {
        // Simple implementation - would be more sophisticated in practice
        const recentWindow = 24 * 60 * 60 * 1000; // 24 hours
        const cutoff = Date.now() - recentWindow;
        
        const similar = [];
        for (const [streamName, historicalInsights] of this.insights) {
            const recent = historicalInsights.filter(h => h.timestamp > cutoff);
            const matchingType = recent.filter(h => h.type === insight.type);
            similar.push(...matchingType);
        }
        
        return similar;
    }

    updateMetrics(results) {
        this.metrics.totalInsightsGenerated += results.summary.totalInsights;
        this.metrics.processingTimes.push(results.processingTime);
        
        // Update severity counts
        Object.entries(results.summary.bySeverity).forEach(([severity, count]) => {
            const current = this.metrics.insightsBySeverity.get(severity) || 0;
            this.metrics.insightsBySeverity.set(severity, current + count);
        });
        
        // Update average generation time
        if (this.metrics.processingTimes.length > 0) {
            this.metrics.averageGenerationTime = this.metrics.processingTimes.reduce((a, b) => a + b, 0) / 
                                               this.metrics.processingTimes.length;
        }
        
        // Limit processing times array
        if (this.metrics.processingTimes.length > 1000) {
            this.metrics.processingTimes = this.metrics.processingTimes.slice(-500);
        }
    }

    storeHistoricalInsights(results) {
        const key = `historical_${Date.now()}`;
        if (!this.historicalData.has('insights')) {
            this.historicalData.set('insights', []);
        }
        
        const historical = this.historicalData.get('insights');
        historical.push({
            timestamp: results.timestamp,
            insightCount: results.summary.totalInsights,
            bySeverity: results.summary.bySeverity,
            byType: results.summary.byType
        });
        
        // Limit historical data
        if (historical.length > 1000) {
            historical.splice(0, historical.length - 500);
        }
    }

    async processInsightQueue() {
        // Process any queued insight generation tasks
        // Implementation would depend on specific streaming requirements
    }

    manageCaches() {
        if (!this.config.cacheEnabled) return;
        
        const now = Date.now();
        const ttl = this.config.cacheTTL;
        
        // Remove expired cache entries
        for (const [key, accessTime] of this.cacheAccessTimes) {
            if (now - accessTime > ttl) {
                this.insightCache.delete(key);
                this.cacheAccessTimes.delete(key);
            }
        }
        
        // Limit cache size
        if (this.insightCache.size > this.config.maxCacheSize) {
            const entries = Array.from(this.cacheAccessTimes.entries())
                .sort((a, b) => a[1] - b[1]) // Sort by access time (oldest first)
                .slice(0, this.insightCache.size - this.config.maxCacheSize);
            
            entries.forEach(([key]) => {
                this.insightCache.delete(key);
                this.cacheAccessTimes.delete(key);
            });
        }
    }

    async performCleanup() {
        const now = Date.now();
        const retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        // Clean up old insights
        for (const [key, insights] of this.insights) {
            const filtered = insights.filter(insight => now - insight.timestamp < retentionPeriod);
            if (filtered.length === 0) {
                this.insights.delete(key);
            } else {
                this.insights.set(key, filtered);
            }
        }
        
        // Clean up historical data
        for (const [key, data] of this.historicalData) {
            if (Array.isArray(data)) {
                const filtered = data.filter(item => now - item.timestamp < retentionPeriod);
                if (filtered.length === 0) {
                    this.historicalData.delete(key);
                } else {
                    this.historicalData.set(key, filtered);
                }
            }
        }
        
        console.log('🧹 Insights generator cleanup completed');
    }

    /**
     * Get insights statistics
     */
    getStatistics() {
        return {
            totalInsightsGenerated: this.metrics.totalInsightsGenerated,
            averageGenerationTime: Math.round(this.metrics.averageGenerationTime),
            insightsByType: Object.fromEntries(this.metrics.insightsByType),
            insightsBySeverity: Object.fromEntries(this.metrics.insightsBySeverity),
            cacheHitRate: Math.round(this.metrics.cacheHitRate * 100),
            nlgRequests: this.metrics.nlgRequests,
            cacheSize: this.insightCache.size,
            enabledAnalyzers: this.config.enabledAnalyzers,
            initialized: this.initialized,
            running: this.isRunning
        };
    }

    /**
     * Stop the insights generator
     */
    async stop() {
        console.log('🛑 Stopping Insights Generator...');
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log('✅ Insights Generator stopped');
    }
}

export default InsightsGenerator;
