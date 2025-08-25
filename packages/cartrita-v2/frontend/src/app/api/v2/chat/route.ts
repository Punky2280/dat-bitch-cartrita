import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/v2/chat`, {
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
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with backend' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'API proxy is running' });
}