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

// Lightweight sparkline component (inline SVG) to avoid extra chart deps for scaffold
const Sparkline = ({ data, stroke = '#60a5fa', width = 160, height = 40 }: { data: MetricPoint[]; stroke?: string; width?: number; height?: number }) => {
  if (!data.length) return <svg width={width} height={height} />;
  const min = Math.min(...data.map(d => d.v));
  const max = Math.max(...data.map(d => d.v));
  const range = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((d.v - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
    </svg>
  );
};

// Simple bar chart for histogram placeholder
const MiniBars = ({ data, width = 200, height = 60, barColor = '#a855f7' }: { data: number[]; width?: number; height?: number; barColor?: string }) => {
  const max = Math.max(...data, 1);
  const barWidth = width / data.length;
  return (
    <svg width={width} height={height}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 4);
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - h - 2}
            width={barWidth - 2}
            height={h}
            rx={2}
            className="transition-all"
            fill={barColor}
          />
        );
      })}
    </svg>
  );
};

// Gauge placeholder
const Gauge = ({ value, max = 100, label }: { value: number; max?: number; label: string }) => {
  const pct = Math.min(1, value / max);
  const angle = pct * 180; // semicircle
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

export const HealthDashboardPage = ({ token, onBack }: HealthDashboardPageProps) => {
  const [healthSummary, setHealthSummary] = useState<SystemHealthSummary>({});
  const [uptimeData, setUptimeData] = useState<MetricPoint[]>([]);
  const [errorRateData, setErrorRateData] = useState<MetricPoint[]>([]);
  const [latencyBuckets, setLatencyBuckets] = useState<number[]>([2,4,6,9,7,3,1]);
  const [dbConnections, setDbConnections] = useState(12);
  const tickRef = useRef<number>();

  // Fetch system health
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
      } catch (e) {
        // degrade silently for scaffold
      }
    };
    fetchHealth();
  }, [token]);

  // Simulated streaming metrics (placeholder until WebSocket integration)
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
        {/* Overview Row */}
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

        {/* Latency Histogram & Services */}
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
              <span>🧩</span>
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

        {/* Roadmap Notice */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-semibold mb-2 flex items-center space-x-2">
            <span>🛠️</span>
            <span>Upcoming Enhancements</span>
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>Real-time WebSocket metrics stream (OpenTelemetry export tap)</li>
            <li>Drill-down trace viewer & error log integration</li>
            <li>Historical retention & selectable time ranges</li>
            <li>Service dependency graph & saturation indicators</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default HealthDashboardPage;
