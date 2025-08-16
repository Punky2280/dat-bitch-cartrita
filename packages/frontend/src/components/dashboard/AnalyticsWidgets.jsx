import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

/**
 * Analytics Widget Components
 * 
 * Provides modular widgets for the analytics dashboard including:
 * - KPI Cards
 * - Metric Charts
 * - Performance Indicators
 * - Alert Panels
 * - System Health Status
 * - Real-time Counters
 */

// Color palette for charts
const COLORS = {
  primary: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6'],
  status: {
    good: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  }
};

/**
 * KPI Card Component
 */
export const KPICard = ({ 
  title, 
  value, 
  unit = '', 
  target, 
  trend, 
  status = 'info',
  icon,
  onClick,
  isLoading = false 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };
  
  const getStatusBg = () => {
    switch (status) {
      case 'good': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };
  
  if (isLoading) {
    return (
      <div className={`p-6 border rounded-lg ${getStatusBg()}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-8 bg-gray-300 rounded mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={`p-6 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${getStatusBg()}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      
      <div className={`text-3xl font-bold mb-1 ${getStatusColor()}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </div>
      
      <div className="flex items-center justify-between text-sm">
        {target && (
          <span className="text-gray-500">
            Target: {typeof target === 'number' ? target.toLocaleString() : target}{unit}
          </span>
        )}
        
        {trend && (
          <span className="flex items-center">
            <span className="mr-1">{getTrendIcon()}</span>
            <span className="text-gray-600 capitalize">{trend}</span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Metric Chart Component
 */
export const MetricChart = ({ 
  title, 
  data, 
  type = 'line', 
  height = 300,
  color = COLORS.primary[0],
  showGrid = true,
  showTooltip = true,
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="h-4 bg-gray-300 rounded mb-4"></div>
        <div className={`bg-gray-200 rounded animate-pulse`} style={{ height: height }}></div>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex items-center justify-center text-gray-500" style={{ height: height }}>
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p>No data available</p>
          </div>
        </div>
      </div>
    );
  }
  
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="name" />
            <YAxis />
            {showTooltip && <Tooltip />}
            <Bar dataKey="value" fill={color} />
          </BarChart>
        );
      
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill={color}
              dataKey="value"
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
              ))}
            </Pie>
            {showTooltip && <Tooltip />}
          </PieChart>
        );
      
      default:
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="name" />
            <YAxis />
            {showTooltip && <Tooltip />}
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
          </LineChart>
        );
    }
  };
  
  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Real-time Counter Component
 */
export const RealtimeCounter = ({ 
  label, 
  value, 
  increment = 0,
  color = 'text-blue-600',
  size = 'normal' 
}) => {
  const [currentValue, setCurrentValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    setCurrentValue(value);
    if (increment !== 0) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [value, increment]);
  
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'text-lg';
      case 'large': return 'text-4xl';
      default: return 'text-2xl';
    }
  };
  
  return (
    <div className="text-center">
      <div className={`font-bold ${color} ${getSizeClass()} ${isAnimating ? 'animate-pulse' : ''}`}>
        {typeof currentValue === 'number' ? currentValue.toLocaleString() : currentValue}
      </div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
      {increment !== 0 && (
        <div className={`text-xs mt-1 ${increment > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {increment > 0 ? '+' : ''}{increment}
        </div>
      )}
    </div>
  );
};

/**
 * System Health Status Component
 */
export const SystemHealthStatus = ({ health, compact = false }) => {
  if (!health) {
    return (
      <div className="bg-gray-100 border rounded-lg p-4">
        <div className="text-center text-gray-500">Health data unavailable</div>
      </div>
    );
  }
  
  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };
  
  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  };
  
  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-lg">{getHealthIcon(health.overall)}</span>
        <span className={`font-medium ${getHealthColor(health.overall)}`}>
          System {health.overall || 'Unknown'}
        </span>
      </div>
    );
  }
  
  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">System Health</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-3xl mb-2">{getHealthIcon(health.overall)}</div>
          <div className={`font-medium ${getHealthColor(health.overall)}`}>
            {health.overall || 'Unknown'}
          </div>
          <div className="text-sm text-gray-600">Overall Status</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{health.uptime || 'N/A'}</div>
          <div className="text-sm text-gray-600">Uptime</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{health.load || '0%'}</div>
          <div className="text-sm text-gray-600">CPU Load</div>
        </div>
      </div>
      
      {health.services && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Service Status</h4>
          <div className="space-y-2">
            {Object.entries(health.services).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm">{service}</span>
                <span className={`text-sm ${getHealthColor(status)}`}>
                  {getHealthIcon(status)} {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Alert Panel Component
 */
export const AlertPanel = ({ alerts = [], maxAlerts = 5, onDismiss }) => {
  const [visibleAlerts, setVisibleAlerts] = useState(alerts.slice(0, maxAlerts));
  
  useEffect(() => {
    setVisibleAlerts(alerts.slice(0, maxAlerts));
  }, [alerts, maxAlerts]);
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-700';
      case 'warning': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case 'info': return 'border-blue-500 bg-blue-50 text-blue-700';
      default: return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };
  
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };
  
  if (!visibleAlerts.length) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Alerts</h3>
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-2">🔕</div>
          <p>No active alerts</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Alerts</h3>
        <span className="text-sm text-gray-500">{alerts.length} total</span>
      </div>
      
      <div className="space-y-3">
        {visibleAlerts.map((alert, index) => (
          <div
            key={alert.id || index}
            className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
                <div className="flex-1">
                  <div className="font-medium">{alert.title || 'Alert'}</div>
                  <div className="text-sm mt-1">{alert.message}</div>
                  <div className="text-xs mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              
              {onDismiss && (
                <button
                  onClick={() => onDismiss(alert.id || index)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {alerts.length > maxAlerts && (
        <div className="mt-4 text-center">
          <span className="text-sm text-gray-500">
            Showing {maxAlerts} of {alerts.length} alerts
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Performance Indicator Component
 */
export const PerformanceIndicator = ({ 
  title, 
  metrics = [],
  timeRange = '24h',
  showDetails = false 
}) => {
  const getPerformanceColor = (value, threshold) => {
    if (value >= threshold.good) return 'text-green-600';
    if (value >= threshold.warning) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getPerformanceIcon = (value, threshold) => {
    if (value >= threshold.good) return '✅';
    if (value >= threshold.warning) return '⚠️';
    return '❌';
  };
  
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-gray-500">{timeRange}</span>
      </div>
      
      {metrics.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-2">📊</div>
          <p>No metrics available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={metric.name || index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">
                  {getPerformanceIcon(metric.value, metric.threshold)}
                </span>
                <div>
                  <div className="font-medium">{metric.name}</div>
                  {showDetails && metric.description && (
                    <div className="text-sm text-gray-600">{metric.description}</div>
                  )}
                </div>
              </div>
              
              <div className={`font-bold ${getPerformanceColor(metric.value, metric.threshold)}`}>
                {typeof metric.value === 'number' 
                  ? `${metric.value.toFixed(1)}${metric.unit || ''}` 
                  : metric.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Custom Dashboard Grid Layout
 */
export const DashboardGrid = ({ children, columns = 1 }) => {
  const getGridClass = () => {
    switch (columns) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 lg:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-1 lg:grid-cols-2';
    }
  };
  
  return (
    <div className={`grid ${getGridClass()} gap-6`}>
      {children}
    </div>
  );
};
