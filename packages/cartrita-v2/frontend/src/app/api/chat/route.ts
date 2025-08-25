import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Proxy to Python backend using simple chat endpoint
    // Try multiple possible endpoints for robustness
    const endpoints = [
      'http://cartrita-v2-python:8002/api/v2/simple-chat',
      'http://python-backend:8002/api/v2/simple-chat',
      'http://localhost:8002/api/v2/simple-chat'
    ];

    let lastError: any;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}:`, error);
        lastError = error;
        continue;
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}