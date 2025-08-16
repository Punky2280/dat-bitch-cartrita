/**
 * Zero-Trust Network Security Middleware
 * Implements zero-trust verification for all network requests
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import ZeroTrustNetworkSecurity from '../services/ZeroTrustNetworkSecurity.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import crypto from 'crypto';

class ZeroTrustMiddleware {
    constructor() {
        this.zeroTrust = new ZeroTrustNetworkSecurity();
        this.auditLogger = new SecurityAuditLogger();
        this.rateLimiter = new Map(); // Simple rate limiting
        
        // Initialize middleware
        console.log('[ZeroTrust] Zero-Trust Network Security Middleware initialized');
    }

    /**
     * Main zero-trust verification middleware
     */
    verifyAccess() {
        return async (req, res, next) => {
            const span = OpenTelemetryTracing.tracer.startSpan('zerotrust.middleware.verify');
            
            try {
                // Skip verification for health checks and public endpoints
                if (this.isPublicEndpoint(req.path)) {
                    span.setAttributes({
                        'zerotrust.middleware.skipped': true,
                        'zerotrust.middleware.reason': 'public_endpoint'
                    });
                    return next();
                }

                // Extract request information
                const requestInfo = this.extractRequestInfo(req);
                
                // Rate limiting check
                const rateLimitResult = await this.checkRateLimit(requestInfo);
                if (!rateLimitResult.allowed) {
                    return this.sendSecurityResponse(res, 429, 'Rate limit exceeded', {
                        retryAfter: rateLimitResult.retryAfter
                    });
                }

                // Perform zero-trust verification
                const accessDecision = await this.zeroTrust.verifyNetworkAccess(requestInfo);
                
                if (accessDecision.action === 'deny') {
                    // Log denied access
                    await this.auditLogger.logSecurityEvent('zero_trust_access_denied', {
                        ...requestInfo,
                        reason: accessDecision.reason,
                        timestamp: new Date().toISOString()
                    });

                    span.setAttributes({
                        'zerotrust.middleware.decision': 'deny',
                        'zerotrust.middleware.reason': accessDecision.reason
                    });

                    return this.sendSecurityResponse(res, 403, 'Access denied', {
                        reason: accessDecision.reason
                    });
                }

                // Access allowed - set context for downstream handlers
                req.zeroTrust = {
                    verified: true,
                    networkSegment: accessDecision.networkSegment,
                    riskScore: accessDecision.riskScore,
                    monitoringId: accessDecision.monitoringId,
                    timestamp: new Date().toISOString()
                };

                span.setAttributes({
                    'zerotrust.middleware.decision': 'allow',
                    'zerotrust.middleware.network_segment': accessDecision.networkSegment?.name || 'none'
                });

                next();

            } catch (error) {
                console.error('[ZeroTrust] Middleware verification error:', error);
                span.recordException(error);
                
                // Fail secure - deny access on error
                return this.sendSecurityResponse(res, 500, 'Security verification error');
            } finally {
                span.end();
            }
        };
    }

    /**
     * Network segmentation enforcement middleware
     */
    enforceNetworkSegmentation() {
        return (req, res, next) => {
            const span = OpenTelemetryTracing.tracer.startSpan('zerotrust.middleware.segmentation');
            
            try {
                if (!req.zeroTrust || !req.zeroTrust.verified) {
                    return this.sendSecurityResponse(res, 403, 'Network access not verified');
                }

                const segment = req.zeroTrust.networkSegment;
                const requestedService = this.getRequestedService(req.path);

                // Check if service is allowed in current segment
                if (segment && !this.isServiceAllowedInSegment(requestedService, segment)) {
                    span.setAttributes({
                        'zerotrust.segmentation.denied': true,
                        'zerotrust.segmentation.service': requestedService,
                        'zerotrust.segmentation.segment': segment.name
                    });

                    return this.sendSecurityResponse(res, 403, 'Service not allowed in network segment');
                }

                // Set segment context
                req.networkSegment = segment;
                
                span.setAttributes({
                    'zerotrust.segmentation.allowed': true,
                    'zerotrust.segmentation.service': requestedService,
                    'zerotrust.segmentation.segment': segment?.name || 'none'
                });

                next();

            } catch (error) {
                console.error('[ZeroTrust] Segmentation enforcement error:', error);
                span.recordException(error);
                return this.sendSecurityResponse(res, 500, 'Segmentation enforcement error');
            } finally {
                span.end();
            }
        };
    }

    /**
     * Continuous monitoring middleware
     */
    continuousMonitoring() {
        return (req, res, next) => {
            const span = OpenTelemetryTracing.tracer.startSpan('zerotrust.middleware.monitoring');
            
            try {
                if (!req.zeroTrust || !req.zeroTrust.verified) {
                    return next();
                }

                // Track request for behavioral analysis
                this.trackRequestBehavior(req);
                
                // Set up response monitoring
                const originalEnd = res.end;
                res.end = function(chunk, encoding) {
                    // Monitor response patterns
                    if (req.zeroTrust.monitoringId) {
                        this.updateMonitoringContext(req, res);
                    }
                    originalEnd.call(res, chunk, encoding);
                }.bind(this);

                span.setAttributes({
                    'zerotrust.monitoring.enabled': true,
                    'zerotrust.monitoring.id': req.zeroTrust.monitoringId
                });

                next();

            } catch (error) {
                console.error('[ZeroTrust] Continuous monitoring error:', error);
                span.recordException(error);
                next(); // Continue even if monitoring fails
            } finally {
                span.end();
            }
        };
    }

    /**
     * Threat detection middleware
     */
    threatDetection() {
        return async (req, res, next) => {
            const span = OpenTelemetryTracing.tracer.startSpan('zerotrust.middleware.threat_detection');
            
            try {
                const threats = await this.detectThreats(req);
                
                if (threats.length > 0) {
                    // Log threats
                    await this.auditLogger.logSecurityEvent('threats_detected', {
                        userId: req.user?.id,
                        sourceIP: req.ip,
                        threats: threats.map(t => t.type),
                        path: req.path,
                        timestamp: new Date().toISOString()
                    });

                    // Block high-severity threats
                    const highSeverityThreat = threats.find(t => t.severity === 'high' || t.severity === 'critical');
                    if (highSeverityThreat) {
                        span.setAttributes({
                            'zerotrust.threat.detected': true,
                            'zerotrust.threat.type': highSeverityThreat.type,
                            'zerotrust.threat.severity': highSeverityThreat.severity,
                            'zerotrust.threat.blocked': true
                        });

                        return this.sendSecurityResponse(res, 403, 'Threat detected', {
                            threatType: highSeverityThreat.type
                        });
                    }

                    // Log medium/low threats but allow
                    span.setAttributes({
                        'zerotrust.threat.detected': true,
                        'zerotrust.threat.count': threats.length,
                        'zerotrust.threat.blocked': false
                    });

                    req.detectedThreats = threats;
                }

                next();

            } catch (error) {
                console.error('[ZeroTrust] Threat detection error:', error);
                span.recordException(error);
                next(); // Continue even if threat detection fails
            } finally {
                span.end();
            }
        };
    }

    /**
     * Extract request information for verification
     */
    extractRequestInfo(req) {
        const userAgent = req.get('User-Agent') || '';
        const deviceId = this.extractDeviceId(req);
        const sessionToken = this.extractSessionToken(req);

        return {
            userId: req.user?.id || 'anonymous',
            deviceId,
            sourceIP: req.ip || req.connection.remoteAddress,
            destinationService: this.getRequestedService(req.path),
            requestType: req.method,
            userAgent,
            sessionToken,
            headers: req.headers,
            path: req.path,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Extract device ID from request
     */
    extractDeviceId(req) {
        // Try to get device ID from various sources
        const deviceId = req.get('X-Device-Id') || 
                         req.get('X-Client-Id') ||
                         req.cookies?.deviceId;
        
        if (deviceId) {
            return deviceId;
        }

        // Generate fingerprint from user agent and other headers
        const fingerprint = crypto.createHash('sha256')
            .update(req.get('User-Agent') || '')
            .update(req.get('Accept-Language') || '')
            .update(req.get('Accept-Encoding') || '')
            .digest('hex');

        return `fingerprint-${fingerprint.substring(0, 16)}`;
    }

    /**
     * Extract session token from request
     */
    extractSessionToken(req) {
        const authHeader = req.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return req.cookies?.sessionToken;
    }

    /**
     * Get requested service from path
     */
    getRequestedService(path) {
        const pathSegments = path.split('/').filter(Boolean);
        
        if (pathSegments.length === 0) return 'web';
        
        const serviceMap = {
            'api': 'api',
            'admin': 'admin',
            'auth': 'auth',
            'vault': 'vault',
            'dashboard': 'web',
            'static': 'cdn',
            'uploads': 'storage'
        };

        return serviceMap[pathSegments[0]] || 'web';
    }

    /**
     * Check if endpoint is public (no verification needed)
     */
    isPublicEndpoint(path) {
        const publicPaths = [
            '/health',
            '/status',
            '/api/auth/login',
            '/api/auth/register',
            '/static/',
            '/favicon.ico',
            '/.well-known/'
        ];

        return publicPaths.some(publicPath => path.startsWith(publicPath));
    }

    /**
     * Check if service is allowed in network segment
     */
    isServiceAllowedInSegment(service, segment) {
        if (!segment || !segment.allowedServices) {
            return true; // Allow if no restrictions
        }

        return segment.allowedServices.includes(service);
    }

    /**
     * Simple rate limiting
     */
    async checkRateLimit(requestInfo) {
        const key = `${requestInfo.sourceIP}:${requestInfo.userId}`;
        const now = Date.now();
        const windowMs = 60000; // 1 minute window
        const maxRequests = 100; // Max requests per window

        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
            return { allowed: true };
        }

        const entry = this.rateLimiter.get(key);
        
        if (now > entry.resetTime) {
            // Reset window
            entry.count = 1;
            entry.resetTime = now + windowMs;
            return { allowed: true };
        }

        if (entry.count >= maxRequests) {
            return { 
                allowed: false, 
                retryAfter: Math.ceil((entry.resetTime - now) / 1000) 
            };
        }

        entry.count++;
        return { allowed: true };
    }

    /**
     * Track request behavior for anomaly detection
     */
    trackRequestBehavior(req) {
        // Track patterns that could indicate anomalous behavior
        const behavior = {
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            sourceIP: req.ip,
            userId: req.user?.id
        };

        // Store for behavior analysis (in a real implementation, this would go to a queue/database)
        // For now, just emit an event
        this.zeroTrust.emit('request-tracked', behavior);
    }

    /**
     * Update monitoring context with response data
     */
    updateMonitoringContext(req, res) {
        const update = {
            statusCode: res.statusCode,
            responseTime: Date.now() - req.startTime,
            contentLength: res.get('content-length')
        };

        // Emit monitoring update
        this.zeroTrust.emit('monitoring-update', {
            monitoringId: req.zeroTrust.monitoringId,
            update
        });
    }

    /**
     * Detect potential threats in request
     */
    async detectThreats(req) {
        const threats = [];

        // SQL injection patterns
        const sqlInjectionPatterns = [
            /('|(\\')|(;)|(\\;))/gi,
            /(union|select|insert|update|delete|drop|create|alter)/gi,
            /(\|\||&&)/gi
        ];

        const checkString = `${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
        
        for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(checkString)) {
                threats.push({
                    type: 'sql_injection',
                    severity: 'high',
                    details: 'SQL injection pattern detected'
                });
                break;
            }
        }

        // XSS patterns
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ];

        for (const pattern of xssPatterns) {
            if (pattern.test(checkString)) {
                threats.push({
                    type: 'xss',
                    severity: 'high',
                    details: 'XSS pattern detected'
                });
                break;
            }
        }

        // Unusual user agent
        const userAgent = req.get('User-Agent') || '';
        if (userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent)) {
            threats.push({
                type: 'suspicious_user_agent',
                severity: 'low',
                details: 'Suspicious user agent detected'
            });
        }

        return threats;
    }

    /**
     * Send standardized security response
     */
    sendSecurityResponse(res, statusCode, message, additionalData = {}) {
        res.status(statusCode).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString(),
            ...additionalData
        });
    }
}

export default ZeroTrustMiddleware;
