import { useEffect, useState, useRef } from 'react';

interface HealthDashboardPageProps {
  token: string;
  onBack: () => void;
}

interface SystemHealthSummary {
  overall?: string;
  timestamp?: string;
  services?: Record<string, { status: string; message?: string }>;
  uptime_seconds?: number;
}

interface MetricPoint { t: number; v: number; }

const Sparkline = ({ data, stroke = '#60a5fa', width = 160, height = 40 }: { data: MetricPoint[]; stroke?: string; width?: number; height?: number }) => {
  if (!data || !data.length) return <svg width={width} height={height} />;
  
  // Filter out invalid data points
  const validData = data.filter(d => typeof d.v === 'number' && !isNaN(d.v) && isFinite(d.v));
  if (validData.length === 0) return <svg width={width} height={height} />;
  
  const values = validData.map(d => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = validData
    .map((d, i) => {
      const x = validData.length > 1 ? (i / (validData.length - 1)) * (width - 4) + 2 : width / 2;
      const y = height - 2 - ((d.v - min) / range) * (height - 4);
      
      // Ensure coordinates are valid numbers
      if (!isFinite(x) || !isFinite(y)) return null;
      return `${x},${y}`;
    })
    .filter(point => point !== null)
    .join(' ');
    
  if (!points) return <svg width={width} height={height} />;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
    </svg>
  );
};

const MiniBars = ({ data, width = 200, height = 60, barColor = '#a855f7' }: { data: number[]; width?: number; height?: number; barColor?: string }) => {
  if (!data || data.length === 0) return <svg width={width} height={height} />;
  
  // Filter out invalid values
  const validData = data.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0);
  if (validData.length === 0) return <svg width={width} height={height} />;
  
  const max = Math.max(...validData, 1);
  const barWidth = width / validData.length;
  
  return (
    <svg width={width} height={height}>
      {validData.map((v, i) => {
        const h = Math.max(0, (v / max) * (height - 4));
        const x = i * barWidth + 1;
        const y = height - h - 2;
        
        // Ensure all values are valid
        if (!isFinite(x) || !isFinite(y) || !isFinite(h) || h < 0) return null;
        
        return (
          <rect key={i} x={x} y={y} width={Math.max(0, barWidth - 2)} height={h} rx={2} fill={barColor} />
        );
      }).filter(rect => rect !== null)}
    </svg>
  );
};

const Gauge = ({ value, max = 100, label }: { value: number; max?: number; label: string }) => {
  // Ensure value and max are valid numbers
  const safeValue = typeof value === 'number' && isFinite(value) ? Math.max(0, value) : 0;
  const safeMax = typeof max === 'number' && isFinite(max) && max > 0 ? max : 100;
  const pct = Math.min(1, Math.max(0, safeValue / safeMax));
  const angle = pct * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="#374151" strokeWidth={8} />
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke="#4ade80"
            strokeWidth={8}
            strokeDasharray={`${Math.PI * 45} ${Math.PI * 45}`}
            strokeDashoffset={(1 - pct) * Math.PI * 45}
            strokeLinecap="round"
          />
          <g transform="translate(50,50)">
            <line
              x1={0}
              y1={0}
              x2={Math.sin((-90 + angle) * (Math.PI / 180)) * 35}
              y2={Math.cos((-90 + angle) * (Math.PI / 180)) * -35}
              stroke="#fbbf24"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1 text-xs text-gray-300">
          {Math.round(pct * 100)}%
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
};

