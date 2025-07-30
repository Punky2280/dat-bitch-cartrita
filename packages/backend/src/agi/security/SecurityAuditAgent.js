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
    MessageBus.subscribe('security.audit', this.performSecurityAudit.bind(this));
    MessageBus.subscribe('security.scan', this.performVulnerabilityScan.bind(this));
    MessageBus.subscribe('security.monitor', this.monitorSecurityEvents.bind(this));
    MessageBus.subscribe('access.control', this.validateAccessControl.bind(this));
    MessageBus.subscribe('incident.detect', this.detectSecurityIncident.bind(this));
    MessageBus.subscribe(`${this.agentId}.health`, this.healthCheck.bind(this));
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