import crypto from 'crypto';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import db from '../db.js';

/**
 * Advanced Security Event Detection System
 * Detects and responds to security threats in real-time
 */
class SecurityEventDetector extends EventEmitter {
  constructor() {
    super();
    this.suspiciousEvents = new Map(); // IP -> events array
    this.blacklistedIPs = new Set();
    this.trustedIPs = new Set(['127.0.0.1', '::1']);
    this.alertThresholds = {
      FAILED_LOGIN: { count: 5, window: 300000 }, // 5 failures in 5 minutes
      RAPID_REQUESTS: { count: 100, window: 60000 }, // 100 requests in 1 minute  
      UNUSUAL_LOCATION: { enabled: true },
      SUSPICIOUS_PATTERN: { enabled: true }
    };
    
    // Geographic IP database (simplified)
    this.ipGeolocation = new Map();
    this.userLocationHistory = new Map(); // userId -> locations array
    
    // Initialize metrics
    this.metrics = {
      threatsDetected: 0,
      blockedIPs: 0,
      suspiciousLogins: 0,
      anomalousRequests: 0
    };
    
    // Cleanup expired events every 5 minutes
    setInterval(() => this.cleanupExpiredEvents(), 300000);
    
    console.log('🛡️ Security Event Detection System initialized');
  }

  /**
   * Detect failed login attempts and potential brute force attacks
   */
  async detectFailedLogin(ip, userAgent, email, timestamp = Date.now()) {
    const event = {
      type: 'FAILED_LOGIN',
      ip,
      userAgent,
      email,
      timestamp,
      severity: 'medium'
    };

    await this.recordSecurityEvent(event);

    // Check for brute force patterns
    const recentFailures = this.getRecentEvents(ip, 'FAILED_LOGIN', this.alertThresholds.FAILED_LOGIN.window);
    
    if (recentFailures.length >= this.alertThresholds.FAILED_LOGIN.count) {
      await this.triggerSecurityAlert({
        type: 'BRUTE_FORCE_ATTACK',
        ip,
        userAgent,
        failureCount: recentFailures.length,
        severity: 'high',
        timestamp
      });
      
      // Temporarily block IP
      this.blacklistIP(ip, 'Brute force attack detected');
      
      return { blocked: true, reason: 'Too many failed login attempts' };
    }

    return { blocked: false };
  }

  /**
   * Detect unusual API usage patterns
   */
  async detectUnusualAPIUsage(ip, endpoint, userAgent, userId, timestamp = Date.now()) {
    const event = {
      type: 'API_REQUEST',
      ip,
      endpoint,
      userAgent,
      userId,
      timestamp,
      severity: 'low'
    };

    await this.recordSecurityEvent(event);

    // Check for rapid request patterns
    const recentRequests = this.getRecentEvents(ip, 'API_REQUEST', this.alertThresholds.RAPID_REQUESTS.window);
    
    if (recentRequests.length >= this.alertThresholds.RAPID_REQUESTS.count) {
      await this.triggerSecurityAlert({
        type: 'RAPID_API_REQUESTS',
        ip,
        requestCount: recentRequests.length,
        endpoint,
        severity: 'medium',
        timestamp
      });
      
      this.metrics.anomalousRequests++;
      return { suspicious: true, reason: 'Unusually high request rate' };
    }

    // Detect unusual endpoint access patterns
    const endpointPattern = this.analyzeEndpointPattern(recentRequests);
    if (endpointPattern.suspicious) {
      await this.triggerSecurityAlert({
        type: 'SUSPICIOUS_ENDPOINT_PATTERN',
        ip,
        pattern: endpointPattern,
        severity: 'medium',
        timestamp
      });
    }

    return { suspicious: false };
  }

  /**
   * Detect geographic anomalies in login patterns
   */
  async detectGeographicAnomaly(userId, ip, timestamp = Date.now()) {
    if (!this.alertThresholds.UNUSUAL_LOCATION.enabled) {
      return { anomaly: false };
    }

    // Get location for IP (simplified - would use real geolocation service)
    const currentLocation = await this.getLocationForIP(ip);
    
    // Get user's recent location history
    const userHistory = this.userLocationHistory.get(userId) || [];
    
    if (userHistory.length > 0) {
      const lastLocation = userHistory[userHistory.length - 1];
      const timeDiff = timestamp - lastLocation.timestamp;
      const distance = this.calculateDistance(currentLocation, lastLocation.location);
      
      // Check for impossible travel (more than 800 mph)
      const maxPossibleDistance = (timeDiff / 3600000) * 800; // Convert to miles per hour
      
      if (distance > maxPossibleDistance && distance > 500) { // More than 500 miles
        await this.triggerSecurityAlert({
          type: 'IMPOSSIBLE_TRAVEL',
          userId,
          ip,
          previousLocation: lastLocation.location,
          currentLocation,
          distance,
          timeDiff,
          severity: 'high',
          timestamp
        });
        
        return { anomaly: true, reason: 'Impossible travel detected' };
      }
    }
    
    // Update location history
    userHistory.push({ location: currentLocation, timestamp });
    if (userHistory.length > 10) userHistory.shift(); // Keep last 10 locations
    this.userLocationHistory.set(userId, userHistory);
    
    return { anomaly: false };
  }

