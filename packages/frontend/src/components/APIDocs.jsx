/**
 * @fileoverview API Documentation Component (Task 20)
 * Interactive API documentation viewer with live testing capabilities
 */

import React, { useState, useEffect } from 'react';
import './APIDocs.css';

const APIDocs = ({ token, onBack }) => {
  const [stats, setStats] = useState({
    totalRoutes: 0,
    endpointsDocumented: 0,
    coverage: 0,
    lastScan: null,
    scanTime: 0
  });
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [testResults, setTestResults] = useState({});

  // Use correct backend URL
  const API_BASE = 'http://localhost:8001';

  useEffect(() => {
    loadDocumentationData();
  }, []);

  const loadDocumentationData = async () => {
    setLoading(true);
    try {
      const [statsResponse, routesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/docs/stats`),
        fetch(`${API_BASE}/api/docs/routes`)
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      if (routesResponse.ok) {
        const routesData = await routesResponse.json();
        setRoutes(routesData.data.routes);
      }
    } catch (error) {
      console.error('Failed to load documentation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDocumentation = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/docs/refresh`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const result = await response.json();

      if (result.success) {
        await loadDocumentationData();
        alert('Documentation refreshed successfully!');
      } else {
        alert('Failed to refresh documentation: ' + result.error);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      alert('Failed to refresh documentation. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const testEndpoint = async (route, endpoint) => {
    const testKey = `${route.filePath}-${endpoint.method}-${endpoint.path}`;
    setTestResults(prev => ({
      ...prev,
      [testKey]: { loading: true }
    }));

    try {
      const url = endpoint.path.replace(/:\w+/g, 'test-value'); // Replace path params with test values
      const fullUrl = `${API_BASE}/api${url}`; // Construct full URL
      const response = await fetch(fullUrl, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...(endpoint.method !== 'GET' && { body: JSON.stringify({}) })
      });

      const data = await response.text();
      const result = {
        status: response.status,
        statusText: response.statusText,
        data: data,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => ({
        ...prev,
        [testKey]: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testKey]: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  const exportDocumentation = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/docs/export`);
      const result = await response.json();

      if (result.success) {
        alert(`Documentation exported to: ${result.data.filePath}`);
      } else {
        alert('Export failed: ' + result.error);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export documentation. Please try again.');
    }
  };

  const formatTimestamp = (timestamp) => {
    return timestamp ? new Date(timestamp).toLocaleString() : 'Never';
  };

  if (loading) {
    return (
      <div className="api-docs-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading API documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="api-docs-container">
      <header className="docs-header">
        <div className="header-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h1>🚀 API Documentation</h1>
              <p>Interactive documentation for the Cartrita AI OS API</p>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="back-button"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>←</span>
                Back to Dashboard
              </button>
            )}
          </div>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalRoutes}</div>
              <div className="stat-label">Total Routes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.endpointsDocumented}</div>
              <div className="stat-label">Endpoints Documented</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.coverage.toFixed(1)}%</div>
              <div className="stat-label">Coverage</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.scanTime}ms</div>
              <div className="stat-label">Last Scan Time</div>
            </div>
          </div>
        </div>
      </header>

      <div className="docs-content">
        <div className="docs-sidebar">
          <div className="sidebar-header">
            <h3>API Routes</h3>
            <button 
              className="refresh-btn"
              onClick={refreshDocumentation}
              disabled={refreshing}
            >
              {refreshing ? '🔄' : '↻'} Refresh
            </button>
          </div>
          
          <div className="routes-list">
            {routes.map((route, index) => (
              <div 
                key={index}
                className={`route-item ${selectedRoute === route ? 'active' : ''}`}
                onClick={() => setSelectedRoute(route)}
              >
                <div className="route-file">
                  {route.fileName}
                </div>
                <div className="route-endpoints">
                  {route.endpoints?.length || 0} endpoints
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="docs-main">
          {selectedRoute ? (
            <div className="route-details">
              <div className="route-header">
                <h2>{selectedRoute.fileName}</h2>
                <p className="route-path">{selectedRoute.filePath}</p>
              </div>

              <div className="endpoints-section">
                <h3>Endpoints ({selectedRoute.endpoints?.length || 0})</h3>
                
                {selectedRoute.endpoints?.map((endpoint, index) => {
                  const testKey = `${selectedRoute.filePath}-${endpoint.method}-${endpoint.path}`;
                  const testResult = testResults[testKey];
                  
                  return (
                    <div key={index} className="endpoint-card">
                      <div className="endpoint-header">
                        <span className={`method-badge ${endpoint.method.toLowerCase()}`}>
                          {endpoint.method}
                        </span>
                        <code className="endpoint-path">{endpoint.path}</code>
                        <button 
                          className="test-btn"
                          onClick={() => testEndpoint(selectedRoute, endpoint)}
                          disabled={testResult?.loading}
                        >
                          {testResult?.loading ? '⏳' : '🧪'} Test
                        </button>
                      </div>
                      
                      {endpoint.description && (
                        <p className="endpoint-description">{endpoint.description}</p>
                      )}

                      {endpoint.parameters?.length > 0 && (
                        <div className="parameters-section">
                          <h4>Parameters</h4>
                          <div className="parameters-list">
                            {endpoint.parameters.map((param, pidx) => (
                              <div key={pidx} className="parameter-item">
                                <code>{param.name}</code>
                                <span className="param-type">{param.type}</span>
                                {param.description && (
                                  <span className="param-desc">{param.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {endpoint.responses && (
                        <div className="responses-section">
                          <h4>Responses</h4>
                          <div className="responses-list">
                            {Object.entries(endpoint.responses).map(([code, response]) => (
                              <div key={code} className="response-item">
                                <span className={`status-code ${code.startsWith('2') ? 'success' : 'error'}`}>
                                  {code}
                                </span>
                                <span className="response-desc">{response.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {testResult && !testResult.loading && (
                        <div className="test-result">
                          <h4>Test Result</h4>
                          {testResult.error ? (
                            <div className="test-error">
                              <strong>Error:</strong> {testResult.error}
                            </div>
                          ) : (
                            <div className="test-response">
                              <div className={`status ${testResult.status < 400 ? 'success' : 'error'}`}>
                                Status: {testResult.status} {testResult.statusText}
                              </div>
                              <pre className="response-data">{testResult.data}</pre>
                            </div>
                          )}
                          <div className="test-timestamp">
                            Tested at: {formatTimestamp(testResult.timestamp)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-content">
                <h3>📋 Select a route to view documentation</h3>
                <p>Choose a route from the sidebar to see detailed endpoint documentation</p>
                
                <div className="quick-actions">
                  <button 
                    className="action-btn primary"
                    onClick={() => window.open('/api/docs', '_blank')}
                  >
                    🔍 View Swagger UI
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={exportDocumentation}
                  >
                    📁 Export OpenAPI Spec
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="docs-footer">
        <div className="footer-content">
          <div className="footer-stats">
            Last updated: {formatTimestamp(stats.lastScan)}
          </div>
          <div className="footer-actions">
            <a href="/api/docs/openapi.json" target="_blank" rel="noopener noreferrer">
              📄 OpenAPI Spec
            </a>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              📖 Swagger UI
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default APIDocs;
