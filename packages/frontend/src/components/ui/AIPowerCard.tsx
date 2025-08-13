import React, { useState, useEffect } from 'react';

interface AIPowerCardProps {
  className?: string;
  onNavigateToAI?: () => void;
}

interface ServiceStats {
  providers: number;
  status: string;
  metrics: {
    requests: number;
    successes: number;
    successRate: number;
    avgLatency: number;
  };
}

export const AIPowerCard: React.FC<AIPowerCardProps> = ({
  className = '',
  onNavigateToAI
}) => {
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Try unified inference first, fallback to legacy AI service
      let response = await fetch('/api/unified/health');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats({
            providers: data.availableModels || 14,
            status: data.status,
            metrics: {
              requests: data.metrics.totalRequests,
              successes: data.metrics.successfulRequests,
              successRate: data.metrics.totalRequests > 0 ? data.metrics.successfulRequests / data.metrics.totalRequests : 1,
              avgLatency: data.metrics.averageLatency
            }
          });
          return;
        }
      }
      
      // Fallback to legacy AI service
      response = await fetch('/api/ai/health');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data);
        }
      }
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-white/20 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold mb-2 flex items-center space-x-2">
            <span>🤖</span>
            <span>AI Power Hub</span>
          </h3>
          <p className="text-purple-100 text-sm">
            {stats ? `${stats.providers} task families unified` : 'Multi-provider AI via HuggingFace'}
          </p>
        </div>
        <div className="text-3xl">⚡</div>
      </div>

      {stats && (
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-purple-200 text-sm">Status</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${stats.status === 'operational' ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-white text-sm font-medium capitalize">{stats.status}</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-purple-200 text-sm">Success Rate</span>
            <span className="text-white text-sm font-medium">{Math.round(stats.metrics.successRate * 100)}%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-purple-200 text-sm">Avg Response</span>
            <span className="text-white text-sm font-medium">{stats.metrics.avgLatency.toFixed(0)}ms</span>
          </div>

          {stats.metrics.requests > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-purple-200 text-sm">Total Requests</span>
              <span className="text-white text-sm font-medium">{stats.metrics.requests}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <div className="text-lg font-bold">{stats?.providers || 9}</div>
          <div className="text-xs text-purple-200">Task Groups</div>
        </div>
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <div className="text-lg font-bold">HF</div>
          <div className="text-xs text-purple-200">Via Token</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="text-xs text-purple-200 mb-1">Quick Capabilities:</div>
        <div className="flex flex-wrap gap-1">
          {['💬 Chat', '🎯 Classification', '📄 Summarization', '🖼️ Images', '🎤 Audio'].map((capability, idx) => (
            <span key={idx} className="px-2 py-1 bg-white/10 rounded text-xs">
              {capability}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onNavigateToAI}
        className="w-full bg-white/20 hover:bg-white/30 transition-colors rounded-lg py-2 px-4 text-sm font-semibold"
      >
        🚀 Explore AI Hub
      </button>
    </div>
  );
};