import React from "react";
import type { AgentMetrics, AgentHealth } from "../../types/chat";

interface MetricsDisplayProps {
  agentMetrics: AgentMetrics | null;
  agentHealth: AgentHealth | null;
}
const formatUptime = (uptimeMs: number): string => {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  agentMetrics,
  agentHealth,
}) => {
  if (!agentMetrics && !agentHealth) return null;

  return (
    <div className="mt-3 p-3 bg-gray-900/50 border border-gray-600/50 rounded-lg">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {agentMetrics && (
          <>
            <div>
              <span className="text-gray-400">Requests</span>
              <div className="text-sm font-semibold text-blue-400">
                {agentMetrics.requests_processed}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Success Rate</span>
              <div className="text-sm font-semibold text-green-400">
                {agentMetrics.requests_processed > 0
                  ? `${(
                      (agentMetrics.successful_responses /
                        agentMetrics.requests_processed) *
                      100
                    ).toFixed(1)}%`
                  : "100%"}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Avg Response</span>
              <div className="text-sm font-semibold text-yellow-400">
                {Math.round(agentMetrics.average_response_time)}ms
              </div>
            </div>
            <div>
              <span className="text-gray-400">Cache Hit Rate</span>
              <div className="text-sm font-semibold text-purple-400">
                {agentMetrics.cache_hits + agentMetrics.cache_misses > 0
                  ? `${(
                      (agentMetrics.cache_hits /
                        (agentMetrics.cache_hits + agentMetrics.cache_misses)) *
                      100
                    ).toFixed(1)}%`
                  : "0%"}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Intent Accuracy</span>
              <div className="text-sm font-semibold text-cyan-400">
                {(agentMetrics.intent_accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-gray-400">Tool Accuracy</span>
              <div className="text-sm font-semibold text-orange-400">
                {(agentMetrics.tool_selection_accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-gray-400">Uptime</span>
              <div className="text-sm font-semibold text-gray-300">
                {formatUptime(agentMetrics.uptime)}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Health</span>
              <div
                className={`text-sm font-semibold ${
                  agentHealth?.healthy ? "text-green-400" : "text-red-400"
                }`}
              >
                {agentHealth?.healthy ? "✅ Healthy" : "⚠️ Issues"}
              </div>
            </div>
          </>
        )}
      </div>

      {agentHealth &&
        !agentHealth.healthy &&
        agentHealth.issues?.length > 0 && (
          <div className="mt-2 text-xs text-red-300">
            Issues: {agentHealth.issues?.join(", ")}
          </div>
        )}
    </div>
  );
};
