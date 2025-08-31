/**
 * System Overview Component
 * Displays real-time system metrics and status
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CpuChipIcon,
  ServerIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ChartBarIcon,
  UserGroupIcon,
  CloudIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useSystemStore, useAnalyticsStore } from '@/stores';

interface SystemMetric {
  name: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ComponentType<any>;
  change?: number;
  description: string;
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: string;
  latency?: number;
  description: string;
}

export default function SystemOverview() {
  const { status, health, isConnected } = useSystemStore();
  const { data: analyticsData } = useAnalyticsStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mock system metrics - in production, these would come from real monitoring APIs
  useEffect(() => {
    const updateMetrics = () => {
      const metrics: SystemMetric[] = [
        {
          name: 'CPU Usage',
          value: Math.floor(Math.random() * 30) + 15, // 15-45%
          unit: '%',
          status: 'healthy',
          icon: CpuChipIcon,
          change: Math.random() > 0.5 ? Math.random() * 5 : -Math.random() * 5,
          description: 'Current CPU utilization across all cores'
        },
        {
          name: 'Memory Usage',
          value: Math.floor(Math.random() * 40) + 40, // 40-80%
          unit: '%',
          status: 'healthy',
          icon: ServerIcon,
          change: Math.random() > 0.5 ? Math.random() * 3 : -Math.random() * 3,
          description: 'RAM utilization for active processes'
        },
        {
          name: 'Active Users',
          value: Math.floor(Math.random() * 50) + 150, // 150-200
          unit: '',
          status: 'healthy',
          icon: UserGroupIcon,
          change: Math.random() > 0.5 ? Math.random() * 10 : -Math.random() * 5,
          description: 'Currently active user sessions'
        },
        {
          name: 'API Requests',
          value: Math.floor(Math.random() * 1000) + 2000, // 2000-3000
          unit: '/min',
          status: 'healthy',
          icon: BoltIcon,
          change: Math.random() > 0.5 ? Math.random() * 100 : -Math.random() * 50,
          description: 'API requests per minute'
        },
        {
          name: 'Response Time',
          value: Math.floor(Math.random() * 50) + 85, // 85-135ms
          unit: 'ms',
          status: 'healthy',
          icon: ClockIcon,
          change: Math.random() > 0.5 ? -Math.random() * 10 : Math.random() * 15,
          description: 'Average API response time'
        },
        {
          name: 'Storage Usage',
          value: Math.floor(Math.random() * 30) + 45, // 45-75%
          unit: '%',
          status: 'healthy',
          icon: CloudIcon,
          change: Math.random() * 2,
          description: 'Total storage utilization'
        }
      ];

      // Set status based on values
      metrics.forEach(metric => {
        if (metric.name === 'CPU Usage' && typeof metric.value === 'number') {
          metric.status = metric.value > 80 ? 'critical' : metric.value > 60 ? 'warning' : 'healthy';
        } else if (metric.name === 'Memory Usage' && typeof metric.value === 'number') {
          metric.status = metric.value > 85 ? 'critical' : metric.value > 70 ? 'warning' : 'healthy';
        } else if (metric.name === 'Response Time' && typeof metric.value === 'number') {
          metric.status = metric.value > 200 ? 'critical' : metric.value > 150 ? 'warning' : 'healthy';
        }
      });

      setSystemMetrics(metrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Mock services status
  useEffect(() => {
    const servicesList: ServiceStatus[] = [
      {
        name: 'API Gateway',
        status: 'online',
        uptime: '99.9%',
        latency: 42,
        description: 'Main API routing service'
      },
      {
        name: 'AI Router',
        status: 'online',
        uptime: '99.8%',
        latency: 156,
        description: 'Multi-agent AI orchestration'
      },
      {
        name: 'Database',
        status: 'online',
        uptime: '100%',
        latency: 8,
        description: 'Primary PostgreSQL database'
      },
      {
        name: 'Knowledge Base',
        status: 'online',
        uptime: '99.7%',
        latency: 23,
        description: 'Vector database for RAG'
      },
      {
        name: 'Quantum Engine',
        status: isConnected ? 'online' : 'degraded',
        uptime: '98.5%',
        latency: 234,
        description: 'Quantum computing integration'
      },
      {
        name: 'Vision Lab',
        status: 'online',
        uptime: '99.2%',
        latency: 89,
        description: 'Computer vision processing'
      }
    ];

    setServices(servicesList);
  }, [isConnected]);

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical' | 'online' | 'offline' | 'degraded') => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      case 'warning':
      case 'degraded':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'critical':
      case 'offline':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: 'online' | 'offline' | 'degraded') => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'offline':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <ShieldCheckIcon className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              System Overview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400" suppressHydrationWarning>
              Real-time monitoring • Last updated: {currentTime.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(isConnected ? 'online' : 'offline')}`}>
          {isConnected ? 'All Systems Operational' : 'System Issues Detected'}
        </div>
      </div>

      {/* System Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {systemMetrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${getStatusColor(metric.status)}`}>
                <metric.icon className="w-5 h-5" />
              </div>
              {metric.change !== undefined && (
                <span className={`text-xs font-medium ${
                  metric.change > 0 
                    ? metric.name === 'Response Time' ? 'text-red-500' : 'text-green-500'
                    : metric.name === 'Response Time' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}
                  {metric.unit && metric.unit !== '/min' ? metric.unit : ''}
                </span>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {metric.name}
              </h3>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                {metric.unit && <span className="text-lg text-gray-500 ml-1">{metric.unit}</span>}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {metric.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Services Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ServerIcon className="w-5 h-5 mr-2" />
            Service Status
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                {getStatusIcon(service.status)}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {service.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {service.description}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {service.uptime} uptime
                </div>
                {service.latency && (
                  <div className="text-xs text-gray-500">
                    {service.latency}ms latency
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}