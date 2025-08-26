/**
 * API Console Page - Cartrita V2
 * Developer API testing and documentation interface
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CommandLineIcon,
  PlayIcon,
  ClipboardDocumentIcon,
  KeyIcon,
  CogIcon,
  BookOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import { useApiConsoleStore } from '@/stores';

interface ApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters: ApiParameter[];
  headers: Record<string, string>;
  body?: string;
  responses: ApiResponse[];
  category: string;
}

interface ApiParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: any;
}

interface ApiResponse {
  status: number;
  description: string;
  example: any;
}

interface ApiRequest {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  response_status?: number;
  response_body?: string;
  response_time?: number;
  success: boolean;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'chat_completion',
    name: 'Chat Completion',
    method: 'POST',
    path: '/api/chat/completion',
    description: 'Generate a response from AI agents',
    category: 'Chat',
    parameters: [
      { name: 'message', type: 'string', required: true, description: 'The user message', example: 'Hello, how are you?' },
      { name: 'agent', type: 'string', required: false, description: 'Specific agent to use', example: 'supervisor' },
      { name: 'conversation_id', type: 'string', required: false, description: 'Continue existing conversation' },
      { name: 'stream', type: 'boolean', required: false, description: 'Enable streaming response', example: false }
    ],
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hello, how are you?',
      agent: 'supervisor',
      stream: false
    }, null, 2),
    responses: [
      { status: 200, description: 'Successful response', example: { message: 'Hello! I\'m doing well, thank you for asking.', agent: 'supervisor' } },
      { status: 400, description: 'Bad request', example: { error: 'Message is required' } }
    ]
  },
  {
    id: 'list_agents',
    name: 'List Agents',
    method: 'GET',
    path: '/api/agents',
    description: 'Get all available AI agents',
    category: 'Agents',
    parameters: [
      { name: 'status', type: 'string', required: false, description: 'Filter by agent status', example: 'active' },
      { name: 'category', type: 'string', required: false, description: 'Filter by agent category' }
    ],
    headers: {},
    responses: [
      { status: 200, description: 'List of agents', example: [{ id: 'supervisor', name: 'Supervisor Agent', status: 'active' }] }
    ]
  },
  {
    id: 'create_workflow',
    name: 'Create Workflow',
    method: 'POST',
    path: '/api/workflows',
    description: 'Create a new automated workflow',
    category: 'Workflows',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Workflow name' },
      { name: 'description', type: 'string', required: false, description: 'Workflow description' },
      { name: 'steps', type: 'array', required: true, description: 'Workflow steps' }
    ],
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sample Workflow',
      description: 'A sample workflow for testing',
      steps: [
        { type: 'agent', agent: 'supervisor', config: {} }
      ]
    }, null, 2),
    responses: [
      { status: 201, description: 'Workflow created', example: { id: '123', name: 'Sample Workflow', status: 'active' } }
    ]
  },
  {
    id: 'quantum_job',
    name: 'Submit Quantum Job',
    method: 'POST',
    path: '/api/quantum/jobs',
    description: 'Submit a quantum computing job',
    category: 'Quantum',
    parameters: [
      { name: 'algorithm', type: 'string', required: true, description: 'Quantum algorithm to run' },
      { name: 'qubits', type: 'number', required: true, description: 'Number of qubits' },
      { name: 'parameters', type: 'object', required: false, description: 'Algorithm parameters' }
    ],
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'qaoa',
      qubits: 4,
      parameters: { layers: 1, shots: 1024 }
    }, null, 2),
    responses: [
      { status: 202, description: 'Job submitted', example: { job_id: 'qjob_123', status: 'queued' } }
    ]
  },
  {
    id: 'vision_analyze',
    name: 'Analyze Image',
    method: 'POST',
    path: '/api/vision/analyze',
    description: 'Analyze image with computer vision',
    category: 'Vision',
    parameters: [
      { name: 'image', type: 'string', required: true, description: 'Base64 encoded image or image URL' },
      { name: 'analysis_types', type: 'array', required: true, description: 'Types of analysis to perform' }
    ],
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'data:image/jpeg;base64,...',
      analysis_types: ['object_detection', 'ocr']
    }, null, 2),
    responses: [
      { status: 200, description: 'Analysis results', example: { objects: [], text: 'Detected text' } }
    ]
  }
];

export default function ApiConsolePage() {
  const {
    requests,
    apiKeys,
    selectedEndpoint,
    isLoading,
    error,
    sendRequest,
    generateApiKey,
    deleteApiKey,
    selectEndpoint
  } = useApiConsoleStore();

  const [activeTab, setActiveTab] = useState<'explorer' | 'documentation' | 'history' | 'keys'>('explorer');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('');
  const [requestBody, setRequestBody] = useState<string>('');
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const currentEndpoint = API_ENDPOINTS.find(e => e.id === selectedEndpointId);

  useEffect(() => {
    if (currentEndpoint) {
      setRequestBody(currentEndpoint.body || '');
      setRequestHeaders(currentEndpoint.headers);
    }
  }, [currentEndpoint]);

  const handleSendRequest = async () => {
    if (!currentEndpoint) {
      return;
    }
    
    try {
      const result = await sendRequest({
        endpoint: currentEndpoint,
        body: requestBody,
        headers: requestHeaders,
        params: urlParams
      });
      setResponse(result);
    } catch (error) {
      console.error('Request failed:', error);
      setResponse({ error: 'Request failed' });
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'POST':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'PUT':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'DELETE':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'PATCH':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const categories = [...new Set(API_ENDPOINTS.map(e => e.category))];
  const filteredEndpoints = filterCategory === 'all' 
    ? API_ENDPOINTS 
    : API_ENDPOINTS.filter(e => e.category === filterCategory);

  const requestStats = {
    total: requests.length,
    success: requests.filter(r => r.success).length,
    failed: requests.filter(r => !r.success).length,
    avgResponseTime: requests.length > 0 
      ? Math.round(requests.reduce((sum, r) => sum + (r.response_time || 0), 0) / requests.length)
      : 0
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mr-4">
                <CommandLineIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  API Console
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Test and explore Cartrita's API endpoints
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => generateApiKey()}
                className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <KeyIcon className="w-5 h-5 mr-2" />
                New API Key
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {requestStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {requestStats.success}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Successful</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {requestStats.failed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {requestStats.avgResponseTime}ms
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'explorer', name: 'API Explorer', icon: PlayIcon },
              { id: 'documentation', name: 'Documentation', icon: BookOpenIcon },
              { id: 'history', name: 'Request History', icon: ClockIcon },
              { id: 'keys', name: 'API Keys', icon: KeyIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* API Explorer Tab */}
          {activeTab === 'explorer' && (
            <motion.div
              key="explorer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Endpoints List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    API Endpoints
                  </h2>
                  
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
                  {filteredEndpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => setSelectedEndpointId(endpoint.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedEndpointId === endpoint.id ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>
                        <span className="text-xs text-gray-500">
                          {endpoint.category}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {endpoint.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {endpoint.path}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Request Builder */}
              <div className="lg:col-span-2 space-y-6">
                {currentEndpoint ? (
                  <>
                    {/* Endpoint Details */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${getMethodColor(currentEndpoint.method)}`}>
                          {currentEndpoint.method}
                        </span>
                        <code className="text-lg font-mono text-gray-900 dark:text-white">
                          {currentEndpoint.path}
                        </code>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {currentEndpoint.description}
                      </p>

                      {/* Parameters */}
                      {currentEndpoint.parameters.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Parameters
                          </h3>
                          <div className="space-y-2">
                            {currentEndpoint.parameters.map((param) => (
                              <div key={param.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                      {param.name}
                                    </span>
                                    {param.required && (
                                      <span className="text-xs text-red-500 font-medium">required</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {param.description}
                                  </div>
                                </div>
                                <span className="text-xs text-gray-500 font-mono">
                                  {param.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request Body */}
                      {['POST', 'PUT', 'PATCH'].includes(currentEndpoint.method) && (
                        <div className="mb-6">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Request Body
                          </h3>
                          <textarea
                            value={requestBody}
                            onChange={(e) => setRequestBody(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                            placeholder="Enter JSON request body"
                          />
                        </div>
                      )}

                      {/* Send Request */}
                      <button
                        onClick={handleSendRequest}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? (
                          <>
                            <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <PlayIcon className="w-5 h-5 mr-2" />
                            Send Request
                          </>
                        )}
                      </button>
                    </div>

                    {/* Response */}
                    {response && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Response
                        </h3>
                        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                          <pre className="text-green-400 text-sm font-mono">
                            {JSON.stringify(response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
                    <div className="text-center">
                      <CommandLineIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Select an endpoint
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Choose an API endpoint from the list to start testing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Documentation Tab */}
          {activeTab === 'documentation' && (
            <motion.div
              key="documentation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  API Documentation
                </h2>
              </div>
              
              <div className="p-6 space-y-8">
                {categories.map(category => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {category} API
                    </h3>
                    <div className="space-y-4">
                      {API_ENDPOINTS.filter(e => e.category === category).map(endpoint => (
                        <div key={endpoint.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                              {endpoint.method}
                            </span>
                            <code className="font-mono text-sm text-gray-900 dark:text-white">
                              {endpoint.path}
                            </code>
                          </div>
                          
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            {endpoint.name}
                          </h4>
                          
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                            {endpoint.description}
                          </p>

                          {endpoint.parameters.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Parameters
                              </h5>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                      <th className="text-left py-2 text-gray-600 dark:text-gray-400">Name</th>
                                      <th className="text-left py-2 text-gray-600 dark:text-gray-400">Type</th>
                                      <th className="text-left py-2 text-gray-600 dark:text-gray-400">Required</th>
                                      <th className="text-left py-2 text-gray-600 dark:text-gray-400">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {endpoint.parameters.map(param => (
                                      <tr key={param.name} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 font-mono text-gray-900 dark:text-white">
                                          {param.name}
                                        </td>
                                        <td className="py-2 text-gray-600 dark:text-gray-400">
                                          {param.type}
                                        </td>
                                        <td className="py-2">
                                          {param.required ? (
                                            <span className="text-red-500">Yes</span>
                                          ) : (
                                            <span className="text-gray-500">No</span>
                                          )}
                                        </td>
                                        <td className="py-2 text-gray-600 dark:text-gray-400">
                                          {param.description}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div>
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Response Examples
                            </h5>
                            {endpoint.responses.map((response, index) => (
                              <div key={index} className="mb-3">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                    response.status < 300 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                    response.status < 400 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  }`}>
                                    {response.status}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {response.description}
                                  </span>
                                </div>
                                <div className="bg-gray-900 rounded p-2 overflow-x-auto">
                                  <pre className="text-green-400 text-xs font-mono">
                                    {JSON.stringify(response.example, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Request History
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {requests.length > 0 ? (
                  requests.map((request) => (
                    <div key={request.id} className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getMethodColor(request.method)}`}>
                            {request.method}
                          </span>
                          <code className="text-sm font-mono text-gray-900 dark:text-white">
                            {request.url}
                          </code>
                          {request.success ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircleIcon className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{new Date(request.timestamp).toLocaleString()}</span>
                          {request.response_time && (
                            <span>{request.response_time}ms</span>
                          )}
                          {request.response_status && (
                            <span className={request.response_status < 300 ? 'text-green-600' : 'text-red-600'}>
                              {request.response_status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {request.response_body && (
                        <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-green-400 text-xs font-mono">
                            {JSON.stringify(JSON.parse(request.response_body), null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <ClockIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No requests yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Start making API requests to see your history here.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'keys' && (
            <motion.div
              key="keys"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    API Keys
                  </h2>
                  <button
                    onClick={() => generateApiKey()}
                    className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Generate Key
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {apiKeys.length > 0 ? (
                  apiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {apiKey.name}
                            </h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              apiKey.status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {apiKey.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2 mb-2">
                            <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm">
                              {showApiKeys[apiKey.id] ? apiKey.key : '•'.repeat(32)}
                            </code>
                            <button
                              onClick={() => setShowApiKeys(prev => ({
                                ...prev,
                                [apiKey.id]: !prev[apiKey.id]
                              }))}
                              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {showApiKeys[apiKey.id] ? (
                                <EyeSlashIcon className="w-4 h-4" />
                              ) : (
                                <EyeIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(apiKey.key)}
                              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <ClipboardDocumentIcon className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                            <span>Last used: {apiKey.last_used ? new Date(apiKey.last_used).toLocaleDateString() : 'Never'}</span>
                            <span>Usage: {apiKey.usage_count} requests</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => deleteApiKey(apiKey.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <KeyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No API keys yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Generate an API key to start using Cartrita's API.
                    </p>
                    <button
                      onClick={() => generateApiKey()}
                      className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Generate Your First API Key
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}