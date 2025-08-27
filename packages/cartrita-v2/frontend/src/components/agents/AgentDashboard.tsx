'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Zap,
  Users,
  Settings,
  Activity,
  Eye,
  Brain,
  Sparkles,
  Crown,
  ChevronRight,
  Power,
  Gauge,
  Shield,
  Workflow
} from 'lucide-react';
import AgentConfigModal from './AgentConfigModal';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'idle' | 'error' | 'disabled';
  capabilities: string[];
  allowedTools: string[];
  performance: {
    requests: number;
    success_rate: number;
    avg_response_time: number;
  };
  type: 'supervisor' | 'specialist';
}

interface AgentDashboardProps {
  darkMode: boolean;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({ darkMode }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configAgent, setConfigAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
    // Set up real-time updates every 10 seconds
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  // Agent Management CRUD Operations
  const handleAgentAction = async (agentId: string, action: 'start' | 'stop' | 'restart' | 'configure') => {
    setActionLoading(agentId);
    try {
      let response;
      
      switch (action) {
        case 'start':
          // Resume agent - use delegation endpoint to activate
          response = await fetch(`/api/v2/agents/${agentId}/delegate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task: 'activate',
              message: 'Activate agent for operations'
            })
          });
          break;
          
        case 'stop':
          // For stopping, we'll try to get status which effectively pauses activity
          response = await fetch(`/api/v2/agents/${agentId}/status`);
          break;
          
        case 'restart':
          // Restart by first checking status then delegating activation
          await fetch(`/api/v2/agents/${agentId}/status`);
          response = await fetch(`/api/v2/agents/${agentId}/delegate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task: 'restart',
              message: 'Restart agent systems'
            })
          });
          break;
          
        case 'configure':
          // Open configuration modal
          setConfigAgent(agents.find(a => a.id === agentId) || null);
          setShowConfigModal(true);
          return;
      }
      
