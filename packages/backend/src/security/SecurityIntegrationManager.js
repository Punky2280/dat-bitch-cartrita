import express from 'express';
import SecurityEventDetector from './SecurityEventDetector.js';
import EnhancedRateLimitService from '../services/EnhancedRateLimitService.js';
import MFAService from '../services/MFAService.js';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Security Integration Manager
 * Coordinates all security components and provides centralized security services
 */
class SecurityIntegrationManager {
  constructor() {
    this.isInitialized = false;
    this.securityComponents = new Map();
    this.monitoringInterval = null;
    this.rateLimiters = null;
  }

  /**
   * Initialize all security components
   */
  async initialize() {
    return await OpenTelemetryTracing.traceOperation('security.integration.initialize', async (span) => {
      try {
        console.log('Initializing Security Integration Manager...');

        // Initialize SecurityEventDetector
        await SecurityEventDetector.initialize();
        this.securityComponents.set('eventDetector', SecurityEventDetector);
        
        // Initialize EnhancedRateLimitService
        await EnhancedRateLimitService.initialize();
        this.rateLimiters = EnhancedRateLimitService.getPreConfiguredLimiters();
        this.securityComponents.set('rateLimitService', EnhancedRateLimitService);
        
        // MFAService is stateless, just add to registry
        this.securityComponents.set('mfaService', MFAService);
        
        // Start security monitoring
        this.startSecurityMonitoring();
        
        // Initialize cleanup routines
        this.initializeCleanupRoutines();
        
        this.isInitialized = true;
        console.log('Security Integration Manager initialized successfully');
        
        span?.setAttributes({
          'security.components_initialized': this.securityComponents.size,
          'security.monitoring_active': !!this.monitoringInterval
        });
        
      } catch (error) {
        span?.recordException(error);
        console.error('Security Integration Manager initialization failed:', error);
        throw error;
      }
    });
  }

