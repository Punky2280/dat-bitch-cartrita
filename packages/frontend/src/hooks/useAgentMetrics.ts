import { useState, useEffect, useCallback } from "react";
import api from "../services/apiService";
import type { AgentMetrics, AgentHealth } from "../types/chat";

export const useAgentMetrics = (token: string, isConnected: boolean) => {
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);

  const fetchAgentMetrics = useCallback(async () => {
    if (!token) return;

    try {
      const response = await api.get("/api/agent/metrics");

      if (response.success) {
        const data = response.data;
        setAgentMetrics(data.metrics);
        setAgentHealth(data.health);
      }
    } catch (error) {
      console.error("Error fetching agent metrics:", error);
    }
  }, [token]);

  useEffect(() => {
    if (!isConnected) return;

    // Initial fetch
    fetchAgentMetrics();

    // Set up periodic updates
    const interval = setInterval(fetchAgentMetrics, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [fetchAgentMetrics, isConnected]);

  return {
    agentMetrics,
    agentHealth,
    refetch: fetchAgentMetrics,
  };
};
