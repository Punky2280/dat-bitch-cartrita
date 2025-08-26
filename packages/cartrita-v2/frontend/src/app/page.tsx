/**
 * Advanced Dashboard - Cartrita V2
 * Comprehensive system overview with real-time metrics and controls
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CpuChipIcon,
  UserGroupIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  EyeIcon,
  CommandLineIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import SystemOverview from '@/components/dashboard/SystemOverview';

interface MetricCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  tasks: number;
  performance: number;
  icon: string;
  specialization: string;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  action?: string;
}

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [systemLoad, setSystemLoad] = useState(67);
  const [activeConnections, setActiveConnections] = useState(342);

  useEffect(() => {
    setMounted(true);
    // Initialize time on client to avoid SSR hydration mismatch
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setSystemLoad(prev => prev + (Math.random() - 0.5) * 5);
      setActiveConnections(prev => Math.max(0, prev + Math.floor((Math.random() - 0.5) * 20)));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const metrics: MetricCard[] = [
    {
      title: 'Total Conversations',
      value: '12,847',
      change: '+12.5%',
      changeType: 'positive',
      icon: ChartBarIcon,
      color: 'bg-blue-500',
      description: 'Messages processed today'
    },
    {
      title: 'Active AI Agents',
      value: '15',
      change: 'All Online',
      changeType: 'positive',
      icon: UserGroupIcon,
      color: 'bg-green-500',
      description: 'Specialized AI agents running'
    },
    {
      title: 'Quantum Operations',
      value: '2,431',
      change: '+34.2%',
      changeType: 'positive',
      icon: CpuChipIcon,
      color: 'bg-purple-500',
      description: 'Quantum-enhanced computations'
    },
    {
      title: 'System Performance',
      value: '98.7%',
      change: '+0.3%',
      changeType: 'positive',
      icon: BoltIcon,
      color: 'bg-yellow-500',
      description: 'Overall system efficiency'
    },
    {
      title: 'Vision Processing',
      value: '1,287',
      change: '+8.9%',
      changeType: 'positive',
      icon: EyeIcon,
      color: 'bg-pink-500',
      description: 'Images analyzed today'
    },
    {
      title: 'API Requests',
      value: '89,432',
      change: '+23.1%',
      changeType: 'positive',
      icon: CommandLineIcon,
      color: 'bg-indigo-500',
      description: 'API calls handled'
    },
  ];

  const agents: Agent[] = [
    {
      id: 'supervisor',
      name: 'Supervisor Agent',
      status: 'active',
      tasks: 47,
      performance: 96,
      icon: '👥',
      specialization: 'Multi-agent coordination'
    },
    {
      id: 'research',
      name: 'Research Agent',
      status: 'busy',
      tasks: 23,
      performance: 94,
      icon: '🔍',
      specialization: 'Information gathering'
    },
    {
      id: 'writer',
      name: 'Writer Agent',
      status: 'active',
      tasks: 18,
      performance: 98,
      icon: '✍️',
      specialization: 'Content creation'
    },
    {
      id: 'vision',
      name: 'Vision Agent',
      status: 'idle',
      tasks: 12,
      performance: 92,
      icon: '👁️',
      specialization: 'Image analysis'
    },
    {
      id: 'computer',
      name: 'Computer Use Agent',
      status: 'active',
      tasks: 31,
      performance: 89,
      icon: '🖥️',
      specialization: 'System automation'
    },
    {
      id: 'code',
      name: 'Code Writer Agent',
      status: 'busy',
      tasks: 39,
      performance: 97,
      icon: '💻',
      specialization: 'Software development'
    },
  ];

  const alerts: SystemAlert[] = [
    {
      id: '1',
      type: 'success',
      message: 'Quantum computing module initialized successfully',
      timestamp: '2 minutes ago',
      action: 'View Details'
    },
    {
      id: '2',
      type: 'info',
      message: 'New vision processing model deployed',
      timestamp: '15 minutes ago',
      action: 'View Changes'
    },
    {
      id: '3',
      type: 'warning',
      message: 'High system load detected - consider scaling',
      timestamp: '1 hour ago',
      action: 'Scale Now'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'idle':
        return 'bg-gray-400';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'success':
        return CheckCircleIcon;
      case 'warning':
        return ExclamationTriangleIcon;
      case 'error':
        return ExclamationTriangleIcon;
      default:
        return CheckCircleIcon;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Welcome to Cartrita V2 - Your advanced AI orchestration platform
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Time</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white" suppressHydrationWarning>
                {mounted && currentTime ? currentTime.toLocaleTimeString() : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${metric.color} bg-opacity-10`}>
                  <metric.icon className={`w-6 h-6 ${metric.color.replace('bg-', 'text-')}`} />
                </div>
                <div className={`flex items-center text-sm ${
                  metric.changeType === 'positive' ? 'text-green-600 dark:text-green-400' :
                  metric.changeType === 'negative' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {metric.changeType === 'positive' ? (
                    <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                  ) : metric.changeType === 'negative' ? (
                    <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
                  ) : null}
                  {metric.change}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {metric.value}
              </h3>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {metric.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {metric.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AI Agents Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  AI Agents Overview
                </h2>
                <Link 
                  href="/agents"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center"
                >
                  Manage Agents
                  <ChevronRightIcon className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-4">
                {agents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{agent.icon}</div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {agent.name}
                          </h3>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}></div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {agent.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {agent.specialization}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.tasks} tasks
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {agent.performance}% performance
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* System Alerts & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            {/* System Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                System Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">CPU Load</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {systemLoad.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-blue-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(systemLoad, 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Connections</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {activeConnections}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Uptime</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    99.9%
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Alerts
              </h3>
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const AlertIcon = getAlertIcon(alert.type);
                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg ${getAlertColor(alert.type)}`}
                    >
                      <div className="flex items-start space-x-3">
                        <AlertIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{alert.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs opacity-75">{alert.timestamp}</span>
                            {alert.action && (
                              <button className="text-xs font-medium hover:underline">
                                {alert.action}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <Link
                  href="/chat"
                  className="flex items-center justify-between w-full p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <PlayIcon className="w-5 h-5" />
                    <span className="font-medium">Start New Chat</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
                
                <Link
                  href="/analytics"
                  className="flex items-center justify-between w-full p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ChartBarIcon className="w-5 h-5" />
                    <span className="font-medium">View Analytics</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
                
                <Link
                  href="/quantum"
                  className="flex items-center justify-between w-full p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <CpuChipIcon className="w-5 h-5" />
                    <span className="font-medium">Quantum Lab</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
                
                <Link
                  href="/cognitive"
                  className="flex items-center justify-between w-full p-3 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className="w-5 h-5" />
                    <span className="font-medium">Cognitive AI</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
                
                <Link
                  href="/metaverse"
                  className="flex items-center justify-between w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <GlobeAltIcon className="w-5 h-5" />
                    <span className="font-medium">Metaverse</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
                
                <Link
                  href="/vr"
                  className="flex items-center justify-between w-full p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <EyeIcon className="w-5 h-5" />
                    <span className="font-medium">VR Interface</span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Performance Charts Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Performance Overview
            </h2>
            <Link
              href="/analytics"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center"
            >
              View Detailed Analytics
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Performance Charts</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Advanced analytics and performance metrics
              </p>
            </div>
          </div>
        </motion.div>

        {/* System Overview - Real-time Monitoring */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <SystemOverview />
        </motion.div>
      </div>
    </AppLayout>
  );
}
