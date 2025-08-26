import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Chat API: Received request:', body);
    
    // Transform frontend request to match Python backend format
    const pythonRequest = {
      message: body.message || body.prompt || '',
      user_id: body.user_id || 'frontend_user',
      agent_id: body.agent_id || body.selectedAgent || 'supervisor_cartrita_v2',
      session_id: body.session_id || 'default'
    };

    console.log('Chat API: Sending to Python backend:', pythonRequest);

    // Direct call to Python FastAPI backend simple chat endpoint (port 8002)
    const response = await fetch('http://localhost:8002/api/v2/simple-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pythonRequest),
    });

    if (!response.ok) {
      console.error(`Python API returned ${response.status}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      throw new Error(`Python API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Chat API: Success from Python backend');
    
    // Return normalized response
    const normalizedResponse = {
      success: true,
      content: data.content || data.result || data.response || data.message || 
               (data.success ? 'Hello! How can I help you today?' : 'No response received'),
      agent_id: data.agent_id || pythonRequest.agent_id,
      session_id: pythonRequest.session_id,
      model: data.metadata?.model || data.model_id || data.model || 'cartrita-system',
      processing_time: data.execution_time_ms || data.timing_ms || data.response_time_ms || 0,
      timestamp: data.timestamp || new Date().toISOString(),
      provider: 'python',
      task_id: data.task_id,
      reasoning: data.reasoning
    };
    
    return NextResponse.json(normalizedResponse);
  } catch (error) {
    console.error('Python backend connection failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to connect to Python backend', 
        details: error instanceof Error ? error.message : 'Unknown error',
        content: "I'm sorry, I'm having trouble connecting to my AI backend right now. Please try again in a moment.",
        agent_id: 'error-handler',
        provider: 'python-error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}