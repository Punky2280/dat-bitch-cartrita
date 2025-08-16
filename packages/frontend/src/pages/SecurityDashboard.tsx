import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './SecurityDashboard.css';

/**
 * Security Dashboard - Comprehensive real-time security monitoring
 * Integrates threat detection, compliance monitoring, and security metrics
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

const SecurityDashboard = () => {
  // State management
  const [securityStatus, setSecurityStatus] = useState({
    overallThreatLevel: 'low',
    activeThreats: 0,
    complianceScore: 98.5,
    blockedAttacks: 0,
    securityEvents: []
  });
  const [threatDetectionData, setThreatDetectionData] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [securityMetrics, setSecurityMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [securityPolicies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // API client for security operations
  const securityAPI = useMemo(() => ({
    async fetchSecurityOverview() {
      const response = await fetch('/api/security/overview', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch security overview: ${response.status}`);
      return response.json();
    },

    async fetchThreatDetection() {
      const response = await fetch('/api/security/threats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch threat data: ${response.status}`);
      return response.json();
    },

    async fetchComplianceStatus() {
      const response = await fetch('/api/security/compliance', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch compliance data: ${response.status}`);
      return response.json();
    },

    async fetchSecurityMetrics(timeRange = '1h') {
      const response = await fetch(`/api/security/metrics?range=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch security metrics: ${response.status}`);
      return response.json();
    },

    async fetchAuditLogs(limit = 50) {
      const response = await fetch(`/api/security/audit-logs?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch audit logs: ${response.status}`);
      return response.json();
    },

    async fetchVulnerabilities() {
      const response = await fetch('/api/security/vulnerabilities', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch vulnerabilities: ${response.status}`);
      return response.json();
    },

    async respondToThreat(threatId, action) {
      const response = await fetch(`/api/security/threats/${threatId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error(`Failed to respond to threat: ${response.status}`);
      return response.json();
    },

    async updateSecurityPolicy(policyId, updates) {
      const response = await fetch(`/api/security/policies/${policyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error(`Failed to update policy: ${response.status}`);
      return response.json();
    }
  }), []);

  // Load all security data
  const loadSecurityData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [overview, threats, compliance, metrics, logs, vulns] = await Promise.all([
        securityAPI.fetchSecurityOverview(),
        securityAPI.fetchThreatDetection(),
        securityAPI.fetchComplianceStatus(),
        securityAPI.fetchSecurityMetrics(selectedTimeRange),
        securityAPI.fetchAuditLogs(),
        securityAPI.fetchVulnerabilities()
      ]);

      setSecurityStatus(overview);
      setThreatDetectionData(threats);
      setComplianceData(compliance);
      setSecurityMetrics(metrics);
      setAuditLogs(logs);
      setVulnerabilities(vulns);

    } catch (err) {
      console.error('[SecurityDashboard] Error loading data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [securityAPI, selectedTimeRange]);

  // Auto-refresh effect
  useEffect(() => {
    loadSecurityData();

    if (autoRefresh) {
      const interval = setInterval(loadSecurityData, 30000); // 30 second refresh
      return () => clearInterval(interval);
    }
  }, [loadSecurityData, autoRefresh]);

  // Server-Sent Events for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/security/events');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'threat-detected') {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'threat',
          severity: data.severity,
          message: `New ${data.severity} threat detected: ${data.description}`,
          timestamp: new Date()
        }]);
        
        // Update threat count
        setSecurityStatus(prev => ({
          ...prev,
          activeThreats: prev.activeThreats + 1,
          overallThreatLevel: data.severity
        }));
      }
      
      if (data.type === 'compliance-violation') {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'compliance',
          severity: 'warning',
          message: `Compliance violation: ${data.framework} - ${data.description}`,
          timestamp: new Date()
        }]);
      }
    };

    return () => eventSource.close();
  }, []);

  // Threat response handler
  const handleThreatResponse = async (threatId, action) => {
    try {
      await securityAPI.respondToThreat(threatId, action);
      
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        severity: 'info',
        message: `Threat response action '${action}' executed successfully`,
        timestamp: new Date()
      }]);
      
      // Refresh threat data
      loadSecurityData();
    } catch (err) {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        severity: 'error',
        message: `Failed to respond to threat: ${err.message}`,
        timestamp: new Date()
      }]);
    }
  };

  // Get threat level color
  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  // Get compliance score color
  const getComplianceColor = (score) => {
    if (score >= 95) return '#28a745';
    if (score >= 85) return '#ffc107';
    return '#dc3545';
  };

  if (isLoading) {
    return (
      <div className="security-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Security Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="security-dashboard error">
        <div className="error-message">
          <h3>⚠️ Error Loading Security Data</h3>
          <p>{error}</p>
          <button onClick={loadSecurityData} className="retry-btn">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="security-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <h1>🛡️ Security Operations Center</h1>
          <p>Real-time security monitoring and threat intelligence</p>
        </div>
        
        <div className="header-controls">
          <div className="time-range-selector">
            <label>Time Range:</label>
            <select 
              value={selectedTimeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <div className="auto-refresh-toggle">
            <label>
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
          </div>
          
          <button onClick={loadSecurityData} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Notifications Bar */}
      {notifications.length > 0 && (
        <div className="notifications-bar">
          {notifications.slice(-3).map(notification => (
            <div 
              key={notification.id} 
              className={`notification ${notification.type} ${notification.severity}`}
            >
              <span className="notification-icon">
                {notification.type === 'threat' ? '🚨' : 
                 notification.type === 'compliance' ? '📋' : 
                 notification.type === 'success' ? '✅' : '❌'}
              </span>
              <span className="notification-message">{notification.message}</span>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                className="notification-close"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Security Status Overview */}
      <div className="status-overview">
        <div className="status-card threat-level">
          <div className="card-header">
            <h3>🎯 Threat Level</h3>
          </div>
          <div className="card-content">
            <div 
              className="threat-indicator"
              style={{ backgroundColor: getThreatLevelColor(securityStatus.overallThreatLevel) }}
            >
              {securityStatus.overallThreatLevel.toUpperCase()}
            </div>
            <div className="threat-stats">
              <div className="stat">
                <span className="stat-value">{securityStatus.activeThreats}</span>
                <span className="stat-label">Active Threats</span>
              </div>
              <div className="stat">
                <span className="stat-value">{securityStatus.blockedAttacks}</span>
                <span className="stat-label">Blocked Today</span>
              </div>
            </div>
          </div>
        </div>

        <div className="status-card compliance">
          <div className="card-header">
            <h3>📊 Compliance Score</h3>
          </div>
          <div className="card-content">
            <div className="compliance-gauge">
              <svg viewBox="0 0 200 100">
                <path
                  d="M 20 80 A 80 80 0 0 1 180 80"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="20"
                />
                <path
                  d="M 20 80 A 80 80 0 0 1 180 80"
                  fill="none"
                  stroke={getComplianceColor(securityStatus.complianceScore)}
                  strokeWidth="20"
                  strokeDasharray={`${securityStatus.complianceScore * 2.51} 251`}
                />
                <text x="100" y="75" textAnchor="middle" className="gauge-text">
                  {securityStatus.complianceScore}%
                </text>
              </svg>
            </div>
            <div className="compliance-details">
              {complianceData?.frameworks?.map(framework => (
                <div key={framework.name} className="framework-score">
                  <span className="framework-name">{framework.name}</span>
                  <span className="framework-score-value">{framework.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="status-card security-events">
          <div className="card-header">
            <h3>📈 Security Events</h3>
          </div>
          <div className="card-content">
            {securityMetrics && (
              <div className="events-chart">
                <div className="chart-placeholder">
                  <div className="metric-row">
                    <span>Authentication Events</span>
                    <span>{securityMetrics.authEvents || 0}</span>
                  </div>
                  <div className="metric-row">
                    <span>Failed Logins</span>
                    <span>{securityMetrics.failedLogins || 0}</span>
                  </div>
                  <div className="metric-row">
                    <span>Blocked IPs</span>
                    <span>{securityMetrics.blockedIPs || 0}</span>
                  </div>
                  <div className="metric-row">
                    <span>Policy Violations</span>
                    <span>{securityMetrics.policyViolations || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Threat Detection Panel */}
      <div className="security-panel">
        <div className="panel-header">
          <h2>🚨 Active Threat Detection</h2>
        </div>
        <div className="threats-list">
          {threatDetectionData?.activeThreats?.length > 0 ? (
            threatDetectionData.activeThreats.map(threat => (
              <div key={threat.id} className={`threat-item ${threat.severity}`}>
                <div className="threat-info">
                  <div className="threat-title">
                    <span className="threat-icon">
                      {threat.type === 'sql_injection' ? '💉' :
                       threat.type === 'brute_force' ? '🔨' :
                       threat.type === 'malware' ? '🦠' : '⚠️'}
                    </span>
                    <h4>{threat.type.replace('_', ' ').toUpperCase()}</h4>
                    <span className={`severity-badge ${threat.severity}`}>
                      {threat.severity}
                    </span>
                  </div>
                  <div className="threat-details">
                    <p><strong>Source:</strong> {threat.sourceIP}</p>
                    <p><strong>Target:</strong> {threat.target}</p>
                    <p><strong>Detected:</strong> {new Date(threat.detectedAt).toLocaleString()}</p>
                    <p><strong>Description:</strong> {threat.description}</p>
                  </div>
                </div>
                <div className="threat-actions">
                  <button 
                    onClick={() => handleThreatResponse(threat.id, 'block')}
                    className="action-btn block"
                  >
                    🚫 Block
                  </button>
                  <button 
                    onClick={() => handleThreatResponse(threat.id, 'quarantine')}
                    className="action-btn quarantine"
                  >
                    🔒 Quarantine
                  </button>
                  <button 
                    onClick={() => handleThreatResponse(threat.id, 'investigate')}
                    className="action-btn investigate"
                  >
                    🔍 Investigate
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-threats">
              <div className="no-threats-icon">✅</div>
              <p>No active threats detected</p>
              <small>System monitoring continues...</small>
            </div>
          )}
        </div>
      </div>

      {/* Vulnerabilities Panel */}
      <div className="security-panel">
        <div className="panel-header">
          <h2>🔍 Vulnerability Assessment</h2>
        </div>
        <div className="vulnerabilities-list">
          {vulnerabilities?.length > 0 ? (
            vulnerabilities.slice(0, 10).map(vuln => (
              <div key={vuln.id} className={`vulnerability-item ${vuln.severity}`}>
                <div className="vulnerability-info">
                  <h4>{vuln.title}</h4>
                  <p>{vuln.description}</p>
                  <div className="vulnerability-meta">
                    <span className="cvss-score">CVSS: {vuln.cvssScore}</span>
                    <span className="severity-badge">{vuln.severity}</span>
                  </div>
                </div>
                <div className="vulnerability-status">
                  {vuln.status === 'open' ? '🔴' : '🟢'} {vuln.status}
                </div>
              </div>
            ))
          ) : (
            <div className="no-vulnerabilities">
              <div className="no-vulnerabilities-icon">🛡️</div>
              <p>No critical vulnerabilities found</p>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs Panel */}
      <div className="security-panel">
        <div className="panel-header">
          <h2>📋 Security Audit Trail</h2>
        </div>
        <div className="audit-logs">
          {auditLogs?.length > 0 ? (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 20).map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.event}</td>
                    <td>{log.user || 'System'}</td>
                    <td>{log.ipAddress}</td>
                    <td>
                      <span className={`status-badge ${log.status}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No audit logs available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
