/**
 * Advanced Security Hardening Service
 * Comprehensive security framework with threat detection, encrypted communications, and compliance monitoring
 * @author Robbie Allen - Lead Architect
 * @date August 2025
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import ThreatDetectionEngine from './ThreatDetectionEngine.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';
import ComplianceChecker from './ComplianceChecker.js';

class SecurityHardeningService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            encryptionAlgorithm: 'aes-256-gcm',
            hashAlgorithm: 'sha256',
            keyDerivationRounds: 100000,
            sessionTimeout: 3600000, // 1 hour
            maxLoginAttempts: 5,
            lockoutDuration: 900000, // 15 minutes
            passwordMinLength: 12,
            passwordComplexity: {
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true
            },
            mfaRequired: true,
            auditLogRetention: 2592000000, // 30 days
            threatDetectionEnabled: true,
            complianceFrameworks: ['GDPR', 'HIPAA', 'SOX', 'ISO27001'],
            ...options
        };

        // Initialize components
        this.threatDetection = new ThreatDetectionEngine({
            enabled: this.options.threatDetectionEnabled,
            sensitivity: options.threatSensitivity || 'high'
        });
        
        this.auditLogger = new SecurityAuditLogger({
            retention: this.options.auditLogRetention,
            encryption: true,
            tamperProtection: true
        });
        
        this.complianceChecker = new ComplianceChecker({
            frameworks: this.options.complianceFrameworks,
            autoReporting: true
        });

        // Security state
        this.activeSecurityIncidents = new Map();
        this.securityMetrics = this.initializeSecurityMetrics();
        this.encryptionKeys = new Map();
        this.sessionStore = new Map();
        this.loginAttempts = new Map();
        this.mfaSecrets = new Map();
        
        // Rate limiters
        this.rateLimiters = this.initializeRateLimiters();
        
        // Security policies
        this.securityPolicies = new Map();
        this.loadDefaultPolicies();
        
        console.log('[SecurityHardening] Advanced Security Hardening Service initialized');
    }

    /**
     * Initialize security metrics tracking
     */
    initializeSecurityMetrics() {
        return {
            totalSecurityEvents: 0,
            criticalIncidents: 0,
            threatsDetected: 0,
            threatsBlocked: 0,
            failedLoginAttempts: 0,
            suspiciousActivities: 0,
            complianceViolations: 0,
            encryptionOperations: 0,
            auditLogEntries: 0,
            mfaEnrollments: 0,
            sessionCreated: 0,
            sessionTerminated: 0,
            lastThreatDetection: null,
            lastComplianceCheck: null,
            uptime: Date.now(),
            vulnerabilitiesFound: 0,
            securityPatchesApplied: 0
        };
    }

    /**
     * Initialize rate limiters for different endpoints
     */
    initializeRateLimiters() {
        return {
            login: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 5, // 5 attempts per window
                message: 'Too many login attempts, please try again later'
            }),
            
            api: rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 1000, // 1000 requests per window
                message: 'API rate limit exceeded'
            }),
            
            sensitive: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 10, // 10 sensitive operations per window
                message: 'Sensitive operation rate limit exceeded'
            })
        };
    }

    /**
     * Load default security policies
     */
    loadDefaultPolicies() {
        this.securityPolicies.set('password_policy', {
            minLength: this.options.passwordMinLength,
            complexity: this.options.passwordComplexity,
            history: 12, // Remember last 12 passwords
            expiry: 90 * 24 * 60 * 60 * 1000 // 90 days
        });

        this.securityPolicies.set('session_policy', {
            timeout: this.options.sessionTimeout,
            renewalThreshold: 0.75, // Renew when 75% expired
            concurrentSessions: 3,
            ipBinding: true
        });

        this.securityPolicies.set('audit_policy', {
            logAllRequests: true,
            logFailures: true,
            logPrivilegedOperations: true,
            retention: this.options.auditLogRetention
        });

        this.securityPolicies.set('threat_response', {
            autoBlock: true,
            alertThreshold: 'medium',
            escalationTimeout: 300000, // 5 minutes
            maxResponseTime: 60000 // 1 minute
        });
    }

    /**
     * Advanced password validation with entropy calculation
     */
    validatePassword(password) {
        const policy = this.securityPolicies.get('password_policy');
        const validation = {
            valid: true,
            errors: [],
            strength: 0,
            entropy: 0
        };

        // Length check
        if (password.length < policy.minLength) {
            validation.valid = false;
            validation.errors.push(`Password must be at least ${policy.minLength} characters`);
        }

        // Complexity checks
        if (policy.complexity.requireUppercase && !/[A-Z]/.test(password)) {
            validation.valid = false;
            validation.errors.push('Password must contain uppercase letters');
        }

        if (policy.complexity.requireLowercase && !/[a-z]/.test(password)) {
            validation.valid = false;
            validation.errors.push('Password must contain lowercase letters');
        }

        if (policy.complexity.requireNumbers && !/\d/.test(password)) {
            validation.valid = false;
            validation.errors.push('Password must contain numbers');
        }

        if (policy.complexity.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            validation.valid = false;
            validation.errors.push('Password must contain special characters');
        }

        // Calculate entropy
        validation.entropy = this.calculatePasswordEntropy(password);
        validation.strength = Math.min(100, Math.floor(validation.entropy / 6 * 100));

        // Common password check
        if (this.isCommonPassword(password)) {
            validation.valid = false;
            validation.errors.push('Password is too common');
        }

        return validation;
    }

    /**
     * Calculate password entropy
     */
    calculatePasswordEntropy(password) {
        const charsets = [
            { regex: /[a-z]/, size: 26 },
            { regex: /[A-Z]/, size: 26 },
            { regex: /[0-9]/, size: 10 },
            { regex: /[!@#$%^&*(),.?":{}|<>]/, size: 32 }
        ];

        let charsetSize = 0;
        for (const charset of charsets) {
            if (charset.regex.test(password)) {
                charsetSize += charset.size;
            }
        }

        return Math.log2(Math.pow(charsetSize, password.length));
    }

    /**
     * Check if password is in common password list
     */
    isCommonPassword(password) {
        const commonPasswords = [
            'password', '123456', 'password123', 'admin', 'qwerty',
            'letmein', 'welcome', 'monkey', '1234567890', 'dragon'
        ];
        return commonPasswords.includes(password.toLowerCase());
    }

    /**
     * Enhanced password hashing with salt
     */
    async hashPassword(password) {
        try {
            const validation = this.validatePassword(password);
            if (!validation.valid) {
                throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
            }

            const salt = await bcrypt.genSalt(12);
            const hash = await bcrypt.hash(password, salt);
            
            this.securityMetrics.encryptionOperations++;
            
            return {
                hash,
                salt,
                algorithm: 'bcrypt',
                rounds: 12,
                strength: validation.strength,
                entropy: validation.entropy,
                createdAt: new Date()
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('password_hash_failure', {
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Verify password with timing attack protection
     */
    async verifyPassword(password, storedHash) {
        try {
            const startTime = process.hrtime.bigint();
            
            const isValid = await bcrypt.compare(password, storedHash.hash);
            
            // Constant-time delay to prevent timing attacks
            const elapsedTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            const minTime = 100; // Minimum 100ms
            if (elapsedTime < minTime) {
                await new Promise(resolve => setTimeout(resolve, minTime - elapsedTime));
            }

            await this.auditLogger.logSecurityEvent('password_verification', {
                success: isValid,
                timingMs: elapsedTime,
                timestamp: new Date()
            });

            return isValid;
        } catch (error) {
            await this.auditLogger.logSecurityEvent('password_verification_error', {
                error: error.message,
                timestamp: new Date()
            });
            return false;
        }
    }

    /**
     * Multi-Factor Authentication setup
     */
    async setupMFA(userId, userEmail) {
        try {
            const secret = speakeasy.generateSecret({
                name: `Cartrita AI OS (${userEmail})`,
                issuer: 'Cartrita',
                length: 32
            });

            this.mfaSecrets.set(userId, {
                secret: secret.base32,
                tempSecret: secret.base32,
                verified: false,
                backupCodes: this.generateBackupCodes(),
                createdAt: new Date()
            });

            const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
            
            this.securityMetrics.mfaEnrollments++;
            
            await this.auditLogger.logSecurityEvent('mfa_setup_initiated', {
                userId,
                timestamp: new Date()
            });

            return {
                secret: secret.base32,
                qrCode: qrCodeUrl,
                manualEntryCode: secret.base32,
                backupCodes: this.mfaSecrets.get(userId).backupCodes
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('mfa_setup_error', {
                userId,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Verify MFA token
     */
    async verifyMFA(userId, token, isBackupCode = false) {
        try {
            const mfaData = this.mfaSecrets.get(userId);
            if (!mfaData) {
                throw new Error('MFA not configured for user');
            }

            let isValid = false;

            if (isBackupCode) {
                const backupIndex = mfaData.backupCodes.indexOf(token);
                if (backupIndex !== -1) {
                    mfaData.backupCodes.splice(backupIndex, 1); // Remove used backup code
                    isValid = true;
                }
            } else {
                isValid = speakeasy.totp.verify({
                    secret: mfaData.verified ? mfaData.secret : mfaData.tempSecret,
                    encoding: 'base32',
                    token,
                    window: 2 // Allow 2 time steps tolerance
                });
            }

            await this.auditLogger.logSecurityEvent('mfa_verification', {
                userId,
                success: isValid,
                isBackupCode,
                timestamp: new Date()
            });

            if (isValid && !mfaData.verified) {
                mfaData.verified = true;
                mfaData.secret = mfaData.tempSecret;
                delete mfaData.tempSecret;
            }

            return isValid;
        } catch (error) {
            await this.auditLogger.logSecurityEvent('mfa_verification_error', {
                userId,
                error: error.message,
                timestamp: new Date()
            });
            return false;
        }
    }

    /**
     * Generate backup codes for MFA
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 8; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    /**
     * Advanced session management with security features
     */
    async createSecureSession(userId, userAgent, ipAddress, additionalData = {}) {
        try {
            const sessionId = crypto.randomUUID();
            const sessionToken = this.generateSecureToken();
            
            const session = {
                sessionId,
                userId,
                token: sessionToken,
                userAgent,
                ipAddress,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + this.options.sessionTimeout),
                lastActivity: new Date(),
                isActive: true,
                mfaVerified: false,
                permissions: additionalData.permissions || [],
                metadata: additionalData.metadata || {}
            };

            // Check for concurrent sessions limit
            const userSessions = Array.from(this.sessionStore.values())
                .filter(s => s.userId === userId && s.isActive);
            
            const sessionPolicy = this.securityPolicies.get('session_policy');
            if (userSessions.length >= sessionPolicy.concurrentSessions) {
                // Terminate oldest session
                const oldestSession = userSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
                await this.terminateSession(oldestSession.sessionId, 'concurrent_limit_exceeded');
            }

            this.sessionStore.set(sessionId, session);
            this.securityMetrics.sessionCreated++;

            await this.auditLogger.logSecurityEvent('session_created', {
                sessionId,
                userId,
                ipAddress,
                userAgent,
                timestamp: new Date()
            });

            return {
                sessionId,
                token: sessionToken,
                expiresAt: session.expiresAt,
                permissions: session.permissions
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('session_creation_error', {
                userId,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Validate and refresh session
     */
    async validateSession(sessionId, ipAddress, userAgent) {
        try {
            const session = this.sessionStore.get(sessionId);
            if (!session || !session.isActive) {
                return { valid: false, reason: 'session_not_found' };
            }

            // Check expiration
            if (new Date() > session.expiresAt) {
                await this.terminateSession(sessionId, 'expired');
                return { valid: false, reason: 'session_expired' };
            }

            // IP binding check (if enabled)
            const sessionPolicy = this.securityPolicies.get('session_policy');
            if (sessionPolicy.ipBinding && session.ipAddress !== ipAddress) {
                await this.terminateSession(sessionId, 'ip_mismatch');
                return { valid: false, reason: 'ip_mismatch' };
            }

            // User agent consistency check
            if (session.userAgent !== userAgent) {
                await this.auditLogger.logSecurityEvent('session_user_agent_change', {
                    sessionId,
                    originalUserAgent: session.userAgent,
                    newUserAgent: userAgent,
                    timestamp: new Date()
                });
            }

            // Auto-renewal if threshold reached
            const timeLeft = session.expiresAt.getTime() - Date.now();
            const renewalThreshold = this.options.sessionTimeout * sessionPolicy.renewalThreshold;
            
            if (timeLeft < renewalThreshold) {
                session.expiresAt = new Date(Date.now() + this.options.sessionTimeout);
                
                await this.auditLogger.logSecurityEvent('session_renewed', {
                    sessionId,
                    newExpiry: session.expiresAt,
                    timestamp: new Date()
                });
            }

            // Update last activity
            session.lastActivity = new Date();

            return {
                valid: true,
                session: {
                    sessionId: session.sessionId,
                    userId: session.userId,
                    expiresAt: session.expiresAt,
                    mfaVerified: session.mfaVerified,
                    permissions: session.permissions
                }
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('session_validation_error', {
                sessionId,
                error: error.message,
                timestamp: new Date()
            });
            return { valid: false, reason: 'validation_error' };
        }
    }

    /**
     * Terminate session with reason
     */
    async terminateSession(sessionId, reason = 'user_logout') {
        try {
            const session = this.sessionStore.get(sessionId);
            if (session) {
                session.isActive = false;
                session.terminatedAt = new Date();
                session.terminationReason = reason;
                
                this.securityMetrics.sessionTerminated++;

                await this.auditLogger.logSecurityEvent('session_terminated', {
                    sessionId,
                    userId: session.userId,
                    reason,
                    timestamp: new Date()
                });

                // Remove from memory after audit
                setTimeout(() => {
                    this.sessionStore.delete(sessionId);
                }, 60000); // Keep for 1 minute for audit purposes
            }

            return true;
        } catch (error) {
            await this.auditLogger.logSecurityEvent('session_termination_error', {
                sessionId,
                error: error.message,
                timestamp: new Date()
            });
            return false;
        }
    }

    /**
     * Generate cryptographically secure token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('base64url');
    }

    /**
     * Encrypt sensitive data
     */
    async encryptData(data, keyId = 'default') {
        try {
            const key = await this.getEncryptionKey(keyId);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipher(this.options.encryptionAlgorithm, key);
            cipher.setAAD(Buffer.from(keyId, 'utf8'));
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            this.securityMetrics.encryptionOperations++;
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                keyId,
                algorithm: this.options.encryptionAlgorithm,
                timestamp: new Date()
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('encryption_error', {
                keyId,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Decrypt sensitive data
     */
    async decryptData(encryptedData) {
        try {
            const key = await this.getEncryptionKey(encryptedData.keyId);
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            
            const decipher = crypto.createDecipher(encryptedData.algorithm, key);
            decipher.setAAD(Buffer.from(encryptedData.keyId, 'utf8'));
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            await this.auditLogger.logSecurityEvent('decryption_error', {
                keyId: encryptedData.keyId,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Get or generate encryption key
     */
    async getEncryptionKey(keyId) {
        if (!this.encryptionKeys.has(keyId)) {
            const key = crypto.randomBytes(32); // 256-bit key
            this.encryptionKeys.set(keyId, key);
            
            await this.auditLogger.logSecurityEvent('encryption_key_generated', {
                keyId,
                timestamp: new Date()
            });
        }
        
        return this.encryptionKeys.get(keyId);
    }

    /**
     * Rotate encryption keys
     */
    async rotateEncryptionKey(keyId) {
        try {
            const oldKey = this.encryptionKeys.get(keyId);
            const newKey = crypto.randomBytes(32);
            
            this.encryptionKeys.set(keyId, newKey);
            
            await this.auditLogger.logSecurityEvent('encryption_key_rotated', {
                keyId,
                timestamp: new Date()
            });

            return {
                keyId,
                rotated: true,
                timestamp: new Date()
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('key_rotation_error', {
                keyId,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Track login attempts and implement lockout
     */
    async trackLoginAttempt(identifier, success, ipAddress, userAgent) {
        try {
            const key = `${identifier}:${ipAddress}`;
            const now = Date.now();
            
            if (!this.loginAttempts.has(key)) {
                this.loginAttempts.set(key, {
                    attempts: 0,
                    lastAttempt: now,
                    lockedUntil: null
                });
            }

            const attemptData = this.loginAttempts.get(key);

            if (success) {
                // Reset on successful login
                this.loginAttempts.delete(key);
                
                await this.auditLogger.logSecurityEvent('login_success', {
                    identifier,
                    ipAddress,
                    userAgent,
                    timestamp: new Date()
                });
                
                return { allowed: true, lockout: false };
            } else {
                // Check if currently locked out
                if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
                    const timeLeft = Math.ceil((attemptData.lockedUntil - now) / 1000);
                    
                    await this.auditLogger.logSecurityEvent('login_attempt_during_lockout', {
                        identifier,
                        ipAddress,
                        timeLeft,
                        timestamp: new Date()
                    });
                    
                    return { 
                        allowed: false, 
                        lockout: true, 
                        timeLeft,
                        reason: 'Account temporarily locked due to too many failed attempts'
                    };
                }

                // Increment failed attempts
                attemptData.attempts++;
                attemptData.lastAttempt = now;
                this.securityMetrics.failedLoginAttempts++;

                // Check if lockout threshold reached
                if (attemptData.attempts >= this.options.maxLoginAttempts) {
                    attemptData.lockedUntil = now + this.options.lockoutDuration;
                    
                    await this.auditLogger.logSecurityEvent('account_locked', {
                        identifier,
                        ipAddress,
                        attempts: attemptData.attempts,
                        lockedUntil: new Date(attemptData.lockedUntil),
                        timestamp: new Date()
                    });

                    // Trigger threat detection
                    await this.threatDetection.analyzeThreat({
                        type: 'brute_force_login',
                        source: ipAddress,
                        target: identifier,
                        attempts: attemptData.attempts,
                        timestamp: new Date()
                    });

                    return { 
                        allowed: false, 
                        lockout: true, 
                        timeLeft: Math.ceil(this.options.lockoutDuration / 1000),
                        reason: 'Account locked due to too many failed attempts'
                    };
                }

                await this.auditLogger.logSecurityEvent('login_failure', {
                    identifier,
                    ipAddress,
                    userAgent,
                    attempts: attemptData.attempts,
                    timestamp: new Date()
                });

                return { 
                    allowed: true, 
                    lockout: false, 
                    remainingAttempts: this.options.maxLoginAttempts - attemptData.attempts
                };
            }
        } catch (error) {
            await this.auditLogger.logSecurityEvent('login_tracking_error', {
                identifier,
                error: error.message,
                timestamp: new Date()
            });
            return { allowed: true, lockout: false }; // Fail open on error
        }
    }

    /**
     * Get comprehensive security status
     */
    async getSecurityStatus() {
        try {
            const currentTime = Date.now();
            const uptimeMs = currentTime - this.securityMetrics.uptime;
            
            // Get active sessions count
            const activeSessions = Array.from(this.sessionStore.values())
                .filter(s => s.isActive && new Date() <= s.expiresAt).length;

            // Get current threat level
            const threatLevel = await this.threatDetection.getCurrentThreatLevel();
            
            // Get compliance status
            const complianceStatus = await this.complianceChecker.getComplianceStatus();
            
            // Get recent security events
            const recentEvents = await this.auditLogger.getRecentEvents(100);

            return {
                status: 'operational',
                uptime: uptimeMs,
                uptimeFormatted: this.formatUptime(uptimeMs),
                metrics: {
                    ...this.securityMetrics,
                    activeSessions,
                    activeIncidents: this.activeSecurityIncidents.size,
                    lockedAccounts: Array.from(this.loginAttempts.values())
                        .filter(a => a.lockedUntil && Date.now() < a.lockedUntil).length
                },
                threatLevel,
                complianceStatus,
                recentEvents: recentEvents.slice(0, 20), // Last 20 events
                configuration: {
                    mfaRequired: this.options.mfaRequired,
                    sessionTimeout: this.options.sessionTimeout,
                    maxLoginAttempts: this.options.maxLoginAttempts,
                    encryptionAlgorithm: this.options.encryptionAlgorithm,
                    threatDetectionEnabled: this.options.threatDetectionEnabled
                },
                timestamp: new Date()
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('security_status_error', {
                error: error.message,
                timestamp: new Date()
            });
            
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Format uptime in human-readable format
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor((uptimeMs / 1000) % 60);
        const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
        const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
        
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    /**
     * Run security health check
     */
    async runSecurityHealthCheck() {
        try {
            const healthCheck = {
                timestamp: new Date(),
                status: 'healthy',
                checks: [],
                recommendations: [],
                criticalIssues: []
            };

            // Check encryption keys
            if (this.encryptionKeys.size === 0) {
                healthCheck.checks.push({
                    name: 'encryption_keys',
                    status: 'warning',
                    message: 'No encryption keys initialized'
                });
                healthCheck.recommendations.push('Initialize encryption keys');
            } else {
                healthCheck.checks.push({
                    name: 'encryption_keys',
                    status: 'pass',
                    message: `${this.encryptionKeys.size} encryption keys active`
                });
            }

            // Check session cleanup
            const expiredSessions = Array.from(this.sessionStore.values())
                .filter(s => new Date() > s.expiresAt);
            
            if (expiredSessions.length > 0) {
                healthCheck.checks.push({
                    name: 'session_cleanup',
                    status: 'warning',
                    message: `${expiredSessions.length} expired sessions need cleanup`
                });
                healthCheck.recommendations.push('Clean up expired sessions');
            } else {
                healthCheck.checks.push({
                    name: 'session_cleanup',
                    status: 'pass',
                    message: 'No expired sessions found'
                });
            }

            // Check threat detection
            const threatStatus = await this.threatDetection.getHealthStatus();
            healthCheck.checks.push({
                name: 'threat_detection',
                status: threatStatus.healthy ? 'pass' : 'critical',
                message: threatStatus.message
            });

            // Check compliance status
            const complianceStatus = await this.complianceChecker.getComplianceStatus();
            const failedCompliance = Object.values(complianceStatus)
                .filter(status => !status.compliant).length;
            
            if (failedCompliance > 0) {
                healthCheck.checks.push({
                    name: 'compliance',
                    status: 'critical',
                    message: `${failedCompliance} compliance failures detected`
                });
                healthCheck.criticalIssues.push('Compliance violations found');
            } else {
                healthCheck.checks.push({
                    name: 'compliance',
                    status: 'pass',
                    message: 'All compliance checks passing'
                });
            }

            // Determine overall status
            const criticalChecks = healthCheck.checks.filter(c => c.status === 'critical');
            const warningChecks = healthCheck.checks.filter(c => c.status === 'warning');
            
            if (criticalChecks.length > 0) {
                healthCheck.status = 'critical';
            } else if (warningChecks.length > 0) {
                healthCheck.status = 'warning';
            }

            await this.auditLogger.logSecurityEvent('security_health_check', {
                status: healthCheck.status,
                checks: healthCheck.checks.length,
                criticalIssues: healthCheck.criticalIssues.length,
                timestamp: new Date()
            });

            return healthCheck;
        } catch (error) {
            await this.auditLogger.logSecurityEvent('security_health_check_error', {
                error: error.message,
                timestamp: new Date()
            });
            
            return {
                timestamp: new Date(),
                status: 'error',
                error: error.message,
                checks: [],
                recommendations: ['Fix health check system'],
                criticalIssues: ['Health check system failure']
            };
        }
    }

    /**
     * Clean up expired sessions and login attempts
     */
    async performSecurityMaintenance() {
        try {
            let cleanedSessions = 0;
            let cleanedAttempts = 0;
            const now = Date.now();

            // Clean expired sessions
            for (const [sessionId, session] of this.sessionStore) {
                if (new Date() > session.expiresAt) {
                    this.sessionStore.delete(sessionId);
                    cleanedSessions++;
                }
            }

            // Clean expired login attempts
            for (const [key, attempt] of this.loginAttempts) {
                if (attempt.lockedUntil && now > attempt.lockedUntil) {
                    this.loginAttempts.delete(key);
                    cleanedAttempts++;
                }
            }

            // Rotate audit logs
            await this.auditLogger.rotateOldLogs();

            // Run compliance checks
            await this.complianceChecker.runScheduledChecks();

            await this.auditLogger.logSecurityEvent('security_maintenance', {
                cleanedSessions,
                cleanedAttempts,
                timestamp: new Date()
            });

            return {
                success: true,
                cleanedSessions,
                cleanedAttempts,
                timestamp: new Date()
            };
        } catch (error) {
            await this.auditLogger.logSecurityEvent('security_maintenance_error', {
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Get security metrics for monitoring
     */
    getSecurityMetrics() {
        return {
            ...this.securityMetrics,
            activeSessions: Array.from(this.sessionStore.values())
                .filter(s => s.isActive && new Date() <= s.expiresAt).length,
            activeIncidents: this.activeSecurityIncidents.size,
            encryptionKeysActive: this.encryptionKeys.size,
            lockedAccounts: Array.from(this.loginAttempts.values())
                .filter(a => a.lockedUntil && Date.now() < a.lockedUntil).length
        };
    }

    /**
     * Initialize security system
     */
    async initialize() {
        try {
            console.log('[SecurityHardening] Initializing security components...');
            
            // Initialize threat detection
            await this.threatDetection.initialize();
            
            // Initialize audit logger
            await this.auditLogger.initialize();
            
            // Initialize compliance checker
            await this.complianceChecker.initialize();
            
            // Generate default encryption key
            await this.getEncryptionKey('default');
            
            // Start security maintenance interval
            setInterval(async () => {
                try {
                    await this.performSecurityMaintenance();
                } catch (error) {
                    console.error('[SecurityHardening] Maintenance error:', error);
                }
            }, 3600000); // Every hour

            await this.auditLogger.logSecurityEvent('security_system_initialized', {
                components: ['threat_detection', 'audit_logger', 'compliance_checker'],
                timestamp: new Date()
            });

            console.log('[SecurityHardening] Security system initialized successfully');
            return true;
        } catch (error) {
            console.error('[SecurityHardening] Failed to initialize:', error);
            throw error;
        }
    }
}

export default SecurityHardeningService;
