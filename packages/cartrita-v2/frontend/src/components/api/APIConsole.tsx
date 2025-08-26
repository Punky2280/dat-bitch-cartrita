/**
 * API Console Component
 * Advanced API testing and monitoring interface
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CodeBracketIcon,
  CpuChipIcon,
  ChartBarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CloudIcon,
  LinkIcon,
  BeakerIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useApiConsoleStore } from '@/stores';

interface APIRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: string;
  description?: string;
  createdAt: Date;
}

interface APIResponse {
  id: string;
  requestId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

interface APICollection {
  id: string;
  name: string;
  description: string;
  requests: APIRequest[];
  createdAt: Date;
}

const HTTP_METHODS = [
  { method: 'GET', color: 'bg-blue-500' },
  { method: 'POST', color: 'bg-green-500' },
  { method: 'PUT', color: 'bg-yellow-500' },
  { method: 'DELETE', color: 'bg-red-500' },
  { method: 'PATCH', color: 'bg-purple-500' }
] as const;

const SAMPLE_COLLECTIONS: APICollection[] = [
  {
    id: 'collection_1',
    name: 'AI Agents API',
    description: 'Core AI agent management endpoints',
    createdAt: new Date('2024-01-10'),
    requests: [
      {
        id: 'req_1',
        name: 'List Agents',
        method: 'GET',
        url: '/api/agents',
        headers: { 'Authorization': 'Bearer token_here' },
        description: 'Get all available AI agents',
        createdAt: new Date('2024-01-10')
      },
      {
        id: 'req_2',
        name: 'Create Agent',
        method: 'POST',
        url: '/api/agents',
        headers: { 
          'Authorization': 'Bearer token_here',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'New Agent',
          type: 'assistant',
          config: {
            model: 'gpt-4',
            temperature: 0.7
          }
        }, null, 2),
        description: 'Create a new AI agent',
        createdAt: new Date('2024-01-10')
      }
    ]
  },
  {
    id: 'collection_2',
    name: 'Analytics API',
    description: 'Analytics and metrics endpoints',
    createdAt: new Date('2024-01-12'),
    requests: [
      {
        id: 'req_3',
        name: 'Get Metrics',
        method: 'GET',
        url: '/api/analytics/metrics',
        headers: { 'Authorization': 'Bearer token_here' },
        description: 'Retrieve system metrics',
        createdAt: new Date('2024-01-12')
      }
    ]
  }
];

export default function APIConsole() {
  const { executeRequest, history, isLoading } = useApiConsoleStore();
  const [collections, setCollections] = useState<APICollection[]>(SAMPLE_COLLECTIONS);
  const [selectedCollection, setSelectedCollection] = useState<APICollection | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<APIRequest | null>(null);
  const [responses, setResponses] = useState<APIResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'request' | 'response' | 'history'>('request');

  // Request editor state
  const [editingRequest, setEditingRequest] = useState<APIRequest | null>(null);
  const [requestMethod, setRequestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [requestUrl, setRequestUrl] = useState('');
  const [requestHeaders, setRequestHeaders] = useState('');
  const [requestBody, setRequestBody] = useState('');

  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0]);
      if (collections[0].requests.length > 0) {
        setSelectedRequest(collections[0].requests[0]);
      }
    }
  }, [collections, selectedCollection]);

  const executeAPIRequest = async (request: APIRequest) => {
    try {
      const startTime = Date.now();
      
      // Simulate API call
      const mockResponse = generateMockResponse(request);
      const endTime = Date.now();
      
      const response: APIResponse = {
        id: `response_${Date.now()}`,
        requestId: request.id,
        status: mockResponse.status,
        statusText: mockResponse.statusText,
        headers: mockResponse.headers,
        body: JSON.stringify(mockResponse.data, null, 2),
        responseTime: endTime - startTime,
        timestamp: new Date(),
        error: mockResponse.error
      };

      setResponses(prev => [response, ...prev]);
      await executeRequest(request.url, request.method, request.headers, request.body);
      setActiveTab('response');
    } catch (error) {
      const errorResponse: APIResponse = {
        id: `response_${Date.now()}`,
        requestId: request.id,
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: '',
        responseTime: 0,
        timestamp: new Date(),
        error: 'Request failed: ' + (error as Error).message
      };

      setResponses(prev => [errorResponse, ...prev]);
    }
  };

  const generateMockResponse = (request: APIRequest) => {
    const responses = {
      '/api/agents': {
        GET: {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          data: {
            agents: [
              { id: '1', name: 'Assistant', type: 'chat', status: 'active' },
              { id: '2', name: 'Analyzer', type: 'analysis', status: 'active' },
              { id: '3', name: 'Researcher', type: 'research', status: 'active' }
            ],
            total: 3,
            timestamp: new Date().toISOString()
          }
        },
        POST: {
          status: 201,
          statusText: 'Created',
          headers: { 'Content-Type': 'application/json' },
          data: {
            id: '4',
            name: 'New Agent',
            type: 'assistant',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        }
      },
      '/api/analytics/metrics': {
        GET: {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          data: {
            metrics: {
              requests: Math.floor(Math.random() * 10000) + 5000,
              users: Math.floor(Math.random() * 1000) + 500,
              uptime: '99.9%',
              responseTime: Math.floor(Math.random() * 100) + 50
            },
            timestamp: new Date().toISOString()
          }
        }
      }
    };

    const pathKey = Object.keys(responses).find(path => request.url.includes(path));
    if (pathKey && responses[pathKey as keyof typeof responses][request.method]) {
      return responses[pathKey as keyof typeof responses][request.method];
    }

    return {
      status: Math.random() > 0.9 ? 404 : 200,
      statusText: Math.random() > 0.9 ? 'Not Found' : 'OK',
      headers: { 'Content-Type': 'application/json' },
      data: {
        success: true,
        message: 'Mock response',
        timestamp: new Date().toISOString()
      }
    };
  };

  const getMethodColor = (method: string) => {
    const methodInfo = HTTP_METHODS.find(m => m.method === method);
    return methodInfo?.color || 'bg-gray-500';
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) {
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    }
    if (status >= 300 && status < 400) {
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    }
    if (status >= 400 && status < 500) {
      return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    }
    if (status >= 500) {
      return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    }
    return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
  };

  const formatHeaders = (headers: Record<string, string>) => {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  const parseHeaders = (headersText: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!headersText.trim()) {
      return headers;
    }

    headersText.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });
    return headers;
  };

  const startEditing = (request?: APIRequest) => {
    if (request) {
      setEditingRequest(request);
      setRequestMethod(request.method);
      setRequestUrl(request.url);
      setRequestHeaders(formatHeaders(request.headers));
      setRequestBody(request.body || '');
    } else {
      setEditingRequest(null);
      setRequestMethod('GET');
      setRequestUrl('');
      setRequestHeaders('');
      setRequestBody('');
    }
  };

  const saveRequest = () => {
    const headers = parseHeaders(requestHeaders);
    
    if (editingRequest) {
      // Update existing request
      setCollections(prev => prev.map(col => ({
        ...col,
        requests: col.requests.map(req => 
          req.id === editingRequest.id 
            ? {
                ...req,
                method: requestMethod,
                url: requestUrl,
                headers,
                body: requestBody || undefined
              }
            : req
        )
      })));
    } else {
      // Create new request
      const newRequest: APIRequest = {
        id: `req_${Date.now()}`,
        name: `New ${requestMethod} Request`,
        method: requestMethod,
        url: requestUrl,
        headers,
        body: requestBody || undefined,
        createdAt: new Date()
      };

      if (selectedCollection) {
        setCollections(prev => prev.map(col => 
          col.id === selectedCollection.id
            ? { ...col, requests: [...col.requests, newRequest] }
            : col
        ));
        setSelectedRequest(newRequest);
      }
    }

    setEditingRequest(null);
  };

  const latestResponse = responses.find(r => r.requestId === selectedRequest?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
            <CodeBracketIcon className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              API Console
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test and monitor API endpoints with real-time responses
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => startEditing()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Request</span>
          </button>
          
          {selectedRequest && (
            <button
              onClick={() => executeAPIRequest(selectedRequest)}
              disabled={isLoading}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <CpuChipIcon className="w-4 h-4 animate-pulse" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Collections
          </h3>
          
          <div className="space-y-2 mb-6">
            {collections.map(collection => (
              <div
                key={collection.id}
                onClick={() => {
                  setSelectedCollection(collection);
                  if (collection.requests.length > 0) {
                    setSelectedRequest(collection.requests[0]);
                  }
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCollection?.id === collection.id
                    ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                  {collection.name}
                </h4>
                <p className="text-xs text-gray-500 mb-2">
                  {collection.description}
                </p>
                <p className="text-xs text-gray-400">
                  {collection.requests.length} requests
                </p>
              </div>
            ))}
          </div>

          {selectedCollection && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Requests
              </h4>
              <div className="space-y-1">
                {selectedCollection.requests.map(request => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id
                        ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-medium text-white rounded ${getMethodColor(request.method)}`}>
                        {request.method}
                      </span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {request.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {request.url}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedRequest ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Request Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-sm font-medium text-white rounded ${getMethodColor(selectedRequest.method)}`}>
                      {selectedRequest.method}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedRequest.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEditing(selectedRequest)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700 rounded px-3 py-2">
                  {selectedRequest.url}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'request', name: 'Request', icon: DocumentTextIcon },
                    { id: 'response', name: 'Response', icon: EyeIcon },
                    { id: 'history', name: 'History', icon: ClockIcon }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? 'border-cyan-500 text-cyan-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'request' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Headers
                      </h4>
                      <pre className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-x-auto">
                        {formatHeaders(selectedRequest.headers) || 'No headers'}
                      </pre>
                    </div>

                    {selectedRequest.body && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Request Body
                        </h4>
                        <pre className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-x-auto">
                          {selectedRequest.body}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'response' && (
                  <div>
                    {latestResponse ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(latestResponse.status)}`}>
                              {latestResponse.status} {latestResponse.statusText}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {latestResponse.responseTime}ms
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {latestResponse.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {latestResponse.error ? (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                            <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                              Error
                            </h5>
                            <p className="text-sm text-red-700 dark:text-red-400">
                              {latestResponse.error}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Response Headers
                              </h4>
                              <pre className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-x-auto">
                                {formatHeaders(latestResponse.headers)}
                              </pre>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Response Body
                              </h4>
                              <pre className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-x-auto max-h-96">
                                {latestResponse.body}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No Response Yet
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400">
                          Send the request to see the response here
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div>
                    {responses.length > 0 ? (
                      <div className="space-y-4">
                        {responses.slice(0, 10).map(response => (
                          <div
                            key={response.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(response.status)}`}>
                                  {response.status}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {response.responseTime}ms
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {response.timestamp.toLocaleString()}
                              </span>
                            </div>
                            {response.error && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {response.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No History
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400">
                          Request history will appear here
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-96 flex items-center justify-center">
              <div className="text-center">
                <CodeBracketIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Request Selected
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a request from the sidebar to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Editor Modal */}
      {editingRequest !== undefined && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRequest ? 'Edit Request' : 'New Request'}
              </h3>
              <button
                onClick={() => setEditingRequest(undefined)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex space-x-4">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Method
                  </label>
                  <select
                    value={requestMethod}
                    onChange={(e) => setRequestMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  >
                    {HTTP_METHODS.map(method => (
                      <option key={method.method} value={method.method}>
                        {method.method}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <input
                    type="text"
                    value={requestUrl}
                    onChange={(e) => setRequestUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Headers
                </label>
                <textarea
                  value={requestHeaders}
                  onChange={(e) => setRequestHeaders(e.target.value)}
                  placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                />
              </div>

              {['POST', 'PUT', 'PATCH'].includes(requestMethod) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Request Body
                  </label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder="JSON request body..."
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  />
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={saveRequest}
                  disabled={!requestUrl.trim()}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingRequest ? 'Update Request' : 'Create Request'}
                </button>
                <button
                  onClick={() => setEditingRequest(undefined)}
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