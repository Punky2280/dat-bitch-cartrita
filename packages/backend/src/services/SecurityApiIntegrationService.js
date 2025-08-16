/**
 * Security API & Integration Layer Service
 * Comprehensive security API layer for external integrations
 * @author Robbie Allen - Lead Architect  
 * @date August 16, 2025
 */

import crypto from 'crypto';
import axios from 'axios';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';

class SecurityApiIntegrationService extends EventEmitter {
    constructor() {
        super();
        this.integrations = new Map();
        this.webhookSecrets = new Map();
        this.rateLimiter = new Map();
        this.apiKeys = new Map();
        this.initialized = false;
        
        this.supportedIntegrations = {
            siem: ['splunk', 'elasticsearch', 'sentinel', 'qradar', 'arcsight'],
            threatIntel: ['virustotal', 'threatcrowd', 'otx', 'misp', 'recorded_future'],
            vulnerability: ['nessus', 'openvas', 'rapid7', 'qualys', 'veracode'],
            compliance: ['rsam', 'governance', 'archer', 'servicenow']
        };

        this.init();
    }

    async init() {
        try {
            await this.loadIntegrationConfigs();
            await this.initializeWebhookEndpoints();
            await this.startMonitoring();
            
            this.initialized = true;
            SecurityAuditLogger.log('SecurityApiIntegrationService initialized successfully', {
                integrations: this.integrations.size,
                webhooks: this.webhookSecrets.size
            });
            
        } catch (error) {
            console.error('Failed to initialize SecurityApiIntegrationService:', error);
            throw error;
        }
    }

    async loadIntegrationConfigs() {
        // Load integration configurations from database or config files
        const configs = [
            {
                id: 'splunk-siem',
                type: 'siem',
                name: 'Splunk SIEM',
                baseUrl: process.env.SPLUNK_BASE_URL,
                apiKey: process.env.SPLUNK_API_KEY,
                enabled: !!process.env.SPLUNK_API_KEY,
                rateLimit: 100, // requests per minute
                timeout: 30000,
                retries: 3
            },
            {
                id: 'elastic-siem',
                type: 'siem',
                name: 'Elastic SIEM',
                baseUrl: process.env.ELASTIC_BASE_URL,
                apiKey: process.env.ELASTIC_API_KEY,
                enabled: !!process.env.ELASTIC_API_KEY,
                rateLimit: 200,
                timeout: 30000,
                retries: 3
            },
            {
                id: 'virustotal',
                type: 'threatIntel',
                name: 'VirusTotal',
                baseUrl: 'https://www.virustotal.com/vtapi/v2',
                apiKey: process.env.VIRUSTOTAL_API_KEY,
                enabled: !!process.env.VIRUSTOTAL_API_KEY,
                rateLimit: 4, // requests per minute for free tier
                timeout: 15000,
                retries: 2
            },
            {
                id: 'nessus',
                type: 'vulnerability',
                name: 'Nessus Scanner',
                baseUrl: process.env.NESSUS_BASE_URL,
                apiKey: process.env.NESSUS_API_KEY,
                enabled: !!process.env.NESSUS_API_KEY,
                rateLimit: 60,
                timeout: 45000,
                retries: 3
            }
        ];

        for (const config of configs) {
            if (config.enabled) {
                this.integrations.set(config.id, {
                    ...config,
                    status: 'inactive',
                    lastHealthCheck: null,
                    errorCount: 0,
                    successCount: 0,
                    client: this.createHttpClient(config)
                });
                
                // Generate webhook secret for this integration
                this.webhookSecrets.set(config.id, crypto.randomBytes(32).toString('hex'));
                
                // Initialize rate limiter
                this.rateLimiter.set(config.id, {
                    requests: 0,
                    resetTime: Date.now() + 60000 // Reset every minute
                });
            }
        }
    }

