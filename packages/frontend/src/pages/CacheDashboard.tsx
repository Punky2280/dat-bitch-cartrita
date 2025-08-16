/**
 * @fileoverview Advanced Cache Dashboard - Real-time cache monitoring and management
 * Frontend component for Task 22 Advanced Caching System with real API integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CloudIcon,
  Cog6ToothIcon,
  FireIcon,
  BoltIcon,
  EyeIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

// Types and Interfaces
interface CacheMetrics {
  timestamp: string;
  hit_rate_l1: number;
  hit_rate_l2: number;
  hit_rate_l3: number;
  hit_rate_overall: number;
  latency_l1_avg: number;
  latency_l2_avg: number;
  latency_l3_avg: number;
  latency_overall_avg: number;
  operations_total: number;
  hits_l1: number;
  hits_l2: number;
  hits_l3: number;
  misses_l1: number;
  misses_l2: number;
  misses_l3: number;
  memory_used_bytes: number;
  memory_used_percentage: number;
  cache_strategy: string;
  errors_total: number;
}

interface CachePattern {
  id: number;
  pattern_type: string;
  pattern_name: string;
  confidence_score: number;
  impact_level: string;
  frequency_count: number;
  trend: string;
  status: string;
  detected_at: string;
}

interface CacheRecommendation {
  id: number;
  recommendation_type: string;
  title: string;
  description: string;
  confidence_score: number;
  impact_level: string;
  priority_score: number;
  implementation_effort: string;
  status: string;
  created_at: string;
}

interface CacheAlert {
  id: number;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  status: string;
  created_at: string;
}

interface CacheWarmingJob {
  id: string;
  job_name: string;
  job_type: string;
  warming_strategy: string;
  status: string;
  total_keys_warmed: number;
  successful_warmups: number;
  failed_warmups: number;
  execution_time_ms: number;
  next_run_at?: string;
  last_run_at?: string;
}

interface CacheKeyStats {
  cache_key: string;
  total_accesses: number;
  hit_rate: number;
  avg_latency_ms: number;
  efficiency_score: number;
  key_category?: string;
  last_access_at: string;
}

interface CacheDashboardProps {
  token: string;
  onBack?: () => void;
  className?: string;
}

// Real-time chart components
const RealtimeLineChart: React.FC<{
  data: Array<{ timestamp: string; value: number }>;
  color: string;
  height?: number;
  width?: number;
  label: string;
}> = ({ data, color, height = 120, width = 400, label }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-30 text-slate-500 text-sm">
        No data available
      </div>
    );
  }

  const validData = data.filter(d => typeof d.value === 'number' && isFinite(d.value));
  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-30 text-slate-500 text-sm">
        Invalid data
      </div>
    );
  }

  const values = validData.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = validData
    .map((d, i) => {
      const x = validData.length > 1 ? (i / (validData.length - 1)) * (width - 20) + 10 : width / 2;
      const y = height - 10 - ((d.value - min) / range) * (height - 20);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">{label}</div>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Data line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
        />
        
        {/* Data points */}
        {validData.map((d, i) => {
          const x = validData.length > 1 ? (i / (validData.length - 1)) * (width - 20) + 10 : width / 2;
          const y = height - 10 - ((d.value - min) / range) * (height - 20);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              className="hover:r-4 transition-all"
            />
          );
        })}
        
        {/* Value labels */}
        <text x="10" y="15" className="text-xs fill-slate-400">
          {max.toFixed(1)}
        </text>
        <text x="10" y={height - 5} className="text-xs fill-slate-400">
          {min.toFixed(1)}
        </text>
      </svg>
    </div>
  );
};

const HitRateGauge: React.FC<{ value: number; level: string; size?: number }> = ({ 
  value, 
  level, 
  size = 120 
}) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const getColor = (rate: number) => {
    if (rate >= 90) return '#10b981'; // green
    if (rate >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#374151"
          strokeWidth="8"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(value)}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold text-white">{value.toFixed(1)}%</div>
        <div className="text-xs text-slate-400">{level}</div>
      </div>
    </div>
  );
};

