import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CloudIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface RoutingStats {
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  fallbacksUsed: number;
  successRate: number;
  ragCacheStats: {
    size: number;
    entries: string[];
  };
  availableModels: number;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  message: string;
  agents: Record<string, {
    status: 'healthy' | 'unhealthy';
    message: string;
  }>;
  routing_service: {
    status: 'healthy' | 'unhealthy';
    test_successful?: boolean;
    model_used?: string;
    confidence?: number;
    error?: string;
  };
  rag_service: {
    status: 'healthy' | 'unhealthy';
    cache_size: number;
  };
  performance: RoutingStats;
  enhanced_features: {
    rag_pipeline: boolean;
    advanced_routing: boolean;
    safety_filtering: boolean;
    cost_controls: boolean;
    model_fallbacks: boolean;
  };
}

interface RouteConstraints {
  budget_tier: 'economy' | 'standard' | 'premium';
  max_cost_per_1k_tokens: number;
  min_confidence_threshold: number;
  require_safety_filter: boolean;
  context_length_needed: number;
  multilingual: boolean;
  enable_fallback: boolean;
  max_candidates: number;
  temperature: number;
  max_new_tokens: number;
}

interface HuggingFaceRoutingDashboardProps {
  token: string;
  className?: string;
}

export const HuggingFaceRoutingDashboard: React.FC<HuggingFaceRoutingDashboardProps> = ({
  token,
  className = ''
}) => {
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Test routing form
  const [testPrompt, setTestPrompt] = useState('');
  const [constraints, setConstraints] = useState<RouteConstraints>({
    budget_tier: 'standard',
    max_cost_per_1k_tokens: 0.01,
    min_confidence_threshold: 0.3,
    require_safety_filter: false,
    context_length_needed: 2048,
    multilingual: false,
    enable_fallback: true,
    max_candidates: 5,
    temperature: 0.7,
    max_new_tokens: 512
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const fetchData = async () => {
    try {
      setError('');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const [statsResponse, healthResponse] = await Promise.all([
        fetch('/api/huggingface/stats', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).catch(err => ({ ok: false, status: 0, _err: err } as any)),
        fetch('/api/huggingface/health', { signal: controller.signal }).catch(err => ({ ok: false, status: 0, _err: err } as any))
      ]);
      
      clearTimeout(timeout);
      
      if (!statsResponse.ok) {
        if (statsResponse.status === 404 || statsResponse.status === 503) {
          // Graceful degraded mode – keep previous stats, set lightweight error but do not throw
          setError(prev => prev || `Routing stats unavailable (${statsResponse.status})`);
        } else {
          setError(prev => prev || 'Failed to fetch routing statistics');
        }
        
        // Set mock data when backend is unavailable
        if (!stats) {
          setStats({
            totalRequests: 0,
            successfulRequests: 0,
            averageLatency: 0,
            fallbacksUsed: 0,
            successRate: 0,
            ragCacheStats: { size: 0, entries: [] },
            availableModels: 0
          });
        }
      } else {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
      
      if (!healthResponse.ok) {
        if (healthResponse.status === 503) {
          setError(prev => prev || 'Health check: orchestrator initializing');
        } else if (healthResponse.status !== 0) {
          setError(prev => prev || 'Failed to fetch health status');
        }
        
        // Set mock health data when backend is unavailable
        if (!health) {
          setHealth({
            status: 'unhealthy',
            message: 'Backend unavailable',
            agents: {},
            routing_service: { status: 'unhealthy', error: 'Service unavailable' },
            rag_service: { status: 'unhealthy', cache_size: 0 },
            performance: {
              totalRequests: 0,
              successfulRequests: 0,
              averageLatency: 0,
              fallbacksUsed: 0,
              successRate: 0,
              ragCacheStats: { size: 0, entries: [] },
              availableModels: 0
            },
            enhanced_features: {
              rag_pipeline: false,
              advanced_routing: false,
              safety_filtering: false,
              cost_controls: false
            }
          });
        }
      } else {
        const healthData = await healthResponse.json();
        setHealth(healthData.health);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? (err.name === 'AbortError' ? 'Dashboard request timed out' : err.message) : 'Failed to fetch data');
      
      // Set mock data on error to prevent infinite loading
      if (!stats) {
        setStats({
          totalRequests: 0,
          successfulRequests: 0,
          averageLatency: 0,
          fallbacksUsed: 0,
          successRate: 0,
          ragCacheStats: { size: 0, entries: [] },
          availableModels: 0
        });
      }
      if (!health) {
        setHealth({
          status: 'unhealthy',
          message: 'Backend unavailable',
          agents: {},
          routing_service: { status: 'unhealthy', error: 'Service unavailable' },
          rag_service: { status: 'unhealthy', cache_size: 0 },
          performance: {
            totalRequests: 0,
            successfulRequests: 0,
            averageLatency: 0,
            fallbacksUsed: 0,
            successRate: 0,
            ragCacheStats: { size: 0, entries: [] },
            availableModels: 0
          },
          enhanced_features: {
            rag_pipeline: false,
            advanced_routing: false,
            safety_filtering: false,
            cost_controls: false
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const testRouting = async () => {
    if (!testPrompt.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/huggingface/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskType: 'text-generation',
          text: testPrompt,
          options: constraints
        })
      });

      if (!response.ok) {
        throw new Error(`Routing test failed: ${response.statusText}`);
      }

      const result = await response.json();
      setTestResult(result);
      
      // Refresh stats after test
      fetchData();
    } catch (err) {
      console.error('Routing test error:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Test failed'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const clearCaches = async () => {
    try {
      const response = await fetch('/api/huggingface/clear-caches', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to clear caches:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      let interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading && !stats && !health) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: 'healthy' | 'unhealthy') => {
    return status === 'healthy' ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusColor = (status: 'healthy' | 'unhealthy') => {
    return status === 'healthy' 
      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              HuggingFace Routing Dashboard
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="h-4 w-4" />
              <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-refresh</span>
            </label>
            <button
              onClick={fetchData}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* System Health */}
        {health && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              System Health
            </h3>
            
            {/* Overall Status */}
            <div className={`p-4 rounded-lg border ${getStatusColor(health.status)} mb-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(health.status)}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Overall Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {health.message}
                    </p>
                  </div>
                </div>
                
                {/* Feature Status */}
                <div className="flex items-center space-x-4 text-sm">
                  {health.enhanced_features && typeof health.enhanced_features === 'object' ? Object.entries(health.enhanced_features).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center space-x-1">
                      {enabled ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )) : (
                    <span className="text-xs text-gray-500">No feature data</span>
                  )}
                </div>
              </div>
            </div>

            {/* Component Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Routing Service */}
              <div className={`p-4 rounded-lg border ${getStatusColor(health.routing_service.status)}`}>
                <div className="flex items-center space-x-2 mb-2">
                  {getStatusIcon(health.routing_service.status)}
                  <h4 className="font-medium text-gray-900 dark:text-white">Routing Service</h4>
                </div>
                {health.routing_service.test_successful && (
                  <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                    <p>Model: {health.routing_service.model_used}</p>
                    <p>Confidence: {health.routing_service.confidence?.toFixed(3)}</p>
                  </div>
                )}
                {health.routing_service.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {health.routing_service.error}
                  </p>
                )}
              </div>

              {/* RAG Service */}
              <div className={`p-4 rounded-lg border ${getStatusColor(health.rag_service.status)}`}>
                <div className="flex items-center space-x-2 mb-2">
                  {getStatusIcon(health.rag_service.status)}
                  <h4 className="font-medium text-gray-900 dark:text-white">RAG Service</h4>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Cache Size: {health.rag_service.cache_size} items
                </p>
              </div>

              {/* Agent Status */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Agents</h4>
                <div className="space-y-1">
                  {health.agents && typeof health.agents === 'object' ? Object.entries(health.agents).map(([agent, status]) => (
                    <div key={agent} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{agent}</span>
                      {getStatusIcon(status.status)}
                    </div>
                  )) : <p className="text-xs text-gray-500">No agents</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Stats */}
        {stats && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Performance Statistics
              </h3>
              <button
                onClick={clearCaches}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Clear Caches
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ChartBarIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Total Requests
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.totalRequests != null ? stats.totalRequests.toLocaleString() : '—'}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Success Rate
                  </span>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.successRate != null ? (stats.successRate * 100).toFixed(1) + '%' : '—'}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ClockIcon className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Avg Latency
                  </span>
                </div>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {stats.averageLatency != null ? Math.round(stats.averageLatency) + 'ms' : '—'}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    Fallbacks Used
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.fallbacksUsed}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Available Models
                </h4>
                <div className="flex items-center space-x-2">
                  <CpuChipIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stats.availableModels} models
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  RAG Cache
                </h4>
                <div className="flex items-center space-x-2">
                  <CloudIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stats.ragCacheStats.size} cached items
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Routing Test */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Test Routing
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Prompt
              </label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to test the routing system..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick constraint controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Budget Tier
                </label>
                <select
                  value={constraints.budget_tier}
                  onChange={(e) => setConstraints(prev => ({ ...prev, budget_tier: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="economy">Economy</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Confidence
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={constraints.min_confidence_threshold}
                  onChange={(e) => setConstraints(prev => ({ ...prev, min_confidence_threshold: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={constraints.require_safety_filter}
                    onChange={(e) => setConstraints(prev => ({ ...prev, require_safety_filter: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Safety Filter</span>
                </label>
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={constraints.multilingual}
                    onChange={(e) => setConstraints(prev => ({ ...prev, multilingual: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Multilingual</span>
                </label>
              </div>
            </div>

            <button
              onClick={testRouting}
              disabled={testLoading || !testPrompt.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {testLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4" />
                  <span>Test Routing</span>
                </>
              )}
            </button>

            {testResult && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Test Result</h4>
                <pre className="text-sm text-gray-600 dark:text-gray-400 overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};