    createHttpClient(config) {
        const client = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Cartrita-Security-Integration/1.0'
            }
        });

        // Add request interceptor for rate limiting and logging
        client.interceptors.request.use(
            (request) => {
                if (!this.checkRateLimit(config.id)) {
                    throw new Error(`Rate limit exceeded for integration ${config.id}`);
                }
                
                SecurityAuditLogger.log('External API request', {
                    integrationId: config.id,
                    method: request.method,
                    url: request.url,
                    timestamp: new Date().toISOString()
                });
                
                return request;
            },
            (error) => Promise.reject(error)
        );

        // Add response interceptor for metrics and error handling
        client.interceptors.response.use(
            (response) => {
                this.updateIntegrationMetrics(config.id, 'success');
                return response;
            },
            (error) => {
                this.updateIntegrationMetrics(config.id, 'error');
                
                if (config.retries > 0) {
                    return this.retryRequest(error.config, config);
                }
                
                return Promise.reject(error);
            }
        );

        return client;
    }

    checkRateLimit(integrationId) {
        const limiter = this.rateLimiter.get(integrationId);
        const integration = this.integrations.get(integrationId);
        
        if (!limiter || !integration) return false;

        const now = Date.now();
        if (now >= limiter.resetTime) {
            limiter.requests = 0;
            limiter.resetTime = now + 60000;
        }

        if (limiter.requests >= integration.rateLimit) {
            return false;
        }

        limiter.requests++;
        return true;
    }

    updateIntegrationMetrics(integrationId, result) {
        const integration = this.integrations.get(integrationId);
        if (!integration) return;

        if (result === 'success') {
            integration.successCount++;
            integration.status = 'active';
        } else {
            integration.errorCount++;
            if (integration.errorCount > 5) {
                integration.status = 'degraded';
            }
        }

        integration.lastActivity = new Date();
    }

    async retryRequest(config, integration) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return await integration.client(config);
    }

    // SIEM Integration Methods
    async sendToSiem(integrationId, eventData) {
        return await OpenTelemetryTracing.traceOperation('security_api.siem.send_event', async (span) => {
            span?.setAttributes({
                integration_id: integrationId,
                event_type: eventData.type || 'unknown'
            });

            const integration = this.integrations.get(integrationId);
            if (!integration || integration.type !== 'siem') {
                throw new Error(`SIEM integration ${integrationId} not found or invalid`);
            }

            const siemEvent = this.formatSiemEvent(eventData, integration.name);
            
            try {
                const response = await integration.client.post('/events', siemEvent);
                
                SecurityAuditLogger.log('SIEM event sent', {
                    integrationId,
                    eventId: response.data.id || 'unknown',
                    status: 'success'
                });
                
                return {
                    success: true,
                    eventId: response.data.id,
                    integrationId
                };
                
            } catch (error) {
                SecurityAuditLogger.log('SIEM event failed', {
                    integrationId,
                    error: error.message,
                    status: 'failed'
                });
                throw error;
            }
        });
    }

    formatSiemEvent(eventData, siemType) {
        const baseEvent = {
            timestamp: new Date().toISOString(),
            source: 'cartrita-security',
            severity: eventData.severity || 'medium',
            category: eventData.category || 'security',
            title: eventData.title,
            description: eventData.description,
            tags: eventData.tags || [],
            metadata: eventData.metadata || {}
        };

        // Format for specific SIEM systems
        switch (siemType.toLowerCase()) {
            case 'splunk':
                return {
                    ...baseEvent,
                    sourcetype: 'cartrita:security',
                    index: 'security'
                };
                
            case 'elastic':
                return {
                    '@timestamp': baseEvent.timestamp,
                    event: {
                        category: baseEvent.category,
                        severity: baseEvent.severity
                    },
                    message: baseEvent.description,
                    ...baseEvent.metadata
                };
                
            default:
                return baseEvent;
        }
    }

    // Threat Intelligence Integration Methods
    async queryThreatIntel(integrationId, indicators) {
        return await OpenTelemetryTracing.traceOperation('security_api.threat_intel.query', async (span) => {
            span?.setAttributes({
                integration_id: integrationId,
                indicator_count: indicators.length
            });

            const integration = this.integrations.get(integrationId);
            if (!integration || integration.type !== 'threatIntel') {
                throw new Error(`Threat intelligence integration ${integrationId} not found`);
            }

            const results = [];
            
            for (const indicator of indicators) {
                try {
                    const result = await this.querySingleIndicator(integration, indicator);
                    results.push(result);
                    
                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    results.push({
                        indicator,
                        error: error.message,
                        status: 'error'
                    });
                }
            }

            return {
                success: true,
                integrationId,
                results,
                queriedAt: new Date().toISOString()
            };
        });
    }

    async querySingleIndicator(integration, indicator) {
        const endpoint = this.getThreatIntelEndpoint(integration.name, indicator);
        
        try {
            const response = await integration.client.get(endpoint);
            
            return {
                indicator: indicator.value,
                type: indicator.type,
                reputation: this.parseThreatIntelResponse(integration.name, response.data),
                status: 'success',
                queriedAt: new Date().toISOString()
            };
            
        } catch (error) {
            throw new Error(`Failed to query ${indicator.value}: ${error.message}`);
        }
    }

    getThreatIntelEndpoint(providerName, indicator) {
        switch (providerName.toLowerCase()) {
            case 'virustotal':
                if (indicator.type === 'ip') {
                    return `/ip-address/${indicator.value}`;
                } else if (indicator.type === 'domain') {
                    return `/domain/${indicator.value}`;
                } else if (indicator.type === 'hash') {
                    return `/file/${indicator.value}`;
                }
                break;
                
            default:
                return `/lookup/${indicator.value}`;
        }
    }

    parseThreatIntelResponse(providerName, data) {
        switch (providerName.toLowerCase()) {
            case 'virustotal':
                return {
                    malicious: data.positives > 0,
                    score: data.positives || 0,
                    total: data.total || 0,
                    scans: data.scans || {},
                    confidence: data.positives > 5 ? 'high' : data.positives > 0 ? 'medium' : 'low'
                };
                
            default:
                return {
                    reputation: data.reputation || 'unknown',
                    confidence: data.confidence || 'low',
                    tags: data.tags || []
                };
        }
    }

    // Vulnerability Scanner Integration Methods
    async runVulnerabilityScan(integrationId, targets, scanType = 'basic') {
        return await OpenTelemetryTracing.traceOperation('security_api.vulnerability.scan', async (span) => {
            span?.setAttributes({
                integration_id: integrationId,
                target_count: targets.length,
                scan_type: scanType
            });

            const integration = this.integrations.get(integrationId);
            if (!integration || integration.type !== 'vulnerability') {
                throw new Error(`Vulnerability scanner integration ${integrationId} not found`);
            }

            const scanConfig = {
                targets,
                scanType,
                timestamp: new Date().toISOString(),
                scanId: crypto.randomUUID()
            };

            try {
                const response = await integration.client.post('/scans', scanConfig);
                
                SecurityAuditLogger.log('Vulnerability scan initiated', {
                    integrationId,
                    scanId: scanConfig.scanId,
                    targets: targets.length,
                    status: 'initiated'
                });

                return {
                    success: true,
                    scanId: response.data.scanId || scanConfig.scanId,
                    status: 'initiated',
                    integrationId,
                    estimatedDuration: this.getEstimatedScanDuration(scanType, targets.length)
                };
                
            } catch (error) {
                SecurityAuditLogger.log('Vulnerability scan failed', {
                    integrationId,
                    error: error.message,
                    status: 'failed'
                });
                throw error;
            }
        });
    }

    async getScanResults(integrationId, scanId) {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'vulnerability') {
            throw new Error(`Vulnerability scanner integration ${integrationId} not found`);
        }

        try {
            const response = await integration.client.get(`/scans/${scanId}/results`);
            
            return {
                success: true,
                scanId,
                status: response.data.status,
                results: this.parseVulnerabilityResults(integration.name, response.data),
                completedAt: response.data.completedAt
            };
            
        } catch (error) {
            throw new Error(`Failed to get scan results: ${error.message}`);
        }
    }

    parseVulnerabilityResults(scannerName, data) {
        // Normalize vulnerability results across different scanners
        return {
            summary: {
                critical: data.criticalCount || 0,
                high: data.highCount || 0,
                medium: data.mediumCount || 0,
                low: data.lowCount || 0,
                info: data.infoCount || 0
            },
            vulnerabilities: (data.vulnerabilities || []).map(vuln => ({
                id: vuln.id,
                title: vuln.name || vuln.title,
                severity: vuln.severity,
                cvss: vuln.cvss_score,
                description: vuln.description,
                solution: vuln.solution,
                references: vuln.references || [],
                affectedHosts: vuln.hosts || []
            }))
        };
    }

    getEstimatedScanDuration(scanType, targetCount) {
        const baseDuration = {
            basic: 5, // minutes
            comprehensive: 30,
            deep: 120
        };
        
        return (baseDuration[scanType] || 15) * Math.ceil(targetCount / 10);
    }

    // Webhook Management Methods
    generateWebhookSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    verifyWebhookSignature(payload, signature, integrationId) {
        const secret = this.webhookSecrets.get(integrationId);
        if (!secret) {
            throw new Error(`No webhook secret found for integration ${integrationId}`);
        }

        const expectedSignature = this.generateWebhookSignature(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    async processWebhook(integrationId, payload, signature) {
        return await OpenTelemetryTracing.traceOperation('security_api.webhook.process', async (span) => {
            span?.setAttributes({
                integration_id: integrationId,
                payload_size: JSON.stringify(payload).length
            });

            // Verify webhook signature
            if (!this.verifyWebhookSignature(payload, signature, integrationId)) {
                throw new Error('Invalid webhook signature');
            }

            const integration = this.integrations.get(integrationId);
            if (!integration) {
                throw new Error(`Integration ${integrationId} not found`);
            }

            // Process webhook based on integration type
            let processedData;
            switch (integration.type) {
                case 'siem':
                    processedData = await this.processSiemWebhook(payload);
                    break;
                case 'threatIntel':
                    processedData = await this.processThreatIntelWebhook(payload);
                    break;
                case 'vulnerability':
                    processedData = await this.processVulnerabilityWebhook(payload);
                    break;
                default:
                    processedData = payload;
            }

            // Emit event for processed webhook
            this.emit('webhook_processed', {
                integrationId,
                type: integration.type,
                data: processedData,
                timestamp: new Date().toISOString()
            });

            SecurityAuditLogger.log('Webhook processed', {
                integrationId,
                type: integration.type,
                status: 'success'
            });

            return {
                success: true,
                integrationId,
                processedData
            };
        });
    }

    async processSiemWebhook(payload) {
        // Process SIEM alerts and events
        return {
            type: 'siem_alert',
            alertId: payload.id,
            severity: payload.severity,
            title: payload.title,
            description: payload.description,
            timestamp: payload.timestamp,
            affectedSystems: payload.systems || []
        };
    }

    async processThreatIntelWebhook(payload) {
        // Process threat intelligence updates
        return {
            type: 'threat_intel_update',
            indicators: payload.indicators || [],
            threatActors: payload.threat_actors || [],
            campaigns: payload.campaigns || [],
            timestamp: payload.timestamp
        };
    }

    async processVulnerabilityWebhook(payload) {
        // Process vulnerability scan results
        return {
            type: 'vulnerability_update',
            scanId: payload.scan_id,
            status: payload.status,
            results: payload.results,
            completedAt: payload.completed_at
        };
    }

    // Health Check and Monitoring Methods
    async performHealthChecks() {
        const results = [];
        
        for (const [id, integration] of this.integrations) {
            try {
                const startTime = Date.now();
                const response = await integration.client.get('/health', { timeout: 5000 });
                const responseTime = Date.now() - startTime;
                
                integration.status = response.status === 200 ? 'active' : 'degraded';
                integration.lastHealthCheck = new Date();
                integration.responseTime = responseTime;
                
                results.push({
                    integrationId: id,
                    status: integration.status,
                    responseTime,
                    lastCheck: integration.lastHealthCheck
                });
                
            } catch (error) {
                integration.status = 'error';
                integration.lastHealthCheck = new Date();
                integration.lastError = error.message;
                
                results.push({
                    integrationId: id,
                    status: 'error',
                    error: error.message,
                    lastCheck: integration.lastHealthCheck
                });
            }
        }
        
        return results;
    }

    async startMonitoring() {
        // Perform health checks every 5 minutes
        setInterval(async () => {
            try {
                await this.performHealthChecks();
            } catch (error) {
                console.error('Health check failed:', error);
            }
        }, 5 * 60 * 1000);

        // Reset rate limiters every minute
        setInterval(() => {
            const now = Date.now();
            for (const [id, limiter] of this.rateLimiter) {
                if (now >= limiter.resetTime) {
                    limiter.requests = 0;
                    limiter.resetTime = now + 60000;
                }
            }
        }, 60000);
    }

    // Status and Configuration Methods
    getIntegrationStatus(integrationId = null) {
        if (integrationId) {
            const integration = this.integrations.get(integrationId);
            return integration ? {
                id: integrationId,
                name: integration.name,
                type: integration.type,
                status: integration.status,
                lastHealthCheck: integration.lastHealthCheck,
                successCount: integration.successCount,
                errorCount: integration.errorCount,
                responseTime: integration.responseTime
            } : null;
        }

        const statuses = [];
        for (const [id, integration] of this.integrations) {
            statuses.push({
                id,
                name: integration.name,
                type: integration.type,
                status: integration.status,
                lastHealthCheck: integration.lastHealthCheck,
                successCount: integration.successCount,
                errorCount: integration.errorCount,
                responseTime: integration.responseTime
            });
        }
        
        return statuses;
    }

    getSupportedIntegrations() {
        return this.supportedIntegrations;
    }

    getWebhookEndpoint(integrationId) {
        const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://api.cartrita.com';
        return `${baseUrl}/api/security/webhooks/${integrationId}`;
    }

    getWebhookSecret(integrationId) {
        return this.webhookSecrets.get(integrationId);
    }

    async addIntegration(config) {
        const id = config.id || crypto.randomUUID();
        
        const integration = {
            ...config,
            id,
            status: 'inactive',
            lastHealthCheck: null,
            errorCount: 0,
            successCount: 0,
            client: this.createHttpClient(config)
        };

        this.integrations.set(id, integration);
        this.webhookSecrets.set(id, crypto.randomBytes(32).toString('hex'));
        this.rateLimiter.set(id, {
            requests: 0,
            resetTime: Date.now() + 60000
        });

        SecurityAuditLogger.log('Integration added', {
            integrationId: id,
            type: config.type,
            name: config.name
        });

        return {
            success: true,
            integrationId: id,
            webhookEndpoint: this.getWebhookEndpoint(id),
            webhookSecret: this.getWebhookSecret(id)
        };
    }

    async removeIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }

        this.integrations.delete(integrationId);
        this.webhookSecrets.delete(integrationId);
        this.rateLimiter.delete(integrationId);

        SecurityAuditLogger.log('Integration removed', {
            integrationId,
            type: integration.type,
            name: integration.name
        });

        return { success: true };
    }

    // Utility Methods
    isInitialized() {
        return this.initialized;
    }

    getMetrics() {
        const metrics = {
            totalIntegrations: this.integrations.size,
            activeIntegrations: 0,
            degradedIntegrations: 0,
            errorIntegrations: 0,
            totalRequests: 0,
            totalErrors: 0,
            webhooksProcessed: 0
        };

        for (const integration of this.integrations.values()) {
            switch (integration.status) {
                case 'active':
                    metrics.activeIntegrations++;
                    break;
                case 'degraded':
                    metrics.degradedIntegrations++;
                    break;
                case 'error':
                    metrics.errorIntegrations++;
                    break;
            }
            
            metrics.totalRequests += integration.successCount + integration.errorCount;
            metrics.totalErrors += integration.errorCount;
        }

        return metrics;
    }
}

export default SecurityApiIntegrationService;