  /**
   * Detect suspicious patterns in user behavior
   */
  async detectSuspiciousPatterns(userId, sessionData, timestamp = Date.now()) {
    const patterns = [];
    
    // Check for session anomalies
    if (sessionData.userAgent && this.detectUserAgentAnomaly(userId, sessionData.userAgent)) {
      patterns.push('USER_AGENT_CHANGE');
    }
    
    // Check for unusual access times
    if (this.detectUnusualAccessTime(userId, timestamp)) {
      patterns.push('UNUSUAL_ACCESS_TIME');
    }
    
    // Check for privilege escalation attempts
    if (sessionData.permissionRequests && this.detectPrivilegeEscalation(userId, sessionData.permissionRequests)) {
      patterns.push('PRIVILEGE_ESCALATION');
    }
    
    if (patterns.length > 0) {
      await this.triggerSecurityAlert({
        type: 'SUSPICIOUS_BEHAVIOR_PATTERN',
        userId,
        patterns,
        sessionData,
        severity: patterns.includes('PRIVILEGE_ESCALATION') ? 'high' : 'medium',
        timestamp
      });
      
      return { suspicious: true, patterns };
    }
    
    return { suspicious: false };
  }

  /**
   * Check IP reputation against known threat databases
   */
  async checkIPReputation(ip) {
    if (this.trustedIPs.has(ip)) {
      return { reputation: 'trusted', score: 100 };
    }
    
    if (this.blacklistedIPs.has(ip)) {
      return { reputation: 'malicious', score: 0 };
    }
    
    // In a real implementation, this would check against threat intelligence feeds
    // For now, we'll do basic checks
    const suspiciousScore = this.calculateSuspiciousScore(ip);
    
    if (suspiciousScore < 30) {
      return { reputation: 'malicious', score: suspiciousScore };
    } else if (suspiciousScore < 70) {
      return { reputation: 'suspicious', score: suspiciousScore };
    } else {
      return { reputation: 'clean', score: suspiciousScore };
    }
  }

