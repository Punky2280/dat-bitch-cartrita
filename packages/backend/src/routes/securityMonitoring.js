/* global process, console */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, authorizePermissions } from '../middleware/securityMiddleware.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import db from '../db.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Rate limiting for security monitoring endpoints
const monitoringLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: { error: 'Security monitoring rate limit exceeded' }
});

// Vulnerability Scanning Service
class VulnerabilityScanner {
  constructor() {
    this.scanTypes = {
      'dependency': this.scanDependencies.bind(this),
      'infrastructure': this.scanInfrastructure.bind(this),
      'application': this.scanApplication.bind(this),
      'network': this.scanNetwork.bind(this)
    };
  }

  async initiateScan(scanType, configuration = {}, userId) {
    const span = OpenTelemetryTracing.startSpan('vulnerability.scan.initiate');
    
    try {
      // Create scan record
      const scanResult = await db.query(
        `INSERT INTO vulnerability_scans 
         (scan_type, status, scan_configuration, initiated_by, started_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [scanType, 'pending', JSON.stringify(configuration), userId]
      );

      const scanId = scanResult.rows[0].id;

      // Start scan asynchronously
      setImmediate(async () => {
        await this.executeScan(scanId, scanType, configuration);
      });

      span.addEvent('scan.initiated', { scanId, scanType });
      span.setStatus({ code: 1 });

      return scanResult.rows[0];

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  async executeScan(scanId, scanType, configuration) {
    const span = OpenTelemetryTracing.startSpan('vulnerability.scan.execute');
    
    try {
      // Update scan status to running
      await db.query(
        'UPDATE vulnerability_scans SET status = $1 WHERE id = $2',
        ['running', scanId]
      );

      const scanner = this.scanTypes[scanType];
      if (!scanner) {
        throw new Error(`Unknown scan type: ${scanType}`);
      }

      const results = await scanner(configuration);
      
      // Count vulnerabilities by severity
      const severityCounts = {
        critical: results.vulnerabilities.filter(v => v.severity === 'critical').length,
        high: results.vulnerabilities.filter(v => v.severity === 'high').length,
        medium: results.vulnerabilities.filter(v => v.severity === 'medium').length,
        low: results.vulnerabilities.filter(v => v.severity === 'low').length
      };

      // Update scan record with results
      await db.query(
        `UPDATE vulnerability_scans 
         SET status = $1, completed_at = NOW(), vulnerabilities_found = $2,
             critical_count = $3, high_count = $4, medium_count = $5, low_count = $6,
             scan_results = $7, recommendations = $8
         WHERE id = $9`,
        [
          'completed',
          results.vulnerabilities.length,
          severityCounts.critical,
          severityCounts.high,
          severityCounts.medium,
          severityCounts.low,
          JSON.stringify(results),
          results.recommendations,
          scanId
        ]
      );

      // Insert individual vulnerabilities
      for (const vuln of results.vulnerabilities) {
        await db.query(
          `INSERT INTO vulnerabilities 
           (scan_id, vulnerability_id, title, description, severity, cvss_score,
            category, affected_component, location, cwe_id, remediation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            scanId, vuln.id, vuln.title, vuln.description, vuln.severity,
            vuln.cvssScore, vuln.category, vuln.component, vuln.location,
            vuln.cweId, vuln.remediation
          ]
        );
      }

      span.addEvent('scan.completed', { 
        scanId, 
        vulnerabilitiesFound: results.vulnerabilities.length,
        severityCounts 
      });
      span.setStatus({ code: 1 });

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });

      // Update scan status to failed
      await db.query(
        'UPDATE vulnerability_scans SET status = $1, completed_at = NOW() WHERE id = $2',
        ['failed', scanId]
      );

      console.error(`Vulnerability scan ${scanId} failed:`, error);
    } finally {
      span.end();
    }
  }

  async scanDependencies(config) {
    // Mock dependency scanning (in production, integrate with tools like Snyk, OWASP, etc.)
    const mockVulnerabilities = [
      {
        id: 'CVE-2023-1234',
        title: 'Cross-site Scripting (XSS) in express',
        description: 'A vulnerability in express middleware allows XSS attacks',
        severity: 'high',
        cvssScore: 7.5,
        category: 'web-application',
        component: 'express@4.17.1',
        location: 'package.json',
        cweId: 'CWE-79',
        remediation: 'Upgrade to express@4.18.2 or later'
      }
    ];

    return {
      vulnerabilities: mockVulnerabilities,
      recommendations: ['Update outdated dependencies', 'Enable dependency scanning in CI/CD']
    };
  }

  async scanInfrastructure(config) {
    // Mock infrastructure scanning
    const mockVulnerabilities = [
      {
        id: 'INFRA-001',
        title: 'Unencrypted database connection',
        description: 'Database connections are not using TLS encryption',
        severity: 'medium',
        cvssScore: 5.3,
        category: 'infrastructure',
        component: 'postgresql',
        location: 'database configuration',
        cweId: 'CWE-319',
        remediation: 'Enable SSL/TLS for database connections'
      }
    ];

    return {
      vulnerabilities: mockVulnerabilities,
      recommendations: ['Enable database encryption', 'Review network security groups']
    };
  }

  async scanApplication(config) {
    // Mock application scanning
    const mockVulnerabilities = [
      {
        id: 'APP-001',
        title: 'Insufficient input validation',
        description: 'User input not properly sanitized in API endpoints',
        severity: 'medium',
        cvssScore: 6.1,
        category: 'application',
        component: 'api-routes',
        location: '/api/users',
        cweId: 'CWE-20',
        remediation: 'Implement comprehensive input validation'
      }
    ];

    return {
      vulnerabilities: mockVulnerabilities,
      recommendations: ['Implement input validation middleware', 'Add rate limiting']
    };
  }

  async scanNetwork(config) {
    // Mock network scanning
    const mockVulnerabilities = [];

    return {
      vulnerabilities: mockVulnerabilities,
      recommendations: ['Enable firewall rules', 'Monitor network traffic']
    };
  }
}

