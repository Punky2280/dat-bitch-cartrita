/**
 * Security Integration API Routes
 * RESTful API endpoints for security tool integrations
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityApiIntegrationService from '../services/SecurityApiIntegrationService.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';

const router = express.Router();

// Initialize security integration service
let securityIntegrationService;

const initService = async () => {
    if (!securityIntegrationService) {
        securityIntegrationService = new SecurityApiIntegrationService();
        await securityIntegrationService.init();
    }
    return securityIntegrationService;
};

// Rate limiting for security API endpoints
const securityApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many security API requests from this IP'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Higher limit for webhooks
    message: {
        success: false,
        error: 'Too many webhook requests'
    },
    keyGenerator: (req) => {
        // Use integration ID if available, otherwise fallback to a safe IP key
        if (req.params.integrationId) {
            return req.params.integrationId;
        }
        // For IPv6 compatibility, use the full IP address or a hash
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        return ip.replace(/:/g, '_'); // Replace colons to make IPv6 addresses safe
    }
});

// Apply rate limiting to all routes
router.use(securityApiLimiter);

// Authentication middleware for API endpoints (excluding webhooks)
const authenticateApiRequest = (req, res, next) => {
    // Skip authentication for webhook endpoints
    if (req.path.includes('/webhooks/')) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authorization token required'
        });
    }

    // TODO: Validate JWT token
    // For now, accept any Bearer token
    next();
};

router.use(authenticateApiRequest);

// Get all integrations status
router.get('/integrations', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.get_integrations', async (span) => {
        try {
            const service = await initService();
            const integrations = service.getIntegrationStatus();
            
            span?.setAttributes({
                integration_count: integrations.length,
                active_count: integrations.filter(i => i.status === 'active').length
            });

            res.json({
                success: true,
                data: {
                    integrations,
                    supported: service.getSupportedIntegrations(),
                    metrics: service.getMetrics()
                }
            });
            
        } catch (error) {
            console.error('Failed to get integrations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve integrations'
            });
        }
    });
});

// Get specific integration status
router.get('/integrations/:integrationId', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.get_integration', async (span) => {
        try {
            const { integrationId } = req.params;
            const service = await initService();
            const integration = service.getIntegrationStatus(integrationId);
            
            if (!integration) {
                return res.status(404).json({
                    success: false,
                    error: 'Integration not found'
                });
            }

            span?.setAttributes({
                integration_id: integrationId,
                integration_type: integration.type,
                integration_status: integration.status
            });

            res.json({
                success: true,
                data: integration
            });
            
        } catch (error) {
            console.error('Failed to get integration:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve integration'
            });
        }
    });
});

// Add new integration
router.post('/integrations', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.add_integration', async (span) => {
        try {
            const config = req.body;
            
            // Validate required fields
            if (!config.name || !config.type || !config.baseUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, type, baseUrl'
                });
            }

            const service = await initService();
            const result = await service.addIntegration(config);
            
            span?.setAttributes({
                integration_id: result.integrationId,
                integration_type: config.type,
                integration_name: config.name
            });

            SecurityAuditLogger.log('Integration added via API', {
                integrationId: result.integrationId,
                type: config.type,
                name: config.name,
                addedBy: req.user?.id || 'unknown'
            });

            res.status(201).json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Failed to add integration:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to add integration'
            });
        }
    });
});

// Remove integration
router.delete('/integrations/:integrationId', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.remove_integration', async (span) => {
        try {
            const { integrationId } = req.params;
            const service = await initService();
            
            // Get integration info before deletion for logging
            const integration = service.getIntegrationStatus(integrationId);
            
            await service.removeIntegration(integrationId);
            
            span?.setAttributes({
                integration_id: integrationId,
                integration_type: integration?.type || 'unknown'
            });

            SecurityAuditLogger.log('Integration removed via API', {
                integrationId,
                type: integration?.type || 'unknown',
                name: integration?.name || 'unknown',
                removedBy: req.user?.id || 'unknown'
            });

            res.json({
                success: true,
                message: 'Integration removed successfully'
            });
            
        } catch (error) {
            console.error('Failed to remove integration:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to remove integration'
            });
        }
    });
});

// Perform health checks
router.post('/integrations/health-check', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.health_check', async (span) => {
        try {
            const service = await initService();
            const results = await service.performHealthChecks();
            
            const healthyCount = results.filter(r => r.status === 'active').length;
            const totalCount = results.length;
            
            span?.setAttributes({
                total_integrations: totalCount,
                healthy_integrations: healthyCount,
                unhealthy_integrations: totalCount - healthyCount
            });

            res.json({
                success: true,
                data: {
                    results,
                    summary: {
                        total: totalCount,
                        healthy: healthyCount,
                        unhealthy: totalCount - healthyCount
                    }
                }
            });
            
        } catch (error) {
            console.error('Health check failed:', error);
            res.status(500).json({
                success: false,
                error: 'Health check failed'
            });
        }
    });
});

// SIEM Integration Endpoints
router.post('/siem/:integrationId/events', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.siem.send_event', async (span) => {
        try {
            const { integrationId } = req.params;
            const eventData = req.body;
            
            const service = await initService();
            const result = await service.sendToSiem(integrationId, eventData);
            
            span?.setAttributes({
                integration_id: integrationId,
                event_type: eventData.type || 'unknown',
                event_severity: eventData.severity || 'unknown'
            });

            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Failed to send SIEM event:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send SIEM event'
            });
        }
    });
});

// Threat Intelligence Endpoints
router.post('/threat-intel/:integrationId/query', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.threat_intel.query', async (span) => {
        try {
            const { integrationId } = req.params;
            const { indicators } = req.body;
            
            if (!indicators || !Array.isArray(indicators)) {
                return res.status(400).json({
                    success: false,
                    error: 'Indicators array is required'
                });
            }

            const service = await initService();
            const results = await service.queryThreatIntel(integrationId, indicators);
            
            span?.setAttributes({
                integration_id: integrationId,
                indicator_count: indicators.length,
                malicious_count: results.results.filter(r => r.reputation?.malicious).length
            });

            res.json({
                success: true,
                data: results
            });
            
        } catch (error) {
            console.error('Failed to query threat intelligence:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to query threat intelligence'
            });
        }
    });
});

// Vulnerability Scanner Endpoints
router.post('/vulnerability/:integrationId/scan', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.vulnerability.initiate_scan', async (span) => {
        try {
            const { integrationId } = req.params;
            const { targets, scanType = 'basic' } = req.body;
            
            if (!targets || !Array.isArray(targets)) {
                return res.status(400).json({
                    success: false,
                    error: 'Targets array is required'
                });
            }

            const service = await initService();
            const result = await service.runVulnerabilityScan(integrationId, targets, scanType);
            
            span?.setAttributes({
                integration_id: integrationId,
                target_count: targets.length,
                scan_type: scanType,
                scan_id: result.scanId
            });

            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Failed to initiate vulnerability scan:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to initiate vulnerability scan'
            });
        }
    });
});

router.get('/vulnerability/:integrationId/scan/:scanId', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.vulnerability.get_results', async (span) => {
        try {
            const { integrationId, scanId } = req.params;
            
            const service = await initService();
            const results = await service.getScanResults(integrationId, scanId);
            
            span?.setAttributes({
                integration_id: integrationId,
                scan_id: scanId,
                scan_status: results.status,
                vulnerability_count: results.results?.vulnerabilities?.length || 0
            });

            res.json({
                success: true,
                data: results
            });
            
        } catch (error) {
            console.error('Failed to get scan results:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get scan results'
            });
        }
    });
});

// Webhook Endpoints (no authentication required)
router.post('/webhooks/:integrationId', webhookLimiter, async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.webhook.receive', async (span) => {
        try {
            const { integrationId } = req.params;
            const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
            const payload = req.body;
            
            if (!signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing webhook signature'
                });
            }

            const service = await initService();
            const result = await service.processWebhook(integrationId, payload, signature);
            
            span?.setAttributes({
                integration_id: integrationId,
                payload_type: payload.type || 'unknown',
                payload_size: JSON.stringify(payload).length
            });

            SecurityAuditLogger.log('Webhook processed', {
                integrationId,
                type: payload.type || 'unknown',
                status: 'success',
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Failed to process webhook:', error);
            SecurityAuditLogger.log('Webhook processing failed', {
                integrationId: req.params.integrationId,
                error: error.message,
                status: 'failed',
                timestamp: new Date().toISOString()
            });
            
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to process webhook'
            });
        }
    });
});

// Get webhook configuration
router.get('/integrations/:integrationId/webhook', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.get_webhook_config', async (span) => {
        try {
            const { integrationId } = req.params;
            const service = await initService();
            
            const integration = service.getIntegrationStatus(integrationId);
            if (!integration) {
                return res.status(404).json({
                    success: false,
                    error: 'Integration not found'
                });
            }

            const webhookEndpoint = service.getWebhookEndpoint(integrationId);
            const webhookSecret = service.getWebhookSecret(integrationId);
            
            span?.setAttributes({
                integration_id: integrationId,
                integration_type: integration.type
            });

            res.json({
                success: true,
                data: {
                    integrationId,
                    webhookEndpoint,
                    webhookSecret,
                    signatureHeader: 'X-Signature',
                    contentType: 'application/json'
                }
            });
            
        } catch (error) {
            console.error('Failed to get webhook config:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get webhook configuration'
            });
        }
    });
});

// Test integration connectivity
router.post('/integrations/:integrationId/test', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.test_integration', async (span) => {
        try {
            const { integrationId } = req.params;
            const service = await initService();
            
            const integration = service.getIntegrationStatus(integrationId);
            if (!integration) {
                return res.status(404).json({
                    success: false,
                    error: 'Integration not found'
                });
            }

            // Perform a simple connectivity test
            const startTime = Date.now();
            const healthResults = await service.performHealthChecks();
            const integrationResult = healthResults.find(r => r.integrationId === integrationId);
            const responseTime = Date.now() - startTime;
            
            span?.setAttributes({
                integration_id: integrationId,
                test_status: integrationResult?.status || 'unknown',
                response_time: responseTime
            });

            res.json({
                success: true,
                data: {
                    integrationId,
                    status: integrationResult?.status || 'unknown',
                    responseTime,
                    lastCheck: integrationResult?.lastCheck,
                    error: integrationResult?.error
                }
            });
            
        } catch (error) {
            console.error('Failed to test integration:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to test integration'
            });
        }
    });
});

// Get API metrics
router.get('/metrics', async (req, res) => {
    return await OpenTelemetryTracing.traceOperation('security_api.get_metrics', async (span) => {
        try {
            const service = await initService();
            const metrics = service.getMetrics();
            
            span?.setAttributes({
                total_integrations: metrics.totalIntegrations,
                active_integrations: metrics.activeIntegrations,
                total_requests: metrics.totalRequests
            });

            res.json({
                success: true,
                data: {
                    ...metrics,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Failed to get metrics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve metrics'
            });
        }
    });
});

export default router;
