import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  maxTokens: number;
  temperature: number;
  responseTimeout: number;
  retryAttempts: number;
  enableLogging: boolean;
  enableTelemetry: boolean;
  priority: number;
}

// GET /api/agents/[agentId]/config - Get agent configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params;
    
    // Try to read the agent file to get configuration
    const agentPaths = [
      path.join(process.cwd(), '../../backend/src/agi/consciousness'),
      path.join(process.cwd(), '../backend/src/agi/consciousness'),
      path.join(process.cwd(), 'backend/src/agi/consciousness')
    ];
    
    let agentFilePath: string | null = null;
    
    // Find the agent file
    for (const basePath of agentPaths) {
      try {
        const files = await fs.readdir(basePath);
        const agentFile = files.find(file => 
          file.toLowerCase().includes(agentId.toLowerCase()) && 
          file.endsWith('.js')
        );
        
        if (agentFile) {
          agentFilePath = path.join(basePath, agentFile);
          break;
        }
      } catch (error) {
        // Directory doesn't exist, continue to next path
        continue;
      }
    }
    
    if (!agentFilePath) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Read and parse the agent file
    const agentContent = await fs.readFile(agentFilePath, 'utf-8');
    
    // Extract configuration from the agent file
    const config = extractAgentConfig(agentContent);
    
    return NextResponse.json(config);
    
  } catch (error) {
    console.error('Error fetching agent config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[agentId]/config - Update agent configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params;
    const config: AgentConfig = await request.json();
    
    // In a real implementation, you would save this configuration
    // For now, we'll just return success
    console.log(`Updating agent ${agentId} configuration:`, config);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Configuration updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating agent config:', error);
    return NextResponse.json(
      { error: 'Failed to update agent configuration' },
      { status: 500 }
    );
  }
}

function extractAgentConfig(agentContent: string): AgentConfig {
  // Default configuration
  const defaultConfig: AgentConfig = {
    name: 'Unknown Agent',
    role: 'sub',
    description: 'Agent description not available',
    systemPrompt: 'Default system prompt',
    allowedTools: [],
    maxTokens: 4000,
    temperature: 0.7,
    responseTimeout: 30000,
    retryAttempts: 3,
    enableLogging: true,
    enableTelemetry: true,
    priority: 5
  };
  
  try {
    // Extract name from class name
    const classNameMatch = agentContent.match(/class\s+(\w+)\s+extends/);
    if (classNameMatch) {
      defaultConfig.name = classNameMatch[1].replace('Agent', '');
    }
    
    // Extract role from constructor
    const roleMatch = agentContent.match(/role:\s*['"`]([^'"`]+)['"`]/);
    if (roleMatch) {
      defaultConfig.role = roleMatch[1];
    }
    
    // Extract description
    const descriptionMatch = agentContent.match(/description:\s*['"`]([^'"`]+)['"`]/s);
    if (descriptionMatch) {
      defaultConfig.description = descriptionMatch[1];
    }
    
    // Extract system prompt
    const systemPromptMatch = agentContent.match(/systemPrompt:\s*['"`]([\s\S]*?)['"`],?\s*allowedTools/);
    if (systemPromptMatch) {
      defaultConfig.systemPrompt = systemPromptMatch[1];
    }
    
    // Extract allowed tools
    const allowedToolsMatch = agentContent.match(/allowedTools:\s*\[([\s\S]*?)\]/);
    if (allowedToolsMatch) {
      const toolsString = allowedToolsMatch[1];
      const tools = toolsString.match(/['"`]([^'"`]+)['"`]/g);
      if (tools) {
        defaultConfig.allowedTools = tools.map(tool => tool.replace(/['"`]/g, ''));
      }
    }
    
  } catch (error) {
    console.error('Error parsing agent configuration:', error);
  }
  
  return defaultConfig;
}