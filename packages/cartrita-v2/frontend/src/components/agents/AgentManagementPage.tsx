'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Settings,
  Activity,
  BarChart3,
  PlayCircle,
  Users,
  Zap,
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import AgentDashboard from './AgentDashboard';
import AgentSettings from './AgentSettings';
import AgentMonitoring from './AgentMonitoring';
import AgentControls from './AgentControls';

interface AgentManagementPageProps {
  darkMode: boolean;
  onThemeToggle: () => void;
}

type ActiveTab = 'dashboard' | 'monitoring' | 'controls' | 'settings';

const AgentManagementPage: React.FC<AgentManagementPageProps> = ({ 
  darkMode, 
  onThemeToggle 
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    health: 'healthy' | 'warning' | 'critical';
    activeAgents: number;
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
  }>({
    health: 'healthy',
    activeAgents: 0,
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0
  });

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/agents/system/status');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'from-green-500 to-emerald-600';
      case 'warning':
        return 'from-yellow-500 to-orange-600';
      case 'critical':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const tabs = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: <Bot className="w-5 h-5" />,
      description: 'Agent overview and management',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'monitoring' as const,
      label: 'Monitoring',
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Performance metrics and analytics',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'controls' as const,
      label: 'Controls',
      icon: <PlayCircle className="w-5 h-5" />,
      description: 'Task management and execution',
      color: 'from-green-500 to-teal-500'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      description: 'Configuration and preferences',
      color: 'from-orange-500 to-red-500'
    }
  ];

  const handleAgentConfigSave = (config: any) => {
    // Handle agent configuration save
    console.log('Agent config saved:', config);
    setShowSettings(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-purple-50 to-gray-50'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/80'
      } backdrop-blur-sm sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Cartrita Agent Management 🚀
                </h1>
                <p className={`text-sm ${
                  darkMode ? 'text-purple-300' : 'text-purple-600'
                }`}>
                  Your AI agents are ready to work some Miami magic! ✨
                </p>
              </div>
            </div>

            {/* System Status */}
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-4 py-2 rounded-xl bg-gradient-to-br ${getHealthColor(systemStatus.health)} text-white shadow-lg`}
              >
                <div className="flex items-center gap-2">
                  {getHealthIcon(systemStatus.health)}
                  <span className="font-medium">
                    {systemStatus.health.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs opacity-90 mt-1">
                  {systemStatus.activeAgents} agents active
                </div>
              </motion.div>

              {/* Theme Toggle */}
              <button
                onClick={onThemeToggle}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Toggle Theme"
              >
                {darkMode ? '🌙' : '☀️'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-3 rounded-lg font-medium flex items-center gap-3 transition-all ${
                  activeTab === tab.id
                    ? (darkMode 
                        ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                      )
                    : (darkMode 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700/30' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      )
                }`}
              >
                {tab.icon}
                <div className="text-left">
                  <div>{tab.label}</div>
                  <div className={`text-xs ${
                    activeTab === tab.id
                      ? (darkMode ? 'text-purple-400' : 'text-purple-600')
                      : (darkMode ? 'text-gray-500' : 'text-gray-500')
                  }`}>
                    {tab.description}
                  </div>
                </div>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-10 rounded-lg`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className={`border-b ${
        darkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white/50'
      } backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                {systemStatus.activeAgents} Active Agents
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                {systemStatus.totalRequests.toLocaleString()} Total Requests
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                {systemStatus.successRate.toFixed(1)}% Success Rate
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                {systemStatus.avgResponseTime.toFixed(0)}ms Avg Response
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AgentDashboard darkMode={darkMode} />
            </motion.div>
          )}

          {activeTab === 'monitoring' && (
            <motion.div
              key="monitoring"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AgentMonitoring darkMode={darkMode} />
            </motion.div>
          )}

          {activeTab === 'controls' && (
            <motion.div
              key="controls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AgentControls darkMode={darkMode} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <div className="text-center py-12">
                <Settings className={`w-16 h-16 mx-auto mb-4 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <h3 className={`text-xl font-semibold mb-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Global Settings
                </h3>
                <p className={`${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  System-wide configuration and preferences coming soon...
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Open Agent Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Agent Settings Modal */}
      <AnimatePresence>
        {showSettings && selectedAgent && (
          <AgentSettings
            agentId={selectedAgent}
            darkMode={darkMode}
            onClose={() => setShowSettings(false)}
            onSave={handleAgentConfigSave}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className={`mt-12 border-t ${
        darkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white/50'
      } backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className={`text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Cartrita V2 Agent Management System</span>
              </div>
              <div className="mt-1">
                Powered by AI • Built with 💜 in Miami
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                System Health: {systemStatus.health.toUpperCase()}
              </div>
              <div className={`w-2 h-2 rounded-full ${
                systemStatus.health === 'healthy' 
                  ? 'bg-green-500' 
                  : systemStatus.health === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              } animate-pulse`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentManagementPage;