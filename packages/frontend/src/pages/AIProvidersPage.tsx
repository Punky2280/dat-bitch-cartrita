import React, { useEffect, useMemo, useState } from 'react';
import { useNotify } from '../components/ui/NotificationProvider';

interface AIProvider {
  key: string;
  name: string;
  hasApiKey: boolean;
  tasks: string[];
  models: string[];
}

interface InferenceResult {
  id: string;
  task: string;
  model: string;
  latencyMs: number;
  payload: any;
  confidence?: number;
  warnings?: string[];
}

interface TestCase {
  name: string;
  task: string;
  input: any;
  params?: Record<string, any>;
  description: string;
}

export const AIProvidersPage: React.FC<{ token: string; onBack: () => void }> = ({ onBack }) => {
  const notify = useNotify();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'testing' | 'providers' | 'analytics'>('overview');
  const [selectedTask, setSelectedTask] = useState('text-classification');
  const [testInput, setTestInput] = useState('');
  const [testParams, setTestParams] = useState('');
  const [preferredProvider, setPreferredProvider] = useState('auto');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<InferenceResult[]>([]);

  const testCases: TestCase[] = [
    {
      name: 'Sentiment Analysis',
      task: 'text-classification',
      input: 'I love this product! It works amazingly well.',
      description: 'Detect positive/negative sentiment'
    },
    {
      name: 'Topic Classification',
      task: 'zero-shot',
      input: 'This is a great educational resource for learning machine learning',
      params: { candidate_labels: ['education', 'technology', 'business', 'entertainment', 'sports'] },
      description: 'Classify text into predefined categories'
    },
    {
      name: 'Named Entity Recognition',
      task: 'ner',
      input: 'My name is John Smith and I work at Microsoft in Seattle.',
      description: 'Extract people, organizations, and locations from text'
    },
    {
      name: 'Question Answering',
      task: 'qa',
      input: {
        question: 'What is the capital of France?',
        context: 'France is a country in Western Europe. Its capital and largest city is Paris, located in the north-central part of the country.'
      },
      description: 'Answer questions based on provided context'
    },
    {
      name: 'Text Generation',
      task: 'generation',
      input: { messages: [{ role: 'user', content: 'Write a short poem about artificial intelligence' }] },
      params: { max_tokens: 100, temperature: 0.7 },
      description: 'Generate creative text using language models'
    }
  ];

  const fetchWithTimeout = useMemo(() => {
    return async (url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Try legacy endpoints first
        let providersData: any = null;
        let healthData: any = null;
        try {
          const [providersRes, healthRes] = await Promise.all([
            fetchWithTimeout('/api/ai/providers'),
            fetchWithTimeout('/api/ai/health')
          ]);
          if (providersRes.ok) providersData = await providersRes.json();
          if (healthRes.ok) healthData = await healthRes.json();
        } catch (_) {
          // ignore; will fallback
        }
        // Fallback to unified endpoints
        if (!providersData) {
          try {
            const uniHealth = await fetchWithTimeout('/api/unified/health');
            if (uniHealth.ok) {
              const uh = await uniHealth.json();
              providersData = {
                success: true,
                providers: (uh.availableModels || []).map((m: string) => ({
                  key: m,
                  name: m,
                  hasApiKey: true,
                  tasks: ['chat','embeddings','asr','image','classify','summarize'],
                  models: [m]
                }))
              };
              healthData = {
                success: true,
                status: uh.status === 'healthy' ? 'operational' : 'degraded',
                metrics: uh.metrics,
                version: 'unified-bridge'
              };
            }
          } catch (_) {}
        }

        if (providersData?.success) setProviders(providersData.providers || []);
        if (healthData?.success || healthData?.status) setServiceHealth(healthData);
      } catch (error) {
        console.error('Error loading AI providers data:', error);
        notify.error('Failed to load AI providers', 'Please check your connection and try again');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [notify]);

  const runTest = async (testCase?: TestCase) => {
    setTesting(true);
    try {
      const payload = testCase ? {
        task: testCase.task,
        input: testCase.input,
        params: testCase.params || {},
        preferredModels: preferredProvider !== 'auto' ? [preferredProvider] : []
      } : {
        task: selectedTask,
        input: selectedTask === 'qa' ? JSON.parse(testInput) : testInput,
        params: testParams ? JSON.parse(testParams) : {},
        preferredModels: preferredProvider !== 'auto' ? [preferredProvider] : []
      };
      // Try legacy inference, then fallback to unified
      let result: any = null;
      try {
        const response = await fetchWithTimeout('/api/ai/inference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) result = await response.json();
      } catch (_) {}
      if (!result) {
        // Translate to unified shape
        const mapping: Record<string,string> = {
          'text-classification':'classify',
          'zero-shot':'classify',
          'ner':'nlp_classic',
          'qa':'nlp_classic',
          'generation':'chat'
        };
        const unifiedTask = mapping[(payload as any).task] || (payload as any).task;
        const unifiedInputs = unifiedTask === 'chat' && (payload as any).input?.messages
          ? { messages: (payload as any).input.messages }
          : (payload as any).input;
        const resp = await fetchWithTimeout('/api/unified/inference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: unifiedTask, inputs: unifiedInputs, options: (payload as any).params })
        });
        result = await resp.json();
      }
      if (result?.success) {
        const normalized: InferenceResult = {
          id: result.id || Math.random().toString(36).slice(2),
          task: result.task || payload.task,
          model: result.model || 'unknown',
          latencyMs: result.latencyMs || 0,
          payload: result.payload,
          confidence: result.confidence,
          warnings: result.warnings || []
        };
        setTestResults(prev => [normalized, ...prev.slice(0, 9)]);
        notify.success('Test completed', `${(testCase?.name || selectedTask)} executed successfully`);
      } else {
        notify.error('Test failed', result?.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Test error:', error);
      notify.error('Test failed', 'Please check your input and try again');
    } finally {
      setTesting(false);
    }
  };

  const formatResult = (result: InferenceResult) => {
    if (result.task === 'text-classification' && Array.isArray(result.payload) && result.payload[0]) {
      const prediction = result.payload[0][0];
      return `${prediction.label}: ${(prediction.score * 100).toFixed(1)}%`;
    }
    if (result.task === 'zero-shot' && result.payload?.labels) {
      const topLabel = result.payload.labels[0];
      const topScore = result.payload.scores[0];
      return `${topLabel}: ${(topScore * 100).toFixed(1)}%`;
    }
    if (result.task === 'ner' && Array.isArray(result.payload)) {
      return `Found ${result.payload.length} entities`;
    }
    if (result.task === 'qa' && result.payload?.answer) {
      return `"${result.payload.answer}" (${(result.payload.score * 100).toFixed(1)}%)`;
    }
    return 'Completed successfully';
  };

  const getProviderStatusColor = (provider: AIProvider) => {
    if (provider.hasApiKey) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getTaskIcon = (task: string) => {
    const icons: { [key: string]: string } = {
      'text-classification': '📊',
      'zero-shot': '🎯',
      'ner': '🏷️',
      'qa': '❓',
      'generation': '✍️',
      'asr': '🎤',
      'vision-detection': '👁️',
      'image-generation': '🎨',
      'multimodal': '🔄'
    };
    return icons[task] || '🤖';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-white text-xl mt-4">Loading AI Providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-slate-600/50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">🤖 Multi-Provider AI Hub</h1>
              <p className="text-slate-400 mt-1">Configure and manage model backends</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Service Status</div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${serviceHealth?.status === 'operational' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-semibold">{serviceHealth?.status || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'testing', name: 'Live Testing', icon: '🧪' },
              { id: 'providers', name: 'Provider Matrix', icon: '🎛️' },
              { id: 'analytics', name: 'Analytics', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Total Providers</p>
                    <p className="text-2xl font-bold">{providers.length}</p>
                  </div>
                  <div className="text-3xl">🤖</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Active Providers</p>
                    <p className="text-2xl font-bold">{providers.filter(p => p.hasApiKey).length}</p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Total Tasks</p>
                    <p className="text-2xl font-bold">{[...new Set(providers.flatMap(p => p.tasks))].length}</p>
                  </div>
                  <div className="text-3xl">🎯</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100">Avg Latency</p>
                    <p className="text-2xl font-bold">{serviceHealth?.metrics?.avgLatency?.toFixed(0) || '0'}ms</p>
                  </div>
                  <div className="text-3xl">⚡</div>
                </div>
              </div>
            </div>

            {/* Quick Test Panel */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <span>⚡</span>
                <span>Quick AI Tasks</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testCases.map((testCase, idx) => (
                  <div key={idx} className="border border-slate-700 rounded-lg p-4 hover:border-purple-500 transition-colors">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl">{getTaskIcon(testCase.task)}</span>
                      <div>
                        <h3 className="font-semibold text-white">{testCase.name}</h3>
                        <p className="text-slate-400 text-sm">{testCase.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => runTest(testCase)}
                      disabled={testing}
                      className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 rounded-lg font-semibold transition-colors"
                    >
                      {testing ? '🔄 Testing...' : '▶️ Run Test'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Results */}
            {testResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>📋</span>
                  <span>Recent Test Results</span>
                </h2>
                <div className="space-y-3">
                  {testResults.slice(0, 5).map((result, idx) => (
                    <div key={idx} className="border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getTaskIcon(result.task)}</span>
                          <span className="font-semibold text-white capitalize">{result.task.replace('-', ' ')}</span>
                          <span className="text-sm text-slate-400">via {result.model}</span>
                        </div>
                        <span className="text-sm text-slate-400">{result.latencyMs.toFixed(1)}ms</span>
                      </div>
                      <p className="text-purple-400 text-sm">{formatResult(result)}</p>
                      {result.warnings && result.warnings.length > 0 && (
                        <p className="text-yellow-400 text-xs mt-1">⚠️ {result.warnings.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <div className="space-y-8">
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center space-x-2">
                <span>🧪</span>
                <span>Custom AI Testing Lab</span>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Task Type</label>
                    <select
                      value={selectedTask}
                      onChange={(e) => setSelectedTask(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="text-classification">Text Classification</option>
                      <option value="zero-shot">Zero-Shot Classification</option>
                      <option value="ner">Named Entity Recognition</option>
                      <option value="qa">Question Answering</option>
                      <option value="generation">Text Generation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Test Input</label>
                    <textarea
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                      placeholder={`Enter your ${selectedTask} input...`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Parameters (JSON)</label>
                    <textarea
                      value={testParams}
                      onChange={(e) => setTestParams(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                      placeholder='{"temperature": 0.7, "max_tokens": 100}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Provider</label>
                    <select
                      value={preferredProvider}
                      onChange={(e) => setPreferredProvider(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="auto">Auto-select best provider</option>
                      {providers.map(provider => (
                        <option key={provider.key} value={provider.key}>
                          {provider.name} {provider.hasApiKey ? '✅' : '⚠️'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => runTest()}
                    disabled={testing || !testInput.trim()}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 rounded-lg font-semibold transition-colors"
                  >
                    {testing ? '🔄 Running Test...' : '🚀 Execute Test'}
                  </button>
                </div>

                {/* Results Panel */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Test Results</h3>
                  {testResults.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                      <div className="text-4xl mb-2">🎯</div>
                      <p className="text-slate-400">No test results yet</p>
                      <p className="text-slate-500 text-sm">Run a test to see results here</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {testResults.map((result, idx) => (
                        <div key={idx} className="bg-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{getTaskIcon(result.task)}</span>
                              <span className="font-semibold text-white capitalize">{result.task.replace('-', ' ')}</span>
                            </div>
                            <div className="text-right text-sm text-slate-400">
                              <div>Latency: {result.latencyMs.toFixed(1)}ms</div>
                              {typeof result.confidence === 'number' && (
                                <div>Confidence: {(result.confidence * 100).toFixed(0)}%</div>
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-800 rounded p-3 text-sm">
                            <pre className="text-green-400 whitespace-pre-wrap">
                              {JSON.stringify(result.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-8">
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center space-x-2">
                <span>🎛️</span>
                <span>Provider Capability Matrix</span>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {providers.map((provider) => (
                  <div key={provider.key} className="border border-slate-700 rounded-lg p-5 hover:border-purple-500 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white text-lg">{provider.name}</h3>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getProviderStatusColor(provider)}`}></div>
                        <span className="text-xs text-slate-400">
                          {provider.hasApiKey ? 'Active' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Supported Tasks</h4>
                        <div className="flex flex-wrap gap-1">
                          {provider.tasks.map((task, idx) => (
                            <span key={idx} className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs">
                              {getTaskIcon(task)} {task}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Available Models</h4>
                        <div className="text-xs text-slate-400 space-y-1">
                          {provider.models.slice(0, 3).map((model, idx) => (
                            <div key={idx} className="truncate">• {model}</div>
                          ))}
                          {provider.models.length > 3 && (
                            <div className="text-purple-400">+ {provider.models.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <button
                        onClick={() => {
                          setPreferredProvider(provider.key);
                          setActiveTab('testing');
                        }}
                        disabled={!provider.hasApiKey}
                        className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 rounded text-sm font-medium transition-colors"
                      >
                        {provider.hasApiKey ? 'Test Provider' : 'API Key Required'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center space-x-2">
                <span>📈</span>
                <span>Service Analytics & Metrics</span>
              </h2>

              {serviceHealth && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">Service Info</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Version:</span>
                        <span className="text-white">{serviceHealth.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className={`${serviceHealth.status === 'operational' ? 'text-green-400' : 'text-red-400'}`}>
                          {serviceHealth.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Providers:</span>
                        <span className="text-white">{serviceHealth.providers}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">Performance</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Avg Latency:</span>
                        <span className="text-white">{serviceHealth.metrics?.avgLatency?.toFixed(2) || '0'}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Success Rate:</span>
                        <span className="text-green-400">{(serviceHealth.metrics?.successRate * 100 || 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Requests:</span>
                        <span className="text-white">{serviceHealth.metrics?.requests || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">Provider Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Active:</span>
                        <span className="text-green-400">{providers.filter(p => p.hasApiKey).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pending:</span>
                        <span className="text-yellow-400">{providers.filter(p => !p.hasApiKey).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Success/Fail:</span>
                        <span className="text-white">{serviceHealth.metrics?.successes || 0}/{serviceHealth.metrics?.failures || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 bg-slate-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-4">Provider Coverage Map</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Task Distribution</h4>
                    <div className="space-y-2">
                      {[...new Set(providers.flatMap(p => p.tasks))].map(task => {
                        const providerCount = providers.filter(p => p.tasks.includes(task)).length;
                        return (
                          <div key={task} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">{getTaskIcon(task)} {task}</span>
                            <span className="text-white">{providerCount} providers</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Recent Activity</h4>
                    <div className="space-y-2">
                      {testResults.slice(0, 5).map((result, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{getTaskIcon(result.task)} {result.task}</span>
                          <span className="text-purple-400">{result.latencyMs.toFixed(0)}ms</span>
                        </div>
                      ))}
                      {testResults.length === 0 && (
                        <p className="text-slate-500 text-sm italic">No recent activity</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};