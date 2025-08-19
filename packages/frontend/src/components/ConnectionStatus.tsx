import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionHealth {
  websocket: { available: boolean; latency?: number };
  api: { available: boolean; latency?: number };
}

interface ConnectionStatusProps {
  isConnected: boolean;
  connectionError?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  connectionError,
  onRetry,
  className = ''
}) => {
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    
    try {
      // Test API connectivity
      const apiStart = Date.now();
      const apiResponse = await fetch('/api/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      const apiLatency = Date.now() - apiStart;

      const result: ConnectionHealth = {
        api: { 
          available: apiResponse.ok, 
          latency: apiLatency 
        },
        websocket: { 
          available: isConnected,
          latency: 0
        }
      };

      setHealth(result);
    } catch (error) {
      setHealth({
        api: { available: false, latency: 0 },
        websocket: { available: false, latency: 0 }
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  useEffect(() => {
    if (connectionError && !isConnected) {
      runDiagnostics();
    }
  }, [connectionError, isConnected]);

  // Success state
  if (isConnected) {
    return (
      <div className={`flex items-center space-x-2 text-green-600 ${className}`}>
        <CheckCircle size={16} />
        <span className="text-sm">Connected</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Error display */}
      <div className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="text-red-500 mt-0.5" size={16} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">Connection Failed</p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          {connectionError && (
            <p className="text-sm text-red-700 mt-1">{connectionError}</p>
          )}
        </div>
      </div>

      {/* Detailed Diagnostics */}
      {showDetails && (
        <div className="space-y-3">
          {health && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-800 mb-2">Connection Status</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>API:</span>
                  <span className={`flex items-center space-x-1 ${health.api.available ? 'text-green-600' : 'text-red-600'}`}>
                    {health.api.available ? <CheckCircle size={12} /> : <WifiOff size={12} />}
                    <span>{health.api.available ? 'Online' : 'Offline'}</span>
                    {health.api.latency && <span>({health.api.latency}ms)</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WebSocket:</span>
                  <span className={`flex items-center space-x-1 ${health.websocket.available ? 'text-green-600' : 'text-red-600'}`}>
                    {health.websocket.available ? <CheckCircle size={12} /> : <WifiOff size={12} />}
                    <span>{health.websocket.available ? 'Available' : 'Unavailable'}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Troubleshooting Advice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Troubleshooting Tips</h4>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• Check your internet connection</li>
              <li>• Try refreshing the page</li>
              <li>• Disable browser extensions that might block WebSockets</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={12} />
            <span>Retry Connection</span>
          </button>
        )}
        <button
          onClick={runDiagnostics}
          disabled={isRunningDiagnostics}
          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRunningDiagnostics ? 'animate-spin' : ''} />
          <span>{isRunningDiagnostics ? 'Running...' : 'Run Diagnostics'}</span>
        </button>
      </div>
    </div>
  );
};
