import express from 'express';
import { requireRole, auditSensitiveOperation } from '../middleware/enhancedAuth.js';
import SecurityEventDetector from '../security/SecurityEventDetector.js';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// All security dashboard endpoints require admin role
router.use(requireRole('admin'));

/**
 * GET /api/security/dashboard - Security overview dashboard
 */
router.get('/dashboard', auditSensitiveOperation('VIEW_SECURITY_DASHBOARD'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.dashboard.overview');
  
  try {
    // Get current security statistics
    const securityStats = SecurityEventDetector.getStats();
    
    // Get recent security alerts (last 24 hours)
    const recentAlertsResult = await db.query(`
      SELECT type, severity, COUNT(*) as count, MAX(timestamp) as latest
      FROM security_alerts
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY type, severity
      ORDER BY count DESC
    `);
    
    // Get top threat IPs
    const topThreatsResult = await db.query(`
      SELECT ip_address, COUNT(*) as event_count, 
             MAX(timestamp) as last_seen,
             STRING_AGG(DISTINCT type, ', ') as event_types
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '24 hours' 
        AND severity IN ('medium', 'high', 'critical')
      GROUP BY ip_address
      ORDER BY event_count DESC
      LIMIT 10
    `);
    
    // Get security trends (last 7 days)
    const trendsResult = await db.query(`
      SELECT DATE_TRUNC('day', timestamp) as date,
             COUNT(*) as total_events,
             COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
             COUNT(*) FILTER (WHERE severity = 'critical') as critical_severity
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date
    `);
    
    // Get active security alerts
    const activeAlertsResult = await db.query(`
      SELECT id, type, severity, ip_address, timestamp, metadata
      FROM security_alerts
      WHERE status = 'active'
      ORDER BY severity DESC, timestamp DESC
      LIMIT 50
    `);
    
    // Get failed login statistics
    const failedLoginsResult = await db.query(`
      SELECT COUNT(*) as total_attempts,
             COUNT(DISTINCT ip_address) as unique_ips,
             COUNT(DISTINCT email) as unique_emails
      FROM failed_login_attempts
      WHERE last_attempt > NOW() - INTERVAL '24 hours'
    `);
    
    // Get IP blacklist status
    const blacklistResult = await db.query(`
      SELECT COUNT(*) as active_blacklist,
             COUNT(*) FILTER (WHERE expires_at > NOW() OR expires_at IS NULL) as permanent_blacklist
      FROM ip_blacklist
      WHERE is_active = true
    `);
    
    const dashboard = {
      overview: {
        ...securityStats,
        failedLogins: failedLoginsResult.rows[0],
        blacklistedIPs: blacklistResult.rows[0]
      },
      recentAlerts: recentAlertsResult.rows,
      topThreats: topThreatsResult.rows,
      trends: trendsResult.rows,
      activeAlerts: activeAlertsResult.rows,
      lastUpdated: new Date().toISOString()
    };
    
    span.setAttributes({
      'security.dashboard.active_alerts': activeAlertsResult.rows.length,
      'security.dashboard.top_threats': topThreatsResult.rows.length
    });
    
    res.json({ success: true, data: dashboard });
    
  } catch (error) {
    span.recordException(error);
    console.error('Security dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load security dashboard' 
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/alerts - Get security alerts with filtering
 */
router.get('/alerts', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.alerts.list');
  
  try {
    const { 
      status = 'active', 
      severity, 
      type, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = `
      SELECT id, type, severity, ip_address, user_id, status, metadata, timestamp,
             acknowledged_by, acknowledged_at, resolution_notes
      FROM security_alerts
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }
    
    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM security_alerts
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamIndex = 1;
    
    if (status) {
      countQuery += ` AND status = $${countParamIndex++}`;
      countParams.push(status);
    }
    
    if (severity) {
      countQuery += ` AND severity = $${countParamIndex++}`;
      countParams.push(severity);
    }
    
    if (type) {
      countQuery += ` AND type = $${countParamIndex++}`;
      countParams.push(type);
    }
    
    const countResult = await db.query(countQuery, countParams);
    
    res.json({
      success: true,
      data: {
        alerts: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('Security alerts error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve security alerts' 
    });
  } finally {
    span.end();
  }
});

/**
 * PUT /api/security/alerts/:id/acknowledge - Acknowledge security alert
 */
router.put('/alerts/:id/acknowledge', auditSensitiveOperation('ACKNOWLEDGE_SECURITY_ALERT'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.alerts.acknowledge');
  
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;
    
    const result = await db.query(`
      UPDATE security_alerts
      SET status = 'investigating',
          acknowledged_by = $1,
          acknowledged_at = NOW()
      WHERE id = $2 AND status = 'active'
      RETURNING *
    `, [userId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or already acknowledged'
      });
    }
    
    // Log the acknowledgment
    if (notes) {
      await db.query(`
        UPDATE security_alerts
        SET resolution_notes = $1
        WHERE id = $2
      `, [notes, id]);
    }
    
    span.setAttributes({
      'security.alert.id': id,
      'security.alert.acknowledged': true
    });
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('Alert acknowledgment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to acknowledge alert' 
    });
  } finally {
    span.end();
  }
});

/**
 * PUT /api/security/alerts/:id/resolve - Resolve security alert
 */
router.put('/alerts/:id/resolve', auditSensitiveOperation('RESOLVE_SECURITY_ALERT'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.alerts.resolve');
  
  try {
    const { id } = req.params;
    const { resolution, notes } = req.body;
    
    if (!resolution || !['resolved', 'false_positive'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: 'Valid resolution required (resolved or false_positive)'
      });
    }
    
    const result = await db.query(`
      UPDATE security_alerts
      SET status = $1,
          resolved_at = NOW(),
          resolution_notes = $2
      WHERE id = $3
      RETURNING *
    `, [resolution, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    span.setAttributes({
      'security.alert.id': id,
      'security.alert.resolution': resolution
    });
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('Alert resolution error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to resolve alert' 
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/threats - Get threat analysis
 */
router.get('/threats', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.threats.analysis');
  
  try {
    const { timeframe = '24h' } = req.query;
    
    let interval;
    switch (timeframe) {
      case '1h': interval = '1 hour'; break;
      case '24h': interval = '24 hours'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '24 hours';
    }
    
    // Top attacking IPs
    const topAttackersResult = await db.query(`
      SELECT ip_address,
             COUNT(*) as attack_count,
             STRING_AGG(DISTINCT type, ', ') as attack_types,
             MAX(timestamp) as last_seen,
             MIN(timestamp) as first_seen
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '${interval}'
        AND severity IN ('medium', 'high', 'critical')
      GROUP BY ip_address
      ORDER BY attack_count DESC
      LIMIT 20
    `);
    
    // Attack patterns
    const attackPatternsResult = await db.query(`
      SELECT type,
             COUNT(*) as count,
             COUNT(DISTINCT ip_address) as unique_ips,
             AVG(CASE 
               WHEN severity = 'low' THEN 1
               WHEN severity = 'medium' THEN 2
               WHEN severity = 'high' THEN 3
               WHEN severity = 'critical' THEN 4
               ELSE 1
             END) as avg_severity_score
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY type
      ORDER BY count DESC
    `);
    
    // Geographic threat distribution
    const geoThreatsResult = await db.query(`
      SELECT 
        (metadata->>'location'->>'country')::text as country,
        COUNT(*) as threat_count
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '${interval}'
        AND metadata->>'location' IS NOT NULL
        AND severity IN ('medium', 'high', 'critical')
      GROUP BY (metadata->>'location'->>'country')::text
      ORDER BY threat_count DESC
      LIMIT 15
    `);
    
    // Time-based threat patterns
    const timeBasedResult = await db.query(`
      SELECT 
        EXTRACT(hour FROM timestamp) as hour,
        COUNT(*) as threat_count,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity_count
      FROM security_events
      WHERE timestamp > NOW() - INTERVAL '${interval}'
        AND severity IN ('medium', 'high', 'critical')
      GROUP BY EXTRACT(hour FROM timestamp)
      ORDER BY hour
    `);
    
    const threatAnalysis = {
      timeframe,
      topAttackers: topAttackersResult.rows,
      attackPatterns: attackPatternsResult.rows,
      geographicThreats: geoThreatsResult.rows,
      timeBasedPatterns: timeBasedResult.rows,
      summary: {
        totalThreats: attackPatternsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        uniqueAttackers: topAttackersResult.rows.length,
        mostCommonAttack: attackPatternsResult.rows[0]?.type || 'None',
        averageSeverity: attackPatternsResult.rows.length > 0 
          ? (attackPatternsResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_severity_score), 0) / attackPatternsResult.rows.length).toFixed(2)
          : 0
      }
    };
    
    res.json({
      success: true,
      data: threatAnalysis
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('Threat analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate threat analysis' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/security/blacklist - Manually blacklist IP
 */
router.post('/blacklist', auditSensitiveOperation('MANUAL_IP_BLACKLIST'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.blacklist.add');
  
  try {
    const { ip, reason, duration } = req.body;
    
    if (!ip || !reason) {
      return res.status(400).json({
        success: false,
        error: 'IP address and reason are required'
      });
    }
    
    // Calculate expiration if duration provided
    let expiresAt = null;
    if (duration) {
      const durationMs = parseDuration(duration);
      if (durationMs) {
        expiresAt = new Date(Date.now() + durationMs);
      }
    }
    
    await db.query(`
      INSERT INTO ip_blacklist (ip_address, reason, blacklisted_by, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ip_address) DO UPDATE SET
        reason = $2,
        blacklisted_by = $3,
        expires_at = $4,
        blacklisted_at = NOW(),
        is_active = true
    `, [ip, reason, req.user.id, expiresAt]);
    
    // Add to in-memory blacklist
    SecurityEventDetector.blacklistIP(ip, reason);
    
    span.setAttributes({
      'security.blacklist.ip': ip,
      'security.blacklist.manual': true
    });
    
    res.json({
      success: true,
      message: 'IP address blacklisted successfully'
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('IP blacklist error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to blacklist IP address' 
    });
  } finally {
    span.end();
  }
});

/**
 * DELETE /api/security/blacklist/:ip - Remove IP from blacklist
 */
router.delete('/blacklist/:ip', auditSensitiveOperation('REMOVE_IP_BLACKLIST'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.blacklist.remove');
  
  try {
    const { ip } = req.params;
    
    const result = await db.query(`
      UPDATE ip_blacklist 
      SET is_active = false 
      WHERE ip_address = $1
      RETURNING *
    `, [ip]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IP address not found in blacklist'
      });
    }
    
    res.json({
      success: true,
      message: 'IP address removed from blacklist'
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('IP blacklist removal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove IP from blacklist' 
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/audit - Get security audit logs
 */
router.get('/audit', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('security.audit.logs');
  
  try {
    const { 
      userId, 
      action, 
      success, 
      limit = 100, 
      offset = 0,
      timeframe = '24h'
    } = req.query;
    
    let interval;
    switch (timeframe) {
      case '1h': interval = '1 hour'; break;
      case '24h': interval = '24 hours'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '24 hours';
    }
    
    let query = `
      SELECT sal.*, u.name as user_name, u.email as user_email
      FROM security_audit_log sal
      LEFT JOIN users u ON sal.user_id = u.id
      WHERE sal.timestamp > NOW() - INTERVAL '${interval}'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (userId) {
      query += ` AND sal.user_id = $${paramIndex++}`;
      params.push(parseInt(userId));
    }
    
    if (action) {
      query += ` AND sal.action = $${paramIndex++}`;
      params.push(action);
    }
    
    if (success !== undefined) {
      query += ` AND sal.success = $${paramIndex++}`;
      params.push(success === 'true');
    }
    
    query += ` ORDER BY sal.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: {
        logs: result.rows,
        timeframe
      }
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('Security audit logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve audit logs' 
    });
  } finally {
    span.end();
  }
});

// Helper function to parse duration strings like "1h", "24h", "7d"
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  
  return value * multipliers[unit];
}

export default router;
