/**
 * Workflow Builder Component
 * Visual workflow creation and automation interface
 */
'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  DocumentTextIcon,
  BoltIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
  EyeIcon,
  CloudIcon,
  DatabaseIcon,
  LinkIcon,
  BeakerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useWorkflowStore } from '@/stores';

interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  result?: any;
  error?: string;
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceOutput: string;
  targetInput: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  lastRun?: Date;
  status: 'draft' | 'running' | 'completed' | 'error';
}

type NodeType = 
  | 'trigger'
  | 'ai-agent'
  | 'data-source'
  | 'processor'
  | 'condition'
  | 'output'
  | 'api-call'
  | 'database'
  | 'transformation';

const NODE_TYPES = [
  {
    type: 'trigger' as NodeType,
    name: 'Trigger',
    description: 'Start workflow execution',
    icon: PlayIcon,
    color: 'bg-green-500',
    inputs: [],
    outputs: ['trigger']
  },
  {
    type: 'ai-agent' as NodeType,
    name: 'AI Agent',
    description: 'Process with AI capabilities',
    icon: CpuChipIcon,
    color: 'bg-blue-500',
    inputs: ['data'],
    outputs: ['result', 'analysis']
  },
  {
    type: 'data-source' as NodeType,
    name: 'Data Source',
    description: 'Fetch data from external sources',
    icon: CloudIcon,
    color: 'bg-purple-500',
    inputs: ['query'],
    outputs: ['data']
  },
  {
    type: 'processor' as NodeType,
    name: 'Data Processor',
    description: 'Transform and process data',
    icon: Cog6ToothIcon,
    color: 'bg-orange-500',
    inputs: ['input'],
    outputs: ['processed']
  },
  {
    type: 'condition' as NodeType,
    name: 'Condition',
    description: 'Branch workflow based on conditions',
    icon: ArrowRightIcon,
    color: 'bg-yellow-500',
    inputs: ['input'],
    outputs: ['true', 'false']
  },
  {
    type: 'api-call' as NodeType,
    name: 'API Call',
    description: 'Make external API requests',
    icon: LinkIcon,
    color: 'bg-indigo-500',
    inputs: ['params'],
    outputs: ['response']
  },
  {
    type: 'database' as NodeType,
    name: 'Database',
    description: 'Store or retrieve database records',
    icon: DatabaseIcon,
    color: 'bg-gray-500',
    inputs: ['query', 'data'],
    outputs: ['result']
  },
  {
    type: 'output' as NodeType,
    name: 'Output',
    description: 'Final workflow output',
    icon: DocumentTextIcon,
    color: 'bg-red-500',
    inputs: ['data'],
    outputs: []
  }
];

const SAMPLE_WORKFLOWS: Workflow[] = [
  {
    id: 'workflow_1',
    name: 'Document Analysis Pipeline',
    description: 'Automated document processing and analysis',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        name: 'Document Upload',
        position: { x: 100, y: 200 },
        config: { event: 'file_upload' },
        inputs: [],
        outputs: ['file']
      },
      {
        id: 'ai_1',
        type: 'ai-agent',
        name: 'Text Extraction',
        position: { x: 300, y: 200 },
        config: { agent: 'text-extractor' },
        inputs: ['file'],
        outputs: ['text']
      },
      {
        id: 'ai_2',
        type: 'ai-agent',
        name: 'Sentiment Analysis',
        position: { x: 500, y: 150 },
        config: { agent: 'sentiment-analyzer' },
        inputs: ['text'],
        outputs: ['sentiment']
      },
      {
        id: 'database_1',
        type: 'database',
        name: 'Save Results',
        position: { x: 700, y: 200 },
        config: { table: 'document_analysis' },
        inputs: ['sentiment', 'text'],
        outputs: ['saved']
      }
    ],
    connections: [
      { id: 'conn_1', source: 'trigger_1', target: 'ai_1', sourceOutput: 'file', targetInput: 'file' },
      { id: 'conn_2', source: 'ai_1', target: 'ai_2', sourceOutput: 'text', targetInput: 'text' },
      { id: 'conn_3', source: 'ai_2', target: 'database_1', sourceOutput: 'sentiment', targetInput: 'sentiment' }
    ],
    createdAt: new Date('2024-01-15'),
    status: 'completed'
  }
];