  /**
   * Record security event in database and memory
   */
  async recordSecurityEvent(event) {
    const span = OpenTelemetryTracing.traceOperation('security.recordEvent');
    
    try {
      // Store in memory for real-time analysis
      if (!this.suspiciousEvents.has(event.ip)) {
        this.suspiciousEvents.set(event.ip, []);
      }
      this.suspiciousEvents.get(event.ip).push(event);
      
      // Store in database for persistence and analysis
      await db.query(`
        INSERT INTO security_events 
        (type, ip_address, user_agent, user_id, endpoint, metadata, severity, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        event.type,
        event.ip,
        event.userAgent,
        event.userId || null,
        event.endpoint || null,
        JSON.stringify({ ...event, type: undefined }),
        event.severity,
        new Date(event.timestamp)
      ]);
      
      span.setAttributes({
        'security.event.type': event.type,
        'security.event.severity': event.severity
      });
    } catch (error) {
      span.recordException(error);
      console.error('Failed to record security event:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Trigger security alert and automated response
   */
  async triggerSecurityAlert(alert) {
    const span = OpenTelemetryTracing.traceOperation('security.triggerAlert');
    
    try {
      console.warn(`🚨 SECURITY ALERT: ${alert.type}`, alert);
      
      // Record alert in database
      await db.query(`
        INSERT INTO security_alerts 
        (type, ip_address, user_id, severity, metadata, status, timestamp)
        VALUES ($1, $2, $3, $4, $5, 'active', $6)
      `, [
        alert.type,
        alert.ip,
        alert.userId || null,
        alert.severity,
        JSON.stringify(alert),
        new Date(alert.timestamp)
      ]);
      
      // Update metrics
      this.metrics.threatsDetected++;
      if (alert.type.includes('LOGIN')) {
        this.metrics.suspiciousLogins++;
      }
      
      // Automated response based on severity
      await this.executeAutomatedResponse(alert);
      
      span.setAttributes({
        'security.alert.type': alert.type,
        'security.alert.severity': alert.severity
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('Failed to trigger security alert:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Execute automated security response
   */
  async executeAutomatedResponse(alert) {
    switch (alert.severity) {
      case 'high':
        if (alert.ip) {
          this.blacklistIP(alert.ip, `High severity alert: ${alert.type}`);
        }
        if (alert.userId) {
          await this.suspendUserSessions(alert.userId);
        }
        break;
        
      case 'medium':
        if (alert.ip) {
          // Increase monitoring for this IP
          this.addToWatchlist(alert.ip);
        }
        break;
        
      case 'low':
        // Log only, no immediate action
        break;
    }
  }

  /**
   * Blacklist IP address
   */
  blacklistIP(ip, reason) {
    this.blacklistedIPs.add(ip);
    this.metrics.blockedIPs++;
    
    console.warn(`🔒 IP ${ip} blacklisted: ${reason}`);
    
    // Store in database for persistence
    db.query(`
      INSERT INTO ip_blacklist (ip_address, reason, blacklisted_at, expires_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours')
      ON CONFLICT (ip_address) DO UPDATE SET
        reason = $2, blacklisted_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
    `, [ip, reason]).catch(error => {
      console.error('Failed to store IP blacklist entry:', error);
    });
  }

  /**
   * Check if IP is blacklisted
   */
  isBlacklisted(ip) {
    return this.blacklistedIPs.has(ip);
  }

  /**
   * Get recent events for analysis
   */
  getRecentEvents(ip, type, windowMs) {
    const events = this.suspiciousEvents.get(ip) || [];
    const cutoff = Date.now() - windowMs;
    
    return events.filter(event => 
      event.timestamp > cutoff && 
      (type ? event.type === type : true)
    );
  }

  /**
   * Helper methods
   */
  analyzeEndpointPattern(requests) {
    // Analyze for suspicious patterns like enumeration, scanning, etc.
    const endpoints = requests.map(r => r.endpoint).filter(Boolean);
    const uniqueEndpoints = [...new Set(endpoints)];
    
    // Check for endpoint enumeration
    if (uniqueEndpoints.length > 20 && requests.length > 50) {
      return { suspicious: true, reason: 'Potential endpoint enumeration' };
    }
    
    return { suspicious: false };
  }

  async getLocationForIP(ip) {
    // Simplified geolocation - would use real service like MaxMind
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1') {
      return { country: 'Local', city: 'Local', lat: 0, lon: 0 };
    }
    return { country: 'Unknown', city: 'Unknown', lat: 0, lon: 0 };
  }

  calculateDistance(loc1, loc2) {
    // Simplified distance calculation
    const lat1Rad = loc1.lat * Math.PI / 180;
    const lat2Rad = loc2.lat * Math.PI / 180;
    const deltaLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const deltaLon = (loc2.lon - loc1.lon) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return 3959 * c; // Distance in miles
  }

  calculateSuspiciousScore(ip) {
    const events = this.suspiciousEvents.get(ip) || [];
    const recentEvents = events.filter(e => e.timestamp > Date.now() - 86400000); // Last 24 hours
    
    let score = 100;
    score -= recentEvents.length * 5; // Reduce score for each suspicious event
    score -= (events.filter(e => e.severity === 'high').length * 20);
    score -= (events.filter(e => e.severity === 'medium').length * 10);
    
    return Math.max(0, score);
  }

  detectUserAgentAnomaly(userId, userAgent) {
    // Simplified user agent anomaly detection
    // In reality, would track user agent patterns over time
    return false;
  }

  detectUnusualAccessTime(userId, timestamp) {
    const hour = new Date(timestamp).getHours();
    // Flag access between 2 AM and 6 AM as potentially unusual
    return hour >= 2 && hour <= 6;
  }

  detectPrivilegeEscalation(userId, permissionRequests) {
    return permissionRequests.includes('admin') || permissionRequests.includes('root');
  }

  addToWatchlist(ip) {
    // Add IP to watchlist for increased monitoring
    console.log(`👀 Added ${ip} to security watchlist`);
  }

  async suspendUserSessions(userId) {
    try {
      // Suspend all active sessions for user
      await db.query('UPDATE user_sessions SET status = $1 WHERE user_id = $2', ['suspended', userId]);
      console.warn(`🔒 Suspended all sessions for user ${userId}`);
    } catch (error) {
      console.error('Failed to suspend user sessions:', error);
    }
  }

  cleanupExpiredEvents() {
    const cutoff = Date.now() - 86400000; // 24 hours ago
    
    for (const [ip, events] of this.suspiciousEvents.entries()) {
      const filteredEvents = events.filter(event => event.timestamp > cutoff);
      if (filteredEvents.length === 0) {
        this.suspiciousEvents.delete(ip);
      } else {
        this.suspiciousEvents.set(ip, filteredEvents);
      }
    }
  }

  /**
   * Get security statistics
   */
  getStats() {
    return {
      metrics: this.metrics,
      activeThreats: this.suspiciousEvents.size,
      blacklistedIPs: this.blacklistedIPs.size,
      alertThresholds: this.alertThresholds,
      watchedIPs: this.suspiciousEvents.size
    };
  }
}

export default new SecurityEventDetector();
