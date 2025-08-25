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
    
    // Generate mock tasks for now
    let tasks = generateMockTasks();
    
    // Filter by status if provided
    if (status && status !== 'all') {
      tasks = tasks.filter(task => task.status === status);
    }
    
    // Sort tasks
    tasks.sort((a, b) => {
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
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    // Limit results
    tasks = tasks.slice(0, limit);
    
    return NextResponse.json({
      success: true,
      tasks,
      total: tasks.length
    });
    
  } catch (error) {
    console.error('Error fetching agent tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent tasks' },
      { status: 500 }
    );
  }
}

// POST /api/agents/tasks/export - Export tasks data
export async function POST(request: NextRequest) {
  try {
    const { status, tasks: taskIds } = await request.json();
    
    // Generate mock tasks and filter as requested
    let tasks = generateMockTasks();
    
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }
    
    if (taskIds && taskIds.length > 0) {
      tasks = tasks.filter(task => taskIds.includes(task.id));
    }
    
    const csvData = generateTasksCSV(tasks);
    
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="agent-tasks.csv"'
      }
    });
    
  } catch (error) {
    console.error('Error exporting tasks:', error);
    return NextResponse.json(
      { error: 'Failed to export tasks' },
      { status: 500 }
    );
  }
}

function generateMockTasks(): AgentTask[] {
  const agentNames = [
    'EnhancedLangChainCoreAgent',
    'ResearchIntelligenceAgent',
    'CommunicationExpertAgent',
    'PersonalizationExpertAgent',
    'IntegrationMasterAgent',
    'QualityAssuranceAgent',
    'EmergencyResponseAgent'
  ];
  
  const taskTypes = ['chat', 'workflow', 'automation', 'analysis'] as const;
  const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
  
  const samplePrompts = [
    'Analyze user behavior patterns from the latest analytics data',
    'Generate a comprehensive marketing strategy for Q4 campaign',
    'Research competitive landscape for AI assistant market',
    'Optimize database performance and identify bottlenecks',
    'Create personalized user onboarding flow recommendations',
    'Integrate new payment processing API with error handling',
    'Conduct security audit and vulnerability assessment',
    'Design automated testing strategy for new features',
    'Develop crisis communication plan for potential outages',
    'Implement real-time monitoring and alerting system'
  ];
  
  const tasks: AgentTask[] = [];
  
  // Generate 50 mock tasks
  for (let i = 0; i < 50; i++) {
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const agentName = agentNames[Math.floor(Math.random() * agentNames.length)];
    const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    
    let startedAt, completedAt, duration, response;
    
    if (status !== 'pending') {
      startedAt = new Date(createdAt.getTime() + Math.random() * 60000);
      
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        completedAt = new Date(startedAt.getTime() + Math.random() * 300000);
        duration = completedAt.getTime() - startedAt.getTime();
        
        if (status === 'completed') {
          response = `Task completed successfully. Generated comprehensive analysis with actionable insights and recommendations.`;
        } else if (status === 'failed') {
          response = `Task failed due to timeout or processing error. Please retry with adjusted parameters.`;
        }
      }
    }
    
    const inputTokens = Math.floor(Math.random() * 2000) + 500;
    const outputTokens = status === 'completed' ? Math.floor(Math.random() * 1500) + 300 : 0;
    
    tasks.push({
      id: `task_${i.toString().padStart(3, '0')}_${Date.now()}`,
      agentId: agentName.toLowerCase().replace('agent', ''),
      agentName,
      type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      status,
      prompt,
      response,
      createdAt: createdAt.toISOString(),
      startedAt: startedAt?.toISOString(),
      completedAt: completedAt?.toISOString(),
      duration,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      metadata: {
        priority: Math.floor(Math.random() * 10) + 1,
        source: 'web_interface',
        userId: `user_${Math.floor(Math.random() * 100)}`
      }
    });
  }
  
  return tasks;
}

function generateTasksCSV(tasks: AgentTask[]): string {
  const headers = [
    'Task ID',
    'Agent Name',
    'Type',
    'Status',
    'Prompt',
    'Created At',
    'Duration (ms)',
    'Input Tokens',
    'Output Tokens',
    'Total Tokens'
  ];
  
  const rows = tasks.map(task => [
    task.id,
    task.agentName,
    task.type,
    task.status,
    `"${task.prompt.replace(/"/g, '""')}"`, // Escape quotes in CSV
    task.createdAt,
    task.duration?.toString() || '',
    task.tokens?.input.toString() || '',
    task.tokens?.output.toString() || '',
    task.tokens?.total.toString() || ''
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}