  /**
   * Start continuous security monitoring
   */
  startSecurityMonitoring() {
    // Run security checks every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.performSecurityChecks();
    }, 5 * 60 * 1000);
    
    console.log('Security monitoring started (5-minute intervals)');
  }

  /**
   * Perform periodic security checks
   */
  async performSecurityChecks() {
    return await OpenTelemetryTracing.traceOperation('security.periodic_checks', async (span) => {
      try {
        // Check for suspicious activity patterns
        await this.checkSuspiciousPatterns();
        
        // Clean up old security events
        await this.cleanupOldEvents();
        
        // Update IP reputation scores
        await this.updateIPReputations();
        
        // Check for expired blacklist entries
        await this.cleanupExpiredBlacklist();
        
        // Generate security metrics
        await this.generateSecurityMetrics();
        
      } catch (error) {
        span?.recordException(error);
        console.error('Security monitoring check failed:', error);
      }
    });
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousPatterns() {
    try {
      // Find IPs with high event frequency
      const suspiciousIPsResult = await db.query(`
        SELECT ip_address,
               COUNT(*) as event_count,
               COUNT(DISTINCT type) as event_types,
               MAX(timestamp) as last_event
        FROM security_events
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY ip_address
        HAVING COUNT(*) > 20
        ORDER BY event_count DESC
        LIMIT 10
      `);

      for (const row of suspiciousIPsResult.rows) {
        const { ip_address, event_count, event_types, last_event } = row;
        
        // Check if IP should be auto-blacklisted
        if (event_count > 50 || event_types > 5) {
          await SecurityEventDetector.handleSuspiciousActivity(
            ip_address,
            null,
            'automated_pattern_detection',
            {
              event_count,
              event_types,
              last_event,
              reason: 'Automated blacklist due to suspicious activity pattern'
            }
          );
        }
      }

      // Check for failed login patterns
      await this.checkFailedLoginPatterns();
      
    } catch (error) {
      console.error('Suspicious pattern check failed:', error);
    }
  }

  /**
   * Check for failed login patterns
   */
  async checkFailedLoginPatterns() {
    try {
      // Find accounts with many failed attempts
      const failedAttemptsResult = await db.query(`
        SELECT email, ip_address,
               COUNT(*) as attempt_count,
               MAX(last_attempt) as last_attempt
        FROM failed_login_attempts
        WHERE last_attempt > NOW() - INTERVAL '1 hour'
        GROUP BY email, ip_address
        HAVING COUNT(*) > 10
      `);

      for (const row of failedAttemptsResult.rows) {
        const { email, ip_address, attempt_count } = row;
        
        // Trigger brute force detection
        await SecurityEventDetector.detectFailedLogin(ip_address, email, {
          attempt_count,
          automated_detection: true
        });
      }
    } catch (error) {
      console.error('Failed login pattern check failed:', error);
    }
  }

  /**
   * Clean up old security events
   */
  async cleanupOldEvents() {
    try {
      // Remove events older than 30 days
      const result = await db.query(`
        DELETE FROM security_events 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `);
      
      if (result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} old security events`);
      }
    } catch (error) {
      console.error('Security events cleanup failed:', error);
    }
  }

  /**
   * Update IP reputation scores
   */
  async updateIPReputations() {
    try {
      // This would integrate with external IP reputation services
      // For now, we'll update based on recent activity
      
      const recentThreatsResult = await db.query(`
        SELECT ip_address,
               COUNT(*) as threat_count,
               MAX(timestamp) as last_threat
        FROM security_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND severity IN ('high', 'critical')
        GROUP BY ip_address
        HAVING COUNT(*) > 5
      `);

      for (const row of recentThreatsResult.rows) {
        // Update reputation or add to monitoring list
        console.log(`High threat activity from IP: ${row.ip_address} (${row.threat_count} events)`);
      }
    } catch (error) {
      console.error('IP reputation update failed:', error);
    }
  }

  /**
   * Clean up expired blacklist entries
   */
  async cleanupExpiredBlacklist() {
    try {
      const result = await db.query(`
        UPDATE ip_blacklist 
        SET is_active = false 
        WHERE expires_at IS NOT NULL 
          AND expires_at < NOW() 
          AND is_active = true
      `);
      
      if (result.rowCount > 0) {
        console.log(`Expired ${result.rowCount} blacklist entries`);
      }
    } catch (error) {
      console.error('Blacklist cleanup failed:', error);
    }
  }

  /**
   * Generate security metrics
   */
  async generateSecurityMetrics() {
    try {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Get security stats for the last hour
      const metricsResult = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity = 'low') as low_severity,
          COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity,
          COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_severity,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT type) as event_types
        FROM security_events
        WHERE timestamp > $1
      `, [hourAgo]);

      const metrics = metricsResult.rows[0];
      
      // Store metrics in security_metrics table
      await db.query(`
        INSERT INTO security_metrics (
          timestamp, total_events, low_severity_events, medium_severity_events,
          high_severity_events, critical_severity_events, unique_ips, event_types,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        now,
        metrics.total_events,
        metrics.low_severity,
        metrics.medium_severity,
        metrics.high_severity,
        metrics.critical_severity,
        metrics.unique_ips,
        metrics.event_types,
        JSON.stringify({ period: 'hourly', automated: true })
      ]);

    } catch (error) {
      console.error('Security metrics generation failed:', error);
    }
  }

  /**
   * Initialize cleanup routines
   */
  initializeCleanupRoutines() {
    // Clean up failed login attempts older than 7 days
    setInterval(async () => {
      try {
        await db.query(`
          DELETE FROM failed_login_attempts 
          WHERE last_attempt < NOW() - INTERVAL '7 days'
        `);
      } catch (error) {
        console.error('Failed login cleanup error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily

    // Clean up resolved security alerts older than 90 days
    setInterval(async () => {
      try {
        await db.query(`
          DELETE FROM security_alerts 
          WHERE status IN ('resolved', 'false_positive') 
            AND resolved_at < NOW() - INTERVAL '90 days'
        `);
      } catch (error) {
        console.error('Security alerts cleanup error:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  /**
   * Apply security middleware to Express app
   */
  applySecurityMiddleware(app) {
    if (!this.isInitialized) {
      throw new Error('Security Integration Manager must be initialized first');
    }

    console.log('Applying security middleware...');

    // Apply rate limiting to different route categories
    app.use('/api/auth', this.rateLimiters.auth);
    app.use('/api/auth/reset-password', this.rateLimiters.passwordReset);
    app.use('/api/upload', this.rateLimiters.upload);
    app.use('/api/chat', this.rateLimiters.chat);
    app.use('/api/search', this.rateLimiters.search);
    app.use('/api/workflow', this.rateLimiters.workflow);
    app.use('/api', this.rateLimiters.api); // General API rate limiting

    // Security headers middleware
    app.use(this.createSecurityHeadersMiddleware());

    // IP blacklist checking middleware
    app.use(this.createBlacklistMiddleware());

    // Request monitoring middleware
    app.use(this.createMonitoringMiddleware());

    console.log('Security middleware applied successfully');
  }

  /**
   * Create security headers middleware
   */
  createSecurityHeadersMiddleware() {
    return (req, res, next) => {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // CSP header (adjust based on your needs)
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https: wss:"
      );

      next();
    };
  }

  /**
   * Create IP blacklist checking middleware
   */
  createBlacklistMiddleware() {
    return async (req, res, next) => {
      const ip = EnhancedRateLimitService.getClientIP(req);
      
      try {
        // Check if IP is blacklisted
        const blacklistResult = await db.query(`
          SELECT reason, expires_at FROM ip_blacklist
          WHERE ip_address = $1 AND is_active = true
        `, [ip]);

        if (blacklistResult.rows.length > 0) {
          const blacklist = blacklistResult.rows[0];
          
          // Check if blacklist has expired
          if (blacklist.expires_at && new Date() > blacklist.expires_at) {
            await db.query(`
              UPDATE ip_blacklist SET is_active = false 
              WHERE ip_address = $1
            `, [ip]);
          } else {
            // IP is actively blacklisted
            await SecurityEventDetector.logSecurityEvent(
              'blacklist_access_attempt',
              'medium',
              ip,
              null,
              { reason: blacklist.reason }
            );
            
            return res.status(403).json({
              success: false,
              error: 'Access denied'
            });
          }
        }
      } catch (error) {
        console.error('Blacklist check error:', error);
        // Continue on error to avoid blocking legitimate users
      }

      next();
    };
  }

  /**
   * Create request monitoring middleware
   */
  createMonitoringMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const ip = EnhancedRateLimitService.getClientIP(req);
      
      // Monitor for suspicious patterns
      const userAgent = req.get('user-agent') || '';
      const path = req.path;
      
      // Check for suspicious user agents or paths
      if (this.isSuspiciousRequest(req)) {
        await SecurityEventDetector.logSecurityEvent(
          'suspicious_request',
          'low',
          ip,
          req.user?.id,
          {
            userAgent,
            path,
            method: req.method,
            headers: req.headers
          }
        );
      }
      
      // Continue with request
      res.on('finish', async () => {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Log slow or failed requests
        if (responseTime > 5000 || statusCode >= 500) {
          await SecurityEventDetector.logSecurityEvent(
            statusCode >= 500 ? 'server_error' : 'slow_request',
            statusCode >= 500 ? 'medium' : 'low',
            ip,
            req.user?.id,
            {
              responseTime,
              statusCode,
              path,
              method: req.method
            }
          );
        }
      });
      
      next();
    };
  }

  /**
   * Check if request is suspicious
   */
  isSuspiciousRequest(req) {
    const userAgent = req.get('user-agent') || '';
    const path = req.path;
    
    // Suspicious user agents
    const suspiciousUAs = [
      'sqlmap', 'nikto', 'nmap', 'masscan', 'zmap',
      'bot', 'crawler', 'spider', 'scraper'
    ];
    
    if (suspiciousUAs.some(ua => userAgent.toLowerCase().includes(ua))) {
      return true;
    }
    
    // Suspicious paths
    const suspiciousPaths = [
      '/admin', '/.env', '/config', '/backup',
      '/wp-admin', '/phpinfo', '/shell', '/cmd'
    ];
    
    if (suspiciousPaths.some(sp => path.includes(sp))) {
      return true;
    }
    
    return false;
  }

  /**
   * Get security status overview
   */
  async getSecurityStatus() {
    const span = OpenTelemetryTracing.traceOperation('security.status.overview');
    
    try {
      const stats = {
        components: {
          eventDetector: this.securityComponents.has('eventDetector'),
          rateLimitService: this.securityComponents.has('rateLimitService'),
          mfaService: this.securityComponents.has('mfaService')
        },
        monitoring: {
          active: !!this.monitoringInterval,
          lastCheck: new Date().toISOString()
        },
        eventDetectorStats: SecurityEventDetector.getStats(),
        initialized: this.isInitialized
      };
      
      return stats;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Shutdown security components
   */
  async shutdown() {
    console.log('Shutting down Security Integration Manager...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Cleanup rate limit service
    if (this.securityComponents.has('rateLimitService')) {
      EnhancedRateLimitService.cleanup();
    }
    
    console.log('Security Integration Manager shut down completed');
  }
}

export default new SecurityIntegrationManager();
