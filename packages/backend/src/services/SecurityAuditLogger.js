/**
 * Security Audit Logger
 * Comprehensive audit logging with tamper protection and secure storage
 * @author Robbie Allen - Lead Architect
 * @date August 2025
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class SecurityAuditLogger extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            logDirectory: process.env.NODE_ENV === 'development' ? '/tmp/cartrita-security-logs' : './logs/security',
            maxLogSize: 100 * 1024 * 1024, // 100MB
            maxLogFiles: 50,
            retention: 2592000000, // 30 days
            encryption: process.env.NODE_ENV === 'production',
            tamperProtection: process.env.NODE_ENV === 'production',
            realTimeAlerts: true,
            compressionEnabled: true,
            backupEnabled: true,
            ...options
        };

        // Audit state
        this.currentLogFile = null;
        this.logBuffer = [];
        this.bufferSize = 0;
        this.maxBufferSize = 1000; // Max events in buffer
        this.flushInterval = 5000; // 5 seconds
        this.encryptionKey = null;
        this.logMetrics = this.initializeLogMetrics();
        this.alertThresholds = this.initializeAlertThresholds();
        
        // Tamper protection
        this.integrityHashes = new Map();
        this.lastIntegrityCheck = null;
        
        console.log('[SecurityAudit] Security Audit Logger initialized');
    }

    /**
     * Initialize logging metrics
     */
    initializeLogMetrics() {
        return {
            totalEvents: 0,
            eventsPerSeverity: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            },
            filesCreated: 0,
            filesRotated: 0,
            encryptedEvents: 0,
            tamperAttempts: 0,
            alertsTriggered: 0,
            bufferFlushes: 0,
            compressionRatio: 1.0,
            lastLogTime: null,
            integrityChecks: 0
        };
    }

    /**
     * Initialize alert thresholds
     */
    initializeAlertThresholds() {
        return {
            criticalEventsPerMinute: 5,
            failedLoginsPerMinute: 10,
            securityViolationsPerHour: 20,
            tamperAttemptsPerHour: 1,
            diskSpaceThreshold: 0.9, // 90% full
            bufferOverflowThreshold: 0.8 // 80% buffer full
        };
    }

    /**
     * Log security event with metadata and tamper protection
     */
    async logSecurityEvent(eventType, eventData, severity = 'info') {
        try {
            const timestamp = new Date();
            const eventId = crypto.randomUUID();
            
            const auditEvent = {
                eventId,
                eventType,
                severity,
                timestamp: timestamp.toISOString(),
                data: eventData,
                metadata: {
                    source: 'security_system',
                    hostname: process.env.HOSTNAME || 'unknown',
                    pid: process.pid,
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                }
            };

            // Add stack trace for critical events
            if (severity === 'critical') {
                auditEvent.metadata.stackTrace = new Error().stack;
            }

            // Encrypt sensitive data if enabled
            if (this.options.encryption) {
                auditEvent.encrypted = true;
                auditEvent.data = await this.encryptEventData(auditEvent.data);
                this.logMetrics.encryptedEvents++;
            }

            // Add integrity hash for tamper protection
            if (this.options.tamperProtection) {
                auditEvent.integrityHash = await this.generateIntegrityHash(auditEvent);
            }

            // Add to buffer
            this.logBuffer.push(auditEvent);
            this.bufferSize++;
            
            // Update metrics
            this.logMetrics.totalEvents++;
            this.logMetrics.eventsPerSeverity[severity]++;
            this.logMetrics.lastLogTime = timestamp;

            // Check for immediate flush conditions
            if (severity === 'critical' || this.bufferSize >= this.maxBufferSize) {
                await this.flushBuffer();
            }

            // Check alert thresholds
            if (this.options.realTimeAlerts) {
                await this.checkAlertThresholds(auditEvent);
            }

            // Emit event for real-time monitoring
            this.emit('securityEvent', auditEvent);

            return eventId;
        } catch (error) {
            console.error('[SecurityAudit] Failed to log security event:', error);
            // Fallback - write directly to console to ensure event is not lost
            console.log(`[SECURITY_AUDIT_FALLBACK] ${eventType}:`, JSON.stringify(eventData));
            return null;
        }
    }

    /**
     * Encrypt event data
     */
    async encryptEventData(data) {
        try {
            if (!this.encryptionKey) {
                this.encryptionKey = crypto.randomBytes(32);
            }

            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();

            return {
                encryptedData: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                algorithm: 'aes-256-gcm'
            };
        } catch (error) {
            console.error('[SecurityAudit] Encryption error:', error);
            return data; // Return unencrypted data as fallback
        }
    }

    /**
     * Decrypt event data
     */
    async decryptEventData(encryptedEvent) {
        try {
            if (!encryptedEvent.encryptedData || !this.encryptionKey) {
                return encryptedEvent;
            }

            const iv = Buffer.from(encryptedEvent.iv, 'hex');
            const authTag = Buffer.from(encryptedEvent.authTag, 'hex');
            
            const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedEvent.encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('[SecurityAudit] Decryption error:', error);
            return encryptedEvent; // Return encrypted data if decryption fails
        }
    }

    /**
     * Generate integrity hash for tamper protection
     */
    async generateIntegrityHash(auditEvent) {
        try {
            const eventString = JSON.stringify({
                eventId: auditEvent.eventId,
                eventType: auditEvent.eventType,
                timestamp: auditEvent.timestamp,
                data: auditEvent.data
            });
            
            return crypto.createHash('sha256').update(eventString).digest('hex');
        } catch (error) {
            console.error('[SecurityAudit] Integrity hash generation error:', error);
            return null;
        }
    }

    /**
     * Verify event integrity
     */
    async verifyEventIntegrity(auditEvent) {
        try {
            if (!auditEvent.integrityHash) {
                return { valid: false, reason: 'no_hash' };
            }

            const expectedHash = await this.generateIntegrityHash(auditEvent);
            const isValid = auditEvent.integrityHash === expectedHash;

            if (!isValid) {
                this.logMetrics.tamperAttempts++;
                await this.logSecurityEvent('integrity_violation', {
                    eventId: auditEvent.eventId,
                    expectedHash,
                    actualHash: auditEvent.integrityHash,
                    timestamp: new Date()
                }, 'critical');
            }

            return { valid: isValid, expectedHash, actualHash: auditEvent.integrityHash };
        } catch (error) {
            console.error('[SecurityAudit] Integrity verification error:', error);
            return { valid: false, reason: 'verification_error', error: error.message };
        }
    }

    /**
     * Flush buffer to log file
     */
    async flushBuffer() {
        try {
            if (this.logBuffer.length === 0) {
                return;
            }

            // Ensure log directory exists
            await this.ensureLogDirectory();

            // Get current log file
            const logFile = await this.getCurrentLogFile();

            // Prepare log entries
            const logEntries = this.logBuffer.map(event => JSON.stringify(event)).join('\n') + '\n';

            // Write to file
            await fs.appendFile(logFile, logEntries, 'utf8');

            // Update file integrity hash
            if (this.options.tamperProtection) {
                await this.updateFileIntegrityHash(logFile);
            }

            // Clear buffer
            const flushedCount = this.logBuffer.length;
            this.logBuffer = [];
            this.bufferSize = 0;
            this.logMetrics.bufferFlushes++;

            console.log(`[SecurityAudit] Flushed ${flushedCount} events to ${logFile}`);

            // Check if log rotation is needed
            await this.checkLogRotation(logFile);

        } catch (error) {
            console.error('[SecurityAudit] Buffer flush error:', error);
            // Don't clear buffer on error to prevent data loss
        }
    }

    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            await fs.mkdir(this.options.logDirectory, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Get current log file path
     */
    async getCurrentLogFile() {
        try {
            if (!this.currentLogFile) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.currentLogFile = path.join(
                    this.options.logDirectory,
                    `security-audit-${timestamp}.log`
                );
                this.logMetrics.filesCreated++;
            }

            return this.currentLogFile;
        } catch (error) {
            console.error('[SecurityAudit] Log file path error:', error);
            throw error;
        }
    }

    /**
     * Check if log rotation is needed
     */
    async checkLogRotation(logFile) {
        try {
            const stats = await fs.stat(logFile);
            
            if (stats.size >= this.options.maxLogSize) {
                await this.rotateLogFile(logFile);
            }
        } catch (error) {
            console.error('[SecurityAudit] Log rotation check error:', error);
        }
    }

    /**
     * Rotate log file
     */
    async rotateLogFile(logFile) {
        try {
            // Compress current log if enabled
            if (this.options.compressionEnabled) {
                await this.compressLogFile(logFile);
            }

            // Reset current log file
            this.currentLogFile = null;
            this.logMetrics.filesRotated++;

            console.log(`[SecurityAudit] Rotated log file: ${logFile}`);

            // Clean up old log files
            await this.cleanupOldLogs();

        } catch (error) {
            console.error('[SecurityAudit] Log rotation error:', error);
        }
    }

    /**
     * Compress log file
     */
    async compressLogFile(logFile) {
        try {
            const { createGzip } = await import('zlib');
            const { createReadStream, createWriteStream } = await import('fs');
            const { pipeline } = await import('stream/promises');

            const compressedFile = `${logFile}.gz`;
            const readStream = createReadStream(logFile);
            const writeStream = createWriteStream(compressedFile);
            const gzip = createGzip();

            await pipeline(readStream, gzip, writeStream);

            // Delete original file
            await fs.unlink(logFile);

            // Update compression ratio metric
            const originalStats = await fs.stat(logFile).catch(() => ({ size: 0 }));
            const compressedStats = await fs.stat(compressedFile);
            
            if (originalStats.size > 0) {
                this.logMetrics.compressionRatio = compressedStats.size / originalStats.size;
            }

            console.log(`[SecurityAudit] Compressed log file: ${logFile} -> ${compressedFile}`);
        } catch (error) {
            console.error('[SecurityAudit] Log compression error:', error);
        }
    }

    /**
     * Clean up old log files
     */
    async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.options.logDirectory);
            const logFiles = files
                .filter(file => file.startsWith('security-audit-'))
                .map(file => ({
                    name: file,
                    path: path.join(this.options.logDirectory, file),
                    stat: null
                }));

            // Get file stats
            for (const file of logFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    console.warn(`[SecurityAudit] Failed to stat file ${file.path}:`, error);
                }
            }

            // Filter files with stats and sort by creation time
            const validFiles = logFiles
                .filter(file => file.stat)
                .sort((a, b) => b.stat.ctime - a.stat.ctime);

            // Remove files exceeding max count
            if (validFiles.length > this.options.maxLogFiles) {
                const filesToRemove = validFiles.slice(this.options.maxLogFiles);
                
                for (const file of filesToRemove) {
                    await fs.unlink(file.path);
                    console.log(`[SecurityAudit] Removed old log file: ${file.name}`);
                }
            }

            // Remove files exceeding retention period
            const cutoffTime = Date.now() - this.options.retention;
            const expiredFiles = validFiles.filter(file => file.stat.ctime.getTime() < cutoffTime);
            
            for (const file of expiredFiles) {
                await fs.unlink(file.path);
                console.log(`[SecurityAudit] Removed expired log file: ${file.name}`);
            }

        } catch (error) {
            console.error('[SecurityAudit] Log cleanup error:', error);
        }
    }

    /**
     * Update file integrity hash
     */
    async updateFileIntegrityHash(logFile) {
        try {
            const content = await fs.readFile(logFile, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            
            this.integrityHashes.set(logFile, hash);
            
            // Store hash in separate file for verification
            const hashFile = `${logFile}.hash`;
            await fs.writeFile(hashFile, hash, 'utf8');
            
        } catch (error) {
            console.error('[SecurityAudit] File integrity hash update error:', error);
        }
    }

    /**
     * Verify file integrity
     */
    async verifyFileIntegrity(logFile) {
        try {
            const content = await fs.readFile(logFile, 'utf8');
            const currentHash = crypto.createHash('sha256').update(content).digest('hex');
            
            // Check against stored hash
            const hashFile = `${logFile}.hash`;
            const storedHash = await fs.readFile(hashFile, 'utf8').catch(() => null);
            
            if (!storedHash) {
                return { valid: false, reason: 'no_stored_hash' };
            }

            const isValid = currentHash === storedHash.trim();
            
            if (!isValid) {
                this.logMetrics.tamperAttempts++;
                await this.logSecurityEvent('file_tampering_detected', {
                    file: logFile,
                    expectedHash: storedHash.trim(),
                    actualHash: currentHash,
                    timestamp: new Date()
                }, 'critical');
            }

            this.logMetrics.integrityChecks++;
            
            return { valid: isValid, expectedHash: storedHash.trim(), actualHash: currentHash };
        } catch (error) {
            console.error('[SecurityAudit] File integrity verification error:', error);
            return { valid: false, reason: 'verification_error', error: error.message };
        }
    }

    /**
     * Check alert thresholds
     */
    async checkAlertThresholds(auditEvent) {
        try {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            const oneHourAgo = now - 3600000;

            // Critical events per minute
            if (auditEvent.severity === 'critical') {
                const recentCriticalEvents = this.logBuffer
                    .concat([auditEvent])
                    .filter(event => 
                        event.severity === 'critical' &&
                        new Date(event.timestamp).getTime() > oneMinuteAgo
                    ).length;

                if (recentCriticalEvents >= this.alertThresholds.criticalEventsPerMinute) {
                    await this.triggerAlert('critical_events_threshold_exceeded', {
                        threshold: this.alertThresholds.criticalEventsPerMinute,
                        actual: recentCriticalEvents,
                        timeWindow: '1 minute'
                    });
                }
            }

            // Failed logins per minute
            if (auditEvent.eventType === 'login_failure') {
                const recentFailedLogins = this.logBuffer
                    .concat([auditEvent])
                    .filter(event => 
                        event.eventType === 'login_failure' &&
                        new Date(event.timestamp).getTime() > oneMinuteAgo
                    ).length;

                if (recentFailedLogins >= this.alertThresholds.failedLoginsPerMinute) {
                    await this.triggerAlert('failed_logins_threshold_exceeded', {
                        threshold: this.alertThresholds.failedLoginsPerMinute,
                        actual: recentFailedLogins,
                        timeWindow: '1 minute'
                    });
                }
            }

            // Buffer overflow check
            const bufferUsage = this.bufferSize / this.maxBufferSize;
            if (bufferUsage >= this.alertThresholds.bufferOverflowThreshold) {
                await this.triggerAlert('buffer_overflow_warning', {
                    bufferUsage: Math.round(bufferUsage * 100),
                    threshold: Math.round(this.alertThresholds.bufferOverflowThreshold * 100)
                });
            }

        } catch (error) {
            console.error('[SecurityAudit] Alert threshold check error:', error);
        }
    }

    /**
     * Trigger security alert
     */
    async triggerAlert(alertType, alertData) {
        try {
            const alert = {
                alertId: crypto.randomUUID(),
                alertType,
                timestamp: new Date().toISOString(),
                data: alertData,
                severity: 'high'
            };

            this.logMetrics.alertsTriggered++;

            // Log the alert
            await this.logSecurityEvent('security_alert', alert, 'high');

            // Emit alert event
            this.emit('securityAlert', alert);

            console.warn(`[SecurityAudit] SECURITY ALERT: ${alertType}`, alertData);

        } catch (error) {
            console.error('[SecurityAudit] Alert trigger error:', error);
        }
    }

    /**
     * Get recent security events
     */
    async getRecentEvents(limit = 100, severity = null) {
        try {
            let events = [...this.logBuffer];

            // Filter by severity if specified
            if (severity) {
                events = events.filter(event => event.severity === severity);
            }

            // Sort by timestamp (most recent first)
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Limit results
            events = events.slice(0, limit);

            // Decrypt encrypted events
            for (const event of events) {
                if (event.encrypted && event.data.encryptedData) {
                    event.data = await this.decryptEventData(event.data);
                }
            }

            return events;
        } catch (error) {
            console.error('[SecurityAudit] Get recent events error:', error);
            return [];
        }
    }

    /**
     * Search audit logs
     */
    async searchAuditLogs(criteria) {
        try {
            const {
                eventType,
                severity,
                startTime,
                endTime,
                userId,
                ipAddress,
                limit = 100
            } = criteria;

            let results = [...this.logBuffer];

            // Apply filters
            if (eventType) {
                results = results.filter(event => event.eventType === eventType);
            }

            if (severity) {
                results = results.filter(event => event.severity === severity);
            }

            if (startTime) {
                const start = new Date(startTime);
                results = results.filter(event => new Date(event.timestamp) >= start);
            }

            if (endTime) {
                const end = new Date(endTime);
                results = results.filter(event => new Date(event.timestamp) <= end);
            }

            if (userId) {
                results = results.filter(event => 
                    event.data.userId === userId ||
                    event.metadata?.userId === userId
                );
            }

            if (ipAddress) {
                results = results.filter(event => 
                    event.data.ipAddress === ipAddress ||
                    event.metadata?.ipAddress === ipAddress
                );
            }

            // Sort by timestamp (most recent first)
            results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Limit results
            results = results.slice(0, limit);

            // Decrypt encrypted events
            for (const event of results) {
                if (event.encrypted && event.data.encryptedData) {
                    event.data = await this.decryptEventData(event.data);
                }
            }

            return results;
        } catch (error) {
            console.error('[SecurityAudit] Audit log search error:', error);
            return [];
        }
    }

    /**
     * Run integrity check on all log files
     */
    async runIntegrityCheck() {
        try {
            const results = {
                timestamp: new Date(),
                filesChecked: 0,
                integrityViolations: 0,
                results: []
            };

            const files = await fs.readdir(this.options.logDirectory);
            const logFiles = files.filter(file => 
                file.startsWith('security-audit-') && 
                file.endsWith('.log')
            );

            for (const file of logFiles) {
                const filePath = path.join(this.options.logDirectory, file);
                const verification = await this.verifyFileIntegrity(filePath);
                
                results.filesChecked++;
                
                if (!verification.valid) {
                    results.integrityViolations++;
                }
                
                results.results.push({
                    file,
                    valid: verification.valid,
                    reason: verification.reason,
                    expectedHash: verification.expectedHash,
                    actualHash: verification.actualHash
                });
            }

            this.lastIntegrityCheck = new Date();

            if (results.integrityViolations > 0) {
                await this.logSecurityEvent('integrity_check_violations', results, 'critical');
            } else {
                await this.logSecurityEvent('integrity_check_completed', results, 'info');
            }

            return results;
        } catch (error) {
            console.error('[SecurityAudit] Integrity check error:', error);
            return {
                timestamp: new Date(),
                error: error.message,
                filesChecked: 0,
                integrityViolations: 0,
                results: []
            };
        }
    }

    /**
     * Get audit logger statistics
     */
    getStatistics() {
        return {
            ...this.logMetrics,
            bufferSize: this.bufferSize,
            maxBufferSize: this.maxBufferSize,
            currentLogFile: this.currentLogFile,
            encryptionEnabled: this.options.encryption,
            tamperProtectionEnabled: this.options.tamperProtection,
            lastIntegrityCheck: this.lastIntegrityCheck,
            integrityHashesStored: this.integrityHashes.size
        };
    }

    /**
     * Rotate old logs (called by maintenance)
     */
    async rotateOldLogs() {
        try {
            await this.flushBuffer();
            await this.cleanupOldLogs();
            return true;
        } catch (error) {
            console.error('[SecurityAudit] Log rotation error:', error);
            return false;
        }
    }

    /**
     * Initialize audit logger
     */
    async initialize() {
        try {
            console.log('[SecurityAudit] Initializing Security Audit Logger...');
            
            // Ensure log directory exists
            await this.ensureLogDirectory();

            // Initialize encryption key
            if (this.options.encryption && !this.encryptionKey) {
                this.encryptionKey = crypto.randomBytes(32);
            }

            // Start buffer flush interval
            setInterval(async () => {
                try {
                    if (this.logBuffer.length > 0) {
                        await this.flushBuffer();
                    }
                } catch (error) {
                    console.error('[SecurityAudit] Flush interval error:', error);
                }
            }, this.flushInterval);

            // Start integrity check interval
            if (this.options.tamperProtection) {
                setInterval(async () => {
                    try {
                        await this.runIntegrityCheck();
                    } catch (error) {
                        console.error('[SecurityAudit] Integrity check interval error:', error);
                    }
                }, 3600000); // Every hour
            }

            console.log('[SecurityAudit] Security Audit Logger initialized successfully');
            return true;
        } catch (error) {
            console.error('[SecurityAudit] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Static log method for convenience
     */
    static log(eventType, eventData, severity = 'info') {
        // For now, use console as fallback - in production this would use a global instance
        console.log(`[SECURITY_AUDIT_STATIC] ${eventType}:`, JSON.stringify(eventData));
    }
}

export default SecurityAuditLogger;
