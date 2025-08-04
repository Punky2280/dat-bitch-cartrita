import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

interface NodeType {
  type: string;
  name: string;
  icon: string;
  description: string;
}

interface NodeCategories {
  [key: string]: NodeType[];
}

const WorkflowBuilder: React.FC<{
  workflow: Workflow | null;
  onSave: (workflow: any) => void;
  token: string;
  nodeTypes: NodeCategories;
}> = ({ workflow, onSave, token, nodeTypes }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow?.workflow_data.nodes || []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow?.workflow_data.edges || []
  );
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const { project } = useReactFlow();

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const nodeTypeData = event.dataTransfer.getData('application/reactflow');

      if (nodeTypeData && reactFlowBounds) {
        const nodeType: NodeType = JSON.parse(nodeTypeData);
        const position = project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        const newNode: Node = {
          id: `${nodeType.type}_${Date.now()}`,
          type: 'default',
          position,
          data: {
            label: nodeType.name,
            nodeType: nodeType.type,
            icon: nodeType.icon,
            description: nodeType.description,
            config: getDefaultConfig(nodeType.type),
          },
          style: {
            background: getNodeColor(nodeType.type),
            border: '2px solid #1a1a1a',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#ffffff',
            width: 180,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          },
        };

        setNodes(nds => nds.concat(newNode));
      }
    },
    [project, setNodes]
  );

  const getNodeColor = (nodeType: string): string => {
    if (nodeType.startsWith('trigger'))
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    if (nodeType.startsWith('ai-'))
      return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    if (nodeType.startsWith('rag-'))
      return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    if (nodeType.startsWith('mcp-'))
      return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
    if (nodeType.startsWith('http-') || nodeType.includes('integration'))
      return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
    if (nodeType.startsWith('logic-'))
      return 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
    if (nodeType.startsWith('data-'))
      return 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  const getDefaultConfig = (nodeType: string): any => {
    const configs: { [key: string]: any } = {
      'ai-gpt4': {
        model: 'gpt-4',
        prompt: 'You are a helpful assistant. Please respond to: {{input}}',
        temperature: 0.7,
      },
      'ai-claude': {
        model: 'claude-3-sonnet',
        prompt: 'You are a helpful assistant. Please respond to: {{input}}',
        temperature: 0.7,
      },
      'http-request': {
        method: 'GET',
        url: 'https://api.example.com',
        headers: {},
      },
      'rag-search': { query: '{{input}}', top_k: 5 },
      'logic-condition': {
        condition: 'data.value > 0',
        true_value: 'positive',
        false_value: 'negative',
      },
    };
    return configs[nodeType] || {};
  };

  const handleSave = async () => {
    const workflowData = {
      name: workflow?.name || 'New Workflow',
      description: workflow?.description || '',
      workflow_data: { nodes, edges },
      category: workflow?.category || 'custom',
      tags: workflow?.tags || [],
    };

    onSave(workflowData);
  };

  const handleExecute = async () => {
    if (!workflow?.id) return;

    setIsExecuting(true);
    setExecutionLogs([]);
    setShowLogs(true);

    try {
      const response = await fetch(`/api/workflows/${workflow.id}/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_data: { message: 'Test execution' } }),
      });

      const result = await response.json();

      if (result.success) {
        // Poll for execution status
        pollExecutionStatus(result.execution.id);
      }
    } catch (error) {
      // Handle execution error (e.g., set error state or show notification)
      setIsExecuting(false);
    }
  };

  const pollExecutionStatus = async (executionId: string) => {
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.success) {
        const execution = result.execution;

        if (execution.status === 'running') {
          // Continue polling
          setTimeout(() => pollExecutionStatus(executionId), 1000);
        } else {
          // Execution completed
          setIsExecuting(false);
          setExecutionLogs(execution.execution_logs || []);
        }
      }
    } catch (error) {
      // Error handling: optionally set an error state or show a notification here
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex">
      {/* Node Palette */}
      <div
        className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 ${
          showNodePalette ? 'w-80' : 'w-16'
        }`}
      >
        <div className="p-4">
          <button
            onClick={() => setShowNodePalette(!showNodePalette)}
            className="w-full flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <span className="text-xl">🧩</span>
            {showNodePalette && (
              <span className="ml-2 font-semibold">Node Palette</span>
            )}
          </button>
        </div>

        {showNodePalette && (
          <div className="px-4 pb-4 overflow-y-auto h-full">
            {Object.entries(nodeTypes).map(([category, types]) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {types.map(nodeType => (
                    <div
                      key={nodeType.type}
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData(
                          'application/reactflow',
                          JSON.stringify(nodeType)
                        );
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-grab active:cursor-grabbing transition-colors border border-gray-600 hover:border-blue-400"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{nodeType.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {nodeType.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {nodeType.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Workflow Canvas */}
      <div className="flex-1 relative">
        <div ref={reactFlowWrapper} className="w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            connectionMode={ConnectionMode.Loose}
            fitView
            style={{ background: '#111827' }}
          >
            <Background
              color="#374151"
              gap={20}
              size={1}
              style={{ backgroundColor: '#111827' }}
            />
            <Controls />
            <MiniMap
              style={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
              }}
              nodeColor={() => '#3B82F6'}
            />

            {/* Top Toolbar */}
            <Panel position="top-right" className="flex space-x-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center space-x-2"
              >
                <span>💾</span>
                <span>Save</span>
              </button>

              <button
                onClick={handleExecute}
                disabled={isExecuting || !workflow?.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center space-x-2"
              >
                <span>{isExecuting ? '⏳' : '▶️'}</span>
                <span>{isExecuting ? 'Executing...' : 'Execute'}</span>
              </button>

              <button
                onClick={() => setShowLogs(!showLogs)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center space-x-2"
              >
                <span>📋</span>
                <span>Logs</span>
              </button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Execution Logs Panel */}
        {showLogs && (
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gray-800 border-t border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Execution Logs
              </h3>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto h-40 space-y-2">
              {executionLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm ${
                    log.level === 'error'
                      ? 'bg-red-900/50 text-red-200'
                      : log.level === 'success'
                        ? 'bg-green-900/50 text-green-200'
                        : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  <span className="text-gray-400 text-xs">{log.timestamp}</span>
                  <span className="ml-2 font-medium">{log.message}</span>
                  {log.nodeId && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({log.nodeId})
                    </span>
                  )}
                </div>
              ))}
              {executionLogs.length === 0 && (
                <div className="text-gray-400 text-center py-8">
                  No execution logs yet. Run a workflow to see logs here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkflowsPage: React.FC<WorkflowsPageProps> = ({
  token,
  onBack,
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<Workflow[]>([]);
  const [nodeTypes, setNodeTypes] = useState<NodeCategories>({});
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null
  );
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workflowsRes, templatesRes, nodeTypesRes] = await Promise.all([
        fetch('/api/workflows', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/workflows/templates', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/workflows/node-types', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [workflowsData, templatesData, nodeTypesData] = await Promise.all([
        workflowsRes.json(),
        templatesRes.json(),
        nodeTypesRes.json(),
      ]);

      if (workflowsData.success) setWorkflows(workflowsData.workflows);
      if (templatesData.success) setTemplates(templatesData.templates);
      if (nodeTypesData.success) setNodeTypes(nodeTypesData.nodeTypes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    const newWorkflow: Workflow = {
      id: 0,
      name: 'New Workflow',
      description: 'A new workflow',
      workflow_data: { nodes: [], edges: [] },
      category: 'custom',
      tags: [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSelectedWorkflow(newWorkflow);
    setShowBuilder(true);
  };

  const handleUseTemplate = (template: Workflow) => {
    const newWorkflow: Workflow = {
      ...template,
      id: 0,
      name: `${template.name} (Copy)`,
      is_template: false,
    };
    setSelectedWorkflow(newWorkflow);
    setShowBuilder(true);
  };

  const handleSaveWorkflow = async (workflowData: any) => {
    try {
      const url = selectedWorkflow?.id
        ? `/api/workflows/${selectedWorkflow.id}`
        : '/api/workflows';
      const method = selectedWorkflow?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowData),
      });

      const result = await response.json();

      if (result.success) {
        loadData();
        setShowBuilder(false);
        setSelectedWorkflow(null);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || workflow.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(workflows.map(w => w.category)), 'all'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white text-xl mt-4">Loading Workflow System...</p>
        </div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <ReactFlowProvider>
        <WorkflowBuilder
          workflow={selectedWorkflow}
          onSave={handleSaveWorkflow}
          token={token}
          nodeTypes={nodeTypes}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                🚀 Workflow Automation
              </h1>
              <p className="text-gray-400 mt-1">
                Build powerful AI workflows, RAG pipelines, and multi-agent
                automations
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateWorkflow}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Create Workflow</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories
              .filter(c => c !== 'all')
              .map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
          </select>
        </div>

        {/* Templates Section */}
        {templates.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
              <span>📚</span>
              <span>Workflow Templates</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {template.name}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {template.description}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-600 text-blue-100 rounded-full text-xs font-medium">
                      {template.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition-all transform hover:scale-105"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Workflows */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
            <span>⚙️</span>
            <span>Your Workflows</span>
            <span className="text-sm font-normal text-gray-400">
              ({filteredWorkflows.length})
            </span>
          </h2>

          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">
                {searchTerm || selectedCategory !== 'all'
                  ? 'No workflows match your filters'
                  : 'No workflows yet'}
              </div>
              <button
                onClick={handleCreateWorkflow}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                Create Your First Workflow
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkflows.map(workflow => (
                <div
                  key={workflow.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {workflow.name}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {workflow.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          workflow.is_active ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      ></span>
                      <span className="px-3 py-1 bg-purple-600 text-purple-100 rounded-full text-xs font-medium">
                        {workflow.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {workflow.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500 mb-4">
                    <div>
                      Nodes: {workflow.workflow_data.nodes?.length || 0}
                    </div>
                    <div>
                      Updated:{' '}
                      {new Date(workflow.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setShowBuilder(true);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
