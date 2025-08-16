/**
 * Fusion Aggregation Engine
 * Intelligent multi-source data fusion with conflict resolution, confidence scoring, and temporal analysis
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

class FusionAggregationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            confidenceThreshold: 0.7,
            temporalWeightDecay: 0.1,
            maxSources: 100,
            cacheSize: 1000,
            defaultTimeout: 30000,
            ...options
        };
        
        this.sourceRegistry = new Map();
        this.fusionCache = new Map();
        this.conflictResolvers = new Map();
        this.synthesisStrategies = new Map();
        this.temporalIndex = new Map();
        
        this.initializeDefaultResolvers();
        this.initializeDefaultStrategies();
        
        // Performance metrics
        this.metrics = {
            totalFusions: 0,
            successfulFusions: 0,
            conflictsResolved: 0,
            averageConfidence: 0,
            averageFusionTime: 0,
            sourceUtilization: new Map(),
            errorCounts: new Map()
        };
    }

    /**
     * Register a data source with metadata
     */
    registerSource(sourceConfig) {
        const sourceId = sourceConfig.id || uuidv4();
        
        const source = {
            id: sourceId,
            name: sourceConfig.name,
            type: sourceConfig.type, // 'api', 'database', 'file', 'stream'
            reliability: sourceConfig.reliability || 0.8,
            latency: sourceConfig.latency || 1000,
            cost: sourceConfig.cost || 1.0,
            dataTypes: sourceConfig.dataTypes || [],
            accessMethod: sourceConfig.accessMethod,
            transformers: sourceConfig.transformers || [],
            validators: sourceConfig.validators || [],
            credentials: sourceConfig.credentials,
            metadata: sourceConfig.metadata || {},
            enabled: sourceConfig.enabled !== false,
            createdAt: new Date(),
            lastAccessed: null,
            accessCount: 0,
            errorCount: 0
        };

        this.sourceRegistry.set(sourceId, source);
        this.metrics.sourceUtilization.set(sourceId, 0);
        
        console.log(`[FusionEngine] Registered source: ${source.name} (${sourceId})`);
        return sourceId;
    }

    /**
     * Unregister a data source
     */
    unregisterSource(sourceId) {
        if (this.sourceRegistry.has(sourceId)) {
            const source = this.sourceRegistry.get(sourceId);
            this.sourceRegistry.delete(sourceId);
            this.metrics.sourceUtilization.delete(sourceId);
            console.log(`[FusionEngine] Unregistered source: ${source.name} (${sourceId})`);
            return true;
        }
        return false;
    }

    /**
     * Main fusion method - aggregates data from multiple sources
     */
    async fuseData(fusionRequest) {
        const startTime = Date.now();
        const fusionId = uuidv4();
        
        try {
            this.metrics.totalFusions++;
            
            const {
                query,
                sources = [],
                dataTypes = [],
                conflictResolution = 'weighted_average',
                synthesisStrategy = 'intelligent_merge',
                temporalConfig = {},
                confidenceThreshold = this.options.confidenceThreshold,
                timeout = this.options.defaultTimeout,
                cacheKey = null,
                metadata = {}
            } = fusionRequest;

            // Check cache first
            if (cacheKey && this.fusionCache.has(cacheKey)) {
                const cached = this.fusionCache.get(cacheKey);
                if (Date.now() - cached.timestamp < (temporalConfig.cacheTTL || 300000)) {
                    console.log(`[FusionEngine] Cache hit for fusion ${fusionId}`);
                    return { ...cached.result, fromCache: true, fusionId };
                }
            }

            // Select appropriate sources
            const selectedSources = this.selectSources({
                availableSources: sources.length > 0 ? sources : Array.from(this.sourceRegistry.keys()),
                dataTypes,
                query,
                maxSources: this.options.maxSources
            });

            if (selectedSources.length === 0) {
                throw new Error('No suitable sources available for fusion');
            }

            // Fetch data from sources in parallel
            const sourcePromises = selectedSources.map(sourceId => 
                this.fetchFromSource(sourceId, query, timeout)
            );

            const sourceResults = await Promise.allSettled(sourcePromises);
            
            // Process successful results
            const validResults = sourceResults
                .map((result, index) => ({
                    sourceId: selectedSources[index],
                    result: result.status === 'fulfilled' ? result.value : null,
                    error: result.status === 'rejected' ? result.reason : null
                }))
                .filter(item => item.result !== null);

            if (validResults.length === 0) {
                throw new Error('No sources returned valid data');
            }

            // Apply temporal analysis
            const temporallyWeighted = this.applyTemporalWeighting(validResults, temporalConfig);

            // Detect and resolve conflicts
            const conflictAnalysis = this.analyzeConflicts(temporallyWeighted);
            const resolvedData = await this.resolveConflicts(
                conflictAnalysis, 
                conflictResolution,
                temporallyWeighted
            );

            // Calculate confidence scores
            const confidenceScores = this.calculateConfidenceScores(resolvedData, validResults);

            // Apply synthesis strategy
            const synthesizedResult = await this.applySynthesisStrategy(
                resolvedData,
                confidenceScores,
                synthesisStrategy,
                temporallyWeighted
            );

            // Filter by confidence threshold
            const filteredResult = this.filterByConfidence(synthesizedResult, confidenceThreshold);

            // Create final fusion result
            const fusionResult = {
                fusionId,
                data: filteredResult.data,
                metadata: {
                    sources: validResults.map(r => ({
                        id: r.sourceId,
                        name: this.sourceRegistry.get(r.sourceId)?.name,
                        confidence: confidenceScores.get(r.sourceId) || 0,
                        timestamp: r.result.timestamp,
                        recordCount: Array.isArray(r.result.data) ? r.result.data.length : 1
                    })),
                    fusionStrategy: synthesisStrategy,
                    conflictResolution,
                    totalSources: selectedSources.length,
                    successfulSources: validResults.length,
                    overallConfidence: filteredResult.overallConfidence,
                    conflicts: conflictAnalysis.conflicts.length,
                    resolvedConflicts: conflictAnalysis.resolved.length,
                    temporalSpan: temporalConfig.temporalSpan || 0,
                    processingTime: Date.now() - startTime,
                    timestamp: new Date(),
                    ...metadata
                },
                quality: {
                    completeness: this.calculateCompleteness(filteredResult.data, validResults),
                    consistency: this.calculateConsistency(resolvedData),
                    accuracy: filteredResult.overallConfidence,
                    timeliness: this.calculateTimeliness(temporallyWeighted, temporalConfig),
                    reliability: this.calculateReliability(validResults)
                }
            };

            // Cache result if requested
            if (cacheKey) {
                this.fusionCache.set(cacheKey, {
                    result: fusionResult,
                    timestamp: Date.now()
                });
                
                // Cleanup cache if needed
                if (this.fusionCache.size > this.options.cacheSize) {
                    this.cleanupCache();
                }
            }

            // Update metrics
            this.updateMetrics(fusionResult, validResults, startTime);
            
            console.log(`[FusionEngine] Successfully fused data from ${validResults.length} sources in ${Date.now() - startTime}ms`);
            
            this.metrics.successfulFusions++;
            return fusionResult;

        } catch (error) {
            console.error(`[FusionEngine] Fusion failed for ${fusionId}:`, error);
            this.metrics.errorCounts.set('fusion', (this.metrics.errorCounts.get('fusion') || 0) + 1);
            
            return {
                fusionId,
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime,
                timestamp: new Date()
            };
        }
    }

    /**
     * Select optimal sources based on criteria
     */
    selectSources({ availableSources, dataTypes, query, maxSources }) {
        const candidates = availableSources
            .map(id => this.sourceRegistry.get(id))
            .filter(source => source && source.enabled)
            .map(source => {
                let score = source.reliability;
                
                // Data type compatibility
                if (dataTypes.length > 0) {
                    const typeMatch = dataTypes.some(type => source.dataTypes.includes(type));
                    score *= typeMatch ? 1.2 : 0.5;
                }
                
                // Historical performance
                const utilization = this.metrics.sourceUtilization.get(source.id) || 0;
                score *= Math.max(0.5, 1 - (source.errorCount / Math.max(1, source.accessCount)) * 0.5);
                
                // Cost consideration (lower cost = higher score)
                score /= Math.max(0.1, source.cost);
                
                // Latency consideration (lower latency = higher score)
                score /= Math.max(0.1, source.latency / 1000);

                return { source, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSources)
            .map(item => item.source.id);

        return candidates;
    }

    /**
     * Fetch data from a specific source
     */
    async fetchFromSource(sourceId, query, timeout) {
        const source = this.sourceRegistry.get(sourceId);
        if (!source) {
            throw new Error(`Source ${sourceId} not found`);
        }

        const startTime = Date.now();
        
        try {
            source.accessCount++;
            source.lastAccessed = new Date();

            let result;
            
            switch (source.type) {
                case 'api':
                    result = await this.fetchFromAPI(source, query, timeout);
                    break;
                case 'database':
                    result = await this.fetchFromDatabase(source, query, timeout);
                    break;
                case 'file':
                    result = await this.fetchFromFile(source, query, timeout);
                    break;
                case 'stream':
                    result = await this.fetchFromStream(source, query, timeout);
                    break;
                default:
                    throw new Error(`Unsupported source type: ${source.type}`);
            }

            // Apply transformers
            let transformedData = result.data;
            for (const transformer of source.transformers) {
                transformedData = await this.applyTransformer(transformedData, transformer);
            }

            // Apply validators
            for (const validator of source.validators) {
                const validation = await this.applyValidator(transformedData, validator);
                if (!validation.valid) {
                    throw new Error(`Validation failed: ${validation.error}`);
                }
            }

            const fetchTime = Date.now() - startTime;
            this.metrics.sourceUtilization.set(
                sourceId, 
                (this.metrics.sourceUtilization.get(sourceId) || 0) + 1
            );

            return {
                sourceId,
                data: transformedData,
                metadata: result.metadata || {},
                timestamp: new Date(),
                fetchTime,
                recordCount: Array.isArray(transformedData) ? transformedData.length : 1
            };

        } catch (error) {
            source.errorCount++;
            this.metrics.errorCounts.set(sourceId, (this.metrics.errorCounts.get(sourceId) || 0) + 1);
            console.error(`[FusionEngine] Error fetching from source ${source.name}:`, error);
            throw error;
        }
    }

    /**
     * Apply temporal weighting to results
     */
    applyTemporalWeighting(results, temporalConfig) {
        const {
            decayRate = this.options.temporalWeightDecay,
            referenceTime = new Date(),
            maxAge = 86400000 // 24 hours in milliseconds
        } = temporalConfig;

        return results.map(result => {
            const age = referenceTime.getTime() - new Date(result.result.timestamp).getTime();
            const ageRatio = Math.min(1, age / maxAge);
            const temporalWeight = Math.exp(-decayRate * ageRatio);
            
            return {
                ...result,
                temporalWeight,
                age,
                ageRatio
            };
        });
    }

    /**
     * Analyze conflicts between data sources
     */
    analyzeConflicts(results) {
        const conflicts = [];
        const resolved = [];
        const fieldMap = new Map();

        // Group data by field/key
        results.forEach((result, index) => {
            const data = result.result.data;
            
            if (Array.isArray(data)) {
                data.forEach((item, itemIndex) => {
                    Object.keys(item).forEach(key => {
                        const fieldKey = `array.${itemIndex}.${key}`;
                        if (!fieldMap.has(fieldKey)) {
                            fieldMap.set(fieldKey, []);
                        }
                        fieldMap.get(fieldKey).push({
                            sourceIndex: index,
                            sourceId: result.sourceId,
                            value: item[key],
                            confidence: this.calculateFieldConfidence(item[key], result),
                            timestamp: result.result.timestamp
                        });
                    });
                });
            } else if (typeof data === 'object' && data !== null) {
                Object.keys(data).forEach(key => {
                    if (!fieldMap.has(key)) {
                        fieldMap.set(key, []);
                    }
                    fieldMap.get(key).push({
                        sourceIndex: index,
                        sourceId: result.sourceId,
                        value: data[key],
                        confidence: this.calculateFieldConfidence(data[key], result),
                        timestamp: result.result.timestamp
                    });
                });
            }
        });

        // Detect conflicts
        fieldMap.forEach((values, fieldKey) => {
            if (values.length > 1) {
                const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
                
                if (uniqueValues.size > 1) {
                    conflicts.push({
                        field: fieldKey,
                        values,
                        conflictType: this.determineConflictType(values),
                        severity: this.calculateConflictSeverity(values)
                    });
                }
            }
        });

        return { conflicts, resolved, fieldMap };
    }

    /**
     * Resolve conflicts using specified strategy
     */
    async resolveConflicts(conflictAnalysis, strategy, temporallyWeighted) {
        const resolver = this.conflictResolvers.get(strategy);
        if (!resolver) {
            throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
        }

        const resolvedData = {};
        
        for (const conflict of conflictAnalysis.conflicts) {
            try {
                const resolution = await resolver(conflict, temporallyWeighted);
                this.setNestedValue(resolvedData, conflict.field, resolution.value);
                
                this.metrics.conflictsResolved++;
                console.debug(`[FusionEngine] Resolved conflict for field ${conflict.field}: ${resolution.strategy}`);
                
            } catch (error) {
                console.error(`[FusionEngine] Failed to resolve conflict for field ${conflict.field}:`, error);
                // Use first available value as fallback
                const fallbackValue = conflict.values[0].value;
                this.setNestedValue(resolvedData, conflict.field, fallbackValue);
            }
        }

        // Add non-conflicting fields
        conflictAnalysis.fieldMap.forEach((values, fieldKey) => {
            if (values.length === 1) {
                this.setNestedValue(resolvedData, fieldKey, values[0].value);
            }
        });

        return resolvedData;
    }

    /**
     * Calculate confidence scores for each source
     */
    calculateConfidenceScores(resolvedData, results) {
        const confidenceScores = new Map();
        
        results.forEach(result => {
            const source = this.sourceRegistry.get(result.sourceId);
            let confidence = source.reliability;
            
            // Factor in temporal weight
            if (result.temporalWeight) {
                confidence *= result.temporalWeight;
            }
            
            // Factor in data quality metrics
            const completeness = this.calculateDataCompleteness(result.result.data);
            confidence *= completeness;
            
            // Factor in historical performance
            const errorRate = source.errorCount / Math.max(1, source.accessCount);
            confidence *= (1 - errorRate);
            
            confidenceScores.set(result.sourceId, Math.max(0, Math.min(1, confidence)));
        });
        
        return confidenceScores;
    }

    /**
     * Apply synthesis strategy to combine resolved data
     */
    async applySynthesisStrategy(resolvedData, confidenceScores, strategy, temporallyWeighted) {
        const synthesizer = this.synthesisStrategies.get(strategy);
        if (!synthesizer) {
            throw new Error(`Unknown synthesis strategy: ${strategy}`);
        }

        return await synthesizer(resolvedData, confidenceScores, temporallyWeighted);
    }

    /**
     * Filter results by confidence threshold
     */
    filterByConfidence(synthesizedResult, threshold) {
        const filtered = { data: {}, overallConfidence: 0 };
        
        if (typeof synthesizedResult.data === 'object' && synthesizedResult.data !== null) {
            Object.keys(synthesizedResult.data).forEach(key => {
                const fieldConfidence = synthesizedResult.confidenceMap?.get(key) || synthesizedResult.overallConfidence || 0;
                
                if (fieldConfidence >= threshold) {
                    filtered.data[key] = synthesizedResult.data[key];
                }
            });
        } else {
            filtered.data = synthesizedResult.data;
        }
        
        filtered.overallConfidence = synthesizedResult.overallConfidence || 0;
        
        return filtered;
    }

    /**
     * Initialize default conflict resolution strategies
     */
    initializeDefaultResolvers() {
        // Weighted average resolver
        this.conflictResolvers.set('weighted_average', async (conflict, temporallyWeighted) => {
            const numericalValues = conflict.values.filter(v => typeof v.value === 'number');
            
            if (numericalValues.length === 0) {
                // Fall back to most recent value
                const mostRecent = conflict.values.reduce((latest, current) => 
                    new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
                );
                return { value: mostRecent.value, strategy: 'most_recent_fallback' };
            }
            
            const totalWeight = numericalValues.reduce((sum, v) => sum + v.confidence, 0);
            const weightedSum = numericalValues.reduce((sum, v) => sum + (v.value * v.confidence), 0);
            
            return { 
                value: totalWeight > 0 ? weightedSum / totalWeight : numericalValues[0].value,
                strategy: 'weighted_average',
                confidence: totalWeight / numericalValues.length
            };
        });

        // Most confident resolver
        this.conflictResolvers.set('most_confident', async (conflict) => {
            const mostConfident = conflict.values.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
            );
            return { 
                value: mostConfident.value, 
                strategy: 'most_confident',
                confidence: mostConfident.confidence
            };
        });

        // Most recent resolver
        this.conflictResolvers.set('most_recent', async (conflict) => {
            const mostRecent = conflict.values.reduce((latest, current) => 
                new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
            );
            return { 
                value: mostRecent.value, 
                strategy: 'most_recent',
                timestamp: mostRecent.timestamp
            };
        });

        // Consensus resolver
        this.conflictResolvers.set('consensus', async (conflict) => {
            const valueCounts = new Map();
            
            conflict.values.forEach(v => {
                const key = JSON.stringify(v.value);
                const current = valueCounts.get(key) || { value: v.value, count: 0, totalConfidence: 0 };
                current.count++;
                current.totalConfidence += v.confidence;
                valueCounts.set(key, current);
            });
            
            const consensus = Array.from(valueCounts.values()).reduce((best, current) => 
                current.count > best.count || 
                (current.count === best.count && current.totalConfidence > best.totalConfidence) 
                    ? current : best
            );
            
            return { 
                value: consensus.value, 
                strategy: 'consensus',
                support: consensus.count / conflict.values.length
            };
        });
    }

    /**
     * Initialize default synthesis strategies
     */
    initializeDefaultStrategies() {
        // Intelligent merge strategy
        this.synthesisStrategies.set('intelligent_merge', async (resolvedData, confidenceScores, temporallyWeighted) => {
            const confidenceMap = new Map();
            let totalConfidence = 0;
            let fieldCount = 0;
            
            // Calculate field-level confidence
            Object.keys(resolvedData).forEach(key => {
                const fieldConfidence = this.calculateFieldSynthesisConfidence(key, resolvedData, confidenceScores);
                confidenceMap.set(key, fieldConfidence);
                totalConfidence += fieldConfidence;
                fieldCount++;
            });
            
            return {
                data: resolvedData,
                overallConfidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
                confidenceMap,
                strategy: 'intelligent_merge'
            };
        });

        // High confidence only strategy
        this.synthesisStrategies.set('high_confidence_only', async (resolvedData, confidenceScores) => {
            const filtered = {};
            const confidenceMap = new Map();
            const threshold = 0.8;
            
            Object.keys(resolvedData).forEach(key => {
                const fieldConfidence = this.calculateFieldSynthesisConfidence(key, resolvedData, confidenceScores);
                
                if (fieldConfidence >= threshold) {
                    filtered[key] = resolvedData[key];
                    confidenceMap.set(key, fieldConfidence);
                }
            });
            
            const overallConfidence = confidenceMap.size > 0 ? 
                Array.from(confidenceMap.values()).reduce((sum, conf) => sum + conf, 0) / confidenceMap.size : 0;
            
            return {
                data: filtered,
                overallConfidence,
                confidenceMap,
                strategy: 'high_confidence_only'
            };
        });

        // Temporal priority strategy
        this.synthesisStrategies.set('temporal_priority', async (resolvedData, confidenceScores, temporallyWeighted) => {
            const weightedData = {};
            const confidenceMap = new Map();
            
            // Prioritize more recent data
            const temporalWeights = temporallyWeighted.reduce((weights, result) => {
                weights[result.sourceId] = result.temporalWeight;
                return weights;
            }, {});
            
            Object.keys(resolvedData).forEach(key => {
                const baseConfidence = this.calculateFieldSynthesisConfidence(key, resolvedData, confidenceScores);
                // Boost confidence with temporal weight
                const temporalBoost = Math.max(...Object.values(temporalWeights));
                const enhancedConfidence = Math.min(1, baseConfidence * (1 + temporalBoost * 0.2));
                
                weightedData[key] = resolvedData[key];
                confidenceMap.set(key, enhancedConfidence);
            });
            
            const overallConfidence = confidenceMap.size > 0 ? 
                Array.from(confidenceMap.values()).reduce((sum, conf) => sum + conf, 0) / confidenceMap.size : 0;
            
            return {
                data: weightedData,
                overallConfidence,
                confidenceMap,
                strategy: 'temporal_priority'
            };
        });
    }

    // Helper methods...
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    calculateFieldConfidence(value, result) {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for non-null, non-empty values
        if (value !== null && value !== undefined && value !== '') {
            confidence += 0.2;
        }
        
        // Factor in source reliability
        const source = this.sourceRegistry.get(result.sourceId);
        if (source) {
            confidence *= source.reliability;
        }
        
        // Factor in temporal weight
        if (result.temporalWeight) {
            confidence *= result.temporalWeight;
        }
        
        return Math.max(0, Math.min(1, confidence));
    }

    determineConflictType(values) {
        const types = values.map(v => typeof v.value);
        const uniqueTypes = new Set(types);
        
        if (uniqueTypes.size > 1) {
            return 'type_mismatch';
        }
        
        if (types[0] === 'number') {
            const variance = this.calculateVariance(values.map(v => v.value));
            return variance > 0.1 ? 'significant_variance' : 'minor_variance';
        }
        
        return 'value_mismatch';
    }

    calculateConflictSeverity(values) {
        if (values.length <= 1) return 0;
        
        const confidences = values.map(v => v.confidence);
        const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        const confidenceVariance = this.calculateVariance(confidences);
        
        // Higher variance in confidence = higher severity
        return Math.min(1, confidenceVariance + (1 - avgConfidence));
    }

    calculateVariance(values) {
        if (values.length <= 1) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    }

    calculateDataCompleteness(data) {
        if (Array.isArray(data)) {
            return data.length > 0 ? 1.0 : 0.0;
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            const nonEmptyKeys = keys.filter(key => 
                data[key] !== null && data[key] !== undefined && data[key] !== ''
            );
            return keys.length > 0 ? nonEmptyKeys.length / keys.length : 0.0;
        }
        return data !== null && data !== undefined ? 1.0 : 0.0;
    }

    calculateFieldSynthesisConfidence(fieldKey, resolvedData, confidenceScores) {
        // Use average confidence of all sources as baseline
        const avgConfidence = Array.from(confidenceScores.values())
            .reduce((sum, conf) => sum + conf, 0) / confidenceScores.size;
        
        return avgConfidence;
    }

    calculateCompleteness(data, results) {
        // Calculate what percentage of expected fields/data we have
        const totalExpectedFields = results.reduce((total, result) => {
            const resultData = result.result.data;
            if (Array.isArray(resultData)) {
                return total + resultData.reduce((sum, item) => sum + Object.keys(item).length, 0);
            } else if (typeof resultData === 'object') {
                return total + Object.keys(resultData).length;
            }
            return total + 1;
        }, 0);
        
        const actualFields = typeof data === 'object' ? Object.keys(data).length : 1;
        return totalExpectedFields > 0 ? Math.min(1, actualFields / totalExpectedFields) : 0;
    }

    calculateConsistency(resolvedData) {
        // Measure how consistent the resolved data is internally
        // This is a simplified metric - could be enhanced with more sophisticated analysis
        if (typeof resolvedData !== 'object' || resolvedData === null) {
            return 1.0;
        }
        
        const values = Object.values(resolvedData);
        if (values.length <= 1) return 1.0;
        
        // Check for type consistency
        const types = values.map(v => typeof v);
        const uniqueTypes = new Set(types);
        const typeConsistency = 1 - (uniqueTypes.size - 1) / Math.max(1, types.length - 1);
        
        return Math.max(0, Math.min(1, typeConsistency));
    }

    calculateTimeliness(temporallyWeighted, temporalConfig) {
        if (temporallyWeighted.length === 0) return 0;
        
        const avgTemporalWeight = temporallyWeighted.reduce((sum, item) => 
            sum + (item.temporalWeight || 1), 0) / temporallyWeighted.length;
        
        return avgTemporalWeight;
    }

    calculateReliability(results) {
        if (results.length === 0) return 0;
        
        const avgReliability = results.reduce((sum, result) => {
            const source = this.sourceRegistry.get(result.sourceId);
            return sum + (source ? source.reliability : 0.5);
        }, 0) / results.length;
        
        return avgReliability;
    }

    updateMetrics(fusionResult, validResults, startTime) {
        const processingTime = Date.now() - startTime;
        
        // Update average metrics
        this.metrics.averageConfidence = (
            (this.metrics.averageConfidence * (this.metrics.successfulFusions - 1)) + 
            fusionResult.metadata.overallConfidence
        ) / this.metrics.successfulFusions;
        
        this.metrics.averageFusionTime = (
            (this.metrics.averageFusionTime * (this.metrics.successfulFusions - 1)) + 
            processingTime
        ) / this.metrics.successfulFusions;
        
        // Update source utilization
        validResults.forEach(result => {
            const current = this.metrics.sourceUtilization.get(result.sourceId) || 0;
            this.metrics.sourceUtilization.set(result.sourceId, current + 1);
        });
    }

    cleanupCache() {
        // Remove oldest cache entries
        const entries = Array.from(this.fusionCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, Math.floor(this.options.cacheSize * 0.2));
        
        entries.forEach(([key]) => this.fusionCache.delete(key));
    }

    // Placeholder methods for different source types
    async fetchFromAPI(source, query, timeout) {
        // Implementation would depend on source configuration
        throw new Error('API fetching not implemented yet');
    }

    async fetchFromDatabase(source, query, timeout) {
        // Implementation would depend on source configuration  
        throw new Error('Database fetching not implemented yet');
    }

    async fetchFromFile(source, query, timeout) {
        // Implementation would depend on source configuration
        throw new Error('File fetching not implemented yet');
    }

    async fetchFromStream(source, query, timeout) {
        // Implementation would depend on source configuration
        throw new Error('Stream fetching not implemented yet');
    }

    async applyTransformer(data, transformer) {
        // Apply data transformation based on transformer configuration
        return data;
    }

    async applyValidator(data, validator) {
        // Validate data based on validator configuration
        return { valid: true };
    }

    // Public API methods

    /**
     * Get engine status and metrics
     */
    getStatus() {
        return {
            sources: {
                total: this.sourceRegistry.size,
                enabled: Array.from(this.sourceRegistry.values()).filter(s => s.enabled).length
            },
            cache: {
                size: this.fusionCache.size,
                maxSize: this.options.cacheSize
            },
            metrics: this.metrics,
            options: this.options
        };
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.fusionCache.clear();
        console.log('[FusionEngine] Cache cleared');
    }

    /**
     * Reset all metrics
     */
    resetMetrics() {
        this.metrics = {
            totalFusions: 0,
            successfulFusions: 0,
            conflictsResolved: 0,
            averageConfidence: 0,
            averageFusionTime: 0,
            sourceUtilization: new Map(),
            errorCounts: new Map()
        };
        console.log('[FusionEngine] Metrics reset');
    }

    /**
     * Get source information
     */
    getSource(sourceId) {
        return this.sourceRegistry.get(sourceId);
    }

    /**
     * List all sources
     */
    listSources() {
        return Array.from(this.sourceRegistry.values());
    }

    /**
     * Update source configuration
     */
    updateSource(sourceId, updates) {
        const source = this.sourceRegistry.get(sourceId);
        if (!source) {
            throw new Error(`Source ${sourceId} not found`);
        }
        
        Object.assign(source, updates, { updatedAt: new Date() });
        console.log(`[FusionEngine] Updated source: ${source.name} (${sourceId})`);
        return source;
    }
}

export default FusionAggregationEngine;
