import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Agents API: Fetching available agents');

    // Direct call to Python FastAPI backend
    const response = await fetch('http://localhost:8002/api/v2/agents/status', {
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

    const agentsData = await response.json();
    console.log('Agents API: Success from Python backend');
    
    // Transform the agents data to match frontend expectations
    const agents = Object.values(agentsData.agents || {}).map((agent: any) => ({
      id: agent.agent_id,
      name: agent.agent_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      description: `${agent.config.type.charAt(0).toUpperCase() + agent.config.type.slice(1)} agent with specialized capabilities`,
      capabilities: agent.config.capabilities || [],
      model: agent.model?.toUpperCase() || 'GPT-5',
      status: agent.status
    }));
    
    return NextResponse.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Python backend connection failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch agents from Python backend', 
        details: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}