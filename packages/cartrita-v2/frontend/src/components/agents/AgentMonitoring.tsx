'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Users,
  MessageSquare,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Eye
} from 'lucide-react';

interface PerformanceMetric {
  timestamp: string;
  responseTime: number;
  successRate: number;
  errorCount: number;
  tokenUsage: number;
}

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  currentLoad: number;
  uptime: string;
  lastActive: string;
  performance: PerformanceMetric[];
  toolUsage: { [tool: string]: number };
  errorTypes: { [type: string]: number };
}

interface AgentMonitoringProps {
  darkMode: boolean;
  agentId?: string;
}

const AgentMonitoring: React.FC<AgentMonitoringProps> = ({ darkMode, agentId }) => {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(agentId || 'all');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'performance' | 'errors' | 'tools'>('overview');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedAgent, timeRange]);

  const fetchMetrics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        timeRange,
        ...(selectedAgent !== 'all' && { agentId: selectedAgent })
      });

      const response = await fetch(`/api/agents/metrics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchMetrics(true);
  };

  const exportMetrics = async () => {
    try {
      const response = await fetch(`/api/agents/metrics/export?timeRange=${timeRange}&agentId=${selectedAgent}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-metrics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export metrics:', error);
    }
  };

  const getOverallMetrics = () => {
    if (metrics.length === 0) {
      return null;
    }
    
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccessful = metrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const totalFailed = metrics.reduce((sum, m) => sum + m.failedRequests, 0);
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length;
    const avgLoad = metrics.reduce((sum, m) => sum + m.currentLoad, 0) / metrics.length;

    return {
      totalRequests,
      successRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
      averageResponseTime: avgResponseTime,
      currentLoad: avgLoad,
      activeAgents: metrics.length,
      errorRate: totalRequests > 0 ? (totalFailed / totalRequests) * 100 : 0
    };
  };

  const overall = getOverallMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`w-8 h-8 border-2 border-t-transparent rounded-full ${
            darkMode ? 'border-purple-400' : 'border-purple-600'
          }`}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Agent Monitoring 📊
              </h1>
              <p className={`${
                darkMode ? 'text-blue-300' : 'text-blue-600'
              }`}>
                Real-time performance tracking and analytics
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            >
              <option value="all">All Agents</option>
              {metrics.map((metric) => (
                <option key={metric.agentId} value={metric.agentId}>
                  {metric.agentName}
                </option>
              ))}
            </select>
            
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className={`px-3 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${
                refreshing ? 'animate-spin' : ''
              }`} />
            </button>
            
            <button
              onClick={exportMetrics}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title="Export Data"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'performance', label: 'Performance', icon: <LineChart className="w-4 h-4" /> },
            { id: 'errors', label: 'Errors', icon: <AlertTriangle className="w-4 h-4" /> },
            { id: 'tools', label: 'Tool Usage', icon: <Zap className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeView === tab.id
                  ? (darkMode 
                      ? 'bg-purple-900/50 text-purple-400' 
                      : 'bg-purple-100 text-purple-600'
                    )
                  : (darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      {overall && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {[
            {
              label: 'Total Requests',
              value: overall.totalRequests.toLocaleString(),
              icon: <MessageSquare className="w-5 h-5" />,
              color: 'from-blue-500 to-blue-600'
            },
            {
              label: 'Success Rate',
              value: `${overall.successRate.toFixed(1)}%`,
              icon: <CheckCircle className="w-5 h-5" />,
              color: 'from-green-500 to-green-600'
            },
            {
              label: 'Error Rate',
              value: `${overall.errorRate.toFixed(1)}%`,
              icon: <AlertTriangle className="w-5 h-5" />,
              color: 'from-red-500 to-red-600'
            },
            {
              label: 'Avg Response',
              value: `${overall.averageResponseTime.toFixed(0)}ms`,
              icon: <Clock className="w-5 h-5" />,
              color: 'from-yellow-500 to-yellow-600'
            },
            {
              label: 'Current Load',
              value: `${overall.currentLoad.toFixed(1)}%`,
              icon: <Activity className="w-5 h-5" />,
              color: 'from-purple-500 to-purple-600'
            },
            {
              label: 'Active Agents',
              value: overall.activeAgents.toString(),
              icon: <Users className="w-5 h-5" />,
              color: 'from-pink-500 to-pink-600'
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm opacity-90">{stat.label}</div>
                </div>
                {stat.icon}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Content Based on Active View */}
      <AnimatePresence mode="wait">
        {activeView === 'overview' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Agent Performance Table */}
            <div className={`rounded-2xl border ${
              darkMode 
                ? 'bg-gray-800/50 border-gray-700' 
                : 'bg-white border-gray-200'
            } overflow-hidden`}>
              <div className="p-6 border-b">
                <h3 className={`text-lg font-semibold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Agent Performance Overview
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${
                    darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Agent
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Requests
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Success Rate
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Avg Response
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Load
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {metrics.map((metric) => {
                      const successRate = metric.totalRequests > 0 
                        ? (metric.successfulRequests / metric.totalRequests) * 100 
                        : 0;
                      
                      return (
                        <tr key={metric.agentId} className={
                          darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                        }>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium`}>
                                {metric.agentName.charAt(0).toUpperCase()}
                              </div>
                              <div className="ml-3">
                                <div className={`text-sm font-medium ${
                                  darkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {metric.agentName}
                                </div>
                                <div className={`text-sm ${
                                  darkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {metric.lastActive}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            darkMode ? 'text-gray-300' : 'text-gray-900'
                          }`}>
                            {metric.totalRequests.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`text-sm font-medium ${
                                successRate >= 95 
                                  ? 'text-green-500' 
                                  : successRate >= 90 
                                    ? 'text-yellow-500' 
                                    : 'text-red-500'
                              }`}>
                                {successRate.toFixed(1)}%
                              </div>
                              <div className="ml-2 w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    successRate >= 95 
                                      ? 'bg-green-500' 
                                      : successRate >= 90 
                                        ? 'bg-yellow-500' 
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${successRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            darkMode ? 'text-gray-300' : 'text-gray-900'
                          }`}>
                            {metric.averageResponseTime.toFixed(0)}ms
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`text-sm font-medium ${
                                metric.currentLoad < 50 
                                  ? 'text-green-500' 
                                  : metric.currentLoad < 80 
                                    ? 'text-yellow-500' 
                                    : 'text-red-500'
                              }`}>
                                {metric.currentLoad.toFixed(1)}%
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              metric.currentLoad < 80
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {metric.currentLoad < 80 ? 'Healthy' : 'High Load'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'performance' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-2xl border ${
              darkMode 
                ? 'bg-gray-800/50 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Performance Charts
              </h3>
              <div className={`h-64 flex items-center justify-center ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <div className="text-center">
                  <LineChart className="w-12 h-12 mx-auto mb-2" />
                  <p>Performance charts would be rendered here with a charting library</p>
                  <p className="text-sm">Response time, throughput, and error rate over time</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'errors' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-2xl border ${
              darkMode 
                ? 'bg-gray-800/50 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Error Analysis
              </h3>
              <div className={`h-64 flex items-center justify-center ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                  <p>Error breakdown and analysis would be displayed here</p>
                  <p className="text-sm">Error types, frequency, and resolution status</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'tools' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-2xl border ${
              darkMode 
                ? 'bg-gray-800/50 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Tool Usage Statistics
              </h3>
              <div className={`h-64 flex items-center justify-center ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2" />
                  <p>Tool usage analytics would be visualized here</p>
                  <p className="text-sm">Most used tools, success rates, and performance metrics</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentMonitoring;