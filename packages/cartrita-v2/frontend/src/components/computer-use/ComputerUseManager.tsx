'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Play,
  Pause,
  Square,
  RotateCcw,
  Eye,
  Code,
  Image,
  FileText,
  Download,
  Upload,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Settings,
  Terminal,
  MousePointer,
  Keyboard,
  Camera,
  Zap,
  RefreshCw,
  Plus,
  Filter,
  Search,
  ExternalLink
} from 'lucide-react';

interface ComputerUseTask {
  id: string;
  session_id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  task_type: 'automation' | 'analysis' | 'data_extraction' | 'testing' | 'monitoring' | 'custom';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  progress: number;
  steps_completed: number;
  total_steps: number;
  current_step?: string;
  error_message?: string;
  result?: any;
  metadata: {
    agent_id?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    estimated_duration?: number;
    resources_used?: string[];
    tags?: string[];
  };
  config: {
    screenshots_enabled: boolean;
    logging_level: 'minimal' | 'normal' | 'verbose';
    timeout_seconds: number;
    retry_attempts: number;
    auto_continue: boolean;
  };
}

interface ComputerUseManagerProps {
  darkMode: boolean;
}

const ComputerUseManager: React.FC<ComputerUseManagerProps> = ({ darkMode }) => {
  const [tasks, setTasks] = useState<ComputerUseTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ComputerUseTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ComputerUseTask | null>(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'automation' as any,
    priority: 'normal' as any,
    screenshots_enabled: true,
    logging_level: 'normal' as any,
    timeout_seconds: 300,
    retry_attempts: 3,
    auto_continue: false
  });

  useEffect(() => {
    loadTasks();
    // Set up periodic refresh for running tasks
    const interval = setInterval(() => {
      if (tasks.some(t => ['pending', 'running'].includes(t.status))) {
        loadTasks();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockTasks: ComputerUseTask[] = [
        {
          id: 'task-1',
          session_id: 'session-1',
          title: 'Web Scraping Task',
          description: 'Extract data from e-commerce product listings',
          status: 'completed',
          task_type: 'data_extraction',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          started_at: new Date(Date.now() - 3500000).toISOString(),
          completed_at: new Date(Date.now() - 300000).toISOString(),
          duration: 3200,
          progress: 100,
          steps_completed: 15,
          total_steps: 15,
          metadata: {
            agent_id: 'automation_agent_v2',
            priority: 'normal',
            estimated_duration: 3000,
            resources_used: ['browser', 'data_parser'],
            tags: ['scraping', 'e-commerce']
          },
          config: {
            screenshots_enabled: true,
            logging_level: 'normal',
            timeout_seconds: 300,
            retry_attempts: 3,
            auto_continue: true
          }
        },
        {
          id: 'task-2',
          session_id: 'session-2',
          title: 'UI Testing Automation',
          description: 'Run comprehensive UI tests on dashboard components',
          status: 'running',
          task_type: 'testing',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          started_at: new Date(Date.now() - 1200000).toISOString(),
          progress: 65,
          steps_completed: 13,
          total_steps: 20,
          current_step: 'Testing navigation components...',
          metadata: {
            agent_id: 'automation_agent_v2',
            priority: 'high',
            estimated_duration: 2400,
            resources_used: ['browser', 'testing_framework'],
            tags: ['testing', 'ui', 'automation']
          },
          config: {
            screenshots_enabled: true,
            logging_level: 'verbose',
            timeout_seconds: 600,
            retry_attempts: 2,
            auto_continue: true
          }
        },
        {
          id: 'task-3',
          session_id: 'session-3',
          title: 'Document Processing',
          description: 'Process and analyze batch of PDF documents',
          status: 'pending',
          task_type: 'analysis',
          created_at: new Date(Date.now() - 300000).toISOString(),
          progress: 0,
          steps_completed: 0,
          total_steps: 8,
          metadata: {
            agent_id: 'automation_agent_v2',
            priority: 'low',
            estimated_duration: 1800,
            tags: ['documents', 'analysis']
          },
          config: {
            screenshots_enabled: false,
            logging_level: 'normal',
            timeout_seconds: 900,
            retry_attempts: 1,
            auto_continue: false
          }
        }
      ];

      setTasks(mockTasks);
    } catch (error) {
      console.error('Failed to load computer use tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    try {
      const taskData = {
        session_id: `session-${Date.now()}`,
        title: newTask.title,
        description: newTask.description,
        task_type: newTask.task_type,
        instructions: newTask.description,
        config: {
          screenshots_enabled: newTask.screenshots_enabled,
          logging_level: newTask.logging_level,
          timeout_seconds: newTask.timeout_seconds,
          retry_attempts: newTask.retry_attempts,
          auto_continue: newTask.auto_continue
        }
      };

      const response = await fetch('/api/v2/computer-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Task created:', result);
        await loadTasks();
        setShowCreateModal(false);
        resetNewTaskForm();
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const resetNewTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      task_type: 'automation',
      priority: 'normal',
      screenshots_enabled: true,
      logging_level: 'normal',
      timeout_seconds: 300,
      retry_attempts: 3,
      auto_continue: false
    });
  };

  const executeTaskAction = async (task: ComputerUseTask, action: 'start' | 'pause' | 'continue' | 'cancel' | 'delete') => {
    setActionLoading(task.id);
    try {
      let response;

      switch (action) {
        case 'start':
          response = await fetch('/api/v2/computer-use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: task.session_id,
              instructions: task.description,
              task_type: task.task_type,
              config: task.config
            })
          });
          break;

        case 'continue':
          response = await fetch(`/api/v2/computer-use/${task.session_id}/continue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instructions: 'Continue with the current task'
            })
          });
          break;

        case 'cancel':
        case 'delete':
          response = await fetch(`/api/v2/computer-use/${task.session_id}`, {
            method: 'DELETE'
          });
          break;

        case 'pause':
          // Simulate pause by updating local state
          setTasks(prev => prev.map(t => 
            t.id === task.id ? { ...t, status: 'paused' as const } : t
          ));
          return;
      }

      if (response?.ok) {
        await loadTasks();
      }
    } catch (error) {
      console.error(`Failed to ${action} task:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const updateTask = async (task: ComputerUseTask, updates: Partial<ComputerUseTask>) => {
    try {
      // Update local state immediately for better UX
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, ...updates } : t
      ));

      if (selectedTask && selectedTask.id === task.id) {
        setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'automation':
        return <Zap className="w-4 h-4" />;
      case 'analysis':
        return <Activity className="w-4 h-4" />;
      case 'data_extraction':
        return <Download className="w-4 h-4" />;
      case 'testing':
        return <CheckCircle className="w-4 h-4" />;
      case 'monitoring':
        return <Eye className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'normal':
        return 'text-blue-600 bg-blue-100';
      case 'low':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false;
    }
    if (filterType !== 'all' && task.task_type !== filterType) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Computer Use Tasks 🖥️
            </h1>
            <p className={`${
              darkMode ? 'text-purple-300' : 'text-purple-600'
            }`}>
              Manage and monitor automated computer tasks - let AI handle the work! 🚀
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={loadTasks}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                darkMode 
                  ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' 
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
              darkMode 
                ? 'border-gray-600 bg-gray-700 text-white' 
                : 'border-gray-300 bg-white text-gray-900'
            } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
              darkMode 
                ? 'border-gray-600 bg-gray-700 text-white' 
                : 'border-gray-300 bg-white text-gray-900'
            } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          >
            <option value="all">All Types</option>
            <option value="automation">Automation</option>
            <option value="analysis">Analysis</option>
            <option value="data_extraction">Data Extraction</option>
            <option value="testing">Testing</option>
            <option value="monitoring">Monitoring</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Tasks', value: tasks.length, color: 'from-blue-500 to-cyan-500' },
            { label: 'Running', value: tasks.filter(t => t.status === 'running').length, color: 'from-green-500 to-emerald-500' },
            { label: 'Pending', value: tasks.filter(t => t.status === 'pending').length, color: 'from-yellow-500 to-orange-500' },
            { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: 'from-purple-500 to-pink-500' },
            { label: 'Failed', value: tasks.filter(t => t.status === 'failed').length, color: 'from-red-500 to-pink-500' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}
            >
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-90">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className={`w-8 h-8 border-2 border-t-transparent rounded-full ${
              darkMode ? 'border-purple-400' : 'border-purple-600'
            }`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`p-6 rounded-2xl border cursor-pointer transition-all hover:transform hover:scale-105 ${
                darkMode 
                  ? 'bg-gradient-to-br from-gray-800/50 to-purple-900/50 border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/20'
                  : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-200/50'
              }`}
              onClick={() => setSelectedTask(task)}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    darkMode ? 'bg-purple-900/50' : 'bg-purple-100'
                  }`}>
                    {getTypeIcon(task.task_type)}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className={`text-sm capitalize ${
                        darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.metadata.priority)}`}>
                    {task.metadata.priority}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {task.task_type}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className={`text-sm mb-4 ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {task.description}
              </p>

              {/* Progress */}
              {task.status === 'running' || task.status === 'paused' ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm ${
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Progress: {task.steps_completed}/{task.total_steps}
                    </span>
                    <span className={`text-sm ${
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {task.progress}%
                    </span>
                  </div>
                  <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
                    <motion.div
                      className="bg-purple-600 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  {task.current_step && (
                    <p className={`text-xs mt-2 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {task.current_step}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    darkMode ? 'text-purple-400' : 'text-purple-600'
                  }`}>
                    {task.duration ? `${Math.round(task.duration / 1000)}s` : '-'}
                  </div>
                  <div className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Duration
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    darkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </div>
                  <div className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Created
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {task.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeTaskAction(task, 'start');
                    }}
                    disabled={actionLoading === task.id}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Start
                  </button>
                )}
                
                {task.status === 'running' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeTaskAction(task, 'pause');
                    }}
                    disabled={actionLoading === task.id}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </button>
                )}
                
                {task.status === 'paused' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeTaskAction(task, 'continue');
                    }}
                    disabled={actionLoading === task.id}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Continue
                  </button>
                )}
                
                {['running', 'paused', 'pending'].includes(task.status) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeTaskAction(task, 'cancel');
                    }}
                    disabled={actionLoading === task.id}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      darkMode ? 'bg-red-900/50 text-red-400 hover:bg-red-900/70' : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Square className="w-3 h-3" />
                    Cancel
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                    setShowEditModal(true);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                    darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Edit className="w-3 h-3" />
                </button>
                
                {!['running', 'pending'].includes(task.status) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeTaskAction(task, 'delete');
                    }}
                    disabled={actionLoading === task.id}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      darkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          
          {filteredTasks.length === 0 && !loading && (
            <div className="col-span-full text-center p-12">
              <Monitor className={`w-16 h-16 mx-auto mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                No computer use tasks found
              </h3>
              <p className={`text-sm mb-4 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Create your first automated task to get started
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create First Task
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-6">Create New Computer Use Task</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Task Title
                      </label>
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="Enter task title..."
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'border-gray-600 bg-gray-700 text-white' 
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Task Type
                      </label>
                      <select
                        value={newTask.task_type}
                        onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value as any })}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'border-gray-600 bg-gray-700 text-white' 
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      >
                        <option value="automation">Automation</option>
                        <option value="analysis">Analysis</option>
                        <option value="data_extraction">Data Extraction</option>
                        <option value="testing">Testing</option>
                        <option value="monitoring">Monitoring</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Task Description / Instructions
                    </label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      rows={4}
                      placeholder="Describe what you want the computer to do..."
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Priority
                      </label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'border-gray-600 bg-gray-700 text-white' 
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={newTask.timeout_seconds}
                        onChange={(e) => setNewTask({ ...newTask, timeout_seconds: parseInt(e.target.value) })}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'border-gray-600 bg-gray-700 text-white' 
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Retry Attempts
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={newTask.retry_attempts}
                        onChange={(e) => setNewTask({ ...newTask, retry_attempts: parseInt(e.target.value) })}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'border-gray-600 bg-gray-700 text-white' 
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Logging Level
                    </label>
                    <select
                      value={newTask.logging_level}
                      onChange={(e) => setNewTask({ ...newTask, logging_level: e.target.value as any })}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    >
                      <option value="minimal">Minimal</option>
                      <option value="normal">Normal</option>
                      <option value="verbose">Verbose</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newTask.screenshots_enabled}
                        onChange={(e) => setNewTask({ ...newTask, screenshots_enabled: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label className={`text-sm ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Enable screenshots during execution
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newTask.auto_continue}
                        onChange={(e) => setNewTask({ ...newTask, auto_continue: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label className={`text-sm ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Auto-continue on recoverable errors
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTask}
                    disabled={!newTask.title.trim() || !newTask.description.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Task
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      darkMode ? 'bg-purple-900/50' : 'bg-purple-100'
                    }`}>
                      {getTypeIcon(selectedTask.task_type)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                      <div className="flex items-center gap-2 text-sm">
                        {getStatusIcon(selectedTask.status)}
                        <span className="capitalize">{selectedTask.status}</span>
                        <span>•</span>
                        <span>{selectedTask.task_type}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getPriorityColor(selectedTask.metadata.priority)}`}>
                          {selectedTask.metadata.priority} priority
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
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {selectedTask.description}
                      </p>
                    </div>

                    {selectedTask.error_message && (
                      <div className={`p-3 rounded-lg ${
                        darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                      }`}>
                        <h4 className="font-medium text-red-600 mb-2">Error Message</h4>
                        <p className={`text-sm ${
                          darkMode ? 'text-red-400' : 'text-red-700'
                        }`}>
                          {selectedTask.error_message}
                        </p>
                      </div>
                    )}

                    {selectedTask.current_step && (
                      <div className={`p-3 rounded-lg ${
                        darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                      }`}>
                        <h4 className="font-medium text-blue-600 mb-2">Current Step</h4>
                        <p className={`text-sm ${
                          darkMode ? 'text-blue-400' : 'text-blue-700'
                        }`}>
                          {selectedTask.current_step}
                        </p>
                      </div>
                    )}

                    <div>
                      <h3 className={`font-semibold mb-3 ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Configuration
                      </h3>
                      <div className={`p-3 rounded-lg space-y-2 ${
                        darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}>
                        <div className="flex justify-between">
                          <span className="text-sm">Screenshots:</span>
                          <span className="text-sm font-medium">
                            {selectedTask.config.screenshots_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Logging Level:</span>
                          <span className="text-sm font-medium capitalize">{selectedTask.config.logging_level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Timeout:</span>
                          <span className="text-sm font-medium">{selectedTask.config.timeout_seconds}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Retry Attempts:</span>
                          <span className="text-sm font-medium">{selectedTask.config.retry_attempts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Auto Continue:</span>
                          <span className="text-sm font-medium">
                            {selectedTask.config.auto_continue ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className={`font-semibold mb-3 ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Progress & Metrics
                      </h3>
                      
                      {selectedTask.status === 'running' || selectedTask.status === 'paused' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${
                              darkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              Steps: {selectedTask.steps_completed}/{selectedTask.total_steps}
                            </span>
                            <span className={`text-sm font-medium ${
                              darkMode ? 'text-purple-400' : 'text-purple-600'
                            }`}>
                              {selectedTask.progress}%
                            </span>
                          </div>
                          <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3`}>
                            <div
                              className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${selectedTask.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-3 rounded-lg text-center ${
                            darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                          }`}>
                            <div className={`text-lg font-bold ${
                              darkMode ? 'text-purple-400' : 'text-purple-600'
                            }`}>
                              {selectedTask.steps_completed}
                            </div>
                            <div className={`text-xs ${
                              darkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Steps Completed
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg text-center ${
                            darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                          }`}>
                            <div className={`text-lg font-bold ${
                              darkMode ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                              {selectedTask.duration ? `${Math.round(selectedTask.duration / 1000)}s` : '-'}
                            </div>
                            <div className={`text-xs ${
                              darkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Duration
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className={`font-semibold mb-3 ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Timeline
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <div>
                            <div className="text-sm font-medium">Created</div>
                            <div className={`text-xs ${
                              darkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {new Date(selectedTask.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {selectedTask.started_at && (
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <div>
                              <div className="text-sm font-medium">Started</div>
                              <div className={`text-xs ${
                                darkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {new Date(selectedTask.started_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedTask.completed_at && (
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              selectedTask.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <div className="text-sm font-medium">
                                {selectedTask.status === 'completed' ? 'Completed' : 'Failed'}
                              </div>
                              <div className={`text-xs ${
                                darkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {new Date(selectedTask.completed_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedTask.metadata.tags && selectedTask.metadata.tags.length > 0 && (
                      <div>
                        <h3 className={`font-semibold mb-3 ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Tags
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.metadata.tags.map((tag, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 text-xs rounded-full ${
                                darkMode 
                                  ? 'bg-purple-900/50 text-purple-300' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  {selectedTask.status === 'pending' && (
                    <button
                      onClick={() => {
                        executeTaskAction(selectedTask, 'start');
                        setSelectedTask(null);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Task
                    </button>
                  )}

                  {selectedTask.status === 'running' && (
                    <button
                      onClick={() => {
                        executeTaskAction(selectedTask, 'pause');
                        setSelectedTask(null);
                      }}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      Pause Task
                    </button>
                  )}

                  {selectedTask.status === 'paused' && (
                    <button
                      onClick={() => {
                        executeTaskAction(selectedTask, 'continue');
                        setSelectedTask(null);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Continue Task
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingTask(selectedTask);
                      setShowEditModal(true);
                      setSelectedTask(null);
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Edit className="w-4 h-4" />
                    Edit Task
                  </button>

                  {!['running', 'pending'].includes(selectedTask.status) && (
                    <button
                      onClick={() => {
                        executeTaskAction(selectedTask, 'delete');
                        setSelectedTask(null);
                      }}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        darkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Task
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ComputerUseManager;