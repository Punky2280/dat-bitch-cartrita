import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  MessageSquare,
  Zap,
  Settings,
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
  XCircle
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { useThemeContext } from '../context/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: string;
  version?: string;
  endpoint?: string;
}

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'system' | 'analytics'>('overview');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { isConnected, connectionHealth } = useWebSocket();
  const { theme } = useThemeContext();

  useEffect(() => {
    // Simulate loading system data
    const loadSystemData = async () => {
      setIsLoading(true);
      
      // Mock system metrics
      setSystemMetrics([
        { name: 'CPU Usage', value: 45, unit: '%', status: 'healthy', trend: 'stable' },
        { name: 'Memory Usage', value: 68, unit: '%', status: 'warning', trend: 'up' },
        { name: 'Disk Usage', value: 32, unit: '%', status: 'healthy', trend: 'down' },
        { name: 'Network I/O', value: 24, unit: 'MB/s', status: 'healthy', trend: 'stable' },
        { name: 'Active Connections', value: 156, unit: '', status: 'healthy', trend: 'up' },
        { name: 'Response Time', value: 89, unit: 'ms', status: 'healthy', trend: 'down' }
      ]);

      // Mock service status
      setServices([
        { name: 'Cartrita Core Agent', status: 'online', uptime: '99.9%', version: 'v2.1.0', endpoint: '/api/chat' },
        { name: 'WebSocket Server', status: 'online', uptime: '99.8%', version: 'v1.3.2', endpoint: '/ws' },
        { name: 'Database (PostgreSQL)', status: 'online', uptime: '99.99%', version: '15.0' },
        { name: 'Redis Cache', status: 'online', uptime: '99.95%', version: '7.0' },
        { name: 'Vector Search', status: 'online', uptime: '99.7%', version: 'pgvector-0.5.0' },
        { name: 'Media Processing', status: 'degraded', uptime: '97.2%', version: 'v1.1.0' }
      ]);

      setIsLoading(false);
    };

    loadSystemData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'warning':
      case 'degraded':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'critical':
      case 'offline':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <CheckCircle className="w-4 h-4" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-4 h-4" />;
      case 'critical':
      case 'offline':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'agents', label: 'Agents', icon: Brain },
    { id: 'system', label: 'System', icon: Server },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp }
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Cartrita Dashboard
              </h1>
              <p className="text-slate-400">Multi-Agent OS Control Center</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm text-slate-300">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 mt-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${activeTab === tab.id 
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </motion.header>

      {/* Main Content */}
      <main className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">Active Sessions</p>
                        <p className="text-2xl font-bold text-white">24</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">Messages Today</p>
                        <p className="text-2xl font-bold text-white">1,247</p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">System Health</p>
                        <p className="text-2xl font-bold text-green-400">98.5%</p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Activity className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">Response Time</p>
                        <p className="text-2xl font-bold text-white">89ms</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Zap className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      <span>System Metrics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {systemMetrics.slice(0, 4).map((metric, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">{metric.name}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant={metric.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                              {metric.value}{metric.unit}
                            </Badge>
                            {metric.trend && (
                              <TrendingUp className={`w-4 h-4 ${
                                metric.trend === 'up' ? 'text-green-400' : 
                                metric.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                              }`} />
                            )}
                          </div>
                        </div>
                        <Progress 
                          value={metric.value} 
                          className="h-2" 
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Server className="w-5 h-5 text-green-400" />
                      <span>Service Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {services.slice(0, 5).map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(service.status)}
                          <div>
                            <p className="text-sm font-medium text-white">{service.name}</p>
                            <p className="text-xs text-slate-400">{service.version}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'agents' && (
            <motion.div
              key="agents"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span>Active Agents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { name: 'Core Agent', status: 'active', tasks: 12, efficiency: 94 },
                      { name: 'Analytics Agent', status: 'active', tasks: 8, efficiency: 87 },
                      { name: 'Vision Agent', status: 'idle', tasks: 0, efficiency: 100 },
                      { name: 'Audio Agent', status: 'processing', tasks: 3, efficiency: 91 },
                      { name: 'Workflow Agent', status: 'active', tasks: 15, efficiency: 89 },
                      { name: 'Security Agent', status: 'monitoring', tasks: 24, efficiency: 96 }
                    ].map((agent, index) => (
                      <div key={index} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-white">{agent.name}</h4>
                          <Badge className={getStatusColor(agent.status)}>
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Tasks</span>
                            <span className="text-white">{agent.tasks}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Efficiency</span>
                            <span className="text-green-400">{agent.efficiency}%</span>
                          </div>
                          <Progress value={agent.efficiency} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'system' && (
            <motion.div
              key="system"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5 text-blue-400" />
                      <span>Resource Usage</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {systemMetrics.map((metric, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{metric.name}</span>
                          <span className="text-sm text-slate-400">{metric.value}{metric.unit}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              metric.status === 'healthy' ? 'bg-green-500' :
                              metric.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(metric.value, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Database className="w-5 h-5 text-green-400" />
                      <span>Services</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {services.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(service.status)}
                          <div>
                            <p className="font-medium text-white">{service.name}</p>
                            <p className="text-xs text-slate-400">Uptime: {service.uptime}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    <span>Performance Analytics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Analytics Coming Soon</h3>
                    <p className="text-slate-400">Detailed performance metrics and insights will be available here.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};