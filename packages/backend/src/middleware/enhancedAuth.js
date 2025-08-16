import jwt from 'jsonwebtoken';
import SecurityEventDetector from '../security/SecurityEventDetector.js';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Enhanced authentication middleware with security monitoring
 */
const enhancedAuth = async (req, res, next) => {
  const span = OpenTelemetryTracing.traceOperation('auth.enhanced.validate');
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Check IP reputation before processing
    const ipReputation = await SecurityEventDetector.checkIPReputation(ip);
    
    if (ipReputation.reputation === 'malicious') {
      span.setAttributes({
        'auth.blocked': true,
        'auth.reason': 'malicious_ip',
        'auth.ip_reputation': ipReputation.score
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'IP_BLOCKED' 
      });
    }
    
    // Check if IP is blacklisted
    if (SecurityEventDetector.isBlacklisted(ip)) {
      span.setAttributes({
        'auth.blocked': true,
        'auth.reason': 'ip_blacklisted'
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'IP_BLACKLISTED'
      });
    }

    if (!token) {
      // Record anonymous access attempt for monitoring
      await SecurityEventDetector.detectUnusualAPIUsage(
        ip, 
        req.path, 
        userAgent, 
        null
      );
      
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Enhanced session validation
      const sessionValid = await validateUserSession(decoded.sub, token, ip, userAgent);
      
      if (!sessionValid.valid) {
        await SecurityEventDetector.recordSecurityEvent({
          type: 'INVALID_SESSION',
          ip,
          userAgent,
          userId: decoded.sub,
          severity: 'medium',
          reason: sessionValid.reason
        });
        
        return res.status(401).json({ 
          error: 'Session invalid',
          code: sessionValid.code 
        });
      }
      
      // Check for geographic anomalies
      const geoCheck = await SecurityEventDetector.detectGeographicAnomaly(
        decoded.sub, 
        ip
      );
      
      if (geoCheck.anomaly) {
        // Don't block but flag for investigation
        req.securityFlags = req.securityFlags || [];
        req.securityFlags.push('GEOGRAPHIC_ANOMALY');
      }
      
      // Detect suspicious patterns
      const patternCheck = await SecurityEventDetector.detectSuspiciousPatterns(
        decoded.sub,
        { userAgent, endpoint: req.path, method: req.method }
      );
      
      if (patternCheck.suspicious) {
        req.securityFlags = req.securityFlags || [];
        req.securityFlags.push(...patternCheck.patterns);
      }
      
      // Check for unusual API usage
      const apiUsage = await SecurityEventDetector.detectUnusualAPIUsage(
        ip,
        req.path,
        userAgent,
        decoded.sub
      );
      
      if (apiUsage.suspicious) {
        req.securityFlags = req.securityFlags || [];
        req.securityFlags.push('UNUSUAL_API_USAGE');
      }
      
      // Update session activity
      await updateSessionActivity(decoded.sub, token, ip);
      
      // Set user in request
      req.user = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
        is_admin: decoded.is_admin,
        sessionToken: token
      };
      
      span.setAttributes({
        'auth.user.id': decoded.sub,
        'auth.user.email': decoded.email,
        'auth.success': true,
        'auth.security_flags': req.securityFlags?.length || 0
      });
      
      next();
      
    } catch (jwtError) {
      // Record failed authentication attempt
      await SecurityEventDetector.detectFailedLogin(ip, userAgent, 'token_invalid');
      
      span.recordException(jwtError);
      span.setAttributes({
        'auth.success': false,
        'auth.error': jwtError.message
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED' 
        });
      }
      
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID' 
      });
    }
    
  } catch (error) {
    span.recordException(error);
    console.error('Enhanced authentication error:', error);
    return res.status(500).json({ error: 'Authentication service error' });
  } finally {
    span.end();
  }
};

/**
 * Validate user session with enhanced security checks
 */
