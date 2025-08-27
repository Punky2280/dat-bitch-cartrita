import { NextRequest, NextResponse } from 'next/server';

interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  type: 'chat' | 'workflow' | 'automation' | 'analysis';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  response?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: {
    priority: number;
    source: string;
    userId?: string;
  };
}

// GET /api/agents/tasks - Get all agent tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Connect to Python backend for real agent tasks
    try {
      const backendResponse = await fetch(`${process.env.PYTHON_API_BASE_URL || 'http://localhost:8000'}/api/v2/agents/tasks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (backendResponse.ok) {
        let tasks = await backendResponse.json();
        
        // Filter by status if provided
        if (status && status !== 'all') {
          tasks = tasks.filter((task: AgentTask) => task.status === status);
        }

        // Sort tasks
        tasks.sort((a: AgentTask, b: AgentTask) => {
          let aValue, bValue;
          
          switch (sortBy) {
            case 'duration':
              aValue = a.duration || 0;
              bValue = b.duration || 0;
              break;
            case 'agent':
              aValue = a.agentName;
              bValue = b.agentName;
              break;
            case 'createdAt':
            default:
              aValue = new Date(a.createdAt).getTime();
              bValue = new Date(b.createdAt).getTime();
              break;
          }
          
          if (sortOrder === 'desc') {
            return typeof aValue === 'string' ? bValue.localeCompare(aValue) : bValue - aValue;
          } else {
            return typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue;
          }
        });

        // Apply limit
        if (limit > 0) {
          tasks = tasks.slice(0, limit);
        }

        return NextResponse.json({
          success: true,
          data: {
            tasks,
            total: tasks.length,
            status: status || 'all'
          }
        });
      }
    } catch (backendError) {
      console.error('Failed to connect to Python backend:', backendError);
    }

    // Fallback to empty result if backend is unavailable
    return NextResponse.json({
      success: true,
      data: {
        tasks: [],
        total: 0,
        status: status || 'all',
        message: 'Backend agent service unavailable'
      }
    });

  } catch (error) {
    console.error('Error fetching agent tasks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agent tasks',
      data: { tasks: [], total: 0 }
    }, { status: 500 });
  }
}

// POST /api/agents/tasks - Create a new agent task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, type, prompt, priority = 1, metadata } = body;

    if (!agentId || !type || !prompt) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, type, prompt'
      }, { status: 400 });
    }

    // Connect to Python backend to create real task
    try {
      const backendResponse = await fetch(`${process.env.PYTHON_API_BASE_URL || 'http://localhost:8000'}/api/v2/chat/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: `task_${Date.now()}`,
          message: prompt,
          agent_id: agentId,
          stream: false,
          context: {
            task_type: type,
            priority,
            metadata
          }
        })
      });

      if (backendResponse.ok) {
        const response = await backendResponse.json();
        
        const newTask: AgentTask = {
          id: `task_${Date.now()}`,
          agentId,
          agentName: agentId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: type as AgentTask['type'],
          status: 'completed',
          prompt,
          response: response.message || response.content,
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: response.processing_time || 1000,
          tokens: {
            input: prompt.split(' ').length,
            output: (response.message || response.content || '').split(' ').length,
            total: prompt.split(' ').length + (response.message || response.content || '').split(' ').length
          },
          metadata: {
            priority,
            source: 'api',
            ...metadata
          }
        };

        return NextResponse.json({
          success: true,
          data: { task: newTask }
        });
      }
    } catch (backendError) {
      console.error('Failed to connect to Python backend for task creation:', backendError);
    }

    // Fallback: return error if backend unavailable
    return NextResponse.json({
      success: false,
      error: 'Agent service unavailable - task could not be created',
      data: { task: null }
    }, { status: 503 });

  } catch (error) {
    console.error('Error creating agent task:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create agent task'
    }, { status: 500 });
  }
}