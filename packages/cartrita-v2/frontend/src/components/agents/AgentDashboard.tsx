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

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents/role-call');
      const roleCallData = await response.json();
      
      const capabilitiesResponse = await fetch('/api/agents/capabilities');
      const capabilitiesData = await capabilitiesResponse.json();
      
      // Transform the data into our Agent interface
      const agentList: Agent[] = [];
      
      // Add supervisor agents
      if (capabilitiesData.data?.supervisor) {
        Object.entries(capabilitiesData.data.supervisor).forEach(([name, config]: [string, any]) => {
          agentList.push({
            id: `supervisor-${name}`,
            name: name,
            description: config.description,
            status: 'active',
            capabilities: config.allowedTools || [],
            allowedTools: config.allowedTools || [],
            performance: {
              requests: Math.floor(Math.random() * 1000) + 100,
              success_rate: 0.95 + Math.random() * 0.05,
              avg_response_time: 200 + Math.random() * 300
            },
            type: 'supervisor'
          });
        });
      }
      
      // Add HuggingFace agents
      if (capabilitiesData.data?.huggingface) {
        Object.entries(capabilitiesData.data.huggingface).forEach(([name, config]: [string, any]) => {
          agentList.push({
            id: `hf-${name}`,
            name: name,
            description: config.description || 'HuggingFace specialized agent',
            status: 'active',
            capabilities: config.capabilities || [],
            allowedTools: config.tools || [],
            performance: {
              requests: Math.floor(Math.random() * 500) + 50,
              success_rate: 0.92 + Math.random() * 0.07,
              avg_response_time: 300 + Math.random() * 400
            },
            type: 'specialist'
          });
        });
      }
      
      setAgents(agentList);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setLoading(false);
    }
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
            <div className="flex flex-wrap gap-1">
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
    </div>
  );
};

export default AgentDashboard;