export default function WorkflowBuilder() {
  const { workflows, isRunning, executeWorkflow, createWorkflow, updateWorkflow } = useWorkflowStore();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [workflowList, setWorkflowList] = useState<Workflow[]>(SAMPLE_WORKFLOWS);
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  const handleDragStart = (nodeType: NodeType) => {
    setDraggedNodeType(nodeType);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType || !selectedWorkflow) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeTypeInfo = NODE_TYPES.find(n => n.type === draggedNodeType);
    if (!nodeTypeInfo) {
      return;
    }

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: draggedNodeType,
      name: nodeTypeInfo.name,
      position: { x, y },
      config: {},
      inputs: nodeTypeInfo.inputs,
      outputs: nodeTypeInfo.outputs,
      status: 'idle'
    };

    setSelectedWorkflow(prev => {
      if (!prev) {
        return null;
      }
      return {
        ...prev,
        nodes: [...prev.nodes, newNode]
      };
    });

    setDraggedNodeType(null);
  }, [draggedNodeType, selectedWorkflow]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeNode = (nodeId: string) => {
    if (!selectedWorkflow) return;

    setSelectedWorkflow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: prev.nodes.filter(node => node.id !== nodeId),
        connections: prev.connections.filter(
          conn => conn.source !== nodeId && conn.target !== nodeId
        )
      };
    });

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const runWorkflow = async (workflow: Workflow) => {
    if (isRunning) return;

    try {
      // Simulate workflow execution
      setSelectedWorkflow(prev => {
        if (!prev) return null;
        return { ...prev, status: 'running' };
      });

      const nodes = [...workflow.nodes];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        
        // Update node status
        setSelectedWorkflow(prev => {
          if (!prev) return null;
          return {
            ...prev,
            nodes: prev.nodes.map(n => 
              n.id === node.id 
                ? { ...n, status: 'running', progress: 0 }
                : n
            )
          };
        });

        // Simulate progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setSelectedWorkflow(prev => {
            if (!prev) return null;
            return {
              ...prev,
              nodes: prev.nodes.map(n => 
                n.id === node.id 
                  ? { ...n, progress }
                  : n
              )
            };
          });
        }

        // Complete node
        setSelectedWorkflow(prev => {
          if (!prev) return null;
          return {
            ...prev,
            nodes: prev.nodes.map(n => 
              n.id === node.id 
                ? { 
                    ...n, 
                    status: 'completed', 
                    progress: 100,
                    result: generateMockResult(node.type)
                  }
                : n
            )
          };
        });
      }

      setSelectedWorkflow(prev => {
        if (!prev) return null;
        return { ...prev, status: 'completed', lastRun: new Date() };
      });

      await executeWorkflow(workflow.id);
    } catch (error) {
      setSelectedWorkflow(prev => {
        if (!prev) return null;
        return { ...prev, status: 'error' };
      });
    }
  };

  const generateMockResult = (nodeType: NodeType) => {
    switch (nodeType) {
      case 'ai-agent':
        return {
          confidence: Math.random() * 0.3 + 0.7,
          processingTime: (Math.random() * 5 + 1).toFixed(1) + 's',
          tokens: Math.floor(Math.random() * 1000 + 500)
        };
      case 'data-source':
        return {
          recordsFound: Math.floor(Math.random() * 100 + 50),
          queryTime: (Math.random() * 2 + 0.5).toFixed(1) + 's'
        };
      case 'api-call':
        return {
          statusCode: 200,
          responseTime: (Math.random() * 1 + 0.1).toFixed(1) + 's',
          dataSize: Math.floor(Math.random() * 10 + 1) + 'KB'
        };
      default:
        return {
          success: true,
          executionTime: (Math.random() * 3 + 0.5).toFixed(1) + 's'
        };
    }
  };

  const createNewWorkflow = () => {
    if (!newWorkflowName.trim()) return;

    const newWorkflow: Workflow = {
      id: `workflow_${Date.now()}`,
      name: newWorkflowName,
      description: 'New workflow',
      nodes: [],
      connections: [],
      createdAt: new Date(),
      status: 'draft'
    };

    setWorkflowList(prev => [newWorkflow, ...prev]);
    setSelectedWorkflow(newWorkflow);
    setIsCreatingWorkflow(false);
    setNewWorkflowName('');
  };

  const getNodeTypeInfo = (type: NodeType) => {
    return NODE_TYPES.find(n => n.type === type);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <BoltIcon className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed': return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'error': return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      default: return <ClockIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
            <Cog6ToothIcon className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Workflow Builder
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create and automate complex AI-powered workflows
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {selectedWorkflow && (
            <button
              onClick={() => runWorkflow(selectedWorkflow)}
              disabled={isRunning || selectedWorkflow.nodes.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isRunning ? (
                <>
                  <BoltIcon className="w-4 h-4 animate-pulse" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Run Workflow</span>
                </>
              )}
            </button>
          )}
          
          <button
            onClick={() => setIsCreatingWorkflow(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workflow List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            My Workflows
          </h3>
          <div className="space-y-2">
            {workflowList.map(workflow => (
              <div
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedWorkflow?.id === workflow.id
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {workflow.name}
                  </h4>
                  {getStatusIcon(workflow.status)}
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  {workflow.nodes.length} nodes
                </p>
                <p className="text-xs text-gray-400">
                  {workflow.lastRun 
                    ? `Last run: ${workflow.lastRun.toLocaleDateString()}`
                    : `Created: ${workflow.createdAt.toLocaleDateString()}`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Node Palette */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Node Types
          </h3>
          <div className="space-y-2">
            {NODE_TYPES.map(nodeType => (
              <div
                key={nodeType.type}
                draggable
                onDragStart={() => handleDragStart(nodeType.type)}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-1 rounded ${nodeType.color} bg-opacity-20`}>
                    <nodeType.icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {nodeType.name}
                  </h4>
                </div>
                <p className="text-xs text-gray-500">
                  {nodeType.description}
                </p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>In: {nodeType.inputs.length}</span>
                  <span>Out: {nodeType.outputs.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Canvas */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {selectedWorkflow ? (
            <div className="h-full">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedWorkflow.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedWorkflow.description}
                </p>
              </div>
              
              <div
                className="relative h-96 bg-gray-50 dark:bg-gray-900 bg-grid-pattern overflow-hidden"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {selectedWorkflow.nodes.map(node => {
                  const nodeTypeInfo = getNodeTypeInfo(node.type);
                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute cursor-pointer group"
                      style={{ left: node.position.x, top: node.position.y }}
                      onClick={() => setSelectedNode(node)}
                    >
                      <div className={`p-3 rounded-lg border-2 min-w-32 ${
                        selectedNode?.id === node.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                      } ${node.status === 'running' ? 'animate-pulse' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {nodeTypeInfo && (
                              <nodeTypeInfo.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            )}
                            {getStatusIcon(node.status || 'idle')}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNode(node.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {node.name}
                        </h4>
                        
                        {node.progress !== undefined && node.status === 'running' && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${node.progress}%` }}
                              className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
                            />
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          {node.inputs.length > 0 && (
                            <div>In: {node.inputs.join(', ')}</div>
                          )}
                          {node.outputs.length > 0 && (
                            <div>Out: {node.outputs.join(', ')}</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {selectedWorkflow.nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <BeakerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Drag nodes from the palette to start building your workflow
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Cog6ToothIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Workflow Selected
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a workflow from the list or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Node Configuration: {selectedNode.name}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Basic Information
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 font-medium">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 font-medium">{selectedNode.status || 'idle'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Inputs:</span>
                  <span className="ml-2 font-medium">{selectedNode.inputs.join(', ') || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Outputs:</span>
                  <span className="ml-2 font-medium">{selectedNode.outputs.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            {selectedNode.result && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Last Result
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedNode.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      {isCreatingWorkflow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Workflow
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="Enter workflow name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={createNewWorkflow}
                  disabled={!newWorkflowName.trim()}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreatingWorkflow(false);
                    setNewWorkflowName('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}