import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Agents API: Fetching available agents');

    // Use environment variable for API URL - this works correctly for server-side calls
    const apiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:8000';
    console.log('API URL being used:', apiUrl);
    // Try the direct agents list endpoint first
    let response = await fetch(`${apiUrl}/api/v2/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let agentsData;
    
    if (!response.ok) {
      // If direct endpoint fails, try the status endpoint as fallback
      console.log('Direct agents endpoint failed, trying status endpoint...');
      response = await fetch(`${apiUrl}/api/v2/agents/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`Python API returned ${response.status}`);
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        
        // If backend is not initialized, return mock data for now
        if (errorText.includes('not initialized')) {
          console.log('Backend not initialized, returning default agents');
          return NextResponse.json({
            success: true,
            data: [
              {
                id: 'chat_assistant',
                name: 'Chat Assistant',
                description: 'General purpose conversational AI assistant',
                capabilities: ['conversation', 'analysis', 'help'],
                model: 'GPT-5',
                status: 'available'
              },
              {
                id: 'research_agent',
                name: 'Research Agent',
                description: 'Specialized agent for research and information gathering',
                capabilities: ['research', 'analysis', 'web_search'],
                model: 'GPT-5',
                status: 'available'
              }
            ],
            timestamp: new Date().toISOString()
          });
        }
        
        throw new Error(`Python API error: ${response.status} - ${errorText}`);
      }
      
      agentsData = await response.json();
      
      // Transform the status data to match frontend expectations
      const agents = Object.values(agentsData.agents || {}).map((agent: any) => ({
        id: agent.agent_id,
        name: agent.agent_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: `${agent.config.type.charAt(0).toUpperCase() + agent.config.type.slice(1)} agent with specialized capabilities`,
        capabilities: agent.config.capabilities || [],
        model: agent.model?.toUpperCase() || 'GPT-5',
        status: agent.status
      }));
      
      agentsData = { data: agents };
    } else {
      agentsData = await response.json();
    }

    console.log('Agents API: Success from Python backend');
    
    // Handle the response format (could be direct agents or status format)
    const agents = agentsData.data || Object.values(agentsData.agents || {}).map((agent: any) => ({
      id: agent.agent_id || agent.id,
      name: agent.name || agent.agent_id?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      description: agent.description || `${agent.config?.type.charAt(0).toUpperCase() + agent.config?.type.slice(1)} agent with specialized capabilities`,
      capabilities: agent.capabilities || agent.config?.capabilities || [],
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