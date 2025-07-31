// packages/backend/src/agi/security/SecurityAuditAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

class SecurityAuditAgent extends BaseAgent {
  constructor() {
    super('SecurityAuditAgent', 'main', [
      'threat_assessment',
      'vulnerability_scanning',
      'security_monitoring',
      'access_control',
      'incident_detection',
      'compliance_checking'
    ]);

    this.setupMessageHandlers();
    this.initializeSecurityEngine();
    this.status = 'ready';
    console.log('[SecurityAuditAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    MessageBus.on('security.audit', this.performSecurityAudit.bind(this));
    MessageBus.on('security.scan', this.performVulnerabilityScan.bind(this));
    MessageBus.on('security.monitor', this.monitorSecurityEvents.bind(this));
    MessageBus.on('access.control', this.validateAccessControl.bind(this));
    MessageBus.on('incident.detect', this.detectSecurityIncident.bind(this));
    MessageBus.on(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeSecurityEngine() {
    this.securityRules = {
      authentication: {
        min_password_length: 12,
        require_2fa: true,
        max_login_attempts: 5,
        session_timeout: 3600000, // 1 hour
        require_password_complexity: true
      },
      authorization: {
        principle_least_privilege: true,
        role_based_access: true,
        resource_permissions: true,
        audit_trail: true
      },
      data_protection: {
        encryption_at_rest: true,
        encryption_in_transit: true,
        data_masking: true,
        secure_deletion: true,
        backup_encryption: true
      },
      network_security: {
        firewall_enabled: true,
        intrusion_detection: true,
        secure_protocols_only: true,
        certificate_validation: true
      }
    };

    this.threatPatterns = new Map([
      ['sql_injection', /(\b(union|select|insert|update|delete|drop|exec|script)\b.*\b(from|where|order|group)\b)/i],
      ['xss_attack', /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=/i],
      ['path_traversal', /\.\.[\/\\]|\.\.%2[fF]|\.\.%5[cC]/],
      ['command_injection', /[;&|`$(){}[\]]/],
      ['ldap_injection', /[()=*!&|]/],
      ['nosql_injection', /\$where|\$ne|\$gt|\$lt|\$regex/],
      ['xxe_attack', /<!ENTITY|SYSTEM|PUBLIC/i]
    ]);

    this.securityMetrics = {
      audits_performed: 0,
      vulnerabilities_found: 0,
      threats_detected: 0,
      incidents_resolved: 0,
      compliance_checks: 0
    };

    this.activeThreats = new Map();
    this.securityEvents = [];
    this.complianceStatus = new Map();
  }

  async performSecurityAudit(message) {
    try {
      const { auditType, targetSystem, configuration } = message.payload;
      
      const auditResult = await this.conductSecurityAudit(auditType, targetSystem, configuration);
      
      this.securityMetrics.audits_performed++;

      MessageBus.publish(`security.audit.result.${message.id}`, {
        status: 'completed',
        audit_result: auditResult,
        audit_type: auditType,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - message.timestamp
      });

    } catch (error) {
      console.error('[SecurityAuditAgent] Error performing security audit:', error);
      MessageBus.publish(`security.audit.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async conductSecurityAudit(auditType, targetSystem, configuration) {
    const auditResults = {
      overall_score: 0,
      findings: [],
      recommendations: [],
      compliance_status: {},
      risk_assessment: {}
    };

    switch (auditType) {
      case 'comprehensive':
        auditResults.authentication = await this.auditAuthentication(targetSystem);
        auditResults.authorization = await this.auditAuthorization(targetSystem);
        auditResults.data_protection = await this.auditDataProtection(targetSystem);
        auditResults.network_security = await this.auditNetworkSecurity(targetSystem);
        break;
      case 'authentication':
        auditResults.authentication = await this.auditAuthentication(targetSystem);
        break;
      case 'data_protection':
        auditResults.data_protection = await this.auditDataProtection(targetSystem);
        break;
      default:
        auditResults.general = await this.auditGeneral(targetSystem);
    }

    // Calculate overall security score
    auditResults.overall_score = this.calculateSecurityScore(auditResults);
    
    // Generate AI-powered security recommendations
    auditResults.ai_recommendations = await this.generateSecurityRecommendations(
      auditType, 
      auditResults, 
      targetSystem
    );

    return auditResults;
  }

  async auditAuthentication(targetSystem) {
    const findings = [];
    const score = { total: 100, deductions: 0 };
    
    // Check password policy
    const passwordPolicy = targetSystem.security?.passwordPolicy;
    if (!passwordPolicy || passwordPolicy.minLength < this.securityRules.authentication.min_password_length) {
      findings.push({
        severity: 'high',
        category: 'password_policy',
        description: 'Weak password policy detected',
        recommendation: 'Enforce minimum 12-character passwords with complexity requirements'
      });
      score.deductions += 25;
    }

    // Check 2FA requirement
    if (!targetSystem.security?.require2FA) {
      findings.push({
        severity: 'high',
        category: '2fa',
        description: 'Two-factor authentication not enforced',
        recommendation: 'Implement mandatory 2FA for all user accounts'
      });
      score.deductions += 30;
    }

    // Check session management
    const sessionTimeout = targetSystem.security?.sessionTimeout;
    if (!sessionTimeout || sessionTimeout > this.securityRules.authentication.session_timeout) {
      findings.push({
        severity: 'medium',
        category: 'session_management',
        description: 'Session timeout too long or not configured',
        recommendation: 'Set session timeout to maximum 1 hour'
      });
      score.deductions += 15;
    }

    return {
      score: Math.max(0, score.total - score.deductions),
      findings,
      compliant: score.deductions < 30
    };
  }

  async auditDataProtection(targetSystem) {
    const findings = [];
    const score = { total: 100, deductions: 0 };

    // Check encryption at rest
    if (!targetSystem.encryption?.atRest) {
      findings.push({
        severity: 'critical',
        category: 'encryption',
        description: 'Data not encrypted at rest',
        recommendation: 'Implement AES-256 encryption for all stored data'
      });
      score.deductions += 40;
    }

    // Check encryption in transit
    if (!targetSystem.encryption?.inTransit) {
      findings.push({
        severity: 'critical',
        category: 'encryption',
        description: 'Data not encrypted in transit',
        recommendation: 'Enforce TLS 1.3 for all data transmission'
      });
      score.deductions += 35;
    }

    // Check data backup security
    if (!targetSystem.backup?.encrypted) {
      findings.push({
        severity: 'high',
        category: 'backup_security',
        description: 'Backups not encrypted',
        recommendation: 'Encrypt all backup data with separate keys'
      });
      score.deductions += 20;
    }

    return {
      score: Math.max(0, score.total - score.deductions),
      findings,
      compliant: score.deductions < 25
    };
  }

  async performVulnerabilityScan(message) {
    try {
      const { scanType, targets, depth } = message.payload;
      
      const scanResults = await this.runVulnerabilityScan(scanType, targets, depth);
      
      this.securityMetrics.vulnerabilities_found += scanResults.vulnerabilities.length;

      MessageBus.publish(`security.scan.result.${message.id}`, {
        status: 'completed',
        scan_results: scanResults,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SecurityAuditAgent] Error performing vulnerability scan:', error);
      MessageBus.publish(`security.scan.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async runVulnerabilityScan(scanType, targets, depth = 'standard') {
    const vulnerabilities = [];
    const scanResults = {
      scan_type: scanType,
      vulnerabilities,
      risk_summary: {},
      recommendations: []
    };

    // Simulate vulnerability scanning based on common patterns
    for (const target of targets) {
      if (target.type === 'web_application') {
        vulnerabilities.push(...await this.scanWebApplication(target));
      } else if (target.type === 'api_endpoint') {
        vulnerabilities.push(...await this.scanAPIEndpoint(target));
      } else if (target.type === 'database') {
        vulnerabilities.push(...await this.scanDatabase(target));
      }
    }

    // Risk assessment
    scanResults.risk_summary = this.assessVulnerabilityRisk(vulnerabilities);
    
    // Generate remediation recommendations
    scanResults.recommendations = this.generateRemediationPlan(vulnerabilities);

    return scanResults;
  }

  async scanWebApplication(target) {
    const vulnerabilities = [];
    
    // Check for common web vulnerabilities
    if (target.input_validation === false) {
      vulnerabilities.push({
        type: 'input_validation',
        severity: 'high',
        cve_id: 'CWE-20',
        description: 'Insufficient input validation detected',
        affected_component: target.url,
        remediation: 'Implement comprehensive input validation and sanitization'
      });
    }

    if (target.csrf_protection === false) {
      vulnerabilities.push({
        type: 'csrf',
        severity: 'medium',
        cve_id: 'CWE-352',
        description: 'Cross-Site Request Forgery protection missing',
        affected_component: target.url,
        remediation: 'Implement CSRF tokens for state-changing operations'
      });
    }

    if (target.secure_headers === false) {
      vulnerabilities.push({
        type: 'security_headers',
        severity: 'medium',
        cve_id: 'CWE-16',
        description: 'Missing security headers',
        affected_component: target.url,
        remediation: 'Add Content-Security-Policy, X-Frame-Options, and other security headers'
      });
    }

    return vulnerabilities;
  }

  async detectSecurityIncident(message) {
    try {
      const { eventData, context } = message.payload;
      
      const incidentAnalysis = await this.analyzeSecurityEvent(eventData, context);
      
      if (incidentAnalysis.is_incident) {
        this.securityMetrics.threats_detected++;
        await this.handleSecurityIncident(incidentAnalysis);
      }

      MessageBus.publish(`incident.detection.result.${message.id}`, {
        status: 'completed',
        analysis: incidentAnalysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SecurityAuditAgent] Error detecting security incident:', error);
      MessageBus.publish(`incident.detection.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async monitorSecurityEvents(message) {
    try {
      const { eventType, eventData, monitoringOptions = {} } = message.payload;
      
      const monitoringResult = await this.performSecurityMonitoring(
        eventType,
        eventData,
        monitoringOptions
      );

      // Store security events for analysis
      this.securityEvents.push({
        type: eventType,
        data: eventData,
        analysis: monitoringResult,
        timestamp: new Date().toISOString()
      });

      // Limit event history size
      if (this.securityEvents.length > 1000) {
        this.securityEvents = this.securityEvents.slice(-500);
      }

      MessageBus.publish(`security.monitoring.result.${message.id}`, {
        status: 'completed',
        monitoring_result: monitoringResult,
        event_type: eventType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SecurityAuditAgent] Error monitoring security events:', error);
      MessageBus.publish(`security.monitoring.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performSecurityMonitoring(eventType, eventData, options) {
    const monitoring = {
      event_type: eventType,
      risk_level: 'low',
      alerts_triggered: [],
      patterns_detected: [],
      recommendations: []
    };

    // Monitor based on event type
    switch (eventType) {
      case 'login_attempt':
        monitoring.risk_level = this.assessLoginRisk(eventData);
        break;
      case 'data_access':
        monitoring.risk_level = this.assessDataAccessRisk(eventData);
        break;
      case 'system_change':
        monitoring.risk_level = this.assessSystemChangeRisk(eventData);
        break;
      case 'network_activity':
        monitoring.risk_level = this.assessNetworkRisk(eventData);
        break;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(eventType, eventData);
    if (suspiciousPatterns.length > 0) {
      monitoring.patterns_detected = suspiciousPatterns;
      monitoring.risk_level = 'high';
    }

    // Generate recommendations
    monitoring.recommendations = this.generateSecurityRecommendations(monitoring);

    return monitoring;
  }

  assessLoginRisk(eventData) {
    if (eventData.failed_attempts > 5) return 'high';
    if (eventData.unusual_location) return 'medium';
    if (eventData.unusual_time) return 'medium';
    return 'low';
  }

  assessDataAccessRisk(eventData) {
    if (eventData.sensitive_data && !eventData.authorized) return 'critical';
    if (eventData.bulk_access) return 'medium';
    return 'low';
  }

  assessSystemChangeRisk(eventData) {
    if (eventData.critical_system) return 'high';
    if (eventData.unauthorized_change) return 'critical';
    return 'low';
  }

  assessNetworkRisk(eventData) {
    if (eventData.external_connection && eventData.suspicious_ip) return 'high';
    if (eventData.unusual_traffic_pattern) return 'medium';
    return 'low';
  }

  detectSuspiciousPatterns(eventType, eventData) {
    const patterns = [];
    
    // Check for rapid repeated attempts
    if (eventData.frequency && eventData.frequency > 10) {
      patterns.push('rapid_repeated_attempts');
    }

    // Check for privilege escalation
    if (eventData.privilege_change && eventData.privilege_change === 'elevated') {
      patterns.push('privilege_escalation');
    }

    // Check for data exfiltration signs
    if (eventData.data_volume && eventData.data_volume > 1000000) {
      patterns.push('potential_data_exfiltration');
    }

    return patterns;
  }

  async validateAccessControl(message) {
    try {
      const { userId, resource, action, context = {} } = message.payload;
      
      const accessValidation = await this.performAccessControlValidation(
        userId,
        resource,
        action,
        context
      );

      MessageBus.publish(`access.control.result.${message.id}`, {
        status: 'completed',
        validation: accessValidation,
        user_id: userId,
        resource,
        action,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SecurityAuditAgent] Error validating access control:', error);
      MessageBus.publish(`access.control.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performAccessControlValidation(userId, resource, action, context) {
    const validation = {
      user_id: userId,
      resource,
      action,
      access_granted: false,
      reason: 'Access denied by default',
      risk_assessment: 'low',
      additional_checks_required: []
    };

    // Simulate access control logic
    // In production, this would integrate with actual RBAC/ABAC systems
    
    // Basic permission check
    if (this.hasBasicPermission(userId, resource, action)) {
      validation.access_granted = true;
      validation.reason = 'Basic permissions granted';
    }

    // Context-based checks
    if (context.ip_address && this.isSuspiciousIP(context.ip_address)) {
      validation.access_granted = false;
      validation.reason = 'Access denied: Suspicious IP address';
      validation.risk_assessment = 'high';
      validation.additional_checks_required.push('ip_verification');
    }

    // Time-based access control
    if (context.time && this.isOutsideBusinessHours(context.time)) {
      validation.additional_checks_required.push('manager_approval');
      validation.risk_assessment = 'medium';
    }

    // Sensitive resource checks
    if (this.isSensitiveResource(resource)) {
      validation.additional_checks_required.push('mfa_verification');
      if (validation.risk_assessment === 'low') {
        validation.risk_assessment = 'medium';
      }
    }

    return validation;
  }

  hasBasicPermission(userId, resource, action) {
    // Simplified permission check
    // In production, would query actual permissions database
    return userId && resource && action;
  }

  isSensitiveResource(resource) {
    const sensitiveResources = [
      'user_data',
      'financial_records',
      'security_settings',
      'admin_panel',
      'system_configuration'
    ];
    return sensitiveResources.some(sensitive => resource.includes(sensitive));
  }

  isOutsideBusinessHours(time) {
    const hour = new Date(time).getHours();
    return hour < 8 || hour > 18; // Outside 8 AM - 6 PM
  }

  async analyzeSecurityEvent(eventData, context) {
    const analysis = {
      is_incident: false,
      threat_level: 'low',
      incident_type: null,
      confidence: 0,
      indicators: [],
      recommended_actions: []
    };

    // Check for known threat patterns
    for (const [threatType, pattern] of this.threatPatterns) {
      if (pattern.test(eventData.payload || '')) {
        analysis.is_incident = true;
        analysis.incident_type = threatType;
        analysis.threat_level = this.getThreatLevel(threatType);
        analysis.confidence = 0.85;
        analysis.indicators.push(`${threatType} pattern detected`);
      }
    }

    // Check for behavioral anomalies
    const anomalies = this.detectAnomalies(eventData, context);
    if (anomalies.length > 0) {
      analysis.indicators.push(...anomalies);
      if (anomalies.length > 2) {
        analysis.is_incident = true;
        analysis.threat_level = 'medium';
        analysis.confidence = Math.min(0.9, analysis.confidence + 0.3);
      }
    }

    // Generate AI-powered threat analysis
    if (analysis.is_incident) {
      const aiAnalysis = await this.generateThreatAnalysis(eventData, context, analysis);
      analysis.ai_insights = aiAnalysis;
    }

    return analysis;
  }

  async generateSecurityRecommendations(auditType, auditResults, targetSystem) {
    const prompt = `
    Analyze this security audit and provide specific improvement recommendations:
    
    Audit Type: ${auditType}
    Audit Results: ${JSON.stringify(auditResults, null, 2)}
    Target System: ${JSON.stringify(targetSystem, null, 2)}
    
    Please provide:
    1. Priority-ranked security improvements
    2. Specific implementation guidance
    3. Risk mitigation strategies
    4. Compliance considerations
    5. Cost-benefit analysis for each recommendation
    
    Format as actionable security recommendations with implementation timelines.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      });

      return {
        recommendations: response.choices[0].message.content,
        confidence: 0.9,
        source: 'GPT-4 Security Analysis',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        recommendations: 'Unable to generate AI security recommendations at this time',
        confidence: 0.1,
        error: error.message
      };
    }
  }

  calculateSecurityScore(auditResults) {
    const scores = [];
    
    if (auditResults.authentication) scores.push(auditResults.authentication.score);
    if (auditResults.authorization) scores.push(auditResults.authorization.score);
    if (auditResults.data_protection) scores.push(auditResults.data_protection.score);
    if (auditResults.network_security) scores.push(auditResults.network_security.score);
    
    return scores.length > 0 ? 
      Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 
      50; // Default score
  }

  getThreatLevel(threatType) {
    const highRiskThreats = ['sql_injection', 'xss_attack', 'command_injection'];
    const mediumRiskThreats = ['path_traversal', 'xxe_attack'];
    
    if (highRiskThreats.includes(threatType)) return 'high';
    if (mediumRiskThreats.includes(threatType)) return 'medium';
    return 'low';
  }

  detectAnomalies(eventData, context) {
    const anomalies = [];
    
    // Check for unusual access patterns
    if (eventData.failed_attempts > 10) {
      anomalies.push('Excessive failed login attempts');
    }
    
    if (eventData.access_time && this.isUnusualAccessTime(eventData.access_time)) {
      anomalies.push('Access during unusual hours');
    }
    
    if (eventData.ip_address && this.isSuspiciousIP(eventData.ip_address)) {
      anomalies.push('Access from suspicious IP address');
    }
    
    return anomalies;
  }

  isUnusualAccessTime(accessTime) {
    const hour = new Date(accessTime).getHours();
    return hour < 6 || hour > 22; // Outside business hours
  }

  isSuspiciousIP(ipAddress) {
    // Simple check for private IP ranges (in production, would check against threat intelligence)
    const privateRanges = ['127.', '192.168.', '10.', '172.'];
    return !privateRanges.some(range => ipAddress.startsWith(range));
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        audits_performed: this.securityMetrics.audits_performed,
        vulnerabilities_found: this.securityMetrics.vulnerabilities_found,
        threats_detected: this.securityMetrics.threats_detected,
        active_threats: this.activeThreats.size,
        security_events: this.securityEvents.length
      },
      security_status: {
        threat_level: this.activeThreats.size > 0 ? 'elevated' : 'normal',
        last_audit: this.securityMetrics.audits_performed > 0 ? new Date().toISOString() : null
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new SecurityAuditAgent();