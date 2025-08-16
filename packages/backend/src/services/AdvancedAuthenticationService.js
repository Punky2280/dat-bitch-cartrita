/**
 * Advanced Authentication Service
 * Enhanced multi-factor authentication with biometric support, adaptive authentication, and advanced OAuth2/SAML
 * @author Robbie Allen - Lead Architect  
 * @date August 16, 2025
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityHardeningService from './SecurityHardeningService.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';

class AdvancedAuthenticationService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Multi-Factor Authentication
            mfaEnabled: true,
            mfaMethods: ['totp', 'sms', 'email', 'webauthn'],
            backupCodesCount: 10,
            
            // Biometric Authentication
            biometricEnabled: true,
            webauthnRpName: 'Cartrita AI OS',
            webauthnRpId: process.env.WEBAUTHN_RP_ID || 'localhost',
            webauthnOrigin: process.env.WEBAUTHN_ORIGIN || 'https://localhost:3000',
            
            // Adaptive Authentication
            adaptiveAuthEnabled: true,
            riskThresholds: {
                low: 0.3,
                medium: 0.6,
                high: 0.8,
                critical: 0.95
            },
            
            // Session Management
            sessionTimeout: 3600000, // 1 hour
            rememberMeDuration: 2592000000, // 30 days
            concurrentSessions: 5,
            
            // Password Policies
            passwordMinLength: 12,
            passwordComplexity: true,
            passwordHistory: 12,
            passwordExpiry: 7776000000, // 90 days
            
            // Rate Limiting
            maxLoginAttempts: 5,
            lockoutDuration: 900000, // 15 minutes
            
            // OAuth/SAML
            oauthProviders: ['google', 'microsoft', 'github', 'okta'],
            samlEnabled: true,
            
            ...options
        };

        // Initialize services
        this.securityService = new SecurityHardeningService();
        this.auditLogger = new SecurityAuditLogger();
        
        // Authentication state
        this.activeSessions = new Map();
        this.loginAttempts = new Map();
        this.mfaSecrets = new Map();
        this.biometricCredentials = new Map();
        this.riskProfiles = new Map();
        this.passwordHistory = new Map();
        
        // OAuth clients
        this.oauthClients = this.initializeOAuthClients();
        
        // WebAuthn configuration
        this.webauthnConfig = {
            rpName: this.options.webauthnRpName,
            rpID: this.options.webauthnRpId,
            origin: this.options.webauthnOrigin,
            timeout: 60000,
            userVerification: 'preferred',
            authenticatorAttachment: 'platform' // Prefer platform authenticators
        };
        
        console.log('[AdvancedAuth] Advanced Authentication Service initialized');
    }

    /**
     * Initialize OAuth clients
     */
    initializeOAuthClients() {
        const clients = {};
        
        if (process.env.GOOGLE_CLIENT_ID) {
            clients.google = new OAuth2Client({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: process.env.GOOGLE_REDIRECT_URI
            });
        }
        
        // Add other OAuth providers as needed
        
        return clients;
    }

    /**
     * Enhanced user authentication with adaptive risk assessment
     */
    async authenticateUser(credentials, context = {}) {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.authenticate_user');
        
        try {
            const {
                email,
                password,
                mfaToken,
                biometricData,
                deviceFingerprint,
                ipAddress,
                userAgent
            } = credentials;

            // Step 1: Basic credential validation
            const user = await this.validateCredentials(email, password);
            if (!user) {
                await this.handleFailedLogin(email, ipAddress, 'invalid_credentials');
                throw new Error('Invalid credentials');
            }

            // Step 2: Risk assessment
            const riskScore = await this.assessAuthenticationRisk(user, {
                ipAddress,
                userAgent,
                deviceFingerprint,
                timestamp: Date.now()
            });

            // Step 3: Adaptive authentication based on risk
            const authRequirements = this.determineAuthRequirements(riskScore);
            
            // Step 4: Multi-factor authentication if required
            if (authRequirements.mfaRequired) {
                if (!mfaToken && !biometricData) {
                    return {
                        success: false,
                        requiresMFA: true,
                        availableMethods: await this.getAvailableMFAMethods(user.id),
                        riskScore
                    };
                }

                if (mfaToken) {
                    const mfaValid = await this.verifyMFA(user.id, mfaToken);
                    if (!mfaValid) {
                        await this.handleFailedLogin(email, ipAddress, 'invalid_mfa');
                        throw new Error('Invalid MFA token');
                    }
                }

                if (biometricData && authRequirements.biometricRequired) {
                    const biometricValid = await this.verifyBiometric(user.id, biometricData);
                    if (!biometricValid) {
                        await this.handleFailedLogin(email, ipAddress, 'invalid_biometric');
                        throw new Error('Biometric verification failed');
                    }
                }
            }

            // Step 5: Create authenticated session
            const session = await this.createSession(user, {
                riskScore,
                ipAddress,
                userAgent,
                deviceFingerprint,
                authMethod: this.getAuthMethodUsed(credentials)
            });

            // Step 6: Update user's risk profile
            await this.updateRiskProfile(user.id, riskScore, 'successful_login');

            // Step 7: Audit logging
            await this.auditLogger.logSecurityEvent('user_authenticated', {
                userId: user.id,
                email: user.email,
                riskScore,
                authMethod: session.authMethod,
                ipAddress,
                userAgent
            });

            span.setAttributes({
                'auth.user_id': user.id,
                'auth.risk_score': riskScore,
                'auth.mfa_required': authRequirements.mfaRequired,
                'auth.session_id': session.id
            });

            return {
                success: true,
                user,
                session,
                riskScore,
                token: session.token
            };

        } catch (error) {
            console.error('[AdvancedAuth] Authentication error:', error);
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Risk-based authentication assessment
     */
    async assessAuthenticationRisk(user, context) {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.assess_risk');
        
        try {
            let riskScore = 0;
            const factors = [];

            // Factor 1: Location analysis
            const locationRisk = await this.analyzeLocationRisk(user.id, context.ipAddress);
            riskScore += locationRisk * 0.25;
            factors.push({ factor: 'location', risk: locationRisk });

            // Factor 2: Device fingerprinting
            const deviceRisk = await this.analyzeDeviceRisk(user.id, context.deviceFingerprint);
            riskScore += deviceRisk * 0.20;
            factors.push({ factor: 'device', risk: deviceRisk });

            // Factor 3: Behavioral patterns
            const behaviorRisk = await this.analyzeBehaviorRisk(user.id, context);
            riskScore += behaviorRisk * 0.25;
            factors.push({ factor: 'behavior', risk: behaviorRisk });

            // Factor 4: Time-based analysis
            const timeRisk = await this.analyzeTimeRisk(user.id, context.timestamp);
            riskScore += timeRisk * 0.15;
            factors.push({ factor: 'time', risk: timeRisk });

            // Factor 5: Account security posture
            const accountRisk = await this.analyzeAccountRisk(user.id);
            riskScore += accountRisk * 0.15;
            factors.push({ factor: 'account', risk: accountRisk });

            // Normalize risk score to 0-1
            riskScore = Math.min(Math.max(riskScore, 0), 1);

            span.setAttributes({
                'auth.risk.score': riskScore,
                'auth.risk.location': locationRisk,
                'auth.risk.device': deviceRisk,
                'auth.risk.behavior': behaviorRisk,
                'auth.risk.time': timeRisk,
                'auth.risk.account': accountRisk
            });

            return {
                score: riskScore,
                level: this.getRiskLevel(riskScore),
                factors
            };

        } catch (error) {
            console.error('[AdvancedAuth] Risk assessment error:', error);
            span.recordException(error);
            return { score: 1.0, level: 'critical', factors: [] }; // Fail secure
        } finally {
            span.end();
        }
    }

    /**
     * Determine authentication requirements based on risk
     */
    determineAuthRequirements(riskAssessment) {
        const riskScore = riskAssessment.score;
        const { low, medium, high, critical } = this.options.riskThresholds;

        if (riskScore >= critical) {
            return {
                mfaRequired: true,
                biometricRequired: true,
                additionalVerification: true,
                sessionTimeout: 900000 // 15 minutes
            };
        } else if (riskScore >= high) {
            return {
                mfaRequired: true,
                biometricRequired: false,
                additionalVerification: false,
                sessionTimeout: 1800000 // 30 minutes
            };
        } else if (riskScore >= medium) {
            return {
                mfaRequired: true,
                biometricRequired: false,
                additionalVerification: false,
                sessionTimeout: 3600000 // 1 hour
            };
        } else {
            return {
                mfaRequired: false,
                biometricRequired: false,
                additionalVerification: false,
                sessionTimeout: this.options.sessionTimeout
            };
        }
    }

    /**
     * WebAuthn (Biometric) Registration
     */
    async registerBiometric(userId, deviceName = 'Unknown Device') {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.register_biometric');
        
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Generate registration options
            const registrationOptions = {
                challenge: crypto.randomBytes(32).toString('base64url'),
                rp: {
                    name: this.webauthnConfig.rpName,
                    id: this.webauthnConfig.rpID
                },
                user: {
                    id: Buffer.from(userId.toString()).toString('base64url'),
                    name: user.email,
                    displayName: user.name || user.email
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' }, // ES256
                    { alg: -257, type: 'public-key' } // RS256
                ],
                attestation: 'direct',
                timeout: this.webauthnConfig.timeout,
                authenticatorSelection: {
                    authenticatorAttachment: this.webauthnConfig.authenticatorAttachment,
                    userVerification: this.webauthnConfig.userVerification
                }
            };

            // Store registration challenge temporarily
            const challengeKey = `webauthn_challenge_${userId}`;
            await this.storeTemporaryData(challengeKey, registrationOptions.challenge, 300000); // 5 minutes

            await this.auditLogger.logSecurityEvent('biometric_registration_initiated', {
                userId,
                deviceName,
                challenge: registrationOptions.challenge
            });

            span.setAttributes({
                'auth.biometric.user_id': userId,
                'auth.biometric.device_name': deviceName
            });

            return {
                success: true,
                registrationOptions
            };

        } catch (error) {
            console.error('[AdvancedAuth] Biometric registration error:', error);
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Complete WebAuthn registration
     */
    async completeBiometricRegistration(userId, registrationResponse, deviceName) {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.complete_biometric_registration');
        
        try {
            // Verify the registration response
            // In a real implementation, you'd use a WebAuthn library like @simplewebauthn/server
            
            const credentialId = registrationResponse.id;
            const publicKey = registrationResponse.response.publicKey;
            
            // Store the biometric credential
            if (!this.biometricCredentials.has(userId)) {
                this.biometricCredentials.set(userId, []);
            }
            
            this.biometricCredentials.get(userId).push({
                credentialId,
                publicKey,
                deviceName,
                registeredAt: new Date().toISOString(),
                lastUsed: null
            });

            await this.auditLogger.logSecurityEvent('biometric_registration_completed', {
                userId,
                credentialId,
                deviceName
            });

            span.setAttributes({
                'auth.biometric.user_id': userId,
                'auth.biometric.credential_id': credentialId
            });

            return {
                success: true,
                credentialId,
                message: 'Biometric authentication registered successfully'
            };

        } catch (error) {
            console.error('[AdvancedAuth] Complete biometric registration error:', error);
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Verify biometric authentication
     */
    async verifyBiometric(userId, biometricData) {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.verify_biometric');
        
        try {
            const userCredentials = this.biometricCredentials.get(userId);
            if (!userCredentials || userCredentials.length === 0) {
                return false;
            }

            // In a real implementation, you'd verify the WebAuthn assertion
            // This is a simplified version
            const isValid = await this.verifyWebAuthnAssertion(biometricData, userCredentials);

            if (isValid) {
                // Update last used timestamp
                const credential = userCredentials.find(c => c.credentialId === biometricData.id);
                if (credential) {
                    credential.lastUsed = new Date().toISOString();
                }

                await this.auditLogger.logSecurityEvent('biometric_verification_success', {
                    userId,
                    credentialId: biometricData.id
                });
            } else {
                await this.auditLogger.logSecurityEvent('biometric_verification_failed', {
                    userId,
                    credentialId: biometricData.id
                });
            }

            span.setAttributes({
                'auth.biometric.user_id': userId,
                'auth.biometric.valid': isValid
            });

            return isValid;

        } catch (error) {
            console.error('[AdvancedAuth] Biometric verification error:', error);
            span.recordException(error);
            return false;
        } finally {
            span.end();
        }
    }

    /**
     * Enhanced MFA setup with multiple methods
     */
    async setupMFA(userId, method = 'totp', options = {}) {
        const span = OpenTelemetryTracing.tracer.startSpan('auth.setup_mfa');
        
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let result = {};

            switch (method) {
                case 'totp':
                    result = await this.setupTOTP(userId, user.email);
                    break;
                case 'sms':
                    result = await this.setupSMS(userId, options.phoneNumber);
                    break;
                case 'email':
                    result = await this.setupEmailMFA(userId);
                    break;
                case 'webauthn':
                    result = await this.registerBiometric(userId, options.deviceName);
                    break;
                default:
                    throw new Error(`Unsupported MFA method: ${method}`);
            }

            await this.auditLogger.logSecurityEvent('mfa_setup_completed', {
                userId,
                method,
                success: result.success
            });

            span.setAttributes({
                'auth.mfa.user_id': userId,
                'auth.mfa.method': method,
                'auth.mfa.success': result.success
            });

            return result;

        } catch (error) {
            console.error('[AdvancedAuth] MFA setup error:', error);
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Setup TOTP (Time-based One-Time Password)
     */
    async setupTOTP(userId, email) {
        const secret = speakeasy.generateSecret({
            name: `Cartrita AI OS (${email})`,
            issuer: 'Cartrita AI OS',
            length: 32
        });

        const backupCodes = Array.from({ length: this.options.backupCodesCount }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );

        this.mfaSecrets.set(userId, {
            tempSecret: secret.base32,
            secret: null,
            verified: false,
            backupCodes,
            method: 'totp',
            createdAt: new Date().toISOString()
        });

        const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

        return {
            success: true,
            secret: secret.base32,
            qrCode: qrCodeDataURL,
            backupCodes,
            manualEntryKey: secret.base32
        };
    }

    /**
     * Analyze location-based risk
     */
    async analyzeLocationRisk(userId, ipAddress) {
        // This would typically use GeoIP services
        // For now, return a mock risk score
        return Math.random() * 0.3; // Low risk for location changes
    }

    /**
     * Analyze device fingerprint risk
     */
    async analyzeDeviceRisk(userId, deviceFingerprint) {
        // This would analyze device characteristics
        // For now, return a mock risk score
        return Math.random() * 0.4; // Medium risk for unknown devices
    }

    /**
     * Analyze behavioral patterns
     */
    async analyzeBehaviorRisk(userId, context) {
        // This would analyze user behavior patterns
        // For now, return a mock risk score
        return Math.random() * 0.2; // Low risk for behavior changes
    }

    /**
     * Analyze time-based patterns
     */
    async analyzeTimeRisk(userId, timestamp) {
        // This would analyze login time patterns
        // For now, return a mock risk score
        return Math.random() * 0.1; // Very low risk for time
    }

    /**
     * Analyze account security posture
     */
    async analyzeAccountRisk(userId) {
        // This would analyze account security settings
        // For now, return a mock risk score
        return Math.random() * 0.3; // Low risk
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        const { low, medium, high, critical } = this.options.riskThresholds;
        
        if (score >= critical) return 'critical';
        if (score >= high) return 'high';
        if (score >= medium) return 'medium';
        return 'low';
    }

    /**
     * Create authenticated session
     */
    async createSession(user, context) {
        const sessionId = crypto.randomUUID();
        const token = jwt.sign(
            { 
                userId: user.id, 
                sessionId,
                riskScore: context.riskScore 
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const session = {
            id: sessionId,
            userId: user.id,
            token,
            riskScore: context.riskScore,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceFingerprint: context.deviceFingerprint,
            authMethod: context.authMethod
        };

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Helper methods
     */
    async validateCredentials(email, password) {
        // Mock user validation - replace with actual database query
        return { id: 1, email, name: 'Test User' };
    }

    async getUserById(userId) {
        // Mock user lookup - replace with actual database query
        return { id: userId, email: 'test@example.com', name: 'Test User' };
    }

    async getAvailableMFAMethods(userId) {
        return this.options.mfaMethods;
    }

    async verifyMFA(userId, token) {
        const mfaData = this.mfaSecrets.get(userId);
        if (!mfaData) return false;

        return speakeasy.totp.verify({
            secret: mfaData.secret || mfaData.tempSecret,
            encoding: 'base32',
            token,
            window: 2
        });
    }

    getAuthMethodUsed(credentials) {
        if (credentials.biometricData) return 'biometric';
        if (credentials.mfaToken) return 'mfa';
        return 'password';
    }

    async verifyWebAuthnAssertion(biometricData, userCredentials) {
        // Mock WebAuthn verification - replace with actual library
        return Math.random() > 0.1; // 90% success rate for testing
    }

    async storeTemporaryData(key, data, ttl) {
        // Mock temporary storage - replace with Redis or similar
        setTimeout(() => {
            // Cleanup after TTL
        }, ttl);
    }

    async handleFailedLogin(email, ipAddress, reason) {
        await this.auditLogger.logSecurityEvent('login_failed', {
            email,
            ipAddress,
            reason,
            timestamp: new Date().toISOString()
        });
    }

    async updateRiskProfile(userId, riskScore, event) {
        const profile = this.riskProfiles.get(userId) || {
            userId,
            baselineRisk: 0.1,
            recentEvents: []
        };

        profile.recentEvents.push({
            event,
            riskScore,
            timestamp: new Date().toISOString()
        });

        // Keep only last 100 events
        if (profile.recentEvents.length > 100) {
            profile.recentEvents = profile.recentEvents.slice(-100);
        }

        this.riskProfiles.set(userId, profile);
    }

    async setupSMS(userId, phoneNumber) {
        // Mock SMS setup - implement with SMS service
        return {
            success: true,
            phoneNumber: phoneNumber?.replace(/\d(?=\d{4})/g, '*'),
            message: 'SMS verification setup completed'
        };
    }

    async setupEmailMFA(userId) {
        // Mock email MFA setup
        return {
            success: true,
            message: 'Email verification setup completed'
        };
    }
}

export default AdvancedAuthenticationService;
