/**
 * Threat Detection Engine
 * Advanced threat analysis with ML-based anomaly detection and automated response
 * @author Robbie Allen - Lead Architect
 * @date August 2025
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ThreatDetectionEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            enabled: true,
            sensitivity: 'high', // low, medium, high, critical
            analysisWindow: 300000, // 5 minutes
            maxEventsPerWindow: 1000,
            threatThreshold: {
                low: 0.3,
                medium: 0.6,
                high: 0.8,
                critical: 0.95
            },
            autoResponse: true,
            learningMode: true,
            retentionPeriod: 7776000000, // 90 days
            ...options
        };

        // Threat detection state
        this.threatEvents = [];
        this.threatPatterns = new Map();
        this.blockedIPs = new Set();
        this.suspiciousActivities = new Map();
        this.currentThreatLevel = 'low';
        this.threatMetrics = this.initializeThreatMetrics();
        
        // Behavioral baselines
        this.behavioralBaselines = new Map();
        this.anomalyThresholds = new Map();
        
        // Threat signatures
        this.threatSignatures = this.initializeThreatSignatures();
        
        console.log('[ThreatDetection] Threat Detection Engine initialized');
    }

    /**
     * Initialize threat detection metrics
     */
    initializeThreatMetrics() {
        return {
            totalThreatsDetected: 0,
            threatsBlocked: 0,
            falsePositives: 0,
            truePositives: 0,
            currentActiveThreat: 0,
            highestThreatLevel: 'low',
            lastThreatDetection: null,
            ipAddressesBlocked: 0,
            patternsLearned: 0,
            anomaliesDetected: 0,
            responseActionsTriggered: 0
        };
    }

    /**
     * Initialize known threat signatures
     */
    initializeThreatSignatures() {
        return {
            // SQL Injection patterns
            sql_injection: [
                /('|(\\'));?\s*(union|select|insert|update|delete|drop|alter|create)\s+/i,
                /\b(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
                /\b(exec|execute|sp_|xp_)\s*\(/i,
                /\b(union\s+select|union\s+all\s+select)/i
            ],
            
            // XSS patterns
            xss: [
                /<script[^>]*>.*?<\/script>/i,
                /javascript\s*:\s*/i,
                /on\w+\s*=\s*["'][^"']*["']/i,
                /<iframe[^>]*>.*?<\/iframe>/i
            ],
            
            // Command injection
            command_injection: [
                /[;&|`$(){}[\]]/,
                /\b(cat|ls|ps|id|uname|whoami|pwd)\b/,
                /\.\.\//,
                /\/etc\/passwd/
            ],
            
            // Brute force patterns
            brute_force: [
                /^(admin|administrator|root|test|guest|user)$/i,
                /^(password|123456|qwerty|letmein|welcome)$/i
            ],
            
            // Path traversal
            path_traversal: [
                /\.\.\//,
                /\.\.\\/,
                /\/etc\/passwd/,
                /\/windows\/system32\//i
            ]
        };
    }

    /**
     * Analyze potential threat
     */
    async analyzeThreat(threatData) {
        try {
            if (!this.options.enabled) {
                return { threat: false, level: 'none' };
            }

            const analysis = {
                timestamp: new Date(),
                threatId: crypto.randomUUID(),
                source: threatData.source || 'unknown',
                type: threatData.type || 'unknown',
                data: threatData,
                threatLevel: 0,
                signatures: [],
                anomalies: [],
                response: null,
                blocked: false
            };

            // Signature-based detection
            const signatureMatches = await this.checkThreatSignatures(threatData);
            analysis.signatures = signatureMatches;

            // Anomaly-based detection
            const anomalyScore = await this.detectAnomalies(threatData);
            analysis.anomalies = anomalyScore.anomalies;

            // Behavioral analysis
            const behaviorScore = await this.analyzeBehavior(threatData);

            // Calculate overall threat level
            const signatureScore = signatureMatches.length > 0 ? 0.8 : 0;
            const combinedScore = Math.max(signatureScore, anomalyScore.score, behaviorScore);
            analysis.threatLevel = combinedScore;

            // Determine threat classification
            analysis.classification = this.classifyThreat(combinedScore);

            // Store threat event
            this.threatEvents.push(analysis);
            this.threatMetrics.totalThreatsDetected++;

            // Update current threat level
            await this.updateThreatLevel(analysis);

            // Auto-response if enabled and threat is significant
            if (this.options.autoResponse && combinedScore >= this.options.threatThreshold.medium) {
                const response = await this.triggerThreatResponse(analysis);
                analysis.response = response;
            }

            // Learning mode - update patterns
            if (this.options.learningMode) {
                await this.updateThreatPatterns(analysis);
            }

            // Emit threat event
            this.emit('threatDetected', analysis);

            return {
                threat: combinedScore >= this.options.threatThreshold.low,
                level: analysis.classification,
                score: combinedScore,
                analysis,
                blocked: analysis.blocked
            };

        } catch (error) {
            console.error('[ThreatDetection] Analysis error:', error);
            return { threat: false, level: 'error', error: error.message };
        }
    }

    /**
     * Check threat signatures against data
     */
    async checkThreatSignatures(threatData) {
        const matches = [];
        
        try {
            const payload = JSON.stringify(threatData).toLowerCase();
            
            for (const [threatType, signatures] of Object.entries(this.threatSignatures)) {
                for (const signature of signatures) {
                    if (signature.test(payload)) {
                        matches.push({
                            type: threatType,
                            pattern: signature.source,
                            confidence: 0.9
                        });
                    }
                }
            }

            // Check for specific attack patterns
            if (threatData.type === 'login_attempt') {
                const username = threatData.username?.toLowerCase() || '';
                const password = threatData.password?.toLowerCase() || '';
                
                if (this.threatSignatures.brute_force.some(pattern => pattern.test(username))) {
                    matches.push({
                        type: 'brute_force_username',
                        pattern: 'common_username',
                        confidence: 0.7
                    });
                }

                if (this.threatSignatures.brute_force.some(pattern => pattern.test(password))) {
                    matches.push({
                        type: 'brute_force_password',
                        pattern: 'common_password',
                        confidence: 0.8
                    });
                }
            }

            if (threatData.type === 'http_request') {
                const url = threatData.url?.toLowerCase() || '';
                const userAgent = threatData.userAgent?.toLowerCase() || '';
                
                // Check for automated tools
                const suspiciousUserAgents = [
                    'sqlmap', 'nikto', 'burp', 'owasp', 'netsparker', 
                    'acunetix', 'w3af', 'havij', 'pangolin'
                ];
                
                if (suspiciousUserAgents.some(agent => userAgent.includes(agent))) {
                    matches.push({
                        type: 'scanning_tool',
                        pattern: 'suspicious_user_agent',
                        confidence: 0.95
                    });
                }
            }

            return matches;
        } catch (error) {
            console.error('[ThreatDetection] Signature check error:', error);
            return [];
        }
    }

    /**
     * Detect anomalies using statistical analysis
     */
    async detectAnomalies(threatData) {
        try {
            const anomalies = [];
            let maxScore = 0;

            // Request frequency anomaly
            if (threatData.source && threatData.type === 'http_request') {
                const recentRequests = this.threatEvents
                    .filter(event => 
                        event.source === threatData.source &&
                        Date.now() - event.timestamp.getTime() < this.options.analysisWindow
                    ).length;

                const baseline = this.behavioralBaselines.get(`${threatData.source}:request_frequency`) || 10;
                const anomalyScore = Math.min(1, recentRequests / (baseline * 3));
                
                if (anomalyScore > 0.5) {
                    anomalies.push({
                        type: 'request_frequency',
                        score: anomalyScore,
                        baseline,
                        current: recentRequests,
                        description: `Unusual request frequency: ${recentRequests} vs baseline ${baseline}`
                    });
                    maxScore = Math.max(maxScore, anomalyScore);
                }
            }

            // Geographic anomaly
            if (threatData.geoLocation && threatData.userId) {
                const userHistory = this.threatEvents
                    .filter(event => event.data.userId === threatData.userId)
                    .slice(-10);

                if (userHistory.length > 5) {
                    const commonLocations = userHistory
                        .map(event => event.data.geoLocation?.country)
                        .filter(Boolean);
                    
                    const mostCommonCountry = this.getMostFrequent(commonLocations);
                    
                    if (mostCommonCountry && threatData.geoLocation.country !== mostCommonCountry) {
                        const anomalyScore = 0.6; // Geographic anomalies are moderately suspicious
                        anomalies.push({
                            type: 'geographic',
                            score: anomalyScore,
                            expected: mostCommonCountry,
                            actual: threatData.geoLocation.country,
                            description: `Unusual location: ${threatData.geoLocation.country} vs typical ${mostCommonCountry}`
                        });
                        maxScore = Math.max(maxScore, anomalyScore);
                    }
                }
            }

            // Time-based anomaly
            if (threatData.userId) {
                const hour = new Date().getHours();
                const userTimeHistory = this.threatEvents
                    .filter(event => event.data.userId === threatData.userId)
                    .map(event => event.timestamp.getHours())
                    .slice(-50);

                if (userTimeHistory.length > 10) {
                    const commonHours = this.getHourDistribution(userTimeHistory);
                    const currentHourFrequency = commonHours[hour] || 0;
                    
                    if (currentHourFrequency < 0.1) { // Less than 10% of activity
                        const anomalyScore = 0.4;
                        anomalies.push({
                            type: 'temporal',
                            score: anomalyScore,
                            hour,
                            frequency: currentHourFrequency,
                            description: `Unusual access time: ${hour}:00 (${Math.round(currentHourFrequency * 100)}% typical)`
                        });
                        maxScore = Math.max(maxScore, anomalyScore);
                    }
                }
            }

            // Payload size anomaly
            if (threatData.payloadSize) {
                const avgPayloadSize = this.behavioralBaselines.get('avg_payload_size') || 1024;
                const sizeRatio = threatData.payloadSize / avgPayloadSize;
                
                if (sizeRatio > 10 || sizeRatio < 0.1) {
                    const anomalyScore = Math.min(0.8, Math.abs(Math.log10(sizeRatio)) / 2);
                    anomalies.push({
                        type: 'payload_size',
                        score: anomalyScore,
                        expected: avgPayloadSize,
                        actual: threatData.payloadSize,
                        ratio: sizeRatio,
                        description: `Unusual payload size: ${threatData.payloadSize} bytes vs avg ${avgPayloadSize}`
                    });
                    maxScore = Math.max(maxScore, anomalyScore);
                }
            }

            this.threatMetrics.anomaliesDetected += anomalies.length;

            return { score: maxScore, anomalies };
        } catch (error) {
            console.error('[ThreatDetection] Anomaly detection error:', error);
            return { score: 0, anomalies: [] };
        }
    }

    /**
     * Analyze behavioral patterns
     */
    async analyzeBehavior(threatData) {
        try {
            let behaviorScore = 0;

            // Rapid succession attacks
            if (threatData.source) {
                const recentEvents = this.threatEvents
                    .filter(event => 
                        event.source === threatData.source &&
                        Date.now() - event.timestamp.getTime() < 60000 // 1 minute
                    );

                if (recentEvents.length > 20) {
                    behaviorScore = Math.max(behaviorScore, 0.8);
                }
            }

            // Error rate analysis
            if (threatData.type === 'http_request' && threatData.responseCode >= 400) {
                const errorCount = this.threatEvents
                    .filter(event => 
                        event.source === threatData.source &&
                        event.data.responseCode >= 400 &&
                        Date.now() - event.timestamp.getTime() < 300000 // 5 minutes
                    ).length;

                if (errorCount > 10) {
                    behaviorScore = Math.max(behaviorScore, 0.6);
                }
            }

            // Multiple user enumeration
            if (threatData.type === 'login_attempt') {
                const uniqueUsernames = new Set(
                    this.threatEvents
                        .filter(event => 
                            event.source === threatData.source &&
                            event.data.type === 'login_attempt' &&
                            Date.now() - event.timestamp.getTime() < 600000 // 10 minutes
                        )
                        .map(event => event.data.username)
                );

                if (uniqueUsernames.size > 15) {
                    behaviorScore = Math.max(behaviorScore, 0.9);
                }
            }

            return behaviorScore;
        } catch (error) {
            console.error('[ThreatDetection] Behavior analysis error:', error);
            return 0;
        }
    }

    /**
     * Classify threat based on score
     */
    classifyThreat(score) {
        if (score >= this.options.threatThreshold.critical) return 'critical';
        if (score >= this.options.threatThreshold.high) return 'high';
        if (score >= this.options.threatThreshold.medium) return 'medium';
        if (score >= this.options.threatThreshold.low) return 'low';
        return 'none';
    }

    /**
     * Update overall threat level
     */
    async updateThreatLevel(analysis) {
        try {
            const recentThreats = this.threatEvents
                .filter(event => Date.now() - event.timestamp.getTime() < this.options.analysisWindow)
                .map(event => event.threatLevel);

            if (recentThreats.length === 0) {
                this.currentThreatLevel = 'low';
                return;
            }

            const avgThreatLevel = recentThreats.reduce((sum, level) => sum + level, 0) / recentThreats.length;
            const maxThreatLevel = Math.max(...recentThreats);

            // Weighted combination of average and max
            const combinedLevel = (avgThreatLevel * 0.7) + (maxThreatLevel * 0.3);

            this.currentThreatLevel = this.classifyThreat(combinedLevel);
            this.threatMetrics.highestThreatLevel = this.currentThreatLevel;
            this.threatMetrics.lastThreatDetection = new Date();

            // Emit threat level change
            this.emit('threatLevelChanged', {
                level: this.currentThreatLevel,
                score: combinedLevel,
                recentThreats: recentThreats.length,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('[ThreatDetection] Threat level update error:', error);
        }
    }

    /**
     * Trigger automated threat response
     */
    async triggerThreatResponse(analysis) {
        try {
            const response = {
                timestamp: new Date(),
                threatId: analysis.threatId,
                actions: [],
                success: true
            };

            // Block IP address for high-level threats
            if (analysis.threatLevel >= this.options.threatThreshold.high && analysis.source) {
                this.blockedIPs.add(analysis.source);
                this.threatMetrics.ipAddressesBlocked++;
                
                response.actions.push({
                    action: 'block_ip',
                    target: analysis.source,
                    duration: '1h',
                    timestamp: new Date()
                });

                analysis.blocked = true;
            }

            // Rate limit for medium-level threats
            if (analysis.threatLevel >= this.options.threatThreshold.medium && analysis.source) {
                this.suspiciousActivities.set(analysis.source, {
                    timestamp: Date.now(),
                    level: analysis.classification,
                    count: (this.suspiciousActivities.get(analysis.source)?.count || 0) + 1
                });

                response.actions.push({
                    action: 'rate_limit',
                    target: analysis.source,
                    level: 'strict',
                    timestamp: new Date()
                });
            }

            // Alert for critical threats
            if (analysis.threatLevel >= this.options.threatThreshold.critical) {
                response.actions.push({
                    action: 'alert',
                    level: 'critical',
                    message: `Critical threat detected from ${analysis.source}`,
                    timestamp: new Date()
                });

                this.emit('criticalThreat', analysis);
            }

            this.threatMetrics.responseActionsTriggered += response.actions.length;
            this.threatMetrics.threatsBlocked++;

            return response;
        } catch (error) {
            console.error('[ThreatDetection] Response trigger error:', error);
            return {
                timestamp: new Date(),
                threatId: analysis.threatId,
                actions: [],
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update threat patterns for learning
     */
    async updateThreatPatterns(analysis) {
        try {
            const patternKey = `${analysis.source}:${analysis.type}`;
            
            if (!this.threatPatterns.has(patternKey)) {
                this.threatPatterns.set(patternKey, {
                    count: 0,
                    averageThreatLevel: 0,
                    signatures: [],
                    firstSeen: new Date(),
                    lastSeen: new Date()
                });
            }

            const pattern = this.threatPatterns.get(patternKey);
            pattern.count++;
            pattern.averageThreatLevel = ((pattern.averageThreatLevel * (pattern.count - 1)) + analysis.threatLevel) / pattern.count;
            pattern.lastSeen = new Date();
            
            // Add new signatures
            for (const signature of analysis.signatures) {
                if (!pattern.signatures.some(s => s.pattern === signature.pattern)) {
                    pattern.signatures.push(signature);
                }
            }

            this.threatMetrics.patternsLearned++;

            // Update behavioral baselines
            if (analysis.source) {
                const requestFrequencyKey = `${analysis.source}:request_frequency`;
                const currentBaseline = this.behavioralBaselines.get(requestFrequencyKey) || 0;
                const newBaseline = (currentBaseline * 0.9) + (1 * 0.1); // Exponential moving average
                this.behavioralBaselines.set(requestFrequencyKey, newBaseline);
            }

        } catch (error) {
            console.error('[ThreatDetection] Pattern update error:', error);
        }
    }

    /**
     * Check if IP address is blocked
     */
    isBlocked(ipAddress) {
        return this.blockedIPs.has(ipAddress);
    }

    /**
     * Unblock IP address
     */
    unblockIP(ipAddress) {
        return this.blockedIPs.delete(ipAddress);
    }

    /**
     * Get current threat level
     */
    getCurrentThreatLevel() {
        return {
            level: this.currentThreatLevel,
            timestamp: this.threatMetrics.lastThreatDetection,
            activeThreats: this.threatMetrics.currentActiveThreat,
            recentEvents: this.threatEvents
                .filter(event => Date.now() - event.timestamp.getTime() < this.options.analysisWindow)
                .length
        };
    }

    /**
     * Get threat statistics
     */
    getThreatStatistics() {
        const recentEvents = this.threatEvents
            .filter(event => Date.now() - event.timestamp.getTime() < 86400000); // 24 hours

        return {
            ...this.threatMetrics,
            recentEvents: recentEvents.length,
            blockedIPs: this.blockedIPs.size,
            suspiciousActivities: this.suspiciousActivities.size,
            learnedPatterns: this.threatPatterns.size,
            currentThreatLevel: this.currentThreatLevel,
            threatsByType: this.getThreatsByType(recentEvents),
            threatsBySource: this.getThreatsBySource(recentEvents),
            hourlyDistribution: this.getHourlyThreatDistribution(recentEvents)
        };
    }

    /**
     * Get threats grouped by type
     */
    getThreatsByType(events) {
        const typeMap = new Map();
        for (const event of events) {
            const type = event.type || 'unknown';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
        }
        return Object.fromEntries(typeMap);
    }

    /**
     * Get threats grouped by source
     */
    getThreatsBySource(events) {
        const sourceMap = new Map();
        for (const event of events) {
            const source = event.source || 'unknown';
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        }
        // Return top 10 sources
        return Object.fromEntries(
            Array.from(sourceMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        );
    }

    /**
     * Get hourly threat distribution
     */
    getHourlyThreatDistribution(events) {
        const hourCounts = new Array(24).fill(0);
        for (const event of events) {
            const hour = event.timestamp.getHours();
            hourCounts[hour]++;
        }
        return hourCounts;
    }

    /**
     * Get hour distribution from array
     */
    getHourDistribution(hours) {
        const distribution = {};
        const total = hours.length;
        
        for (let i = 0; i < 24; i++) {
            distribution[i] = hours.filter(h => h === i).length / total;
        }
        
        return distribution;
    }

    /**
     * Get most frequent item from array
     */
    getMostFrequent(array) {
        const frequency = {};
        let maxCount = 0;
        let mostFrequent = null;
        
        for (const item of array) {
            frequency[item] = (frequency[item] || 0) + 1;
            if (frequency[item] > maxCount) {
                maxCount = frequency[item];
                mostFrequent = item;
            }
        }
        
        return mostFrequent;
    }

    /**
     * Clean up old threat events
     */
    async cleanupOldEvents() {
        try {
            const cutoff = Date.now() - this.options.retentionPeriod;
            const initialCount = this.threatEvents.length;
            
            this.threatEvents = this.threatEvents.filter(event => 
                event.timestamp.getTime() > cutoff
            );

            const removedCount = initialCount - this.threatEvents.length;
            
            console.log(`[ThreatDetection] Cleaned up ${removedCount} old threat events`);
            return removedCount;
        } catch (error) {
            console.error('[ThreatDetection] Cleanup error:', error);
            return 0;
        }
    }

    /**
     * Get health status
     */
    getHealthStatus() {
        const recentErrors = this.threatEvents
            .filter(event => 
                event.analysis?.error &&
                Date.now() - event.timestamp.getTime() < 300000 // 5 minutes
            ).length;

        return {
            healthy: recentErrors < 10,
            message: recentErrors > 0 
                ? `${recentErrors} recent detection errors`
                : 'Threat detection operating normally',
            enabled: this.options.enabled,
            currentThreatLevel: this.currentThreatLevel,
            eventsInMemory: this.threatEvents.length
        };
    }

    /**
     * Initialize threat detection engine
     */
    async initialize() {
        try {
            console.log('[ThreatDetection] Initializing Threat Detection Engine...');
            
            // Start cleanup interval
            setInterval(async () => {
                try {
                    await this.cleanupOldEvents();
                } catch (error) {
                    console.error('[ThreatDetection] Cleanup interval error:', error);
                }
            }, 3600000); // Every hour

            console.log('[ThreatDetection] Threat Detection Engine initialized successfully');
            return true;
        } catch (error) {
            console.error('[ThreatDetection] Failed to initialize:', error);
            throw error;
        }
    }
}

export default ThreatDetectionEngine;
