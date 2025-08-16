import React, { useState, useEffect, useCallback } from 'react';
import './SecurityTestingDashboard.css';

const SecurityTestingDashboard = () => {
    // State management
    const [dashboardData, setDashboardData] = useState({
        suites: [],
        metrics: {},
        vulnerabilities: [],
        activeTests: 0,
        recentRuns: [],
        trends: []
    });
    const [loading, setLoading] = useState({
        suites: true,
        metrics: true,
        vulnerabilities: true,
        runningTest: false
    });
    const [error, setError] = useState(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
    const [testRunResults, setTestRunResults] = useState({});
    const [showRunDialog, setShowRunDialog] = useState(false);
    const [selectedSuite, setSelectedSuite] = useState(null);
    const [filters, setFilters] = useState({
        vulnerabilitySeverity: 'all',
        vulnerabilityStatus: 'open',
        vulnerabilityType: 'all'
    });

    // Auto-refresh interval
    const [autoRefresh, setAutoRefresh] = useState(true);
    const refreshInterval = 30000; // 30 seconds

    // Fetch security test suites
    const fetchTestSuites = useCallback(async () => {
        try {
            const response = await fetch('/api/security-testing/suites');
            const result = await response.json();
            
            if (result.success) {
                setDashboardData(prev => ({
                    ...prev,
                    suites: result.data.suites,
                    activeTests: result.data.activeTestCount
                }));
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to fetch test suites:', error);
            setError('Failed to load security test suites');
        } finally {
            setLoading(prev => ({ ...prev, suites: false }));
        }
    }, []);

    // Fetch security testing metrics
    const fetchMetrics = useCallback(async () => {
        try {
            const response = await fetch(`/api/security-testing/metrics?timeframe=${selectedTimeframe}`);
            const result = await response.json();
            
            if (result.success) {
                setDashboardData(prev => ({
                    ...prev,
                    metrics: result.data.dashboardStats,
                    trends: result.data.trends,
                    recentRuns: result.data.suitePerformance
                }));
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
            setError('Failed to load security testing metrics');
        } finally {
            setLoading(prev => ({ ...prev, metrics: false }));
        }
    }, [selectedTimeframe]);

    // Fetch vulnerabilities
    const fetchVulnerabilities = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams();
            if (filters.vulnerabilitySeverity !== 'all') {
                queryParams.append('severity', filters.vulnerabilitySeverity);
            }
            if (filters.vulnerabilityStatus !== 'all') {
                queryParams.append('status', filters.vulnerabilityStatus);
            }
            if (filters.vulnerabilityType !== 'all') {
                queryParams.append('type', filters.vulnerabilityType);
            }
            queryParams.append('limit', '20');

            const response = await fetch(`/api/security-testing/vulnerabilities?${queryParams}`);
            const result = await response.json();
            
            if (result.success) {
                setDashboardData(prev => ({
                    ...prev,
                    vulnerabilities: result.data.vulnerabilities
                }));
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to fetch vulnerabilities:', error);
            setError('Failed to load vulnerabilities');
        } finally {
            setLoading(prev => ({ ...prev, vulnerabilities: false }));
        }
    }, [filters]);

    // Initial data loading
    useEffect(() => {
        const loadDashboard = async () => {
            setError(null);
            await Promise.all([
                fetchTestSuites(),
                fetchMetrics(),
                fetchVulnerabilities()
            ]);
        };

        loadDashboard();
    }, [fetchTestSuites, fetchMetrics, fetchVulnerabilities]);

    // Auto-refresh functionality
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchTestSuites();
            fetchMetrics();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, fetchTestSuites, fetchMetrics]);

    // Run security test suite
    const runTestSuite = async (suiteId, options = {}) => {
        try {
            setLoading(prev => ({ ...prev, runningTest: true }));
            
            const response = await fetch(`/api/security-testing/suites/${suiteId}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(options)
            });

            const result = await response.json();
            
            if (result.success) {
                if (result.data.testRun) {
                    // Test completed immediately
                    setTestRunResults(prev => ({
                        ...prev,
                        [result.data.testRun.id]: result.data.testRun
                    }));
                } else {
                    // Test is running, will poll for results
                    console.log('Test suite started, running in background');
                }
                
                // Refresh suites to show updated active test count
                fetchTestSuites();
                
                // Show success message
                alert(`Security test suite ${suiteId} started successfully`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to run test suite:', error);
            alert(`Failed to run test suite: ${error.message}`);
        } finally {
            setLoading(prev => ({ ...prev, runningTest: false }));
            setShowRunDialog(false);
        }
    };

    // Update vulnerability status
    const updateVulnerabilityStatus = async (vulnerabilityId, newStatus) => {
        try {
            const response = await fetch(`/api/security-testing/vulnerabilities/${vulnerabilityId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();
            
            if (result.success) {
                // Refresh vulnerabilities
                fetchVulnerabilities();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to update vulnerability:', error);
            alert(`Failed to update vulnerability: ${error.message}`);
        }
    };

    // Get severity color
    const getSeverityColor = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'critical': return '#dc3545';
            case 'high': return '#fd7e14';
            case 'medium': return '#ffc107';
            case 'low': return '#28a745';
            default: return '#6c757d';
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return '#28a745';
            case 'running': return '#007bff';
            case 'failed': return '#dc3545';
            case 'error': return '#dc3545';
            case 'open': return '#dc3545';
            case 'investigating': return '#ffc107';
            case 'fixed': return '#28a745';
            case 'false_positive': return '#6c757d';
            default: return '#6c757d';
        }
    };

    // Format duration
    const formatDuration = (durationMs) => {
        if (!durationMs) return 'N/A';
        
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // Render loading state
    if (loading.suites && loading.metrics && loading.vulnerabilities) {
        return (
            <div className="security-testing-dashboard loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading Security Testing Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="security-testing-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <h1>Security Testing Dashboard</h1>
                <div className="header-controls">
                    <select 
                        value={selectedTimeframe} 
                        onChange={(e) => setSelectedTimeframe(e.target.value)}
                        className="timeframe-selector"
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <button 
                        className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Metrics Overview */}
            <div className="metrics-overview">
                <div className="metric-card">
                    <h3>Total Test Runs</h3>
                    <div className="metric-value">{dashboardData.metrics.total_test_runs || 0}</div>
                    <div className="metric-trend">
                        <span className="trend-label">Success Rate: </span>
                        <span className="trend-value">
                            {dashboardData.metrics.total_test_runs ? 
                                Math.round((dashboardData.metrics.completed_runs / dashboardData.metrics.total_test_runs) * 100) : 0}%
                        </span>
                    </div>
                </div>

                <div className="metric-card active-tests">
                    <h3>Active Tests</h3>
                    <div className="metric-value">{dashboardData.activeTests}</div>
                    <div className="metric-trend">
                        <span className={`status-indicator ${dashboardData.activeTests > 0 ? 'running' : 'idle'}`}>
                            {dashboardData.activeTests > 0 ? 'Running' : 'Idle'}
                        </span>
                    </div>
                </div>

                <div className="metric-card vulnerabilities">
                    <h3>Total Vulnerabilities</h3>
                    <div className="metric-value">{dashboardData.metrics.total_vulnerabilities || 0}</div>
                    <div className="metric-trend">
                        <span className="trend-label">Open Issues: </span>
                        <span className="trend-value">{dashboardData.vulnerabilities.filter(v => v.status === 'open').length}</span>
                    </div>
                </div>

                <div className="metric-card performance">
                    <h3>Avg Test Duration</h3>
                    <div className="metric-value">
                        {formatDuration(dashboardData.metrics.avg_duration_ms)}
                    </div>
                    <div className="metric-trend">
                        <span className="trend-label">Last 7 days: </span>
                        <span className="trend-value">{dashboardData.metrics.runs_last_7_days || 0} runs</span>
                    </div>
                </div>
            </div>

            {/* Test Suites */}
            <div className="dashboard-section">
                <div className="section-header">
                    <h2>Security Test Suites</h2>
                    <button 
                        className="refresh-button"
                        onClick={fetchTestSuites}
                        disabled={loading.suites}
                    >
                        🔄 Refresh
                    </button>
                </div>
                
                <div className="test-suites-grid">
                    {dashboardData.suites.map(suite => (
                        <div key={suite.id} className={`test-suite-card ${!suite.enabled ? 'disabled' : ''}`}>
                            <div className="suite-header">
                                <h3>{suite.name}</h3>
                                <span className={`suite-status ${suite.enabled ? 'enabled' : 'disabled'}`}>
                                    {suite.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            
                            <p className="suite-description">{suite.description}</p>
                            
                            <div className="suite-stats">
                                <span>Tests: {suite.testCount}</span>
                                <span>Frequency: {suite.frequency}</span>
                            </div>
                            
                            <div className="suite-actions">
                                <button 
                                    className="run-suite-button"
                                    onClick={() => {
                                        setSelectedSuite(suite);
                                        setShowRunDialog(true);
                                    }}
                                    disabled={!suite.enabled || loading.runningTest}
                                >
                                    {loading.runningTest ? 'Running...' : 'Run Suite'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Vulnerabilities */}
            <div className="dashboard-section">
                <div className="section-header">
                    <h2>Security Vulnerabilities</h2>
                    <div className="vulnerability-filters">
                        <select 
                            value={filters.vulnerabilitySeverity}
                            onChange={(e) => setFilters(prev => ({ ...prev, vulnerabilitySeverity: e.target.value }))}
                        >
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        
                        <select 
                            value={filters.vulnerabilityStatus}
                            onChange={(e) => setFilters(prev => ({ ...prev, vulnerabilityStatus: e.target.value }))}
                        >
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="investigating">Investigating</option>
                            <option value="fixed">Fixed</option>
                            <option value="false_positive">False Positive</option>
                        </select>
                    </div>
                </div>
                
                <div className="vulnerabilities-table">
                    {loading.vulnerabilities ? (
                        <div className="loading-state">Loading vulnerabilities...</div>
                    ) : dashboardData.vulnerabilities.length === 0 ? (
                        <div className="empty-state">
                            <p>No vulnerabilities found matching current filters</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Severity</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Found</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardData.vulnerabilities.map(vuln => (
                                    <tr key={vuln.id}>
                                        <td>
                                            <span className="vulnerability-type">
                                                {vuln.vulnerability_type?.replace(/_/g, ' ') || 'Unknown'}
                                            </span>
                                        </td>
                                        <td>
                                            <span 
                                                className="severity-badge"
                                                style={{ backgroundColor: getSeverityColor(vuln.severity) }}
                                            >
                                                {vuln.severity?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="vulnerability-description">
                                                <strong>{vuln.title}</strong>
                                                <p>{vuln.description}</p>
                                                {vuln.affected_endpoint && (
                                                    <code>Endpoint: {vuln.affected_endpoint}</code>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span 
                                                className="status-badge"
                                                style={{ color: getStatusColor(vuln.status) }}
                                            >
                                                {vuln.status?.replace(/_/g, ' ')?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="date">
                                                {new Date(vuln.created_at).toLocaleDateString()}
                                            </span>
                                            <br />
                                            <small>via {vuln.suite_name}</small>
                                        </td>
                                        <td>
                                            <div className="vulnerability-actions">
                                                {vuln.status === 'open' && (
                                                    <button 
                                                        className="action-button investigate"
                                                        onClick={() => updateVulnerabilityStatus(vuln.id, 'investigating')}
                                                    >
                                                        Investigate
                                                    </button>
                                                )}
                                                {vuln.status === 'investigating' && (
                                                    <button 
                                                        className="action-button fixed"
                                                        onClick={() => updateVulnerabilityStatus(vuln.id, 'fixed')}
                                                    >
                                                        Mark Fixed
                                                    </button>
                                                )}
                                                <button 
                                                    className="action-button details"
                                                    onClick={() => alert(`Vulnerability Details:\n${JSON.stringify(vuln, null, 2)}`)}
                                                >
                                                    Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Test Run Dialog */}
            {showRunDialog && selectedSuite && (
                <div className="dialog-overlay">
                    <div className="dialog">
                        <div className="dialog-header">
                            <h3>Run Security Test Suite</h3>
                            <button 
                                className="close-button"
                                onClick={() => setShowRunDialog(false)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="dialog-content">
                            <p><strong>Suite:</strong> {selectedSuite.name}</p>
                            <p><strong>Description:</strong> {selectedSuite.description}</p>
                            <p><strong>Test Count:</strong> {selectedSuite.testCount}</p>
                            
                            <div className="test-options">
                                <h4>Test Options:</h4>
                                <label>
                                    <input type="checkbox" defaultChecked />
                                    Enable comprehensive scanning
                                </label>
                                <label>
                                    <input type="checkbox" />
                                    Generate detailed report
                                </label>
                                <label>
                                    <input type="checkbox" />
                                    Send email notifications
                                </label>
                            </div>
                        </div>
                        
                        <div className="dialog-actions">
                            <button 
                                className="cancel-button"
                                onClick={() => setShowRunDialog(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="run-button"
                                onClick={() => runTestSuite(selectedSuite.id)}
                                disabled={loading.runningTest}
                            >
                                {loading.runningTest ? 'Running...' : 'Run Test Suite'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Runs */}
            <div className="dashboard-section">
                <div className="section-header">
                    <h2>Recent Test Runs</h2>
                </div>
                
                <div className="recent-runs-table">
                    {dashboardData.recentRuns.length === 0 ? (
                        <div className="empty-state">
                            <p>No recent test runs available</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Suite</th>
                                    <th>Status</th>
                                    <th>Duration</th>
                                    <th>Vulnerabilities</th>
                                    <th>Success Rate</th>
                                    <th>Last Run</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardData.recentRuns.map((run, index) => (
                                    <tr key={index}>
                                        <td>{run.suite_name}</td>
                                        <td>
                                            <span 
                                                className="status-indicator"
                                                style={{ color: getStatusColor('completed') }}
                                            >
                                                Active
                                            </span>
                                        </td>
                                        <td>{formatDuration(run.avg_duration_ms)}</td>
                                        <td>{Math.round(run.avg_vulnerabilities_per_run || 0)}</td>
                                        <td>
                                            {run.total_runs ? 
                                                Math.round((run.successful_runs / run.total_runs) * 100) : 0}%
                                        </td>
                                        <td>
                                            {run.last_run_at ? 
                                                new Date(run.last_run_at).toLocaleString() : 'Never'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityTestingDashboard;
