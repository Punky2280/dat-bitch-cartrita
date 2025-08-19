import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Plus, Settings, Play, Pause, BarChart3, Zap, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AgentsPage: React.FC = () => {
  const { state, actions } = useApp();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');

  // Load agents on mount
  useEffect(() => {
    actions.loadAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    try {
      await actions.createAgent({
        name: newAgentName,
        description: newAgentDescription,
        capabilities: ['general'],
        status: 'idle'
      });
      setNewAgentName('');
      setNewAgentDescription('');
      setShowCreateForm(false);
      actions.showNotification('success', 'Agent created successfully');
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleStartAgent = (agentId: string) => {
    actions.startAgent(agentId);
  };

  const handleStopAgent = (agentId: string) => {
    actions.stopAgent(agentId);
  };

  const handleDeleteAgent = (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      actions.deleteAgent(agentId);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Agents</h1>
          <p className="text-slate-400">
            Manage and monitor your specialized AI agents ({state.agents.agents.length} total)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => actions.loadAgents()}
            disabled={state.agents.loading}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 hover:text-white ${state.agents.loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </button>
        </div>
      </div>

      {/* Create Agent Form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Create New Agent</h3>
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name</label>
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="Enter agent name"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder="Describe what this agent does"
                rows={3}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all"
              >
                Create Agent
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Agents Grid */}
      {state.agents.loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-12 w-12 bg-slate-700 rounded-xl" />
                <div className="h-6 bg-slate-700 rounded w-3/4" />
                <div className="h-4 bg-slate-700 rounded w-full" />
                <div className="h-4 bg-slate-700 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : state.agents.agents.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No agents found</h3>
          <p className="text-slate-400 mb-4">Create your first AI agent to get started</p>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all"
          >
            Create First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.agents.agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  agent.status === 'active' 
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/30'
                    : agent.status === 'idle'
                    ? 'bg-orange-900/30 text-orange-400 border border-orange-700/30'
                    : 'bg-slate-700/30 text-slate-400 border border-slate-600/30'
                }`}>
                  {agent.status}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2">{agent.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{agent.description}</p>
              
              {/* Performance Stats */}
              {agent.performance && (
                <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Tasks:</span>
                      <span className="text-white ml-1">{agent.performance.tasksCompleted}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Success:</span>
                      <span className="text-emerald-400 ml-1">
                        {Math.round(agent.performance.successRate * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {agent.status === 'active' ? (
                    <button 
                      onClick={() => handleStopAgent(agent.id)}
                      className="p-2 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-colors"
                      title="Stop Agent"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleStartAgent(agent.id)}
                      className="p-2 hover:bg-emerald-900/30 hover:text-emerald-400 rounded-lg transition-colors"
                      title="Start Agent"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => actions.setSelectedAgent?.(agent)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Agent Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};