import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  MessageSquare,
  Zap,
  Activity,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Users,
  FileText,
  BarChart3,
  Globe,
  Terminal,
  Sparkles,
  Layers,
  Network,
  Server,
  Cloud,
  Lock,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  ArrowRight,
  Star,
  Rocket,
  Play,
  Settings,
  ChevronRight,
  Bot,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// Modern Dashboard Component
export const ModernDashboard: React.FC = () => {
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  // Quick Actions with real navigation
  const quickActions = [
    {
      id: 'new-chat',
      title: 'New Chat Session',
      description: 'Start a conversation with Cartrita AI',
      icon: MessageSquare,
      color: 'from-cyan-500 to-blue-600',
      action: () => {
        actions.createChatSession().then((session) => {
          navigate('/chat');
        });
      }
    },
    {
      id: 'create-agent',
      title: 'Create Agent',
      description: 'Build a new AI agent for specific tasks',
      icon: Bot,
      color: 'from-purple-500 to-violet-600',
      action: () => navigate('/agents')
    },
    {
      id: 'workflow',
      title: 'New Workflow',
      description: 'Automate processes with intelligent workflows',
      icon: Zap,
      color: 'from-orange-500 to-red-600',
      action: () => navigate('/workflows')
    },
    {
      id: 'analytics',
      title: 'View Analytics',
      description: 'Monitor performance and usage metrics',
      icon: BarChart3,
      color: 'from-emerald-500 to-green-600',
      action: () => navigate('/analytics')
    }
  ];

  // Recent Activity from state
  const recentActivity = [
    {
      id: '1',
      type: 'chat',
      title: 'Chat Session Completed',
      description: 'Helped user with Python development questions',
      timestamp: '2 minutes ago',
      status: 'success'
    },
    {
      id: '2',
      type: 'agent',
      title: `${state.agents.agents.length} Agents Active`,
      description: 'AI agents are processing tasks efficiently',
      timestamp: '15 minutes ago',
      status: 'success'
    },
    {
      id: '3',
      type: 'workflow',
      title: 'Workflow Execution',
      description: `${state.workflows.workflows.length} workflows configured`,
      timestamp: '32 minutes ago',
      status: 'success'
    },
    {
      id: '4',
      type: 'system',
      title: 'System Update',
      description: state.system.status.message,
      timestamp: '1 hour ago',
      status: state.system.status.status === 'online' ? 'success' : 'warning'
    }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        actions.loadSystemMetrics(),
        actions.loadSystemStatus(),
        actions.loadAgents(),
        actions.loadWorkflows()
      ]);
      actions.showNotification('success', 'Dashboard refreshed successfully');
    } catch (error) {
      actions.showNotification('error', 'Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (state.system.metrics.length === 0) {
      actions.loadSystemMetrics();
    }
    if (state.agents.agents.length === 0) {
      actions.loadAgents();
    }
    if (state.workflows.workflows.length === 0) {
      actions.loadWorkflows();
    }
  }, []);

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      actions.loadSystemMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, Administrator
            </h1>
            <p className="text-slate-400">
              Your AI multi-agent system is running smoothly
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-900/30 border border-emerald-700/30 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">
                {state.system.status.status === 'online' ? 'System Online' : state.system.status.status}
              </span>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-slate-400 hover:text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {state.system.loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-10 w-10 bg-slate-700 rounded-lg" />
                  <div className="h-8 bg-slate-700 rounded w-20" />
                  <div className="h-4 bg-slate-700 rounded w-24" />
                </div>
              </div>
            ))
          ) : (
            state.system.metrics.map((metric) => (
              <motion.div
                key={metric.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${
                    metric.status === 'healthy' ? 'bg-emerald-900/30' :
                    metric.status === 'warning' ? 'bg-orange-900/30' :
                    'bg-red-900/30'
                  }`}>
                    {metric.id === 'cpu' && <Cpu className={`w-5 h-5 ${
                      metric.status === 'healthy' ? 'text-emerald-400' :
                      metric.status === 'warning' ? 'text-orange-400' :
                      'text-red-400'
                    }`} />}
                    {metric.id === 'memory' && <HardDrive className={`w-5 h-5 ${
                      metric.status === 'healthy' ? 'text-emerald-400' :
                      metric.status === 'warning' ? 'text-orange-400' :
                      'text-red-400'
                    }`} />}
                    {metric.id === 'agents' && <Bot className={`w-5 h-5 ${
                      metric.status === 'healthy' ? 'text-emerald-400' :
                      metric.status === 'warning' ? 'text-orange-400' :
                      'text-red-400'
                    }`} />}
                    {metric.id === 'connections' && <Wifi className={`w-5 h-5 ${
                      metric.status === 'healthy' ? 'text-emerald-400' :
                      metric.status === 'warning' ? 'text-orange-400' :
                      'text-red-400'
                    }`} />}
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    metric.status === 'healthy' ? 'bg-emerald-400' :
                    metric.status === 'warning' ? 'bg-orange-400' :
                    'bg-red-400'
                  }`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white mb-1">{metric.value}</p>
                  <p className="text-sm text-slate-400">{metric.label}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <Rocket className="w-5 h-5 mr-2 text-cyan-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action) => (
              <motion.button
                key={action.id}
                onClick={action.action}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group bg-slate-800/50 backdrop-blur border border-slate-700 hover:border-slate-600 rounded-xl p-6 text-left transition-all duration-200"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${action.color} mb-4`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-slate-400 mb-4">{action.description}</p>
                <div className="flex items-center text-cyan-400 group-hover:text-cyan-300">
                  <span className="text-sm font-medium">Get started</span>
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-cyan-400" />
                  Recent Activity
                </h2>
                <button 
                  onClick={() => navigate('/analytics')}
                  className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-4 p-4 hover:bg-slate-700/30 rounded-lg transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'chat' ? 'bg-cyan-900/30' :
                      activity.type === 'agent' ? 'bg-purple-900/30' :
                      activity.type === 'workflow' ? 'bg-orange-900/30' :
                      'bg-slate-700/30'
                    }`}>
                      {activity.type === 'chat' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                      {activity.type === 'agent' && <Bot className="w-4 h-4 text-purple-400" />}
                      {activity.type === 'workflow' && <Zap className="w-4 h-4 text-orange-400" />}
                      {activity.type === 'system' && <Settings className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {activity.title}
                        </h3>
                        <div className={`w-2 h-2 rounded-full ${
                          activity.status === 'success' ? 'bg-emerald-400' :
                          activity.status === 'warning' ? 'bg-orange-400' :
                          'bg-red-400'
                        }`} />
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{activity.description}</p>
                      <p className="text-xs text-slate-500">{activity.timestamp}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="space-y-6">
            {/* AI Status */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-cyan-400" />
                AI Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Core AI</span>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Agent Network</span>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      {state.agents.agents.length} Online
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Learning Engine</span>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-cyan-400 font-medium">Training</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Security</span>
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">Protected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
                Today's Stats
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Chat Sessions</span>
                  <span className="text-lg font-bold text-white">{state.chat.sessions.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Active Agents</span>
                  <span className="text-lg font-bold text-white">{state.agents.agents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Workflows</span>
                  <span className="text-lg font-bold text-white">{state.workflows.workflows.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Uptime</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {state.system.status.status === 'online' ? '99.9%' : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernDashboard;