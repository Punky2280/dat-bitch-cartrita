import React, { useState, useEffect } from 'react';

interface Provider {
  key: string;
  name: string;
  hasApiKey: boolean;
  tasks: string[];
  models: string[];
}

interface ServiceStats {
  providers: number;
  status: string;
  version: string;
  metrics: {
    requests: number;
    successes: number;
    failures: number;
    avgLatency: number;
    successRate: number;
  };
}

interface CompatibilityShowcaseProps {
  className?: string;
}

export const CompatibilityShowcase: React.FC<CompatibilityShowcaseProps> = ({
  className = ''
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState('text-classification');

  useEffect(() => {
    loadCompatibilityData();
  }, []);

  const loadCompatibilityData = async () => {
    try {
      const [providersRes, healthRes] = await Promise.all([
        fetch('/api/ai/providers'),
        fetch('/api/ai/health')
      ]);

      const [providersData, healthData] = await Promise.all([
        providersRes.json(),
        healthRes.json()
      ]);

      if (providersData.success) setProviders(providersData.providers);
      if (healthData.success) setServiceStats(healthData);
    } catch (error) {
      console.error('Error loading compatibility data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskProviders = (task: string) => {
    return providers.filter(p => p.tasks.includes(task));
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

  const availableTasks = [...new Set(providers.flatMap(p => p.tasks))];

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
          <span>🔗</span>
          <span>Multi-Provider Compatibility</span>
        </h3>
        <p className="text-gray-400 text-sm">
          Seamless integration across {providers.length} AI providers with unified task routing
        </p>
      </div>

      {/* Service Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Providers</p>
              <p className="text-2xl font-bold text-white">{providers.length}</p>
            </div>
            <div className="text-3xl">🌐</div>
          </div>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Services</p>
              <p className="text-2xl font-bold text-white">{providers.filter(p => p.hasApiKey).length}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-white">{serviceStats ? Math.round(serviceStats.metrics.successRate * 100) : 0}%</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>
      </div>

      {/* Task Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          View Providers by Task
        </label>
        <select
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          {availableTasks.map(task => (
            <option key={task} value={task}>
              {getTaskIcon(task)} {task.charAt(0).toUpperCase() + task.slice(1).replace('-', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Provider Compatibility Matrix */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white flex items-center space-x-2">
          <span>{getTaskIcon(selectedTask)}</span>
          <span>Providers for {selectedTask.charAt(0).toUpperCase() + selectedTask.slice(1).replace('-', ' ')}</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {getTaskProviders(selectedTask).map((provider) => (
            <div
              key={provider.key}
              className={`border rounded-lg p-3 transition-colors ${
                provider.hasApiKey 
                  ? 'border-green-500 bg-green-500/10' 
                  : 'border-yellow-500 bg-yellow-500/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-white text-sm">{provider.name}</h5>
                <div className={`w-3 h-3 rounded-full ${
                  provider.hasApiKey ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
              </div>
              
              <div className="text-xs text-gray-400 space-y-1">
                <div>Status: {provider.hasApiKey ? 'Active' : 'Pending'}</div>
                <div>Models: {provider.models.length}</div>
                <div>Tasks: {provider.tasks.length}</div>
              </div>
              
              {/* Model Preview */}
              {provider.models.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="text-gray-500">Top Model:</div>
                  <div className="text-purple-400 truncate">
                    {provider.models[0]}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {getTaskProviders(selectedTask).length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🚫</div>
            <p>No providers available for this task</p>
          </div>
        )}
      </div>

      {/* Integration Features */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">🔧 Integration Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h5 className="font-medium text-purple-400">Unified Interface</h5>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>✅ Single API endpoint for all providers</li>
              <li>✅ Automatic provider selection</li>
              <li>✅ Standardized request/response format</li>
              <li>✅ Built-in fallback mechanisms</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h5 className="font-medium text-purple-400">Smart Routing</h5>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>✅ Task-specific provider optimization</li>
              <li>✅ Load balancing and rate limiting</li>
              <li>✅ Real-time health monitoring</li>
              <li>✅ Cost and performance optimization</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Action */}
      <div className="mt-6 text-center">
        <button
          onClick={() => window.open('/dashboard?view=aiproviders', '_blank')}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center space-x-2 mx-auto"
        >
          <span>🚀</span>
          <span>Explore Multi-Provider AI Hub</span>
        </button>
      </div>
    </div>
  );
};