import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Status API: Fetching system status');

    // Direct call to Python FastAPI backend
    const response = await fetch('http://localhost:8002/api/v2/chat/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Python API returned ${response.status}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      throw new Error(`Python API error: ${response.status} - ${errorText}`);
    }

    const status = await response.json();
    console.log('Status API: Success from Python backend');
    
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Python backend connection failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch status from Python backend', 
        details: error instanceof Error ? error.message : 'Unknown error',
        data: {
          database: 'error',
          openai: 'unknown',
          agents: 'error',
          mcp: 'error',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}