const CachePatternCard: React.FC<{ pattern: CachePattern; onAction?: (action: string) => void }> = ({ 
  pattern, 
  onAction 
}) => {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  return (
    <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-semibold text-white truncate">{pattern.pattern_name}</h4>
        <div className="flex items-center space-x-2">
          <span className="text-xs">{getTrendIcon(pattern.trend)}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${getImpactColor(pattern.impact_level)}`}>
            {pattern.impact_level}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 text-xs text-slate-300">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="text-blue-400">{pattern.pattern_type}</span>
        </div>
        <div className="flex justify-between">
          <span>Confidence:</span>
          <span className="text-green-400">{(pattern.confidence_score * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Frequency:</span>
          <span className="text-purple-400">{pattern.frequency_count}</span>
        </div>
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <span className="text-xs text-slate-400">
          {new Date(pattern.detected_at).toLocaleDateString()}
        </span>
        {onAction && (
          <div className="flex space-x-1">
            <button
              onClick={() => onAction('view')}
              className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-1 rounded transition-colors"
            >
              View
            </button>
            <button
              onClick={() => onAction('dismiss')}
              className="text-xs bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 px-2 py-1 rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ 
  recommendation: CacheRecommendation; 
  onAction?: (action: string) => void;
}> = ({ recommendation, onAction }) => {
  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'text-red-400 bg-red-500/20';
    if (priority >= 60) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-green-400 bg-green-500/20';
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="glass-card p-4 rounded-lg border-l-4 border-purple-500">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-semibold text-white">{recommendation.title}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(recommendation.priority_score)}`}>
          P{recommendation.priority_score}
        </span>
      </div>
      
      <p className="text-xs text-slate-300 mb-3 line-clamp-2">
        {recommendation.description}
      </p>
      
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-slate-400">Confidence:</span>
          <span className="text-blue-400">{(recommendation.confidence_score * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Effort:</span>
          <span className={getEffortColor(recommendation.implementation_effort)}>
            {recommendation.implementation_effort}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Impact:</span>
          <span className="text-green-400">{recommendation.impact_level}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Type:</span>
          <span className="text-purple-400">{recommendation.recommendation_type}</span>
        </div>
      </div>
      
      {onAction && (
        <div className="flex space-x-2">
          <button
            onClick={() => onAction('implement')}
            className="flex-1 text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-3 py-2 rounded transition-colors"
          >
            Implement
          </button>
          <button
            onClick={() => onAction('dismiss')}
            className="text-xs bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 px-3 py-2 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

const CacheKeyTable: React.FC<{ 
  keys: CacheKeyStats[]; 
  onAction?: (key: string, action: string) => void;
}> = ({ keys, onAction }) => {
  if (!keys || keys.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-2">🔍</div>
        <div>No cache keys found</div>
      </div>
    );
  }

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-3">Key</th>
            <th className="text-right py-2 px-3">Accesses</th>
            <th className="text-right py-2 px-3">Hit Rate</th>
            <th className="text-right py-2 px-3">Latency</th>
            <th className="text-right py-2 px-3">Efficiency</th>
            <th className="text-center py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, index) => (
            <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/30">
              <td className="py-2 px-3 font-mono text-blue-400 truncate max-w-xs">
                {key.cache_key}
              </td>
              <td className="text-right py-2 px-3 text-white">
                {key.total_accesses.toLocaleString()}
              </td>
              <td className="text-right py-2 px-3 text-green-400">
                {key.hit_rate.toFixed(1)}%
              </td>
              <td className="text-right py-2 px-3 text-yellow-400">
                {key.avg_latency_ms.toFixed(1)}ms
              </td>
              <td className={`text-right py-2 px-3 font-semibold ${getEfficiencyColor(key.efficiency_score)}`}>
                {key.efficiency_score.toFixed(1)}
              </td>
              <td className="text-center py-2 px-3">
                {onAction && (
                  <div className="flex justify-center space-x-1">
                    <button
                      onClick={() => onAction(key.cache_key, 'invalidate')}
                      className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                      title="Invalidate"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onAction(key.cache_key, 'warm')}
                      className="p-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition-colors"
                      title="Warm"
                    >
                      <FireIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Cache Dashboard Component
export const CacheDashboard: React.FC<CacheDashboardProps> = ({
  token,
  onBack,
  className = ''
}) => {
  // Real state management (no mocks)
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [patterns, setPatterns] = useState<CachePattern[]>([]);
  const [recommendations, setRecommendations] = useState<CacheRecommendation[]>([]);
  const [alerts, setAlerts] = useState<CacheAlert[]>([]);
  const [warmingJobs, setWarmingJobs] = useState<CacheWarmingJob[]>([]);
  const [hotKeys, setHotKeys] = useState<CacheKeyStats[]>([]);
  
  // Real-time data
  const [metricsHistory, setMetricsHistory] = useState<Array<{ timestamp: string; value: number }>>([]);
  const [hitRateHistory, setHitRateHistory] = useState<Array<{ timestamp: string; value: number }>>([]);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ timestamp: string; value: number }>>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'recommendations' | 'config'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Real API endpoints based on actual cache management API
  const API_BASE = '/api/cache';

  // Fetch real cache metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success && data.data) {
        const metric = data.data;
        setMetrics(metric);
        
        // Update history arrays for charts
        const timestamp = new Date().toISOString();
        setHitRateHistory(prev => [
          ...prev.slice(-29), // Keep last 30 points
          { timestamp, value: metric.hit_rate_overall }
        ]);
        setLatencyHistory(prev => [
          ...prev.slice(-29),
          { timestamp, value: metric.latency_overall_avg }
        ]);
        setMetricsHistory(prev => [
          ...prev.slice(-29),
          { timestamp, value: metric.memory_used_percentage }
        ]);
        
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch cache metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    }
  }, [token]);

  // Fetch cache patterns
  const fetchPatterns = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/patterns`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setPatterns(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
    }
  }, [token]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/recommendations`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setRecommendations(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  }, [token]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/alerts`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAlerts(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, [token]);

  // Fetch warming jobs
  const fetchWarmingJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/warming/status`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setWarmingJobs(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch warming jobs:', err);
    }
  }, [token]);

  // Fetch hot keys
  const fetchHotKeys = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stats/detailed?top_keys=10`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.hot_keys) {
          setHotKeys(data.data.hot_keys);
        }
      }
    } catch (err) {
      console.error('Failed to fetch hot keys:', err);
    }
  }, [token]);

  // Initial data load
  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      fetchMetrics(),
      fetchPatterns(),
      fetchRecommendations(),
      fetchAlerts(),
      fetchWarmingJobs(),
      fetchHotKeys()
    ]);
    setLoading(false);
    setLastUpdate(new Date());
  }, [fetchMetrics, fetchPatterns, fetchRecommendations, fetchAlerts, fetchWarmingJobs, fetchHotKeys]);

  // Setup real-time updates with Server-Sent Events
  useEffect(() => {
    if (autoRefresh && token) {
      // Real-time SSE connection
      eventSourceRef.current = new EventSource(`${API_BASE}/stream?token=${token}`);
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'metrics') {
            setMetrics(data.data);
            
            // Update charts
            const timestamp = new Date().toISOString();
            setHitRateHistory(prev => [
              ...prev.slice(-29),
              { timestamp, value: data.data.hit_rate_overall }
            ]);
            setLatencyHistory(prev => [
              ...prev.slice(-29),
              { timestamp, value: data.data.latency_overall_avg }
            ]);
          } else if (data.type === 'alert') {
            setAlerts(prev => [data.data, ...prev].slice(0, 50));
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      eventSourceRef.current.onerror = () => {
        console.log('SSE connection error, falling back to polling');
        // Fallback to polling
        intervalRef.current = setInterval(fetchMetrics, 5000);
      };
    } else if (autoRefresh) {
      // Fallback polling for metrics
      intervalRef.current = setInterval(fetchMetrics, 5000);
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, token, fetchMetrics]);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Action handlers (real API calls)
  const handleKeyAction = async (key: string, action: string) => {
    try {
      let response;
      switch (action) {
        case 'invalidate':
          response = await fetch(`${API_BASE}/invalidation/key`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
          });
          break;
        case 'warm':
          response = await fetch(`${API_BASE}/warming/trigger`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keys: [key] })
          });
          break;
        default:
          return;
      }
      
      if (response.ok) {
        // Refresh data after action
        await fetchMetrics();
        await fetchHotKeys();
      }
    } catch (err) {
      console.error(`Failed to ${action} key:`, err);
    }
  };

  const handlePatternAction = async (action: string) => {
    // Implement pattern actions
    console.log('Pattern action:', action);
  };

  const handleRecommendationAction = async (action: string) => {
    // Implement recommendation actions
    console.log('Recommendation action:', action);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div>Loading Cache Dashboard...</div>
        </div>
      </div>
    );
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
      case 'error': return <XCircleIcon className="w-4 h-4 text-red-400" />;
      case 'warning': return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />;
      default: return <CheckCircleIcon className="w-4 h-4 text-blue-400" />;
    }
  };

  const overallHealth = metrics ? Math.round(
    (metrics.hit_rate_overall * 0.4) + 
    ((100 - metrics.latency_overall_avg) * 0.3) + 
    ((100 - metrics.memory_used_percentage) * 0.3)
  ) : 0;

  return (
    <div className={`min-h-screen bg-animated text-white ${className}`}>
      {/* Header */}
      <header className="glass-card border-b border-slate-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Advanced Cache Dashboard</h1>
            <p className="text-slate-400 mt-1">Real-time cache monitoring and management</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} ${!error ? 'animate-pulse' : ''}`}></div>
              <span className={error ? 'text-red-400' : 'text-green-400'}>
                {error ? 'Error' : 'Live'}
              </span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                autoRefresh ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
              }`}
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Auto-refresh</span>
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="bg-purple-600/80 hover:bg-purple-600 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>←</span>
                <span>Back</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <div>
              <div className="font-semibold text-red-400">Connection Error</div>
              <div className="text-red-300 text-sm">{error}</div>
            </div>
            <button
              onClick={loadAllData}
              className="ml-auto bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'patterns', label: 'Patterns', icon: EyeIcon },
            { id: 'recommendations', label: 'Recommendations', icon: BoltIcon },
            { id: 'config', label: 'Configuration', icon: Cog6ToothIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-400">Overall Hit Rate</div>
                  <ChartBarIcon className="w-5 h-5 text-blue-400" />
                </div>
                {metrics && <HitRateGauge value={metrics.hit_rate_overall} level="Overall" />}
              </div>

              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-400">Average Latency</div>
                  <ClockIcon className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {metrics?.latency_overall_avg?.toFixed(1) || '0.0'}ms
                  </div>
                  <div className="text-xs text-slate-400">Response Time</div>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-400">Memory Usage</div>
                  <CpuChipIcon className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {metrics?.memory_used_percentage?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="text-xs text-slate-400">
                    {metrics ? (metrics.memory_used_bytes / 1024 / 1024).toFixed(1) : '0'} MB
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-400">Health Score</div>
                  <CheckCircleIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{overallHealth}/100</div>
                  <div className="text-xs text-slate-400">Overall Health</div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-xl">
                <RealtimeLineChart
                  data={hitRateHistory}
                  color="#60a5fa"
                  label="Hit Rate Over Time (%)"
                />
              </div>

              <div className="glass-card p-6 rounded-xl">
                <RealtimeLineChart
                  data={latencyHistory}
                  color="#f59e0b"
                  label="Average Latency (ms)"
                />
              </div>

              <div className="glass-card p-6 rounded-xl">
                <RealtimeLineChart
                  data={metricsHistory}
                  color="#10b981"
                  label="Memory Usage (%)"
                />
              </div>
            </div>

            {/* Level-specific metrics */}
            {metrics && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">L1 Cache (Memory)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hit Rate:</span>
                      <span className="text-blue-400 font-semibold">{metrics.hit_rate_l1?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Latency:</span>
                      <span className="text-yellow-400">{metrics.latency_l1_avg?.toFixed(2)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hits:</span>
                      <span className="text-green-400">{metrics.hits_l1?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Misses:</span>
                      <span className="text-red-400">{metrics.misses_l1?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-4 text-green-400">L2 Cache (Redis)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hit Rate:</span>
                      <span className="text-blue-400 font-semibold">{metrics.hit_rate_l2?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Latency:</span>
                      <span className="text-yellow-400">{metrics.latency_l2_avg?.toFixed(2)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hits:</span>
                      <span className="text-green-400">{metrics.hits_l2?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Misses:</span>
                      <span className="text-red-400">{metrics.misses_l2?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-4 text-purple-400">L3 Cache (Database)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hit Rate:</span>
                      <span className="text-blue-400 font-semibold">{metrics.hit_rate_l3?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Latency:</span>
                      <span className="text-yellow-400">{metrics.latency_l3_avg?.toFixed(2)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hits:</span>
                      <span className="text-green-400">{metrics.hits_l3?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Misses:</span>
                      <span className="text-red-400">{metrics.misses_l3?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts Section */}
            {alerts.length > 0 && (
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                  <span>Active Alerts</span>
                </h3>
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-lg">
                      {getAlertIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="font-semibold text-white">{alert.title}</div>
                        <div className="text-sm text-slate-300">{alert.message}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        alert.severity === 'error' ? 'bg-red-500/20 text-red-400' :
                        alert.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hot Keys Table */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <FireIcon className="w-5 h-5 text-orange-400" />
                <span>Hot Cache Keys</span>
              </h3>
              <CacheKeyTable keys={hotKeys} onAction={handleKeyAction} />
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Detected Patterns</h2>
              <button
                onClick={fetchPatterns}
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>

            {patterns.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <EyeIcon className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <div>No patterns detected yet</div>
                <div className="text-sm">Patterns will appear as cache usage data is analyzed</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {patterns.map((pattern) => (
                  <CachePatternCard
                    key={pattern.id}
                    pattern={pattern}
                    onAction={handlePatternAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Optimization Recommendations</h2>
              <button
                onClick={fetchRecommendations}
                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <BoltIcon className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <div>No recommendations available</div>
                <div className="text-sm">Recommendations will appear as performance patterns are analyzed</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onAction={handleRecommendationAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Cache Configuration</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Configuration */}
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Current Settings</h3>
                {metrics && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Active Strategy:</span>
                      <span className="text-blue-400">{metrics.cache_strategy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Operations:</span>
                      <span className="text-white">{metrics.operations_total?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Error Rate:</span>
                      <span className={`${metrics.errors_total > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {((metrics.errors_total / metrics.operations_total) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Memory Limit:</span>
                      <span className="text-yellow-400">
                        {(metrics.memory_used_bytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Warming Jobs */}
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <FireIcon className="w-5 h-5 text-orange-400" />
                  <span>Warming Jobs</span>
                </h3>
                
                {warmingJobs.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    No active warming jobs
                  </div>
                ) : (
                  <div className="space-y-3">
                    {warmingJobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-white text-sm">{job.job_name}</div>
                            <div className="text-xs text-slate-400">{job.job_type} • {job.warming_strategy}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-slate-400">Warmed:</span>
                            <span className="text-green-400 ml-1">{job.successful_warmups}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Failed:</span>
                            <span className="text-red-400 ml-1">{job.failed_warmups}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Time:</span>
                            <span className="text-blue-400 ml-1">{job.execution_time_ms}ms</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last Updated Footer */}
        <div className="text-center text-xs text-slate-400 mt-8">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </main>
    </div>
  );
};

export default CacheDashboard;
