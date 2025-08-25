import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
      services: {
        frontend: 'healthy',
        // Add checks for external dependencies
        api: await checkAPIHealth(),
        websocket: await checkWebSocketHealth(),
      }
    };

    return NextResponse.json(healthCheck, { status: 200 });
  } catch (error) {
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}

// Check API backend health
async function checkAPIHealth(): Promise<string> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8002/api';
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unreachable';
  }
}

// Check WebSocket health
async function checkWebSocketHealth(): Promise<string> {
  try {
    // Since WebSocket is client-side, we'll just check if the URL is configured
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    return wsUrl ? 'configured' : 'not_configured';
  } catch (error) {
    return 'error';
  }
}

export async function HEAD() {
  // Return minimal response for HEAD requests
  return new NextResponse(null, { status: 200 });
}