// Compliance Reporter Service
class ComplianceReporter {
  constructor() {
    this.frameworks = {
      'gdpr': this.generateGDPRReport.bind(this),
      'hipaa': this.generateHIPAAReport.bind(this),
      'sox': this.generateSOXReport.bind(this),
      'pci_dss': this.generatePCIDSSReport.bind(this),
      'iso27001': this.generateISO27001Report.bind(this)
    };
  }

  async generateReport(reportType, periodStart, periodEnd, userId) {
    const span = OpenTelemetryTracing.startSpan('compliance.report.generate');
    
    try {
      // Create report record
      const reportResult = await db.query(
        `INSERT INTO compliance_reports 
         (report_type, period_start, period_end, generated_by, generated_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [reportType, periodStart, periodEnd, userId]
      );

      const reportId = reportResult.rows[0].id;

      const reporter = this.frameworks[reportType];
      if (!reporter) {
        throw new Error(`Unknown report type: ${reportType}`);
      }

      const reportData = await reporter(periodStart, periodEnd);

      // Calculate overall compliance score
      const totalChecks = reportData.findings.length;
      const passedChecks = reportData.findings.filter(f => f.status === 'compliant').length;
      const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

      const complianceStatus = overallScore >= 95 ? 'compliant' : 
                              overallScore >= 70 ? 'partial' : 'non_compliant';

      // Update report with data
      await db.query(
        `UPDATE compliance_reports 
         SET overall_score = $1, compliance_status = $2, 
             findings = $3, recommendations = $4, report_data = $5
         WHERE id = $6`,
        [
          overallScore,
          complianceStatus,
          reportData.findings.length,
          reportData.recommendations.length,
          JSON.stringify(reportData),
          reportId
        ]
      );

      // Insert individual findings
      for (const finding of reportData.findings) {
        await db.query(
          `INSERT INTO compliance_findings 
           (report_id, finding_type, severity, title, description, 
            requirement, current_state, required_state, remediation_steps, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            reportId, finding.type, finding.severity, finding.title,
            finding.description, finding.requirement, finding.currentState,
            finding.requiredState, finding.remediationSteps, finding.status
          ]
        );
      }

      span.addEvent('report.generated', { reportId, reportType, overallScore });
      span.setStatus({ code: 1 });

      return reportResult.rows[0];

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  async generateGDPRReport(periodStart, periodEnd) {
    // Mock GDPR compliance check
    const findings = [
      {
        type: 'data_protection',
        severity: 'medium',
        title: 'Personal Data Encryption',
        description: 'Personal data should be encrypted at rest and in transit',
        requirement: 'Article 32 - Security of processing',
        currentState: 'Encrypted in transit, partial encryption at rest',
        requiredState: 'Full encryption at rest and in transit',
        remediationSteps: ['Enable database-level encryption', 'Review data encryption policies'],
        status: 'partial'
      }
    ];

    return {
      findings,
      recommendations: ['Implement full data encryption', 'Review consent management']
    };
  }

  async generateHIPAAReport(periodStart, periodEnd) {
    const findings = [
      {
        type: 'access_control',
        severity: 'high',
        title: 'Access Control Implementation',
        description: 'Implement proper access controls for PHI',
        requirement: '164.312(a)(1) - Access Control',
        currentState: 'Basic authentication implemented',
        requiredState: 'Role-based access control with audit logging',
        remediationSteps: ['Implement RBAC', 'Add comprehensive audit logging'],
        status: 'partial'
      }
    ];

    return {
      findings,
      recommendations: ['Enhance access controls', 'Implement audit logging']
    };
  }

  async generateSOXReport(periodStart, periodEnd) {
    const findings = [];
    return { findings, recommendations: ['Review financial controls'] };
  }

  async generatePCIDSSReport(periodStart, periodEnd) {
    const findings = [];
    return { findings, recommendations: ['Review payment processing security'] };
  }

  async generateISO27001Report(periodStart, periodEnd) {
    const findings = [];
    return { findings, recommendations: ['Review information security management'] };
  }
}

// Initialize services
const vulnerabilityScanner = new VulnerabilityScanner();
const complianceReporter = new ComplianceReporter();

// Routes

// Initiate vulnerability scan
router.post('/vulnerability/scan', monitoringLimiter, authenticateJWT, authorizePermissions(['vulnerabilities.scan']), async (req, res) => {
  try {
    const { scanType, configuration = {} } = req.body;

    if (!scanType || !vulnerabilityScanner.scanTypes[scanType]) {
      return res.status(400).json({
        success: false,
        error: 'Valid scan type required (dependency, infrastructure, application, network)'
      });
    }

    const scan = await vulnerabilityScanner.initiateScan(
      scanType, 
      configuration, 
      req.user.userId
    );

    res.json({
      success: true,
      data: scan
    });

  } catch (error) {
    console.error('Vulnerability scan initiation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate vulnerability scan'
    });
  }
});

