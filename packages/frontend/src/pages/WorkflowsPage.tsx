import React, { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  ConnectionMode,
  Panel,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { WorkflowTemplatesHub } from "@/components/workflow/WorkflowTemplatesHub";

interface WorkflowsPageProps {
  token: string;
  onBack: () => void;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  workflow_data: {
    nodes: Node[];
    edges: Edge[];
  };
  category: string;
  tags: string[];
  is_active: boolean;
  is_template?: boolean;
  created_at: string;
  updated_at: string;
}


const WorkflowBuilder: React.FC<{
  workflow: Workflow | null;
  onSave: (workflow: any) => void;
  token: string;
}> = ({ workflow, onSave }) => {
  const [nodes, , onNodesChange] = useNodesState(workflow?.workflow_data?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.workflow_data?.edges || []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSave = () => {
    const workflowData = {
      ...workflow,
      workflow_data: { nodes, edges }
    };
    onSave(workflowData);
  };

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Workflow
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const WorkflowsList: React.FC<{
  workflows: Workflow[];
  onEdit: (workflow: Workflow) => void;
  onDelete: (id: number) => void;
  searchTerm: string;
  selectedCategory: string;
}> = ({ workflows, onEdit, onDelete, searchTerm, selectedCategory }) => {
  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || workflow.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredWorkflows.map((workflow) => (
        <div key={workflow.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(workflow)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(workflow.id)}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
          <p className="text-slate-300 text-sm mb-4">{workflow.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {workflow.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Category: {workflow.category}</span>
            <span className={workflow.is_active ? 'text-green-400' : 'text-red-400'}>
              {workflow.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ExecutionMonitor: React.FC<{
  executions: any[];
  loadingExecutions: boolean;
}> = ({ executions, loadingExecutions }) => {
  const statusPill = (status: string) => {
    const statusColors = {
      completed: 'bg-green-500',
      running: 'bg-blue-500',
      failed: 'bg-red-500',
      pending: 'bg-yellow-500'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[status as keyof typeof statusColors] || 'bg-gray-500'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Execution Monitor</h2>
      
      {loadingExecutions ? (
        <div className="text-center text-slate-400">Loading executions...</div>
      ) : (
        <div className="space-y-4">
          {executions.length === 0 ? (
            <div className="text-center text-slate-500">No executions yet.</div>
          ) : (
            <div className="space-y-3">
              {executions.map(execution => {
                const duration = (execution.started_at && execution.completed_at) 
                  ? ((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 1000).toFixed(2) + 's'
                  : '—';

                return (
                  <div key={execution.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{execution.id.slice(0, 8)}</span>
                      {statusPill(execution.status)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-400">
                      <div>Start: {execution.started_at ? new Date(execution.started_at).toLocaleTimeString() : '—'}</div>
                      <div>End: {execution.completed_at ? new Date(execution.completed_at).toLocaleTimeString() : '—'}</div>
                      <div>Duration: {duration}</div>
                    </div>
                    {execution.error && (
                      <div className="mt-2 text-red-400 text-sm truncate" title={execution.error}>
                        {execution.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="mt-6 p-4 bg-slate-800/60 border border-slate-700 rounded">
            <div className="text-sm text-slate-400 mb-2">Auto-refresh every 10s (MVP polling)</div>
            <div className="text-sm text-slate-400">Upcoming Monitoring Enhancements:</div>
            <ul className="mt-2 text-sm text-slate-300 space-y-1 list-disc list-inside">
              <li>Real-time streaming via SSE/WebSocket</li>
              <li>Node-level progress & timeline visualization</li>
              <li>Log streaming with auto-scroll & filters</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkflowsPage: React.FC<WorkflowsPageProps> = ({ token, onBack }) => {
  const [activeView, setActiveView] = useState<'designer' | 'monitor' | 'templates'>('templates');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [executions, setExecutions] = useState<any[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  // Fetch workflows
  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  };

  // Fetch executions
  const fetchExecutions = async () => {
    setLoadingExecutions(true);
    try {
      const response = await fetch('/api/workflows/executions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoadingExecutions(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    if (activeView === 'monitor') {
      fetchExecutions();
      const interval = setInterval(fetchExecutions, 10000); // Auto-refresh every 10s
      return () => clearInterval(interval);
    }
  }, [activeView]);

  const handleSaveWorkflow = async (workflowData: any) => {
    try {
      const url = workflowData.id ? `/api/workflows/${workflowData.id}` : '/api/workflows';
      const method = workflowData.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(workflowData)
      });

      if (response.ok) {
        fetchWorkflows();
        setSelectedWorkflow(null);
        setActiveView('templates');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (id: number) => {
    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
  };

  const categories = ['all', ...Array.from(new Set(workflows.map(w => w.category)))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="text-2xl font-bold text-white">Workflow Management</h1>
            </div>
            
            <nav className="flex gap-2">
              {[
                { key: 'templates', label: 'Templates', icon: '📋' },
                { key: 'designer', label: 'Designer', icon: '🎨' },
                { key: 'monitor', label: 'Monitor', icon: '📊' }
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveView(key as any)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    activeView === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {activeView === 'designer' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSelectedWorkflow(null);
                  setActiveView('designer');
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + New Workflow
              </button>
            </div>

            {selectedWorkflow ? (
              <ReactFlowProvider>
                <div className="h-[600px] border border-slate-700 rounded-lg overflow-hidden">
                  <WorkflowBuilder
                    workflow={selectedWorkflow}
                    onSave={handleSaveWorkflow}
                    token={token}
                  />
                </div>
              </ReactFlowProvider>
            ) : (
              <WorkflowsList
                workflows={workflows}
                onEdit={setSelectedWorkflow}
                onDelete={handleDeleteWorkflow}
                searchTerm={searchTerm}
                selectedCategory={selectedCategory}
              />
            )}
          </div>
        )}

        {activeView === 'monitor' && (
          <ExecutionMonitor
            executions={executions}
            loadingExecutions={loadingExecutions}
          />
        )}

        {activeView === 'templates' && (
          <div className="p-6">
            <WorkflowTemplatesHub />
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPage;