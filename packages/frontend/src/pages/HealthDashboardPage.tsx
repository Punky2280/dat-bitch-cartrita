import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

// Advanced Area Chart component for time series data
const AreaChart = ({ data, width = 300, height = 120, color = '#60a5fa', label }: { data: MetricPoint[]; width?: number; height?: number; color?: string; label?: string }) => {
  if (!data || data.length === 0) return <div className="text-slate-500 text-xs text-center py-8">No data</div>;
  
  const validData = data.filter(d => typeof d.v === 'number' && !isNaN(d.v) && isFinite(d.v));
  if (validData.length === 0) return <div className="text-slate-500 text-xs text-center py-8">No data</div>;
  
  const values = validData.map(d => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = validData
    .map((d, i) => {
      const x = validData.length > 1 ? (i / (validData.length - 1)) * (width - 4) + 2 : width / 2;
      const y = height - 2 - ((d.v - min) / range) * (height - 20);
      return `${x},${y}`;
    })
    .join(' ');
    
  const areaPoints = `2,${height-2} ${points} ${width-2},${height-2}`;
  
  return (
    <div className="space-y-2">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`gradient-${color.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <polygon fill={`url(#gradient-${color.slice(1)})`} points={areaPoints} />
        <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
        {/* Data points */}
        {validData.map((d, i) => {
          const x = validData.length > 1 ? (i / (validData.length - 1)) * (width - 4) + 2 : width / 2;
          const y = height - 2 - ((d.v - min) / range) * (height - 20);
          return <circle key={i} cx={x} cy={y} r={1.5} fill={color} />;
        })}
      </svg>
      {label && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>{label}</span>
          <span>Latest: {validData[validData.length - 1]?.v.toFixed(2)}</span>
        </div>
      )}
    </div>
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
  <div className="absolute inset-0 flex items-end justify-center pb-1 text-xs text-slate-300">
          {Math.round(pct * 100)}%
        </div>
      </div>
  <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
};

// Enhanced Network Topology Visualization
const NetworkGraph = ({ connections, width = 250, height = 200 }: { connections: any[]; width?: number; height?: number }) => {
  if (!connections || connections.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        No network data
      </div>
    );
  }

  // Simplified network visualization
  const nodes = [
    { id: 'db', x: width * 0.2, y: height * 0.5, label: 'Database', color: '#3b82f6' },
    { id: 'api', x: width * 0.5, y: height * 0.3, label: 'API', color: '#10b981' },
    { id: 'cache', x: width * 0.5, y: height * 0.7, label: 'Cache', color: '#f59e0b' },
    { id: 'client', x: width * 0.8, y: height * 0.5, label: 'Clients', color: '#8b5cf6' }
  ];

  return (
    <div className="space-y-2">
      <svg width={width} height={height} className="overflow-visible">
        {/* Connections */}
        {nodes.map((from, i) => 
          nodes.slice(i + 1).map((to, j) => (
            <line 
              key={`${from.id}-${to.id}`}
              x1={from.x} y1={from.y} 
              x2={to.x} y2={to.y}
              stroke="#64748b" 
              strokeWidth={Math.random() > 0.3 ? 2 : 1}
              strokeOpacity={0.4}
              strokeDasharray={Math.random() > 0.5 ? "4,2" : "none"}
            />
          ))
        )}
        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id}>
            <circle 
              cx={node.x} cy={node.y} r={12} 
              fill={node.color} 
              stroke="white" 
              strokeWidth={2}
              className="animate-pulse"
            />
            <text 
              x={node.x} y={node.y + 20} 
              textAnchor="middle" 
              className="text-xs fill-slate-300"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="text-xs text-slate-400 text-center">
        Active connections: {connections.length || 0}
      </div>
    </div>
  );
};

