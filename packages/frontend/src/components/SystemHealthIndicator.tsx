import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Database,
  Brain,
  Headphones,
  Calendar,
  Mail,
  Shield,
  Settings,
} from "lucide-react";

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded" | "checking" | "unknown";
  message: string;
  details?: any;
  response_time?: number;
  last_checked?: string;
}

interface HealthReport {
  timestamp: string;
  overall_status: string;
  checks: Record<string, HealthStatus>;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    checking: number;
  };
}

interface SystemHealthIndicatorProps {
  token: string;
}

const SystemHealthIndicator: React.FC<SystemHealthIndicatorProps> = ({
  token,
}) => {
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthStatus = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("🏥 Fetching system health status...");
      const response = await fetch("/api/health/system", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      console.log("🏥 Health data received:", data);

      setHealthReport(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("❌ Health check error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Auto-refresh health status
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealthStatus();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [fetchHealthStatus, autoRefresh]);

  // Initial load
  useEffect(() => {
    fetchHealthStatus();
  }, [fetchHealthStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "unhealthy":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "degraded":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "checking":
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
  return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 border-green-200";
      case "unhealthy":
        return "bg-red-100 text-red-800 border-red-200";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "checking":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
  return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "database":
        return <Database className="w-5 h-5" />;
      case "openai_api":
        return <Brain className="w-5 h-5" />;
      case "voice_endpoints":
      case "deepgram_service":
        return <Headphones className="w-5 h-5" />;
      case "calendar_endpoints":
        return <Calendar className="w-5 h-5" />;
      case "email_endpoints":
        return <Mail className="w-5 h-5" />;
      case "auth_endpoints":
      case "vault_endpoints":
        return <Shield className="w-5 h-5" />;
      case "hierarchical_agents":
      case "tool_registry":
      case "langchain_integration":
        return <Activity className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const formatCategoryName = (category: string) => {
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getOverallHealthPercentage = () => {
    if (!healthReport) return 0;
    const { healthy, total } = healthReport.summary;
    return Math.round((healthy / total) * 100);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-sm font-medium text-red-800">
            System Health Check Failed
          </h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchHealthStatus}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
        >
          Retry Health Check
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900">
            System Health Status
          </h3>
          {healthReport && (
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                healthReport.overall_status,
              )}`}
            >
              {getStatusIcon(healthReport.overall_status)}
              <span className="ml-2">
                {getOverallHealthPercentage()}% Healthy
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto-refresh
          </label>

          <button
            onClick={fetchHealthStatus}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Last update info */}
      {lastUpdate && (
  <p className="text-sm text-slate-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      )}

      {/* Health checks grid */}
      {healthReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(healthReport.checks).map(([category, health]) => (
            <div
              key={category}
              className={`p-4 rounded-lg border ${getStatusColor(
                health.status,
              )} transition-all hover:shadow-md`}
            >
              <div className="flex items-center gap-3 mb-2">
                {getCategoryIcon(category)}
                <h4 className="font-medium text-sm">
                  {formatCategoryName(category)}
                </h4>
                {getStatusIcon(health.status)}
              </div>

              <p className="text-xs mb-2">{health.message}</p>

              {health.response_time && (
                <div className="text-xs opacity-75">
                  Response: {health.response_time}ms
                </div>
              )}

              {health.details && Object.keys(health.details).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer hover:underline">
                    Details
                  </summary>
                  <div className="mt-1 text-xs opacity-75">
                    {Object.entries(health.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary statistics */}
      {healthReport && (
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-900 mb-2">Health Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {healthReport.summary.healthy}
              </div>
              <div className="text-slate-600">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {healthReport.summary.unhealthy}
              </div>
              <div className="text-slate-600">Unhealthy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {healthReport.summary.checking}
              </div>
              <div className="text-slate-600">Checking</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-600">
                {healthReport.summary.total}
              </div>
              <div className="text-slate-600">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !healthReport && (
          <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-slate-600">
            <Clock className="w-5 h-5 animate-spin" />
            <span>Running comprehensive health check...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemHealthIndicator;
