import { NextRequest, NextResponse } from 'next/server';

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  currentLoad: number;
  uptime: string;
  lastActive: string;
  performance: {
    timestamp: string;
    responseTime: number;
    successRate: number;
    errorCount: number;
    tokenUsage: number;
  }[];
  toolUsage: { [tool: string]: number };
  errorTypes: { [type: string]: number };
}

// GET /api/agents/metrics - Get agent metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const agentId = searchParams.get('agentId');
    
    // Connect to Python backend for real agent metrics
    try {
      const backendUrl = `${process.env.PYTHON_API_BASE_URL || 'http://localhost:8000'}/api/v2/agents/metrics`;
      const params = new URLSearchParams();
      if (timeRange) params.append('timeRange', timeRange);
      if (agentId) params.append('agentId', agentId);
      
      const backendResponse = await fetch(`${backendUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (backendResponse.ok) {
        const metrics = await backendResponse.json();
        
        return NextResponse.json({
          success: true,
          timeRange,
          data: { metrics }
        });
      }
    } catch (backendError) {
      console.error('Failed to connect to Python backend for metrics:', backendError);
    }
    
    // Fallback to empty metrics if backend unavailable
    return NextResponse.json({
      success: true,
      timeRange,
      data: { 
        metrics: [],
        message: 'Backend metrics service unavailable'
      }
    });
    
  } catch (error) {
    console.error('Error fetching agent metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agent metrics',
      data: { metrics: [] }
    }, { status: 500 });
  }
}

// POST /api/agents/metrics/export - Export metrics data  
export async function POST(request: NextRequest) {
  try {
    const { timeRange, agentId } = await request.json();
    
    // Connect to Python backend to get real metrics for export
    try {
      const backendUrl = `${process.env.PYTHON_API_BASE_URL || 'http://localhost:8000'}/api/v2/agents/metrics`;
      const params = new URLSearchParams();
      if (timeRange) params.append('timeRange', timeRange);
      if (agentId) params.append('agentId', agentId);
      
      const backendResponse = await fetch(`${backendUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (backendResponse.ok) {
        const metrics = await backendResponse.json();
        const csvData = generateCSV(metrics);
        
        return new NextResponse(csvData, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="agent-metrics.csv"'
          }
        });
      }
    } catch (backendError) {
      console.error('Failed to connect to Python backend for metrics export:', backendError);
    }
    
    // Fallback: return error if backend unavailable
    return NextResponse.json({
      success: false,
      error: 'Metrics service unavailable - export could not be completed'
    }, { status: 503 });
    
  } catch (error) {
    console.error('Error exporting metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export metrics'
    }, { status: 500 });
  }
}

function generateCSV(metrics: AgentMetrics[]): string {
  const headers = [
    'Agent ID',
    'Agent Name',
    'Total Requests',
    'Successful Requests',
    'Failed Requests',
    'Success Rate (%)',
    'Average Response Time (ms)',
    'Current Load (%)',
    'Uptime',
    'Last Active'
  ];
  
  const rows = metrics.map(metric => [
    metric.agentId,
    metric.agentName,
    metric.totalRequests.toString(),
    metric.successfulRequests.toString(),
    metric.failedRequests.toString(),
    ((metric.successfulRequests / metric.totalRequests) * 100).toFixed(2),
    metric.averageResponseTime.toFixed(2),
    metric.currentLoad.toFixed(2),
    metric.uptime,
    new Date(metric.lastActive).toLocaleString()
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}