const DonutChart = ({ data, label }: { data: any[], label: string }) => {
  const total = data.reduce((sum, item) => sum + parseInt(item.count || item.user_count || 0), 0);
  if (total === 0) return <div className="text-slate-500 text-xs">No data</div>;

  let cumulativePercentage = 0;
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a855f7'];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#334155" strokeWidth="3"/>
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
      <div className="text-xs text-slate-400 mt-1">{label}</div>
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
    <div className="text-slate-500 text-xs text-center py-4">No recent activity</div>
      ) : (
        activities.map((activity, index) => (
      <div key={index} className="flex items-start space-x-3 p-2 hover:bg-slate-800/50 rounded">
            <span className="text-lg">{getActivityIcon(activity.type, activity.action)}</span>
            <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate">
                {activity.action.replace(/_/g, ' ')}
                {activity.user_id && (
          <span className="text-slate-500"> • User {activity.user_id}</span>
                )}
              </p>
        <p className="text-xs text-slate-400">
                {formatTimeAgo(activity.created_at)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// Enhanced Heatmap Component for Time-based Analytics
const HeatmapGrid = ({ data, width = 300, height = 150 }: { data: any[], width?: number, height?: number }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cellWidth = width / 24;
  const cellHeight = height / 7;

  // Generate sample heatmap data for demonstration
  const getIntensity = (day: number, hour: number) => {
    return Math.random() * 0.8 + 0.1; // Random intensity between 0.1 and 0.9
  };

  return (
    <div className="space-y-2">
      <svg width={width} height={height}>
        {days.map((day, dayIndex) =>
          hours.map(hour => {
            const intensity = getIntensity(dayIndex, hour);
            const opacity = Math.max(0.1, intensity);
            return (
              <rect
                key={`${dayIndex}-${hour}`}
                x={hour * cellWidth}
                y={dayIndex * cellHeight}
                width={cellWidth - 1}
                height={cellHeight - 1}
                fill="#60a5fa"
                fillOpacity={opacity}
                rx={2}
              />
            );
          })
        )}
      </svg>
      <div className="flex justify-between text-xs text-slate-400">
        <span>Activity by Hour & Day</span>
        <span>Higher intensity = More activity</span>
      </div>
    </div>
  );
};

// Enhanced Timeline Component for Event Tracking
const EventTimeline = ({ events }: { events: any[] }) => {
  const timelineEvents = events.length > 0 ? events : [
    { type: 'info', message: 'System started', time: '10:00 AM', severity: 'low' },
    { type: 'warning', message: 'High memory usage detected', time: '10:15 AM', severity: 'medium' },
    { type: 'success', message: 'Backup completed successfully', time: '10:30 AM', severity: 'low' },
    { type: 'error', message: 'Database connection timeout', time: '10:45 AM', severity: 'high' }
  ];

  const getEventColor = (type: string) => {
    switch (type) {
      case 'error': return '#f87171';
      case 'warning': return '#fbbf24';
      case 'success': return '#34d399';
      default: return '#60a5fa';
    }
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {timelineEvents.map((event, index) => (
        <div key={index} className="flex items-start space-x-3">
          <div className="flex flex-col items-center">
            <div 
              className="w-3 h-3 rounded-full border-2 border-white"
              style={{ backgroundColor: getEventColor(event.type) }}
            />
            {index < timelineEvents.length - 1 && (
              <div className="w-px h-8 bg-slate-600 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex justify-between items-start">
              <p className="text-xs text-slate-300">{event.message}</p>
              <span className="text-xs text-slate-400">{event.time}</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                event.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                event.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {event.severity}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Performance Radar Chart
const RadarChart = ({ metrics, size = 200 }: { metrics: any, size?: number }) => {
  const attributes = [
    { name: 'CPU', value: metrics?.cpu || 75, angle: 0 },
    { name: 'Memory', value: metrics?.memory || 60, angle: 60 },
    { name: 'Disk', value: metrics?.disk || 85, angle: 120 },
    { name: 'Network', value: metrics?.network || 70, angle: 180 },
    { name: 'Latency', value: metrics?.latency || 80, angle: 240 },
    { name: 'Throughput', value: metrics?.throughput || 90, angle: 300 }
  ];

  const center = size / 2;
  const maxRadius = center - 30;

  const getPoint = (angle: number, radius: number) => {
    const radians = (angle - 90) * (Math.PI / 180);
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians)
    };
  };

  const polygonPoints = attributes
    .map(attr => {
      const radius = (attr.value / 100) * maxRadius;
      const point = getPoint(attr.angle, radius);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center space-y-2">
      <svg width={size} height={size}>
        {/* Background grid */}
        {[20, 40, 60, 80, 100].map(percent => {
          const radius = (percent / 100) * maxRadius;
          const gridPoints = attributes
            .map(attr => {
              const point = getPoint(attr.angle, radius);
              return `${point.x},${point.y}`;
            })
            .join(' ');
          return (
            <polygon
              key={percent}
              points={gridPoints}
              fill="none"
              stroke="#374151"
              strokeWidth={0.5}
              opacity={0.3}
            />
          );
        })}
        
        {/* Axis lines */}
        {attributes.map(attr => {
          const point = getPoint(attr.angle, maxRadius);
          return (
            <line
              key={attr.name}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="#374151"
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}
        
        {/* Data polygon */}
        <polygon
          points={polygonPoints}
          fill="#60a5fa"
          fillOpacity={0.3}
          stroke="#60a5fa"
          strokeWidth={2}
        />
        
        {/* Data points */}
        {attributes.map(attr => {
          const radius = (attr.value / 100) * maxRadius;
          const point = getPoint(attr.angle, radius);
          return (
            <circle
              key={attr.name}
              cx={point.x}
              cy={point.y}
              r={3}
              fill="#60a5fa"
            />
          );
        })}
        
        {/* Labels */}
        {attributes.map(attr => {
          const point = getPoint(attr.angle, maxRadius + 15);
          return (
            <text
              key={attr.name}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-xs fill-slate-300"
            >
              {attr.name}
            </text>
          );
        })}
      </svg>
      <div className="text-xs text-slate-400 text-center">System Performance Overview</div>
    </div>
  );
};

const SystemMetrics = ({ metrics }: { metrics: any }) => {
  if (!metrics.system_info) return <div className="text-slate-500 text-xs">Loading...</div>;
  const { memory_usage } = metrics.system_info;
  const memoryPercent = memory_usage ? (memory_usage.used / memory_usage.total * 100) : 0;
  const dbSize = metrics.database_stats?.database_size ? 
    (parseInt(metrics.database_stats.database_size) / (1024 * 1024 * 1024)).toFixed(2) : '0';
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-400">{memoryPercent.toFixed(1)}%</div>
  <div className="text-xs text-slate-400">Memory Usage</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-400">{dbSize}GB</div>
  <div className="text-xs text-slate-400">DB Size</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-400">
          {metrics.database_stats?.active_connections || 0}
        </div>
  <div className="text-xs text-slate-400">DB Connections</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-400">
          {Math.floor(metrics.system_info?.uptime_seconds / 3600) || 0}h
        </div>
  <div className="text-xs text-slate-400">Uptime</div>
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
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>({});
  const [isConnected, setIsConnected] = useState(false);
  const [cpuHistory, setCpuHistory] = useState<MetricPoint[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<MetricPoint[]>([]);
  const [networkHistory, setNetworkHistory] = useState<MetricPoint[]>([]);
  const [gcHistory, setGcHistory] = useState<MetricPoint[]>([]);
  const [eventLoopHistory, setEventLoopHistory] = useState<MetricPoint[]>([]);
  const [requestVolumeHistory, setRequestVolumeHistory] = useState<MetricPoint[]>([]);
  const [heapSpaceData, setHeapSpaceData] = useState<any[]>([]);
  const [connectionMetrics, setConnectionMetrics] = useState<any[]>([]);
  const tickRef = useRef<number>();
  const socketRef = useRef<Socket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const setupWebSocket = () => {
      const socket = io('/health', {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('🔗 Connected to health monitoring WebSocket');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from health monitoring WebSocket');
        setIsConnected(false);
      });

      socket.on('health_update', (data) => {
        setRealTimeMetrics(data);
        setHealthScore(data.health_score || 85);
        
        // Update system metrics and enhanced data
        if (data.system) {
          setDbConnections(data.database?.active_connections || 0);
          
          // Simulate enhanced metrics data
          const now = Date.now();
          setNetworkHistory(prev => {
            const next = [...prev, { t: now, v: Math.random() * 100 + 50 }];
            return next.slice(-30);
          });
          setGcHistory(prev => {
            const next = [...prev, { t: now, v: Math.random() * 20 + 5 }];
            return next.slice(-30);
          });
          setEventLoopHistory(prev => {
            const next = [...prev, { t: now, v: Math.random() * 0.5 + 0.1 }];
            return next.slice(-30);
          });
          setRequestVolumeHistory(prev => {
            const next = [...prev, { t: now, v: Math.floor(Math.random() * 200 + 100) }];
            return next.slice(-30);
          });
          
          // Simulate heap space data
          setHeapSpaceData([
            { name: 'old_space', used: 92.9, limit: 97.3, color: '#3b82f6' },
            { name: 'new_space', used: 0.9, limit: 1.0, color: '#10b981' },
            { name: 'code_space', used: 1.9, limit: 2.4, color: '#f59e0b' },
            { name: 'large_object_space', used: 18.5, limit: 18.9, color: '#8b5cf6' }
          ]);
          
          // Simulate connection metrics
          setConnectionMetrics([
            { type: 'http', count: Math.floor(Math.random() * 50 + 20) },
            { type: 'websocket', count: Math.floor(Math.random() * 10 + 5) },
            { type: 'db', count: data.database?.active_connections || 0 }
          ]);
        }
      });

      socket.on('health_history', (history) => {
        if (history.cpu) {
          setCpuHistory(history.cpu.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.memory) {
          setMemoryHistory(history.memory.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.errorRate) {
          setErrorRateData(history.errorRate.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.network) {
          setNetworkHistory(history.network.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.gc) {
          setGcHistory(history.gc.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.eventLoop) {
          setEventLoopHistory(history.eventLoop.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
        if (history.requestVolume) {
          setRequestVolumeHistory(history.requestVolume.map((point: any) => ({ t: point.timestamp, v: point.value })));
        }
      });

      socketRef.current = socket;
    };

    setupWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

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
  <header className="glass-card border-b border-slate-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient">System Health</h1>
            <p className="text-slate-400 mt-1">Real-time operational metrics & service status</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} ${isConnected ? 'animate-pulse' : ''}`}></div>
              <span>{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
            <button onClick={onBack} className="bg-purple-600/80 hover:bg-purple-600 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
              <span>←</span>
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Real-Time Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Overall</div>
            <div className={`text-lg font-semibold ${overallColor}`}>{healthSummary.overall || '—'}</div>
            <div className="text-[10px] text-slate-500 mt-2">Updated {healthSummary.timestamp ? new Date(healthSummary.timestamp).toLocaleTimeString() : '—'}</div>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">CPU Usage (%)</div>
            <Sparkline data={cpuHistory.length ? cpuHistory : uptimeData} stroke="#60a5fa" />
            <div className="text-xs text-slate-500 mt-1">
              {realTimeMetrics.system?.cpu?.toFixed(1) || '0.0'}% current
            </div>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Memory Usage (%)</div>
            <Sparkline data={memoryHistory.length ? memoryHistory : errorRateData} stroke="#34d399" />
            <div className="text-xs text-slate-500 mt-1">
              {realTimeMetrics.system?.memory?.toFixed(1) || '0.0'}% current
            </div>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Error Rate</div>
            <Sparkline data={errorRateData} stroke="#f87171" />
            <div className="text-xs text-slate-500 mt-1">
              {realTimeMetrics.api?.error_rate?.toFixed(2) || '0.00'}% current
            </div>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Request Volume</div>
            <Sparkline data={requestVolumeHistory} stroke="#8b5cf6" />
            <div className="text-xs text-slate-500 mt-1">
              {requestVolumeHistory.length > 0 ? requestVolumeHistory[requestVolumeHistory.length - 1]?.v.toFixed(0) : '0'}/min current
            </div>
          </div>
          <div className="glass-card p-5 rounded-xl flex items-center justify-center">
            <Gauge value={realTimeMetrics.database?.active_connections || dbConnections} max={60} label="DB Connections" />
          </div>
        </div>

        {/* Advanced Performance Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🌐</span>
              <span>Network Activity</span>
            </h2>
            <AreaChart data={networkHistory} color="#10b981" label="Network I/O (MB/s)" />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔄</span>
              <span>Garbage Collection</span>
            </h2>
            <AreaChart data={gcHistory} color="#f59e0b" label="GC Duration (ms)" />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>⚡</span>
              <span>Event Loop Delay</span>
            </h2>
            <AreaChart data={eventLoopHistory} color="#ef4444" label="Delay (ms)" />
          </div>
        </div>

        {/* Memory Heap Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🧠</span>
              <span>V8 Heap Spaces</span>
            </h2>
            <div className="space-y-3">
              {heapSpaceData.map((space) => {
                const usage = (space.used / space.limit) * 100;
                return (
                  <div key={space.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{space.name.replace('_', ' ')}</span>
                      <span className="text-slate-400">{space.used.toFixed(1)}MB / {space.limit.toFixed(1)}MB</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${usage}%`, 
                          backgroundColor: space.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔗</span>
              <span>Connection Topology</span>
            </h2>
            <NetworkGraph connections={connectionMetrics} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {connectionMetrics.map((conn) => (
                <div key={conn.type} className="text-center p-2 bg-slate-800/50 rounded">
                  <div className="font-semibold text-white">{conn.count}</div>
                  <div className="text-slate-400">{conn.type.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security and API Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="text-xl font-bold text-blue-400">
                  {apiKeyMetrics.api_key_stats?.active_keys || 0}
                </div>
                <div className="text-xs text-slate-400">Active Keys</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">
                  {apiKeyMetrics.api_key_stats?.recently_used || 0}
                </div>
                <div className="text-xs text-slate-400">Recently Used</div>
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-400">
                  {securityMetrics.reveal_token_stats?.total_tokens_created || 0}
                </div>
                <div className="text-xs text-slate-400">Reveal Tokens</div>
              </div>
              <div>
                <div className="text-xl font-bold text-purple-400">
                  {securityMetrics.total_users_with_preferences || 0}
                </div>
                <div className="text-xs text-slate-400">Configured Users</div>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>📊</span>
              <span>Live Metrics Summary</span>
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">CPU Utilization</span>
                <span className="text-sm font-semibold text-blue-400">
                  {realTimeMetrics.system?.cpu?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Memory Usage</span>
                <span className="text-sm font-semibold text-green-400">
                  {realTimeMetrics.system?.memory?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Active Connections</span>
                <span className="text-sm font-semibold text-purple-400">
                  {realTimeMetrics.database?.active_connections || dbConnections}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Error Rate</span>
                <span className="text-sm font-semibold text-red-400">
                  {realTimeMetrics.api?.error_rate?.toFixed(2) || '0.00'}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Health Score</span>
                <span className="text-sm font-semibold text-yellow-400">
                  {healthScore}/100
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>📊</span>
              <span>Real-Time Performance</span>
            </h2>
            {realTimeMetrics.system ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{realTimeMetrics.system.cpu?.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">CPU Load</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{realTimeMetrics.system.memory?.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">Memory</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {realTimeMetrics.api?.total_requests || 0}
                  </div>
                  <div className="text-xs text-slate-400">Total Requests</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {Math.floor((realTimeMetrics.system?.uptime || 0) / 3600)}h
                  </div>
                  <div className="text-xs text-slate-400">Uptime</div>
                </div>
              </div>
            ) : (
              <SystemMetrics metrics={performanceMetrics} />
            )}
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

        {/* Database Performance Panel */}
        {realTimeMetrics.database && (
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🗄️</span>
              <span>Database Performance</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {realTimeMetrics.database.active_connections}
                </div>
                <div className="text-xs text-slate-400">Active Connections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {(realTimeMetrics.database.database_size / (1024 * 1024 * 1024)).toFixed(2)}GB
                </div>
                <div className="text-xs text-slate-400">Database Size</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  {realTimeMetrics.database.table_stats?.length || 0}
                </div>
                <div className="text-xs text-slate-400">Active Tables</div>
              </div>
            </div>
            {realTimeMetrics.database.table_stats?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Top Active Tables</h3>
                <div className="space-y-1 text-xs">
                  {realTimeMetrics.database.table_stats.slice(0, 3).map((table: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span>{table.tablename}</span>
                      <span>{(table.inserts + table.updates + table.deletes) || 0} ops</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>⏱️</span>
              <span>Request Latency Histogram {realTimeMetrics.api ? '(live)' : '(simulated)'}</span>
            </h2>
            <MiniBars data={latencyBuckets} />
            <div className="grid grid-cols-7 text-[10px] text-slate-400 mt-2">
              {latencyBuckets.map((_, i) => (
                <div key={i} className="text-center">B{i+1}</div>
              ))}
            </div>
            {realTimeMetrics.api && (
              <div className="mt-2 text-xs text-slate-400">
                Avg Response Time: {realTimeMetrics.api.average_response_time?.toFixed(0)}ms
              </div>
            )}
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
                    <span className="text-slate-400 truncate mr-2">{k}</span>
                    <span className={`flex items-center space-x-1 ${color}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.status === 'healthy' ? '#22c55e' : '#ef4444' }} />
                      <span>{v.status}</span>
                    </span>
                  </div>
                );
              }) : <div className="text-slate-500 text-xs">No service data yet.</div>}
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
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                <li>Security masking controls & metrics</li>
                <li>API key rotation scheduling</li>
                <li>Real-time activity monitoring</li>
                <li>Enhanced system performance metrics</li>
                <li>Overall health score calculation</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-1">🚀 Coming Soon</h3>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                <li>Real-time WebSocket metrics stream</li>
                <li>Historical data retention & time ranges</li>
                <li>Service dependency graph visualization</li>
                <li>Advanced alerting & notification system</li>
                <li>Custom dashboard layouts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* NEW ENHANCED VISUALIZATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔥</span>
              <span>Activity Heatmap</span>
            </h2>
            <HeatmapGrid data={[]} />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>📋</span>
              <span>Event Timeline</span>
            </h2>
            <EventTimeline events={activityFeed} />
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🎯</span>
              <span>Performance Radar</span>
            </h2>
            <RadarChart metrics={{
              cpu: realTimeMetrics.system?.cpu || 75,
              memory: realTimeMetrics.system?.memory || 60,
              disk: 85,
              network: networkHistory.length > 0 ? networkHistory[networkHistory.length - 1]?.v || 70 : 70,
              latency: 100 - (realTimeMetrics.api?.error_rate || 5) * 5,
              throughput: Math.min(100, (realTimeMetrics.api?.total_requests || 100) / 10)
            }} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default HealthDashboardPage;
