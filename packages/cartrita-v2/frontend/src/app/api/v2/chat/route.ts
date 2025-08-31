import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.PYTHON_API_BASE_URL || 'http://python-backend:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/v2/simple-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any auth headers
        ...Object.fromEntries(
          [...request.headers.entries()].filter(([key]) => 
            key.toLowerCase().startsWith('authorization') || 
            key.toLowerCase().startsWith('x-')
          )
        ),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform backend response format to match frontend expectations
    const transformedData = {
      response: data.content || data.response || 'No response available',
      ...data
    };
    
    return NextResponse.json(transformedData);
    
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to communicate with backend',
        details: error instanceof Error ? error.message : 'Unknown error',
        backend_url: `${BACKEND_URL}/api/v2/simple-chat`
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'API proxy is running' });
}