import { NextRequest, NextResponse } from 'next/server';

// GET /api/agents/tools - Get available tools for agents
export async function GET(request: NextRequest) {
  try {
    // Return list of available tools that agents can use
    const tools = [
      'semantic_search',
      'web_search',
      'code_analysis',
      'data_processing',
      'api_integration',
      'file_operations',
      'database_query',
      'image_processing',
      'text_summarization',
      'language_translation',
      'sentiment_analysis',
      'email_integration',
      'calendar_management',
      'notification_system',
      'user_authentication',
      'performance_monitoring',
      'error_tracking',
      'log_analysis',
      'backup_operations',
      'security_scanning',
      'workflow_automation',
      'report_generation',
      'data_visualization',
      'machine_learning',
      'natural_language_processing'
    ];
    
    return NextResponse.json({
      success: true,
      tools,
      total: tools.length
    });
    
  } catch (error) {
    console.error('Error fetching available tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available tools' },
      { status: 500 }
    );
  }
}