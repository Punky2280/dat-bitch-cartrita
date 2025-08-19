import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Workflow, 
  Play, 
  Pause, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  Filter,
  Search,
  Trash2,
  Edit3
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const WorkflowsPage: React.FC = () => {
  const { state, actions } = useApp();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  useEffect(() => {
    actions.loadWorkflows();
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    await actions.createWorkflow({ name: newWorkflowName, description: newWorkflowDescription });
    setNewWorkflowName('');
    setNewWorkflowDescription('');
    setShowCreateForm(false);
  };

  const handleDeleteWorkflow = (id: string) => {
    if (window.confirm('Delete this workflow?')) actions.deleteWorkflow(id);
  };

  const handleRunWorkflow = (id: string) => actions.runWorkflow(id);
  const handlePauseWorkflow = (id: string) => actions.pauseWorkflow(id);
  const handleResumeWorkflow = (id: string) => actions.resumeWorkflow(id);

  const filteredWorkflows = state.workflows.workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Workflows</h1>
          <p className="text-slate-400">Automate tasks with intelligent workflows</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search workflows..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-white text-sm placeholder-slate-400 outline-none"
            />
          </div>
          <button className="p-2 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setShowCreateForm(true)} className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all">
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Create New Workflow</h3>
          <form onSubmit={handleCreateWorkflow} className="space-y-4">
            <input type="text" value={newWorkflowName} onChange={e => setNewWorkflowName(e.target.value)} placeholder="Workflow Name" className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400" required />
            <textarea value={newWorkflowDescription} onChange={e => setNewWorkflowDescription(e.target.value)} placeholder="Description" rows={2} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400" />
            <div className="flex items-center space-x-3">
              <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-medium">Create</button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {state.workflows.loading ? (
            <div className="text-center py-12 text-slate-400">Loading workflows...</div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No workflows found.</div>
          ) : filteredWorkflows.map((workflow) => (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                    <Workflow className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{workflow.name}</h3>
                    <p className="text-sm text-slate-400 mb-3">{workflow.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Last: {workflow.lastRun ? new Date(workflow.lastRun).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Next: {workflow.nextRun ? new Date(workflow.nextRun).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {workflow.status === 'running' ? (
                    <button onClick={() => handlePauseWorkflow(workflow.id)} className="p-2 bg-orange-900/30 text-orange-400 rounded-lg hover:bg-orange-900/50 transition-colors" title="Pause Workflow"><Pause className="w-4 h-4" /></button>
                  ) : workflow.status === 'paused' ? (
                    <button onClick={() => handleResumeWorkflow(workflow.id)} className="p-2 bg-emerald-900/30 text-emerald-400 rounded-lg hover:bg-emerald-900/50 transition-colors" title="Resume Workflow"><Play className="w-4 h-4" /></button>
                  ) : (
                    <button onClick={() => handleRunWorkflow(workflow.id)} className="p-2 bg-cyan-900/30 text-cyan-400 rounded-lg hover:bg-cyan-900/50 transition-colors" title="Run Workflow"><Play className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => handleDeleteWorkflow(workflow.id)} className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors" title="Delete Workflow"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {/* Executions and Success Rate */}
              <div className="flex items-center space-x-6 text-xs text-slate-400 mt-2">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span>Executions: {workflow.executions?.total ?? 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-orange-400" />
                  <span>Failed: {workflow.executions?.failed ?? 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span>Success Rate: {workflow.executions?.successful && workflow.executions?.total ? `${Math.round((workflow.executions.successful / workflow.executions.total) * 100)}%` : 'N/A'}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" />
              System Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Workflow Engine</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-sm text-emerald-400">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Queue Status</span>
                <span className="text-sm text-white">3 pending</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Active Workflows</span>
                <span className="text-sm text-white">2</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                <div>
                  <p className="text-sm text-white">Email Processing completed</p>
                  <p className="text-xs text-slate-400">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="w-4 h-4 text-blue-400 mt-1" />
                <div>
                  <p className="text-sm text-white">Data Backup scheduled</p>
                  <p className="text-xs text-slate-400">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-1" />
                <div>
                  <p className="text-sm text-white">Report Generation warning</p>
                  <p className="text-xs text-slate-400">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsPage;