/**
 * @fileoverview Performance Monitoring Dashboard (Task 19)
 * React component for comprehensive performance monitoring and alerting
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AlertCircle, Activity, Clock, Zap, Server, Database, Wifi, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export function PerformanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('system');
  const intervalRef = useRef(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/performance/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err.message);
      console.error('Performance Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh setup
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchDashboardData, 10000); // 10 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // Get status color based on value and threshold
  const getStatusColor = (value, threshold, isPercentage = false) => {
    const normalizedValue = isPercentage ? value / 100 : value;
    const normalizedThreshold = isPercentage ? threshold / 100 : threshold;
    
    if (normalizedValue >= normalizedThreshold * 0.9) return 'text-red-500';
    if (normalizedValue >= normalizedThreshold * 0.7) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Format metric value
  const formatValue = (value, unit) => {
    if (typeof value !== 'number') return 'N/A';
    
    switch (unit) {
      case 'ms':
        return `${value.toFixed(0)}ms`;
      case '%':
        return `${value.toFixed(1)}%`;
      case 'req/s':
        return `${value.toFixed(1)} req/s`;
      case 'connections':
        return `${value} conn`;
      case 'MB':
        return `${(value / 1024 / 1024).toFixed(1)}MB`;
      default:
        return value.toString();
    }
  };

  // Get alert severity badge
  const getAlertBadge = (severity) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    };
    
    return (
      <Badge className={colors[severity] || colors.medium}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading performance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !data.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No performance data available</p>
        </div>
      </div>
    );
  }

  const { metrics, alerts, recommendations, status, uptime } = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-gray-600 dark:text-gray-400">
            System uptime: {Math.floor(uptime / 1000 / 60)} minutes | Status: {status}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleAutoRefresh}
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Summary */}
      {alerts && alerts.count > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
                Active Alerts ({alerts.count})
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{alerts.criticalCount}</p>
                <p className="text-sm text-red-500">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{alerts.highCount}</p>
                <p className="text-sm text-orange-500">High</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{alerts.mediumCount}</p>
                <p className="text-sm text-yellow-500">Medium</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{alerts.lowCount}</p>
                <p className="text-sm text-blue-500">Low</p>
              </div>
            </div>
            <div className="space-y-2">
              {alerts.active.slice(0, 3).map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center space-x-2">
                    {getAlertBadge(alert.severity)}
                    <span className="font-medium">{alert.metric}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatValue(alert.value, alert.unit || '')} / {formatValue(alert.threshold, alert.unit || '')}
                  </div>
                </div>
              ))}
              {alerts.active.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{alerts.active.length - 3} more alerts
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Categories */}
      <div className="flex space-x-2 mb-6">
        {['system', 'application', 'database'].map((category) => (
          <Button
            key={category}
            onClick={() => setSelectedMetric(category)}
            variant={selectedMetric === category ? 'default' : 'outline'}
            size="sm"
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Metrics */}
        {(selectedMetric === 'system' && metrics?.system) && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">CPU Usage</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${getStatusColor(metrics.system.cpu, 80, true)}`}>
                      {formatValue(metrics.system.cpu, '%')}
                    </p>
                    <p className="text-sm text-gray-500">Threshold: 80%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Memory Usage</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${getStatusColor(metrics.system.memory, 85, true)}`}>
                      {formatValue(metrics.system.memory, '%')}
                    </p>
                    <p className="text-sm text-gray-500">Threshold: 85%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Disk Usage</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${getStatusColor(metrics.system.disk, 90, true)}`}>
                      {formatValue(metrics.system.disk, '%')}
                    </p>
                    <p className="text-sm text-gray-500">Threshold: 90%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Application Metrics */}
        {(selectedMetric === 'application' && metrics?.application) && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Response Time</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${getStatusColor(metrics.application.responseTime, 2000)}`}>
                      {formatValue(metrics.application.responseTime, 'ms')}
                    </p>
                    <p className="text-sm text-gray-500">Threshold: 2000ms</p>
                  </div>
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Throughput</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatValue(metrics.application.throughput, 'req/s')}
                    </p>
                    <p className="text-sm text-gray-500">Requests per second</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Error Rate</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${getStatusColor(metrics.application.errorRate, 0.05, true)}`}>
                      {formatValue(metrics.application.errorRate, '%')}
                    </p>
                    <p className="text-sm text-gray-500">Threshold: 5%</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Database Metrics */}
        {(selectedMetric === 'database' && metrics?.database) && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Connection Pool</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatValue(metrics.database.connectionPool, 'connections')}
                    </p>
                    <p className="text-sm text-gray-500">Pool size</p>
                  </div>
                  <Database className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Wifi className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Active Connections</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {formatValue(metrics.database.activeConnections, 'connections')}
                    </p>
                    <p className="text-sm text-gray-500">Active connections</p>
                  </div>
                  <Wifi className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Query Duration</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatValue(metrics.database.queryDuration, 'ms')}
                    </p>
                    <p className="text-sm text-gray-500">Average query time</p>
                  </div>
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.slice(0, 5).map((rec, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {getAlertBadge(rec.severity)}
                      <span className="text-sm text-gray-500">{rec.rule}</span>
                    </div>
                    <p className="text-sm">{rec.recommendation}</p>
                    {rec.automated && (
                      <p className="text-xs text-green-600 mt-1">✓ Automated optimization available</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PerformanceDashboard;
