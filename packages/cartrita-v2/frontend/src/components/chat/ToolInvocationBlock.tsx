'use client';

import React, { useState } from 'react';
import { 
  Wrench, 
  ChevronDown, 
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Code,
  Copy,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { useThemeStore } from '../../store/additionalStores';

export interface ToolInvocation {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  input?: any;
  output?: any;
  error?: string;
  duration?: number;
  timestamp: Date;
  metadata?: {
    cost?: number;
    tokens_used?: number;
    rate_limited?: boolean;
    retries?: number;
  };
}

interface ToolInvocationBlockProps {
  tool: ToolInvocation;
  onRetry?: (toolId: string) => void;
  onCancel?: (toolId: string) => void;
  expandable?: boolean;
  className?: string;
}

const ToolInvocationBlock: React.FC<ToolInvocationBlockProps> = ({
  tool,
  onRetry,
  onCancel,
  expandable = true,
  className = ''
}) => {
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Wrench className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (tool.status) {
      case 'pending':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'running':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'cancelled':
        return 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/20';
      default:
        return isDark ? 'border-gray-600 bg-gray-700/20' : 'border-gray-200 bg-gray-50';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const handleCopyInput = async () => {
    if (tool.input) {
      await navigator.clipboard.writeText(formatJSON(tool.input));
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    }
  };

  const handleCopyOutput = async () => {
    if (tool.output) {
      await navigator.clipboard.writeText(formatJSON(tool.output));
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  const handleRetry = () => {
    if (onRetry && (tool.status === 'error' || tool.status === 'cancelled')) {
      onRetry(tool.id);
    }
  };

  const handleCancel = () => {
    if (onCancel && (tool.status === 'pending' || tool.status === 'running')) {
      onCancel(tool.id);
    }
  };

  const getToolDisplayName = () => {
    // Convert snake_case to Title Case
    return tool.name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={`rounded-lg border p-3 ${getStatusColor()} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {getToolDisplayName()}
              </span>
              {tool.metadata?.rate_limited && (
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                  Rate Limited
                </span>
              )}
              {tool.metadata?.retries && tool.metadata.retries > 0 && (
                <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                  Retry {tool.metadata.retries}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{tool.timestamp.toLocaleTimeString()}</span>
              {tool.duration && (
                <span> • {formatDuration(tool.duration)}</span>
              )}
              {tool.metadata?.cost && (
                <span> • ${tool.metadata.cost.toFixed(4)}</span>
              )}
              {tool.metadata?.tokens_used && (
                <span> • {tool.metadata.tokens_used} tokens</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons */}
          {tool.status === 'error' && onRetry && (
            <button
              onClick={handleRetry}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded transition-colors"
            >
              Retry
            </button>
          )}
          
          {(tool.status === 'pending' || tool.status === 'running') && onCancel && (
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Expand/Collapse */}
          {expandable && (tool.input || tool.output || tool.error) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message (always visible if present) */}
      {tool.error && (
        <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Error</span>
          </div>
          <p className="mt-1 text-red-600 dark:text-red-300">{tool.error}</p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Tool Input */}
          {tool.input && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Input
                </h4>
                <button
                  onClick={handleCopyInput}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {copiedInput ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedInput ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className={`text-xs p-3 rounded border overflow-x-auto ${
                isDark 
                  ? 'bg-gray-800 border-gray-600 text-gray-300' 
                  : 'bg-gray-100 border-gray-200 text-gray-800'
              }`}>
                {formatJSON(tool.input)}
              </pre>
            </div>
          )}

          {/* Tool Output */}
          {tool.output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Output
                </h4>
                <button
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {copiedOutput ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedOutput ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className={`text-xs p-3 rounded border overflow-x-auto ${
                isDark 
                  ? 'bg-gray-800 border-gray-600 text-gray-300' 
                  : 'bg-gray-100 border-gray-200 text-gray-800'
              }`}>
                {formatJSON(tool.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolInvocationBlock;