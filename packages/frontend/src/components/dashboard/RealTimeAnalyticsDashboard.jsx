import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { io } from 'socket.io-client';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

/**
 * Comprehensive Real-Time Analytics Dashboard
 * 
 * Features:
 * - Real-time data streaming via WebSocket
 * - Interactive charts and visualizations
 * - Customizable dashboard layout
 * - Multi-metric tracking
 * - Responsive design
 * - Export capabilities
 * - Drill-down functionality
 * - Performance monitoring
 * - KPI tracking
 * - Anomaly detection alerts
 */

const RealTimeAnalyticsDashboard = () => {
  // State management
  const [dashboardData, setDashboardData] = useState(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState({});
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedMetrics, setSelectedMetrics] = useState(['users', 'sessions', 'requests']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  
  // Refs
  const socketRef = useRef(null);
  const dashboardRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  
  // Chart color scheme
  const colorScheme = {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#F59E0B',
    warning: '#EF4444',
    info: '#6366F1',
    success: '#10B981'
  };
  
  // Available metrics configuration
  const availableMetrics = useMemo(() => ({
    users: { name: 'Active Users', color: colorScheme.primary, type: 'line' },
    sessions: { name: 'User Sessions', color: colorScheme.secondary, type: 'line' },
    requests: { name: 'API Requests', color: colorScheme.accent, type: 'bar' },
    errors: { name: 'Error Rate', color: colorScheme.warning, type: 'line' },
    performance: { name: 'Response Time', color: colorScheme.info, type: 'line' },
    conversions: { name: 'Conversion Rate', color: colorScheme.success, type: 'line' }
  }), [colorScheme]);
  
  // Time range options
  const timeRangeOptions = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' }
  ];
  
  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = () => {
      try {
        socketRef.current = io('/analytics', {
          transports: ['websocket', 'polling']
        });
        
        socketRef.current.on('connect', () => {
          console.log('Connected to analytics WebSocket');
          socketRef.current.emit('subscribe', { metrics: selectedMetrics });
        });
        
        socketRef.current.on('metrics_update', (data) => {
          setRealtimeMetrics(prev => ({
            ...prev,
            ...data
          }));
        });
        
        socketRef.current.on('dashboard_update', (data) => {
          setDashboardData(prev => ({
            ...prev,
            ...data
          }));
        });
        
        socketRef.current.on('alert', (alert) => {
          setAlerts(prev => [alert, ...prev.slice(0, 9)]);
        });
        
        socketRef.current.on('system_health', (health) => {
          setSystemHealth(health);
        });
        
        socketRef.current.on('disconnect', () => {
          console.log('Disconnected from analytics WebSocket');
        });
        
        socketRef.current.on('error', (error) => {
          console.error('WebSocket error:', error);
          setError('Real-time connection error');
        });
        
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        setError('Failed to connect to real-time analytics');
      }
    };
    
    initializeWebSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [selectedMetrics]);
  
  // Load initial dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/dashboard?timeRange=${selectedTimeRange}&includeRealTime=true&includeKPIs=true&includeTrends=true&includeAlerts=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load dashboard data');
      }
      
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTimeRange]);
  
  // Load system health
  const loadSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/health');
      const result = await response.json();
      
      if (result.success) {
        setSystemHealth(result.data);
      }
      
    } catch (err) {
      console.error('Error loading system health:', err);
    }
  }, []);
  
  // Initial data load
  useEffect(() => {
    loadDashboardData();
    loadSystemHealth();
  }, [loadDashboardData, loadSystemHealth]);
  
  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadDashboardData();
        loadSystemHealth();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, loadDashboardData, loadSystemHealth]);
  
  // Handle metric selection
  const handleMetricToggle = (metricKey) => {
    setSelectedMetrics(prev => {
      const newSelection = prev.includes(metricKey)
        ? prev.filter(m => m !== metricKey)
        : [...prev, metricKey];
      
      // Update WebSocket subscription
      if (socketRef.current) {
        socketRef.current.emit('subscribe', { metrics: newSelection });
      }
      
      return newSelection;
    });
  };
  
  // Generate chart data
  const generateChartData = (metricKey, data) => {
    if (!data || !data.timeSeries) return null;
    
    const metric = availableMetrics[metricKey];
    if (!metric) return null;
    
    return {
      labels: data.timeSeries.timestamps || [],
      datasets: [{
        label: metric.name,
        data: data.timeSeries[metricKey] || [],
        borderColor: metric.color,
        backgroundColor: `${metric.color}20`,
        fill: true,
        tension: 0.4
      }]
    };
  };
  
  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        display: true,
      },
      y: {
        display: true,
        beginAtZero: true,
      },
    },
    animation: {
      duration: 200,
    },
  };
  
  // Export dashboard data
  const exportData = async (format = 'json') => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        timeRange: selectedTimeRange,
        selectedMetrics,
        dashboardData,
        realtimeMetrics,
        systemHealth
      };
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-dashboard-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        // Convert to CSV format
        let csv = 'Timestamp,Metric,Value\n';
        
        Object.entries(realtimeMetrics).forEach(([metric, data]) => {
          if (data && data.timeSeries) {
            data.timeSeries.timestamps?.forEach((timestamp, index) => {
              const value = data.timeSeries[metric]?.[index];
              csv += `${timestamp},${metric},${value}\n`;
            });
          }
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-dashboard-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('Failed to export dashboard data');
    }
  };
  
  // Render loading state
  if (isLoading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading Analytics Dashboard...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadDashboardData();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4" ref={dashboardRef}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Real-time insights and performance metrics</p>
          </div>
          
          <div className="mt-4 lg:mt-0 flex flex-wrap gap-3">
            {/* Time Range Selector */}
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                autoRefresh
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
            </button>
            
            {/* Export Button */}
            <div className="relative inline-block">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    exportData(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer"
              >
                <option value="">📥 Export</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Error Banner */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <span className="text-red-600">⚠️</span>
              <span className="ml-2 text-sm text-red-700">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* System Health Status */}
      {systemHealth && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-semibold mb-3">System Health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl ${systemHealth.overall === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                {systemHealth.overall === 'healthy' ? '✅' : '❌'}
              </div>
              <div className="text-sm font-medium">Overall Status</div>
              <div className="text-xs text-gray-600 capitalize">{systemHealth.overall}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-blue-600">{systemHealth.uptime || 'N/A'}</div>
              <div className="text-sm font-medium">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-purple-600">{systemHealth.connections || 0}</div>
              <div className="text-sm font-medium">Active Connections</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Recent Alerts</h3>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {alerts.slice(0, 5).map((alert, index) => (
              <div key={index} className="p-3 border-b last:border-b-0 flex items-center">
                <span className={`text-sm mr-2 ${
                  alert.severity === 'critical' ? 'text-red-600' :
                  alert.severity === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {alert.severity === 'critical' ? '🚨' : 
                   alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span className="text-sm flex-1">{alert.message}</span>
                <span className="text-xs text-gray-500">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Metric Selection */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-semibold mb-3">Select Metrics to Display</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(availableMetrics).map(([key, metric]) => (
            <button
              key={key}
              onClick={() => handleMetricToggle(key)}
              className={`px-3 py-1 rounded-full text-sm font-medium border ${
                selectedMetrics.includes(key)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: metric.color }}
              ></span>
              {metric.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedMetrics.map(metricKey => {
          const metric = availableMetrics[metricKey];
          const chartData = generateChartData(metricKey, realtimeMetrics[metricKey]);
          
          if (!chartData) {
            return (
              <div key={metricKey} className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">{metric.name}</h3>
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <p>No data available</p>
                  </div>
                </div>
              </div>
            );
          }
          
          return (
            <div key={metricKey} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{metric.name}</h3>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
              <div className="h-64">
                {metric.type === 'line' && (
                  <Line data={chartData} options={chartOptions} />
                )}
                {metric.type === 'bar' && (
                  <Bar data={chartData} options={chartOptions} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* KPIs Summary */}
      {dashboardData?.kpis && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(dashboardData.kpis).map(([key, kpi]) => (
              <div key={key} className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold mb-1" style={{ color: colorScheme.primary }}>
                  {typeof kpi.currentValue === 'number' 
                    ? kpi.currentValue.toFixed(1) 
                    : kpi.currentValue}
                  {kpi.unit}
                </div>
                <div className="text-sm font-medium text-gray-700">{kpi.name}</div>
                <div className={`text-xs flex items-center justify-center mt-1 ${
                  kpi.trend === 'increasing' ? 'text-green-600' :
                  kpi.trend === 'decreasing' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {kpi.trend === 'increasing' ? '📈' :
                   kpi.trend === 'decreasing' ? '📉' : '➡️'}
                  <span className="ml-1 capitalize">{kpi.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeAnalyticsDashboard;
