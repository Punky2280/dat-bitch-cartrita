// MCPService.ts - Frontend service for Model Context Protocol API

export async function mcpRequest(payload: any) {
  const res = await fetch('/api/v2/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`MCP request failed: ${res.status}`);
  }
  return res.json();
}

// Example usage:
// import { mcpRequest } from '../services/MCPService';
// const result = await mcpRequest({ action: 'status' });