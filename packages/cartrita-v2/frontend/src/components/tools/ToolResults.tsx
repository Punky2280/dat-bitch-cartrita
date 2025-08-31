'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Code,
  Database,
  BarChart3,
  Globe,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ToolCall, ToolResult } from '@/types';
import { cn, formatFileSize } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface ToolResultsProps {
  toolCalls: ToolCall[];
  className?: string;
}

const ToolResults: React.FC<ToolResultsProps> = ({ toolCalls, className }) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [fullscreenResult, setFullscreenResult] = useState<string | null>(null);

  const toggleExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const getToolIcon = (toolName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      vision: Eye,
      document: FileText,
      code: Code,
      database: Database,
      analytics: BarChart3,
      web: Globe,
      image: Image
    };
    
    const IconComponent = iconMap[toolName.toLowerCase()] || Zap;
    return <IconComponent className="w-4 h-4" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderToolResult = (result: ToolResult) => {
    const isExpanded = expandedResults.has(result.id);

    return (
      <motion.div
        key={result.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-input rounded-lg overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-3 bg-accent/50 cursor-pointer"
          onClick={() => toggleExpanded(result.id)}
        >
          <div className="flex items-center space-x-3">
            {getToolIcon(result.toolName)}
            <div>
              <p className="font-medium">{result.toolName}</p>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                {getStatusIcon(result.status)}
                <span className="capitalize">{result.status}</span>
                {result.executionTime && (
                  <span>• {result.executionTime}ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenResult(result.id);
              }}
              className="p-1.5 hover:bg-background rounded transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(JSON.stringify(result.data, null, 2));
              }}
              className="p-1.5 hover:bg-background rounded transition-colors"
              title="Copy result"
            >
              <Copy className="w-4 h-4" />
            </button>

            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Input Parameters */}
                {result.input && Object.keys(result.input).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Input Parameters</h4>
                    <div className="bg-background rounded border p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(result.input, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Output Data */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Result</h4>
                  {renderResultData(result)}
                </div>

                {/* Metadata */}
                {result.metadata && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Metadata</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(result.metadata).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}:
                          </span>
                          <span className="ml-2">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Details */}
                {result.status === 'error' && result.error && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-red-600">Error Details</h4>
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-700">{result.error}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderResultData = (result: ToolResult) => {
    const { data, type } = result;

    switch (type) {
      case 'image':
        return (
          <div className="space-y-2">
            {data.url && (
              <img
                src={data.url}
                alt="Tool result"
                className="max-w-full max-h-64 rounded border"
              />
            )}
            {data.analysis && (
              <div className="bg-background rounded border p-3">
                <p className="text-sm">{data.analysis}</p>
              </div>
            )}
          </div>
        );

      case 'chart':
      case 'visualization':
        return (
          <div className="bg-background rounded border p-4">
            {data.chartData ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Chart visualization would render here
                </p>
                <pre className="text-xs bg-accent rounded p-2 overflow-x-auto">
                  {JSON.stringify(data.chartData, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No chart data available</p>
            )}
          </div>
        );

      case 'code':
        return (
          <div className="bg-background rounded border">
            <div className="flex items-center justify-between p-2 border-b bg-accent/50">
              <span className="text-xs font-medium">Code Output</span>
              <button
                onClick={() => copyToClipboard(data.code || '')}
                className="p-1 hover:bg-background rounded transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <pre className="p-3 text-sm overflow-x-auto">
              <code>{data.code || data.output || 'No output'}</code>
            </pre>
          </div>
        );

      case 'table':
        return (
          <div className="bg-background rounded border overflow-hidden">
            {data.headers && data.rows ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-accent/50">
                    <tr>
                      {data.headers.map((header: string, index: number) => (
                        <th key={index} className="px-3 py-2 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 10).map((row: any[], index: number) => (
                      <tr key={index} className="border-t">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.rows.length > 10 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    Showing 10 of {data.rows.length} rows
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No table data available
              </div>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            {data.files?.map((file: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-background rounded border">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(file.url, '_blank')}
                    className="p-2 hover:bg-accent rounded transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = file.url;
                      link.download = file.name;
                      link.click();
                    }}
                    className="p-2 hover:bg-accent rounded transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="bg-background rounded border p-3">
            <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
              {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn("space-y-3", className)}>
        {toolCalls.map((toolCall) => (
          <div key={toolCall.id}>
            {toolCall.results.map((result) => renderToolResult(result))}
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreenResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setFullscreenResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-xl shadow-2xl border w-full max-w-6xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">Tool Result Details</h3>
                <button
                  onClick={() => setFullscreenResult(null)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {toolCalls.flatMap(call => call.results)
                  .find(result => result.id === fullscreenResult) &&
                  renderToolResult(
                    toolCalls.flatMap(call => call.results)
                      .find(result => result.id === fullscreenResult)!
                  )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ToolResults;