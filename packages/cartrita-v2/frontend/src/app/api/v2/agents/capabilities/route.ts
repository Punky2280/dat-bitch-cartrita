import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/agents/capabilities`, {
      method: 'GET',
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
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Agent capabilities API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent capabilities from backend' },
      { status: 500 }
    );
  }
}