const DonutChart = ({ data, label }: { data: any[], label: string }) => {
  const total = data.reduce((sum, item) => sum + parseInt(item.count || item.user_count || 0), 0);
  if (total === 0) return <div className="text-gray-500 text-xs">No data</div>;

  let cumulativePercentage = 0;
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a855f7'];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#374151" strokeWidth="3"/>
          {data.map((item, index) => {
            const percentage = (parseInt(item.count || item.user_count || 0) / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -cumulativePercentage;
            cumulativePercentage += percentage;
            return (
              <circle
                key={index}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={colors[index % colors.length]}
                strokeWidth="3"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 21 21)"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white font-semibold">
          {total}
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
};

const ActivityFeed = ({ activities }: { activities: any[] }) => {
  const getActivityIcon = (type: string, action: string) => {
    if (type === 'security') {
      switch (action) {
        case 'reveal_token_created': return '🔓';
        case 'reveal_token_used': return '👁️';
        case 'preferences_updated': return '⚙️';
        default: return '🔒';
      }
    }
    if (type === 'api_usage') return '🔑';
    return '📋';
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {activities.length === 0 ? (
        <div className="text-gray-500 text-xs text-center py-4">No recent activity</div>
      ) : (
        activities.map((activity, index) => (
          <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-800/50 rounded">
            <span className="text-lg">{getActivityIcon(activity.type, activity.action)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate">
                {activity.action.replace(/_/g, ' ')}
                {activity.user_id && (
                  <span className="text-gray-500"> • User {activity.user_id}</span>
                )}
              </p>
              <p className="text-xs text-gray-400">
                {formatTimeAgo(activity.created_at)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const SystemMetrics = ({ metrics }: { metrics: any }) => {
  if (!metrics.system_info) return <div className="text-gray-500 text-xs">Loading...</div>;
  const { memory_usage } = metrics.system_info;
  const memoryPercent = memory_usage ? (memory_usage.used / memory_usage.total * 100) : 0;
  const dbSize = metrics.database_stats?.database_size ? 
    (parseInt(metrics.database_stats.database_size) / (1024 * 1024 * 1024)).toFixed(2) : '0';
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-400">{memoryPercent.toFixed(1)}%</div>
        <div className="text-xs text-gray-400">Memory Usage</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-400">{dbSize}GB</div>
        <div className="text-xs text-gray-400">DB Size</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-400">
          {metrics.database_stats?.active_connections || 0}
        </div>
        <div className="text-xs text-gray-400">DB Connections</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-400">
          {Math.floor(metrics.system_info?.uptime_seconds / 3600) || 0}h
        </div>
        <div className="text-xs text-gray-400">Uptime</div>
      </div>
    </div>
  );
};

export const HealthDashboardPage = ({ token, onBack }: HealthDashboardPageProps) => {
  const [healthSummary, setHealthSummary] = useState<SystemHealthSummary>({});
  const [uptimeData, setUptimeData] = useState<MetricPoint[]>([]);
  const [errorRateData, setErrorRateData] = useState<MetricPoint[]>([]);
  const [latencyBuckets, setLatencyBuckets] = useState<number[]>([2,4,6,9,7,3,1]);
  const [dbConnections, setDbConnections] = useState(12);
  const [securityMetrics, setSecurityMetrics] = useState<any>({});
  const [apiKeyMetrics, setApiKeyMetrics] = useState<any>({});
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState(85);
  const tickRef = useRef<number>();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health/system', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setHealthSummary({
            overall: data.status || data.overall,
            timestamp: data.timestamp || new Date().toISOString(),
            services: data.services,
            uptime_seconds: data.uptime || data.uptimeSeconds,
          });
        }
      } catch {}
    };

    const fetchEnhancedMetrics = async () => {
      try {
        const securityRes = await fetch('/api/health/metrics/security', { headers: { Authorization: `Bearer ${token}` } });
        if (securityRes.ok) setSecurityMetrics((await securityRes.json()).data || {});

        const apiKeyRes = await fetch('/api/health/metrics/api-keys', { headers: { Authorization: `Bearer ${token}` } });
        if (apiKeyRes.ok) setApiKeyMetrics((await apiKeyRes.json()).data || {});

        const performanceRes = await fetch('/api/health/metrics/performance', { headers: { Authorization: `Bearer ${token}` } });
        if (performanceRes.ok) {
          const pdata = await performanceRes.json();
          setPerformanceMetrics(pdata.data || {});
          setHealthScore(pdata.data?.health_score || 85);
        }

        const activityRes = await fetch('/api/health/metrics/activity', { headers: { Authorization: `Bearer ${token}` } });
        if (activityRes.ok) setActivityFeed((await activityRes.json()).data?.activities || []);
      } catch {}
    };

    fetchHealth();
    fetchEnhancedMetrics();
  }, [token]);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const t = Date.now();
      setUptimeData(d => {
        const next = [...d, { t, v: (t - start) / 1000 / 60 }];
        return next.slice(-50);
      });
      setErrorRateData(d => {
        const base = d.length ? d[d.length - 1].v : 0.5;
        const nextVal = Math.max(0, base + (Math.random() - 0.5) * 0.2);
        const next = [...d, { t, v: nextVal }];
        return next.slice(-50);
      });
      setLatencyBuckets(prev => prev.map(v => Math.max(0, v + Math.round((Math.random()-0.5)*2))));
      setDbConnections(v => Math.max(5, Math.min(60, v + Math.round((Math.random()-0.5)*4))));
    }, 3000);
    tickRef.current = interval as unknown as number;
    return () => clearInterval(interval);
  }, []);

  const overallColor = healthSummary.overall === 'healthy' ? 'text-green-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-animated text-white">
      <header className="glass-card border-b border-gray-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient">System Health</h1>
            <p className="text-gray-400 mt-1">Operational metrics & service status (preview)</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="bg-purple-600/80 hover:bg-purple-600 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
              <span>←</span>
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Overall</div>
            <div className={`text-lg font-semibold ${overallColor}`}>{healthSummary.overall || '—'}</div>
            <div className="text-[10px] text-gray-500 mt-2">Updated {healthSummary.timestamp ? new Date(healthSummary.timestamp).toLocaleTimeString() : '—'}</div>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Uptime (min)</div>
            <Sparkline data={uptimeData} />
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Error Rate (sim)</div>
            <Sparkline data={errorRateData} stroke="#f87171" />
          </div>
          <div className="glass-card p-5 rounded-xl flex items-center justify-center">
            <Gauge value={dbConnections} max={60} label="DB Connections" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔒</span>
              <span>Security Events</span>
            </h2>
            <DonutChart 
              data={securityMetrics.user_preferences || []} 
              label="User Preferences" 
            />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔑</span>
              <span>API Key Stats</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {apiKeyMetrics.api_key_stats?.active_keys || 0}
                </div>
                <div className="text-xs text-gray-400">Active Keys</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {apiKeyMetrics.api_key_stats?.recently_used || 0}
                </div>
                <div className="text-xs text-gray-400">Recently Used</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  {securityMetrics.reveal_token_stats?.total_tokens_created || 0}
                </div>
                <div className="text-xs text-gray-400">Reveal Tokens</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  {securityMetrics.total_users_with_preferences || 0}
                </div>
                <div className="text-xs text-gray-400">Configured Users</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>📊</span>
              <span>System Performance</span>
            </h2>
            <SystemMetrics metrics={performanceMetrics} />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>💯</span>
              <span>Health Score</span>
            </h2>
            <div className="flex items-center justify-center">
              <Gauge value={healthScore} max={100} label="Overall Health" />
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>📈</span>
              <span>Live Activity</span>
            </h2>
            <ActivityFeed activities={activityFeed} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>⏱️</span>
              <span>Request Latency Histogram (simulated)</span>
            </h2>
            <MiniBars data={latencyBuckets} />
            <div className="grid grid-cols-7 text-[10px] text-gray-400 mt-2">
              {latencyBuckets.map((_, i) => (
                <div key={i} className="text-center">B{i+1}</div>
              ))}
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>�</span>
              <span>Services</span>
            </h2>
            <div className="space-y-2 text-sm">
              {healthSummary.services ? Object.entries(healthSummary.services).map(([k,v]) => {
                const color = v.status === 'healthy' ? 'text-green-400' : 'text-red-400';
                return (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-gray-400 truncate mr-2">{k}</span>
                    <span className={`flex items-center space-x-1 ${color}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.status === 'healthy' ? '#22c55e' : '#ef4444' }} />
                      <span>{v.status}</span>
                    </span>
                  </div>
                );
              }) : <div className="text-gray-500 text-xs">No service data yet.</div>}
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-semibold mb-2 flex items-center space-x-2">
            <span>✨</span>
            <span>Enhanced Dashboard Features</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-1">✅ Recently Added</h3>
              <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                <li>Security masking controls & metrics</li>
                <li>API key rotation scheduling</li>
                <li>Real-time activity monitoring</li>
                <li>Enhanced system performance metrics</li>
                <li>Overall health score calculation</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-1">🚀 Coming Soon</h3>
              <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                <li>Real-time WebSocket metrics stream</li>
                <li>Historical data retention & time ranges</li>
                <li>Service dependency graph visualization</li>
                <li>Advanced alerting & notification system</li>
                <li>Custom dashboard layouts</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HealthDashboardPage;
