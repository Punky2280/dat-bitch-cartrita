import { NextRequest, NextResponse } from 'next/server';

interface SystemStatus {
  health: 'healthy' | 'warning' | 'critical';
  activeAgents: number;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  uptime: string;
  lastUpdate: string;
  services: {
    name: string;
    status: 'online' | 'offline' | 'degraded';
    responseTime: number;
  }[];
}

// GET /api/agents/system/status - Get overall system status
export async function GET(request: NextRequest) {
  try {
    // Generate mock system status
    const status = generateSystemStatus();
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('Error fetching system status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}

function generateSystemStatus(): SystemStatus {
  const activeAgents = Math.floor(Math.random() * 3) + 7; // 7-9 active agents
  const totalRequests = Math.floor(Math.random() * 50000) + 10000;
  const successRate = 92 + Math.random() * 7; // 92-99% success rate
  const avgResponseTime = 200 + Math.random() * 300; // 200-500ms
  
  // Determine health based on metrics
  let health: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  if (successRate < 95 || avgResponseTime > 400) {
    health = 'warning';
  }
  
  if (successRate < 90 || avgResponseTime > 600) {
    health = 'critical';
  }
  
  const services = [
    {
      name: 'Agent Orchestrator',
      status: 'online' as const,
      responseTime: 50 + Math.random() * 100
    },
    {
      name: 'LangChain Core',
      status: 'online' as const,
      responseTime: 100 + Math.random() * 150
    },
    {
      name: 'OpenTelemetry Tracing',
      status: 'online' as const,
      responseTime: 20 + Math.random() * 50
    },
    {
      name: 'Agent Tool Registry',
      status: Math.random() > 0.1 ? 'online' as const : 'degraded' as const,
      responseTime: 30 + Math.random() * 80
    },
    {
      name: 'Monitoring Dashboard',
      status: 'online' as const,
      responseTime: 150 + Math.random() * 200
    }
  ];
  
  // Calculate uptime (mock data)
  const uptimeHours = Math.floor(Math.random() * 720) + 24; // 1-30 days
  const uptimeDays = Math.floor(uptimeHours / 24);
  const remainingHours = uptimeHours % 24;
  
  return {
    health,
    activeAgents,
    totalRequests,
    successRate,
    avgResponseTime,
    uptime: `${uptimeDays} days, ${remainingHours} hours`,
    lastUpdate: new Date().toISOString(),
    services
  };
}