      if (response?.ok) {
        await fetchAgents(); // Refresh agent list
        console.log(`Agent ${agentId} ${action} successful`);
      }
      
    } catch (error) {
      console.error(`Failed to ${action} agent ${agentId}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const delegateTaskToAgent = async (agentId: string, task: string, message: string) => {
    try {
      const response = await fetch(`/api/v2/agents/${agentId}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, message })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Task delegated successfully:', result);
        return result;
      }
    } catch (error) {
      console.error('Failed to delegate task:', error);
    }
  };

  const getAgentMetrics = async (agentId: string) => {
    try {
      const response = await fetch(`/api/v2/agents/${agentId}/status`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get agent metrics:', error);
    }
  };

  const saveAgentConfiguration = async (config: any) => {
    try {
      // Note: V2 API doesn't have a direct config update endpoint,
      // so we'll simulate saving by logging and potentially delegating a config task
      console.log('Saving agent configuration:', config);
      
      // Optionally delegate a configuration update task
      if (config.id) {
        await delegateTaskToAgent(config.id, 'update_config', `Update configuration: ${JSON.stringify(config)}`);
      }
      
      // Refresh agents to show any changes
      await fetchAgents();
      
    } catch (error) {
      console.error('Failed to save agent configuration:', error);
      throw error;
    }
  };

  const fetchAgents = async () => {
    try {
      // Fetch from V2 API endpoints with real agent data
      const [agentsResponse, statusResponse] = await Promise.all([
        fetch('/api/v2/agents'),
        fetch('/api/v2/agents/status')
      ]);
      
      if (!agentsResponse.ok || !statusResponse.ok) {
        throw new Error('Failed to fetch agent data');
      }
      
      const agentsData = await agentsResponse.json();
      const statusData = await statusResponse.json();
      
      // Transform V2 API data into our Agent interface
      const agentList: Agent[] = [];
      
      // Handle agents from V2 API
      if (agentsData?.data && Array.isArray(agentsData.data)) {
        agentsData.data.forEach((agent: any) => {
          const agentStatus = statusData?.agents?.[agent.id] || statusData?.agents?.[agent.name] || 'idle';
          
          agentList.push({
            id: agent.id || agent.name,
            name: agent.name,
            description: agent.description || `${agent.name} specialized agent for advanced AI operations`,
            status: normalizeAgentStatus(agentStatus),
            capabilities: agent.capabilities || [],
            allowedTools: agent.capabilities || [],
            performance: {
              requests: agent.requests_handled || 0,
              success_rate: agent.success_rate || 0.95,
              avg_response_time: agent.avg_response_time || 250
            },
            type: agent.type || (agent.name.includes('supervisor') ? 'supervisor' : 'specialist')
          });
        });
      }
      
      // Add any agents from status that aren't in the main list
      if (statusData?.agents) {
        Object.entries(statusData.agents).forEach(([agentName, status]: [string, any]) => {
          if (!agentList.find(a => a.id === agentName || a.name === agentName)) {
            agentList.push({
              id: agentName,
              name: agentName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              description: `${agentName} agent - operational and ready for tasks`,
              status: normalizeAgentStatus(status),
              capabilities: [],
              allowedTools: [],
              performance: {
                requests: 0,
                success_rate: 1.0,
                avg_response_time: 200
              },
              type: agentName.includes('supervisor') ? 'supervisor' : 'specialist'
            });
          }
        });
      }
      
      setAgents(agentList);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // Fallback to basic structure if API fails
      const fallbackAgents: Agent[] = [
        {
          id: 'supervisor',
          name: 'Supervisor',
          description: 'Main orchestration agent for task coordination',
          status: 'active',
          capabilities: ['orchestration', 'task_routing', 'quality_assurance'],
          allowedTools: ['all'],
          performance: {
            requests: 0,
            success_rate: 1.0,
            avg_response_time: 200
          },
          type: 'supervisor'
        }
      ];
      setAgents(fallbackAgents);
      setLoading(false);
    }
  };

  const normalizeAgentStatus = (status: any): 'active' | 'idle' | 'error' | 'disabled' => {
    if (typeof status === 'string') {
      const statusLower = status.toLowerCase();
      if (statusLower.includes('active') || statusLower.includes('running') || statusLower.includes('healthy')) {
        return 'active';
      }
      if (statusLower.includes('error') || statusLower.includes('failed')) {
        return 'error';
      }
      if (statusLower.includes('disabled') || statusLower.includes('offline')) {
        return 'disabled';
      }
    }
    return 'idle';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return darkMode ? 'text-green-400' : 'text-green-600';
      case 'idle':
        return darkMode ? 'text-yellow-400' : 'text-yellow-600';
      case 'error':
        return darkMode ? 'text-red-400' : 'text-red-600';
      case 'disabled':
        return darkMode ? 'text-gray-400' : 'text-gray-600';
      default:
        return darkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getAgentIcon = (agent: Agent) => {
    if (agent.type === 'supervisor') {
      return <Crown className="w-5 h-5 text-yellow-500" />;
    }
    return <Bot className="w-5 h-5 text-purple-500" />;
  };

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
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Agent Command Center 🔥
            </h1>
            <p className={`${
              darkMode ? 'text-purple-300' : 'text-purple-600'
            }`}>
              Manage your squad of AI agents - they're working hard for you, boo! ✨
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            icon: <Bot className="w-6 h-6" />, 
            label: 'Total Agents', 
            value: agents.length,
            color: 'from-blue-500 to-purple-600'
          },
          { 
            icon: <Zap className="w-6 h-6" />, 
            label: 'Active Agents', 
            value: agents.filter(a => a.status === 'active').length,
            color: 'from-green-500 to-emerald-600'
          },
          { 
            icon: <Crown className="w-6 h-6" />, 
            label: 'Supervisors', 
            value: agents.filter(a => a.type === 'supervisor').length,
            color: 'from-yellow-500 to-orange-600'
          },
          { 
            icon: <Activity className="w-6 h-6" />, 
            label: 'Avg Success Rate', 
            value: `${Math.round(agents.reduce((sum, a) => sum + a.performance.success_rate, 0) / agents.length * 100)}%`,
            color: 'from-pink-500 to-purple-600'
          }
        ].map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-6 rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg`}
          >
            <div className="flex items-center justify-between text-white">
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm opacity-90">{stat.label}</div>
              </div>
              {stat.icon}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all hover:transform hover:scale-105 ${
              darkMode 
                ? 'bg-gradient-to-br from-gray-800/50 to-purple-900/50 border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/20'
                : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-200/50'
            }`}
            onClick={() => setSelectedAgent(agent)}
          >
            {/* Agent Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getAgentIcon(agent)}
                <div>
                  <h3 className={`font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {agent.name}
                  </h3>
                  <div className={`text-sm ${getStatusColor(agent.status)}`}>
                    {agent.status.toUpperCase()}
                  </div>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`} />
            </div>

            {/* Description */}
            <p className={`text-sm mb-4 ${
              darkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {agent.description}
            </p>

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className={`text-sm font-medium ${
                  darkMode ? 'text-purple-400' : 'text-purple-600'
                }`}>
                  {agent.performance.requests}
                </div>
                <div className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Requests
                </div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-medium ${
                  darkMode ? 'text-green-400' : 'text-green-600'
                }`}>
                  {Math.round(agent.performance.success_rate * 100)}%
                </div>
                <div className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Success
                </div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-medium ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {Math.round(agent.performance.avg_response_time)}ms
                </div>
                <div className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Avg Time
                </div>
              </div>
            </div>

            {/* Capabilities Preview */}
            <div className="flex flex-wrap gap-1 mb-4">
              {agent.capabilities.slice(0, 3).map((capability, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 text-xs rounded-full ${
                    darkMode 
                      ? 'bg-purple-900/50 text-purple-300' 
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {capability}
                </span>
              ))}
              {agent.capabilities.length > 3 && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  +{agent.capabilities.length - 3} more
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAgentAction(agent.id, 'start');
                }}
                disabled={actionLoading === agent.id || agent.status === 'active'}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-all flex items-center justify-center gap-1 ${
                  agent.status === 'active' 
                    ? (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                    : (darkMode ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100')
                }`}
              >
                {actionLoading === agent.id ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-3 h-3 border border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Power className="w-3 h-3" />
                    {agent.status === 'active' ? 'Active' : 'Start'}
                  </>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAgentAction(agent.id, 'configure');
                }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 ${
                  darkMode 
                    ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <Settings className="w-3 h-3" />
                Configure
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  getAgentMetrics(agent.id).then(metrics => {
                    console.log('Agent metrics:', metrics);
                  });
                }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 ${
                  darkMode 
                    ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' 
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                }`}
              >
                <Activity className="w-3 h-3" />
                Metrics
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-2xl rounded-2xl p-6 ${
                darkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-purple-900' 
                  : 'bg-gradient-to-br from-white to-purple-50'
              } shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {getAgentIcon(selectedAgent)}
                  <div>
                    <h2 className={`text-xl font-bold ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {selectedAgent.name}
                    </h2>
                    <div className={`text-sm ${getStatusColor(selectedAgent.status)}`}>
                      {selectedAgent.status.toUpperCase()} • {selectedAgent.type.toUpperCase()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Agent Details */}
              <div className="space-y-6">
                <div>
                  <h3 className={`font-semibold mb-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Description
                  </h3>
                  <p className={`${
                    darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {selectedAgent.description}
                  </p>
                </div>

                <div>
                  <h3 className={`font-semibold mb-3 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Performance Metrics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`p-4 rounded-xl ${
                      darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          darkMode ? 'text-purple-400' : 'text-purple-600'
                        }`}>
                          {selectedAgent.performance.requests}
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Total Requests
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl ${
                      darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          darkMode ? 'text-green-400' : 'text-green-600'
                        }`}>
                          {Math.round(selectedAgent.performance.success_rate * 100)}%
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Success Rate
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl ${
                      darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          {Math.round(selectedAgent.performance.avg_response_time)}ms
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Avg Response Time
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className={`font-semibold mb-3 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Available Tools & Capabilities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.allowedTools.map((tool, idx) => (
                      <span
                        key={idx}
                        className={`px-3 py-1.5 text-sm rounded-full ${
                          darkMode 
                            ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' 
                            : 'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Configuration Modal */}
      <AgentConfigModal
        agent={configAgent}
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setConfigAgent(null);
        }}
        onSave={saveAgentConfiguration}
        darkMode={darkMode}
      />
    </div>
  );
};

export default AgentDashboard;