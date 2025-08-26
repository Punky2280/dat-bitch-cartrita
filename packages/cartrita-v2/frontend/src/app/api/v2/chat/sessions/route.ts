import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';

    console.log('Sessions API: Fetching chat sessions');

    // Direct call to Python FastAPI backend
    const apiUrl = process.env.PYTHON_API_BASE_URL || 'http://python-backend:8002';
    const response = await fetch(`${apiUrl}/api/v2/chat/sessions?limit=${limit}&offset=${offset}`, {
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

    const sessions = await response.json();
    console.log('Sessions API: Success from Python backend');
    
    return NextResponse.json({
      success: true,
      data: sessions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Python backend connection failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch sessions from Python backend', 
        details: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Sessions API: Creating new session:', body);

    // Direct call to Python FastAPI backend
    const apiUrl = process.env.PYTHON_API_BASE_URL || 'http://python-backend:8002';
    const response = await fetch(`${apiUrl}/api/v2/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: body.title,
        agent_id: body.agent_id,
        context: body.context || {}
      }),
    });

    if (!response.ok) {
      console.error(`Python API returned ${response.status}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      throw new Error(`Python API error: ${response.status} - ${errorText}`);
    }

    const session = await response.json();
    console.log('Sessions API: Session created successfully');
    
    return NextResponse.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Python backend connection failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create session in Python backend', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}