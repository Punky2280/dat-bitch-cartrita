import React from "react";
import type {
  ChatStats,
  ConnectionStats,
  AgentMetrics,
  AgentHealth,
} from "../../types/chat";
import { MetricsDisplay } from "./MetricsDisplay";

interface ChatHeaderProps {
  chatStats: ChatStats;
  isConnected: boolean;
  connectionStats: ConnectionStats;
  connectionError: string | null;
  agentMetrics: AgentMetrics | null;
  agentHealth: AgentHealth | null;
  showMetrics: boolean;
  onToggleMetrics: () => void;
  onClearChat: () => void;
  onClearError: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chatStats,
  isConnected,
  connectionStats,
  connectionError,
  agentMetrics,
  agentHealth,
  showMetrics,
  onToggleMetrics,
  onClearChat,
  onClearError,
}) => {
  return (
    <div className="p-4 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/80 to-gray-700/80">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient">
            Chat with Cartrita
          </h2>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-xs text-gray-400">
              {chatStats.totalMessages > 0
                ? `${chatStats.totalMessages} messages`
                : "Start a new conversation"}
            </p>
            {chatStats.averageResponseTime > 0 && (
              <span className="text-xs text-blue-400">
                ⚡ {Math.round(chatStats.averageResponseTime)}ms avg
              </span>
            )}
            {chatStats.toolsUsed > 0 && (
              <span className="text-xs text-purple-400">
                🔧 {chatStats.toolsUsed} tools used
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isConnected
                  ? "bg-green-500 shadow-lg shadow-green-500/50 status-pulse"
                  : "bg-red-500 shadow-lg shadow-red-500/50"
              }`}
            />
            <div className="text-right">
              <span className="text-sm text-gray-300 block">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              {connectionStats.latency > 0 && (
                <span className="text-xs text-gray-500">
                  {connectionStats.latency}ms
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onToggleMetrics}
            className={`text-gray-400 hover:text-blue-400 transition-colors p-1 rounded ${
              showMetrics ? "text-blue-400" : ""
            }`}
            title="Toggle metrics"
          >
            📊
          </button>

          <button
            onClick={onClearChat}
            className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
            title="Clear chat history"
          >
            🗑️
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="mt-2 p-2 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm flex justify-between items-center">
          <span>⚠️ {connectionError}</span>
          <button
            onClick={onClearError}
            className="text-red-300 hover:text-red-100 ml-2"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {showMetrics && (
        <MetricsDisplay agentMetrics={agentMetrics} agentHealth={agentHealth} />
      )}
    </div>
  );
};