// Get vulnerability scans
router.get('/vulnerability/scans', monitoringLimiter, authenticateJWT, authorizePermissions(['vulnerabilities.read']), async (req, res) => {
  try {
    const { status, scan_type, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM vulnerability_scans WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    if (scan_type) {
      query += ` AND scan_type = $${++paramCount}`;
      params.push(scan_type);
    }

    query += ` ORDER BY started_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const scans = await db.query(query, params);

    res.json({
      success: true,
      data: scans.rows
    });

  } catch (error) {
    console.error('Vulnerability scans retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerability scans'
    });
  }
});

// Get specific vulnerability scan results
router.get('/vulnerability/scans/:scanId', monitoringLimiter, authenticateJWT, authorizePermissions(['vulnerabilities.read']), async (req, res) => {
  try {
    const { scanId } = req.params;

    const scan = await db.query(
      'SELECT * FROM vulnerability_scans WHERE id = $1',
      [scanId]
    );

    if (scan.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vulnerability scan not found'
      });
    }

    const vulnerabilities = await db.query(
      'SELECT * FROM vulnerabilities WHERE scan_id = $1 ORDER BY severity DESC',
      [scanId]
    );

    res.json({
      success: true,
      data: {
        scan: scan.rows[0],
        vulnerabilities: vulnerabilities.rows
      }
    });

  } catch (error) {
    console.error('Vulnerability scan retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerability scan'
    });
  }
});

// Update vulnerability status
router.patch('/vulnerability/:vulnerabilityId', monitoringLimiter, authenticateJWT, authorizePermissions(['vulnerabilities.scan']), async (req, res) => {
  try {
    const { vulnerabilityId } = req.params;
    const { status, false_positive, notes } = req.body;

    if (!['open', 'in_progress', 'resolved', 'accepted_risk'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    await db.query(
      `UPDATE vulnerabilities 
       SET status = $1, false_positive = $2, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $3`,
      [status, false_positive || false, vulnerabilityId]
    );

    res.json({
      success: true,
      message: 'Vulnerability status updated'
    });

  } catch (error) {
    console.error('Vulnerability update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vulnerability'
    });
  }
});

// Generate compliance report
router.post('/compliance/report', monitoringLimiter, authenticateJWT, authorizePermissions(['compliance.generate']), async (req, res) => {
  try {
    const { reportType, periodStart, periodEnd } = req.body;

    if (!reportType || !complianceReporter.frameworks[reportType]) {
      return res.status(400).json({
        success: false,
        error: 'Valid report type required (gdpr, hipaa, sox, pci_dss, iso27001)'
      });
    }

    const report = await complianceReporter.generateReport(
      reportType,
      new Date(periodStart),
      new Date(periodEnd),
      req.user.userId
    );

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Compliance report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report'
    });
  }
});

// Get compliance reports
router.get('/compliance/reports', monitoringLimiter, authenticateJWT, authorizePermissions(['compliance.read']), async (req, res) => {
  try {
    const { report_type, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM compliance_reports WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (report_type) {
      query += ` AND report_type = $${++paramCount}`;
      params.push(report_type);
    }

    query += ` ORDER BY generated_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const reports = await db.query(query, params);

    res.json({
      success: true,
      data: reports.rows
    });

  } catch (error) {
    console.error('Compliance reports retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance reports'
    });
  }
});

