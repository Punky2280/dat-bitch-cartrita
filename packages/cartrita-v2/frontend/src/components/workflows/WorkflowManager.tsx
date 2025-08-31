'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Play,
  Pause,
  Square,
  Settings,
  Plus,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Copy,
  MoreVertical,
  Zap,
  Users,
  Calendar,
  Timer
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'delay';
  config: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  started_at: string;
  completed_at?: string;
  progress: number;
  current_step?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  executions: WorkflowExecution[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
  tags: string[];
}

interface WorkflowManagerProps {
  darkMode: boolean;
}

const WorkflowManager: React.FC<WorkflowManagerProps> = ({ darkMode }) => {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const [showExecutions, setShowExecutions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/v2/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      // Mock data for development
      setWorkflows([
        {
          id: 'wf-1',
          name: 'Daily Content Pipeline',
          description: 'Automated content creation and social media posting workflow',
          category: 'Content',
          steps: [
            { id: 'step-1', name: 'Generate Blog Ideas', type: 'agent', config: {}, status: 'completed' },
            { id: 'step-2', name: 'Write Article', type: 'agent', config: {}, status: 'running' },
            { id: 'step-3', name: 'Create Social Posts', type: 'agent', config: {}, status: 'pending' },
            { id: 'step-4', name: 'Schedule Posts', type: 'tool', config: {}, status: 'pending' }
          ],
          executions: [
            {
              id: 'exec-1',
              workflow_id: 'wf-1',
              status: 'running',
              started_at: new Date().toISOString(),
              progress: 45,
              current_step: 'step-2'
            }
          ],
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-20T15:30:00Z',
          is_active: true,
          tags: ['content', 'automation', 'social-media']
        },
        {
          id: 'wf-2',
          name: 'Customer Support Pipeline',
          description: 'Automated ticket triage and response system',
          category: 'Support',
          steps: [
            { id: 'step-1', name: 'Analyze Ticket', type: 'agent', config: {}, status: 'completed' },
            { id: 'step-2', name: 'Categorize Issue', type: 'agent', config: {}, status: 'completed' },
            { id: 'step-3', name: 'Generate Response', type: 'agent', config: {}, status: 'completed' },
            { id: 'step-4', name: 'Send Reply', type: 'tool', config: {}, status: 'completed' }
          ],
          executions: [
            {
              id: 'exec-2',
              workflow_id: 'wf-2',
              status: 'completed',
              started_at: '2024-01-20T09:00:00Z',
              completed_at: '2024-01-20T09:15:00Z',
              progress: 100
            }
          ],
          created_at: '2024-01-10T14:00:00Z',
          updated_at: '2024-01-20T16:45:00Z',
          is_active: true,
          tags: ['support', 'automation', 'customer-service']
        }
      ]);
    }
    setLoading(false);
  };

  const executeWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/v2/workflows/${workflowId}/execute`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchWorkflows(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return darkMode ? 'text-blue-400' : 'text-blue-600';
      case 'completed':
        return darkMode ? 'text-green-400' : 'text-green-600';
      case 'failed':
        return darkMode ? 'text-red-400' : 'text-red-600';
      case 'paused':
        return darkMode ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return darkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Content': 'from-purple-500 to-pink-500',
      'Support': 'from-blue-500 to-cyan-500',
      'Analytics': 'from-green-500 to-emerald-500',
      'Marketing': 'from-orange-500 to-red-500',
      'Development': 'from-indigo-500 to-purple-500'
    };
    return colors[category as keyof typeof colors] || 'from-gray-500 to-gray-600';
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Workflow Automation 🔥
              </h1>
              <p className={`${
                darkMode ? 'text-purple-300' : 'text-purple-600'
              }`}>
                Automate your tasks like a boss! Set it and forget it, boo! ⚡️
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:scale-105 ${
                darkMode 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-200/50'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5" />
              Create Workflow
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { 
              icon: <Workflow className="w-5 h-5" />, 
              label: 'Total Workflows', 
              value: workflows.length,
              color: 'from-blue-500 to-blue-600'
            },
            { 
              icon: <Play className="w-5 h-5" />, 
              label: 'Running', 
              value: workflows.filter(w => w.executions.some(e => e.status === 'running')).length,
              color: 'from-green-500 to-green-600'
            },
            { 
              icon: <CheckCircle className="w-5 h-5" />, 
              label: 'Completed Today', 
              value: workflows.reduce((sum, w) => sum + w.executions.filter(e => e.status === 'completed').length, 0),
              color: 'from-purple-500 to-purple-600'
            },
            { 
              icon: <Zap className="w-5 h-5" />, 
              label: 'Success Rate', 
              value: '94%',
              color: 'from-yellow-500 to-orange-600'
            }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}
            >
              <div className="flex items-center justify-between text-white">
                <div>
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs opacity-90">{stat.label}</div>
                </div>
                {stat.icon}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {workflows.map((workflow, index) => (
          <motion.div
            key={workflow.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`p-6 rounded-2xl border-2 transition-all hover:transform hover:scale-105 cursor-pointer ${
              darkMode 
                ? 'bg-gradient-to-br from-gray-800/50 to-purple-900/50 border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/20'
                : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-200/50'
            }`}
            onClick={() => setSelectedWorkflow(workflow)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(workflow.category)} flex items-center justify-center text-white`}>
                  <Workflow className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {workflow.name}
                  </h3>
                  <div className={`text-sm ${
                    darkMode ? 'text-purple-400' : 'text-purple-600'
                  }`}>
                    {workflow.category}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {workflow.is_active && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
                <MoreVertical className={`w-5 h-5 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`} />
              </div>
            </div>

            {/* Description */}
            <p className={`text-sm mb-4 ${
              darkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {workflow.description}
            </p>

            {/* Progress & Status */}
            {workflow.executions.length > 0 && (
              <div className="mb-4">
                {workflow.executions.map((execution, idx) => (
                  <div key={execution.id} className="mb-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className={`capitalize ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                      </div>
                      <span className={`${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {execution.progress}%
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${execution.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Steps Preview */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  STEPS ({workflow.steps.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {workflow.steps.slice(0, 8).map((step, idx) => (
                  <div
                    key={step.id}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      step.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : step.status === 'running'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : step.status === 'failed'
                        ? 'bg-red-500 text-white'
                        : (darkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500')
                    }`}
                  >
                    {idx + 1}
                  </div>
                ))}
                {workflow.steps.length > 8 && (
                  <span className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    +{workflow.steps.length - 8}
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-4">
              {workflow.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
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

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    executeWorkflow(workflow.id);
                  }}
                  className={`p-2 rounded-lg transition-all hover:scale-110 ${
                    darkMode 
                      ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Play className="w-4 h-4" />
                </motion.button>
                <motion.button
                  className={`p-2 rounded-lg transition-all hover:scale-110 ${
                    darkMode 
                      ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
                <motion.button
                  className={`p-2 rounded-lg transition-all hover:scale-110 ${
                    darkMode 
                      ? 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Copy className="w-4 h-4" />
                </motion.button>
              </div>
              
              <div className="flex items-center gap-1 text-xs">
                <Calendar className={`w-3 h-3 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <span className={`${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {new Date(workflow.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Workflow Detail Modal */}
      <AnimatePresence>
        {selectedWorkflow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedWorkflow(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${
                darkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-purple-900' 
                  : 'bg-gradient-to-br from-white to-purple-50'
              } shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(selectedWorkflow.category)} flex items-center justify-center text-white`}>
                    <Workflow className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {selectedWorkflow.name}
                    </h2>
                    <div className={`text-sm ${
                      darkMode ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      {selectedWorkflow.category} • {selectedWorkflow.steps.length} steps
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWorkflow(null)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Workflow Steps */}
              <div className="space-y-4">
                <h3 className={`font-semibold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Workflow Steps
                </h3>
                <div className="space-y-3">
                  {selectedWorkflow.steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-xl ${
                        darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          step.status === 'completed'
                            ? 'bg-green-500 text-white'
                            : step.status === 'running'
                            ? 'bg-blue-500 text-white'
                            : step.status === 'failed'
                            ? 'bg-red-500 text-white'
                            : (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600')
                        }`}>
                          {index + 1}
                        </div>
                        {getStatusIcon(step.status)}
                      </div>
                      
                      <div className="flex-1">
                        <div className={`font-medium ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {step.name}
                        </div>
                        <div className={`text-sm capitalize ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {step.type} • {step.status}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowManager;