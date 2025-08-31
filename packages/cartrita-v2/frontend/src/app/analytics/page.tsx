/**
 * Analytics Page - Cartrita V2
 * Comprehensive analytics dashboard with real-time metrics
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UsersIcon,
  ClockIcon,
  BoltIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import { useAnalyticsStore } from '@/stores';

interface MetricCard {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
  color: string;
}

interface ChartData {
  label: string;
  value: number;
  color: string;
}

export default function AnalyticsPage() {
  const { data, metrics, isLoading, timeRange, loadAnalytics, loadUsageMetrics, setTimeRange } = useAnalyticsStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'agents' | 'usage'>('overview');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
    loadUsageMetrics();
  }, [loadAnalytics, loadUsageMetrics]);

  const metricCards: MetricCard[] = [
    {
      title: 'Total Requests',
      value: data?.usage.totalRequests?.toLocaleString() || '0',
      change: '+12.5%',
      trend: 'up',
      icon: ChatBubbleLeftRightIcon,
      color: 'text-blue-600'
    },
    {
      title: 'Active Users',
      value: data?.usage.totalUsers?.toLocaleString() || '0',
      change: '+8.2%',
      trend: 'up',
      icon: UsersIcon,
      color: 'text-green-600'
    },
    {
      title: 'Avg Response Time',
      value: `${data?.usage.averageResponseTime || 0}ms`,
      change: '-5.1%',
      trend: 'up',
      icon: ClockIcon,
      color: 'text-orange-600'
    },
    {
      title: 'Success Rate',
      value: `${((data?.usage.successRate || 0) * 100).toFixed(1)}%`,
      change: '+2.3%',
      trend: 'up',
      icon: CheckCircleIcon,
      color: 'text-emerald-600'
    },
    {
      title: 'CPU Usage',
      value: `${data?.performance.cpuUsage || 0}%`,
      change: '-3.2%',
      trend: 'up',
      icon: CpuChipIcon,
      color: 'text-purple-600'
    },
    {
      title: 'Memory Usage',
      value: `${data?.performance.memoryUsage || 0}%`,
      change: '+1.8%',
      trend: 'up',
      icon: BoltIcon,
      color: 'text-red-600'
    },
    {
      title: 'Active Agents',
      value: Object.keys(data?.agents || {}).length || '0',
      change: '+2',
      trend: 'up',
      icon: UserGroupIcon,
      color: 'text-indigo-600'
    },
    {
      title: 'System Uptime',
      value: `${((data?.performance.uptime || 0) * 100).toFixed(2)}%`,
      change: '+0.1%',
      trend: 'up',
      icon: ArrowTrendingUpIcon,
      color: 'text-cyan-600'
    }
  ];

  const agentPerformance = Object.entries(data?.agents || {}).map(([agentId, stats]: [string, any]) => ({
    id: agentId,
    name: agentId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    requests: stats.requests || 0,
    responseTime: stats.averageResponseTime || 0,
    successRate: (stats.successRate || 0) * 100,
    uptime: (stats.uptime || 0) * 100
  }));

  const chartData: ChartData[] = [
    { label: 'Chat Requests', value: 45, color: 'bg-blue-500' },
    { label: 'Agent Tasks', value: 25, color: 'bg-green-500' },
    { label: 'File Uploads', value: 15, color: 'bg-purple-500' },
    { label: 'API Calls', value: 10, color: 'bg-orange-500' },
    { label: 'Other', value: 5, color: 'bg-gray-500' }
  ];

  const timeRanges = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />;
      case 'down':
        return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300"></div>;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'performance', label: 'Performance', icon: CpuChipIcon },
    { id: 'agents', label: 'Agents', icon: UserGroupIcon },
    { id: 'usage', label: 'Usage', icon: EyeIcon }
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <ChartBarIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Analytics Dashboard
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Comprehensive platform insights and performance metrics
                </p>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  loadAnalytics();
                  loadUsageMetrics();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metricCards.map((metric, index) => (
                <motion.div
                  key={metric.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => setSelectedMetric(selectedMetric === metric.title ? null : metric.title)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${metric.color}`}>
                      <metric.icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-sm font-medium ${
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {metric.title}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metric.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Usage Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Usage Distribution
                </h3>
                <div className="space-y-4">
                  {chartData.map((item, index) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded ${item.color}`}></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.color}`}
                            style={{ width: `${item.value}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-8">
                          {item.value}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  System Health
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Overall Status
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-600">Healthy</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      API Response
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Fast</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Database
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      AI Models
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Agent Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Agent
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Requests
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Avg Response Time
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Success Rate
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Uptime
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((agent, index) => (
                    <tr key={agent.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {agent.name}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {agent.requests.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {agent.responseTime.toFixed(0)}ms
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          agent.successRate >= 95 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : agent.successRate >= 90
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {agent.successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${agent.uptime}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {agent.uptime.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}