async function validateUserSession(userId, token, ip, userAgent) {
  try {
    // Check if session exists and is active
    const sessionResult = await db.query(`
      SELECT status, expires_at, ip_address, device_fingerprint, last_activity
      FROM user_sessions 
      WHERE user_id = $1 AND session_token = $2
    `, [userId, token]);
    
    if (sessionResult.rows.length === 0) {
      return { valid: false, reason: 'Session not found', code: 'SESSION_NOT_FOUND' };
    }
    
    const session = sessionResult.rows[0];
    
    // Check session status
    if (session.status !== 'active') {
      return { 
        valid: false, 
        reason: `Session ${session.status}`, 
        code: `SESSION_${session.status.toUpperCase()}` 
      };
    }
    
    // Check expiration
    if (new Date() > new Date(session.expires_at)) {
      // Mark session as expired
      await db.query(
        'UPDATE user_sessions SET status = $1 WHERE user_id = $2 AND session_token = $3',
        ['expired', userId, token]
      );
      
      return { valid: false, reason: 'Session expired', code: 'SESSION_EXPIRED' };
    }
    
    // Check for IP address changes (optional security policy)
    if (session.ip_address && session.ip_address !== ip) {
      // Could be suspicious, but allow for now (mobile users, etc.)
      // In a stricter environment, this could invalidate the session
    }
    
    // Check concurrent session limits
    const concurrentSessions = await db.query(`
      SELECT COUNT(*) as count
      FROM user_sessions 
      WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
    `, [userId]);
    
    // Get user preferences for max concurrent sessions
    const prefsResult = await db.query(`
      SELECT max_concurrent_sessions
      FROM user_security_preferences 
      WHERE user_id = $1
    `, [userId]);
    
    const maxSessions = prefsResult.rows[0]?.max_concurrent_sessions || 5;
    
    if (parseInt(concurrentSessions.rows[0].count) > maxSessions) {
      return { 
        valid: false, 
        reason: 'Too many concurrent sessions', 
        code: 'MAX_SESSIONS_EXCEEDED' 
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, reason: 'Session validation failed', code: 'VALIDATION_ERROR' };
  }
}

/**
 * Update session activity
 */
async function updateSessionActivity(userId, token, ip) {
  try {
    await db.query(`
      UPDATE user_sessions 
      SET last_activity = NOW(), ip_address = $3
      WHERE user_id = $1 AND session_token = $2
    `, [userId, token, ip]);
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}

/**
 * Multi-factor authentication middleware
 */
const requireMFA = async (req, res, next) => {
  const span = OpenTelemetryTracing.traceOperation('auth.mfa.validate');
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Check if user has MFA enabled
    const mfaResult = await db.query(`
      SELECT method, is_enabled
      FROM user_mfa 
      WHERE user_id = $1 AND is_enabled = true
    `, [userId]);
    
    if (mfaResult.rows.length === 0) {
      // No MFA required
      return next();
    }
    
    // Check if MFA was completed in this session
    const mfaToken = req.header('X-MFA-Token');
    if (!mfaToken) {
      span.setAttributes({
        'auth.mfa.required': true,
        'auth.mfa.provided': false
      });
      
      return res.status(200).json({
        requiresMFA: true,
        availableMethods: mfaResult.rows.map(r => r.method),
        message: 'Multi-factor authentication required'
      });
    }
    
    // Validate MFA token
    const mfaValid = await validateMFAToken(userId, mfaToken);
    
    if (!mfaValid) {
      await SecurityEventDetector.recordSecurityEvent({
        type: 'MFA_VALIDATION_FAILED',
        ip: req.ip,
        userId,
        severity: 'medium'
      });
      
      return res.status(401).json({
        error: 'Invalid MFA token',
        code: 'MFA_INVALID'
      });
    }
    
    span.setAttributes({
      'auth.mfa.required': true,
      'auth.mfa.valid': true
    });
    
    next();
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA validation error:', error);
    return res.status(500).json({ error: 'MFA validation failed' });
  } finally {
    span.end();
  }
};

/**
 * Validate MFA token (simplified implementation)
 */
async function validateMFAToken(userId, token) {
  // This would implement actual TOTP validation
  // For now, return true for development
  return true;
}

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRole = requiredRoles.some(role => 
      userRoles.includes(role) || (role === 'admin' && req.user.is_admin)
    );
    
    if (!hasRole) {
      SecurityEventDetector.recordSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        ip: req.ip,
        userId: req.user.id,
        endpoint: req.path,
        requiredRoles,
        userRoles,
        severity: 'medium'
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
};

/**
 * Security monitoring middleware for sensitive operations
 */
const auditSensitiveOperation = (operation) => {
  return async (req, res, next) => {
    // Record the operation attempt
    await SecurityEventDetector.recordSecurityEvent({
      type: 'SENSITIVE_OPERATION',
      ip: req.ip,
      userId: req.user?.id,
      endpoint: req.path,
      operation,
      method: req.method,
      severity: 'medium'
    });
    
    // Store original send function
    const originalSend = res.send;
    
    // Override send to capture response
    res.send = function(data) {
      // Log the operation result
      db.query(`
        INSERT INTO security_audit_log (user_id, action, resource_type, ip_address, user_agent, success, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user?.id,
        operation,
        'api',
        req.ip,
        req.get('User-Agent'),
        res.statusCode < 400,
        JSON.stringify({
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          securityFlags: req.securityFlags
        })
      ]).catch(error => {
        console.error('Failed to log audit entry:', error);
      });
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  };
};

export default enhancedAuth;
export { requireMFA, requireRole, auditSensitiveOperation };
