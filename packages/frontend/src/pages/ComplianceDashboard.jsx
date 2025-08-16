/**
 * Compliance Dashboard Component
 * Real-time compliance monitoring and reporting interface
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import React, { useState, useEffect, useCallback } from 'react';
import './ComplianceDashboard.css';

const ComplianceDashboard = () => {
    const [complianceData, setComplianceData] = useState(null);
    const [violations, setViolations] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [frameworks, setFrameworks] = useState({});
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStandard, setSelectedStandard] = useState('all');
    const [activeTab, setActiveTab] = useState('overview');
    const [reportGenerating, setReportGenerating] = useState(false);

    // Fetch compliance overview data
    const fetchComplianceOverview = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch('/api/compliance/overview', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                setComplianceData(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch compliance data');
            }
        } catch (err) {
            console.error('Compliance overview fetch error:', err);
            setError(err.message);
        }
    }, []);

    // Fetch violations data
    const fetchViolations = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (selectedStandard !== 'all') {
                params.set('standard', selectedStandard);
            }

            const response = await fetch(`/api/compliance/violations?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setViolations(data.data.violations);
                }
            }
        } catch (err) {
            console.error('Violations fetch error:', err);
        }
    }, [selectedStandard]);

    // Fetch recommendations data
    const fetchRecommendations = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/compliance/recommendations', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setRecommendations(data.data.recommendations);
                }
            }
        } catch (err) {
            console.error('Recommendations fetch error:', err);
        }
    }, []);

    // Fetch frameworks data
    const fetchFrameworks = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/compliance/frameworks', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setFrameworks(data.data.frameworks);
                }
            }
        } catch (err) {
            console.error('Frameworks fetch error:', err);
        }
    }, []);

    // Fetch reports data
    const fetchReports = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/compliance/reports', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setReports(data.data.reports);
                }
            }
        } catch (err) {
            console.error('Reports fetch error:', err);
        }
    }, []);

    // Generate compliance report
    const generateReport = async (format = 'json') => {
        setReportGenerating(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/compliance/reports/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    standard: selectedStandard !== 'all' ? selectedStandard : null,
                    format
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await fetchReports(); // Refresh reports list
                    alert(`Report generated successfully! Report ID: ${data.data.report_id}`);
                }
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (err) {
            console.error('Report generation error:', err);
            alert('Failed to generate report: ' + err.message);
        } finally {
            setReportGenerating(false);
        }
    };

    // Trigger manual compliance check
    const triggerManualCheck = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/compliance/check', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    standard: selectedStandard !== 'all' ? selectedStandard : null
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Refresh all data after check
                    await Promise.all([
                        fetchComplianceOverview(),
                        fetchViolations(),
                        fetchRecommendations()
                    ]);
                    alert('Compliance check completed successfully!');
                }
            } else {
                throw new Error('Failed to trigger compliance check');
            }
        } catch (err) {
            console.error('Manual check error:', err);
            alert('Failed to trigger compliance check: ' + err.message);
        }
    };

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchComplianceOverview(),
                    fetchViolations(),
                    fetchRecommendations(),
                    fetchFrameworks(),
                    fetchReports()
                ]);
            } catch (err) {
                console.error('Data loading error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [fetchComplianceOverview, fetchViolations, fetchRecommendations, fetchFrameworks, fetchReports]);

    // Refresh violations when standard changes
    useEffect(() => {
        if (!loading) {
            fetchViolations();
        }
    }, [selectedStandard, fetchViolations, loading]);

    // Auto-refresh data every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading) {
                fetchComplianceOverview();
                fetchViolations();
            }
        }, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, [loading, fetchComplianceOverview, fetchViolations]);

    if (loading) {
        return (
            <div className="compliance-dashboard">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading compliance data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="compliance-dashboard">
                <div className="error-container">
                    <h2>Error Loading Compliance Dashboard</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="compliance-dashboard">
            <div className="dashboard-header">
                <h1>🛡️ Compliance Monitoring Dashboard</h1>
                <div className="header-controls">
                    <select 
                        value={selectedStandard} 
                        onChange={(e) => setSelectedStandard(e.target.value)}
                        className="standard-selector"
                    >
                        <option value="all">All Standards</option>
                        {complianceData?.enabled_standards?.map(standard => (
                            <option key={standard} value={standard}>{standard}</option>
                        ))}
                    </select>
                    <button 
                        onClick={triggerManualCheck}
                        className="action-button primary"
                        disabled={loading}
                    >
                        🔄 Run Check
                    </button>
                </div>
            </div>

            {complianceData && (
                <div className="overview-cards">
                    <div className="metric-card overall-score">
                        <h3>Overall Compliance Score</h3>
                        <div className={`score-circle ${complianceData.overall_status}`}>
                            <span className="score-value">{complianceData.overall_score}%</span>
                        </div>
                        <p className={`status-text ${complianceData.overall_status}`}>
                            {complianceData.overall_status.replace('_', ' ').toUpperCase()}
                        </p>
                    </div>

                    <div className="metric-card violations">
                        <h3>Total Violations</h3>
                        <div className="metric-value">
                            <span className="number">{complianceData.total_violations}</span>
                            <span className="critical">({complianceData.critical_violations} critical)</span>
                        </div>
                    </div>

                    <div className="metric-card standards">
                        <h3>Standards Monitored</h3>
                        <div className="metric-value">
                            <span className="number">{complianceData.total_standards}</span>
                            <span className="label">Active Standards</span>
                        </div>
                    </div>

                    <div className="metric-card next-check">
                        <h3>Next Automated Check</h3>
                        <div className="metric-value">
                            <span className="time">
                                {new Date(complianceData.next_check).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="compliance-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button 
                    className={`tab-button ${activeTab === 'violations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('violations')}
                >
                    ⚠️ Violations ({violations.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recommendations')}
                >
                    💡 Recommendations ({recommendations.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'frameworks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('frameworks')}
                >
                    📋 Frameworks
                </button>
                <button 
                    className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                >
                    📄 Reports ({reports.length})
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-content">
                        <div className="standards-grid">
                            {complianceData?.compliance_scores && Object.entries(complianceData.compliance_scores).map(([standard, score]) => (
                                <div key={standard} className={`standard-card ${score.status}`}>
                                    <h4>{standard}</h4>
                                    <div className="standard-score">
                                        <span className="score-percentage">{score.score}%</span>
                                        <span className={`status-badge ${score.status}`}>
                                            {score.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="standard-metrics">
                                        <span>{score.violations} violations</span>
                                        <span>{score.categories} categories</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'violations' && (
                    <div className="violations-content">
                        <div className="violations-header">
                            <h3>Compliance Violations</h3>
                            <div className="filter-controls">
                                <select className="filter-select">
                                    <option value="">All Risk Levels</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div className="violations-list">
                            {violations.map((violation, index) => (
                                <div key={index} className={`violation-card ${violation.risk_level}`}>
                                    <div className="violation-header">
                                        <h4>{violation.name}</h4>
                                        <span className={`risk-badge ${violation.risk_level}`}>
                                            {violation.risk_level.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="violation-description">{violation.description}</p>
                                    <div className="violation-meta">
                                        <span className="standard-tag">{violation.standard}</span>
                                        <span className="control-id">{violation.id}</span>
                                        {violation.category && (
                                            <span className="category-tag">{violation.category}</span>
                                        )}
                                    </div>
                                    {violation.findings && violation.findings.length > 0 && (
                                        <div className="violation-findings">
                                            <h5>Findings:</h5>
                                            <ul>
                                                {violation.findings.map((finding, idx) => (
                                                    <li key={idx}>{finding.details || finding.requirement}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {violations.length === 0 && (
                                <div className="no-violations">
                                    <p>✅ No compliance violations found!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'recommendations' && (
                    <div className="recommendations-content">
                        <h3>Compliance Recommendations</h3>
                        <div className="recommendations-list">
                            {recommendations.map((recommendation, index) => (
                                <div key={index} className={`recommendation-card ${recommendation.priority}`}>
                                    <div className="recommendation-header">
                                        <h4>{recommendation.title}</h4>
                                        <span className={`priority-badge ${recommendation.priority}`}>
                                            {recommendation.priority.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="recommendation-description">{recommendation.description}</p>
                                    {recommendation.remediation_steps && (
                                        <div className="remediation-steps">
                                            <h5>Remediation Steps:</h5>
                                            <ol>
                                                {recommendation.remediation_steps.map((step, idx) => (
                                                    <li key={idx}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                    <div className="recommendation-meta">
                                        <span className="effort-estimate">Effort: {recommendation.estimated_effort}</span>
                                        <span className="compliance-impact">{recommendation.compliance_impact}</span>
                                    </div>
                                </div>
                            ))}
                            {recommendations.length === 0 && (
                                <div className="no-recommendations">
                                    <p>✅ No recommendations at this time!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'frameworks' && (
                    <div className="frameworks-content">
                        <h3>Compliance Frameworks</h3>
                        <div className="frameworks-grid">
                            {Object.entries(frameworks).map(([standardId, framework]) => (
                                <div key={standardId} className={`framework-card ${framework.enabled ? 'enabled' : 'disabled'}`}>
                                    <div className="framework-header">
                                        <h4>{framework.name}</h4>
                                        <span className={`status-indicator ${framework.enabled ? 'enabled' : 'disabled'}`}>
                                            {framework.enabled ? '✅ Enabled' : '⭕ Disabled'}
                                        </span>
                                    </div>
                                    <p className="framework-description">{framework.description}</p>
                                    <div className="framework-details">
                                        <div className="detail-item">
                                            <span className="label">Version:</span>
                                            <span className="value">{framework.version}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Categories:</span>
                                            <span className="value">{framework.categories.length}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Controls:</span>
                                            <span className="value">{framework.total_controls}</span>
                                        </div>
                                    </div>
                                    <div className="framework-categories">
                                        {framework.categories.map(category => (
                                            <span key={category} className="category-pill">{category}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="reports-content">
                        <div className="reports-header">
                            <h3>Compliance Reports</h3>
                            <div className="report-actions">
                                <button 
                                    onClick={() => generateReport('json')}
                                    className="action-button secondary"
                                    disabled={reportGenerating}
                                >
                                    📄 Generate JSON Report
                                </button>
                                <button 
                                    onClick={() => generateReport('html')}
                                    className="action-button secondary"
                                    disabled={reportGenerating}
                                >
                                    🌐 Generate HTML Report
                                </button>
                            </div>
                        </div>
                        <div className="reports-list">
                            {reports.map((report, index) => (
                                <div key={report.id} className="report-card">
                                    <div className="report-header">
                                        <h4>Compliance Report #{index + 1}</h4>
                                        <span className="report-date">
                                            {new Date(report.generated_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="report-details">
                                        <div className="detail-item">
                                            <span className="label">Standards:</span>
                                            <span className="value">{report.standards.join(', ')}</span>
                                        </div>
                                        {report.overall_score !== undefined && (
                                            <div className="detail-item">
                                                <span className="label">Overall Score:</span>
                                                <span className="value">{report.overall_score}%</span>
                                            </div>
                                        )}
                                        {report.total_violations !== undefined && (
                                            <div className="detail-item">
                                                <span className="label">Violations:</span>
                                                <span className="value">{report.total_violations}</span>
                                            </div>
                                        )}
                                        <div className="detail-item">
                                            <span className="label">Status:</span>
                                            <span className={`status-value ${report.compliance_status}`}>
                                                {report.compliance_status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="report-actions">
                                        <button className="action-button small">📁 View Report</button>
                                        <button className="action-button small secondary">📥 Download</button>
                                    </div>
                                </div>
                            ))}
                            {reports.length === 0 && (
                                <div className="no-reports">
                                    <p>📄 No compliance reports generated yet.</p>
                                    <button 
                                        onClick={() => generateReport()}
                                        className="action-button primary"
                                        disabled={reportGenerating}
                                    >
                                        Generate First Report
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceDashboard;
