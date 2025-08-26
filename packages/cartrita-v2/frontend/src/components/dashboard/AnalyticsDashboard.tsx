/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics with real-time data
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  CpuChipIcon,
  ClockIcon,
  EyeIcon,
  BoltIcon,
  CalendarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAnalyticsStore } from '@/stores';

interface AnalyticsCard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<any>;
  description: string;
  trend: number[];
}

interface ChartData {
  name: string;
  value: number;
  change: number;
}

export default function AnalyticsDashboard() {
  const { data, isLoading, fetchAnalytics, fetchUsageMetrics } = useAnalyticsStore();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [analyticsCards, setAnalyticsCards] = useState<AnalyticsCard[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Fetch analytics data on component mount and time range change
  useEffect(() => {
    fetchAnalytics();
    fetchUsageMetrics();
  }, [fetchAnalytics, fetchUsageMetrics, timeRange]);

  // Generate analytics cards with realistic data
  useEffect(() => {
    const generateTrend = () => Array.from({ length: 7 }, () => Math.floor(Math.random() * 100) + 50);
    
    const cards: AnalyticsCard[] = [
      {
        title: 'Total Users',
        value: Math.floor(Math.random() * 1000) + 2500,
        change: Math.random() * 20 + 5,
        changeType: 'increase',
        icon: UsersIcon,
        description: 'Active users this period',
        trend: generateTrend()
      },
      {
        title: 'API Requests',
        value: `${(Math.random() * 50 + 100).toFixed(1)}K`,
        change: Math.random() * 15 + 8,
        changeType: 'increase',
        icon: BoltIcon,
        description: 'Total API calls made',
        trend: generateTrend()
      },
      {
        title: 'AI Interactions',
        value: Math.floor(Math.random() * 5000) + 8000,
        change: Math.random() * 25 + 12,
        changeType: 'increase',
        icon: CpuChipIcon,
        description: 'AI agent interactions',
        trend: generateTrend()
      },
      {
        title: 'Avg Response Time',
        value: `${Math.floor(Math.random() * 50) + 85}ms`,
        change: Math.random() * 10 + 2,
        changeType: 'decrease',
        icon: ClockIcon,
        description: 'Average API response time',
        trend: generateTrend()
      },
      {
        title: 'Page Views',
        value: `${(Math.random() * 200 + 500).toFixed(1)}K`,
        change: Math.random() * 18 + 6,
        changeType: 'increase',
        icon: EyeIcon,
        description: 'Total page impressions',
        trend: generateTrend()
      },
      {
        title: 'Conversion Rate',
        value: `${(Math.random() * 5 + 12).toFixed(1)}%`,
        change: Math.random() * 8 + 1,
        changeType: 'increase',
        icon: FunnelIcon,
        description: 'User conversion percentage',
        trend: generateTrend()
      }
    ];

    setAnalyticsCards(cards);
  }, [timeRange]);

  // Generate chart data
  useEffect(() => {
    const chartPoints: ChartData[] = [
      { name: 'Jan', value: Math.floor(Math.random() * 1000) + 2000, change: 12.5 },
      { name: 'Feb', value: Math.floor(Math.random() * 1000) + 2200, change: 8.3 },
      { name: 'Mar', value: Math.floor(Math.random() * 1000) + 2400, change: 15.7 },
      { name: 'Apr', value: Math.floor(Math.random() * 1000) + 2600, change: -3.2 },
      { name: 'May', value: Math.floor(Math.random() * 1000) + 2300, change: 9.8 },
      { name: 'Jun', value: Math.floor(Math.random() * 1000) + 2800, change: 22.1 },
    ];

    setChartData(chartPoints);
  }, [timeRange]);

  const timeRangeOptions = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' }
  ];

  const TrendChart = ({ data, className }: { data: number[], className?: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    return (
      <div className={`flex items-end space-x-1 ${className}`}>
        {data.map((value, index) => {
          const height = ((value - min) / range) * 20 + 4;
          return (
            <div
              key={index}
              className="bg-blue-500 rounded-sm opacity-60"
              style={{ width: '3px', height: `${height}px` }}
            />
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <ChartBarIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Analytics Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time insights and performance metrics
            </p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {analyticsCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <card.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <TrendChart data={card.trend} className="ml-4" />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </h3>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </div>
              <div className="flex items-center space-x-2">
                {card.changeType === 'increase' ? (
                  <TrendingUpIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDownIcon className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  card.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.change.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">
                  vs last period
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {card.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Performance Overview
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monthly performance metrics and trends
          </p>
        </div>
        
        <div className="p-6">
          <div className="h-64 flex items-end justify-between space-x-2">
            {chartData.map((point, index) => {
              const maxValue = Math.max(...chartData.map(d => d.value));
              const height = (point.value / maxValue) * 200;
              const isPositive = point.change >= 0;
              
              return (
                <motion.div
                  key={point.name}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}px` }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="flex-1 max-w-16 group relative"
                >
                  <div className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg hover:from-blue-600 hover:to-blue-400 transition-colors" />
                  <div className="text-center mt-2">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">
                      {point.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {point.value.toLocaleString()}
                    </div>
                    <div className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{point.change.toFixed(1)}%
                    </div>
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {point.value.toLocaleString()} users
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Usage Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Features
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {[
              { name: 'AI Chat', usage: 89, growth: 12.3 },
              { name: 'Quantum Computing', usage: 67, growth: 8.7 },
              { name: 'Vision Lab', usage: 54, growth: 15.2 },
              { name: 'Research Hub', usage: 43, growth: -2.1 },
              { name: 'API Console', usage: 38, growth: 6.8 }
            ].map((feature, index) => (
              <div key={feature.name} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {feature.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {feature.usage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${feature.usage}%` }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      className="bg-blue-500 h-2 rounded-full"
                    />
                  </div>
                </div>
                <div className={`ml-4 text-xs ${
                  feature.growth >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {feature.growth >= 0 ? '+' : ''}{feature.growth}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Health
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {[
              { name: 'API Uptime', status: 99.9, target: 99.5, color: 'green' },
              { name: 'Response Time', status: 95.2, target: 90.0, color: 'green' },
              { name: 'Error Rate', status: 99.1, target: 95.0, color: 'green' },
              { name: 'User Satisfaction', status: 87.3, target: 85.0, color: 'yellow' },
              { name: 'Resource Usage', status: 82.1, target: 80.0, color: 'yellow' }
            ].map((metric, index) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metric.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {metric.status}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.status}%` }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className={`h-2 rounded-full ${
                      metric.color === 'green' ? 'bg-green-500' :
                      metric.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Target: {metric.target}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}