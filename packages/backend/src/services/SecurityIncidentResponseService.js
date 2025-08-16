/**
 * Security Incident Response System
 * Automated incident detection, classification, and response orchestration
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';

class SecurityIncidentResponseService {
    constructor(options = {}) {
        this.pool = options.databasePool;
        this.securityService = options.databaseSecurityService;
        this.integrationService = options.securityApiIntegrationService;
        
        // Incident classification thresholds
        this.incidentThresholds = {
            critical: { riskScore: 90, priority: 1, responseTime: 300 }, // 5 minutes
            high: { riskScore: 70, priority: 2, responseTime: 900 },     // 15 minutes
            medium: { riskScore: 40, priority: 3, responseTime: 3600 },  // 1 hour
            low: { riskScore: 20, priority: 4, responseTime: 14400 }     // 4 hours
        };
        
        // Active incidents tracking
        this.activeIncidents = new Map();
        this.responsePlaybooks = new Map();
        this.escalationRules = new Map();
        
        // Auto-response configuration
        this.autoResponseEnabled = options.autoResponseEnabled || false;
        this.maxAutoActions = options.maxAutoActions || 3;
        
        this.initialized = false;
        this.init();
    }

    async init() {
        try {
            await this.loadResponsePlaybooks();
            await this.loadEscalationRules();
            await this.initializeIncidentDetection();
            await this.startIncidentMonitoring();
            
            this.initialized = true;
            console.log('Security Incident Response Service initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Security Incident Response Service:', error);
            throw error;
        }
    }

    async loadResponsePlaybooks() {
        // Load predefined response playbooks
        this.responsePlaybooks.set('sql_injection', {
            name: 'SQL Injection Response',
            description: 'Automated response for SQL injection attempts',
            severity: 'critical',
            autoActions: [
                { type: 'block_ip', duration: 3600 },
                { type: 'disable_user_session' },
                { type: 'alert_security_team' },
                { type: 'log_forensic_data' }
            ],
            manualActions: [
                'Review query logs for additional suspicious activity',
                'Analyze application logs for potential code vulnerabilities',
                'Consider blocking user account pending investigation'
            ]
        });

        this.responsePlaybooks.set('brute_force', {
            name: 'Brute Force Attack Response',
            description: 'Response for detected brute force login attempts',
            severity: 'high',
            autoActions: [
                { type: 'rate_limit_ip', multiplier: 10 },
                { type: 'temporary_account_lock', duration: 1800 },
                { type: 'alert_user_security_event' },
                { type: 'log_forensic_data' }
            ],
            manualActions: [
                'Review authentication logs for patterns',
                'Check for compromised credentials in breach databases',
                'Consider implementing additional MFA requirements'
            ]
        });

        this.responsePlaybooks.set('data_exfiltration', {
            name: 'Data Exfiltration Response',
            description: 'Response for suspected data exfiltration attempts',
            severity: 'critical',
            autoActions: [
                { type: 'block_user_access' },
                { type: 'quarantine_session' },
                { type: 'alert_security_team', urgency: 'immediate' },
                { type: 'preserve_forensic_evidence' }
            ],
            manualActions: [
                'Identify scope of potentially compromised data',
                'Assess legal notification requirements',
                'Coordinate with legal and compliance teams',
                'Prepare incident disclosure if required'
            ]
        });

        this.responsePlaybooks.set('privilege_escalation', {
            name: 'Privilege Escalation Response',
            description: 'Response for unauthorized privilege escalation attempts',
            severity: 'high',
            autoActions: [
                { type: 'revoke_elevated_permissions' },
                { type: 'force_session_logout' },
                { type: 'alert_administrators' },
                { type: 'audit_permission_history' }
            ],
            manualActions: [
                'Review role assignments and permissions',
                'Verify integrity of role-based access controls',
                'Investigate potential insider threat indicators'
            ]
        });

        this.responsePlaybooks.set('anomalous_access', {
            name: 'Anomalous Access Response',
            description: 'Response for unusual access patterns or locations',
            severity: 'medium',
            autoActions: [
                { type: 'require_additional_auth' },
                { type: 'log_detailed_activity' },
                { type: 'alert_user_suspicious_activity' }
            ],
            manualActions: [
                'Verify user location and device',
                'Review recent account activity',
                'Consider implementing geolocation restrictions'
            ]
        });

        console.log(`Loaded ${this.responsePlaybooks.size} incident response playbooks`);
    }

    async loadEscalationRules() {
        this.escalationRules.set('severity_based', {
            name: 'Severity-Based Escalation',
            rules: [
                { condition: 'severity == "critical"', action: 'immediate_escalation', targets: ['security_team', 'management'] },
                { condition: 'severity == "high" && duration > 900', action: 'escalate_to_management', targets: ['management'] },
                { condition: 'auto_actions_failed >= 2', action: 'manual_intervention', targets: ['security_team'] }
            ]
        });

        this.escalationRules.set('time_based', {
            name: 'Time-Based Escalation',
            rules: [
                { condition: 'incident_age > 3600 && status != "resolved"', action: 'escalate_unresolved', targets: ['management'] },
                { condition: 'response_time > max_response_time * 1.5', action: 'escalate_delayed_response', targets: ['security_team'] }
            ]
        });

        console.log(`Loaded ${this.escalationRules.size} escalation rule sets`);
    }

    async initializeIncidentDetection() {
        // Set up automated incident detection triggers
        if (this.securityService) {
            // Hook into database security events
            this.securityService.on?.('high_risk_access', (event) => {
                this.handleSecurityEvent('high_risk_database_access', event);
            });
            
            this.securityService.on?.('sql_injection_detected', (event) => {
                this.handleSecurityEvent('sql_injection', event);
            });
        }

        if (this.integrationService) {
            // Hook into external security tool alerts
            this.integrationService.on?.('threat_detected', (event) => {
                this.handleSecurityEvent('external_threat', event);
            });
        }
    }

    async startIncidentMonitoring() {
        // Start background monitoring processes
        setInterval(async () => {
            try {
                await this.processIncidentQueue();
                await this.checkEscalationRules();
                await this.updateIncidentStatuses();
            } catch (error) {
                console.error('Incident monitoring error:', error);
            }
        }, 30 * 1000); // Every 30 seconds

        setInterval(async () => {
            try {
                await this.generateIncidentMetrics();
                await this.cleanupResolvedIncidents();
            } catch (error) {
                console.error('Incident maintenance error:', error);
            }
        }, 5 * 60 * 1000); // Every 5 minutes

        console.log('Incident monitoring started');
    }

    async handleSecurityEvent(eventType, eventData) {
        return await OpenTelemetryTracing.traceOperation('security_incident.handle_event', async (span) => {
            const incidentId = await this.createIncident(eventType, eventData);
            
            span?.setAttributes({
                incident_id: incidentId,
                event_type: eventType,
                severity: eventData.severity || 'unknown'
            });

            const incident = await this.getIncident(incidentId);
            await this.classifyIncident(incident);
            await this.executeInitialResponse(incident);
            
            return incidentId;
        });
    }

    async createIncident(eventType, eventData) {
        return await OpenTelemetryTracing.traceOperation('security_incident.create', async (span) => {
            const incidentId = crypto.randomUUID();
            const timestamp = new Date();
            
            // Determine initial severity based on event data
            const severity = this.determineSeverity(eventType, eventData);
            const priority = this.incidentThresholds[severity].priority;
            const maxResponseTime = this.incidentThresholds[severity].responseTime;

            const incident = {
                id: incidentId,
                type: eventType,
                severity,
                priority,
                status: 'new',
                created_at: timestamp,
                updated_at: timestamp,
                max_response_time: maxResponseTime,
                source_data: eventData,
                assigned_to: null,
                auto_actions_taken: [],
                manual_actions_required: [],
                escalation_level: 0,
                resolution_notes: null
            };

            // Store in database
            if (this.pool) {
                await this.pool.query(`
                    INSERT INTO security_incidents (
                        id, incident_type, severity, priority, status, created_at, 
                        updated_at, max_response_time, source_data, assigned_to,
                        escalation_level
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    incidentId, eventType, severity, priority, 'new', timestamp,
                    timestamp, maxResponseTime, JSON.stringify(eventData), null, 0
                ]);
            }

            // Store in memory for fast access
            this.activeIncidents.set(incidentId, incident);

            span?.setAttributes({
                incident_id: incidentId,
                severity,
                priority,
                max_response_time: maxResponseTime
            });

            // Log incident creation
            SecurityAuditLogger.log('Security incident created', {
                incidentId,
                eventType,
                severity,
                priority
            });

            return incidentId;
        });
    }

    determineSeverity(eventType, eventData) {
        const riskScore = eventData.riskScore || 0;
        
        // Event-specific severity rules
        const severityRules = {
            sql_injection: 'critical',
            data_exfiltration: 'critical',
            brute_force: 'high',
            privilege_escalation: 'high',
            anomalous_access: 'medium'
        };

        // Check event-specific rules first
        if (severityRules[eventType]) {
            return severityRules[eventType];
        }

        // Fall back to risk score-based classification
        if (riskScore >= 90) return 'critical';
        if (riskScore >= 70) return 'high';
        if (riskScore >= 40) return 'medium';
        return 'low';
    }

    async classifyIncident(incident) {
        return await OpenTelemetryTracing.traceOperation('security_incident.classify', async (span) => {
            // Enhance incident classification with additional context
            const classification = {
                threatCategory: this.categorizeThreat(incident.type, incident.source_data),
                affectedSystems: this.identifyAffectedSystems(incident.source_data),
                potentialImpact: this.assessPotentialImpact(incident),
                recommendedPlaybook: this.selectPlaybook(incident.type)
            };

            // Update incident with classification
            incident.classification = classification;
            
            if (this.pool) {
                await this.pool.query(`
                    UPDATE security_incidents 
                    SET classification = $1, updated_at = $2 
                    WHERE id = $3
                `, [JSON.stringify(classification), new Date(), incident.id]);
            }

            span?.setAttributes({
                incident_id: incident.id,
                threat_category: classification.threatCategory,
                affected_systems: classification.affectedSystems.join(','),
                playbook: classification.recommendedPlaybook
            });

            return classification;
        });
    }

    categorizeThreat(eventType, sourceData) {
        const categories = {
            sql_injection: 'Application Security',
            brute_force: 'Authentication',
            data_exfiltration: 'Data Protection',
            privilege_escalation: 'Access Control',
            anomalous_access: 'Behavioral Analysis',
            external_threat: 'External Intelligence'
        };

        return categories[eventType] || 'Unknown';
    }

    identifyAffectedSystems(sourceData) {
        const systems = [];
        
        if (sourceData.tableName) {
            systems.push(`Database: ${sourceData.tableName}`);
        }
        
        if (sourceData.applicationName) {
            systems.push(`Application: ${sourceData.applicationName}`);
        }
        
        if (sourceData.clientIp) {
            systems.push(`Network: ${sourceData.clientIp}`);
        }
        
        if (sourceData.userId) {
            systems.push(`User Account: ${sourceData.userId}`);
        }

        return systems.length > 0 ? systems : ['Unknown'];
    }

    assessPotentialImpact(incident) {
        const severity = incident.severity;
        const classification = incident.classification;
        
        const impactLevels = {
            critical: {
                confidentiality: 'High',
                integrity: 'High',
                availability: 'Medium',
                businessImpact: 'Severe'
            },
            high: {
                confidentiality: 'Medium',
                integrity: 'Medium',
                availability: 'Medium',
                businessImpact: 'Moderate'
            },
            medium: {
                confidentiality: 'Low',
                integrity: 'Low',
                availability: 'Low',
                businessImpact: 'Minor'
            },
            low: {
                confidentiality: 'Minimal',
                integrity: 'Minimal',
                availability: 'Minimal',
                businessImpact: 'Negligible'
            }
        };

        return impactLevels[severity] || impactLevels.low;
    }

    selectPlaybook(eventType) {
        return this.responsePlaybooks.has(eventType) ? eventType : 'generic_incident';
    }

    async executeInitialResponse(incident) {
        return await OpenTelemetryTracing.traceOperation('security_incident.execute_response', async (span) => {
            const playbook = this.responsePlaybooks.get(incident.classification.recommendedPlaybook);
            
            if (!playbook) {
                console.warn(`No playbook found for incident type: ${incident.type}`);
                return;
            }

            const executedActions = [];
            const requiredManualActions = [...playbook.manualActions];

            // Execute automated actions if enabled
            if (this.autoResponseEnabled && playbook.autoActions) {
                for (const action of playbook.autoActions) {
                    try {
                        const result = await this.executeAutomatedAction(incident, action);
                        if (result.success) {
                            executedActions.push({
                                type: action.type,
                                timestamp: new Date(),
                                result: result.data,
                                status: 'completed'
                            });
                        } else {
                            executedActions.push({
                                type: action.type,
                                timestamp: new Date(),
                                error: result.error,
                                status: 'failed'
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to execute automated action ${action.type}:`, error);
                        executedActions.push({
                            type: action.type,
                            timestamp: new Date(),
                            error: error.message,
                            status: 'error'
                        });
                    }
                }
            }

            // Update incident with response actions
            incident.auto_actions_taken = executedActions;
            incident.manual_actions_required = requiredManualActions;
            incident.status = executedActions.length > 0 ? 'responding' : 'new';
            incident.updated_at = new Date();

            if (this.pool) {
                await this.pool.query(`
                    UPDATE security_incidents 
                    SET auto_actions_taken = $1, manual_actions_required = $2, 
                        status = $3, updated_at = $4 
                    WHERE id = $5
                `, [
                    JSON.stringify(executedActions),
                    JSON.stringify(requiredManualActions),
                    incident.status,
                    incident.updated_at,
                    incident.id
                ]);
            }

            span?.setAttributes({
                incident_id: incident.id,
                playbook: incident.classification.recommendedPlaybook,
                auto_actions_count: executedActions.length,
                manual_actions_count: requiredManualActions.length
            });

            // Log response execution
            SecurityAuditLogger.log('Incident response executed', {
                incidentId: incident.id,
                playbook: incident.classification.recommendedPlaybook,
                autoActionsExecuted: executedActions.length,
                manualActionsRequired: requiredManualActions.length
            });

            return {
                executedActions,
                requiredManualActions
            };
        });
    }

    async executeAutomatedAction(incident, action) {
        return await OpenTelemetryTracing.traceOperation('security_incident.execute_action', async (span) => {
            span?.setAttributes({
                incident_id: incident.id,
                action_type: action.type
            });

            try {
                switch (action.type) {
                    case 'block_ip':
                        return await this.blockIpAddress(incident, action);
                    
                    case 'disable_user_session':
                        return await this.disableUserSession(incident, action);
                    
                    case 'alert_security_team':
                        return await this.alertSecurityTeam(incident, action);
                    
                    case 'log_forensic_data':
                        return await this.logForensicData(incident, action);
                    
                    case 'rate_limit_ip':
                        return await this.applyRateLimit(incident, action);
                    
                    case 'temporary_account_lock':
                        return await this.lockUserAccount(incident, action);
                    
                    case 'alert_user_security_event':
                        return await this.alertUserSecurityEvent(incident, action);
                    
                    case 'block_user_access':
                        return await this.blockUserAccess(incident, action);
                    
                    case 'quarantine_session':
                        return await this.quarantineSession(incident, action);
                    
                    case 'preserve_forensic_evidence':
                        return await this.preserveForensicEvidence(incident, action);
                    
                    case 'revoke_elevated_permissions':
                        return await this.revokeElevatedPermissions(incident, action);
                    
                    case 'force_session_logout':
                        return await this.forceSessionLogout(incident, action);
                    
                    case 'require_additional_auth':
                        return await this.requireAdditionalAuth(incident, action);
                    
                    default:
                        return { success: false, error: `Unknown action type: ${action.type}` };
                }
            } catch (error) {
                span?.recordException(error);
                return { success: false, error: error.message };
            }
        });
    }

    // Automated action implementations
    async blockIpAddress(incident, action) {
        // Implementation would integrate with firewall/WAF
        console.log(`Blocking IP address for incident ${incident.id}`);
        return { 
            success: true, 
            data: { 
                action: 'ip_blocked',
                ip: incident.source_data.clientIp,
                duration: action.duration || 3600
            }
        };
    }

    async disableUserSession(incident, action) {
        // Implementation would disable user session
        if (incident.source_data.sessionId && this.pool) {
            await this.pool.query(
                'UPDATE user_sessions SET active = FALSE WHERE session_id = $1',
                [incident.source_data.sessionId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'session_disabled',
                sessionId: incident.source_data.sessionId
            }
        };
    }

    async alertSecurityTeam(incident, action) {
        // Implementation would send alerts to security team
        SecurityAuditLogger.log('SECURITY ALERT: Incident requires immediate attention', {
            incidentId: incident.id,
            severity: incident.severity,
            type: incident.type,
            urgency: action.urgency || 'normal'
        });
        
        return { 
            success: true, 
            data: { 
                action: 'security_team_alerted',
                urgency: action.urgency || 'normal'
            }
        };
    }

    async logForensicData(incident, action) {
        // Implementation would preserve forensic evidence
        if (this.pool) {
            await this.pool.query(`
                INSERT INTO forensic_evidence (
                    incident_id, evidence_type, evidence_data, collected_at
                ) VALUES ($1, $2, $3, $4)
            `, [
                incident.id,
                'source_event',
                JSON.stringify(incident.source_data),
                new Date()
            ]);
        }
        
        return { 
            success: true, 
            data: { 
                action: 'forensic_data_logged',
                evidenceId: crypto.randomUUID()
            }
        };
    }

    async applyRateLimit(incident, action) {
        // Implementation would apply enhanced rate limiting
        console.log(`Applying rate limit multiplier ${action.multiplier} for IP ${incident.source_data.clientIp}`);
        return { 
            success: true, 
            data: { 
                action: 'rate_limit_applied',
                multiplier: action.multiplier,
                ip: incident.source_data.clientIp
            }
        };
    }

    async lockUserAccount(incident, action) {
        // Implementation would temporarily lock user account
        if (incident.source_data.userId && this.pool) {
            const lockUntil = new Date(Date.now() + (action.duration * 1000));
            await this.pool.query(
                'UPDATE users SET account_locked_until = $1 WHERE id = $2',
                [lockUntil, incident.source_data.userId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'account_locked',
                userId: incident.source_data.userId,
                duration: action.duration
            }
        };
    }

    async alertUserSecurityEvent(incident, action) {
        // Implementation would notify user of security event
        console.log(`Alerting user ${incident.source_data.userId} of security event`);
        return { 
            success: true, 
            data: { 
                action: 'user_alerted',
                userId: incident.source_data.userId
            }
        };
    }

    async blockUserAccess(incident, action) {
        // Implementation would block all user access
        if (incident.source_data.userId && this.pool) {
            await this.pool.query(
                'UPDATE users SET access_blocked = TRUE WHERE id = $1',
                [incident.source_data.userId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'user_access_blocked',
                userId: incident.source_data.userId
            }
        };
    }

    async quarantineSession(incident, action) {
        // Implementation would quarantine user session
        if (incident.source_data.sessionId && this.pool) {
            await this.pool.query(
                'UPDATE user_sessions SET quarantined = TRUE WHERE session_id = $1',
                [incident.source_data.sessionId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'session_quarantined',
                sessionId: incident.source_data.sessionId
            }
        };
    }

    async preserveForensicEvidence(incident, action) {
        // Implementation would preserve additional forensic evidence
        const evidence = {
            timestamp: new Date(),
            incidentId: incident.id,
            systemState: await this.captureSystemState(),
            networkLogs: await this.captureNetworkLogs(incident.source_data.clientIp),
            userActivity: await this.captureUserActivity(incident.source_data.userId)
        };

        if (this.pool) {
            await this.pool.query(`
                INSERT INTO forensic_evidence (
                    incident_id, evidence_type, evidence_data, collected_at
                ) VALUES ($1, $2, $3, $4)
            `, [
                incident.id,
                'comprehensive_evidence',
                JSON.stringify(evidence),
                new Date()
            ]);
        }
        
        return { 
            success: true, 
            data: { 
                action: 'forensic_evidence_preserved',
                evidenceTypes: Object.keys(evidence)
            }
        };
    }

    async revokeElevatedPermissions(incident, action) {
        // Implementation would revoke user permissions
        if (incident.source_data.userId && this.pool) {
            await this.pool.query(
                'DELETE FROM user_roles WHERE user_id = $1 AND role IN ($2, $3)',
                [incident.source_data.userId, 'admin', 'super_user']
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'permissions_revoked',
                userId: incident.source_data.userId
            }
        };
    }

    async forceSessionLogout(incident, action) {
        // Implementation would force logout of all user sessions
        if (incident.source_data.userId && this.pool) {
            await this.pool.query(
                'UPDATE user_sessions SET active = FALSE WHERE user_id = $1',
                [incident.source_data.userId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'sessions_logged_out',
                userId: incident.source_data.userId
            }
        };
    }

    async requireAdditionalAuth(incident, action) {
        // Implementation would require additional authentication
        if (incident.source_data.userId && this.pool) {
            await this.pool.query(
                'UPDATE users SET requires_additional_auth = TRUE WHERE id = $1',
                [incident.source_data.userId]
            );
        }
        
        return { 
            success: true, 
            data: { 
                action: 'additional_auth_required',
                userId: incident.source_data.userId
            }
        };
    }

    // Helper methods for forensic evidence collection
    async captureSystemState() {
        return {
            timestamp: new Date(),
            activeConnections: 'placeholder', // Would capture actual system metrics
            memoryUsage: process.memoryUsage(),
            cpuUsage: 'placeholder'
        };
    }

    async captureNetworkLogs(clientIp) {
        // Would capture actual network logs
        return {
            clientIp,
            recentConnections: 'placeholder',
            trafficPatterns: 'placeholder'
        };
    }

    async captureUserActivity(userId) {
        if (!userId || !this.pool) return null;
        
        // Capture recent user activity
        const result = await this.pool.query(`
            SELECT operation, table_name, timestamp, risk_score
            FROM data_access_audit_log
            WHERE user_id = $1 AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
            ORDER BY timestamp DESC
            LIMIT 50
        `, [userId]);
        
        return result.rows;
    }

    // Incident management methods
    async getIncident(incidentId) {
        const incident = this.activeIncidents.get(incidentId);
        if (incident) return incident;

        if (this.pool) {
            const result = await this.pool.query(
                'SELECT * FROM security_incidents WHERE id = $1',
                [incidentId]
            );
            
            if (result.rows.length > 0) {
                const dbIncident = result.rows[0];
                // Convert DB format to internal format
                const incident = {
                    ...dbIncident,
                    source_data: JSON.parse(dbIncident.source_data || '{}'),
                    classification: JSON.parse(dbIncident.classification || '{}'),
                    auto_actions_taken: JSON.parse(dbIncident.auto_actions_taken || '[]'),
                    manual_actions_required: JSON.parse(dbIncident.manual_actions_required || '[]')
                };
                
                this.activeIncidents.set(incidentId, incident);
                return incident;
            }
        }

        return null;
    }

    async updateIncidentStatus(incidentId, status, notes = null) {
        const incident = await this.getIncident(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        incident.status = status;
        incident.updated_at = new Date();
        if (notes) {
            incident.resolution_notes = notes;
        }

        if (this.pool) {
            await this.pool.query(`
                UPDATE security_incidents 
                SET status = $1, updated_at = $2, resolution_notes = $3
                WHERE id = $4
            `, [status, incident.updated_at, notes, incidentId]);
        }

        // Log status change
        SecurityAuditLogger.log('Incident status updated', {
            incidentId,
            oldStatus: incident.status,
            newStatus: status,
            notes
        });

        return incident;
    }

    async processIncidentQueue() {
        // Process any pending incidents
        for (const [incidentId, incident] of this.activeIncidents) {
            if (incident.status === 'new') {
                await this.classifyIncident(incident);
                await this.executeInitialResponse(incident);
            }
        }
    }

    async checkEscalationRules() {
        const now = new Date();
        
        for (const [incidentId, incident] of this.activeIncidents) {
            if (incident.status === 'resolved') continue;
            
            const incidentAge = now - new Date(incident.created_at);
            const responseTime = now - new Date(incident.created_at);
            
            // Check if escalation is needed
            let shouldEscalate = false;
            let escalationReason = '';
            
            // Time-based escalation
            if (responseTime > incident.max_response_time * 1.5) {
                shouldEscalate = true;
                escalationReason = 'Response time exceeded';
            }
            
            // Unresolved incident escalation
            if (incidentAge > 3600000 && incident.status !== 'resolved') { // 1 hour
                shouldEscalate = true;
                escalationReason = 'Unresolved incident';
            }
            
            // Failed auto-actions escalation
            const failedActions = incident.auto_actions_taken.filter(a => a.status === 'failed').length;
            if (failedActions >= 2) {
                shouldEscalate = true;
                escalationReason = 'Multiple action failures';
            }
            
            if (shouldEscalate && incident.escalation_level < 2) {
                await this.escalateIncident(incidentId, escalationReason);
            }
        }
    }

    async escalateIncident(incidentId, reason) {
        const incident = await this.getIncident(incidentId);
        if (!incident) return;

        incident.escalation_level += 1;
        incident.updated_at = new Date();

        if (this.pool) {
            await this.pool.query(`
                UPDATE security_incidents 
                SET escalation_level = $1, updated_at = $2
                WHERE id = $3
            `, [incident.escalation_level, incident.updated_at, incidentId]);
        }

        // Log escalation
        SecurityAuditLogger.log('Incident escalated', {
            incidentId,
            escalationLevel: incident.escalation_level,
            reason
        });

        // Send escalation alerts
        await this.sendEscalationAlerts(incident, reason);
    }

    async sendEscalationAlerts(incident, reason) {
        // Implementation would send alerts to appropriate stakeholders
        console.log(`ESCALATION ALERT: Incident ${incident.id} escalated - ${reason}`);
    }

    async updateIncidentStatuses() {
        // Update status of active incidents based on conditions
        // This would include checking for resolution conditions, timeouts, etc.
    }

    async generateIncidentMetrics() {
        if (!this.pool) return;

        // Generate incident response metrics
        await this.pool.query(`
            INSERT INTO security_incident_metrics (
                metric_date, total_incidents, critical_incidents, 
                high_incidents, avg_response_time, resolved_incidents
            ) 
            SELECT 
                CURRENT_DATE,
                COUNT(*),
                COUNT(*) FILTER (WHERE severity = 'critical'),
                COUNT(*) FILTER (WHERE severity = 'high'),
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at))),
                COUNT(*) FILTER (WHERE status = 'resolved')
            FROM security_incidents 
            WHERE created_at >= CURRENT_DATE
            ON CONFLICT (metric_date) DO UPDATE SET
                total_incidents = EXCLUDED.total_incidents,
                critical_incidents = EXCLUDED.critical_incidents,
                high_incidents = EXCLUDED.high_incidents,
                avg_response_time = EXCLUDED.avg_response_time,
                resolved_incidents = EXCLUDED.resolved_incidents
        `);
    }

    async cleanupResolvedIncidents() {
        // Remove old resolved incidents from active memory
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

        for (const [incidentId, incident] of this.activeIncidents) {
            if (incident.status === 'resolved' && new Date(incident.updated_at) < cutoffTime) {
                this.activeIncidents.delete(incidentId);
            }
        }
    }

    // Public API methods
    isInitialized() {
        return this.initialized;
    }

    getActiveIncidentCount() {
        return Array.from(this.activeIncidents.values())
            .filter(i => i.status !== 'resolved').length;
    }

    getIncidentsByStatus(status) {
        return Array.from(this.activeIncidents.values())
            .filter(i => i.status === status);
    }

    getIncidentsBySeverity(severity) {
        return Array.from(this.activeIncidents.values())
            .filter(i => i.severity === severity);
    }
}

export default SecurityIncidentResponseService;
