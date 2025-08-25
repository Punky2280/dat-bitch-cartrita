import { NextRequest, NextResponse } from 'next/server';

// POST /api/agents/tasks/[taskId]/cancel - Cancel a running task
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string; action: string } }
) {
  try {
    const { taskId, action } = params;
    
    console.log(`Performing ${action} on task ${taskId}`);
    
    // In a real implementation, you would:
    // - Find the task in your database
    // - Perform the requested action (cancel, retry, delete)
    // - Update the task status
    // - Return the updated task
    
    switch (action) {
      case 'cancel':
        // Cancel a running task
        console.log(`Cancelling task ${taskId}`);
        break;
        
      case 'retry':
        // Retry a failed task
        console.log(`Retrying task ${taskId}`);
        break;
        
      case 'delete':
        // Delete a completed/failed/cancelled task
        console.log(`Deleting task ${taskId}`);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      message: `Task ${action} action completed successfully`,
      taskId
    });
    
  } catch (error) {
    console.error(`Error performing ${params.action} on task:`, error);
    return NextResponse.json(
      { error: `Failed to ${params.action} task` },
      { status: 500 }
    );
  }
}