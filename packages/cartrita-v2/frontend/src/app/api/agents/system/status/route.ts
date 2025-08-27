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
    // Connect to Python backend for real system status
    try {
      const backendResponse = await fetch(`${process.env.PYTHON_API_BASE_URL || 'http://localhost:8000'}/api/v2/agents/system/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (backendResponse.ok) {
        const status = await backendResponse.json();
        return NextResponse.json({
          success: true,
          data: status
        });
      }
    } catch (backendError) {
      console.error('Failed to connect to Python backend for system status:', backendError);
    }

    // Fallback: return basic status if backend unavailable
    return NextResponse.json({
      success: true,
      data: {
        health: 'warning',
        activeAgents: 0,
        totalRequests: 0,
        successRate: 0,
        avgResponseTime: 0,
        uptime: '0 minutes',
        lastUpdate: new Date().toISOString(),
        services: [
          {
            name: 'Python Backend',
            status: 'offline',
            responseTime: 0
          }
        ],
        message: 'Backend system status service unavailable'
      }
    });
    
  } catch (error) {
    console.error('Error fetching system status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch system status',
      data: null
    }, { status: 500 });
  }
}

