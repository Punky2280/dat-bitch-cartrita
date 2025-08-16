/**
 * Security Integrations Dashboard Component
 * Comprehensive interface for managing security tool integrations
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SecurityIntegrationsdashboard.css';

const SecurityIntegrationsDashboard = () => {
  const [integrations, setIntegrations] = useState([]);
  const [supportedTypes, setSupportedTypes] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [testResults, setTestResults] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const modalRef = useRef(null);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch('/api/security/integrations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load integrations');
      }

      setIntegrations(data.data.integrations || []);
      setSupportedTypes(data.data.supported || {});
      setMetrics(data.data.metrics || {});
      setError(null);
      
    } catch (error) {
      console.error('Failed to load integrations:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    
    // Set up refresh interval
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Test integration connectivity
  const testIntegration = async (integrationId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/security/integrations/${integrationId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      setTestResults(prev => ({
        ...prev,
        [integrationId]: data.success ? data.data : { status: 'error', error: data.error }
      }));
      
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults(prev => ({
        ...prev,
        [integrationId]: { status: 'error', error: error.message }
      }));
    }
  };

  // Perform health check
  const performHealthCheck = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/security/integrations/health-check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        // Update integration statuses
        await loadDashboardData();
      }
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  // Add new integration
  const addIntegration = async (config) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/security/integrations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      
      if (data.success) {
        setShowAddModal(false);
        await loadDashboardData();
        return data.data;
      } else {
        throw new Error(data.error);
      }
      
    } catch (error) {
      console.error('Failed to add integration:', error);
      throw error;
    }
  };

  // Remove integration
  const removeIntegration = async (integrationId) => {
    if (!window.confirm('Are you sure you want to remove this integration?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/security/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await loadDashboardData();
      } else {
        throw new Error(data.error);
      }
      
    } catch (error) {
      console.error('Failed to remove integration:', error);
      alert('Failed to remove integration: ' + error.message);
    }
  };

  // Get webhook configuration
  const getWebhookConfig = async (integrationId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/security/integrations/${integrationId}/webhook`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.success ? data.data : null;
      
    } catch (error) {
      console.error('Failed to get webhook config:', error);
      return null;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <span className="status-icon active">●</span>;
      case 'degraded':
        return <span className="status-icon degraded">●</span>;
      case 'error':
        return <span className="status-icon error">●</span>;
      default:
        return <span className="status-icon inactive">●</span>;
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      siem: '#ff6b6b',
      threatIntel: '#4ecdc4',
      vulnerability: '#45b7d1',
      compliance: '#96ceb4'
    };
    return colors[type] || '#999';
  };

  const formatUptime = (lastCheck) => {
    if (!lastCheck) return 'Never';
    const now = new Date();
    const last = new Date(lastCheck);
    const diff = now - last;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="security-integrations-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading security integrations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="security-integrations-dashboard">
        <div className="error-container">
          <h2>Error Loading Integrations</h2>
          <p>{error}</p>
          <button className="retry-button" onClick={loadDashboardData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="security-integrations-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Security Integrations</h1>
          <p>Manage and monitor external security tool integrations</p>
        </div>
        <div className="header-actions">
          <button 
            className="action-button secondary"
            onClick={performHealthCheck}
          >
            <span>🔄</span>
            Health Check
          </button>
          <button 
            className="action-button primary"
            onClick={() => setShowAddModal(true)}
          >
            <span>+</span>
            Add Integration
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="metrics-overview">
          <div className="metric-card">
            <h3>Total Integrations</h3>
            <div className="metric-value">
              <span className="number">{metrics.totalIntegrations || 0}</span>
              <span className="label">Configured</span>
            </div>
          </div>
          <div className="metric-card">
            <h3>Active Integrations</h3>
            <div className="metric-value">
              <span className="number active">{metrics.activeIntegrations || 0}</span>
              <span className="label">Healthy</span>
            </div>
          </div>
          <div className="metric-card">
            <h3>Degraded</h3>
            <div className="metric-value">
              <span className="number degraded">{metrics.degradedIntegrations || 0}</span>
              <span className="label">Issues</span>
            </div>
          </div>
          <div className="metric-card">
            <h3>Error Rate</h3>
            <div className="metric-value">
              <span className="number error">
                {metrics.totalRequests > 0 
                  ? Math.round((metrics.totalErrors / metrics.totalRequests) * 100) 
                  : 0}%
              </span>
              <span className="label">Failures</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="integration-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span>📊</span> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'siem' ? 'active' : ''}`}
          onClick={() => setActiveTab('siem')}
        >
          <span>🛡️</span> SIEM
        </button>
        <button 
          className={`tab-button ${activeTab === 'threatIntel' ? 'active' : ''}`}
          onClick={() => setActiveTab('threatIntel')}
        >
          <span>🎯</span> Threat Intelligence
        </button>
        <button 
          className={`tab-button ${activeTab === 'vulnerability' ? 'active' : ''}`}
          onClick={() => setActiveTab('vulnerability')}
        >
          <span>🔍</span> Vulnerability
        </button>
        <button 
          className={`tab-button ${activeTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          <span>🔗</span> Webhooks
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-content">
            <div className="integrations-grid">
              {integrations.map(integration => (
                <div key={integration.id} className={`integration-card ${integration.status}`}>
                  <div className="card-header">
                    <div className="integration-info">
                      <h3>{integration.name}</h3>
                      <span 
                        className="integration-type"
                        style={{ backgroundColor: getTypeColor(integration.type) }}
                      >
                        {integration.type}
                      </span>
                    </div>
                    <div className="integration-status">
                      {getStatusIcon(integration.status)}
                      <span className={`status-text ${integration.status}`}>
                        {integration.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <div className="integration-metrics">
                      <div className="metric">
                        <span className="label">Success Rate:</span>
                        <span className="value">
                          {integration.successCount + integration.errorCount > 0 
                            ? Math.round((integration.successCount / (integration.successCount + integration.errorCount)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="metric">
                        <span className="label">Response Time:</span>
                        <span className="value">
                          {integration.responseTime ? `${integration.responseTime}ms` : 'N/A'}
                        </span>
                      </div>
                      <div className="metric">
                        <span className="label">Last Check:</span>
                        <span className="value">
                          {formatUptime(integration.lastHealthCheck)}
                        </span>
                      </div>
                    </div>
                    
                    {testResults[integration.id] && (
                      <div className={`test-result ${testResults[integration.id].status}`}>
                        <strong>Test Result:</strong> {testResults[integration.id].status}
                        {testResults[integration.id].error && (
                          <div className="error-detail">{testResults[integration.id].error}</div>
                        )}
                        {testResults[integration.id].responseTime && (
                          <div className="response-time">
                            Response: {testResults[integration.id].responseTime}ms
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="card-actions">
                    <button 
                      className="action-button small secondary"
                      onClick={() => testIntegration(integration.id)}
                    >
                      Test
                    </button>
                    <button 
                      className="action-button small secondary"
                      onClick={() => setSelectedIntegration(integration)}
                    >
                      Configure
                    </button>
                    <button 
                      className="action-button small danger"
                      onClick={() => removeIntegration(integration.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              
              {integrations.length === 0 && (
                <div className="no-integrations">
                  <h3>No Integrations Configured</h3>
                  <p>Add your first security tool integration to get started.</p>
                  <button 
                    className="action-button primary"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add Integration
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Other tab contents would go here */}
        {activeTab !== 'overview' && (
          <div className="filtered-content">
            <div className="integrations-grid">
              {integrations
                .filter(integration => activeTab === 'webhooks' || integration.type === activeTab)
                .map(integration => (
                  <div key={integration.id} className={`integration-card ${integration.status}`}>
                    {/* Same card content as overview */}
                    <div className="card-header">
                      <div className="integration-info">
                        <h3>{integration.name}</h3>
                        <span 
                          className="integration-type"
                          style={{ backgroundColor: getTypeColor(integration.type) }}
                        >
                          {integration.type}
                        </span>
                      </div>
                      <div className="integration-status">
                        {getStatusIcon(integration.status)}
                        <span className={`status-text ${integration.status}`}>
                          {integration.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="card-body">
                      <div className="integration-metrics">
                        <div className="metric">
                          <span className="label">Requests:</span>
                          <span className="value">
                            {integration.successCount + integration.errorCount}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="label">Errors:</span>
                          <span className="value error">{integration.errorCount}</span>
                        </div>
                      </div>
                      
                      {activeTab === 'webhooks' && (
                        <button
                          className="action-button small secondary"
                          onClick={async () => {
                            const config = await getWebhookConfig(integration.id);
                            if (config) {
                              navigator.clipboard.writeText(config.webhookEndpoint);
                              alert('Webhook URL copied to clipboard!');
                            }
                          }}
                        >
                          Copy Webhook URL
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" ref={modalRef} onClick={e => e.stopPropagation()}>
            <AddIntegrationForm
              supportedTypes={supportedTypes}
              onAdd={addIntegration}
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}
      
      {/* Integration Detail Modal */}
      {selectedIntegration && (
        <div className="modal-overlay" onClick={() => setSelectedIntegration(null)}>
          <div className="modal large" onClick={e => e.stopPropagation()}>
            <IntegrationDetail
              integration={selectedIntegration}
              onClose={() => setSelectedIntegration(null)}
              onUpdate={loadDashboardData}
              getWebhookConfig={getWebhookConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Add Integration Form Component
const AddIntegrationForm = ({ supportedTypes, onAdd, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    baseUrl: '',
    apiKey: '',
    rateLimit: 100,
    timeout: 30000,
    enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onAdd(formData);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-integration-form">
      <h2>Add Security Integration</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Integration Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            placeholder="e.g., Production Splunk SIEM"
          />
        </div>
        
        <div className="form-group">
          <label>Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
            required
          >
            <option value="">Select Type</option>
            <option value="siem">SIEM</option>
            <option value="threatIntel">Threat Intelligence</option>
            <option value="vulnerability">Vulnerability Scanner</option>
            <option value="compliance">Compliance Tool</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Base URL</label>
          <input
            type="url"
            value={formData.baseUrl}
            onChange={(e) => setFormData({...formData, baseUrl: e.target.value})}
            required
            placeholder="https://api.example.com"
          />
        </div>
        
        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
            required
            placeholder="Your API key"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Rate Limit (req/min)</label>
            <input
              type="number"
              value={formData.rateLimit}
              onChange={(e) => setFormData({...formData, rateLimit: parseInt(e.target.value)})}
              min="1"
              max="1000"
            />
          </div>
          
          <div className="form-group">
            <label>Timeout (ms)</label>
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData({...formData, timeout: parseInt(e.target.value)})}
              min="1000"
              max="120000"
              step="1000"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="action-button secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="action-button primary"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Integration'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Integration Detail Component
const IntegrationDetail = ({ integration, onClose, onUpdate, getWebhookConfig }) => {
  const [webhookConfig, setWebhookConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWebhookConfig = async () => {
      try {
        const config = await getWebhookConfig(integration.id);
        setWebhookConfig(config);
      } catch (error) {
        console.error('Failed to load webhook config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWebhookConfig();
  }, [integration.id, getWebhookConfig]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="integration-detail">
      <div className="detail-header">
        <h2>{integration.name}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="detail-content">
        <div className="detail-section">
          <h3>Integration Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Type:</span>
              <span className="value">{integration.type}</span>
            </div>
            <div className="detail-item">
              <span className="label">Status:</span>
              <span className={`value status ${integration.status}`}>
                {integration.status}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Success Count:</span>
              <span className="value">{integration.successCount}</span>
            </div>
            <div className="detail-item">
              <span className="label">Error Count:</span>
              <span className="value error">{integration.errorCount}</span>
            </div>
          </div>
        </div>
        
        {!loading && webhookConfig && (
          <div className="detail-section">
            <h3>Webhook Configuration</h3>
            <div className="webhook-config">
              <div className="config-item">
                <label>Webhook URL:</label>
                <div className="url-input">
                  <input 
                    type="text" 
                    value={webhookConfig.webhookEndpoint} 
                    readOnly 
                  />
                  <button 
                    className="copy-button"
                    onClick={() => copyToClipboard(webhookConfig.webhookEndpoint)}
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="config-item">
                <label>Webhook Secret:</label>
                <div className="secret-input">
                  <input 
                    type="password" 
                    value={webhookConfig.webhookSecret} 
                    readOnly 
                  />
                  <button 
                    className="copy-button"
                    onClick={() => copyToClipboard(webhookConfig.webhookSecret)}
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="config-item">
                <label>Signature Header:</label>
                <span className="config-value">{webhookConfig.signatureHeader}</span>
              </div>
              
              <div className="config-item">
                <label>Content Type:</label>
                <span className="config-value">{webhookConfig.contentType}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityIntegrationsDashboard;
