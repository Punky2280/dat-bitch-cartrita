import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Activity, Settings, Play, Pause, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';

export const AgentsPage: React.FC = () => {
  const agents = [
    {
      id: 1,
      name: 'Core Agent',
      description: 'Primary conversation and reasoning agent',
      status: 'active',
      tasks: 15,
      efficiency: 94,
      uptime: '99.8%',
      version: 'v2.1.0',
      category: 'Core'
    },
    {
      id: 2,
      name: 'Analytics Agent',
      description: 'Data analysis and metrics processing',
      status: 'active',
      tasks: 8,
      efficiency: 87,
      uptime: '99.5%',
      version: 'v1.3.2',
      category: 'Analytics'
    },
    {
      id: 3,
      name: 'Vision Agent',
      description: 'Image processing and visual analysis',
      status: 'idle',
      tasks: 0,
      efficiency: 100,
      uptime: '99.9%',
      version: 'v1.2.1',
      category: 'Multimodal'
    },
    {
      id: 4,
      name: 'Audio Agent',
      description: 'Speech processing and audio analysis',
      status: 'processing',
      tasks: 3,
      efficiency: 91,
      uptime: '98.7%',
      version: 'v1.1.8',
      category: 'Multimodal'
    },
    {
      id: 5,
      name: 'Workflow Agent',
      description: 'Task automation and workflow management',
      status: 'active',
      tasks: 12,
      efficiency: 89,
      uptime: '99.2%',
      version: 'v2.0.1',
      category: 'Automation'
    },
    {
      id: 6,
      name: 'Security Agent',
      description: 'Security monitoring and threat detection',
      status: 'monitoring',
      tasks: 24,
      efficiency: 96,
      uptime: '99.99%',
      version: 'v1.4.0',
      category: 'Security'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'processing':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'monitoring':
        return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30';
      case 'idle':
        return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Core':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
      case 'Analytics':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'Multimodal':
        return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30';
      case 'Automation':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'Security':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">AI Agents</h1>
            <p className="text-slate-400">Manage and monitor your AI agent fleet</p>
          </div>
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
            <Brain className="w-4 h-4 mr-2" />
            Deploy New Agent
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Agents</p>
                  <p className="text-2xl font-bold text-white">
                    {agents.filter(a => a.status === 'active').length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Tasks</p>
                  <p className="text-2xl font-bold text-white">
                    {agents.reduce((sum, agent) => sum + agent.tasks, 0)}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Avg Efficiency</p>
                  <p className="text-2xl font-bold text-white">
                    {Math.round(agents.reduce((sum, agent) => sum + agent.efficiency, 0) / agents.length)}%
                  </p>
                </div>
                <Brain className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">System Health</p>
                  <p className="text-2xl font-bold text-green-400">98.9%</p>
                </div>
                <Settings className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg">{agent.name}</CardTitle>
                        <Badge className={getCategoryColor(agent.category)}>
                          {agent.category}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-sm mb-4">{agent.description}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Status</span>
                      <Badge className={getStatusColor(agent.status)}>
                        {agent.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Active Tasks</span>
                      <span className="text-white font-medium">{agent.tasks}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Efficiency</span>
                        <span className="text-white font-medium">{agent.efficiency}%</span>
                      </div>
                      <Progress value={agent.efficiency} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Uptime</span>
                      <span className="text-green-400 font-medium">{agent.uptime}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Version</span>
                      <span className="text-slate-400 font-mono text-sm">{agent.version}</span>
                    </div>

                    <div className="flex space-x-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 text-slate-400 border-slate-600 hover:text-white"
                      >
                        {agent.status === 'active' ? (
                          <>
                            <Pause className="w-3 h-3 mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-slate-400 border-slate-600 hover:text-white"
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Agent Management Actions */}
        <Card className="bg-slate-800/50 border-slate-700/50 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Agent Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="text-slate-400 border-slate-600 hover:text-white">
                <Brain className="w-4 h-4 mr-2" />
                Agent Marketplace
              </Button>
              <Button variant="outline" className="text-slate-400 border-slate-600 hover:text-white">
                <Settings className="w-4 h-4 mr-2" />
                Global Settings
              </Button>
              <Button variant="outline" className="text-slate-400 border-slate-600 hover:text-white">
                <Activity className="w-4 h-4 mr-2" />
                Performance Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};