// Get security events
router.get('/events', monitoringLimiter, authenticateJWT, authorizePermissions(['security.read']), async (req, res) => {
  try {
    const { severity, status, event_type, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM security_events WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (severity) {
      query += ` AND severity = $${++paramCount}`;
      params.push(severity);
    }

    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    if (event_type) {
      query += ` AND event_type = $${++paramCount}`;
      params.push(event_type);
    }

    query += ` ORDER BY first_detected DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const events = await db.query(query, params);

    res.json({
      success: true,
      data: events.rows
    });

  } catch (error) {
    console.error('Security events retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security events'
    });
  }
});

// Create security event
router.post('/events', monitoringLimiter, authenticateJWT, authorizePermissions(['security.manage']), async (req, res) => {
  try {
    const { eventType, severity, title, description, affectedUsers, sourceIp, detectionMethod, eventData } = req.body;

    if (!eventType || !severity || !title) {
      return res.status(400).json({
        success: false,
        error: 'Event type, severity, and title are required'
      });
    }

    const result = await db.query(
      `INSERT INTO security_events 
       (event_type, severity, title, description, affected_users, source_ip, 
        detection_method, event_data, first_detected, last_detected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [
        eventType, severity, title, description,
        affectedUsers || [], sourceIp, detectionMethod || 'manual',
        JSON.stringify(eventData || {})
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Security event creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create security event'
    });
  }
});

// Get audit logs
router.get('/audit', monitoringLimiter, authenticateJWT, authorizePermissions(['audit.read']), async (req, res) => {
  try {
    const { 
      event_type, outcome, severity, user_id, 
      start_date, end_date, limit = 100, offset = 0 
    } = req.query;

    let query = 'SELECT * FROM security_audit_log WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (event_type) {
      query += ` AND event_type = $${++paramCount}`;
      params.push(event_type);
    }

    if (outcome) {
      query += ` AND outcome = $${++paramCount}`;
      params.push(outcome);
    }

    if (severity) {
      query += ` AND severity = $${++paramCount}`;
      params.push(severity);
    }

    if (user_id) {
      query += ` AND user_id = $${++paramCount}`;
      params.push(user_id);
    }

    if (start_date) {
      query += ` AND timestamp >= $${++paramCount}`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND timestamp <= $${++paramCount}`;
      params.push(new Date(end_date));
    }

    query += ` ORDER BY timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const logs = await db.query(query, params);

    res.json({
      success: true,
      data: logs.rows
    });

  } catch (error) {
    console.error('Audit logs retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs'
    });
  }
});

export default router;
