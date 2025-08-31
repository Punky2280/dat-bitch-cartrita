'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Brain,
  Zap,
  Eye,
  Trash2,
  Download,
  Filter,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  type: 'chat' | 'workflow' | 'automation' | 'analysis';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  response?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: {
    priority: number;
    source: string;
    userId?: string;
  };
}

interface AgentControlsProps {
  darkMode: boolean;
}

const AgentControls: React.FC<AgentControlsProps> = ({ darkMode }) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'duration' | 'agent'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [filterStatus, sortBy, sortOrder]);

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams({
        status: filterStatus !== 'all' ? filterStatus : '',
        sortBy,
        sortOrder,
        limit: '100'
      });

      const response = await fetch(`/api/agents/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: 'cancel' | 'retry' | 'delete') => {
    try {
      const response = await fetch(`/api/agents/tasks/${taskId}/${action}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success(`Task ${action}ed successfully`);
        fetchTasks();
        if (selectedTask?.id === taskId) {
          setSelectedTask(null);
        }
      } else {
        throw new Error(`Failed to ${action} task`);
      }
    } catch (error) {
      console.error(`Failed to ${action} task:`, error);
      toast.error(`Failed to ${action} task`);
    }
  };

  const exportTasks = async () => {
    try {
      const response = await fetch('/api/agents/tasks/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: filterStatus !== 'all' ? filterStatus : undefined,
          tasks: tasks.map(t => t.id)
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-tasks-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Tasks exported successfully');
      }
    } catch (error) {
      console.error('Failed to export tasks:', error);
      toast.error('Failed to export tasks');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-4 h-4" />;
      case 'workflow':
        return <Zap className="w-4 h-4" />;
      case 'automation':
        return <Settings className="w-4 h-4" />;
      case 'analysis':
        return <Brain className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.agentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Agent Task Control 🎛️
              </h1>
              <p className={`${
                darkMode ? 'text-green-300' : 'text-green-600'
              }`}>
                Monitor and manage all agent tasks in real-time
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={exportTasks}
              className={`px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                darkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks or agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-3 py-2 rounded-lg border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          >
            <option value="createdAt">Sort by Created</option>
            <option value="duration">Sort by Duration</option>
            <option value="agent">Sort by Agent</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={`px-3 py-2 rounded-lg border font-medium ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' 
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
            }`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { 
              label: 'Total Tasks', 
              value: filteredTasks.length,
              color: 'text-blue-500'
            },
            { 
              label: 'Running', 
              value: filteredTasks.filter(t => t.status === 'running').length,
              color: 'text-blue-500'
            },
            { 
              label: 'Pending', 
              value: filteredTasks.filter(t => t.status === 'pending').length,
              color: 'text-yellow-500'
            },
            { 
              label: 'Completed', 
              value: filteredTasks.filter(t => t.status === 'completed').length,
              color: 'text-green-500'
            },
            { 
              label: 'Failed', 
              value: filteredTasks.filter(t => t.status === 'failed').length,
              color: 'text-red-500'
            }
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={`p-4 rounded-xl ${
                darkMode ? 'bg-gray-800/50' : 'bg-gray-50'
              } border ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className={`rounded-2xl border ${
        darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
      } overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Task
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Agent
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Status
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Duration
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Created
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTasks.map((task) => (
                <motion.tr
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`${
                    darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                  } cursor-pointer`}
                  onClick={() => setSelectedTask(task)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getTypeIcon(task.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {task.prompt.length > 50 
                            ? `${task.prompt.substring(0, 50)}...` 
                            : task.prompt}
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {task.type} • {task.id.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                    darkMode ? 'text-gray-300' : 'text-gray-900'
                  }`}>
                    {task.agentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${
                        darkMode ? 'bg-opacity-20' : ''
                      } ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                    darkMode ? 'text-gray-300' : 'text-gray-900'
                  }`}>
                    {task.duration ? `${(task.duration / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                    darkMode ? 'text-gray-300' : 'text-gray-900'
                  }`}>
                    {new Date(task.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        className="text-purple-600 hover:text-purple-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {task.status === 'running' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskAction(task.id, 'cancel');
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Cancel Task"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      
                      {task.status === 'failed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskAction(task.id, 'retry');
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="Retry Task"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      
                      {['completed', 'failed', 'cancelled'].includes(task.status) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskAction(task.id, 'delete');
                          }}
                          className="text-gray-600 hover:text-red-600"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-4xl max-h-[90vh] rounded-2xl ${
                darkMode 
                  ? 'bg-gradient-to-br from-gray-900 to-purple-900' 
                  : 'bg-gradient-to-br from-white to-purple-50'
              } shadow-2xl overflow-hidden flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`p-6 border-b ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(selectedTask.type)}
                    <div>
                      <h2 className={`text-xl font-bold ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Task Details
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(selectedTask.status)}
                        <span className={`text-sm ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {selectedTask.agentName} • {selectedTask.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedTask(null)}
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className={`font-semibold mb-3 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Task Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        ID
                      </label>
                      <div className={`text-sm font-mono ${
                        darkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {selectedTask.id}
                      </div>
                    </div>
                    <div>
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Type
                      </label>
                      <div className={`text-sm ${
                        darkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {selectedTask.type}
                      </div>
                    </div>
                    <div>
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Created
                      </label>
                      <div className={`text-sm ${
                        darkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {new Date(selectedTask.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Duration
                      </label>
                      <div className={`text-sm ${
                        darkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {selectedTask.duration ? `${(selectedTask.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <h3 className={`font-semibold mb-3 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Prompt
                  </h3>
                  <div className={`p-4 rounded-lg ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  } text-sm font-mono whitespace-pre-wrap`}>
                    {selectedTask.prompt}
                  </div>
                </div>

                {/* Response */}
                {selectedTask.response && (
                  <div>
                    <h3 className={`font-semibold mb-3 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Response
                    </h3>
                    <div className={`p-4 rounded-lg ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    } text-sm whitespace-pre-wrap`}>
                      {selectedTask.response}
                    </div>
                  </div>
                )}

                {/* Token Usage */}
                {selectedTask.tokens && (
                  <div>
                    <h3 className={`font-semibold mb-3 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Token Usage
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-3 rounded-lg text-center ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <div className="text-lg font-bold text-blue-500">
                          {selectedTask.tokens.input.toLocaleString()}
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Input
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg text-center ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <div className="text-lg font-bold text-green-500">
                          {selectedTask.tokens.output.toLocaleString()}
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Output
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg text-center ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <div className="text-lg font-bold text-purple-500">
                          {selectedTask.tokens.total.toLocaleString()}
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Total
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentControls;