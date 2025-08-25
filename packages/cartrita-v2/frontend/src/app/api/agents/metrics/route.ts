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
    
    // Generate mock metrics data for now
    const mockMetrics = generateMockMetrics(agentId);
    
    return NextResponse.json({
      success: true,
      timeRange,
      metrics: mockMetrics
    });
    
  } catch (error) {
    console.error('Error fetching agent metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent metrics' },
      { status: 500 }
    );
  }
}

// GET /api/agents/metrics/export - Export metrics data
export async function POST(request: NextRequest) {
  try {
    const { timeRange, agentId } = await request.json();
    
    // Generate CSV data
    const metrics = generateMockMetrics(agentId);
    const csvData = generateCSV(metrics);
    
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="agent-metrics.csv"'
      }
    });
    
  } catch (error) {
    console.error('Error exporting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}

function generateMockMetrics(agentId?: string | null): AgentMetrics[] {
  const agentNames = [
    'EnhancedLangChainCoreAgent',
    'ResearchIntelligenceAgent',
    'CommunicationExpertAgent',
    'PersonalizationExpertAgent',
    'IntegrationMasterAgent',
    'QualityAssuranceAgent',
    'EmergencyResponseAgent',
    'CodeMaestroAgent',
    'CartritaCoreAgent'
  ];
  
  const metrics: AgentMetrics[] = [];
  
  const agentsToProcess = agentId ? [agentId] : agentNames;
  
  agentsToProcess.forEach((name, index) => {
    const totalRequests = Math.floor(Math.random() * 5000) + 1000;
    const failedRequests = Math.floor(totalRequests * (0.02 + Math.random() * 0.08));
    const successfulRequests = totalRequests - failedRequests;
    
    // Generate performance data points
    const performance = [];
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString();
      performance.push({
        timestamp,
        responseTime: 200 + Math.random() * 800,
        successRate: 0.9 + Math.random() * 0.1,
        errorCount: Math.floor(Math.random() * 10),
        tokenUsage: Math.floor(Math.random() * 2000) + 500
      });
    }
    
    metrics.push({
      agentId: name.toLowerCase().replace('agent', ''),
      agentName: name,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: 200 + Math.random() * 600,
      currentLoad: Math.random() * 100,
      uptime: `${Math.floor(Math.random() * 30) + 1} days`,
      lastActive: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      performance,
      toolUsage: {
        'semantic_search': Math.floor(Math.random() * 500),
        'web_search': Math.floor(Math.random() * 300),
        'code_analysis': Math.floor(Math.random() * 200),
        'data_processing': Math.floor(Math.random() * 400),
        'api_integration': Math.floor(Math.random() * 150)
      },
      errorTypes: {
        'timeout_error': Math.floor(Math.random() * 20),
        'validation_error': Math.floor(Math.random() * 15),
        'api_error': Math.floor(Math.random() * 10),
        'processing_error': Math.floor(Math.random() * 25)
      }
    });
  });
  
  return metrics;
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